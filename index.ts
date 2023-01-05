import chroma from "chroma-js";
import iwanthue from "iwanthue";

import seedrandom from "seedrandom";

import FileSaver from "file-saver";

import Graph from "graphology";
import { Sigma } from "sigma";
import { parse } from "graphology-gexf/browser";

import simmelianStrength from 'graphology-metrics/edge/simmelian-strength';
import betweennessCentrality from 'graphology-metrics/centrality/betweenness';
import closenessCentrality from 'graphology-metrics/centrality/closeness';
import eigenvectorCentrality from 'graphology-metrics/centrality/eigenvector';
import hits from 'graphology-metrics/centrality/hits';
import {
  degreeCentrality,
  inDegreeCentrality,
  outDegreeCentrality
} from 'graphology-metrics/centrality/degree';
import pagerank from 'graphology-metrics/centrality/pagerank';

import louvain from 'graphology-communities-louvain';
import forceAtlas2 from 'graphology-layout-forceatlas2';

import { createNodeCompoundProgram } from 'sigma/rendering/webgl/programs/common/node';
import NodePointWithBorderProgram from '@yomguithereal/sigma-experiments-renderers/node/node.point.border';
import NodeHaloProgram from '@yomguithereal/sigma-experiments-renderers/node/node.halo';
import EdgeCurveProgram from '@yomguithereal/sigma-experiments-renderers/edge/edge.curve';
import drawLabel from "./custom-label"

import { cropToLargestConnectedComponent } from "graphology-components";

/* TODO:
- reapply louvain/FA2 to original graph
- add cluster labels ? https://codesandbox.io/s/github/jacomyal/sigma.js/tree/main/examples/clusters-labels
- generate minimaps for specific metrics:
  - indegree <= edges colors = out node
  - outdegree <= edges colors = in node
  - betweeness
  - pagerank
  ...
}*/

const palette = iwanthue(9, {
  colorSpace: 'sensible',
  seed: "logiciels libres",
  clustering: 'force-vector',
  attempts: 5,
});

fetch("./graph.gexf")
  .then((res) => res.text())
  .then((gexf) => {
    const graph = parse(Graph, gexf);
    const graph2 = new Graph({type: "directed"});

    simmelianStrength.assign(graph);
    betweennessCentrality.assign(graph, {getEdgeWeight: null});
    closenessCentrality.assign(graph);
    degreeCentrality.assign(graph);
    inDegreeCentrality.assign(graph);
    outDegreeCentrality.assign(graph);
    eigenvectorCentrality.assign(graph);
    hits.assign(graph);
    pagerank.assign(graph);

    const seed = Math.random() + "";
    document.getElementById("seed").innerHTML = seed;
    louvain.assign(graph, {
      resolution: 1.075,
      getEdgeWeight: 'simmelianStrength',
      rng: seedrandom(seed)
    });

    graph.forEachNode((node, attrs)  => {
      const color = palette[attrs['community'] % palette.length],
        size = attrs['nansi-degree'];
      graph2.addNode(node, {
        ...attrs,
        type: "circle",
        size: Math.sqrt(size),
        color: color,
        labelSize: Math.pow(500 * size, 0.25),
        borderSize: 1.5,
        borderColor: chroma(color).darken().hex(),
        haloSize: 1 * size,
        haloColor: "rgba(" + chroma(color).brighten().rgb().join(",") + ",0.9)",
        haloIntensity: 0.25
      });
    });

    graph.forEachEdge((edge, attrs, source, target) => {
      if (attrs.simmelianStrength > 3)
        graph2.addEdge(source, target, {
          ...attrs,
          curveness: 0.3,
          size: 0.5,
          color: "#999"
        });
    });

    cropToLargestConnectedComponent(graph2);

    const FA2settings = forceAtlas2.inferSettings(graph2);
/*
    FA2settings["edgeWeightInfluence"] = 1;
    FA2settings["adjustSizes"] = true;
    FA2settings["gravity"] = 1.25;
    FA2settings["strongGravityMode"] = false;
    FA2settings["scalingRatio"] = 0.01;
*/
    forceAtlas2.assign(graph2, {
      iterations: 1000,
      getEdgeWeight: 'simmelianStrength',
      settings: FA2settings
    });


    const sigmaSettings = {
      minCameraRatio: 0.1,
      maxCameraRatio: 10,
      labelFont: '"DejaVu Sans Mono", monospace',
      labelColor: {color: '#000'},
      labelWeight: 'bold',
      labelDensity: 1.05,
      labelGridCellSize: 200,
      nodeProgramClasses: {
        circle: createNodeCompoundProgram([
          NodeHaloProgram,
          NodePointWithBorderProgram
        ])
      },
      defaultEdgeColor: '#000',
      defaultEdgeType: 'curve',
      edgeProgramClasses: {
        curve: EdgeCurveProgram
      },
      labelRenderer: drawLabel,
      stagePadding: 50
    };
    const container = document.getElementById("sigma") as HTMLElement;
    const renderer = new Sigma(graph2, container, sigmaSettings);
    const camera = renderer.getCamera();

    const angleInput = document.getElementById("angle") as HTMLInputElement;
    angleInput.onchange = e => {
      camera.angle = Math.PI * parseFloat(angleInput.value) / 360; 
      renderer.refresh();
    }
 
    const hSizeInput = document.getElementById("halo-size") as HTMLInputElement;
    hSizeInput.onchange = e => graph2.updateEachNodeAttributes((n, attrs) => ({
      ...attrs,
      haloSize: parseFloat(hSizeInput.value) * attrs["nansi-degree"]
    }));

    const hIntInput = document.getElementById("halo-intensity") as HTMLInputElement;
    hIntInput.onchange = e => graph2.updateEachNodeAttributes((n, attrs) => ({
      ...attrs,
      haloIntensity: parseFloat(hIntInput.value)
    }));
 
    // Enable SavePNG button
    document.getElementById("save-as-png").addEventListener("click", () => {
      setTimeout(async () => {
        const ratio = 6;
        let { width, height } = renderer.getDimensions();
        width = width * ratio;
        height = height * ratio;
        const pixelRatio = window.devicePixelRatio || 1;
        const tmpRoot = document.createElement("DIV");
        tmpRoot.style.width = `${width}px`;
        tmpRoot.style.height = `${height}px`;
        tmpRoot.style.position = "absolute";
        tmpRoot.style.right = "101%";
        tmpRoot.style.bottom = "101%";
        document.body.appendChild(tmpRoot);
        const tmpRenderer = new Sigma(renderer.getGraph(), tmpRoot, {
          ...sigmaSettings,
          labelGridCellSize: ratio * sigmaSettings.labelGridCellSize,
          stagePadding: ratio * sigmaSettings.stagePadding,
          nodeReducer: (n, attrs) => ({
            ...attrs,
            size: attrs.size * ratio,
            labelSize: attrs.labelSize * ratio,
            borderSize: attrs.borderSize * ratio,
            haloSize: parseFloat(hSizeInput.value) * attrs["nansi-degree"] * ratio,
          }),
          edgeReducer: (e, attrs) => ({
            ...attrs,
            size: attrs.size * ratio
          })
        });
        tmpRenderer.getCamera().angle = camera.angle;
        tmpRenderer.refresh();
        const canvas = document.createElement("CANVAS") as HTMLCanvasElement;
        canvas.setAttribute("width", width * pixelRatio + "");
        canvas.setAttribute("height", height * pixelRatio + "");
        const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width * pixelRatio, height * pixelRatio);
        const canvases = tmpRenderer.getCanvases();
        const layers = Object.keys(canvases);
        layers.forEach((id) => {
          ctx.drawImage(
            canvases[id],
            0,
            0,
            width * pixelRatio,
            height * pixelRatio,
            0,
            0,
            width * pixelRatio,
            height * pixelRatio,
          );
        });
        canvas.toBlob((blob) => {
          if (blob) FileSaver.saveAs(blob, "graph.png");
          tmpRenderer.kill();
          tmpRoot.remove();
        }, "image/png");
      }, 10);
    });
  });

import chroma from "chroma-js";
import iwanthue from "iwanthue";

import FileSaver from "file-saver";

import Graph from "graphology";
import { Sigma } from "sigma";
import { Coordinates } from "sigma/types";
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
import NodePointProgram from 'sigma/rendering/webgl/programs/node.point';
import NodePointWithBorderProgram from '@yomguithereal/sigma-experiments-renderers/node/node.point.border';
import NodeHaloProgram from '@yomguithereal/sigma-experiments-renderers/node/node.halo';
import EdgeCurveProgram from '@yomguithereal/sigma-experiments-renderers/edge/edge.curve';
import drawLabel from "./custom-label"

import { cropToLargestConnectedComponent } from "graphology-components";

/* TODO:
- generate export 6000x6000
- reapply louvain/FA2 to original graph
- add cluster labels ? https://codesandbox.io/s/github/jacomyal/sigma.js/tree/main/examples/clusters-labels
- generate minimaps for specific metrics:
  - indegree <= edges colors = out node
  - outdegree <= edges colors = in node
  - betweeness
  - pagerank
  ...
 */

/*function renderPNG(graph, imagefile, size, callback) {
  const t0 = Date.now();
  renderToPNG(
    graph,
    imagefile + ".png",
    {
      width: size,
      height: size,
      nodes: {defaultColor: '#000'},
      edges: {defaultColor: '#ccc'},
    },
    () => {
      console.log(" " + imagefile + '.png rendered in:', (Date.now() - t0)/1000 + "s");
      callback();
    }
  );
}*/

var palette = iwanthue(9, {
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

    louvain.assign(graph, {
      resolution: 1.075,
      getEdgeWeight: 'simmelianStrength'
    });

    graph.forEachNode((node, attrs)  => {
      const color = palette[attrs['community'] % palette.length],
        size = attrs['nansi-degree'];
      graph2.addNode(node, {
        x: attrs.x,
        y: attrs.y,
        label: attrs.label,
        type: "circle",
        size: Math.sqrt(size),
        color: color,
        labelSize: Math.pow(500 * size, 0.25),
        borderSize: 1.5,
        borderColor: chroma(color).darken().hex(),
        haloSize: 1.5 * size,
        haloColor: chroma(color).brighten().hex(),
        haloIntensity: 0.25
      });
    });
    graph.forEachEdge((edge, attrs, source, target) => {
      if (attrs.simmelianStrength > 3)
        graph2.addEdge(source, target, attrs);
    });

    cropToLargestConnectedComponent(graph2);

    const settings = forceAtlas2.inferSettings(graph);
    settings["edgeWeightInfluence"] = 1;
    settings["adjustSizes"] = true;
    settings["gravity"] = 1.25;
    settings["strongGravityMode"] = false;
    settings["scalingRatio"] = 0.1;
    forceAtlas2.assign(graph2, {
      iterations: 1000,
      getEdgeWeight: 'simmelianStrength',
      settings: settings
    });

    const container = document.getElementById("sigma") as HTMLElement;

    const renderer = new Sigma(graph2, container, {
      minCameraRatio: 0.1,
      maxCameraRatio: 10,
      defaultEdgeColor: '#000',
      labelFont: '"DejaVu Sans Mono", monospace',
      labelColor: {color: '#000'},
      labelWeight: 'bold',
      labelDensity: 1.15,
      labelGridCellSize: 200,
      nodeProgramClasses: {
        circle: createNodeCompoundProgram([
          NodeHaloProgram,
          NodePointWithBorderProgram
        ])
      },
      defaultEdgeType: 'curve',
      edgeProgramClasses: {
        curve: EdgeCurveProgram
      },
      labelRenderer: drawLabel
    });
    const camera = renderer.getCamera();
 
    // Enable SavePNG button
    document.getElementById("save-as-png").addEventListener("click", () => {
      setTimeout(async () => {
        const { width, height } = renderer.getDimensions();
        const pixelRatio = window.devicePixelRatio || 1;
        const tmpRoot = document.createElement("DIV");
        tmpRoot.style.width = `${width}px`;
        tmpRoot.style.height = `${height}px`;
        tmpRoot.style.position = "absolute";
        tmpRoot.style.right = "101%";
        tmpRoot.style.bottom = "101%";
        document.body.appendChild(tmpRoot);
        const tmpRenderer = new Sigma(graph, tmpRoot, renderer.getSettings());
        tmpRenderer.getCamera().setState(camera.getState());
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

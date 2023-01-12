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

const baseAngle = 132;
const haloSize = 14;
const haloIntensity = 0.1;
const seed = "0.5333956272631921";
//const colorSeed = "logiciels libres";
//const colorSeed = "0.8453856862674052";
const colorSeed = "0.9404079128839915";

const angleInput = document.getElementById("angle") as HTMLInputElement;
const hSizeInput = document.getElementById("halo-size") as HTMLInputElement;
const hIntInput = document.getElementById("halo-intensity") as HTMLInputElement;
const colorSeedInput = document.getElementById("color-seed") as HTMLInputElement;

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

    const maxVals = {};
    graph.forEachNode((node, attrs)  => {
      const size = Math.sqrt(attrs['nansi-degree']);
      graph2.addNode(node, {
        ...attrs,
        type: "circle",
        size: size,
        labelSize: Math.pow(80 * size, 0.4),
        borderSize: 1.5,
        haloSize: haloSize * size,
        haloIntensity: haloIntensity
      });
      Object.keys(attrs).forEach(attr => {
        if (typeof attrs[attr] === "number")
          maxVals[attr] = Math.max(maxVals[attr] || 0, attrs[attr]);
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
    FA2settings["edgeWeightInfluence"] = 1.25;
    FA2settings["gravity"] = 0.5;
    //FA2settings["scalingRatio"] = 100;
    //FA2settings["adjustSizes"] = true;
    //FA2settings["strongGravityMode"] = false;

    forceAtlas2.assign(graph2, {
      iterations: 1000,
      getEdgeWeight: 'simmelianStrength',
      settings: FA2settings
    });


    const sigmaSettings = ratio => ({
      minCameraRatio: 0.1,
      maxCameraRatio: 10,
      labelFont: '"DejaVu Sans Mono", monospace',
      labelColor: {color: '#000'},
      labelWeight: 'bold',
      labelDensity: 1.5,
      labelGridCellSize: ratio * 190,
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
      stagePadding: ratio * 50,
      nodeReducer: (n, attrs) => ({
        ...attrs,
        size: attrs.size * ratio,
        labelSize: attrs.labelSize * ratio,
        borderSize: attrs.borderSize * ratio,
        haloSize: parseFloat(hSizeInput.value) * Math.sqrt(attrs["nansi-degree"]) * ratio
      }),
      edgeReducer: (e, attrs) => ({
        ...attrs,
        size: attrs.size * ratio
      })
    });
    const renderer = new Sigma(graph2, document.getElementById("sigma"), sigmaSettings(1));
    const camera = renderer.getCamera();
    const miniSigmaSettings = (attr, ratio) => ({
      labelFont: '"DejaVu Sans Mono", monospace',
      labelColor: {color: '#333'},
      labelWeight: 'bold',
      labelDensity: 1.5,
      labelGridCellSize: ratio * 190,
      labelRenderedSizeThreshold: ratio * 3.5,
      labelRenderer: drawLabel,
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
      nodeReducer: (n, attrs) => ({
        ...attrs,
        size: ratio * Math.max(0.5, 10 * Math.pow(attrs[attr] / maxVals[attr], 6/5)),
        labelSize: ratio * Math.pow(35 * Math.max(0.1, 10 * Math.pow(attrs[attr] / maxVals[attr], 6/5)), 0.4),
        borderSize: attrs.borderSize * ratio / 3,
        color: '#999',
        borderColor: '#666',
        haloColor: '#999',
        haloSize: ratio * Math.max(1.5, 10 * Math.pow(attrs[attr] / maxVals[attr], 6/5)) * 5,
        haloIntensity: 0.2 + Math.pow(attrs[attr] / (4 * maxVals[attr]), 6/5)
      }),
      edgeReducer: (n, attrs) => ({
        ...attrs,
        size: ratio * 0.01,
        color: '#FFF'
      })
    });
    const renderers = [];
/* "betweennessCentrality", "closenessCentrality", "degreeCentrality", "inDegreeCentrality", "outDegreeCentrality",
"eigenvectorCentrality", "authority", "hub", "pagerank" */
    const miniMapsAttributes = [
      "indegree",
      //"inDegreeCentrality",
      "betweennessCentrality",
      "outdegree",
      //"outDegreeCentrality",
      "pagerank",
      //"authority",
      //"eigenvectorCentrality",
    ];
    miniMapsAttributes.forEach((attr, idx) => {
      document.querySelector("#minimap" + (idx+1) + " > span").innerHTML = attr;
      renderers.push(new Sigma(graph2, document.querySelector("#minimap" + (idx+1) + " > div"), miniSigmaSettings(attr, 1)));
      renderers[idx].getCamera().ratio = 1/1.3;
    });

    angleInput.value = baseAngle + "";
    angleInput.onchange = e => {
      camera.angle = Math.PI * parseFloat(angleInput.value) / 180; 
      renderer.refresh();
      renderers.forEach(r => {
        r.getCamera().angle = camera.angle
        r.refresh();
      });
    }
    angleInput.onchange(null);
 
    hSizeInput.value = haloSize + "";
    hSizeInput.onchange = e => graph2.updateEachNodeAttributes((n, attrs) => ({
      ...attrs,
      haloSize: parseFloat(hSizeInput.value) * Math.sqrt(attrs["nansi-degree"])
    }));

    hIntInput.value = haloIntensity + "";
    hIntInput.onchange = e => graph2.updateEachNodeAttributes((n, attrs) => ({
      ...attrs,
      haloIntensity: parseFloat(hIntInput.value)
    }));
 
    colorSeedInput.value = colorSeed;
    const seedInput = document.getElementById("seed") as HTMLInputElement;
    seedInput.value = seed;
    seedInput.onchange = e => {
      seed
      const communities = louvain(graph, {
        resolution: 1.075,
        getEdgeWeight: 'simmelianStrength',
        rng: seedrandom(seedInput.value)
      });
      const palette = iwanthue(9, {
        colorSpace: 'sensible',
        seed: colorSeedInput.value,
        clustering: 'force-vector',
        attempts: 5,
      });
      graph2.updateEachNodeAttributes((node, attrs) => {
        const color = palette[communities[node] % palette.length];
        return {
          ...attrs,
          color: color,
          borderColor: chroma(color).darken().hex(),
          haloColor: "rgba(" + chroma(color).brighten().rgb().join(",") + ",0.9)"
        }
      });
    };
    colorSeedInput.onchange = seedInput.onchange;
    seedInput.onchange(null);
    document.getElementById("random-seed").onclick = () => {
      seedInput.value = Math.random() + "";
      seedInput.onchange(null);
    };
    document.getElementById("random-color-seed").onclick = () => {
      colorSeedInput.value = Math.random() + "";
      seedInput.onchange(null);
    };

    // Enable SavePNG button
    document.getElementById("save-as-png").onclick = () => {
      function renderPNG(rdr, ratio, fileName, settings) {
        let { width, height } = rdr.getDimensions();
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
        const tmpRenderer = new Sigma(rdr.getGraph(), tmpRoot, settings);
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
          if (blob) FileSaver.saveAs(blob, fileName + ".png");
          tmpRenderer.kill();
          tmpRoot.remove();
        }, "image/png");
      }
      setTimeout(async () => {
        renderPNG(renderer, 6, "main-graph", sigmaSettings(6));
        miniMapsAttributes.forEach((attr, idx) =>
         renderPNG(renderers[idx], 6, "mini-graph-" + attr, miniSigmaSettings(attr, 6))
        );
      }, 10);
    };
  });

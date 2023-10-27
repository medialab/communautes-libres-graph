import chroma from "chroma-js";
import iwanthue from "iwanthue";

import seedrandom from "seedrandom";

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
import NodePointWithBorderProgram from '@yomguithereal/sigma-experiments-renderers/node/node.point.border';
import NodeHaloProgram from '@yomguithereal/sigma-experiments-renderers/node/node.halo';
import EdgeCurveProgram from '@yomguithereal/sigma-experiments-renderers/edge/edge.curve';
import { drawLabel, drawHover } from './custom-label';

import { cropToLargestConnectedComponent } from "graphology-components";

let haloSize = 14;
const baseAngle = 132;
const haloIntensity = 0.1;
const seed = "0.5333956272631921";
//const colorSeed = "logiciels libres";
//const colorSeed = "0.8453856862674052";
const colorSeed = "0.9404079128839915";

const labelsOffsets = {
    "16787": {y: 6},
    "18237": {y: 15000000},
    "33": {y: -2},
    "119": {y: 1},
    "53": {y: 2}
};

const sigmaContainer = document.getElementById("sigma");

const sigmaSettings = ratio => ({
  minCameraRatio: 0.1,
  maxCameraRatio: 10,
  labelFont: "SourceCodePro",
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
  nodeHoverProgramClasses: {
    circle: NodePointWithBorderProgram
  },
  defaultEdgeColor: '#000',
  defaultEdgeType: 'curve',
  edgeProgramClasses: {
    curve: EdgeCurveProgram
  },
  labelRenderer: drawLabel,
  hoverRenderer: drawHover,
  stagePadding: ratio * 50,
  nodeReducer: (n, attrs) => ({
    ...attrs,
    size: attrs.size * ratio,
    labelSize: attrs.labelSize * ratio,
    borderSize: attrs.borderSize * ratio,
    haloSize: haloSize * Math.sqrt(attrs["nansi-degree"]) * ratio,
    labelOffsetX: ratio * attrs["labelOffsetX"],
    labelOffsetY: ratio * attrs["labelOffsetY"]
  }),
  edgeReducer: (e, attrs) => ({
    ...attrs,
    size: attrs.size * ratio
  })
});

const prepareGraph = function(gexf) {
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
      haloIntensity: haloIntensity,
      labelOffsetX: (labelsOffsets[node] || {x: 0}).x || 0,
      labelOffsetY: (labelsOffsets[node] || {y: 0}).y || 0
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

  const renderer = new Sigma(graph2, sigmaContainer, sigmaSettings(1));
  const camera = renderer.getCamera();

  document.getElementById("loader").remove();
  return {graph, graph2, maxVals, renderer, camera};
};

const adjustCommunitiesColors = function(graph, graph2, louvainSeed, IWHSeed) {
  const communities = louvain(graph, {
    resolution: 1.075,
    getEdgeWeight: 'simmelianStrength',
    rng: seedrandom(louvainSeed)
  });
  const palette = iwanthue(9, {
    colorSpace: 'sensible',
    seed: IWHSeed,
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

const adjustAngle = function(renderer, camera, angle, renderers) {
  camera.angle = Math.PI * parseFloat(angle) / 180; 
  renderer.refresh();
  if (renderers)
    renderers.forEach(r => {
      r.getCamera().angle = camera.angle
      r.refresh();
    });
};

const buildExportableGraphs = function(graph, graph2, maxVals, renderer, camera) {
  const angleInput = document.getElementById("angle") as HTMLInputElement;
  const hSizeInput = document.getElementById("halo-size") as HTMLInputElement;
  const hIntInput = document.getElementById("halo-intensity") as HTMLInputElement;
  const colorSeedInput = document.getElementById("color-seed") as HTMLInputElement;
  
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
    nodeHoverProgramClasses: {
      circle: NodePointWithBorderProgram
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
  angleInput.onchange = e => adjustAngle(renderer, camera, angleInput.value, renderers)
  angleInput.onchange(null);
 
  hSizeInput.value = haloSize + "";
  hSizeInput.onchange = e => {
    haloSize = parseFloat(hSizeInput.value);
    graph2.updateEachNodeAttributes((n, attrs) => ({
      ...attrs,
      haloSize: haloSize * Math.sqrt(attrs["nansi-degree"])
    }));
  };

  hIntInput.value = haloIntensity + "";
  hIntInput.onchange = e => graph2.updateEachNodeAttributes((n, attrs) => ({
    ...attrs,
    haloIntensity: parseFloat(hIntInput.value)
  }));
 
  colorSeedInput.value = colorSeed;
  const seedInput = document.getElementById("seed") as HTMLInputElement;
  seedInput.value = seed;
  seedInput.onchange = e => adjustCommunitiesColors(graph, graph2, seedInput.value, colorSeedInput.value);
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
      let rate = 6;
      renderPNG(renderer, rate, "main-graph", sigmaSettings(rate));
      miniMapsAttributes.forEach((attr, idx) =>
       renderPNG(renderers[idx], rate, "mini-graph-" + attr, miniSigmaSettings(attr, rate))
      );
    }, 10);
  };
};

const buildHomepage = function(graph, graph2, renderer, camera) {
  //TODO:
  // - add buttons to switch node size with other metrics

  adjustCommunitiesColors(graph, graph2, seed, colorSeed);
  adjustAngle(renderer, camera, baseAngle, null);

  // Zoom buttons
  document.getElementById("zoom-in").onclick =
    () => camera.animatedZoom({ duration: 600 });
  document.getElementById("zoom-out").onclick =
    () => camera.animatedUnzoom({ duration: 600 });
  document.getElementById("zoom-reset").onclick =
    () => camera.animate({x: 0.5, y: 0.5, ratio: 1, angle: Math.PI * baseAngle / 180}, { duration: 300});

  // Fullscreen buttons
   const fullscreenButton = document.getElementById("fullscreen"),
    regscreenButton = document.getElementById("regscreen");
  fullscreenButton.onclick = () => {
    const doc = document.documentElement as any;
    if (doc.requestFullscreen) {
      doc.requestFullscreen();
    } else if (doc.webkitRequestFullscreen) { /* Safari */
      doc.webkitRequestFullscreen();
    } else if (doc.msRequestFullscreen) { /* IE11 */
      doc.msRequestFullscreen();
    }
    fullscreenButton.style.display = "none";
    regscreenButton.style.display = "block";
  };

  regscreenButton.onclick = () => {
    const doc = document as any;
    if (doc.exitFullscreen) {
      doc.exitFullscreen();
    } else if (doc.webkitExitFullscreen) { /* Safari */
      doc.webkitExitFullscreen();
    } else if (doc.msExitFullscreen) { /* IE11 */
      doc.msExitFullscreen();
    }
    regscreenButton.style.display = "none";
    fullscreenButton.style.display = "block";
  };

  // Prepare list of nodes for search suggestions
  let suggestions = [],
    selectedNode = null;
  const allSuggestions = graph2.nodes()
    .map((node) => ({
      node: node,
      label: graph2.getNodeAttribute(node, "label")
    }))
    .sort((a, b) => a.label < b.label ? -1 : 1);
  function feedAllSuggestions() {
    suggestions = allSuggestions.map(x => x);
  }
  feedAllSuggestions();

  function fillSuggestions() {
    document.getElementById("suggestions").innerHTML = suggestions
      .sort((a, b) => a.label < b.label ? -1 : 1)
      .map((node) => "<option>" + node.label + "</option>")
      .join("\n");
  }
  fillSuggestions();

  // Setup nodes input search for web browsers
  const searchInput = document.getElementById("search-input") as HTMLInputElement;
  function setSearchQuery(query="") {
    feedAllSuggestions();
    if (searchInput.value !== query)
      searchInput.value = query;

    if (query) {
      const lcQuery = query.toLowerCase();
      suggestions = [];
      graph2.forEachNode((node, {label}) => {
        if (label.toLowerCase().includes(lcQuery))
          suggestions.push({node: node, label: label});
      });

      const suggestionsMatch = suggestions.filter(x => x.label === query);
      if (suggestionsMatch.length === 1) {
        // Move the camera to center it on the selected node:
        const nodePosition = renderer.getNodeDisplayData(suggestionsMatch[0].node) as Coordinates;
        camera.animate(nodePosition, {duration: 500});
        clickNode(suggestionsMatch[0].node);
        suggestions = [];
      } else if (selectedNode) {
        clickNode(null);
      }
    } else if (selectedNode) {
      clickNode(null);
      feedAllSuggestions();
    }
    fillSuggestions();
  }
  searchInput.oninput = () => {
    setSearchQuery(searchInput.value || "");
  };
  searchInput.onblur = () => {
    if (!selectedNode)
      setSearchQuery("");
  };
  document.getElementById("search-icon").onclick = () => searchInput.focus();

  // Setup Nodes hovering
  renderer.on("enterNode", () => sigmaContainer.style.cursor = "pointer");
  renderer.on("leaveNode", () => sigmaContainer.style.cursor = "default");

  // Handle clicks on nodes
  function clickNode(node) {
    const sameNode = (node === selectedNode);
    // Reset unselected node view
    renderer.setSetting("nodeReducer", (n, attrs) => attrs);
    renderer.setSetting("edgeReducer", (edge, attrs) => attrs);
    if (!node) {
      selectedNode = null;
      return;
    }
    searchInput.value = graph2.getNodeAttribute(node, "label");
    selectedNode = node;
    const neighbors = new Set(graph2.neighbors(node));
    renderer.setSetting("nodeReducer", (n, attrs) => n === node ?
        {...attrs, highlighted: true, haloIntensity: 0.15} :
        neighbors.has(n) ?
          {...attrs, haloIntensity: 0.15} :
          {...attrs, color: "#f6f6f6", size: 4, haloIntensity: 0}
    );
    renderer.setSetting("edgeReducer", (e, attrs) => graph2.hasExtremity(e, node) ? attrs : {...attrs, hidden: true});
  }

  renderer.on("clickNode", (event) => clickNode(event.node));
  renderer.on("clickStage", () => setSearchQuery(""));
  renderer.on("doubleClickNode", (event) => window.open(graph2.getNodeAttribute(event.node, "homepage")));
};

let resizing = null;
const EXPORTPAGE = /\/export\.html/.test(window.location.pathname);

function resize() {
  sigmaContainer.style.height = window.innerHeight - 47 + "px";
  document.getElementById("explications").style.height = window.innerHeight - 43 + "px";
}

if (!EXPORTPAGE) window.onresize = () => {
  if (resizing) clearTimeout(resizing);
  resizing = setTimeout(resize, 0);
};

fetch("./data/graph.gexf")
  .then((res) => res.text())
  .then((gexf) => {
    if (!EXPORTPAGE) resize();
    const vars = prepareGraph(gexf);
    if (window.location.pathname === "/export.html")
      buildExportableGraphs(vars.graph, vars.graph2, vars.maxVals, vars.renderer, vars.camera);
    else buildHomepage(vars.graph, vars.graph2, vars.renderer, vars.camera);
  });

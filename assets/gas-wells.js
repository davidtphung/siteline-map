/** Nationwide natural gas wells from PMTiles. */

import { Protocol } from "https://esm.sh/pmtiles@3.2.1";
import { statusPaint } from "./well-status.mjs";
import { GAS_MANIFEST_URL, GAS_TILE_URLS, pointFilter, useCameronFixture } from "./gas-wells.mjs";

const SRC = "sl-gaswells";
const LAYER = "sl-gaswells-pt";
const CLUSTER = "sl-gaswells-cluster";

let protocolReady = false;

function paintExpr(prop) {
  const active = statusPaint("active");
  const idle = statusPaint("inactive");
  const plugged = statusPaint("plugged");
  const table = {
    fill: [active.fill, idle.fill, plugged.fill],
    stroke: [active.stroke, idle.stroke, plugged.stroke],
    width: [active.width, idle.width, plugged.width],
    radius: [active.radius, idle.radius, plugged.radius],
  };
  return ["match", ["get", "status_class"], "inactive", table[prop][1], "plugged", table[prop][2], table[prop][0]];
}

function gasOn() {
  const input = document.getElementById("sl-well-gas");
  return !input || input.checked;
}

function pluggedOn() {
  return !!document.getElementById("sl-well-plugged")?.checked;
}

function ensureProtocol(maplibregl) {
  if (protocolReady || !maplibregl?.addProtocol) return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  protocolReady = true;
}

async function firstTileUrl() {
  for (const url of GAS_TILE_URLS) {
    try {
      const response = await fetch(url, { headers: { Range: "bytes=0-16" } });
      if (response.ok || response.status === 206) return url;
    } catch (_) {}
  }
  return "";
}

function applyFilter(map) {
  if (!map.getLayer?.(LAYER)) return;
  map.setFilter(LAYER, pointFilter(pluggedOn()));
  const show = gasOn() ? "visible" : "none";
  for (const id of [LAYER, CLUSTER, CLUSTER + "-count"]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", show);
  }
}

export async function bindGasWells(map) {
  if (!map?.addSource) return;
  const maplibregl = window.maplibregl;
  ensureProtocol(maplibregl);
  let manifest = null;
  try {
    const response = await fetch(GAS_MANIFEST_URL);
    if (response.ok) manifest = await response.json();
  } catch (_) {}
  window.__SITELINE_GAS_MANIFEST__ = manifest;
  window.__SITELINE_TX_FIXTURE__ = useCameronFixture(manifest);
  const tileUrl = await firstTileUrl();
  if (!tileUrl || map.getSource(SRC)) {
    window.dispatchEvent(new CustomEvent("siteline-gas-manifest"));
    return;
  }
  map.addSource(SRC, { type: "vector", url: "pmtiles://" + location.origin + tileUrl });
  map.addLayer({
    id: CLUSTER,
    type: "circle",
    source: SRC,
    "source-layer": "gaswells",
    filter: ["any", ["has", "point_count"], ["==", ["get", "clustered"], true]],
    maxzoom: 10,
    paint: {
      "circle-color": "#f97316",
      "circle-radius": ["step", ["coalesce", ["get", "point_count"], 2], 14, 20, 18, 80, 22],
      "circle-stroke-color": "#14120e",
      "circle-stroke-width": 1,
    },
  });
  map.addLayer({
    id: CLUSTER + "-count",
    type: "symbol",
    source: SRC,
    "source-layer": "gaswells",
    filter: ["any", ["has", "point_count"], ["==", ["get", "clustered"], true]],
    maxzoom: 10,
    layout: {
      "text-field": ["to-string", ["coalesce", ["get", "point_count"], ""]],
      "text-size": 12,
      "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
    },
    paint: { "text-color": "#14120e" },
  });
  map.addLayer({
    id: LAYER,
    type: "circle",
    source: SRC,
    "source-layer": "gaswells",
    minzoom: 10,
    filter: pointFilter(false),
    paint: {
      "circle-radius": paintExpr("radius"),
      "circle-color": paintExpr("fill"),
      "circle-stroke-color": paintExpr("stroke"),
      "circle-stroke-width": paintExpr("width"),
    },
  });
  applyFilter(map);
  document.addEventListener("change", (event) => {
    const id = event.target?.id;
    if (id === "sl-well-gas" || id === "sl-well-plugged") applyFilter(map);
  });
  window.dispatchEvent(new CustomEvent("siteline-gas-manifest"));
}

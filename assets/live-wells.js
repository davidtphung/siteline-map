/** Live NM and CO wells for the Natural gas wells toggle. */

import {
  CO_STATUS_VINTAGE,
  coFeature,
  formatQueriedPt,
  includeWell,
  nmFeature,
  nmQuery,
  statusPaint,
  styleWaitDecision,
  viewHitsCo,
  viewHitsNm,
} from "./well-status.mjs";

const SRC = "sl-live-wells";
const CLUSTER = "sl-live-wells-cluster";
const LAYER = "sl-live-wells-pt";
const CO_QUERY = "https://data.dnrgis.state.co.us/arcgis/rest/services/DNR_Public/OGCC_Wells/FeatureServer/0/query";

let token = 0;
let wired = false;

function boundsOf(map) {
  const box = map.getBounds();
  return { west: box.getWest(), east: box.getEast(), south: box.getSouth(), north: box.getNorth() };
}

function gasOn() {
  const input = document.getElementById("sl-well-gas");
  return !input || input.checked;
}

function pluggedOn() {
  return !!document.getElementById("sl-well-plugged")?.checked;
}

function wanted(id, fallback) {
  const input = document.getElementById(id);
  if (!input) return fallback;
  return input.checked || fallback;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

async function fetchNm(bounds, showPlugged, note) {
  const params = nmQuery(bounds, showPlugged);
  const features = [];
  let offset = 0;
  for (let page = 0; page < 4; page += 1) {
    const search = new URLSearchParams({ ...params, resultOffset: String(offset), resultRecordCount: "1000" });
    const json = await fetchJson("/api/nmwells/query?" + search.toString());
    const rows = json.features || [];
    for (const row of rows) {
      const feature = nmFeature(row, note);
      if (feature && includeWell(feature.properties.status, showPlugged)) features.push(feature);
    }
    if (!json.exceededTransferLimit || rows.length < 1000) break;
    offset += rows.length;
  }
  return features;
}

async function fetchCo(bounds, showPlugged) {
  const body = new URLSearchParams({
    where: "1=1",
    geometry: JSON.stringify({
      xmin: bounds.west,
      ymin: bounds.south,
      xmax: bounds.east,
      ymax: bounds.north,
      spatialReference: { wkid: 4326 },
    }),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "API,API_Label,Well_Name,Operator,Facil_Stat,Stat_Date",
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: "1000",
    f: "json",
  });
  const response = await fetch(CO_QUERY, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(String(response.status));
  const json = await response.json();
  return (json.features || [])
    .map(coFeature)
    .filter((feature) => feature && includeWell(feature.properties.status, showPlugged));
}

function paintExpr(prop) {
  const active = statusPaint("active");
  const idle = statusPaint("inactive");
  const plugged = statusPaint("plugged");
  const table = { fill: [active.fill, idle.fill, plugged.fill], stroke: [active.stroke, idle.stroke, plugged.stroke], width: [active.width, idle.width, plugged.width], radius: [active.radius, idle.radius, plugged.radius] };
  return [
    "match",
    ["get", "status_class"],
    "inactive",
    table[prop][1],
    "plugged",
    table[prop][2],
    table[prop][0],
  ];
}

function ensureLayers(map) {
  if (!map.getSource(SRC)) {
    map.addSource(SRC, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterRadius: 48,
      clusterMaxZoom: 9,
    });
  }
  if (!map.getLayer(CLUSTER)) {
    map.addLayer({
      id: CLUSTER,
      type: "circle",
      source: SRC,
      filter: ["has", "point_count"],
      maxzoom: 10,
      paint: {
        "circle-color": "#f97316",
        "circle-radius": ["step", ["get", "point_count"], 12, 20, 16, 80, 20],
        "circle-stroke-color": "#14120e",
        "circle-stroke-width": 1,
      },
    });
  }
  if (!map.getLayer(LAYER)) {
    map.addLayer({
      id: LAYER,
      type: "circle",
      source: SRC,
      filter: ["!", ["has", "point_count"]],
      minzoom: 10,
      paint: {
        "circle-radius": paintExpr("radius"),
        "circle-color": paintExpr("fill"),
        "circle-stroke-color": paintExpr("stroke"),
        "circle-stroke-width": paintExpr("width"),
      },
    });
  }
}

export async function loadLiveWells(map) {
  if (!map?.getBounds) return;
  const decision = styleWaitDecision(typeof map.isStyleLoaded !== "function" || map.isStyleLoaded());
  map.__slStyleWait = decision.tries;
  if (decision.action === "wait-idle") {
    map.once?.("idle", () => loadLiveWells(map));
    return;
  }
  ensureLayers(map);
  const zoom = map.getZoom?.() || 0;
  const show = gasOn();
  if (!show || zoom < 6) {
    map.getSource(SRC)?.setData({ type: "FeatureCollection", features: [] });
    window.__SITELINE_WELL_NOTES__ = { nm: "", co: "", texas: "" };
    return;
  }
  const bounds = boundsOf(map);
  const showPlugged = pluggedOn();
  const mine = ++token;
  const note = formatQueriedPt(new Date());
  const jobs = [];
  if (viewHitsNm(bounds) && wanted("sl-nm", true)) jobs.push(fetchNm(bounds, showPlugged, note).then((rows) => ({ nm: rows })));
  if (viewHitsCo(bounds) && wanted("sl-co", true)) jobs.push(fetchCo(bounds, showPlugged).then((rows) => ({ co: rows })));
  const parts = await Promise.all(jobs.map((job) => job.catch(() => ({}))));
  if (mine !== token) return;
  const features = [];
  let nm = "";
  let co = "";
  for (const part of parts) {
    if (part.nm) {
      features.push(...part.nm);
      nm = note;
    }
    if (part.co) {
      features.push(...part.co);
      co = CO_STATUS_VINTAGE;
    }
  }
  window.__SITELINE_WELL_NOTES__ = { nm, co };
  map.getSource(SRC)?.setData({ type: "FeatureCollection", features });
  window.dispatchEvent(new CustomEvent("siteline-wells-live"));
}

export function bindLiveWells(map) {
  if (!map || wired) return;
  wired = true;
  const run = () => loadLiveWells(map);
  map.on?.("idle", run);
  map.on?.("moveend", run);
  document.addEventListener("change", (event) => {
    const id = event.target?.id;
    if (id === "sl-well-gas" || id === "sl-well-plugged" || id === "sl-nm" || id === "sl-co") run();
  });
  run();
}

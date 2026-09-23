/**
 * Cameron County oil and natural gas wells for Siteline site screening.
 * Distance and rings are EPSG:3081. EIA pipelines stay a separate public context layer.
 */
import {
  distanceMiles,
  geometryCentroid,
  pointInGeometry,
  ringFeatureCollection,
} from "./well-geo.mjs";
import {
  contextTitle,
  countsByStatus,
  exportCollection,
  filterFeatures,
  flagsFromSearch,
  flagsToSearch,
  resetGasFlags,
  separatedCounts,
} from "./well-context.mjs";

const SRC = "sl-wells-src";
const LAYER = "sl-wells-pt";
const CLUSTER = "sl-wells-cluster";
const RING_SRC = "sl-well-rings";
const RING_LAYER = "sl-well-rings-line";
const AOI_SRC = "sl-well-aoi";
const AOI_LAYER = "sl-well-aoi-line";
const DRAW_SRC = "sl-well-draw";
const DRAW_LAYER = "sl-well-draw-line";
const STORE_KEY = "siteline.well.site.v1";
const EMPTY = { type: "FeatureCollection", features: [] };

const state = {
  rules: null,
  features: [],
  flags: null,
  status: "",
  origin: "fixture",
  site: null,
  draw: null,
  vertices: [],
  selectedId: "",
  map: null,
  bound: false,
};

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function apiBase() {
  const params = new URLSearchParams(location.search);
  return (params.get("wellApi") || window.SITELINE_WELL_API || "").replace(/\/$/, "");
}

function injectCss() {
  if (document.getElementById("sl-wells-css")) return;
  const style = document.createElement("style");
  style.id = "sl-wells-css";
  style.textContent = `
#sl-tray .sl-jump-row { grid-template-columns: 1fr 1fr 1fr 1fr; }
#sl-well-card {
  position: fixed;
  z-index: 44;
  top: 12px;
  right: 12px;
  width: min(340px, calc(100vw - 24px));
  max-height: min(62vh, 560px);
  overflow: auto;
  padding: 0.65rem 0.75rem 0.75rem;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(5, 6, 8, 0.94);
  color: #e2e8f0;
  font: 500 12px/1.4 Inter, system-ui, sans-serif;
  box-shadow: 0 10px 28px rgba(0,0,0,0.45);
}
#sl-well-card h2 {
  margin: 0 0 0.2rem;
  font-size: 0.92rem;
  letter-spacing: -0.01em;
}
#sl-well-card .sl-well-kicker, #sl-well-card .sl-well-note, #sl-well-card li {
  color: #94a3b8;
  font-size: 0.66rem;
  line-height: 1.4;
}
#sl-well-card .sl-well-kicker {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 0 0.35rem;
}
#sl-well-card ul { margin: 0.25rem 0 0.45rem; padding-left: 1rem; }
#sl-well-card .sl-well-actions, #sl-well-card .sl-well-rings {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0.35rem 0;
}
#sl-well-card button, #sl-well-card label.file {
  appearance: none;
  border: 1px solid rgba(255,255,255,0.14);
  background: transparent;
  color: #e2e8f0;
  border-radius: 8px;
  min-height: 26px;
  padding: 0.15rem 0.45rem;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.58rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}
#sl-well-card button.on { background: rgba(77,163,255,0.16); border-color: rgba(77,163,255,0.55); color: #fff; }
#sl-well-card input[type="number"] {
  width: 4.2rem;
  background: transparent;
  color: #fff;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 8px;
  padding: 0.15rem 0.3rem;
}
#sl-well-card a { color: #4da3ff; }
.swatch.well-gas { background: #7dcea0; }
.swatch.well-oil { background: #7aa2e3; }
.swatch.well-mixed { background: #b9a6e8; }
.swatch.well-other { background: #c4b5a0; }
@media (max-width: 980px) {
  #sl-well-card { top: 8px; max-height: 34vh; }
}
`;
  document.head.appendChild(style);
}

function ensureCameronJump() {
  const row = document.querySelector("#sl-tray .sl-jump-row");
  if (!row || document.getElementById("sl-jump-cameron")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sl-chip sl-jump";
  btn.id = "sl-jump-cameron";
  btn.dataset.jump = "cameron";
  btn.textContent = "Cameron";
  btn.title = "Harlingen-Rio Hondo";
  btn.addEventListener("click", () => {
    const map = window.__SITELINE_MAP__;
    const center = state.rules?.cameron?.center || [-97.66, 26.19];
    const zoom = state.rules?.cameron?.zoom || 10;
    map?.flyTo?.({ center, zoom, essential: true, duration: 1400 });
  });
  row.appendChild(btn);
}

function ensureTrayToggles() {
  const pane = document.querySelector("#sl-pane-layers");
  if (!pane || document.getElementById("sl-well-gas")) return;
  const block = document.createElement("div");
  block.id = "sl-well-toggles";
  block.innerHTML =
    '<p class="sl-tray-label">Wells</p>' +
    '<label class="sl-tray-row"><input type="checkbox" id="sl-well-gas" checked /><span class="swatch well-gas"></span><span>Natural gas wells</span></label>' +
    '<label class="sl-tray-row"><input type="checkbox" id="sl-well-oil" /><span class="swatch well-oil"></span><span>Oil wells</span></label>' +
    '<label class="sl-tray-row"><input type="checkbox" id="sl-well-mixed" /><span class="swatch well-mixed"></span><span>Mixed oil and gas</span></label>' +
    '<label class="sl-tray-row"><input type="checkbox" id="sl-well-other" /><span class="swatch well-other"></span><span>Other / unknown</span></label>' +
    '<p class="sl-honesty-chip catalog" id="sl-well-honesty">RRC · Texas system of record</p>' +
    '<p class="sl-tray-note">EIA pipelines stay public pipeline context, separate from wells.</p>';
  const pipelines = pane.querySelector("#sl-gas-toggle")?.closest(".sl-tray-row");
  const label = pipelines?.previousElementSibling;
  const host = label && label.classList.contains("sl-tray-label") ? label : pipelines;
  if (host) host.parentNode.insertBefore(block, host);
  else pane.appendChild(block);
  for (const [id, key] of [
    ["sl-well-gas", "include_gas"],
    ["sl-well-oil", "include_oil"],
    ["sl-well-mixed", "include_mixed"],
    ["sl-well-other", "include_other"],
  ]) {
    document.getElementById(id)?.addEventListener("change", (event) => {
      state.flags[key] = !!event.target.checked;
      persistView();
      render();
    });
  }
}

function ensureCard() {
  let card = document.getElementById("sl-well-card");
  if (card) return card;
  card = document.createElement("aside");
  card.id = "sl-well-card";
  card.setAttribute("aria-label", "Well context");
  document.body.appendChild(card);
  return card;
}

function syncToggles() {
  const map = {
    "sl-well-gas": "include_gas",
    "sl-well-oil": "include_oil",
    "sl-well-mixed": "include_mixed",
    "sl-well-other": "include_other",
  };
  for (const [id, key] of Object.entries(map)) {
    const input = document.getElementById(id);
    if (input) input.checked = !!state.flags[key];
  }
}

function siteCenter() {
  if (!state.site) return null;
  if (state.site.center) return state.site.center;
  if (state.site.geometry) return geometryCentroid(state.site.geometry);
  return null;
}

function visibleFeatures() {
  const statuses = state.status ? [state.status] : null;
  return filterFeatures(state.features, state.flags, statuses);
}

function scopedFeatures(features) {
  const center = siteCenter();
  const geometry = state.site?.geometry;
  if (geometry) return features.filter((f) => pointInGeometry(f.geometry.coordinates[0], f.geometry.coordinates[1], geometry));
  if (center && state.site?.radiusMiles) {
    return features.filter(
      (f) => distanceMiles(center[0], center[1], f.geometry.coordinates[0], f.geometry.coordinates[1]) <= state.site.radiusMiles,
    );
  }
  return features;
}

function renderCard() {
  const card = ensureCard();
  const rules = state.rules;
  const title = contextTitle(state.flags, rules);
  const visible = visibleFeatures();
  const focus = scopedFeatures(visible);
  const counts = countsByStatus(focus);
  const separated = separatedCounts(focus);
  const countLines = Object.entries(counts)
    .map(([code, n]) => {
      const label = rules.statuses[code]?.label || code;
      return "<li>" + esc(label) + ": " + n + "</li>";
    })
    .join("");
  const center = siteCenter();
  let rings = "";
  if (center) {
    const milesList = rules.rings_miles || [0.25, 0.5, 1, 5, 10];
    rings =
      "<p class=\"sl-well-kicker\">Rings, EPSG:3081</p><ul>" +
      milesList
        .map((miles) => {
          const n = visible.filter(
            (f) => distanceMiles(center[0], center[1], f.geometry.coordinates[0], f.geometry.coordinates[1]) <= miles,
          ).length;
          return "<li>" + miles + " mi: " + n + "</li>";
        })
        .join("") +
      "</ul>";
  }
  const selected = state.features.find((f) => f.properties.id === state.selectedId);
  const detail = selected
    ? "<p class=\"sl-well-kicker\">Well</p><p>" +
      esc(selected.properties.status_label) +
      "</p><ul><li>API " +
      esc(selected.properties.api_raw) +
      "</li><li>" +
      esc(selected.properties.commodity) +
      " · " +
      esc(selected.properties.freshness) +
      "</li><li>" +
      esc(selected.properties.operator_name) +
      " · " +
      esc(selected.properties.lease_name) +
      "</li><li>Dataset " +
      esc(selected.properties.dataset_origin) +
      "</li></ul><p><a href=\"" +
      esc(selected.properties.rrc_viewer_url) +
      "\" target=\"_blank\" rel=\"noopener\">Open RRC GIS Viewer</a>. Search API " +
      esc(selected.properties.api_normalized) +
      ". Siteline does not scrape the viewer.</p>"
    : "";
  card.innerHTML =
    "<p class=\"sl-well-kicker\">" +
    esc(state.origin === "fixture" ? "Cameron fixture" : "RRC load") +
    " · " +
    esc(rules.cameron.jump_subtitle) +
    "</p><h2 id=\"sl-well-title\">" +
    esc(title) +
    "</h2><p class=\"sl-well-note\">" +
    focus.length +
    " wells in this view. " +
    [
      state.flags.include_gas ? "Gas " + separated.gas.well_count : "",
      state.flags.include_oil ? "Oil " + separated.oil.well_count : "",
      state.flags.include_mixed ? "Mixed " + separated.mixed.well_count : "",
      state.flags.include_other ? "Other " + separated.other.well_count : "",
    ]
      .filter(Boolean)
      .join(", ") +
    ". Disabled commodities are omitted from counts, rings, and export.</p>" +
    (countLines ? "<ul>" + countLines + "</ul>" : "<p class=\"sl-well-note\">No wells for the current toggles.</p>") +
    rings +
    detail +
    "<div class=\"sl-well-actions\">" +
    "<button type=\"button\" id=\"sl-well-draw-poly\">Draw polygon</button>" +
    "<button type=\"button\" id=\"sl-well-draw-radius\">Draw radius</button>" +
    "<label class=\"file\">Upload GeoJSON<input id=\"sl-well-upload\" type=\"file\" accept=\".json,.geojson,application/geo+json\" hidden /></label>" +
    "<button type=\"button\" id=\"sl-well-export\">Export</button>" +
    "<button type=\"button\" id=\"sl-well-reset\">Reset to gas context</button>" +
    "</div>" +
    "<div class=\"sl-well-rings\">" +
    (rules.rings_miles || [])
      .map(
        (miles) =>
          "<button type=\"button\" data-miles=\"" +
          miles +
          "\" class=\"" +
          (state.site?.radiusMiles === miles ? "on" : "") +
          "\">" +
          miles +
          " mi</button>",
      )
      .join("") +
    "<input id=\"sl-well-custom-mi\" type=\"number\" min=\"0.05\" max=\"100\" step=\"0.05\" placeholder=\"mi\" />" +
    "</div>" +
    "<p class=\"sl-well-note\">" +
    (state.draw === "polygon"
      ? "Click vertices. Double-click or Enter closes. Escape cancels."
      : state.draw === "radius"
        ? "Click a center. Rings use EPSG:3081 miles, not Web Mercator."
        : "Upload a polygon, draw one, or pick a radius.") +
    "</p><ul>" +
    rules.disclaimers.map((line) => "<li>" + esc(line) + "</li>").join("") +
    "</ul><p class=\"sl-well-note\"><a href=\"/well-methodology.html\">Data and limitations</a></p>";
  document.getElementById("sl-well-draw-poly").onclick = () => {
    state.draw = state.draw === "polygon" ? null : "polygon";
    state.vertices = [];
    renderCard();
  };
  document.getElementById("sl-well-draw-radius").onclick = () => {
    state.draw = state.draw === "radius" ? null : "radius";
    renderCard();
  };
  document.getElementById("sl-well-upload").onchange = (event) => {
    const file = event.target.files?.[0];
    if (file) readUpload(file);
  };
  document.getElementById("sl-well-export").onclick = exportView;
  document.getElementById("sl-well-reset").onclick = () => {
    state.flags = resetGasFlags();
    state.status = "";
    syncToggles();
    persistView();
    render();
  };
  card.querySelectorAll("[data-miles]").forEach((btn) => {
    btn.onclick = () => setRadius(Number(btn.dataset.miles));
  });
  document.getElementById("sl-well-custom-mi").onchange = (event) => {
    const miles = Number(event.target.value);
    if (miles > 0) setRadius(miles);
  };
}

function setRadius(miles) {
  const center = siteCenter() || state.rules.cameron.center;
  state.site = { ...(state.site || {}), center: [...center], radiusMiles: miles, geometry: state.site?.geometry || null };
  state.draw = null;
  persistSite();
  render();
}

function readUpload(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(String(reader.result));
      const geometry = geometryFromUpload(json);
      if (!geometry) throw new Error("Polygon or MultiPolygon required");
      const center = geometryCentroid(geometry);
      state.site = { geometry, center, radiusMiles: state.site?.radiusMiles || 1, name: file.name };
      state.draw = null;
      persistSite();
      render();
    } catch (err) {
      const card = ensureCard();
      const note = document.createElement("p");
      note.className = "sl-well-note";
      note.textContent = "Upload rejected: " + (err.message || "invalid GeoJSON");
      card.prepend(note);
    }
  };
  reader.readAsText(file);
}

function geometryFromUpload(json) {
  if (json.type === "FeatureCollection") return geometryFromUpload(json.features?.[0] || {});
  if (json.type === "Feature") return geometryFromUpload(json.geometry || {});
  if (json.type === "Polygon" || json.type === "MultiPolygon") return json;
  return null;
}

function exportView() {
  const features = scopedFeatures(visibleFeatures());
  const blob = new Blob([JSON.stringify(exportCollection(features), null, 2)], { type: "application/geo+json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "siteline-wells.geojson";
  link.click();
  URL.revokeObjectURL(link.href);
}

function persistView() {
  const url = new URL(location.href);
  const next = flagsToSearch(state.flags, url.search);
  const params = new URLSearchParams(next);
  if (state.status) params.set("status", state.status);
  else params.delete("status");
  history.replaceState(null, "", url.pathname + "?" + params.toString() + url.hash);
}

function persistSite() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.site));
  } catch (_) {}
  const center = siteCenter();
  if (!center) return;
  const ring = !state.site?.geometry
    ? null
    : state.site.geometry.type === "MultiPolygon"
      ? state.site.geometry.coordinates?.[0]?.[0]
      : state.site.geometry.coordinates?.[0];
  const hash = ring
    ? "well=p:" +
      ring
        .slice(0, 12)
        .map((pair) => pair[0].toFixed(5) + "," + pair[1].toFixed(5))
        .join(";")
    : "well=r:" + center[0].toFixed(5) + "," + center[1].toFixed(5) + "," + (state.site.radiusMiles || 1);
  const url = new URL(location.href);
  history.replaceState(null, "", url.pathname + url.search + "#" + hash);
}

function loadStoredSite() {
  const hash = location.hash.replace(/^#/, "");
  if (hash.startsWith("well=r:")) {
    const [lon, lat, miles] = hash.slice(7).split(",").map(Number);
    if ([lon, lat, miles].every(Number.isFinite)) {
      state.site = { center: [lon, lat], radiusMiles: miles, geometry: null };
      return;
    }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (saved && (saved.center || saved.geometry)) state.site = saved;
  } catch (_) {}
}

function paint(map) {
  const features = visibleFeatures();
  const data = { type: "FeatureCollection", features };
  if (map.getSource(SRC)) map.getSource(SRC).setData(data);
  const center = siteCenter();
  const miles = state.rules.rings_miles || [];
  const custom = state.site?.radiusMiles;
  const ringMiles = custom && !miles.includes(custom) ? miles.concat(custom) : miles;
  const rings = center ? ringFeatureCollection(center[0], center[1], ringMiles) : EMPTY;
  if (map.getSource(RING_SRC)) map.getSource(RING_SRC).setData(center ? rings : EMPTY);
  const aoi = state.site?.geometry
    ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: state.site.geometry }] }
    : EMPTY;
  if (map.getSource(AOI_SRC)) map.getSource(AOI_SRC).setData(aoi);
  const draw = state.vertices.length
    ? {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: state.vertices },
          },
        ],
      }
    : EMPTY;
  if (map.getSource(DRAW_SRC)) map.getSource(DRAW_SRC).setData(draw);
}

function ensureLayers(map) {
  if (map.getSource(SRC)) return;
  map.addSource(SRC, { type: "geojson", data: EMPTY, cluster: true, clusterRadius: 42, clusterMaxZoom: 11 });
  map.addSource(RING_SRC, { type: "geojson", data: EMPTY });
  map.addSource(AOI_SRC, { type: "geojson", data: EMPTY });
  map.addSource(DRAW_SRC, { type: "geojson", data: EMPTY });
  map.addLayer({
    id: RING_LAYER,
    type: "line",
    source: RING_SRC,
    paint: { "line-color": "#4da3ff", "line-width": 1.2, "line-opacity": 0.75, "line-dasharray": [1.2, 1.2] },
  });
  map.addLayer({
    id: AOI_LAYER,
    type: "line",
    source: AOI_SRC,
    paint: { "line-color": "#e7d7b1", "line-width": 1.6 },
  });
  map.addLayer({
    id: DRAW_LAYER,
    type: "line",
    source: DRAW_SRC,
    paint: { "line-color": "#ffffff", "line-width": 1.4, "line-dasharray": [2, 1] },
  });
  map.addLayer({
    id: CLUSTER,
    type: "circle",
    source: SRC,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#4da3ff",
      "circle-radius": ["step", ["get", "point_count"], 12, 10, 16, 30, 20],
      "circle-opacity": 0.85,
    },
  });
  map.addLayer({
    id: LAYER,
    type: "circle",
    source: SRC,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3, 12, 6],
      "circle-color": ["coalesce", ["get", "status_color"], "#9aa3b2"],
      "circle-stroke-width": 1,
      "circle-stroke-color": "#050608",
    },
  });
}

function closePolygon() {
  if (state.vertices.length < 3) return;
  const ring = state.vertices.concat([state.vertices[0]]);
  const geometry = { type: "Polygon", coordinates: [ring] };
  state.site = {
    geometry,
    center: geometryCentroid(geometry),
    radiusMiles: state.site?.radiusMiles || 1,
  };
  state.vertices = [];
  state.draw = null;
  persistSite();
  render();
}

function onMapClick(event) {
  const map = state.map;
  if (!map) return;
  if (state.draw === "polygon") {
    state.vertices.push([event.lngLat.lng, event.lngLat.lat]);
    paint(map);
    return;
  }
  if (state.draw === "radius") {
    state.site = {
      geometry: state.site?.geometry || null,
      center: [event.lngLat.lng, event.lngLat.lat],
      radiusMiles: state.site?.radiusMiles || 1,
    };
    state.draw = null;
    persistSite();
    render();
    return;
  }
  const clusters = map.queryRenderedFeatures(event.point, { layers: [CLUSTER] });
  if (clusters[0]) {
    const source = map.getSource(SRC);
    source.getClusterExpansionZoom(clusters[0].properties.cluster_id, (err, zoom) => {
      if (err) return;
      map.easeTo({ center: clusters[0].geometry.coordinates, zoom });
    });
    return;
  }
  const hits = map.queryRenderedFeatures(event.point, { layers: [LAYER] });
  if (!hits[0]) return;
  state.selectedId = hits[0].properties.id;
  renderCard();
}

function bindMap(map) {
  if (state.bound) return;
  state.map = map;
  const canvas = map.getCanvas();
  canvas.addEventListener(
    "click",
    (event) => {
      if (state.draw) {
        event.__sitelineWellHandled = true;
        return;
      }
      let hits = [];
      try {
        hits = map.queryRenderedFeatures([event.offsetX, event.offsetY], { layers: [LAYER, CLUSTER] });
      } catch (_) {
        hits = [];
      }
      if (hits.length) event.__sitelineWellHandled = true;
    },
    true,
  );
  map.on("click", onMapClick);
  map.on("dblclick", (event) => {
    if (state.draw !== "polygon") return;
    event.preventDefault();
    closePolygon();
  });
  ensureLayers(map);
  state.bound = true;
  paint(map);
}

function render() {
  syncToggles();
  renderCard();
  if (state.map) {
    if (state.draw === "polygon") state.map.doubleClickZoom?.disable?.();
    else state.map.doubleClickZoom?.enable?.();
    paint(state.map);
  }
}

async function loadData() {
  const rulesRes = await fetch("/config/well-status-rules.json");
  if (!rulesRes.ok) throw new Error("rules " + rulesRes.status);
  state.rules = await rulesRes.json();
  state.flags = flagsFromSearch(location.search, state.rules);
  const base = apiBase();
  if (base) {
    try {
      const live = await fetch(base + "/api/wells?include_gas=1&include_oil=1&include_mixed=1&include_other=1");
      if (live.ok) {
        const json = await live.json();
        state.features = json.features || [];
        state.origin = json.features?.[0]?.properties?.dataset_origin || "api";
        return;
      }
    } catch (_) {}
  }
  const local = await fetch("/data/cameron-wells.geojson");
  if (!local.ok) throw new Error("cameron wells " + local.status);
  const json = await local.json();
  state.features = json.features || [];
  state.origin = json.dataset_origin || "fixture";
}

function boot() {
  injectCss();
  const tryMap = () => {
    ensureCameronJump();
    ensureTrayToggles();
    const map = window.__SITELINE_MAP__;
    if (map && state.rules) bindMap(map);
  };
  loadData()
    .then(() => {
      loadStoredSite();
      render();
      tryMap();
    })
    .catch((err) => {
      const card = ensureCard();
      card.textContent = "Well layer failed to load. " + (err.message || "");
    });
  window.addEventListener("siteline-map-ready", tryMap);
  window.addEventListener("siteline-map-created", tryMap);
  let tries = 0;
  const timer = window.setInterval(() => {
    tries += 1;
    tryMap();
    if (state.bound || tries > 80) window.clearInterval(timer);
  }, 250);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && state.draw === "polygon") closePolygon();
    if (event.key === "Escape") {
      state.draw = null;
      state.vertices = [];
      render();
    }
  });
}

boot();

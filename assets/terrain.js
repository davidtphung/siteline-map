/**
 * Siteline Terrain: USGS 3DEP bare-earth tools on the MapLibre dock.
 * Estimates only. Survey before design use.
 */
import {
  ACRE_M2,
  CUT_STOPS,
  ELEV_STOPS,
  ESTIMATE_NOTE,
  FT_PER_M,
  M_PER_FT,
  SLOPE_STOPS,
  acresLabel,
  analyzeCutFill,
  bilinear,
  buildDxf,
  buildPdf,
  buildGridSpec,
  cellLngLat,
  computeDrainage,
  densifyLngLat,
  designCsv,
  existingCsv,
  formatReadout,
  gridPointLngLat,
  isLidarMeter,
  localFeet,
  lngLatToMerc,
  maskGrid,
  pointAtDistance,
  profileCsv,
  profileStats,
  rampColor,
  rasterSegment,
  ringAcres,
  smoothFeet,
  splitByBarrier,
  terrainGeoJSON,
  tileBBox,
  traceContours,
  traceDrainage,
} from "./terrain-math.mjs";

const SVC = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer";
const FLIGHT =
  "https://index.nationalmap.gov/arcgis/rest/services/3DEPElevationIndex/MapServer/8/query";
const TILE = 256;
const N = TILE + 2;
const STORE = "siteline.terrain.v1";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const state = {
  map: null,
  mode: "shade",
  opacity: 0,
  exag: 3,
  az: 315,
  alt: 40,
  minFt: 200,
  maxFt: 800,
  rev: 1,
  draw: null,
  cursor: null,
  profile: [],
  samples: null,
  vtxM: [],
  totalM: 0,
  pad: [],
  splits: [],
  spec: null,
  mask: null,
  smooth: null,
  cut: null,
  sec: null,
  overrides: {},
  ratio: 1,
  interval: 0.2,
  showEx: true,
  showDe: true,
  drainMin: 1,
  view: "",
  drain: null,
  contours: { existing: [], design: [] },
  flight: "",
  markers: [],
  outlets: [],
  scrub: null,
  hoverToken: 0,
  padToken: 0,
  heatCanvas: null,
  cutCanvas: null,
};

const elevCache = new Map();
let protocolOn = false;
let emptyPng = null;
let arrowReady = false;

function $(id) {
  return document.getElementById(id);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
}

function stamp() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || "null");
    if (!raw || typeof raw !== "object") return;
    if (raw.mode) state.mode = raw.mode;
    if (Number.isFinite(raw.opacity)) state.opacity = raw.opacity;
    if (Number.isFinite(raw.exag)) state.exag = raw.exag;
    if (Number.isFinite(raw.az)) state.az = raw.az;
    if (Number.isFinite(raw.alt)) state.alt = raw.alt;
    if (Number.isFinite(raw.minFt)) state.minFt = raw.minFt;
    if (Number.isFinite(raw.maxFt)) state.maxFt = raw.maxFt;
  } catch {
    /* private mode */
  }
}

function saveStore() {
  try {
    localStorage.setItem(
      STORE,
      JSON.stringify({
        mode: state.mode,
        opacity: state.opacity,
        exag: state.exag,
        az: state.az,
        alt: state.alt,
        minFt: state.minFt,
        maxFt: state.maxFt,
      }),
    );
  } catch {
    /* private mode */
  }
}

function injectCss() {
  if ($("sl-terrain-css")) return;
  const style = document.createElement("style");
  style.id = "sl-terrain-css";
  style.textContent = `
#sl-pane-terrain { padding: 10px 12px 16px; color: #e7e5e4; font: 500 12px/1.4 Inter, system-ui, sans-serif; }
#sl-pane-terrain h2 { margin: 0 0 4px; font: 600 14px/1.2 Inter, system-ui, sans-serif; }
#sl-pane-terrain .sl-terrain-lead, #sl-pane-terrain .sl-terrain-note { margin: 0 0 10px; color: rgba(255,255,255,.62); }
#sl-pane-terrain label { display: flex; justify-content: space-between; gap: 8px; margin: 8px 0 4px; color: rgba(255,255,255,.72); }
#sl-pane-terrain label b { font-family: "JetBrains Mono", ui-monospace, monospace; font-weight: 500; color: #fff; }
#sl-pane-terrain input[type="range"] { width: 100%; accent-color: #7dcea0; }
#sl-pane-terrain select, #sl-pane-terrain input[type="number"] {
  width: 100%; box-sizing: border-box; min-height: 36px; margin: 0 0 6px; padding: 0 8px;
  border-radius: 10px; border: 1px solid rgba(255,255,255,.14); background: #0c0e12; color: #fff;
  font: 500 12px/1 "JetBrains Mono", ui-monospace, monospace;
}
#sl-pane-terrain .sl-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
#sl-pane-terrain button.sl-tbtn, #sl-profile button {
  appearance: none; min-height: 36px; margin: 0 0 6px; padding: 0 10px; border-radius: 10px;
  border: 1px solid rgba(255,255,255,.16); background: transparent; color: #fff;
  font: 500 12px/1 Inter, system-ui, sans-serif; cursor: pointer;
}
#sl-pane-terrain button.sl-tbtn.primary { background: rgba(77,163,255,.16); }
#sl-pane-terrain button.sl-tbtn:disabled { opacity: .45; cursor: default; }
#sl-pane-terrain .sl-drawbar { display: flex; gap: 6px; }
#sl-pane-terrain [hidden] { display: none !important; }
#sl-pane-terrain .sl-drawbar button { flex: 1; }
#sl-terrain-stats { margin: 8px 0; padding: 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,.1); }
#sl-terrain-stats .big { display: flex; gap: 16px; }
#sl-terrain-stats .big b { display: block; font: 600 20px/1.1 "JetBrains Mono", ui-monospace, monospace; }
#sl-terrain-stats .big span, #sl-terrain-stats dt { color: rgba(255,255,255,.55); font-size: 10px; letter-spacing: .04em; }
#sl-terrain-stats dl { display: grid; grid-template-columns: 1fr auto; gap: 3px 8px; margin: 8px 0 0; }
#sl-terrain-stats dd { margin: 0; font-family: "JetBrains Mono", ui-monospace, monospace; text-align: right; }
#sl-elev-readout, #sl-lidar-flown, #sl-terrain-legend {
  position: fixed; z-index: 44; border-radius: 10px; border: 1px solid rgba(255,255,255,.14);
  background: rgba(8,10,14,.92); color: #f4f7fb; font: 500 12px/1.3 "JetBrains Mono", ui-monospace, monospace;
  box-shadow: 0 8px 24px rgba(0,0,0,.35);
}
#sl-elev-readout { left: 50%; bottom: 118px; transform: translateX(-50%); padding: 6px 10px; white-space: nowrap; }
#sl-lidar-flown { right: 14px; bottom: 118px; max-width: min(420px, 70vw); padding: 6px 8px; white-space: nowrap; }
#sl-terrain-legend { top: 70px; right: 14px; width: 196px; padding: 8px 10px; }
#sl-terrain-legend .ramp { height: 10px; border-radius: 99px; margin: 6px 0; background: linear-gradient(90deg,#20388c,#2e80ba,#48b8b0,#b0d69a,#fad678,#ec703e,#a81c2a); }
#sl-terrain-legend .ends { display: flex; justify-content: space-between; }
#sl-terrain-legend .key { margin-top: 6px; color: rgba(255,255,255,.8); font-family: Inter, system-ui, sans-serif; }
#sl-terrain-legend i { display: inline-block; width: 14px; height: 4px; margin: 0 4px 0 0; vertical-align: middle; border-radius: 2px; }
#sl-terrain-legend i.flow { background: #1e73ff; }
#sl-terrain-legend i.pond { width: 10px; height: 10px; border-radius: 2px; background: #1e6eff; margin-left: 8px; }
#sl-profile {
  position: fixed; z-index: 46; left: 12px; right: 12px; bottom: 10px;
  padding: 8px 10px 10px; border-radius: 14px; border: 1px solid rgba(255,255,255,.12);
  background: rgba(12,16,22,.96); color: #e7eef8; box-shadow: 0 12px 40px rgba(0,0,0,.45);
}
body.sl-profile-open #sl-tray.sl-dock { bottom: 318px !important; }
body.sl-profile-open #sl-elev-readout, body.sl-profile-open #sl-lidar-flown { bottom: 338px; }
#sl-profile .sl-prof-top { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; }
#sl-profile .sl-prof-stats { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 8px; flex: 1; }
#sl-profile .sl-prof-stats span { display: block; color: rgba(255,255,255,.5); font: 600 10px/1.2 Inter, system-ui, sans-serif; letter-spacing: .05em; }
#sl-profile .sl-prof-stats strong { font: 500 12px/1.3 "JetBrains Mono", ui-monospace, monospace; }
#sl-profile .sl-prof-actions { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
#sl-profile .sl-prof-actions button { margin: 0; }
#sl-profile-chart { display: block; width: 100%; height: 168px; cursor: crosshair; }
#sl-profile-tip {
  position: absolute; transform: translate(-50%, -130%); padding: 3px 6px; border-radius: 8px;
  background: #10141c; color: #fff; border: 1px solid rgba(255,255,255,.16);
  font: 500 11px/1.2 "JetBrains Mono", ui-monospace, monospace; pointer-events: none;
}
.sl-vtx, .sl-pad-vtx, .sl-scrub {
  display: grid; place-items: center; border-radius: 50%; box-sizing: border-box;
  font: 600 11px/1 Inter, system-ui, sans-serif;
}
.sl-vtx { width: 22px; height: 22px; background: #fff; color: #14181f; border: 2px solid #4da3ff; }
.sl-pad-vtx { width: 22px; height: 22px; border-radius: 5px; background: #f0c84a; color: #1c1504; border: 2px solid #fff; }
.sl-scrub { width: 14px; height: 14px; background: #e23b3b; border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.4); }
.sl-outlet { display: flex; align-items: center; gap: 4px; }
.sl-outlet-dot { width: 12px; height: 12px; border-radius: 50%; background: #1e73ff; border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.35); }
.sl-outlet-chip { padding: 2px 6px; border-radius: 999px; background: #0e1626; color: #fff; border: 1px solid rgba(255,255,255,.22); font: 600 12px/1.2 "JetBrains Mono", ui-monospace, monospace; white-space: nowrap; }
@media (max-width: 720px) {
  #sl-profile .sl-prof-stats { grid-template-columns: repeat(2, minmax(0,1fr)); }
  #sl-profile { bottom: 0; left: 0; right: 0; border-radius: 14px 14px 0 0; }
  body.sl-profile-open #sl-tray.sl-dock { bottom: 360px !important; }
}
`;
  document.head.appendChild(style);
}

function dockHtml() {
  return (
    '<h2>Terrain</h2>' +
    '<p class="sl-terrain-lead">USGS 3DEP bare earth, about 1 m. Numbers are estimates.</p>' +
    '<label>Lidar opacity <b id="sl-terrain-op-out">0%</b></label>' +
    '<input id="sl-terrain-opacity" type="range" min="0" max="100" step="1" value="0" aria-label="Lidar opacity">' +
    '<label for="sl-terrain-mode">Rendering</label>' +
    '<select id="sl-terrain-mode" aria-label="Lidar rendering">' +
    '<option value="shade">Shaded relief</option>' +
    '<option value="colorshade">Color elevation + shade</option>' +
    '<option value="color">Color elevation flat</option>' +
    '<option value="slope">Slope</option>' +
    '<option value="c2">Contours 2 ft</option>' +
    '<option value="c5">Contours 5 ft</option>' +
    "</select>" +
    '<div class="sl-row"><div><label>Exaggeration <b id="sl-terrain-exag-out">3.0</b></label><input id="sl-terrain-exag" type="range" min="1" max="12" step="0.5" value="3" aria-label="Vertical exaggeration"></div>' +
    '<div><label>Sun height <b id="sl-terrain-alt-out">40 deg</b></label><input id="sl-terrain-alt" type="range" min="5" max="80" step="1" value="40" aria-label="Sun height"></div></div>' +
    '<label>Sun direction <b id="sl-terrain-az-out">315 deg</b></label>' +
    '<input id="sl-terrain-az" type="range" min="0" max="360" step="1" value="315" aria-label="Sun direction">' +
    '<label>Color range, ft</label>' +
    '<div class="sl-row"><input id="sl-terrain-min" type="number" step="1" aria-label="Low elevation feet"><input id="sl-terrain-max" type="number" step="1" aria-label="High elevation feet"></div>' +
    '<button type="button" class="sl-tbtn" id="sl-terrain-fit">Fit to view</button>' +
    '<button type="button" class="sl-tbtn primary" id="sl-terrain-profile">Draw elevation profile</button>' +
    '<button type="button" class="sl-tbtn" id="sl-terrain-pad">Draw site pad</button>' +
    '<div class="sl-drawbar" id="sl-terrain-drawbar" hidden>' +
    '<button type="button" class="sl-tbtn" id="sl-terrain-undo">Undo</button>' +
    '<button type="button" class="sl-tbtn primary" id="sl-terrain-done">Done</button>' +
    '<button type="button" class="sl-tbtn" id="sl-terrain-cancel">Cancel</button></div>' +
    '<p id="sl-terrain-hint" class="sl-terrain-note" hidden>Click the map to add points. Double click to finish.</p>' +
    '<div id="sl-terrain-padbox" hidden>' +
    '<p id="sl-terrain-padsum" class="sl-terrain-note"></p>' +
    '<div class="sl-drawbar">' +
    '<button type="button" class="sl-tbtn" id="sl-terrain-view-elev">Elevation</button>' +
    '<button type="button" class="sl-tbtn" id="sl-terrain-view-drain">Drainage</button>' +
    '<button type="button" class="sl-tbtn" id="sl-terrain-view-cut">Cut/Fill</button></div>' +
    '<p id="sl-terrain-drain-note" class="sl-terrain-note" hidden></p>' +
    '<label for="sl-terrain-flow">Flow detail <b id="sl-terrain-flow-out">1 ac</b></label>' +
    '<select id="sl-terrain-flow" aria-label="Drainage detail"><option value="0.25">Fine</option><option value="1" selected>Normal</option><option value="5">Main stems</option></select>' +
    '<div id="sl-terrain-cutbox">' +
    '<div id="sl-terrain-stats"></div>' +
    '<div class="sl-row"><div><label for="sl-terrain-slope">Slope %</label><input id="sl-terrain-slope" type="number" step="0.001" aria-label="Design slope percent"></div>' +
    '<div><label for="sl-terrain-heading">Heading deg</label><input id="sl-terrain-heading" type="number" step="0.1" aria-label="Downhill heading degrees"></div></div>' +
    '<div class="sl-row"><div><label for="sl-terrain-ratio">Target cut to fill</label><input id="sl-terrain-ratio" type="number" min="0.5" max="3" step="0.05" value="1" aria-label="Target cut to fill ratio"></div>' +
    '<div><label for="sl-terrain-interval">Contours, ft</label><select id="sl-terrain-interval" aria-label="Contour interval feet">' +
    '<option value="0.1">0.10</option><option value="0.2" selected>0.20</option><option value="0.25">0.25</option><option value="0.5">0.50</option><option value="1">1.00</option>' +
    "</select></div></div>" +
    '<div class="sl-drawbar"><button type="button" class="sl-tbtn primary" id="sl-terrain-best">Best fit</button>' +
    '<button type="button" class="sl-tbtn" id="sl-terrain-split">Split sections</button></div>' +
    '<label><input id="sl-terrain-ex" type="checkbox" checked> Existing contours</label>' +
    '<label><input id="sl-terrain-de" type="checkbox" checked> Design contours</label>' +
    '<p id="sl-terrain-cont-note" class="sl-terrain-note"></p>' +
    '<div class="sl-drawbar"><button type="button" class="sl-tbtn" id="sl-terrain-pdf">PDF</button>' +
    '<button type="button" class="sl-tbtn" id="sl-terrain-csv-ex">Existing CSV</button>' +
    '<button type="button" class="sl-tbtn" id="sl-terrain-csv-de">Design CSV</button></div>' +
    '<div class="sl-drawbar"><button type="button" class="sl-tbtn" id="sl-terrain-dxf">Save DXF</button>' +
    '<button type="button" class="sl-tbtn" id="sl-terrain-geo">GeoJSON</button>' +
    '<button type="button" class="sl-tbtn" id="sl-terrain-clear">Clear pad</button></div>' +
    "</div></div>" +
    '<p id="sl-terrain-export-note" class="sl-terrain-note"></p>' +
    '<p class="sl-terrain-note">USGS 3DEP estimate. Verify with survey.</p>'
  );
}

function profileHtml() {
  return (
    '<div class="sl-prof-top"><div class="sl-prof-stats" id="sl-profile-stats"></div>' +
    '<div class="sl-prof-actions">' +
    '<button type="button" id="sl-profile-add">Add points</button>' +
    '<button type="button" id="sl-profile-csv">Save CSV</button>' +
    '<button type="button" id="sl-profile-dxf">Save DXF</button>' +
    '<button type="button" id="sl-profile-close">Close</button>' +
    "</div></div>" +
    '<div style="position:relative"><canvas id="sl-profile-chart" width="800" height="168"></canvas><div id="sl-profile-tip" hidden></div></div>' +
    '<p class="sl-terrain-note" id="sl-profile-src">USGS 3DEP estimate. Verify with survey.</p>'
  );
}

function mountChrome() {
  injectCss();
  if (!$("sl-elev-readout")) {
    const readout = document.createElement("div");
    readout.id = "sl-elev-readout";
    readout.textContent = "no lidar here";
    readout.hidden = true;
    document.body.appendChild(readout);
  }
  if (!$("sl-lidar-flown")) {
    const chip = document.createElement("div");
    chip.id = "sl-lidar-flown";
    chip.hidden = true;
    document.body.appendChild(chip);
  }
  if (!$("sl-terrain-legend")) {
    const legend = document.createElement("div");
    legend.id = "sl-terrain-legend";
    legend.hidden = true;
    legend.innerHTML =
      '<div>Elevation, ft</div><div class="ramp"></div><div class="ends"><span id="sl-terrain-leg-lo"></span><span id="sl-terrain-leg-hi"></span></div>' +
      '<div class="key"><i class="flow"></i>drainage<i class="pond"></i>standing water</div>';
    document.body.appendChild(legend);
  }
  if (!$("sl-profile")) {
    const panel = document.createElement("section");
    panel.id = "sl-profile";
    panel.hidden = true;
    panel.innerHTML = profileHtml();
    document.body.appendChild(panel);
    $("sl-profile-add").addEventListener("click", () => startDraw("profile", true));
    $("sl-profile-csv").addEventListener("click", saveProfileCsv);
    $("sl-profile-dxf").addEventListener("click", saveDxf);
    $("sl-profile-close").addEventListener("click", closeProfile);
    const chart = $("sl-profile-chart");
    chart.addEventListener("pointermove", (event) => scrubChart(event));
    chart.addEventListener("pointerdown", (event) => scrubChart(event));
    chart.addEventListener("pointerleave", () => {
      $("sl-profile-tip").hidden = true;
      drawChart(null);
    });
  }
  const pane = $("sl-pane-terrain");
  if (pane && pane.dataset.slTerrain !== "1") {
    pane.dataset.slTerrain = "1";
    pane.innerHTML = dockHtml();
    bindDock();
    syncControls();
  }
  citeAbout();
}

function bindDock() {
  const opacity = $("sl-terrain-opacity");
  opacity.addEventListener("input", () => {
    state.opacity = Number(opacity.value);
    $("sl-terrain-op-out").textContent = state.opacity ? state.opacity + "%" : "Off";
    applyOpacity();
    saveStore();
  });
  $("sl-terrain-mode").addEventListener("change", (event) => {
    state.mode = event.target.value;
    bumpTiles();
    saveStore();
  });
  $("sl-terrain-exag").addEventListener("input", (event) => {
    state.exag = Number(event.target.value);
    $("sl-terrain-exag-out").textContent = state.exag.toFixed(1);
    bumpTiles();
    saveStore();
  });
  $("sl-terrain-az").addEventListener("input", (event) => {
    state.az = Number(event.target.value);
    $("sl-terrain-az-out").textContent = state.az + " deg";
    bumpTiles();
    saveStore();
  });
  $("sl-terrain-alt").addEventListener("input", (event) => {
    state.alt = Number(event.target.value);
    $("sl-terrain-alt-out").textContent = state.alt + " deg";
    bumpTiles();
    saveStore();
  });
  $("sl-terrain-min").addEventListener("change", (event) => {
    state.minFt = Number(event.target.value);
    if (!(state.maxFt > state.minFt)) state.maxFt = state.minFt + 1;
    bumpTiles();
    saveStore();
  });
  $("sl-terrain-max").addEventListener("change", (event) => {
    state.maxFt = Number(event.target.value);
    if (!(state.maxFt > state.minFt)) state.maxFt = state.minFt + 1;
    bumpTiles();
    saveStore();
  });
  $("sl-terrain-fit").addEventListener("click", fitToView);
  $("sl-terrain-profile").addEventListener("click", () => startDraw("profile", false));
  $("sl-terrain-pad").addEventListener("click", () => startDraw("pad", false));
  $("sl-terrain-undo").addEventListener("click", undoVertex);
  $("sl-terrain-done").addEventListener("click", finishDraw);
  $("sl-terrain-cancel").addEventListener("click", cancelDraw);
  $("sl-terrain-view-elev").addEventListener("click", () => setView("elev"));
  $("sl-terrain-view-drain").addEventListener("click", () => setView(state.view === "drain" ? "elev" : "drain"));
  $("sl-terrain-view-cut").addEventListener("click", () => setView(state.view === "cut" ? "elev" : "cut"));
  $("sl-terrain-flow").addEventListener("change", (event) => {
    state.drainMin = Number(event.target.value) || 1;
    $("sl-terrain-flow-out").textContent = state.drainMin + " ac";
    if (state.view === "drain") renderDrainage();
  });
  $("sl-terrain-stats").addEventListener("click", (event) => {
    const button = event.target.closest("[data-sec]");
    if (!button || !state.cut) return;
    state.sectionId = Number(button.dataset.sec);
    renderCutStats();
  });
  $("sl-terrain-best").addEventListener("click", () => {
    const id = selectedSection();
    if (id == null) return;
    delete state.overrides[id];
    recomputeCut();
  });
  $("sl-terrain-split").addEventListener("click", () => startDraw("split", false));
  $("sl-terrain-slope").addEventListener("change", readDesignInputs);
  $("sl-terrain-heading").addEventListener("change", readDesignInputs);
  $("sl-terrain-ratio").addEventListener("change", (event) => {
    const value = Number(event.target.value);
    state.ratio = Number.isFinite(value) ? Math.max(0.5, Math.min(3, value)) : 1;
    recomputeCut();
  });
  $("sl-terrain-interval").addEventListener("change", (event) => {
    state.interval = Math.max(0.1, Math.min(1, Number(event.target.value) || 0.2));
    renderContours();
  });
  $("sl-terrain-ex").addEventListener("change", (event) => {
    state.showEx = event.target.checked;
    applyViewVisibility();
  });
  $("sl-terrain-de").addEventListener("change", (event) => {
    state.showDe = event.target.checked;
    applyViewVisibility();
  });
  $("sl-terrain-pdf").addEventListener("click", savePdf);
  $("sl-terrain-csv-ex").addEventListener("click", () => saveGridCsv("existing"));
  $("sl-terrain-csv-de").addEventListener("click", () => saveGridCsv("design"));
  $("sl-terrain-dxf").addEventListener("click", saveDxf);
  $("sl-terrain-geo").addEventListener("click", saveGeo);
  $("sl-terrain-clear").addEventListener("click", clearPad);
}

function syncControls() {
  const opacity = $("sl-terrain-opacity");
  if (!opacity) return;
  opacity.value = String(state.opacity);
  $("sl-terrain-op-out").textContent = state.opacity ? state.opacity + "%" : "Off";
  $("sl-terrain-mode").value = state.mode;
  $("sl-terrain-exag").value = String(state.exag);
  $("sl-terrain-exag-out").textContent = Number(state.exag).toFixed(1);
  $("sl-terrain-az").value = String(state.az);
  $("sl-terrain-az-out").textContent = state.az + " deg";
  $("sl-terrain-alt").value = String(state.alt);
  $("sl-terrain-alt-out").textContent = state.alt + " deg";
  $("sl-terrain-min").value = String(Math.round(state.minFt));
  $("sl-terrain-max").value = String(Math.round(state.maxFt));
}

function citeAbout() {
  const list = $("sl-about-list");
  if (!list || $("sl-about-3dep") || list.textContent.includes("3DEP bare earth")) return;
  const article = document.createElement("article");
  article.className = "sl-about-src";
  article.id = "sl-about-3dep";
  article.innerHTML =
    "<header><strong>USGS 3DEP bare earth elevation</strong><span class=\"sl-honesty-chip dem\">DEM-derived</span></header>" +
    "<p class=\"sl-about-meta\">USGS 3DEP ImageServer · lidar estimate, not a survey. Flight date when the index has one.</p>" +
    '<a href="' +
    SVC +
    '" target="_blank" rel="noopener noreferrer">' +
    SVC +
    "</a>" +
    "<p class=\"sl-about-credit\">Terrain estimates use USGS 3DEP. Inspired by public CutSheetRX patterns. Siteline implementation is original.</p>";
  list.appendChild(article);
}

function selectedSection() {
  if (!state.cut || !state.cut.sections.length) return null;
  const found = state.cut.sections.find((section) => section.id === state.sectionId);
  return (found || state.cut.sections[0]).id;
}

function readDesignInputs() {
  const id = selectedSection();
  if (id == null) return;
  const slope = Number($("sl-terrain-slope").value);
  const heading = Number($("sl-terrain-heading").value);
  if (!Number.isFinite(slope) || !Number.isFinite(heading)) return;
  state.overrides[id] = { slope, heading };
  recomputeCut();
}

function setView(view) {
  state.view = view;
  if (view === "drain") renderDrainage();
  if (view === "cut") {
    recomputeCut();
    renderContours();
  }
  applyViewVisibility();
  paintPadSummary();
}

function applyViewVisibility() {
  const map = state.map;
  if (!map) return;
  const show = (id, on) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  };
  const drain = state.view === "drain";
  const cut = state.view === "cut";
  show("sl-terrain-heat", !!state.mask && !cut);
  show("sl-terrain-pond", drain);
  show("sl-terrain-drain-halo", drain);
  show("sl-terrain-drain-line", drain);
  show("sl-terrain-arrows", drain);
  show("sl-terrain-cut", cut);
  show("sl-terrain-cont-ex", cut && state.showEx);
  show("sl-terrain-cont-de", cut && state.showDe);
  const legend = $("sl-terrain-legend");
  if (legend) legend.hidden = !(state.mask && !cut);
  for (const marker of state.outlets) marker.getElement().style.display = drain ? "" : "none";
}

function paintPadSummary() {
  const box = $("sl-terrain-padbox");
  const sum = $("sl-terrain-padsum");
  if (!box || !sum) return;
  box.hidden = state.pad.length < 3;
  if (box.hidden) return;
  if (!state.mask) {
    sum.textContent = ringAcres(state.pad).toFixed(1) + " ac · lidar UNKNOWN";
    return;
  }
  const acres = (state.mask.count * state.spec.cell * state.spec.cell) / ACRE_M2;
  const lo = state.mask.minM * FT_PER_M;
  const hi = state.mask.maxM * FT_PER_M;
  sum.textContent = acres.toFixed(1) + " ac · " + lo.toFixed(1) + " to " + hi.toFixed(1) + " ft · " + (hi - lo).toFixed(1) + " ft relief. " + ESTIMATE_NOTE;
}

function noteExport(name) {
  const el = $("sl-terrain-export-note");
  if (el) el.textContent = "Saved " + name + ". " + ESTIMATE_NOTE;
}

function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  noteExport(name);
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 120000);
}

function blobBuf(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      resolve(blob ? blob.arrayBuffer() : new ArrayBuffer(0));
    }, "image/png");
  });
}

async function transparentPng() {
  if (emptyPng) return emptyPng;
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  emptyPng = await blobBuf(canvas);
  return emptyPng;
}

function registerProtocol() {
  if (protocolOn) return;
  const ml = window.maplibregl;
  if (!ml || typeof ml.addProtocol !== "function") return;
  ml.addProtocol("sl3dep", (request, abort) => tileRequest(request.url, abort && abort.signal));
  protocolOn = true;
}

async function tileRequest(url, signal) {
  const match = String(url).match(/(\d+)\/(\d+)\/(\d+)\/(\d+)/);
  if (!match) return { data: await transparentPng() };
  const z = Number(match[2]);
  const x = Number(match[3]);
  const y = Number(match[4]);
  try {
    if (state.mode === "c2" || state.mode === "c5") return { data: await contourTile(z, x, y, signal) };
    const elev = await loadElevTile(z, x, y, signal);
    return { data: await renderElevTile(elev) };
  } catch (err) {
    if (err && err.name === "AbortError") throw err;
    return { data: await transparentPng() };
  }
}

async function loadElevTile(z, x, y, signal) {
  const key = z + "/" + x + "/" + y;
  const cached = elevCache.get(key);
  if (cached) return cached;
  const job = fetchElevTile(z, x, y, signal).then((tile) => {
    elevCache.set(key, tile);
    return tile;
  });
  elevCache.set(key, job);
  job.catch(() => {
    if (elevCache.get(key) === job) elevCache.delete(key);
  });
  return job;
}

async function fetchElevTile(z, x, y, signal) {
  if (!window.Lerc) throw new Error("lerc");
  const bb = tileBBox(z, x, y, TILE);
  const url =
    SVC +
    "/exportImage?f=image&format=lerc&pixelType=F32&bboxSR=3857&imageSR=3857&interpolation=RSP_BilinearInterpolation&size=" +
    N +
    "," +
    N +
    "&bbox=" +
    bb.bbox.map((v) => v.toFixed(2)).join(",");
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("lerc http");
  const buf = await res.arrayBuffer();
  const decoded = window.Lerc.decode(buf);
  const pix = decoded.pixels[0];
  const mask = decoded.mask;
  const elev = new Float32Array(pix.length);
  for (let i = 0; i < pix.length; i++) {
    const value = pix[i];
    elev[i] = mask && !mask[i] ? NaN : isLidarMeter(value) ? value : NaN;
  }
  return { elev, width: decoded.width, height: decoded.height, cell: bb.cell };
}

function renderElevTile(tile) {
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.createImageData(TILE, TILE);
  const out = image.data;
  const elev = tile.elev;
  const width = tile.width;
  const mode = state.mode;
  const lo = state.minFt * M_PER_FT;
  const span = Math.max(0.1, (state.maxFt - state.minFt) * M_PER_FT);
  const alt = (state.alt * Math.PI) / 180;
  const az = (state.az * Math.PI) / 180;
  const lx = Math.cos(alt) * Math.sin(az);
  const ly = Math.cos(alt) * Math.cos(az);
  const lz = Math.sin(alt);
  const zf = state.exag / (8 * (tile.cell || 1));
  const ambient = 0.3;
  const at = (xx, yy, fallback) => {
    const value = elev[yy * width + xx];
    return value === value ? value : fallback;
  };
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const i = x + 1;
      const j = y + 1;
      const e = elev[j * width + i];
      const o = (y * TILE + x) * 4;
      if (!isLidarMeter(e)) {
        out[o + 3] = 0;
        continue;
      }
      if (mode === "color") {
        const col = rampColor(ELEV_STOPS, (e - lo) / span);
        out[o] = col[0];
        out[o + 1] = col[1];
        out[o + 2] = col[2];
        out[o + 3] = 255;
        continue;
      }
      const A = at(i - 1, j - 1, e);
      const B = at(i, j - 1, e);
      const C = at(i + 1, j - 1, e);
      const D = at(i - 1, j, e);
      const F = at(i + 1, j, e);
      const G = at(i - 1, j + 1, e);
      const H = at(i, j + 1, e);
      const I = at(i + 1, j + 1, e);
      const gx = C + 2 * F + I - (A + 2 * D + G);
      const gy = A + 2 * B + C - (G + 2 * H + I);
      const nx = -gx * zf;
      const ny = -gy * zf;
      const len = Math.hypot(nx, ny, 1);
      const lit = Math.max(0, (nx * lx + ny * ly + lz) / len);
      const light = ambient + (1 - ambient) * ((lit / (lz || 1)) * 0.82);
      let r;
      let g;
      let b;
      if (mode === "slope") {
        const pct = (Math.hypot(gx, gy) / (8 * (tile.cell || 1))) * 100;
        const col = rampColor(SLOPE_STOPS, Math.min(1, pct / 3));
        r = col[0] * light;
        g = col[1] * light;
        b = col[2] * light;
      } else if (mode === "colorshade") {
        const col = rampColor(ELEV_STOPS, (e - lo) / span);
        r = col[0] * light;
        g = col[1] * light;
        b = col[2] * light;
      } else {
        const v = light * 225;
        r = v;
        g = v;
        b = v;
      }
      out[o] = Math.max(0, Math.min(255, r));
      out[o + 1] = Math.max(0, Math.min(255, g));
      out[o + 2] = Math.max(0, Math.min(255, b));
      out[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return blobBuf(canvas);
}

async function contourTile(z, x, y, signal) {
  const bb = tileBBox(z, x, y, TILE);
  const rule = { rasterFunction: state.mode === "c2" ? "Preset 2ft Contour Interval" : "Preset 5ft Contour Interval" };
  const url =
    SVC +
    "/exportImage?f=image&format=png&bboxSR=3857&imageSR=3857&size=" +
    N +
    "," +
    N +
    "&bbox=" +
    bb.bbox.map((v) => v.toFixed(2)).join(",") +
    "&renderingRule=" +
    encodeURIComponent(JSON.stringify(rule));
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("contour");
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  canvas.getContext("2d").drawImage(bitmap, 1, 1, TILE, TILE, 0, 0, TILE, TILE);
  bitmap.close?.();
  return blobBuf(canvas);
}

function ensureRaster() {
  const map = state.map;
  if (!map || !map.getStyle?.()) return;
  registerProtocol();
  if (!map.getSource("sl-3dep")) {
    const layers = map.getStyle().layers || [];
    const before = layers.find((layer) => layer.type !== "raster" && layer.type !== "background")?.id;
    map.addSource("sl-3dep", {
      type: "raster",
      tiles: [tileTemplate()],
      tileSize: TILE,
      minzoom: 10,
      maxzoom: 16,
      attribution: "Elevation: USGS 3DEP",
    });
    map.addLayer(
      {
        id: "sl-3dep",
        type: "raster",
        source: "sl-3dep",
        paint: { "raster-opacity": state.opacity / 100, "raster-fade-duration": 0 },
      },
      before,
    );
  }
  applyOpacity();
  ensureVectorLayers();
}

function tileTemplate() {
  return "sl3dep://rev/" + state.rev + "/{z}/{x}/{y}";
}

function bumpTiles() {
  const map = state.map;
  if (!map || !map.getSource("sl-3dep")) return;
  state.rev += 1;
  map.getSource("sl-3dep").setTiles([tileTemplate()]);
}

function applyOpacity() {
  const map = state.map;
  if (!map || !map.getLayer("sl-3dep")) return;
  map.setPaintProperty("sl-3dep", "raster-opacity", Math.max(0, Math.min(1, state.opacity / 100)));
  map.setLayoutProperty("sl-3dep", "visibility", state.opacity > 0 ? "visible" : "none");
}

function emptyFc() {
  return { type: "FeatureCollection", features: [] };
}

function ensureVectorLayers() {
  const map = state.map;
  if (!map.getSource("sl-terrain-profile")) {
    map.addSource("sl-terrain-profile", { type: "geojson", data: emptyFc() });
    map.addLayer({
      id: "sl-terrain-profile-halo",
      type: "line",
      source: "sl-terrain-profile",
      paint: { "line-color": "#4da3ff", "line-width": 7, "line-opacity": 0.95 },
    });
    map.addLayer({
      id: "sl-terrain-profile-line",
      type: "line",
      source: "sl-terrain-profile",
      paint: { "line-color": "#ffffff", "line-width": 5.2 },
    });
    map.addSource("sl-terrain-pad", { type: "geojson", data: emptyFc() });
    map.addLayer({
      id: "sl-terrain-pad-line",
      type: "line",
      source: "sl-terrain-pad",
      paint: { "line-color": "#f0c84a", "line-width": 3 },
    });
    map.addSource("sl-terrain-cont", { type: "geojson", data: emptyFc() });
    map.addLayer({
      id: "sl-terrain-cont-ex",
      type: "line",
      source: "sl-terrain-cont",
      filter: ["==", ["get", "layer"], "existing"],
      paint: { "line-color": "#161616", "line-width": 1.1, "line-opacity": 0.8 },
    });
    map.addLayer({
      id: "sl-terrain-cont-de",
      type: "line",
      source: "sl-terrain-cont",
      filter: ["==", ["get", "layer"], "design"],
      paint: { "line-color": "#ffb000", "line-width": 1.7 },
    });
    map.addSource("sl-terrain-drain", { type: "geojson", data: emptyFc() });
    map.addLayer({
      id: "sl-terrain-drain-halo",
      type: "line",
      source: "sl-terrain-drain",
      paint: { "line-color": "rgba(255,255,255,0.88)", "line-width": ["+", ["get", "width"], 2.2], "line-opacity": 0.7 },
      layout: { "line-cap": "round", "line-join": "round" },
    });
    map.addLayer({
      id: "sl-terrain-drain-line",
      type: "line",
      source: "sl-terrain-drain",
      paint: { "line-color": "#1e73ff", "line-width": ["get", "width"], "line-opacity": 0.95 },
      layout: { "line-cap": "round", "line-join": "round" },
    });
    map.addSource("sl-terrain-arrows", { type: "geojson", data: emptyFc() });
  }
  if (!arrowReady) {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#1e73ff";
    ctx.beginPath();
    ctx.moveTo(16, 3);
    ctx.lineTo(27, 24);
    ctx.lineTo(16, 18);
    ctx.lineTo(5, 24);
    ctx.closePath();
    ctx.fill();
    const img = ctx.getImageData(0, 0, 32, 32);
    if (!map.hasImage("sl-flow-arrow")) map.addImage("sl-flow-arrow", img, { pixelRatio: 2 });
    map.addLayer({
      id: "sl-terrain-arrows",
      type: "symbol",
      source: "sl-terrain-arrows",
      layout: {
        "icon-image": "sl-flow-arrow",
        "icon-rotate": ["get", "bearing"],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-size": 0.72,
      },
    });
    arrowReady = true;
  }
}

function setGeo(id, data) {
  const source = state.map && state.map.getSource(id);
  if (source) source.setData(data);
}

function syncProfileLine() {
  const coords = state.profile.slice();
  if (state.draw === "profile" && state.cursor && coords.length) coords.push(state.cursor);
  setGeo("sl-terrain-profile", {
    type: "FeatureCollection",
    features: coords.length >= 2 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }] : [],
  });
}

function syncPadLine() {
  const coords = state.pad.slice();
  if (state.draw === "pad" && state.cursor && coords.length) coords.push(state.cursor);
  const closed = state.draw !== "pad" && coords.length >= 3 ? coords.concat([coords[0]]) : coords;
  const features = [];
  if (closed.length >= 2) features.push({ type: "Feature", properties: { kind: "pad" }, geometry: { type: "LineString", coordinates: closed } });
  for (const line of state.splits) {
    features.push({ type: "Feature", properties: { kind: "split" }, geometry: { type: "LineString", coordinates: line } });
  }
  if (state.draw === "split" && state.splitPts && state.splitPts.length) {
    const split = state.splitPts.slice();
    if (state.cursor) split.push(state.cursor);
    features.push({ type: "Feature", properties: { kind: "split" }, geometry: { type: "LineString", coordinates: split } });
  }
  setGeo("sl-terrain-pad", { type: "FeatureCollection", features });
}

function clearMarkers() {
  for (const marker of state.markers) marker.remove();
  state.markers = [];
}

function markerEl(className, label) {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = label;
  return el;
}

function redrawMarkers() {
  clearMarkers();
  const map = state.map;
  if (!map || !window.maplibregl) return;
  const kind = state.pad.length >= 3 || state.draw === "pad" ? "pad" : "profile";
  const pts = kind === "pad" && state.draw !== "profile" ? state.pad : state.profile;
  const usePad = state.draw === "pad" || (state.pad.length >= 3 && state.draw !== "profile");
  const list = usePad ? state.pad : state.profile;
  const cls = usePad ? "sl-pad-vtx" : "sl-vtx";
  list.forEach((lnglat, index) => {
    const marker = new window.maplibregl.Marker({ element: markerEl(cls, String(index + 1)), draggable: true })
      .setLngLat(lnglat)
      .addTo(map);
    marker.on("drag", () => {
      const ll = marker.getLngLat();
      list[index] = [ll.lng, ll.lat];
      if (usePad) syncPadLine();
      else syncProfileLine();
    });
    marker.on("dragend", () => {
      if (usePad && state.pad.length >= 3 && state.draw !== "pad") loadPad();
      if (!usePad && state.profile.length >= 2 && state.draw !== "profile") computeProfile();
    });
    state.markers.push(marker);
  });
}

function startDraw(kind, keep) {
  state.draw = kind;
  state.cursor = null;
  if (kind === "profile" && !keep) {
    state.profile = [];
    state.samples = null;
    closeProfile(false);
  }
  if (kind === "pad") {
    clearPad(false);
    state.pad = [];
  }
  if (kind === "split") state.splitPts = [];
  const bar = $("sl-terrain-drawbar");
  const hint = $("sl-terrain-hint");
  if (bar) bar.hidden = false;
  if (hint) {
    hint.hidden = false;
    hint.textContent = kind === "split" ? "Draw a line across the pad. Double click to split." : "Click the map to add points. Double click to finish.";
  }
  if (state.map) {
    state.map.getCanvas().style.cursor = "crosshair";
    state.map.doubleClickZoom && state.map.doubleClickZoom.disable();
  }
  window.__slTerrainDraw = true;
  redrawMarkers();
}

function cancelDraw() {
  const kind = state.draw;
  state.draw = null;
  state.cursor = null;
  window.__slTerrainDraw = false;
  if (kind === "profile") state.profile = [];
  if (kind === "pad") state.pad = [];
  if (kind === "split") state.splitPts = [];
  const bar = $("sl-terrain-drawbar");
  const hint = $("sl-terrain-hint");
  if (bar) bar.hidden = true;
  if (hint) hint.hidden = true;
  if (state.map) {
    state.map.getCanvas().style.cursor = "";
    state.map.doubleClickZoom && state.map.doubleClickZoom.enable();
  }
  syncProfileLine();
  syncPadLine();
  redrawMarkers();
}

function finishDraw() {
  const kind = state.draw;
  state.draw = null;
  state.cursor = null;
  window.__slTerrainDraw = false;
  const bar = $("sl-terrain-drawbar");
  const hint = $("sl-terrain-hint");
  if (bar) bar.hidden = true;
  if (hint) hint.hidden = true;
  if (state.map) {
    state.map.getCanvas().style.cursor = "";
    state.map.doubleClickZoom && state.map.doubleClickZoom.enable();
  }
  if (kind === "profile") {
    if (state.profile.length >= 2) computeProfile();
    else syncProfileLine();
  } else if (kind === "pad") {
    syncPadLine();
    if (state.pad.length >= 3) loadPad();
  } else if (kind === "split") {
    applySplit();
  }
  redrawMarkers();
}

function undoVertex() {
  if (state.draw === "profile") state.profile.pop();
  else if (state.draw === "pad") state.pad.pop();
  else if (state.draw === "split" && state.splitPts) state.splitPts.pop();
  syncProfileLine();
  syncPadLine();
  redrawMarkers();
}

function onCanvasClick(event) {
  if (!state.draw || !state.map) return;
  event.preventDefault();
  event.stopPropagation();
  const rect = state.map.getCanvas().getBoundingClientRect();
  const ll = state.map.unproject([event.clientX - rect.left, event.clientY - rect.top]);
  const pt = [ll.lng, ll.lat];
  if (state.draw === "profile") state.profile.push(pt);
  else if (state.draw === "pad") state.pad.push(pt);
  else if (state.draw === "split") {
    state.splitPts = state.splitPts || [];
    state.splitPts.push(pt);
  }
  syncProfileLine();
  syncPadLine();
  redrawMarkers();
}

function onCanvasDbl(event) {
  if (!state.draw) return;
  event.preventDefault();
  event.stopPropagation();
  const list = state.draw === "profile" ? state.profile : state.draw === "pad" ? state.pad : state.splitPts || [];
  if (list.length >= 2) {
    const a = list[list.length - 1];
    const b = list[list.length - 2];
    if (Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7) list.pop();
  }
  const ready = state.draw === "profile" ? state.profile.length >= 2 : state.draw === "pad" ? state.pad.length >= 3 : (state.splitPts || []).length >= 2;
  if (ready) finishDraw();
}

function onHover(event) {
  if (!event || !event.lngLat) return;
  const lat = event.lngLat.lat;
  const lon = event.lngLat.lng;
  if (state.draw) {
    state.cursor = [lon, lat];
    if (state.draw === "profile") syncProfileLine();
    else syncPadLine();
  }
  const readout = $("sl-elev-readout");
  if (readout) readout.hidden = false;
  const cached = sampleCached(lon, lat);
  if (isLidarMeter(cached)) {
    state.hoverToken += 1;
    if (readout) readout.textContent = formatReadout(cached, lat, lon);
    return;
  }
  const token = ++state.hoverToken;
  if (readout) readout.textContent = formatReadout(null, lat, lon);
  window.clearTimeout(state.hoverTimer);
  state.hoverTimer = window.setTimeout(() => {
    identify(lon, lat).then((value) => {
      if (token !== state.hoverToken || !readout) return;
      readout.textContent = formatReadout(value, lat, lon);
    });
  }, 140);
}

function sampleCached(lon, lat) {
  const gridHit = sampleGrid(lon, lat);
  if (isLidarMeter(gridHit)) return gridHit;
  const map = state.map;
  if (!map) return null;
  const zView = Math.max(10, Math.min(16, Math.round(map.getZoom())));
  for (let z = Math.min(16, zView + 1); z >= 10; z--) {
    const scale = TILE * 2 ** z;
    const x = ((lon + 180) / 360) * scale;
    const sin = Math.sin((lat * Math.PI) / 180);
    const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    const tile = elevCache.get(z + "/" + tx + "/" + ty);
    if (!tile || typeof tile.then === "function" || !tile.elev) continue;
    const fx = x - tx * TILE + 1;
    const fy = y - ty * TILE + 1;
    const value = bilinear(tile.elev, tile.width, fx, fy);
    if (isLidarMeter(value)) return value;
  }
  return null;
}

function sampleGrid(lon, lat) {
  if (!state.spec || !state.mask) return null;
  const [x, y] = lngLatToMerc(lon, lat);
  const i = (x - state.spec.minX) / state.spec.cm;
  const j = (state.spec.maxY - y) / state.spec.cm;
  return bilinear(state.mask.ex, state.spec.width, i - 0.5, j - 0.5);
}

async function identify(lon, lat) {
  try {
    const url =
      SVC +
      "/identify?f=json&returnGeometry=false&returnCatalogItems=false&geometryType=esriGeometryPoint&geometry=" +
      encodeURIComponent(JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } }));
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const value = json && json.value != null ? parseFloat(json.value) : null;
    return isLidarMeter(value) ? value : null;
  } catch {
    return null;
  }
}

async function fetchSamples(samples) {
  const out = new Array(samples.length).fill(null);
  const batch = 250;
  for (let start = 0; start < samples.length; start += batch) {
    const chunk = samples.slice(start, start + batch);
    const body = new URLSearchParams({
      geometry: JSON.stringify({
        points: chunk.map((p) => [Number(p.lng.toFixed(7)), Number(p.lat.toFixed(7))]),
        spatialReference: { wkid: 4326 },
      }),
      geometryType: "esriGeometryMultipoint",
      returnFirstValueOnly: "true",
      interpolation: "RSP_BilinearInterpolation",
      f: "json",
    });
    const res = await fetch(SVC + "/getSamples", { method: "POST", body });
    if (!res.ok) throw new Error("samples");
    const json = await res.json();
    if (!json || !json.samples) throw new Error("samples");
    json.samples.forEach((sm, index) => {
      const slot = start + (sm.locationId != null ? Number(sm.locationId) : index);
      const value = parseFloat(sm.value);
      if (out[slot] == null) out[slot] = isLidarMeter(value) ? value : null;
    });
  }
  return out;
}

async function computeProfile() {
  const dense = densifyLngLat(state.profile, 2);
  const src = $("sl-profile-src");
  if (src) src.textContent = "Reading USGS 3DEP along the line.";
  showProfile();
  let values = null;
  try {
    values = await fetchSamples(dense.samples);
    if (src) src.textContent = ESTIMATE_NOTE;
  } catch {
    values = dense.samples.map((p) => sampleCached(p.lng, p.lat));
    if (src) src.textContent = "Loaded lidar tiles. " + ESTIMATE_NOTE;
  }
  dense.samples.forEach((sample, index) => {
    sample.zM = values[index];
  });
  const stats = profileStats(dense.samples, dense.totalM);
  state.samples = dense.samples;
  state.vtxM = dense.vtxM;
  state.totalM = dense.totalM;
  if (!stats) {
    if (src) src.textContent = "No lidar along this line.";
    renderStats(null);
    return;
  }
  renderStats(stats);
  requestAnimationFrame(() => drawChart(null));
}

function showProfile() {
  const panel = $("sl-profile");
  if (!panel) return;
  panel.hidden = false;
  document.body.classList.add("sl-profile-open");
}

function closeProfile(clearLine) {
  const panel = $("sl-profile");
  if (panel) panel.hidden = true;
  document.body.classList.remove("sl-profile-open");
  if (state.scrub) {
    state.scrub.remove();
    state.scrub = null;
  }
  if (clearLine !== false) {
    state.profile = [];
    state.samples = null;
    state.draw = null;
    window.__slTerrainDraw = false;
    syncProfileLine();
    redrawMarkers();
  }
}

function renderStats(stats) {
  const host = $("sl-profile-stats");
  if (!host) return;
  if (!stats) {
    host.innerHTML = "<span>LENGTH</span><strong>UNKNOWN</strong>";
    return;
  }
  const len = stats.lengthFt >= 5280 ? (stats.lengthFt / 5280).toFixed(2) + " mi" : Math.round(stats.lengthFt).toLocaleString("en-US") + " ft";
  const rise = (stats.riseFt >= 0 ? "+" : "") + stats.riseFt.toFixed(2) + " ft (" + (stats.gradePct >= 0 ? "+" : "") + stats.gradePct.toFixed(2) + "%)";
  const cells = [
    ["LENGTH", len],
    ["START", stats.startFt.toFixed(2) + " ft"],
    ["END", stats.endFt.toFixed(2) + " ft"],
    ["RISE", rise],
    ["LOW/HIGH", stats.lowFt.toFixed(2) + " / " + stats.highFt.toFixed(2) + " ft"],
  ];
  host.innerHTML = cells.map(([k, v]) => "<div><span>" + k + "</span><strong>" + esc(v) + "</strong></div>").join("");
}

function drawChart(hoverM) {
  const canvas = $("sl-profile-chart");
  if (!canvas || !state.samples) return;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 640;
  const height = canvas.clientHeight || 168;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const samples = state.samples;
  const good = samples.filter((p) => isLidarMeter(p.zM));
  if (good.length < 2) return;
  const feet = good.map((p) => p.zM * FT_PER_M);
  let zmin = Math.min(...feet);
  let zmax = Math.max(...feet);
  const span = Math.max(1, zmax - zmin);
  zmin -= span * 0.12;
  zmax += span * 0.22;
  const left = 52;
  const right = 12;
  const top = 22;
  const bottom = 26;
  const pw = width - left - right;
  const ph = height - top - bottom;
  const total = state.totalM || good[good.length - 1].dM || 1;
  const X = (m) => left + (m / total) * pw;
  const Y = (ft) => top + ((zmax - ft) / (zmax - zmin)) * ph;
  ctx.font = "11px JetBrains Mono, ui-monospace, monospace";
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("elev ft", 4, 4);
  ctx.textAlign = "right";
  ctx.fillText("distance ft", width - right, height - 12);
  ctx.fillStyle = "rgba(255,255,255,.45)";
  ctx.strokeStyle = "rgba(255,255,255,.08)";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const yStep = niceStep(zmax - zmin, 4);
  for (let y = Math.ceil(zmin / yStep) * yStep; y <= zmax; y += yStep) {
    const py = Math.round(Y(y)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(left, py);
    ctx.lineTo(width - right, py);
    ctx.stroke();
    ctx.fillText(String(Math.round(y)), left - 6, py);
  }
  const totFt = total * FT_PER_M;
  const xStep = niceStep(totFt, Math.max(2, Math.floor(pw / 90)));
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let x = 0; x <= totFt + 1e-6; x += xStep) {
    const px = X((x / FT_PER_M));
    ctx.fillText((x === 0 ? "0 ft" : Math.round(x).toLocaleString("en-US")), px, height - bottom + 6);
  }
  ctx.beginPath();
  let started = false;
  samples.forEach((p) => {
    if (!isLidarMeter(p.zM)) return;
    const px = X(p.dM);
    const py = Y(p.zM * FT_PER_M);
    if (!started) {
      ctx.moveTo(px, py);
      started = true;
    } else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = "#d7e6f8";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineTo(X(good[good.length - 1].dM), top + ph);
  ctx.lineTo(X(good[0].dM), top + ph);
  ctx.closePath();
  ctx.fillStyle = "rgba(214,228,242,.16)";
  ctx.fill();
  const z0 = good[0].zM * FT_PER_M;
  const z1 = good[good.length - 1].zM * FT_PER_M;
  const x0 = X(good[0].dM);
  const x1 = X(good[good.length - 1].dM);
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = "rgba(255,255,255,.7)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(x0, Y(z0));
  ctx.lineTo(x1, Y(z1));
  ctx.stroke();
  ctx.setLineDash([]);
  const grade = totFt ? ((z1 - z0) / totFt) * 100 : 0;
  ctx.fillStyle = "rgba(255,255,255,.82)";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText((grade >= 0 ? "+" : "") + grade.toFixed(2) + "%", (x0 + x1) / 2, (Y(z0) + Y(z1)) / 2 - 4);
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = "rgba(255,255,255,.28)";
  (state.vtxM || []).forEach((d, index) => {
    const px = Math.round(X(d)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, top);
    ctx.lineTo(px, top + ph);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(X(d), 11, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#14181f";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 11px Inter, system-ui, sans-serif";
    ctx.fillText(String(index + 1), X(d), 11.5);
    ctx.setLineDash([3, 3]);
    if (index > 0) {
      const a = state.vtxM[index - 1];
      const b = d;
      const za = pointAtDistance(samples, a);
      const zb = pointAtDistance(samples, b);
      if (za && zb && isLidarMeter(za.zM) && isLidarMeter(zb.zM) && X(b) - X(a) > 64) {
        const pct = ((zb.zM - za.zM) / (b - a)) * 100;
        ctx.font = "11px JetBrains Mono, ui-monospace, monospace";
        ctx.fillStyle = "rgba(255,255,255,.7)";
        ctx.fillText((pct >= 0 ? "+" : "") + pct.toFixed(2) + "%", X((a + b) / 2), 11.5);
      }
    }
  });
  ctx.setLineDash([]);
  if (hoverM != null) {
    const hit = pointAtDistance(samples, hoverM);
    if (hit && isLidarMeter(hit.zM)) {
      const hx = X(hit.dM);
      const hy = Y(hit.zM * FT_PER_M);
      ctx.strokeStyle = "rgba(255,255,255,.8)";
      ctx.beginPath();
      ctx.moveTo(Math.round(hx) + 0.5, top);
      ctx.lineTo(Math.round(hx) + 0.5, top + ph);
      ctx.stroke();
      ctx.fillStyle = "#e23b3b";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  canvas._geom = { left, pw, total };
}

function niceStep(span, target) {
  const raw = Math.max(span, 1e-6) / Math.max(1, target);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  const nice = r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10;
  return nice * mag;
}

function scrubChart(event) {
  const canvas = $("sl-profile-chart");
  if (!canvas || !canvas._geom || !state.samples) return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const dM = Math.max(0, Math.min(canvas._geom.total, ((x - canvas._geom.left) / canvas._geom.pw) * canvas._geom.total));
  drawChart(dM);
  const hit = pointAtDistance(state.samples, dM);
  const tip = $("sl-profile-tip");
  if (!hit || !isLidarMeter(hit.zM) || !tip) return;
  const distFt = dM * FT_PER_M;
  tip.hidden = false;
  tip.textContent = (hit.zM * FT_PER_M).toFixed(2) + " ft - " + Math.round(distFt).toLocaleString("en-US") + " ft";
  tip.style.left = Math.max(48, Math.min(rect.width - 48, x)) + "px";
  tip.style.top = "28px";
  moveScrub(hit);
}

function moveScrub(hit) {
  if (!state.map || !window.maplibregl) return;
  if (!state.scrub) {
    const el = document.createElement("div");
    el.className = "sl-scrub";
    state.scrub = new window.maplibregl.Marker({ element: el }).setLngLat([hit.lng, hit.lat]).addTo(state.map);
  } else state.scrub.setLngLat([hit.lng, hit.lat]);
}

async function loadPad() {
  if (state.pad.length < 3) return;
  const token = ++state.padToken;
  state.overrides = {};
  state.splits = [];
  state.drain = null;
  paintPadSummary();
  const sum = $("sl-terrain-padsum");
  if (sum) sum.textContent = "Reading USGS 3DEP for this pad.";
  const spec = buildGridSpec(state.pad, 140000);
  if (spec.width < 2 || spec.height < 2 || spec.width > 2000 || spec.height > 2000) {
    if (sum) sum.textContent = "Pad is too large for one lidar request. Draw a smaller pad.";
    return;
  }
  try {
    if (!window.Lerc) throw new Error("lerc");
    const url =
      SVC +
      "/exportImage?f=image&format=lerc&pixelType=F32&bboxSR=3857&imageSR=3857&interpolation=RSP_BilinearInterpolation&size=" +
      spec.width +
      "," +
      spec.height +
      "&bbox=" +
      [spec.minX, spec.minY, spec.maxX, spec.maxY].map((v) => v.toFixed(2)).join(",");
    const res = await fetch(url);
    if (!res.ok) throw new Error("http");
    const buf = await res.arrayBuffer();
    if (token !== state.padToken) return;
    const decoded = window.Lerc.decode(buf);
    if (decoded.width !== spec.width || decoded.height !== spec.height) throw new Error("size");
    const pix = decoded.pixels[0];
    const maskBit = decoded.mask;
    const elev = new Float32Array(pix.length);
    for (let i = 0; i < pix.length; i++) {
      const value = pix[i];
      elev[i] = maskBit && !maskBit[i] ? NaN : isLidarMeter(value) ? value : NaN;
    }
    const mask = maskGrid(spec, elev);
    if (mask.count < 10) throw new Error("empty");
    state.spec = spec;
    state.mask = mask;
    state.sec = mask.sec;
    state.smooth = smoothFeet(mask.ex, spec.width, spec.height);
    paintPadSummary();
    renderHeat();
    recomputeCut();
    if (!state.view) state.view = "elev";
    applyViewVisibility();
    const center = padCenter();
    if (center) refreshFlight(center[0], center[1]);
  } catch (err) {
    if (token !== state.padToken) return;
    if (sum) sum.textContent = err && err.message === "empty" ? "No lidar here. Elevation UNKNOWN." : "Could not read USGS 3DEP for this pad.";
  }
}

function padCenter() {
  if (state.pad.length < 3) return null;
  let x = 0;
  let y = 0;
  for (const p of state.pad) {
    x += p[0];
    y += p[1];
  }
  return [x / state.pad.length, y / state.pad.length];
}

function imageCoords() {
  const spec = state.spec;
  return [gridPointLngLat(spec, 0, 0), gridPointLngLat(spec, spec.width, 0), gridPointLngLat(spec, spec.width, spec.height), gridPointLngLat(spec, 0, spec.height)];
}

function upsertImage(id, canvas, opacity) {
  const map = state.map;
  if (!map) return;
  const url = canvas.toDataURL("image/png");
  const coordinates = imageCoords();
  if (!map.getSource(id)) {
    map.addSource(id, { type: "image", url, coordinates });
    const before = map.getLayer("sl-terrain-pad-line") ? "sl-terrain-pad-line" : undefined;
    map.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": opacity, "raster-fade-duration": 0 } }, before);
  } else map.getSource(id).updateImage({ url, coordinates });
}

function renderHeat() {
  const spec = state.spec;
  const smooth = state.smooth;
  const inside = state.mask.inside;
  const values = [];
  for (let i = 0; i < smooth.length; i += 2) if (inside[i] && smooth[i] === smooth[i]) values.push(smooth[i]);
  values.sort((a, b) => a - b);
  if (!values.length) return;
  let lo = values[Math.floor(values.length * 0.02)];
  let hi = values[Math.floor(values.length * 0.98)];
  if (!(hi > lo)) {
    lo -= 0.25;
    hi += 0.25;
  }
  state.heatRange = [lo, hi];
  const legLo = $("sl-terrain-leg-lo");
  const legHi = $("sl-terrain-leg-hi");
  if (legLo) legLo.textContent = lo.toFixed(1);
  if (legHi) legHi.textContent = hi.toFixed(1) + " (" + (hi * M_PER_FT).toFixed(1) + " m)";
  const canvas = document.createElement("canvas");
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(spec.width, spec.height);
  const out = image.data;
  const cellFt = spec.cell * FT_PER_M;
  const zf = 4 / (8 * cellFt);
  const at = (x, y, fallback) => {
    if (x < 0 || y < 0 || x >= spec.width || y >= spec.height) return fallback;
    const value = smooth[y * spec.width + x];
    return value === value ? value : fallback;
  };
  for (let y = 0; y < spec.height; y++) {
    for (let x = 0; x < spec.width; x++) {
      const i = y * spec.width + x;
      if (!inside[i] || smooth[i] !== smooth[i]) continue;
      const e = smooth[i];
      const gx = at(x + 1, y - 1, e) + 2 * at(x + 1, y, e) + at(x + 1, y + 1, e) - (at(x - 1, y - 1, e) + 2 * at(x - 1, y, e) + at(x - 1, y + 1, e));
      const gy = at(x - 1, y - 1, e) + 2 * at(x, y - 1, e) + at(x + 1, y - 1, e) - (at(x - 1, y + 1, e) + 2 * at(x, y + 1, e) + at(x + 1, y + 1, e));
      const nx = -gx * zf;
      const ny = -gy * zf;
      const light = 0.78 + 0.22 * Math.max(0, Math.min(1.3, (nx * -0.6 + ny * 0.6 + 0.5) / Math.hypot(nx, ny, 1) / 0.5));
      const col = rampColor(ELEV_STOPS, (e - lo) / (hi - lo));
      const o = i * 4;
      out[o] = Math.min(255, col[0] * light);
      out[o + 1] = Math.min(255, col[1] * light);
      out[o + 2] = Math.min(255, col[2] * light);
      out[o + 3] = 235;
    }
  }
  ctx.putImageData(image, 0, 0);
  state.heatCanvas = canvas;
  upsertImage("sl-terrain-heat", canvas, 0.92);
}

function recomputeCut() {
  if (!state.mask || !state.spec) return;
  const sec = state.sec || state.mask.sec;
  state.cut = analyzeCutFill({
    xs: state.mask.xs,
    ys: state.mask.ys,
    zs: state.mask.ex,
    sec,
    cellM: state.spec.cell,
    ratio: state.ratio,
    overrides: state.overrides,
  });
  renderCutStats();
  renderCutImage();
  if (state.view === "cut") renderContours();
}

function renderCutStats() {
  const host = $("sl-terrain-stats");
  if (!host || !state.cut) return;
  const t = state.cut.totals;
  const section = state.cut.sections.find((item) => item.id === selectedSection()) || state.cut.sections[0];
  if (section && $("sl-terrain-slope") && document.activeElement !== $("sl-terrain-slope")) $("sl-terrain-slope").value = section.slope.toFixed(3);
  if (section && $("sl-terrain-heading") && document.activeElement !== $("sl-terrain-heading")) $("sl-terrain-heading").value = section.heading.toFixed(1);
  const ratio = t.ratio == null ? "UNKNOWN" : t.ratio.toFixed(2);
  let html =
    '<div class="big"><div><span>CUT</span><b>' +
    Math.round(t.cutYd).toLocaleString("en-US") +
    '</b><span>yd3</span></div><div><span>FILL</span><b>' +
    Math.round(t.fillYd).toLocaleString("en-US") +
    "</b><span>yd3</span></div></div>" +
    "<dl><dt>Area</dt><dd>" +
    t.acres.toFixed(2) +
    " ac</dd><dt>Cut to fill</dt><dd>" +
    ratio +
    "</dd><dt>Max cut / fill</dt><dd>" +
    t.maxCutFt.toFixed(2) +
    " / " +
    t.maxFillFt.toFixed(2) +
    " ft</dd>";
  if (section) html += "<dt>Slope</dt><dd>" + section.slope.toFixed(3) + "% @ " + section.heading.toFixed(1) + " deg</dd>";
  html += "</dl>";
  if (state.cut.sections.length > 1) {
    html += '<div class="sl-drawbar">';
    html += state.cut.sections
      .map((s, index) => {
        const on = section && s.id === section.id ? " primary" : "";
        return (
          '<button type="button" class="sl-tbtn' +
          on +
          '" data-sec="' +
          s.id +
          '">S' +
          (index + 1) +
          " " +
          s.acres.toFixed(1) +
          " ac</button>"
        );
      })
      .join("");
    html += "</div>";
  }
  html += '<p class="sl-terrain-note">USGS 3DEP estimate. Verify with survey.</p>';
  host.innerHTML = html;
}

function renderCutImage() {
  if (!state.cut || !state.spec) return;
  const spec = state.spec;
  const sec = state.sec || state.mask.sec;
  const diffs = [];
  for (let i = 0; i < sec.length; i += 4) {
    if (sec[i] >= 0 && isLidarMeter(state.mask.ex[i]) && isLidarMeter(state.cut.design[i])) diffs.push(Math.abs(state.mask.ex[i] - state.cut.design[i]));
  }
  diffs.sort((a, b) => a - b);
  const rangeM = Math.max(0.05, diffs.length ? diffs[Math.floor(diffs.length * 0.95)] : 0.3);
  const canvas = document.createElement("canvas");
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(spec.width, spec.height);
  const out = image.data;
  for (let i = 0; i < sec.length; i++) {
    if (sec[i] < 0) continue;
    const d = state.mask.ex[i] - state.cut.design[i];
    const col = rampColor(CUT_STOPS, Math.max(0, Math.min(1, (d / rangeM + 1) / 2)));
    out[i * 4] = col[0];
    out[i * 4 + 1] = col[1];
    out[i * 4 + 2] = col[2];
    out[i * 4 + 3] = 230;
  }
  ctx.putImageData(image, 0, 0);
  state.cutCanvas = canvas;
  upsertImage("sl-terrain-cut", canvas, 0.88);
}

function renderContours() {
  if (!state.smooth || !state.spec || !state.cut) return;
  let interval = state.interval;
  const inside = state.mask.inside;
  let existing = traceContours(state.smooth, state.spec.width, state.spec.height, interval, inside);
  let guard = 0;
  while (existing.length > 4000 && interval < 4 && guard < 4) {
    interval *= 2;
    existing = traceContours(state.smooth, state.spec.width, state.spec.height, interval, inside);
    guard += 1;
  }
  const designFt = new Float32Array(state.cut.design.length);
  for (let i = 0; i < designFt.length; i++) designFt[i] = isLidarMeter(state.cut.design[i]) ? state.cut.design[i] * FT_PER_M : NaN;
  const design = traceContours(designFt, state.spec.width, state.spec.height, interval, inside);
  state.contours = { existing, design, interval };
  const features = [];
  const push = (lines, layer) => {
    for (const line of lines) {
      features.push({
        type: "Feature",
        properties: { layer, level: line.level },
        geometry: { type: "LineString", coordinates: line.pts.map((p) => gridPointLngLat(state.spec, p[0], p[1])) },
      });
    }
  };
  push(existing, "existing");
  push(design, "design");
  setGeo("sl-terrain-cont", { type: "FeatureCollection", features });
  const note = $("sl-terrain-cont-note");
  if (note) note.textContent = interval !== state.interval ? "Contours drawn at " + interval.toFixed(2) + " ft so the lines stay readable." : "";
  applyViewVisibility();
}

function renderDrainage() {
  if (!state.smooth || !state.spec || !state.mask) return;
  const note = $("sl-terrain-drain-note");
  if (note) {
    note.hidden = false;
    note.textContent = "Tracing drainage on the USGS 3DEP grid.";
  }
  window.setTimeout(() => {
    const drain = computeDrainage(state.smooth, state.spec.width, state.spec.height, state.mask.inside);
    const drawn = traceDrainage(state.spec, state.smooth, state.mask.inside, drain, state.drainMin);
    state.drain = drawn;
    setGeo("sl-terrain-drain", {
      type: "FeatureCollection",
      features: drawn.lines.map((line) => ({
        type: "Feature",
        properties: { width: line.width, tier: line.tier },
        geometry: { type: "LineString", coordinates: line.coords },
      })),
    });
    setGeo("sl-terrain-arrows", {
      type: "FeatureCollection",
      features: drawn.arrows.map((arrow) => ({
        type: "Feature",
        properties: { bearing: arrow.bearing },
        geometry: { type: "Point", coordinates: arrow.lnglat },
      })),
    });
    paintPonds(drain.pondFt);
    drawOutlets(drawn.outlets);
    if (note) {
      note.textContent =
        drawn.outlets.length +
        " outlets" +
        (drawn.pondAcres >= 0.05 ? " · standing water " + drawn.pondAcres.toFixed(1) + " ac" : " · no standing water") +
        ". " +
        ESTIMATE_NOTE;
    }
    applyViewVisibility();
  }, 30);
}

function paintPonds(pondFt) {
  const spec = state.spec;
  const canvas = document.createElement("canvas");
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(spec.width, spec.height);
  const out = image.data;
  for (let i = 0; i < pondFt.length; i++) {
    if (!(pondFt[i] > 0)) continue;
    out[i * 4] = 22;
    out[i * 4 + 1] = 104;
    out[i * 4 + 2] = 255;
    out[i * 4 + 3] = 210;
  }
  ctx.putImageData(image, 0, 0);
  upsertImage("sl-terrain-pond", canvas, 0.95);
}

function drawOutlets(outlets) {
  for (const marker of state.outlets) marker.remove();
  state.outlets = [];
  if (!state.map || !window.maplibregl) return;
  for (const ot of outlets) {
    const el = document.createElement("div");
    el.className = "sl-outlet";
    el.innerHTML = '<span class="sl-outlet-dot"></span><span class="sl-outlet-chip">' + esc(ot.label) + "</span>";
    const marker = new window.maplibregl.Marker({ element: el, anchor: "left" }).setLngLat(ot.lnglat).addTo(state.map);
    state.outlets.push(marker);
  }
}

function applySplit() {
  const pts = state.splitPts || [];
  state.splitPts = [];
  if (!state.spec || pts.length < 2) return;
  const cells = [];
  const toCell = (lnglat) => {
    const [x, y] = lngLatToMerc(lnglat[0], lnglat[1]);
    return [(x - state.spec.minX) / state.spec.cm - 0.5, (state.spec.maxY - y) / state.spec.cm - 0.5];
  };
  const extend = (from, to) => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    let x = to[0];
    let y = to[1];
    for (let k = 0; k < state.spec.width + state.spec.height; k++) {
      x += (dx / len) * 0.5;
      y += (dy / len) * 0.5;
      const ix = Math.round(x);
      const iy = Math.round(y);
      if (ix < 0 || iy < 0 || ix >= state.spec.width || iy >= state.spec.height) break;
      if (!state.mask.inside[iy * state.spec.width + ix]) break;
    }
    return [x, y];
  };
  const gp = pts.map(toCell);
  gp[0] = extend(gp[1], gp[0]);
  gp[gp.length - 1] = extend(gp[gp.length - 2], gp[gp.length - 1]);
  for (let s = 1; s < gp.length; s++) cells.push(...rasterSegment(state.spec.width, state.spec.height, gp[s - 1][0], gp[s - 1][1], gp[s][0], gp[s][1]));
  const sec = state.sec || state.mask.sec;
  const split = splitByBarrier(sec, state.spec.width, state.spec.height, cells);
  const note = $("sl-terrain-cont-note");
  if (!split.added) {
    if (note) note.textContent = "The split line has to cross the pad from one edge to the other.";
    syncPadLine();
    return;
  }
  state.sec = split.sec;
  state.overrides = {};
  state.splits.push(pts);
  syncPadLine();
  recomputeCut();
  setView("cut");
}

function clearPad(sync) {
  state.padToken += 1;
  state.pad = sync === false ? state.pad : [];
  state.mask = null;
  state.spec = null;
  state.cut = null;
  state.drain = null;
  state.sec = null;
  state.splits = [];
  state.view = "";
  state.contours = { existing: [], design: [] };
  for (const marker of state.outlets) marker.remove();
  state.outlets = [];
  if (sync !== false) {
    syncPadLine();
    redrawMarkers();
    setGeo("sl-terrain-drain", emptyFc());
    setGeo("sl-terrain-arrows", emptyFc());
    setGeo("sl-terrain-cont", emptyFc());
    const box = $("sl-terrain-padbox");
    if (box) box.hidden = true;
    const legend = $("sl-terrain-legend");
    if (legend) legend.hidden = true;
  }
}

function gridPoints(kind) {
  const spec = state.spec;
  const sec = state.sec || state.mask.sec;
  const step = Math.max(1, Math.round((10 * M_PER_FT) / spec.cell));
  const points = [];
  for (let j = 0; j < spec.height; j += step) {
    for (let i = 0; i < spec.width; i += step) {
      const idx = j * spec.width + i;
      if (sec[idx] < 0) continue;
      const ll = cellLngLat(spec, i, j);
      if (kind === "existing") {
        points.push({ lat: ll[1], lon: ll[0], existingFt: state.mask.ex[idx] * FT_PER_M });
      } else if (isLidarMeter(state.cut.design[idx])) {
        points.push({
          lat: ll[1],
          lon: ll[0],
          section: "S" + (sec[idx] + 1),
          designFt: state.cut.design[idx] * FT_PER_M,
          cutFillFt: (state.mask.ex[idx] - state.cut.design[idx]) * FT_PER_M,
        });
      }
    }
  }
  return points;
}

function saveGridCsv(kind) {
  if (!state.mask || (kind === "design" && !state.cut)) return;
  const csv = kind === "existing" ? existingCsv(gridPoints("existing")) : designCsv(gridPoints("design"));
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "siteline-" + kind + "-" + stamp() + ".csv");
}

function saveProfileCsv() {
  if (!state.samples) return;
  const csv = profileCsv(state.samples);
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "siteline-profile-" + stamp() + ".csv");
}

function exportOrigin() {
  return padCenter() || (state.profile[0] ? state.profile[0] : state.map ? [state.map.getCenter().lng, state.map.getCenter().lat] : [0, 0]);
}

function saveDxf() {
  const origin = exportOrigin();
  const polylines = [];
  if (state.pad.length >= 3) {
    polylines.push({ layer: "PAD", closed: true, pts: state.pad.map((p) => localFeet(origin, p[0], p[1])) });
  }
  for (const line of state.contours.existing || []) {
    polylines.push({ layer: "EXISTING_CONT", closed: false, pts: line.pts.map((p) => localFeet(origin, ...gridPointLngLat(state.spec, p[0], p[1]))) });
  }
  for (const line of state.contours.design || []) {
    polylines.push({ layer: "DESIGN_CONT", closed: false, pts: line.pts.map((p) => localFeet(origin, ...gridPointLngLat(state.spec, p[0], p[1]))) });
  }
  if (state.samples && state.samples.length > 1) {
    const pts = [];
    for (const sample of state.samples) {
      if (!isLidarMeter(sample.zM)) continue;
      pts.push([sample.dM * FT_PER_M, sample.zM * FT_PER_M]);
    }
    polylines.push({ layer: "PROFILE", closed: false, pts });
  }
  for (const line of (state.drain && state.drain.lines) || []) {
    polylines.push({ layer: "DRAINAGE", closed: false, pts: line.coords.map((p) => localFeet(origin, p[0], p[1])) });
  }
  const points = ((state.drain && state.drain.outlets) || []).map((ot) => ({
    layer: "OUTLETS",
    xy: localFeet(origin, ot.lnglat[0], ot.lnglat[1]),
    label: ot.label,
  }));
  const note =
    ESTIMATE_NOTE +
    " Plan layers are feet east and north of " +
    origin[1].toFixed(5) +
    ", " +
    origin[0].toFixed(5) +
    ". PROFILE is distance ft (X) and elevation ft (Y).";
  const dxf = buildDxf({ note, polylines, points });
  downloadBlob(new Blob([dxf], { type: "application/dxf" }), "siteline-terrain-" + stamp() + ".dxf");
}

function saveGeo() {
  const geo = terrainGeoJSON({
    pad: state.pad,
    profile: (state.samples || []).filter((p) => isLidarMeter(p.zM)).map((p) => [p.lng, p.lat, Number((p.zM * FT_PER_M).toFixed(3))]),
    drainage: (state.drain && state.drain.lines) || [],
    outlets: (state.drain && state.drain.outlets) || [],
  });
  downloadBlob(new Blob([JSON.stringify(geo)], { type: "application/geo+json" }), "siteline-terrain-" + stamp() + ".geojson");
}

async function savePdf() {
  if (!state.cut) return;
  const t = state.cut.totals;
  const section = state.cut.sections[0];
  const lines = [
    "Area " + t.acres.toFixed(2) + " ac",
    "Cut " + Math.round(t.cutYd).toLocaleString("en-US") + " yd3",
    "Fill " + Math.round(t.fillYd).toLocaleString("en-US") + " yd3",
    "Cut to fill " + (t.ratio == null ? "UNKNOWN" : t.ratio.toFixed(2)),
    "Max cut " + t.maxCutFt.toFixed(2) + " ft",
    "Max fill " + t.maxFillFt.toFixed(2) + " ft",
  ];
  if (section) lines.push("Best fit slope " + section.slope.toFixed(3) + "% heading " + section.heading.toFixed(1) + " deg");
  if (state.flight) lines.push(state.flight);
  lines.push(state.cut.sections.length + " section" + (state.cut.sections.length === 1 ? "" : "s"));
  let jpeg = null;
  const canvas = state.view === "cut" ? state.cutCanvas : state.heatCanvas;
  if (canvas) {
    const shot = document.createElement("canvas");
    const scale = Math.min(1, 720 / canvas.width, 420 / canvas.height);
    shot.width = Math.max(1, Math.round(canvas.width * scale));
    shot.height = Math.max(1, Math.round(canvas.height * scale));
    shot.getContext("2d").drawImage(canvas, 0, 0, shot.width, shot.height);
    const blob = await new Promise((resolve) => shot.toBlob(resolve, "image/jpeg", 0.82));
    if (blob) jpeg = { width: shot.width, height: shot.height, bytes: new Uint8Array(await blob.arrayBuffer()) };
  }
  const pdf = buildPdf({ title: "Siteline terrain", lines, jpeg });
  downloadBlob(new Blob([pdf], { type: "application/pdf" }), "siteline-terrain-" + stamp() + ".pdf");
}

function fitToView() {
  const map = state.map;
  if (!map) return;
  const b = map.getBounds();
  const counts = new Map();
  for (const [key, tile] of elevCache) {
    if (!tile || typeof tile.then === "function" || !tile.elev) continue;
    const zz = Number(key.split("/")[0]);
    counts.set(zz, (counts.get(zz) || 0) + 1);
  }
  let z = Math.max(10, Math.min(16, Math.round(map.getZoom())));
  let best = -1;
  for (const [zz, count] of counts) {
    if (count > best) {
      best = count;
      z = zz;
    }
  }
  const vals = [];
  for (const [key, tile] of elevCache) {
    if (!tile || typeof tile.then === "function" || !tile.elev) continue;
    const parts = key.split("/").map(Number);
    if (parts[0] !== z) continue;
    const west = (parts[1] / 2 ** z) * 360 - 180;
    const east = ((parts[1] + 1) / 2 ** z) * 360 - 180;
    if (east < b.getWest() || west > b.getEast()) continue;
    const elev = tile.elev;
    for (let i = 0; i < elev.length; i += 17) if (isLidarMeter(elev[i])) vals.push(elev[i] * FT_PER_M);
  }
  if (vals.length < 20) {
    const hint = $("sl-terrain-hint");
    if (hint) {
      hint.hidden = false;
      hint.textContent = "Raise lidar opacity and wait for tiles, then fit the color range again.";
    }
    return;
  }
  vals.sort((a, c) => a - c);
  const hint = $("sl-terrain-hint");
  if (hint && !state.draw) hint.hidden = true;
  state.minFt = Math.floor(vals[Math.floor(vals.length * 0.02)]);
  state.maxFt = Math.ceil(vals[Math.floor(vals.length * 0.98)]);
  if (!(state.maxFt > state.minFt)) state.maxFt = state.minFt + 1;
  syncControls();
  bumpTiles();
  saveStore();
}

function monthYear(ms) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
}

async function refreshFlight(lon, lat) {
  const chip = $("sl-lidar-flown");
  if (!chip) return;
  chip.hidden = false;
  try {
    const url =
      FLIGHT +
      "?f=json&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=collect_start,collect_end,ql,project&returnGeometry=false&geometry=" +
      lon.toFixed(5) +
      "," +
      lat.toFixed(5);
    const res = await fetch(url);
    if (!res.ok) throw new Error("flight");
    const json = await res.json();
    const rows = (json.features || []).map((f) => f.attributes).filter((a) => a && a.collect_end);
    if (!rows.length) throw new Error("empty");
    rows.sort((a, b) => b.collect_end - a.collect_end);
    const row = rows[0];
    const start = monthYear(row.collect_start);
    const end = monthYear(row.collect_end);
    let text = "Lidar flown " + (start || end || "UNKNOWN");
    if (start && end && start !== end) text = "Lidar flown " + start + " to " + end;
    if (row.ql) text += " · " + row.ql;
    state.flight = text;
    chip.textContent = text;
  } catch {
    state.flight = "";
    chip.textContent = "Lidar flight date UNKNOWN";
  }
}

function onMoveEnd() {
  window.clearTimeout(state.flightTimer);
  state.flightTimer = window.setTimeout(() => {
    if (!state.map) return;
    const c = state.map.getCenter();
    refreshFlight(c.lng, c.lat);
  }, 500);
}

function onKey(event) {
  if (!state.draw) return;
  const tag = event.target && event.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    cancelDraw();
  } else if (event.key === "Enter") {
    event.preventDefault();
    finishDraw();
  } else if (event.key === "Backspace" || event.key === "z") {
    event.preventDefault();
    undoVertex();
  }
}

function attach(map) {
  if (!map || state.map === map) return;
  state.map = map;
  registerProtocol();
  const boot = () => {
    ensureRaster();
    map.on("mousemove", onHover);
    map.on("moveend", onMoveEnd);
    const canvas = map.getCanvas();
    canvas.addEventListener("click", onCanvasClick, true);
    canvas.addEventListener("dblclick", onCanvasDbl, true);
    map.on("dblclick", (event) => {
      if (!state.draw) return;
      event.preventDefault();
      onCanvasDbl({ preventDefault() {}, stopPropagation() {} });
    });
    onMoveEnd();
  };
  if (map.loaded && map.loaded()) boot();
  else map.once("load", boot);
  map.on("styledata", () => {
    if (map.getStyle?.() && !map.getLayer("sl-3dep")) {
      arrowReady = false;
      ensureRaster();
    }
  });
}

function boot() {
  loadStore();
  mountChrome();
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", () => {
    if (state.samples && $("sl-profile") && !$("sl-profile").hidden) drawChart(null);
  });
  if (window.__SITELINE_MAP__) attach(window.__SITELINE_MAP__);
  window.addEventListener("siteline-map-ready", (event) => attach(event.detail || window.__SITELINE_MAP__));
  window.addEventListener("siteline-map-created", (event) => attach(event.detail || window.__SITELINE_MAP__));
  const obs = new MutationObserver(() => {
    mountChrome();
    if (window.__SITELINE_MAP__) attach(window.__SITELINE_MAP__);
  });
  obs.observe(document.body, { childList: true, subtree: true });
  window.__slTerrain = {
    state,
    setOpacity(value) {
      state.opacity = value;
      syncControls();
      applyOpacity();
    },
    setMode(mode) {
      state.mode = mode;
      syncControls();
      bumpTiles();
    },
    fitToView,
    formatReadout,
  };
}

boot();

/**
 * Layer tray groups, shared color tokens, and HIFLD retail service territories.
 * Tokens live on :root in siteline.css. Map paint reads the same variables.
 */
import {
  TERRITORY_QUERY,
  TERRITORY_SOURCE_NOTE,
  esriPolygonsToCollection,
  utilitySummary,
} from "./layer-territory.mjs";

const TERRITORY_LAYER = "sl-util-territory";
const TERRITORY_SRC = "sl-util-territory-src";
const EMPTY = { type: "FeatureCollection", features: [] };

const REACT_LABELS = {
  transmission: "Transmission (HIFLD)",
  substations: "Substations (HIFLD)",
  plants: "Generation (EIA plants)",
  broadband: "FCC BDC availability",
  water: "NHD hydrography",
  orphaned: "NETL orphaned",
  operating: "NETL Active",
  nmWells: "NM OCD Active",
  coWells: "CO OGCC PR",
  flood: "FEMA flood",
  topo: "USA topography",
  datacenters: "OSM data centers",
};

function token(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function colors() {
  return {
    power: token("--sl-c-power", "#f0b429"),
    powerHi: token("--sl-c-power-hi", "#ffe7a3"),
    powerLo: token("--sl-c-power-lo", "#c4841d"),
    powerUnknown: token("--sl-c-power-unknown", "#b7a48a"),
    util: token("--sl-c-util", "#2dd4bf"),
    fiber: token("--sl-c-fiber", "#a78bfa"),
    fiberDim: token("--sl-c-fiber-dim", "#6d5cae"),
    water: token("--sl-c-water", "#38bdf8"),
    waterFill: token("--sl-c-water-fill", "#0ea5e9"),
    gas: token("--sl-c-gas", "#f97316"),
    oil: token("--sl-c-oil", "#a16207"),
    well: token("--sl-c-well", "#a8a29e"),
    hazard: token("--sl-c-hazard", "#fb7185"),
    context: token("--sl-c-context", "#e7e5e4"),
    contextMuted: token("--sl-c-context-muted", "#a3a3a3"),
  };
}

function legend(kind, varName) {
  const span = document.createElement("span");
  span.className = "sl-legend sl-legend-" + kind;
  span.style.setProperty("--swatch", "var(" + varName + ")");
  span.setAttribute("aria-hidden", "true");
  return span;
}

function reactCheckbox(label) {
  const names = document.querySelectorAll("#layer-panel .layer-name");
  for (const span of names) {
    if ((span.textContent || "").trim() === label) {
      return span.closest("label")?.querySelector("input[type='checkbox']") || null;
    }
  }
  return null;
}

function rowFromExisting(id, label, kind, varName) {
  const input = document.getElementById(id);
  const row = input?.closest(".sl-tray-row");
  if (!row) return null;
  const text = row.querySelector("span:last-of-type");
  if (text && label) text.textContent = label;
  row.querySelectorAll(".swatch, .sl-legend").forEach((node) => node.remove());
  const box = row.querySelector("input");
  box?.insertAdjacentElement("afterend", legend(kind, varName));
  return row;
}

function makeRow(id, label, kind, varName, checked) {
  const row = document.createElement("label");
  row.className = "sl-tray-row";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  input.checked = !!checked;
  row.append(input, legend(kind, varName));
  const text = document.createElement("span");
  text.textContent = label;
  row.append(text);
  return row;
}

function bindReact(input, reactKey) {
  const label = REACT_LABELS[reactKey];
  const pull = () => {
    const remote = reactCheckbox(label);
    if (!remote || input.dataset.syncing === "1") return;
    if (input.checked === remote.checked) return;
    input.dataset.syncing = "1";
    input.checked = remote.checked;
    input.dataset.syncing = "0";
  };
  input.addEventListener("change", () => {
    if (input.dataset.syncing === "1") return;
    const remote = reactCheckbox(label);
    if (!remote || remote.checked === input.checked) return;
    remote.click();
  });
  pull();
  return pull;
}

function note(text) {
  const p = document.createElement("p");
  p.className = "sl-layer-note";
  p.textContent = text;
  return p;
}

function section(def, pulls) {
  const sec = document.createElement("section");
  sec.className = "sl-layer-sec";
  sec.dataset.group = def.id;
  const head = document.createElement("button");
  head.type = "button";
  head.className = "sl-layer-sec-h";
  head.setAttribute("aria-expanded", "true");
  head.append(legend(def.legend || "line", def.swatch));
  const title = document.createElement("span");
  title.className = "sl-layer-sec-title";
  title.textContent = def.title;
  const count = document.createElement("span");
  count.className = "sl-layer-sec-count";
  count.textContent = "0 on";
  head.append(title, count);
  head.addEventListener("click", () => {
    const closed = sec.classList.toggle("is-closed");
    head.setAttribute("aria-expanded", closed ? "false" : "true");
  });
  const body = document.createElement("div");
  body.className = "sl-layer-sec-body";
  for (const item of def.rows) {
    let row = null;
    if (item.existing) row = rowFromExisting(item.existing, item.label, item.legend, item.swatch);
    if (!row) row = makeRow(item.id, item.label, item.legend, item.swatch, item.checked);
    if (item.unknown) {
      row.classList.add("is-unknown");
      const input = row.querySelector("input");
      input.disabled = true;
      input.checked = false;
    }
    if (item.react) {
      const input = row.querySelector("input");
      pulls.push(bindReact(input, item.react));
    }
    body.append(row);
    if (item.note) body.append(note(item.note));
  }
  sec.append(head, body);
  return sec;
}

function updateCounts() {
  document.querySelectorAll("#sl-layer-groups .sl-layer-sec").forEach((sec) => {
    const boxes = [...sec.querySelectorAll("input[type='checkbox']")].filter((input) => !input.disabled);
    const on = boxes.filter((input) => input.checked).length;
    const count = sec.querySelector(".sl-layer-sec-count");
    if (count) count.textContent = on + " on";
  });
}

function buildGroups() {
  const pane = document.querySelector("#sl-pane-layers");
  if (!pane || pane.dataset.slGrouped === "1") return false;
  if (!document.getElementById("sl-well-gas") || !document.getElementById("oim-power-toggle")) return false;
  if (!reactCheckbox(REACT_LABELS.transmission)) return false;

  const c = colors();
  const pulls = [];
  const groups = document.createElement("div");
  groups.id = "sl-layer-groups";
  const defs = [
    {
      id: "power",
      title: "Power",
      swatch: "--sl-c-power",
      legend: "line",
      rows: [
        { id: "sl-tx", label: "Transmission", legend: "line", swatch: "--sl-c-power", react: "transmission", note: "Brighter and thicker at higher kV. Grey-amber when kV is missing." },
        { id: "sl-subs", label: "Substations", legend: "circle", swatch: "--sl-c-power", react: "substations" },
        { id: "sl-plants", label: "Plants", legend: "circle", swatch: "--sl-c-power-hi", react: "plants", note: "EIA catalog nameplate. Not live output. Heavy stroke, distinct from substation dots." },
        { existing: "oim-power-toggle", label: "OIM power lines and substations", legend: "line", swatch: "--sl-c-power" },
      ],
    },
    {
      id: "utilities",
      title: "Utilities",
      swatch: "--sl-c-util",
      legend: "fill",
      rows: [
        {
          id: "sl-territory-toggle",
          label: "Electric retail service territories",
          legend: "fill",
          swatch: "--sl-c-util",
          checked: false,
          note: TERRITORY_SOURCE_NOTE,
        },
      ],
    },
    {
      id: "fiber",
      title: "Fiber and broadband",
      swatch: "--sl-c-fiber",
      legend: "dash",
      rows: [
        { id: "sl-bdc", label: "FCC broadband", legend: "fill", swatch: "--sl-c-fiber", react: "broadband", note: "Brighter violet where fiber-served locations are reported." },
        { existing: "oim-telecom-toggle", label: "OIM telecom", legend: "line", swatch: "--sl-c-fiber" },
        { existing: "sl-subsea-toggle", label: "Subsea cables", legend: "dash", swatch: "--sl-c-fiber" },
      ],
    },
    {
      id: "water",
      title: "Water",
      swatch: "--sl-c-water",
      legend: "line",
      rows: [
        { id: "sl-water", label: "NHD flowlines and waterbodies", legend: "line", swatch: "--sl-c-water", react: "water" },
      ],
    },
    {
      id: "wells",
      title: "Oil and gas wells",
      swatch: "--sl-c-gas",
      legend: "circle",
      rows: [
        { existing: "sl-well-gas", label: "Natural gas wells", legend: "circle", swatch: "--sl-c-gas" },
        { existing: "sl-well-oil", label: "Oil wells", legend: "circle", swatch: "--sl-c-oil" },
        { existing: "sl-well-mixed", label: "Mixed oil and gas", legend: "circle", swatch: "--sl-c-well" },
        { existing: "sl-well-other", label: "Other or unknown", legend: "circle", swatch: "--sl-c-well" },
        { id: "sl-orphan", label: "NETL orphaned", legend: "ring", swatch: "--sl-c-well", react: "orphaned", note: "Hollow ring. Commodity is not confirmed on this catalog." },
        { id: "sl-operating", label: "NETL operating", legend: "circle", swatch: "--sl-c-well", react: "operating" },
        { id: "sl-nm", label: "NM OCD wells", legend: "square", swatch: "--sl-c-well", react: "nmWells" },
        { id: "sl-co", label: "CO OGCC wells", legend: "diamond", swatch: "--sl-c-well", react: "coWells" },
        { existing: "sl-gas-toggle", label: "Natural gas pipelines", legend: "dash", swatch: "--sl-c-gas", note: "EIA pipeline catalog. Not wellbores and not capacity." },
      ],
    },
    {
      id: "hazards",
      title: "Hazards",
      swatch: "--sl-c-hazard",
      legend: "fill",
      rows: [
        { id: "sl-flood", label: "FEMA flood", legend: "fill", swatch: "--sl-c-hazard", react: "flood" },
        { id: "sl-whp", label: "WHP wildfire", legend: "fill", swatch: "--sl-c-hazard", unknown: true, note: "UNKNOWN. Not wired. No wildfire layer is attached." },
      ],
    },
    {
      id: "context",
      title: "Base and context",
      swatch: "--sl-c-context",
      legend: "line",
      rows: [
        { id: "sl-topo", label: "USA topography", legend: "fill", swatch: "--sl-c-context", react: "topo" },
        { existing: "sl-contour-toggle", label: "Contours", legend: "line", swatch: "--sl-c-context-muted" },
        { id: "sl-dc", label: "OSM data centers", legend: "circle", swatch: "--sl-c-context", react: "datacenters" },
      ],
    },
  ];
  for (const def of defs) groups.append(section(def, pulls));
  const status = document.getElementById("oim-status");
  pane.append(groups);
  if (status) pane.append(status);
  pane.querySelectorAll(":scope > .sl-tray-label, :scope > .sl-tray-note, :scope > .sl-honesty-chip, #sl-well-toggles").forEach((node) => {
    if (!groups.contains(node)) node.remove();
  });
  pane.dataset.slGrouped = "1";
  pane.addEventListener("change", updateCounts);
  const panel = document.getElementById("layer-panel");
  if (panel) {
    const obs = new MutationObserver(() => {
      pulls.forEach((pull) => pull());
      updateCounts();
    });
    obs.observe(panel, { subtree: true, attributes: true, childList: true });
  }
  updateCounts();
  void c;
  return true;
}

function setIf(map, id, prop, value) {
  if (!map.getLayer?.(id)) return;
  try {
    map.setPaintProperty(id, prop, value);
  } catch (_) {}
}

function commodityColor(c) {
  return [
    "match",
    ["get", "commodity_group"],
    "gas",
    c.gas,
    "oil",
    c.oil,
    "mixed",
    c.well,
    c.well,
  ];
}

function addMark(map, id, sourceLayer, image) {
  if (!map.getSource(sourceLayer.replace("src-", "src-")) && !map.getSource(sourceLayer)) return;
  if (map.getLayer(id)) return;
  const source = sourceLayer;
  if (!map.getSource(source)) return;
  map.addLayer({
    id,
    type: "circle",
    source,
    paint: {
      "circle-radius": 4,
      "circle-color": "rgba(0,0,0,0)",
      "circle-stroke-width": 0,
      "circle-opacity": 0,
    },
  });
  void image;
}

function squareLayer(map, id, source, kind, color) {
  if (!map.getSource(source) || map.getLayer(id)) return;
  const imageId = "sl-mark-" + kind;
  if (!map.hasImage(imageId)) {
    const canvas = document.createElement("canvas");
    canvas.width = 18;
    canvas.height = 18;
    const g = canvas.getContext("2d");
    g.fillStyle = color;
    g.strokeStyle = "#14120e";
    g.lineWidth = 2;
    if (kind === "diamond") {
      g.beginPath();
      g.moveTo(9, 2);
      g.lineTo(16, 9);
      g.lineTo(9, 16);
      g.lineTo(2, 9);
      g.closePath();
      g.fill();
      g.stroke();
    } else {
      g.fillRect(3, 3, 12, 12);
      g.strokeRect(3, 3, 12, 12);
    }
    map.addImage(imageId, canvas.getContext("2d").getImageData(0, 0, 18, 18), { pixelRatio: 2 });
  }
  map.addLayer({
    id,
    type: "symbol",
    source,
    layout: { "icon-image": imageId, "icon-size": 0.85, "icon-allow-overlap": true },
  });
}

let painting = false;

function applyPaint(map) {
  if (painting) return;
  painting = true;
  try {
    applyPaintNow(map);
  } finally {
    painting = false;
  }
}

function applyPaintNow(map) {
  const c = colors();
  const volt = ["to-number", ["coalesce", ["get", "VOLTAGE"], 0]];
  setIf(map, "hifld-tx", "line-color", [
    "case",
    ["<=", volt, 0],
    c.powerUnknown,
    ["interpolate", ["linear"], volt, 69, c.powerLo, 138, c.power, 230, c.powerHi, 500, c.powerHi],
  ]);
  setIf(map, "hifld-tx", "line-width", [
    "interpolate",
    ["linear"],
    volt,
    0,
    1.15,
    69,
    1.6,
    138,
    2.2,
    230,
    2.9,
    345,
    3.5,
    500,
    4.3,
  ]);
  setIf(map, "hifld-tx", "line-opacity", 0.92);
  setIf(map, "hifld-subs", "circle-color", c.power);
  setIf(map, "hifld-subs", "circle-stroke-color", "#1c1408");
  setIf(map, "eia-plants", "circle-color", c.powerHi);
  setIf(map, "eia-plants", "circle-stroke-width", 2.4);
  setIf(map, "eia-plants", "circle-stroke-color", "#1c1408");
  setIf(map, "fcc-bdc", "fill-color", [
    "case",
    [">", ["coalesce", ["get", "ServedBSLsFiber"], 0], 0],
    c.fiber,
    [">", ["coalesce", ["get", "ServedBSLs"], 0], 0],
    c.fiberDim,
    "#3a3358",
  ]);
  setIf(map, "fcc-bdc", "fill-opacity", 0.3);
  setIf(map, "fcc-bdc", "fill-outline-color", c.fiber);
  setIf(map, "nhd-flowline", "line-color", c.water);
  setIf(map, "nhd-waterbody", "fill-color", c.waterFill);
  setIf(map, "nhd-waterbody", "fill-opacity", 0.22);
  setIf(map, "fema-flood", "fill-color", c.hazard);
  setIf(map, "fema-flood", "fill-opacity", 0.32);
  setIf(map, "osm-datacenters", "circle-color", c.context);
  setIf(map, "osm-datacenters", "circle-stroke-color", "#141414");
  setIf(map, "netl-orphaned", "circle-color", "rgba(0,0,0,0)");
  setIf(map, "netl-orphaned", "circle-opacity", 0);
  setIf(map, "netl-orphaned", "circle-stroke-color", c.well);
  setIf(map, "netl-orphaned", "circle-stroke-width", 1.8);
  setIf(map, "netl-operating", "circle-color", c.well);
  setIf(map, "netl-operating", "circle-stroke-color", "#14120e");
  setIf(map, "nm-ocd-wells", "circle-opacity", 0);
  setIf(map, "nm-ocd-wells", "circle-stroke-opacity", 0);
  setIf(map, "co-ogcc-wells", "circle-opacity", 0);
  setIf(map, "co-ogcc-wells", "circle-stroke-opacity", 0);
  squareLayer(map, "sl-nm-mark", "src-nm", "square", c.well);
  squareLayer(map, "sl-co-mark", "src-co", "diamond", c.well);
  const oimKv = [
    "case",
    [">", ["to-number", ["coalesce", ["get", "voltage"], 0]], 2000],
    ["/", ["to-number", ["coalesce", ["get", "voltage"], 0]], 1000],
    ["to-number", ["coalesce", ["get", "voltage"], 0]],
  ];
  const oimColor = [
    "case",
    ["<=", oimKv, 0],
    c.powerUnknown,
    ["interpolate", ["linear"], oimKv, 69, c.powerLo, 138, c.power, 230, c.powerHi, 500, c.powerHi],
  ];
  setIf(map, "siteline-oim-power-line", "line-color", oimColor);
  setIf(map, "siteline-oim-power-sub", "circle-color", c.power);
  setIf(map, "siteline-oim-telecom-line", "line-color", c.fiber);
  setIf(map, "siteline-oim-telecom-mast", "circle-color", c.fiber);
  setIf(map, "siteline-oim-subsea-line", "line-color", c.fiber);
  setIf(map, "siteline-oim-subsea-line", "line-dasharray", [2, 1.2]);
  setIf(map, "sl-gas-lines", "line-color", c.gas);
  setIf(map, "sl-gas-lines", "line-dasharray", [1.4, 1.1]);
  setIf(map, "sl-gas-detail-lines", "line-color", c.gas);
  setIf(map, "sl-gas-detail-lines", "line-dasharray", [1.4, 1.1]);
  setIf(map, "sl-contour-lines", "line-color", c.contextMuted);
  const wellColor = commodityColor(c);
  setIf(map, "sl-wells-pt", "circle-color", wellColor);
  setIf(map, "sl-wells-pt", "circle-stroke-color", wellColor);
  setIf(map, "sl-wells-pt", "circle-opacity", ["case", ["==", ["get", "status_code"], "orphan"], 0, 0.92]);
  setIf(map, "sl-wells-pt", "circle-stroke-width", ["case", ["==", ["get", "status_code"], "orphan"], 2, 1.1]);
  setIf(map, "sl-wells-cluster", "circle-color", c.well);
  syncMarks(map);
  void addMark;
}

function syncMarks(map) {
  const follow = (mark, host) => {
    if (!map.getLayer(mark) || !map.getLayer(host)) return;
    const visible = map.getLayoutProperty(host, "visibility") !== "none";
    map.setLayoutProperty(mark, "visibility", visible ? "visible" : "none");
  };
  follow("sl-nm-mark", "nm-ocd-wells");
  follow("sl-co-mark", "co-ogcc-wells");
}

function ensureTerritory(map) {
  if (!map.getSource(TERRITORY_SRC)) {
    map.addSource(TERRITORY_SRC, { type: "geojson", data: EMPTY });
  }
  if (!map.getLayer(TERRITORY_LAYER)) {
    const before = map.getLayer("hifld-tx") ? "hifld-tx" : undefined;
    const c = colors();
    map.addLayer(
      {
        id: TERRITORY_LAYER,
        type: "fill",
        source: TERRITORY_SRC,
        minzoom: 5,
        layout: { visibility: "none" },
        paint: {
          "fill-color": c.util,
          "fill-opacity": 0.08,
          "fill-outline-color": c.util,
        },
      },
      before,
    );
    map.addLayer(
      {
        id: TERRITORY_LAYER + "-line",
        type: "line",
        source: TERRITORY_SRC,
        minzoom: 5,
        layout: { visibility: "none" },
        paint: { "line-color": c.util, "line-width": 1.4, "line-opacity": 0.9 },
      },
      before,
    );
  }
}

let territoryToken = 0;

async function loadTerritory(map) {
  const box = map.getBounds();
  const zoom = map.getZoom();
  const offset = zoom < 7 ? 0.08 : zoom < 9 ? 0.02 : 0.005;
  const params = new URLSearchParams({
    where: "1=1",
    geometry: JSON.stringify({
      xmin: box.getWest(),
      ymin: box.getSouth(),
      xmax: box.getEast(),
      ymax: box.getNorth(),
      spatialReference: { wkid: 4326 },
    }),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "NAME,TYPE,STATE,CITY,ID",
    returnGeometry: "true",
    outSR: "4326",
    maxAllowableOffset: String(offset),
    resultRecordCount: "400",
    f: "json",
  });
  const token = ++territoryToken;
  const response = await fetch(TERRITORY_QUERY + "?" + params.toString());
  if (!response.ok) throw new Error("territory " + response.status);
  const json = await response.json();
  if (json.error) throw new Error(json.error.message || "territory query failed");
  if (token !== territoryToken) return;
  const data = esriPolygonsToCollection(json);
  map.getSource(TERRITORY_SRC)?.setData(data);
}

function territoryVisible(map) {
  return map.getLayoutProperty(TERRITORY_LAYER, "visibility") !== "none";
}

function setTerritoryVisible(map, on) {
  const value = on ? "visible" : "none";
  if (map.getLayer(TERRITORY_LAYER)) map.setLayoutProperty(TERRITORY_LAYER, "visibility", value);
  if (map.getLayer(TERRITORY_LAYER + "-line")) map.setLayoutProperty(TERRITORY_LAYER + "-line", "visibility", value);
  if (on && map.getZoom() >= 5) {
    loadTerritory(map).catch(() => {
      map.getSource(TERRITORY_SRC)?.setData(EMPTY);
    });
  }
}

function popupHtml(summary) {
  return (
    "<strong>" +
    escapeHtml(summary.name) +
    "</strong><br>Type: " +
    escapeHtml(summary.type) +
    "<br>Source: HIFLD retail service territories"
  );
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function queryUtilityAt(lng, lat) {
  const params = new URLSearchParams({
    where: "1=1",
    geometry: lng + "," + lat,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "NAME,TYPE",
    returnGeometry: "false",
    resultRecordCount: "8",
    f: "json",
  });
  const response = await fetch(TERRITORY_QUERY + "?" + params.toString());
  if (!response.ok) return null;
  const json = await response.json();
  if (json.error || !Array.isArray(json.features)) return null;
  return json.features.map((row) => utilitySummary(row.attributes));
}

let pinKey = "";
let pendingPin = null;

function readPin() {
  if (pendingPin) return pendingPin;
  const body = document.querySelector(".brief-body");
  const coord = body && [...body.querySelectorAll(".brief-row")].find((row) =>
    /coordinates/i.test(row.querySelector("span")?.textContent || ""),
  );
  const raw = coord?.querySelector("strong")?.textContent || "";
  const match = raw.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (!match) return null;
  return { lat: Number(match[1]), lng: Number(match[2]) };
}

function upsertBriefRow(body, label, value) {
  let row = [...body.querySelectorAll(".brief-row")].find((node) => node.dataset.slUtil === label);
  if (!row) {
    row = document.createElement("div");
    row.className = "brief-row";
    row.dataset.slUtil = label;
    const span = document.createElement("span");
    span.textContent = label;
    const strong = document.createElement("strong");
    row.append(span, strong);
    const grid = [...body.querySelectorAll(".section-label")].find((node) => /grid/i.test(node.textContent || ""));
    let anchor = grid;
    if (grid) {
      let node = grid.nextElementSibling;
      while (node && !node.classList.contains("section-label")) {
        anchor = node;
        node = node.nextElementSibling;
      }
    }
    if (anchor) anchor.insertAdjacentElement("afterend", row);
    else body.append(row);
  }
  const strong = row.querySelector("strong");
  if (strong && strong.textContent !== value) strong.textContent = value;
}

async function fillUtilityCard() {
  const panel = document.querySelector(".brief-panel");
  const body = panel?.querySelector(".brief-body");
  if (!body) return;
  const pin = readPin();
  if (!pin) {
    upsertBriefRow(body, "Serving utility", "UNKNOWN");
    upsertBriefRow(body, "Utility type", "UNKNOWN");
    upsertBriefRow(body, "Territory source", "UNKNOWN");
    return;
  }
  const lat = pin.lat;
  const lng = pin.lng;
  const key = lat.toFixed(5) + "," + lng.toFixed(5);
  if (pinKey === key && body.querySelector("[data-sl-util='Serving utility']")) return;
  pinKey = key;
  let hits = null;
  try {
    hits = await queryUtilityAt(lng, lat);
  } catch (_) {
    hits = null;
  }
  if (pinKey !== key) return;
  if (!hits) {
    upsertBriefRow(body, "Serving utility", "UNKNOWN");
    upsertBriefRow(body, "Utility type", "UNKNOWN");
    upsertBriefRow(body, "Territory source", "UNKNOWN");
    return;
  }
  if (!hits.length) {
    upsertBriefRow(body, "Serving utility", "UNKNOWN");
    upsertBriefRow(body, "Utility type", "UNKNOWN");
    upsertBriefRow(body, "Territory source", "HIFLD retail service territories");
    return;
  }
  upsertBriefRow(body, "Serving utility", hits.map((hit) => hit.name).join("; "));
  upsertBriefRow(body, "Utility type", hits.map((hit) => hit.type).join("; "));
  upsertBriefRow(body, "Territory source", "HIFLD retail service territories");
}

function bindTerritory(map) {
  const input = document.getElementById("sl-territory-toggle");
  if (!input || input.dataset.bound === "1") return;
  input.dataset.bound = "1";
  input.addEventListener("change", () => {
    setTerritoryVisible(map, input.checked);
    updateCounts();
  });
  map.on("moveend", () => {
    syncMarks(map);
    if (!territoryVisible(map) || map.getZoom() < 5) return;
    loadTerritory(map).catch(() => {});
  });
  map.on("click", (event) => {
    if (event.lngLat) {
      pendingPin = { lng: event.lngLat.lng, lat: event.lngLat.lat };
      pinKey = "";
      fillUtilityCard().catch(() => {});
    }
    if (!territoryVisible(map)) return;
    const pointHits = map.queryRenderedFeatures(event.point, {
      layers: ["osm-datacenters", "eia-plants", "hifld-subs", "sl-wells-pt", "sl-wells-cluster"].filter((id) => map.getLayer(id)),
    });
    if (pointHits.length) return;
    const hits = map.queryRenderedFeatures(event.point, { layers: [TERRITORY_LAYER] });
    if (!hits[0] || !window.maplibregl?.Popup) return;
    const summary = utilitySummary(hits[0].properties);
    new window.maplibregl.Popup({ closeButton: true, maxWidth: "280px" })
      .setLngLat(event.lngLat)
      .setHTML(popupHtml(summary))
      .addTo(map);
  });
}

function bootMap(map) {
  if (!map || map.__slLayers) return;
  const run = () => {
    try {
      ensureTerritory(map);
      applyPaint(map);
      buildGroups();
      bindTerritory(map);
    } catch (err) {
      console.warn("[siteline-layers]", err);
    }
  };
  map.__slLayers = true;
  if (map.isStyleLoaded?.()) run();
  map.on?.("idle", run);
  map.on?.("styledata", () => {
    try {
      applyPaint(map);
      syncMarks(map);
    } catch (err) {
      console.warn("[siteline-layers] paint", err);
    }
  });
}

function boot() {
  const tryAll = () => {
    buildGroups();
    const map = window.__SITELINE_MAP__;
    if (map) bootMap(map);
  };
  window.addEventListener("siteline-map-ready", (event) => bootMap(event.detail || window.__SITELINE_MAP__));
  window.addEventListener("siteline-map-created", (event) => bootMap(event.detail || window.__SITELINE_MAP__));
  const obs = new MutationObserver(() => {
    tryAll();
    fillUtilityCard().catch(() => {});
  });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  tryAll();
}

boot();

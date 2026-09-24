/** Browse vs Inspect. Pure helpers so the dock can be tested without a map. */

export const LAYER_FACTS = {
  "sl-tx": { sentence: "High voltage transmission lines.", source: "HIFLD", vintage: "UNKNOWN" },
  "sl-subs": { sentence: "Electric substations.", source: "HIFLD", vintage: "UNKNOWN" },
  "sl-plants": { sentence: "Power plants from the EIA catalog, not live output.", source: "EIA", vintage: "UNKNOWN" },
  "oim-power-toggle": { sentence: "Power lines and substations mapped in OpenStreetMap.", source: "OpenInfraMap", vintage: "UNKNOWN" },
  "sl-territory-toggle": { sentence: "Which utility sells retail power here.", source: "HIFLD public copy", vintage: "UNKNOWN" },
  "sl-bdc": { sentence: "Broadband service reported by location.", source: "FCC BDC", vintage: "UNKNOWN" },
  "oim-telecom-toggle": { sentence: "Telecom lines mapped in OpenStreetMap.", source: "OpenInfraMap", vintage: "UNKNOWN" },
  "sl-subsea-toggle": { sentence: "Subsea cables mapped in OpenStreetMap.", source: "OpenStreetMap", vintage: "UNKNOWN" },
  "sl-water": { sentence: "Rivers, streams, and waterbodies.", source: "NHD", vintage: "UNKNOWN" },
  "sl-well-gas": { sentence: "Natural gas wells in the current view. Active is solid orange. Inactive is an orange ring.", source: "NM OCD, CO ECMC, Texas RRC", vintage: "NM live. CO status dates through 2025-03-26." },
  "sl-well-oil": { sentence: "Oil wells in the current view.", source: "Texas RRC", vintage: "UNKNOWN" },
  "sl-well-mixed": { sentence: "Wells with both oil and gas.", source: "Texas RRC", vintage: "UNKNOWN" },
  "sl-well-other": { sentence: "Wells whose commodity is other or unknown.", source: "Texas RRC", vintage: "UNKNOWN" },
  "sl-orphan": { sentence: "Orphaned wells from the NETL catalog.", source: "NETL", vintage: "UNKNOWN" },
  "sl-operating": { sentence: "Operating wells from the NETL catalog.", source: "NETL", vintage: "UNKNOWN" },
  "sl-nm": { sentence: "Gas wells from the live New Mexico OCD service.", source: "NM OCD", vintage: "queried live, Pacific time" },
  "sl-co": { sentence: "Wells from the Colorado ECMC public service. Commodity unconfirmed.", source: "CO ECMC", vintage: "status dates through 2025-03-26" },
  "sl-gas-toggle": { sentence: "Natural gas pipelines from a public catalog, not capacity.", source: "EIA", vintage: "UNKNOWN" },
  "sl-flood": { sentence: "Flood hazard zones.", source: "FEMA", vintage: "UNKNOWN" },
  "sl-whp": { sentence: "Wildfire potential is not wired on this map.", source: "UNKNOWN", vintage: "UNKNOWN" },
  "sl-topo": { sentence: "Shaded relief and topographic context.", source: "OpenTopoMap", vintage: "UNKNOWN" },
  "sl-contour-toggle": { sentence: "Elevation contours derived from a DEM, not a survey.", source: "DEM", vintage: "UNKNOWN" },
  "sl-dc": { sentence: "Data center sites mapped in OpenStreetMap.", source: "OpenStreetMap", vintage: "UNKNOWN" },
};

/** Visual dock order. Arrow keys and aria-controls follow this list. */
export const DOCK_TABS = [
  { id: "layers", pane: "sl-pane-layers" },
  { id: "jump", pane: "sl-pane-jump" },
  { id: "inspect", pane: "sl-pane-inspect" },
  { id: "wells", pane: "sl-pane-wells", badge: true },
  { id: "about", pane: "sl-pane-about" },
];

export function dockTabMove(index, key, length = DOCK_TABS.length) {
  const count = length || DOCK_TABS.length;
  if (key === "ArrowRight") return (index + 1) % count;
  if (key === "ArrowLeft") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return index;
}

export function normalizeMode(value) {
  return value === "inspect" ? "inspect" : "browse";
}

const INTERACTIVE_TYPES = new Set(["circle", "symbol", "line", "fill"]);
const SKIP_LAYERS = new Set([
  "sl-feature-hl-line",
  "sl-feature-hl-pt",
  "sl-well-rings-line",
  "sl-well-aoi-line",
  "sl-well-draw-line",
  "sl-contour-lines",
  "background",
  "usgs-fallback",
  "esri-fallback",
]);
const tapHandlers = new Map();

export function registerInteractiveLayer(id, handler) {
  tapHandlers.set(id, typeof handler === "function" ? handler : defaultTapHandler);
  return tapHandlers.get(id);
}

export function tapHandlerFor(id) {
  return tapHandlers.get(id) || defaultTapHandler;
}

export function registeredLayerIds() {
  return [...tapHandlers.keys()];
}

export function defaultTapHandler(feature) {
  return { kind: feature?.properties?.cluster || feature?.properties?.point_count ? "cluster" : "feature", layerId: feature?.layer?.id || "" };
}

export function clusterStatusLine(leaves) {
  let active = 0;
  let inactive = 0;
  for (const leaf of leaves || []) {
    const props = leaf?.properties || {};
    const kind = String(props.status_class || "");
    const label = String(props.status || props.status_label || props.Facil_Stat || "").toLowerCase();
    const code = String(props.status_code || "");
    const isActive = kind === "active" || label === "active" || label === "pr" || code.startsWith("current");
    if (isActive) active += 1;
    else inactive += 1;
  }
  return "Active " + active + ", Inactive or TA " + inactive;
}
const LAYER_INFO = {
  "sl-wells-pt": { name: "Wells", source: "Texas RRC" },
  "sl-wells-cluster": { name: "Wells", source: "Texas RRC" },
  "sl-live-wells-pt": { name: "Natural gas wells", source: "NM OCD" },
  "sl-live-wells-cluster": { name: "Natural gas wells", source: "NM OCD" },
  "hifld-subs": { name: "Substations", source: "HIFLD" },
  "hifld-tx": { name: "Transmission", source: "HIFLD" },
  "eia-plants": { name: "Plants", source: "EIA" },
  "osm-datacenters": { name: "Data centers", source: "OpenStreetMap" },
  "fcc-bdc": { name: "Broadband", source: "FCC BDC" },
  "fema-flood": { name: "Flood hazard", source: "FEMA" },
  "nhd-flowline": { name: "Water", source: "NHD" },
  "nhd-waterbody": { name: "Water", source: "NHD" },
  "sl-util-territory": { name: "Electric retail service territories", source: "HIFLD" },
  "sl-util-territory-line": { name: "Electric retail service territories", source: "HIFLD" },
  "netl-orphaned": { name: "NETL orphaned wells", source: "NETL" },
  "netl-operating": { name: "NETL operating wells", source: "NETL" },
  "nm-ocd-wells": { name: "NM OCD wells", source: "NM OCD" },
  "co-ogcc-wells": { name: "CO OGCC wells", source: "CO OGCC" },
  "siteline-oim-power-sub": { name: "Substations", source: "OpenInfraMap" },
  "siteline-oim-power-line": { name: "Power lines", source: "OpenInfraMap" },
  "siteline-oim-telecom-line": { name: "Telecom lines", source: "OpenInfraMap" },
  "siteline-oim-telecom-mast": { name: "Telecom", source: "OpenInfraMap" },
  "sl-gas-detail-lines": { name: "Gas pipelines", source: "EIA" },
  "sl-gas-lines": { name: "Gas pipelines", source: "EIA" },
  "sl-wells-cluster-count": { name: "Wells", source: "Texas RRC" },
  "sl-live-wells-cluster-count": { name: "Natural gas wells", source: "NM OCD" },
};

for (const id of Object.keys(LAYER_INFO)) registerInteractiveLayer(id, defaultTapHandler);

export function hitPadding(touch) {
  return touch ? 14 : 10;
}

export function hitBox(point, touch) {
  const pad = hitPadding(!!touch);
  const x = Number(point?.x) || 0;
  const y = Number(point?.y) || 0;
  return [[x - pad, y - pad], [x + pad, y + pad]];
}

export function isInteractiveFeature(feature) {
  const type = feature?.layer?.type;
  const id = feature?.layer?.id || "";
  if (!INTERACTIVE_TYPES.has(type)) return false;
  if (SKIP_LAYERS.has(id)) return false;
  return true;
}

function plain(value) {
  return String(value ?? "")
    .replace(/\u2014/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstField(props, keys) {
  for (const key of keys) {
    const value = props?.[key];
    if (value == null) continue;
    const text = plain(value);
    if (text) return text;
  }
  return "UNKNOWN";
}

export function featureSummary(feature) {
  const props = feature?.properties || {};
  const layerId = feature?.layer?.id || "";
  const known = LAYER_INFO[layerId] || { name: layerId || "UNKNOWN", source: "UNKNOWN" };
  const sample = /fixture|sample/i.test(String(props.dataset_origin || props.origin || ""));
  const name = firstField(props, ["name", "NAME", "api_raw", "lease_name", "operator_name", "id", "ID"]);
  const fields = [
    ["API", firstField(props, ["api_raw", "API_Label", "API", "api_normalized", "id"])],
    ["Operator", firstField(props, ["operator_name", "Operator", "OPERATOR", "operator", "ogrid_name"])],
    ["Type", firstField(props, ["type", "commodity_group", "TYPE", "symnum_raw_label"])],
    ["Status", firstField(props, ["status_label", "status", "STATUS", "Facil_Stat"])],
  ];
  const dated = firstField(props, ["status_date"]);
  if (dated !== "UNKNOWN") fields.push(["Date", dated]);
  const note = plain(props.source_note || "");
  const record = props.source_of_record ? plain(props.source_of_record) : known.source;
  const summary = {
    name,
    layer: known.name,
    source: record,
    vintage: note || firstField(props, ["vintage", "as_of", "asOf"]),
    sample,
    fields: layerId.startsWith("sl-wells") || layerId.startsWith("sl-live-wells") || /well/i.test(layerId) ? fields : fields.filter((row) => row[1] !== "UNKNOWN"),
  };
  if (!summary.fields.length) summary.fields = [["Detail", "UNKNOWN"]];
  if (summary.vintage === "UNKNOWN") summary.vintage = "UNKNOWN";
  return summary;
}

export function moreHereLine(total) {
  const extra = Math.max(0, Number(total) || 0);
  if (extra < 1) return "";
  return "+" + extra + " more here";
}

export function applyBrowseFeatureTap(state, features) {
  const mode = normalizeMode(state.mode);
  const hits = (features || []).filter(isInteractiveFeature);
  if (mode !== "browse") return { ...state, mode };
  if (!hits.length) return { ...state, mode, pin: null, popup: null };
  return { ...state, mode, pin: state.pin ?? null, popup: { index: 0, total: hits.length } };
}

export function applyEmptyBrowseTap(state) {
  const mode = normalizeMode(state.mode);
  if (mode !== "browse") return state;
  return { ...state, mode, pin: null, popup: null };
}

export function applyInspectFeatureTap(state, pin, features) {
  const next = applyMapTap({ ...state, mode: "inspect" }, pin);
  const hits = (features || []).filter(isInteractiveFeature);
  return { ...next, pin: next.pin, feature: hits[0] || null, extra: Math.max(0, hits.length - 1) };
}

export function cycleFeature(popup) {
  const total = popup?.total || 0;
  if (total < 2) return popup;
  return { ...popup, index: ((popup.index || 0) + 1) % total };
}

export function applyMapTap(state, pin) {
  const mode = normalizeMode(state.mode);
  if (mode === "inspect") {
    return { ...state, mode, open: true, tab: "inspect", pin: pin || state.pin || null };
  }
  return { ...state, mode, pin: null };
}

export function applyLegendClick(state, layerId) {
  if (normalizeMode(state.mode) !== "browse") return state;
  if (!layerId || !LAYER_FACTS[layerId]) return state;
  return { ...state, mode: "browse", open: true, tab: "layers", infoLayer: layerId };
}

export function gasStatusSummary(features) {
  const counts = { active: 0, inactive: 0, plugged_abandoned: 0, orphan: 0, unknown: 0 };
  for (const feature of features || []) {
    const code = String(feature?.properties?.status_code || "");
    if (!code) counts.unknown += 1;
    else if (code === "orphan") counts.orphan += 1;
    else if (code === "plugged_abandoned_confirmed") counts.plugged_abandoned += 1;
    else if (code.startsWith("inactive")) counts.inactive += 1;
    else if (code.startsWith("current_")) counts.active += 1;
    else counts.unknown += 1;
  }
  return counts;
}

export function shouldCloseOnMapTap({ mode, insideDock, onEmptyMap }) {
  if (insideDock) return false;
  if (normalizeMode(mode) === "inspect") return false;
  return !!onEmptyMap;
}

export function afterLayerToggle(state) {
  return {
    open: state.open !== false,
    tab: state.tab || "layers",
    scroll: Number(state.scroll) || 0,
    mode: normalizeMode(state.mode),
  };
}

const FIELD_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isTypingTarget(target) {
  if (!target) return false;
  const node = target.nodeType === 3 ? target.parentElement : target;
  if (!node) return false;
  if (node.isContentEditable) return true;
  if (node.closest?.("[contenteditable='true'], [contenteditable='']")) return true;
  if (FIELD_TAGS.has(node.tagName)) return true;
  return !!node.closest?.("input, textarea, select");
}

/** First Escape clears a filled field. A second Escape blurs it. Neither closes the card. */
export function escapeInField(state) {
  if (!state?.focused) return { action: "close", value: state?.value || "", focused: false };
  if (String(state.value || "").length) return { action: "clear", value: "", focused: true, caret: 0 };
  return { action: "blur", value: "", focused: false };
}

export function shouldMoveDockTab(target) {
  return !isTypingTarget(target);
}

export function shouldCloseFromPointer({ insideCard, fromCard, typing }) {
  if (typing || insideCard || fromCard) return false;
  return true;
}

export function afterFieldInput(state, { value, caret }) {
  const text = String(value ?? "");
  return {
    open: state.open !== false,
    tab: state.tab || "wells",
    value: text,
    caret: Number.isFinite(caret) ? caret : text.length,
    focused: true,
  };
}

export function shouldSwipeClose({ dy, typing, fromHandle }) {
  if (typing || !fromHandle) return false;
  return dy > 36;
}

export function keyboardResizeKeepsSheet(open) {
  return open !== false;
}

export function layerStatusLine({ on, zoom, minZoom, health, shown }) {
  if (!on) return "off";
  if (typeof zoom === "number" && typeof minZoom === "number" && zoom < minZoom) {
    return "zoom in";
  }
  if (health === "blocked" || health === "error") return "source unavailable";
  if (health === "loading") return "loading";
  if (typeof shown === "number") return shown + " shown in view";
  return "UNKNOWN";
}

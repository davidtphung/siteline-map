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
  "sl-well-gas": { sentence: "Natural gas wells in the current view.", source: "Texas RRC", vintage: "UNKNOWN" },
  "sl-well-oil": { sentence: "Oil wells in the current view.", source: "Texas RRC", vintage: "UNKNOWN" },
  "sl-well-mixed": { sentence: "Wells with both oil and gas.", source: "Texas RRC", vintage: "UNKNOWN" },
  "sl-well-other": { sentence: "Wells whose commodity is other or unknown.", source: "Texas RRC", vintage: "UNKNOWN" },
  "sl-orphan": { sentence: "Orphaned wells from the NETL catalog.", source: "NETL", vintage: "UNKNOWN" },
  "sl-operating": { sentence: "Operating wells from the NETL catalog.", source: "NETL", vintage: "UNKNOWN" },
  "sl-nm": { sentence: "Wells from the New Mexico OCD catalog.", source: "NM OCD", vintage: "UNKNOWN" },
  "sl-co": { sentence: "Wells from the Colorado OGCC catalog.", source: "CO OGCC", vintage: "UNKNOWN" },
  "sl-gas-toggle": { sentence: "Natural gas pipelines from a public catalog, not capacity.", source: "EIA", vintage: "UNKNOWN" },
  "sl-flood": { sentence: "Flood hazard zones.", source: "FEMA", vintage: "UNKNOWN" },
  "sl-whp": { sentence: "Wildfire potential is not wired on this map.", source: "UNKNOWN", vintage: "UNKNOWN" },
  "sl-topo": { sentence: "Shaded relief and topographic context.", source: "OpenTopoMap", vintage: "UNKNOWN" },
  "sl-contour-toggle": { sentence: "Elevation contours derived from a DEM, not a survey.", source: "DEM", vintage: "UNKNOWN" },
  "sl-dc": { sentence: "Data center sites mapped in OpenStreetMap.", source: "OpenStreetMap", vintage: "UNKNOWN" },
};

export function normalizeMode(value) {
  return value === "inspect" ? "inspect" : "browse";
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

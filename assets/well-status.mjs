/** Status colors and the remote-well load retry. Pure, so tests do not need a map. */

export const ORANGE = "#f97316";
export const AMBER = "#d6c07a";
export const PLUGGED_GRAY = "#8b9098";
export const CO_STATUS_VINTAGE = "status dates through 2025-03-26";
export const TEXAS_RRC_NOTE = "Texas RRC data has shut-in versus gas-well status only, with no operator or dates in the GIS layer.";
export const TEXAS_ACTIVE_LABEL = "Active (RRC map symbol, producing status not confirmed)";
export const TEXAS_SHUTIN_LABEL = "Inactive, shut-in (RRC)";
export const PARTIAL_NOT_PLUGGED_LABEL = "Not plugged (state reports plugged or not only)";
const PARTIAL_PLUG_ONLY = new Set(["KS", "KY", "IL", "AK"]);

export function honestStatus(props) {
  const state = String(props?.state || "").toUpperCase();
  const raw = String(props?.status_raw || props?.status || "").trim();
  const kind = String(props?.status_class || "").toLowerCase();
  if (state === "TX") {
    if (kind === "inactive" || /shut/i.test(raw)) return TEXAS_SHUTIN_LABEL;
    if (kind === "plugged" || /plug/i.test(raw)) return raw || "Plugged";
    if (kind === "active") return TEXAS_ACTIVE_LABEL;
    return raw || "UNKNOWN";
  }
  if (PARTIAL_PLUG_ONLY.has(state)) {
    if (kind === "plugged" || /plug/i.test(raw)) return raw || "Plugged";
    return PARTIAL_NOT_PLUGGED_LABEL;
  }
  return raw || "UNKNOWN";
}
export const NM_UPSTREAM = "https://gis.emnrd.nm.gov/arcgis/rest/services/OCDView/Wells_Public/FeatureServer/0";

export function styleWaitDecision(loaded) {
  if (loaded) return { action: "fetch", tries: 0 };
  return { action: "wait-idle", tries: 0 };
}

export function statusClass(status) {
  const text = String(status || "").trim().toLowerCase();
  if (!text) return "unknown";
  if (text === "active" || text === "pr" || text.includes("produc")) return "active";
  if (
    text === "si" ||
    text === "ta" ||
    text.includes("temporary abandonment") ||
    text.includes("ta expired") ||
    text.includes("shut")
  ) {
    return "inactive";
  }
  if (text.includes("plug") || text.includes("cancel") || text.includes("never drilled")) return "plugged";
  return "other";
}

export function statusPaint(kind) {
  if (kind === "inactive") return { fill: AMBER, stroke: ORANGE, width: 2, radius: 6 };
  if (kind === "plugged") return { fill: PLUGGED_GRAY, stroke: "#3f3f3f", width: 1, radius: 5 };
  return { fill: ORANGE, stroke: "#14120e", width: 1.25, radius: 5 };
}

export function includeWell(status, showPlugged) {
  const kind = statusClass(status);
  if (kind === "plugged") return !!showPlugged;
  return true;
}

export function formatQueriedPt(date) {
  const when = date instanceof Date ? date : new Date(date);
  const clock = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(when);
  return "queried " + clock + " PT";
}

export function formatSourceDate(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return "";
  const year = new Date(value).getUTCFullYear();
  if (year > 2100) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function viewHitsNm(bounds) {
  return overlaps(bounds, { west: -109.15, east: -103, south: 31.3, north: 37 });
}

export function viewHitsCo(bounds) {
  return overlaps(bounds, { west: -109.1, east: -102, south: 37, north: 41.1 });
}

export function viewHitsTexasOutsideCameron(center) {
  const lng = Number(center?.[0]);
  const lat = Number(center?.[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  const texas = lat >= 25.8 && lat <= 36.6 && lng >= -106.7 && lng <= -93.5;
  const cameron = Math.hypot(lng - -97.66, lat - 26.19) < 0.45;
  return texas && !cameron;
}

function overlaps(bounds, box) {
  if (!bounds) return false;
  const west = bounds.west ?? bounds.getWest?.();
  const east = bounds.east ?? bounds.getEast?.();
  const south = bounds.south ?? bounds.getSouth?.();
  const north = bounds.north ?? bounds.getNorth?.();
  if (![west, east, south, north].every(Number.isFinite)) return false;
  return west <= box.east && east >= box.west && south <= box.north && north >= box.south;
}

export function nmQuery(bounds, showPlugged) {
  const where = showPlugged ? "type = 'Gas'" : "type = 'Gas' AND status NOT IN ('Plugged','Cancelled','Never Drilled')";
  return {
    where,
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
    outFields: "id,name,type,status,ogrid_name,last_production_date",
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
  };
}

export function nmFeature(row, queriedNote) {
  const attrs = row?.attributes || {};
  const geom = row?.geometry || {};
  const lng = Number(geom.x);
  const lat = Number(geom.y);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const kind = statusClass(attrs.status);
  const produced = formatSourceDate(attrs.last_production_date);
  return {
    type: "Feature",
    properties: {
      api_raw: attrs.id || "",
      name: attrs.name || attrs.id || "Well",
      operator_name: attrs.ogrid_name || "",
      type: attrs.type || "Gas",
      status: attrs.status || "",
      status_class: kind,
      status_date: produced,
      source_of_record: "NM OCD",
      source_note: queriedNote,
      dataset_origin: "nm-live",
    },
    geometry: { type: "Point", coordinates: [lng, lat] },
  };
}

export function coFeature(row) {
  const attrs = row?.attributes || {};
  const geom = row?.geometry || {};
  const lng = Number(geom.x ?? attrs.Longitude);
  const lat = Number(geom.y ?? attrs.Latitude);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const status = attrs.Facil_Stat || "";
  const kind = statusClass(status);
  const dated = formatSourceDate(attrs.Stat_Date);
  return {
    type: "Feature",
    properties: {
      api_raw: attrs.API_Label || attrs.API || "",
      name: attrs.Well_Name || attrs.API_Label || "Well",
      operator_name: attrs.Operator || "",
      type: "commodity unconfirmed",
      status,
      status_class: kind,
      status_date: dated,
      source_of_record: "CO ECMC",
      source_note: CO_STATUS_VINTAGE,
      dataset_origin: "co-public",
    },
    geometry: { type: "Point", coordinates: [lng, lat] },
  };
}

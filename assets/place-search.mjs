/**
 * US place search helpers for the map bar.
 * Geocoding is OpenStreetMap (Nominatim, Photon fallback): approximate, not a survey pin.
 */

const ROAD_FORMS = [
  { re: /\b(?:FM|F\.M\.)\s*-?\s*(\d{1,4})\b/i, name: "Farm to Market Road" },
  { re: /\bRM\s*-?\s*(\d{1,4})\b/i, name: "Ranch to Market Road" },
  { re: /\bSH\s*-?\s*(\d{1,4})\b/i, name: "State Highway" },
  { re: /\bUS\s*-?\s*(\d{1,3})\b/i, name: "US Highway" },
  { re: /\b(?:IH\s*-?\s*|I\s*-|I\s+)(\d{1,3})\b/i, name: "Interstate" },
];

export function expandUsRoadQuery(query) {
  const raw = String(query || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!raw) return { query: "", expanded: false, kind: "" };
  for (const form of ROAD_FORMS) {
    if (!form.re.test(raw)) continue;
    const next = raw.replace(form.re, (_, num) => form.name + " " + num);
    return { query: next, expanded: next.toLowerCase() !== raw.toLowerCase(), kind: form.name };
  }
  return { query: raw, expanded: false, kind: "" };
}

export function viewboxParam(area) {
  if (!area || ![area.west, area.north, area.east, area.south].every(Number.isFinite)) return "";
  return [area.west, area.north, area.east, area.south].map((n) => Number(n).toFixed(5)).join(",");
}

function splitDisplay(display, name) {
  const parts = String(display || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const title = String(name || parts[0] || "Place").trim() || "Place";
  const subtitle = parts.filter((part) => part !== title && part !== "United States").slice(0, 3).join(", ");
  return { title, subtitle };
}

export function parseNominatim(rows) {
  const hits = [];
  for (const row of rows || []) {
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const box = Array.isArray(row.boundingbox) ? row.boundingbox.map(Number) : [];
    const south = Number.isFinite(box[0]) ? box[0] : lat;
    const north = Number.isFinite(box[1]) ? box[1] : lat;
    const west = Number.isFinite(box[2]) ? box[2] : lon;
    const east = Number.isFinite(box[3]) ? box[3] : lon;
    const names = splitDisplay(row.display_name, row.name);
    hits.push({
      id: String(row.osm_type || "x") + ":" + String(row.osm_id || names.title),
      title: names.title,
      subtitle: names.subtitle,
      lon,
      lat,
      west: Math.min(west, east),
      east: Math.max(west, east),
      south: Math.min(south, north),
      north: Math.max(south, north),
      importance: Number(row.importance) || 0,
      kind: String(row.type || row.addresstype || row.category || ""),
    });
  }
  return hits;
}

export function parsePhoton(collection) {
  const hits = [];
  for (const feature of collection?.features || []) {
    const props = feature.properties || {};
    if (props.countrycode && props.countrycode !== "US") continue;
    const coords = feature.geometry?.coordinates || [];
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const extent = Array.isArray(props.extent) ? props.extent.map(Number) : [];
    let west = lon;
    let east = lon;
    let south = lat;
    let north = lat;
    if (extent.length >= 4 && extent.every(Number.isFinite)) {
      west = Math.min(extent[0], extent[2]);
      east = Math.max(extent[0], extent[2]);
      south = Math.min(extent[1], extent[3]);
      north = Math.max(extent[1], extent[3]);
    }
    const title = props.name || props.street || props.city || "Place";
    const subtitle = [props.street && props.street !== title ? props.street : "", props.city || props.district || props.county, props.state]
      .filter(Boolean)
      .join(", ");
    hits.push({
      id: "photon:" + String(props.osm_type || "") + ":" + String(props.osm_id || title),
      title,
      subtitle,
      lon,
      lat,
      west,
      east,
      south,
      north,
      importance: 0.15,
      kind: String(props.type || props.osm_value || ""),
    });
  }
  return hits;
}

function insideArea(hit, area) {
  if (!area || ![area.west, area.south, area.east, area.north].every(Number.isFinite)) return false;
  return hit.lon >= area.west && hit.lon <= area.east && hit.lat >= area.south && hit.lat <= area.north;
}

/** Widen a tiny site ring so geocoder bias still covers nearby FM roads and towns. */
export function padArea(area, minSpan = 0.22) {
  if (!area || ![area.west, area.south, area.east, area.north].every(Number.isFinite)) return area;
  const midLon = (area.west + area.east) / 2;
  const midLat = (area.south + area.north) / 2;
  const halfLon = Math.max((area.east - area.west) / 2, minSpan / 2);
  const halfLat = Math.max((area.north - area.south) / 2, minSpan / 2);
  return {
    ...area,
    west: midLon - halfLon,
    east: midLon + halfLon,
    south: midLat - halfLat,
    north: midLat + halfLat,
    center: area.center || [midLon, midLat],
  };
}

function milesFrom(hit, center) {
  if (!center || center.length < 2) return 0;
  const dLat = hit.lat - center[1];
  const dLon = (hit.lon - center[0]) * Math.cos((center[1] * Math.PI) / 180);
  return Math.hypot(dLon, dLat) * 69;
}

export function rankHits(hits, area) {
  const ranked = (hits || []).map((hit) => {
    const softInside = insideArea(hit, area);
    const tightInside = area?.strict ? insideArea(hit, area.strict) : softInside;
    const frame = area?.frame || area;
    const outside = frame ? !insideArea(hit, frame) : false;
    let score = (Number(hit.importance) || 0) * 10;
    if (tightInside) score += 50;
    else if (softInside) score += 18;
    const text = (hit.title + " " + hit.subtitle).toLowerCase();
    if (/farm to market|ranch to market|state highway|us highway|interstate/.test(text)) score += 12;
    if (area?.center) score -= Math.min(36, milesFrom(hit, area.center) / 10);
    return { ...hit, outside, score };
  });
  ranked.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const seen = new Set();
  const out = [];
  for (const hit of ranked) {
    if (seen.has(hit.id)) continue;
    seen.add(hit.id);
    out.push(hit);
  }
  return out;
}

export function zoomForKind(kind) {
  const value = String(kind || "").toLowerCase();
  if (/house|address|building|allotments/.test(value)) return 16;
  if (/highway|road|street|residential|secondary|tertiary|primary|motorway/.test(value)) return 14;
  if (/village|town|city|hamlet|administrative|suburb|locality/.test(value)) return 12;
  if (/county|state/.test(value)) return 9;
  return 13;
}

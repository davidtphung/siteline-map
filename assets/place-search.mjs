/**
 * US place search helpers for the map bar.
 * Geocoding is OpenStreetMap (Nominatim, Photon fallback): approximate, not a survey pin.
 */

const ROAD_FORMS = [
  { re: /\b(?:FM|F\.?\s*M\.?)\s*(?:road|rd|hwy)?\s*-?\s*#?\s*(\d{1,4})\b/i, name: "Farm to Market Road" },
  { re: /\b(?:RM|R\.?\s*M\.?|RR)\s*(?:road|rd)?\s*-?\s*#?\s*(\d{1,4})\b/i, name: "Ranch to Market Road" },
  { re: /\b(?:SH|S\.?\s*H\.?)\s*(?:hwy|highway)?\s*-?\s*#?\s*(\d{1,4})\b/i, name: "State Highway" },
  { re: /\b(?:US|U\.?\s*S\.?)\s*(?:hwy|highway|route)?\s*-?\s*#?\s*(\d{1,3})\b/i, name: "US Highway" },
  { re: /\b(?:IH\s*-?\s*|I\s*-?\s*)(\d{1,3})\b/i, name: "Interstate" },
  { re: /\bFarm to Market(?:\s+Road)?\s*#?\s*(\d{1,4})\b/i, name: "Farm to Market Road" },
  { re: /\bRanch to Market(?:\s+Road)?\s*#?\s*(\d{1,4})\b/i, name: "Ranch to Market Road" },
  { re: /\bState Highway\s*#?\s*(\d{1,4})\b/i, name: "State Highway" },
  { re: /\bUS Highway\s*#?\s*(\d{1,3})\b/i, name: "US Highway" },
  { re: /\bInterstate\s*#?\s*(\d{1,3})\b/i, name: "Interstate" },
];

const STATE_NAMES = {
  al: "Alabama",
  ak: "Alaska",
  az: "Arizona",
  ar: "Arkansas",
  ca: "California",
  co: "Colorado",
  ct: "Connecticut",
  de: "Delaware",
  dc: "District of Columbia",
  fl: "Florida",
  ga: "Georgia",
  hi: "Hawaii",
  id: "Idaho",
  il: "Illinois",
  in: "Indiana",
  ia: "Iowa",
  ks: "Kansas",
  ky: "Kentucky",
  la: "Louisiana",
  me: "Maine",
  md: "Maryland",
  ma: "Massachusetts",
  mi: "Michigan",
  mn: "Minnesota",
  ms: "Mississippi",
  mo: "Missouri",
  mt: "Montana",
  ne: "Nebraska",
  nv: "Nevada",
  nh: "New Hampshire",
  nj: "New Jersey",
  nm: "New Mexico",
  ny: "New York",
  nc: "North Carolina",
  nd: "North Dakota",
  oh: "Ohio",
  ok: "Oklahoma",
  or: "Oregon",
  pa: "Pennsylvania",
  ri: "Rhode Island",
  sc: "South Carolina",
  sd: "South Dakota",
  tn: "Tennessee",
  tx: "Texas",
  ut: "Utah",
  vt: "Vermont",
  va: "Virginia",
  wa: "Washington",
  wv: "West Virginia",
  wi: "Wisconsin",
  wy: "Wyoming",
};

const STATE_LOOKUP = {};
for (const [abbr, name] of Object.entries(STATE_NAMES)) {
  STATE_LOOKUP[abbr] = name;
  STATE_LOOKUP[name.toLowerCase()] = name;
}

const RESULT_CAP = 6;

export function expandUsRoadQuery(query) {
  const raw = String(query || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!raw) return { query: "", expanded: false, kind: "" };
  for (const form of ROAD_FORMS) {
    const match = new RegExp(form.re.source, form.re.flags).exec(raw);
    if (!match) continue;
    const next = (raw.slice(0, match.index) + form.name + " " + match[1] + raw.slice(match.index + match[0].length)).replace(/\s+/g, " ").trim();
    return { query: next, expanded: next.toLowerCase() !== raw.toLowerCase(), kind: form.name };
  }
  return { query: raw, expanded: false, kind: "" };
}

export function canonicalState(input) {
  const key = String(input || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
  return STATE_LOOKUP[key] || "";
}

/** Street address ("123 Main St, City, TX") or "City, ST". */
export function parseUsAddress(query) {
  const raw = String(query || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!raw) return null;
  const zipMatch = raw.match(/\b(\d{5})(?:-\d{4})?\s*$/);
  const body = (zipMatch ? raw.slice(0, zipMatch.index) : raw).replace(/[,\s]+$/, "").trim();
  const postalcode = zipMatch ? zipMatch[1] : "";
  const stateTail = "([A-Za-z]{2}|[A-Za-z][A-Za-z .']+)";
  const three = new RegExp("^(\\d+\\s+.+?),\\s*([^,]+?),\\s*" + stateTail + "$", "i").exec(body);
  if (three) {
    const state = canonicalState(three[3]);
    const street = three[1].trim();
    const city = three[2].trim();
    if (state && street && city) return { mode: "address", street, city, state, postalcode };
  }
  const two = new RegExp("^([^,\\d][^,]*?),\\s*" + stateTail + "$", "i").exec(body);
  if (two) {
    const state = canonicalState(two[2]);
    const city = two[1].trim();
    if (state && city) return { mode: "place", city, state, postalcode };
  }
  return null;
}

export function viewboxParam(area) {
  if (!area || ![area.west, area.north, area.east, area.south].every(Number.isFinite)) return "";
  return [area.west, area.north, area.east, area.south].map((n) => Number(n).toFixed(5)).join(",");
}

/** Nominatim params. Address-like text uses structured fields and stays in the US. */
export function nominatimSearchParams(query, area, options) {
  const expanded = expandUsRoadQuery(query);
  const text = expanded.query || String(query || "").trim();
  const structured = options?.freeText ? null : parseUsAddress(text);
  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "10",
    addressdetails: "1",
    countrycodes: "us",
  });
  if (structured?.mode === "address") {
    params.set("street", structured.street);
    params.set("city", structured.city);
    params.set("state", structured.state);
    if (structured.postalcode) params.set("postalcode", structured.postalcode);
  } else if (structured?.mode === "place") {
    params.set("city", structured.city);
    params.set("state", structured.state);
    if (structured.postalcode) params.set("postalcode", structured.postalcode);
  } else {
    params.set("q", text);
  }
  const box = viewboxParam(area);
  if (box) {
    params.set("viewbox", box);
    params.set("bounded", "0");
  }
  return {
    params,
    query: text,
    road: Boolean(expanded.kind),
    roadQuery: expanded.kind ? text : "",
    structured,
  };
}

/** Second Nominatim pass: expanded road plus a city or state hint. */
export function roadQueryWithPlace(road, hint) {
  const base = String(road || "")
    .trim()
    .replace(/\s+/g, " ");
  const place = String(hint || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!base) return "";
  if (!place) return base;
  if (base.toLowerCase().includes(place.toLowerCase())) return base;
  return base + ", " + place;
}

/** "Texas" when the map center sits in the state, otherwise "". */
export function texasHint(area) {
  const center = area?.center;
  if (!center || center.length < 2) return "";
  const lon = Number(center[0]);
  const lat = Number(center[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return "";
  if (lon < -106.65 || lon > -93.51 || lat < 25.84 || lat > 36.5) return "";
  return "Texas";
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

function withHouseNumber(title, house, road) {
  const number = String(house || "").trim();
  const street = String(road || "").trim();
  const label = String(title || "").trim();
  if (number && street) {
    const full = number + " " + street;
    const folded = label.toLowerCase();
    const hasNumber = folded.includes(number.toLowerCase());
    const hasStreet = folded.includes(street.toLowerCase());
    if (hasNumber && hasStreet) return label;
    if (!label || folded === number.toLowerCase() || folded === street.toLowerCase() || (hasNumber && !hasStreet)) return full;
  }
  return label || "Place";
}

function subtitleWithout(subtitle, ...parts) {
  const drop = new Set(parts.map((part) => String(part || "").trim()).filter(Boolean));
  return String(subtitle || "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !drop.has(part))
    .join(", ");
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
    const address = row.address || {};
    const title = withHouseNumber(names.title, address.house_number, address.road);
    hits.push({
      id: String(row.osm_type || "x") + ":" + String(row.osm_id || title),
      title,
      subtitle: subtitleWithout(names.subtitle, title, address.road, address.house_number),
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
    const street = props.street || "";
    const named = props.name || street || props.city || "Place";
    const title = withHouseNumber(named, props.housenumber, street);
    const subtitle = [street && !title.toLowerCase().includes(street.toLowerCase()) ? street : "", props.city || props.district || props.county, props.state]
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
      kind: String(props.osm_value || props.type || ""),
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

function squash(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function subtitleStateScore(subtitle, want) {
  const text = " " + squash(subtitle) + " ";
  const target = squash(want);
  if (!text.trim() || !target) return 0;
  const names = Object.values(STATE_NAMES)
    .map((name) => squash(name))
    .sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (!text.includes(" " + name + " ")) continue;
    return name === target ? 14 : -18;
  }
  return 0;
}

export function rankHits(hits, area, query) {
  const expanded = expandUsRoadQuery(query);
  const parsed = parseUsAddress(query) || parseUsAddress(expanded.query);
  const needles = new Set();
  const addNeedle = (value) => {
    const next = squash(value);
    if (next) needles.add(next);
  };
  addNeedle(query);
  addNeedle(expanded.query);
  if (parsed?.city) addNeedle(parsed.city);
  if (parsed?.street) addNeedle(parsed.street);
  if (parsed?.city && parsed?.state) addNeedle(parsed.city + " " + parsed.state);

  const ranked = (hits || []).map((hit) => {
    const softInside = insideArea(hit, area);
    const tightInside = area?.strict ? insideArea(hit, area.strict) : softInside;
    const frame = area?.frame || area;
    const outside = frame ? !insideArea(hit, frame) : false;
    const kind = String(hit.kind || "").toLowerCase();
    const title = squash(hit.title);
    let score = (Number(hit.importance) || 0) * 10;
    if (tightInside) score += 50;
    else if (softInside) score += 18;
    const text = (hit.title + " " + hit.subtitle).toLowerCase();
    if (/farm[- ]to[- ]market|ranch[- ]to[- ]market|state highway|us highway|interstate/.test(text)) score += 12;
    let exact = false;
    for (const needle of needles) {
      if (title === needle) exact = true;
    }
    if (exact) score += 36;
    else {
      for (const needle of needles) {
        if (needle.length >= 4 && (title.includes(needle) || needle.includes(title))) {
          score += 12;
          break;
        }
      }
    }
    const addressKind = /house|housenumber|address|building|allotments/.test(kind);
    const placeKind = /city|town|village|hamlet|administrative|locality|municipality|suburb/.test(kind);
    const roadKind = /highway|road|street|residential|secondary|tertiary|primary|motorway|trunk/.test(kind);
    if (parsed?.mode === "address" && addressKind) score += 26;
    else if (addressKind) score += 8;
    if (parsed?.mode === "place" && placeKind) score += 22;
    if (expanded.kind && roadKind) score += 10;
    if (parsed?.state) score += subtitleStateScore(hit.subtitle + " " + hit.title, parsed.state);
    if (area?.center) {
      const miles = milesFrom(hit, area.center);
      score -= Math.min(24, miles / 15);
      if (miles > 80) score -= Math.min(48, (miles - 80) / 8);
    }
    return { ...hit, outside, score };
  });
  ranked.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const seen = new Set();
  const out = [];
  for (const hit of ranked) {
    if (seen.has(hit.id)) continue;
    seen.add(hit.id);
    out.push(hit);
    if (out.length >= RESULT_CAP) break;
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

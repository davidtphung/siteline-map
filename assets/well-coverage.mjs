/** Wells card for the state under the map center, from the gas-wells manifest. */

import POLYGONS from "./us-states.mjs";

export const STATE_NAMES = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

const WIRED = new Set(["live full status", "partial status", "file snapshot"]);
export const NO_FEED = "No public wells feed wired for this state yet";

function pointInRing(x, y, ring) {
  let inside = false;
  const count = ring.length;
  let j = count - 1;
  for (let i = 0; i < count; i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const dy = yj - yi;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (dy || 1e-15) + xi) inside = !inside;
    j = i;
  }
  return inside;
}

export function stateAt(lon, lat) {
  const x = Number(lon);
  const y = Number(lat);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return "";
  for (const [code, polys] of Object.entries(POLYGONS)) {
    for (const rings of polys) {
      if (!rings?.[0] || !pointInRing(x, y, rings[0])) continue;
      let hole = false;
      for (let i = 1; i < rings.length; i += 1) {
        if (pointInRing(x, y, rings[i])) {
          hole = true;
          break;
        }
      }
      if (!hole) return code;
    }
  }
  return "";
}

export function formatCount(value) {
  if (value === "UNKNOWN" || value == null || value === "") return "UNKNOWN";
  const n = Number(value);
  if (!Number.isFinite(n)) return "UNKNOWN";
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function countField(row, key) {
  const n = row?.counts?.[key];
  return Number.isFinite(n) ? n : "UNKNOWN";
}

export function wellStateCard(manifest, center) {
  const code = stateAt(center?.[0], center?.[1]);
  const row = code ? manifest?.states?.[code] || null : null;
  const coverage = String(row?.coverage || "").trim();
  const wired = !!row && WIRED.has(coverage) && !!(row.source_url || row.source_name || row.agency);
  const updated = String(row?.source_updated || "").trim();
  const name = code ? STATE_NAMES[code] || code : "";
  return {
    code,
    name,
    wired,
    gap: !!code && !wired,
    agency: wired ? row.agency || "UNKNOWN" : "",
    coverage: wired ? coverage : "UNKNOWN",
    active: wired ? countField(row, "active") : "UNKNOWN",
    inactive: wired ? countField(row, "inactive") : "UNKNOWN",
    plugged: wired ? countField(row, "plugged") : "UNKNOWN",
    sourceUpdated: wired && updated && updated !== "UNKNOWN" ? updated : "UNKNOWN",
    sourceUrl: wired ? row.source_url || "" : "",
    sourceName: wired ? row.source_name || "" : "",
    note: wired ? row.note || "" : "",
    headline: name || "State UNKNOWN",
    message: !code ? "State UNKNOWN. Pan inside a state to read its wells coverage." : wired ? "" : NO_FEED,
  };
}

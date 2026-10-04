/** Readable well popup labels. Raw feed values stay in the tiles. */

const COMMODITY = {
  gas: "Natural gas",
  natural_gas: "Natural gas",
  oil: "Oil",
  oil_gas: "Oil and gas",
  oil_and_gas: "Oil and gas",
  oil_gas_combined: "Oil and gas (combined)",
  combined: "Oil and gas (combined)",
  condensate: "Condensate",
  injection: "Injection",
  water: "Water",
  dry: "Dry hole",
  dry_hole: "Dry hole",
  other: "Other",
  unknown: "Unknown",
};

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function commodityLabel(value) {
  const raw = clean(value);
  if (!raw || raw.toUpperCase() === "UNKNOWN") return raw || "UNKNOWN";
  const key = raw.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (COMMODITY[key]) return COMMODITY[key];
  return raw.replace(/_/g, " ");
}

function dated(value) {
  const text = clean(value);
  if (!text || text.toUpperCase() === "UNKNOWN") return "";
  return text;
}

function timeOf(value) {
  if (!value) return NaN;
  const text = value.length === 7 ? value + "-01" : value;
  return Date.parse(text);
}

/**
 * Data as of is the source refresh date when the well's own status date is older.
 * The well date is returned separately as last status date.
 */
export function wellDates(props, manifest) {
  const state = String(props?.state || "").toUpperCase();
  const fromManifest = manifest?.states?.[state]?.source_updated;
  const source = dated(fromManifest) || dated(props?.source_updated);
  const status = dated(props?.status_date);
  const sourceMs = timeOf(source);
  const statusMs = timeOf(status);
  const old = Number.isFinite(statusMs) && Number.isFinite(sourceMs) && statusMs < sourceMs;
  const asOf = !status || old ? source || "UNKNOWN" : status;
  return {
    asOf,
    lastStatus: status,
    line: "data as of " + asOf,
  };
}

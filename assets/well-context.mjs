/** Commodity isolation for counts, proximity, exports, and URL state. */

import { distanceMiles } from "./well-geo.mjs";

const RING_MILES = [0.25, 0.5, 1, 5, 10];

export const FLAG_KEYS = ["include_gas", "include_oil", "include_mixed", "include_other"];

export function defaultFlags(rules) {
  const defaults = rules?.defaults || {
    include_gas: true,
    include_oil: false,
    include_mixed: false,
    include_other: false,
  };
  return {
    include_gas: !!defaults.include_gas,
    include_oil: !!defaults.include_oil,
    include_mixed: !!defaults.include_mixed,
    include_other: !!defaults.include_other,
  };
}

function truthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

export function flagsFromSearch(search, rules) {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const flags = defaultFlags(rules);
  for (const key of FLAG_KEYS) {
    if (params.has(key)) flags[key] = truthy(params.get(key));
  }
  return flags;
}

export function flagsToSearch(flags, currentSearch = "") {
  const params = new URLSearchParams(currentSearch);
  for (const key of FLAG_KEYS) params.set(key, flags[key] ? "1" : "0");
  return params.toString();
}

export function contextTitle(flags, rules) {
  const titles = rules?.titles || {
    gas: "Gas well context",
    oil: "Oil well context",
    both: "Oil & gas well context",
  };
  const gas = !!flags.include_gas;
  const oil = !!flags.include_oil;
  const mixed = !!flags.include_mixed;
  if (gas && !oil && !mixed) return titles.gas;
  if (oil && !gas && !mixed) return titles.oil;
  if (oil || mixed) return titles.both;
  return titles.gas;
}

export function featureMatches(feature, flags) {
  const group = feature?.properties?.commodity_group;
  if (group === "gas") return !!flags.include_gas;
  if (group === "oil") return !!flags.include_oil;
  if (group === "mixed") return !!flags.include_mixed;
  return !!flags.include_other;
}

export function filterFeatures(features, flags, statuses) {
  const wanted = statuses && statuses.length ? new Set(statuses) : null;
  return features.filter((feature) => {
    if (!featureMatches(feature, flags)) return false;
    if (wanted && !wanted.has(feature.properties.status_code)) return false;
    return true;
  });
}

export function featureHaystack(feature, rules) {
  const props = feature?.properties || {};
  const status = rules?.statuses?.[props.status_code]?.label || props.status_label || "";
  return [
    status,
    props.status_code,
    props.api_raw,
    props.api_normalized,
    props.operator_name,
    props.lease_name,
    props.well_number,
    props.commodity,
    props.commodity_group,
    props.county_name,
    props.freshness,
  ]
    .filter((part) => part != null && String(part).trim() !== "")
    .join(" ")
    .toLowerCase();
}

/** Card-only text find. Commodity flags stay on filterFeatures. */
export function filterFeaturesByText(features, query, rules) {
  const terms = String(query || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!terms.length) return features;
  return features.filter((feature) => {
    const hay = featureHaystack(feature, rules);
    return terms.every((term) => hay.includes(term));
  });
}

export function countsByStatus(features) {
  const counts = {};
  for (const feature of features) {
    const code = feature.properties.status_code;
    counts[code] = (counts[code] || 0) + 1;
  }
  return counts;
}

export function separatedCounts(features) {
  const groups = { gas: [], oil: [], mixed: [], other: [] };
  for (const feature of features) {
    const group = feature.properties.commodity_group || "other";
    (groups[group] || groups.other).push(feature);
  }
  return Object.fromEntries(
    Object.entries(groups).map(([name, rows]) => [
      name,
      { well_count: rows.length, counts_by_status: countsByStatus(rows) },
    ]),
  );
}

export function resetGasFlags() {
  return {
    include_gas: true,
    include_oil: false,
    include_mixed: false,
    include_other: false,
  };
}

export function exportCollection(features) {
  return { type: "FeatureCollection", features, crs_distance: "EPSG:3081" };
}

function baseStatus(props) {
  return props.status_code_base || String(props.status_code || "").replace(/^(tx|nm|co|ok)_/, "");
}

function isCurrentGas(props) {
  const code = props.status_code || "";
  const base = baseStatus(props);
  return base === "current_gas_schedule" || code === "nm_active_gas";
}

function isConflictWell(props) {
  if (props.pa_confirmed === true) return false;
  if (props.well_count || props.status_code === "cluster") return false;
  const base = baseStatus(props);
  if (base.includes("canceled")) return false;
  return true;
}

export function statusLabel(code, rules) {
  if (!code) return "";
  if (rules?.statuses?.[code]?.label) return rules.statuses[code].label;
  const base = String(code).replace(/^(tx|nm|co|ok)_/, "");
  return rules?.statuses?.[base]?.label || code;
}

/**
 * Site brief for a pin. Rings are EPSG:3081 miles.
 * pipelineMiles is null when the EIA line layer is not loaded.
 */
export function buildWellBrief(features, lon, lat, pipelineMiles, lineage) {
  const rows = (features || []).filter((feature) => feature?.properties && !feature.properties.well_count);
  const rings = { gas: {}, oil: {}, mixed: {} };
  for (const miles of RING_MILES) {
    rings.gas[String(miles)] = 0;
    rings.oil[String(miles)] = 0;
    rings.mixed[String(miles)] = 0;
  }
  let nearestGas = null;
  let nearestOil = null;
  let unplugged = 0;
  let plugged = 0;
  for (const feature of rows) {
    const props = feature.properties;
    const coords = feature.geometry?.coordinates || [props.lon, props.lat];
    if (!coords || coords.length < 2) continue;
    const miles = distanceMiles(lon, lat, coords[0], coords[1]);
    const group = props.commodity_group;
    if (rings[group]) {
      for (const ring of RING_MILES) {
        if (miles <= ring + 1e-6) rings[group][String(ring)] += 1;
      }
    }
    if (miles <= 1 + 1e-6 && isConflictWell(props)) unplugged += 1;
    if (miles <= 1 + 1e-6 && props.pa_confirmed === true) plugged += 1;
    if (isCurrentGas(props) && (!nearestGas || miles < nearestGas.distance_miles)) {
      nearestGas = briefWell(props, miles);
    }
    if (group === "oil" && (!nearestOil || miles < nearestOil.distance_miles)) {
      nearestOil = briefWell(props, miles);
    }
  }
  const pipeline =
    pipelineMiles == null
      ? {
          distance_miles: null,
          crs: "EPSG:3081",
          note: "EIA pipeline layer is not loaded in this view. Not a PHMSA or capacity study.",
        }
      : {
          distance_miles: Math.round(pipelineMiles * 1000) / 1000,
          crs: "EPSG:3081",
          layer: "EIA Natural_Gas_Interstate_and_Intrastate_Pipelines",
          note: "Public pipeline context. Not PHMSA class, capacity, or interconnect.",
        };
  return {
    gas_wells_in_rings: rings.gas,
    oil_wells_in_rings: rings.oil,
    mixed_wells_in_rings: rings.mixed,
    nearest_current_gas_well: nearestGas,
    nearest_oil_well: nearestOil,
    nearest_eia_gas_pipeline: pipeline,
    orphan_or_unplugged_in_1mi: unplugged,
    pa_confirmed_in_1mi: plugged,
    source_lineage: lineage || "State system of record. Screening catalog.",
    confidence: "screening",
    next_action: "Verify the API on the state viewer. This is not an interconnect, fuel, or title score.",
  };
}

function briefWell(props, miles) {
  return {
    id: props.id || "",
    api_raw: props.api_raw || "",
    api_normalized: props.api_normalized || "",
    status_code: props.status_code || "",
    status_label: props.status_label || "",
    commodity_group: props.commodity_group || "",
    distance_miles: Math.round(miles * 1000) / 1000,
    distance_crs: "EPSG:3081",
    dataset_origin: props.dataset_origin || "",
    source_of_record: props.source_of_record || "",
  };
}

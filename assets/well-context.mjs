/** Commodity isolation for counts, proximity, exports, and URL state. */

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

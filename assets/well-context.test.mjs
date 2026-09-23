import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { distanceMeters, distanceMiles, forward3081 } from "./well-geo.mjs";
import {
  contextTitle,
  countsByStatus,
  filterFeatures,
  flagsFromSearch,
  resetGasFlags,
  separatedCounts,
} from "./well-context.mjs";

const rules = JSON.parse(readFileSync(new URL("../config/well-status-rules.json", import.meta.url)));
const fc = JSON.parse(readFileSync(new URL("../data/cameron-wells.geojson", import.meta.url)));

test("EPSG:3081 matches pyproj and is not Web Mercator", () => {
  const [x, y] = forward3081(-97.66, 26.2);
  assert.ok(Math.abs(x - 1234230.3895024885) < 0.01);
  assert.ok(Math.abs(y - 452502.8225239585) < 0.01);
  const meters = distanceMeters(-97.66, 26.2, -97.66, 26.21);
  assert.ok(Math.abs(meters - 1109.6584504542068) < 0.01);
  assert.ok(Math.abs(meters - 1240.7158907712437) > 50);
});

test("default flags are gas on and oil mixed other off", () => {
  const flags = flagsFromSearch("", rules);
  assert.deepEqual(flags, {
    include_gas: true,
    include_oil: false,
    include_mixed: false,
    include_other: false,
  });
  const gas = filterFeatures(fc.features, flags);
  const apis = new Set(gas.map((f) => f.properties.api_raw));
  assert.ok(apis.has("06100001"));
  assert.equal(apis.has("06100003"), false);
  assert.equal(apis.has("06100005"), false);
  assert.equal(apis.has("06100016"), false);
  assert.equal(contextTitle(flags, rules), "Gas well context");
});

test("oil view does not include gas wells", () => {
  const flags = { include_gas: false, include_oil: true, include_mixed: false, include_other: false };
  const rows = filterFeatures(fc.features, flags);
  assert.equal(contextTitle(flags, rules), "Oil well context");
  assert.ok(rows.every((f) => f.properties.commodity_group === "oil"));
  assert.equal(contextTitle({ include_gas: true, include_oil: true, include_mixed: false, include_other: false }, rules), "Oil & gas well context");
  assert.deepEqual(resetGasFlags().include_oil, false);
});

test("one mile ring uses projected miles and excludes the oil shut-in from gas counts", () => {
  const anchor = [-97.66, 26.19];
  const flags = flagsFromSearch("", rules);
  const inside = filterFeatures(fc.features, flags).filter(
    (f) => distanceMiles(anchor[0], anchor[1], f.geometry.coordinates[0], f.geometry.coordinates[1]) <= 1,
  );
  const counts = countsByStatus(inside);
  assert.equal(counts.inactive_oil || 0, 0);
  const oil = fc.features.find((f) => f.properties.api_raw === "06100010");
  const miles = distanceMiles(anchor[0], anchor[1], oil.geometry.coordinates[0], oil.geometry.coordinates[1]);
  assert.ok(Math.abs(miles - 1) < 1e-4);
  const sep = separatedCounts(fc.features);
  assert.ok(sep.gas.well_count > 0);
  assert.ok(sep.oil.well_count > 0);
  assert.notEqual(sep.gas.well_count, sep.oil.well_count);
});

test("disclaimers are present and non-PA labels do not say abandoned", () => {
  const required = [
    "Texas RRC is the system of record for Texas wells.",
    "Inactive is not abandoned.",
    "Orphan is not abandoned.",
    "Historical and missing status are not abandoned.",
    "Well proximity is not gas deliverability, capacity, pressure, or service.",
    "Well proximity is not oil liability.",
    "EIA natural gas pipelines are public pipeline context, separate from wells.",
  ];
  for (const line of required) assert.ok(rules.disclaimers.includes(line));
  for (const feature of fc.features) {
    if (!feature.properties.pa_confirmed) {
      assert.equal(feature.properties.status_label.toLowerCase().includes("abandoned"), false);
    }
  }
});

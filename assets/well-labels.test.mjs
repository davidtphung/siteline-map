import assert from "node:assert/strict";
import test from "node:test";
import { commodityLabel, wellDates } from "./well-labels.mjs";

test("commodity codes become readable labels", () => {
  assert.equal(commodityLabel("oil_gas_combined"), "Oil and gas (combined)");
  assert.equal(commodityLabel("gas"), "Natural gas");
  assert.equal(commodityLabel("natural_gas"), "Natural gas");
  assert.equal(commodityLabel("oil"), "Oil");
  assert.equal(commodityLabel("oil_and_gas"), "Oil and gas");
  assert.equal(commodityLabel("dry_hole"), "Dry hole");
  assert.equal(commodityLabel("UNKNOWN"), "UNKNOWN");
  assert.equal(commodityLabel("custom_code"), "custom code");
});

test("data as of uses the source refresh when the well date is older", () => {
  const dates = wellDates(
    { state: "NM", status_date: "2026-07-01", source_updated: "2026-01-01" },
    { states: { NM: { source_updated: "2026-08-01" } } },
  );
  assert.equal(dates.asOf, "2026-08-01");
  assert.equal(dates.lastStatus, "2026-07-01");
  assert.equal(dates.line, "data as of 2026-08-01");

  const fresh = wellDates({ state: "NM", status_date: "2026-09-01", source_updated: "2026-08-01" }, null);
  assert.equal(fresh.asOf, "2026-09-01");
  assert.equal(fresh.line, "data as of 2026-09-01");

  const missing = wellDates({ state: "TX", status_date: "UNKNOWN", source_updated: "UNKNOWN" }, null);
  assert.equal(missing.asOf, "UNKNOWN");
  assert.equal(missing.lastStatus, "");
  assert.equal(missing.line, "data as of UNKNOWN");
});

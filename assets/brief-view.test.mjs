import assert from "node:assert/strict";
import test from "node:test";
import { briefSummaryLines, fieldState, groupUnknowns } from "./brief-view.mjs";

test("field states stay distinct", () => {
  assert.equal(fieldState("", false), "UNKNOWN");
  assert.equal(fieldState("UNKNOWN", false), "UNKNOWN");
  assert.equal(fieldState("none returned", false), "NONE FOUND");
  assert.equal(fieldState("0", false), "NONE FOUND");
  assert.equal(fieldState("ArcGIS timeout", false), "LOOKUP FAILED");
  assert.equal(fieldState("12.4 mi", false), "12.4 mi");
});

test("summary is five lines and all-unknown groups collapse", () => {
  const lines = briefSummaryLines([
    { label: "Nearest transmission", value: "1.20 mi" },
    { label: "Line kV if present", value: "345 kV" },
    { label: "Nearest substation", value: "UNKNOWN" },
    { label: "Substation name", value: "UNKNOWN" },
    { label: "Serving utility", value: "UNKNOWN" },
    { label: "Wells within 5 mi", value: "14" },
    { label: "FEMA flood flag", value: "none returned" },
    { label: "WHP wildfire", value: "UNKNOWN" },
  ]);
  assert.equal(lines.length, 5);
  assert.equal(lines[0], "Nearest transmission: 345 kV, 1.20 mi");
  assert.equal(lines[1], "Nearest substation: UNKNOWN");
  assert.equal(lines[2], "Serving utility: UNKNOWN");
  assert.equal(lines[3], "Wells within 5 mi: 14");
  assert.equal(lines[4], "Flood: NONE FOUND");

  const failed = briefSummaryLines([{ label: "Nearest transmission", value: "request failed" }]);
  assert.equal(failed[0], "Nearest transmission: LOOKUP FAILED");

  const groups = groupUnknowns([
    { title: "Water", fields: [{ value: "UNKNOWN" }, { value: "UNKNOWN" }] },
    { title: "Grid", fields: [{ value: "1.20 mi" }, { value: "UNKNOWN" }] },
  ]);
  assert.equal(groups[0].allUnknown, true);
  assert.equal(groups[0].unknownCount, 2);
  assert.equal(groups[1].allUnknown, false);
});

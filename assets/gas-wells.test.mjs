import assert from "node:assert/strict";
import test from "node:test";
import { coverageRows, pointFilter, sourceAsOf, useCameronFixture } from "./gas-wells.mjs";

test("popup source line always carries an agency and a date", () => {
  const line = sourceAsOf({ source_name: "NM EMNRD Oil Conservation Division", status_date: "2026-08-01", source_updated: "2026-08-01" });
  assert.equal(line.line, "Source: NM EMNRD Oil Conservation Division, data as of 2026-08-01");
  const missing = sourceAsOf({});
  assert.equal(missing.line, "Source: UNKNOWN, data as of UNKNOWN");
  assert.equal(missing.line.includes("\u2014"), false);
});

test("coverage table lists every state and keeps unknown counts unknown", () => {
  const rows = coverageRows({
    states: {
      TX: { coverage: "partial status", counts: { active: 10, inactive: 2 }, source_updated: "UNKNOWN", note: "shut-in" },
      NM: { coverage: "live full status", counts: { active: 3, inactive: 1 }, source_updated: "2026-08-01" },
      WY: { coverage: "UNKNOWN" },
    },
  });
  assert.deepEqual(rows.map((row) => row.state), ["NM", "TX", "WY"]);
  assert.equal(rows[1].active, 10);
  assert.equal(rows[2].active, "UNKNOWN");
  assert.equal(rows[1].coverage, "partial status");
});

test("plugged wells stay hidden until the toggle is on", () => {
  assert.equal(JSON.stringify(pointFilter(false)).includes("plugged"), true);
  assert.equal(JSON.stringify(pointFilter(true)).includes("plugged"), false);
});

test("Cameron fixture is only the fallback when Texas is missing", () => {
  assert.equal(useCameronFixture({ states: { TX: { coverage: "partial status" } } }), false);
  assert.equal(useCameronFixture({ states: { TX: { coverage: "UNKNOWN" } } }), true);
  assert.equal(useCameronFixture(null), true);
});

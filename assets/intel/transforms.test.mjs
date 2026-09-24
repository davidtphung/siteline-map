import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLocalNotes,
  assignLabel,
  baCodeForName,
  buildChecklist,
  dailyPeaks,
  emptyKit,
  formatPct,
  kitSummary,
  longPole,
  pickSmallestTerritory,
  siteBriefMarkdown,
  yearOverYearPeak,
} from "./transforms.mjs";

test("daily peaks take the max hour and drop sentinel values", () => {
  const peaks = dailyPeaks([
    { period: "2025-09-01T01", value: 10 },
    { period: "2025-09-01T18", value: 40 },
    { period: "2025-09-01T19", value: -999999 },
    { period: "2025-09-02T00", value: 12 },
    { period: "bad", value: 99 },
    { period: "2025-09-02T05", value: null },
  ]);
  assert.deepEqual(peaks, [
    { date: "2025-09-01", peak: 40, label: "CATALOG" },
    { date: "2025-09-02", peak: 12, label: "CATALOG" },
  ]);
});

test("year over year uses the same month and stays UNKNOWN when the prior year is missing", () => {
  const peaks = [];
  for (let day = 1; day <= 28; day++) {
    const dd = String(day).padStart(2, "0");
    peaks.push({ date: `2024-09-${dd}`, peak: 100 });
    peaks.push({ date: `2025-09-${dd}`, peak: 110 });
  }
  const yoy = yearOverYearPeak(peaks);
  assert.equal(yoy.pct, 10);
  assert.equal(yoy.label, "CATALOG");
  assert.equal(yoy.month, "2025-09");
  assert.equal(yoy.priorMonth, "2024-09");

  const missing = yearOverYearPeak([{ date: "2025-09-01", peak: 50 }]);
  assert.equal(missing.pct, null);
  assert.equal(missing.label, "UNKNOWN");
  assert.equal(formatPct(missing.pct), "UNKNOWN");
  assert.equal(formatPct(10), "+10.0%");
  assert.equal(formatPct(-2.5), "-2.5%");
});

test("truth labels stay inside the allowed set and empty checklist rows stay UNKNOWN", () => {
  assert.equal(assignLabel("eia-hourly"), "LIVE");
  assert.equal(assignLabel("eia-peak"), "CATALOG");
  assert.equal(assignLabel("eia-forecast"), "CATALOG");
  assert.equal(assignLabel("scenario"), "SCENARIO");
  assert.equal(assignLabel("press"), "PRESS");
  assert.equal(assignLabel("claim"), "CLAIM");
  assert.equal(assignLabel("proxy"), "PROXY");
  assert.equal(assignLabel("nope"), "UNKNOWN");

  const rows = buildChecklist({
    grid: { text: "Substation A, 1.2 mi", source: "HIFLD substations", url: "https://example.test/subs" },
    scenario: { hv: "2 kits, local note" },
  });
  assert.equal(rows.find((r) => r.id === "grid").status, "Known");
  assert.equal(rows.find((r) => r.id === "grid").label, "CATALOG");
  assert.equal(rows.find((r) => r.id === "hv").status, "Scenario");
  assert.equal(rows.find((r) => r.id === "hv").label, "SCENARIO");
  assert.equal(rows.find((r) => r.id === "chillers").status, "Unknown");
  assert.equal(rows.find((r) => r.id === "chillers").text, "UNKNOWN");
  assert.equal(rows.find((r) => r.id === "generation").label, "UNKNOWN");
});

test("BA name join ignores punctuation and does not invent a code", () => {
  const table = { "ELECTRIC RELIABILITY COUNCIL OF TEXAS, INC.": "ERCO" };
  assert.equal(baCodeForName("ELECTRIC RELIABILITY COUNCIL OF TEXAS, INC.", table), "ERCO");
  assert.equal(baCodeForName("Someone else", table), null);
});

test("smallest retail territory wins when polygons overlap", () => {
  const picked = pickSmallestTerritory([
    { attributes: { NAME: "BIG CO", Shape__Area: 500, CNTRL_AREA: "NOT AVAILABLE" } },
    { attributes: { NAME: "SMALL CO", Shape__Area: 12, CNTRL_AREA: "ERCO" } },
    { attributes: { NAME: "NOT AVAILABLE", Shape__Area: 1 } },
  ]);
  assert.equal(picked.utility.NAME, "SMALL CO");
  assert.equal(picked.overlap, 2);
});

test("long pole flags the undated gap, otherwise the latest expected date", () => {
  const undated = longPole([
    { id: "grid", title: "Grid path", status: "Known", expectedDate: "2030-01-01" },
    { id: "hv", title: "HV transformer and switchgear", status: "Scenario", expectedDate: "2028-01-01" },
    { id: "water", title: "Water", status: "Unknown", expectedDate: "" },
    { id: "fiber", title: "Fiber", status: "Unknown", expectedDate: null },
  ]);
  assert.equal(undated.id, "water");
  assert.equal(undated.reason, "no date");
  assert.equal(undated.alsoUndated, 1);
  assert.match(undated.flag, /Not an automatic decision/);

  const dated = longPole([
    { id: "hv", title: "HV", status: "Scenario", expectedDate: "2027-04-01" },
    { id: "chillers", title: "Chillers", status: "Unknown", expectedDate: "2029-06-01" },
    { id: "fiber", title: "Fiber", status: "Known", expectedDate: "2035-01-01" },
  ]);
  assert.equal(dated.id, "chillers");
  assert.equal(dated.reason, "latest date");
  assert.equal(dated.expectedDate, "2029-06-01");
  assert.equal(longPole([{ id: "grid", title: "Grid path", status: "Known" }]), null);
});

test("proxy and kit fields stay empty until a local note exists", () => {
  assert.deepEqual(emptyKit(), {
    unitCost: "",
    vendorCapacity: "",
    leadTime: "",
    vendorCount: "",
    buffer: "",
    quality: "",
    reusable: "",
  });
  assert.equal(kitSummary(emptyKit()), "");
  const rows = applyLocalNotes(
    [
      { id: "water", title: "Water", status: "Unknown", label: "UNKNOWN", text: "UNKNOWN" },
      { id: "hv", title: "HV transformer and switchgear", status: "Unknown", label: "UNKNOWN", text: "UNKNOWN" },
    ],
    {
      proxy: { water: { value: "nearby river name only", from: "NHD name plus a state water plan" } },
      kits: { hv: { leadTime: "typed by hand", unitCost: "" } },
    },
  );
  const water = rows.find((row) => row.id === "water");
  assert.equal(water.status, "Proxy");
  assert.equal(water.label, "PROXY");
  assert.equal(water.text, "nearby river name only");
  assert.equal(water.proxyFrom, "NHD name plus a state water plan");
  const hv = rows.find((row) => row.id === "hv");
  assert.equal(hv.status, "Scenario");
  assert.equal(hv.label, "SCENARIO");
  assert.match(hv.text, /Lead time: typed by hand/);
  assert.equal(hv.text.includes("Unit cost"), false);
});

test("site brief carries truth labels and does not invent a figure", () => {
  const md = siteBriefMarkdown({
    pin: { lng: -97.6961, lat: 26.1906 },
    rows: [
      {
        question: "Is demand rising here?",
        answer: "UNKNOWN",
        truth: "UNKNOWN",
        source: "EIA Open Data",
        url: "https://www.eia.gov/opendata/browser/electricity/rto/region-data",
      },
    ],
  });
  assert.match(md, /Truth: UNKNOWN/);
  assert.match(md, /26\.19060, -97\.69610/);
  assert.equal(md.includes("—"), false);
  assert.equal(md.includes("MW"), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  ESTIMATE_NOTE,
  acresLabel,
  analyzeCutFill,
  bilinear,
  buildDxf,
  buildPdf,
  computeDrainage,
  densifyLngLat,
  fitPlane,
  formatReadout,
  isLidarMeter,
  profileCsv,
  profileStats,
  splitByBarrier,
  traceDrainage,
  buildGridSpec,
} from "./terrain-math.mjs";

test("elevation sample bilinear and readout", () => {
  const width = 4;
  const grid = new Float32Array(16);
  grid.fill(NaN);
  grid[5] = 100;
  grid[6] = 110;
  grid[9] = 100;
  grid[10] = 110;
  const mid = bilinear(grid, width, 1.5, 1.5);
  assert.ok(Math.abs(mid - 105) < 1e-6);
  assert.equal(bilinear(grid, width, 0.2, 0.2), null);
  assert.equal(isLidarMeter(NaN), false);
  assert.equal(isLidarMeter(-4000), false);
  const hit = formatReadout(100, 35.69078, -90.04448);
  assert.equal(hit, "328.08 ft (100.00 m) · 35.69078, -90.04448");
  assert.equal(formatReadout(null, 35.69, -90.04), "no lidar here · 35.69000, -90.04000");
  assert.equal(hit.includes("\u2013"), false);
  assert.equal(hit.includes("\u2014"), false);
});

test("cut and fill plane, slope, and yard volumes", () => {
  const xs = new Float32Array([0, 10, 0, 10]);
  const ys = new Float32Array([0, 0, 10, 10]);
  const zs = new Float32Array([100, 100.1, 100, 100.1]);
  const sec = new Int16Array([0, 0, 0, 0]);
  const fit = fitPlane(xs, ys, zs, sec, 0);
  assert.ok(Math.abs(fit.slope - 1) < 0.02, "slope " + fit.slope);
  assert.ok(Math.abs(fit.heading - 270) < 1, "heading " + fit.heading);

  const flatZ = new Float32Array([0, 0, 2, 2]);
  const result = analyzeCutFill({
    xs,
    ys,
    zs: flatZ,
    sec,
    cellM: 10,
    ratio: 1,
    overrides: { 0: { slope: 0, heading: 0 } },
  });
  assert.equal(result.sections.length, 1);
  assert.ok(Math.abs(result.totals.cutYd - result.totals.fillYd) < 0.2);
  const expected = (2 * 100) / 0.764554857984;
  assert.ok(Math.abs(result.totals.cutYd - expected) < 0.5, "cut " + result.totals.cutYd);
  assert.ok(Math.abs(result.totals.maxCutFt - 3.28084) < 0.05, "max cut ft " + result.totals.maxCutFt);
  assert.equal(result.sections[0].slope, 0);
});

test("profile csv columns and distance", () => {
  const pts = [
    [-86.8628025, 40.4074672],
    [-86.862, 40.4079],
  ];
  const dense = densifyLngLat(pts, 3);
  assert.ok(dense.samples.length > 2);
  assert.equal(dense.samples[0].dM, 0);
  dense.samples.forEach((p, i) => {
    p.zM = i === 3 ? NaN : 200;
  });
  const csv = profileCsv(dense.samples);
  const lines = csv.trim().split(/\r\n/);
  assert.equal(lines[0], "distance_ft,elevation_ft,lat,lon");
  const first = lines[1].split(",");
  assert.equal(first[0], "0.00");
  assert.equal(first[1], "656.168");
  assert.equal(first.length, 4);
  const blank = lines.find((line) => line.split(",")[1] === "");
  assert.ok(blank);
  const stats = profileStats(dense.samples, dense.totalM);
  assert.equal(stats.startFt.toFixed(3), "656.168");
  assert.ok(stats.lengthFt > 1);
  assert.equal(csv.includes("\u2014"), false);
});

test("dxf smoke has plan layers and the estimate note", () => {
  const dxf = buildDxf({
    note: ESTIMATE_NOTE + " Plan units are feet.",
    polylines: [
      { layer: "PAD", pts: [[0, 0], [100, 0], [100, 80]], closed: true },
      { layer: "EXISTING_CONT", pts: [[0, 10], [100, 12]], closed: false },
      { layer: "DESIGN_CONT", pts: [[0, 20], [100, 20]], closed: false },
      { layer: "PROFILE", pts: [[0, 660], [120, 664]], closed: false },
      { layer: "DRAINAGE", pts: [[10, 10], [40, 30], [80, 20]], closed: false },
    ],
    points: [{ layer: "OUTLETS", xy: [80, 20], label: "18.1 ac" }],
  });
  for (const layer of ["PAD", "EXISTING_CONT", "DESIGN_CONT", "PROFILE", "DRAINAGE", "OUTLETS"]) {
    assert.equal(dxf.includes("\n8\n" + layer + "\n"), true, layer);
  }
  assert.equal(dxf.includes("LWPOLYLINE"), true);
  assert.equal(dxf.includes("\n0\nPOINT\n"), true);
  assert.equal(dxf.trim().endsWith("EOF"), true);
  assert.equal(dxf.includes("USGS 3DEP estimate"), true);
  assert.equal(dxf.includes("$INSUNITS"), true);
});

test("pdf names the usgs estimate", () => {
  const pdf = buildPdf({
    title: "Siteline terrain",
    lines: ["Cut 1200 yd3", "Fill 1100 yd3", "Slope 0.455% toward 216.0 deg"],
  });
  const text = new TextDecoder().decode(pdf);
  assert.equal(text.startsWith("%PDF-1.4"), true);
  assert.equal(text.includes("%%EOF"), true);
  assert.equal(text.includes("USGS 3DEP estimate. Verify with survey."), true);
  assert.equal(text.includes("Siteline terrain"), true);
  const xref = text.match(/startxref\n(\d+)/);
  assert.ok(xref);
  assert.equal(text.indexOf("xref"), Number(xref[1]));
});

test("d8 flow accumulation runs downhill to an outlet", () => {
  const width = 5;
  const height = 5;
  const elev = new Float32Array(width * height);
  const inside = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      elev[y * width + x] = 100 - x;
      inside[y * width + x] = 1;
    }
  }
  const drain = computeDrainage(elev, width, height, inside);
  const east = 2 * width + 4;
  const west = 2 * width + 0;
  assert.equal(drain.receiver[west], west + 1);
  assert.equal(drain.acc[east], 5);
  const spec = {
    width,
    height,
    cell: 10,
    cm: 10,
    minX: 0,
    maxY: 0,
  };
  const drawn = traceDrainage(spec, elev, inside, drain, 0.05);
  assert.ok(drawn.lines.length > 0);
  assert.ok(drawn.outlets.length > 0);
  assert.ok(drawn.arrows.length > 0);
  assert.ok(drawn.outlets.some((ot) => ot.acres > 0.1));
  assert.equal(acresLabel(18.1), "18.1 ac");
  assert.equal(acresLabel(16), "16 ac");
});

test("split barrier divides a pad into two sections", () => {
  const width = 8;
  const height = 8;
  const sec = new Int16Array(width * height);
  const barrier = [];
  for (let y = 0; y < height; y++) barrier.push(y * width + 3);
  const split = splitByBarrier(sec, width, height, barrier);
  assert.equal(split.added, 1);
  const ids = new Set(split.sec);
  assert.equal(ids.has(0), true);
  assert.equal(ids.has(1), true);
});

test("grid spec stays finite for a small ring", () => {
  const spec = buildGridSpec(
    [
      [-90.05, 35.69],
      [-90.04, 35.69],
      [-90.04, 35.7],
      [-90.05, 35.7],
    ],
    20000,
  );
  assert.ok(spec.width > 2 && spec.height > 2);
  assert.ok(spec.cell > 0);
  assert.equal(spec.includes?.("\u2014"), undefined);
});

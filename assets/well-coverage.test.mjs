import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { NO_FEED, formatCount, stateAt, wellStateCard } from "./well-coverage.mjs";

const manifest = JSON.parse(readFileSync(new URL("../tiles/gaswells-manifest.json", import.meta.url), "utf8"));

test("state lookup hits Ohio, Texas, and misses the ocean", () => {
  assert.equal(stateAt(-82.81, 40.08), "OH");
  assert.equal(stateAt(-102.08, 31.997), "TX");
  assert.equal(stateAt(-77.49, 39.04), "VA");
  assert.equal(stateAt(-104.228, 32.421), "NM");
  assert.equal(stateAt(-112.07, 33.45), "AZ");
  assert.equal(stateAt(0, 0), "");
});

test("wells card reads the manifest by state", () => {
  const ohio = wellStateCard(manifest, [-82.81, 40.08]);
  assert.equal(ohio.name, "Ohio");
  assert.equal(ohio.wired, true);
  assert.equal(ohio.coverage, "live full status");
  assert.equal(ohio.agency, "Ohio DNR Division of Oil and Gas");
  assert.equal(ohio.active, 53295);
  assert.equal(ohio.inactive, 6451);
  assert.equal(ohio.plugged, 44411);
  assert.equal(ohio.sourceUpdated, "2026-09-21");
  assert.equal(ohio.message, "");
  assert.equal(formatCount(ohio.active), "53,295");

  const texas = wellStateCard(manifest, [-102.08, 31.997]);
  assert.equal(texas.name, "Texas");
  assert.equal(texas.coverage, "partial status");
  assert.equal(texas.sourceUpdated, "UNKNOWN");
  assert.match(texas.note, /No operator or dates/);

  const arizona = wellStateCard(manifest, [-112.07, 33.45]);
  assert.equal(arizona.gap, true);
  assert.equal(arizona.wired, false);
  assert.equal(arizona.message, NO_FEED);
  assert.equal(arizona.active, "UNKNOWN");

  const georgia = wellStateCard(manifest, [-84.39, 33.75]);
  assert.equal(georgia.message, NO_FEED);

  const ocean = wellStateCard(manifest, [0, 0]);
  assert.equal(ocean.code, "");
  assert.match(ocean.message, /State UNKNOWN/);
});

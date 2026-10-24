import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JUMP_PLACES } from "./jump-places.mjs";
import { viewFromSearch } from "./map-view.mjs";
import { REGIONS } from "./site-catalog.mjs";

const dock = readFileSync(new URL("./siteline-dock.js", import.meta.url), "utf8");

function chip(id) {
  const match = dock.match(new RegExp(id + ": \\{ center: \\[([^\\]]+)\\], zoom: ([0-9.]+) \\}"));
  assert.ok(match, id);
  const center = match[1].split(",").map((part) => Number(part.trim()));
  return { center, zoom: Number(match[2]) };
}

test("preset deep links use the map chip cameras", () => {
  for (const region of REGIONS) {
    const fromChip = chip(region.id);
    assert.deepEqual(region.center, fromChip.center);
    assert.equal(region.zoom, fromChip.zoom);
    const view = viewFromSearch("?place=" + region.id);
    assert.equal(view.source, "place");
    assert.deepEqual(view.center, region.center);
    assert.equal(view.zoom, region.zoom);
  }
  for (const id of ["ashburn", "abilene", "permian"]) {
    const jump = JUMP_PLACES.find((place) => place.id === id);
    const region = REGIONS.find((place) => place.id === id);
    assert.deepEqual(region.center, jump.center);
    assert.equal(region.zoom, jump.zoom);
  }
});

test("aliases and coordinates", () => {
  assert.equal(viewFromSearch("?place=nova").id, "ashburn");
  assert.equal(viewFromSearch("?place=loudoun").id, "ashburn");
  assert.equal(viewFromSearch("?region=se-nm").id, "permian");
  assert.equal(viewFromSearch("?place=nope"), null);
  assert.equal(viewFromSearch(""), null);
  const coords = viewFromSearch("?place=ashburn&lat=32.45&lng=-99.73&z=8");
  assert.equal(coords.source, "coordinates");
  assert.deepEqual(coords.center, [-99.73, 32.45]);
  assert.equal(coords.zoom, 8);
  assert.equal(viewFromSearch("?lat=99&lng=0"), null);
  assert.equal(viewFromSearch("?lat=10&lng=10").zoom, 9.5);
});

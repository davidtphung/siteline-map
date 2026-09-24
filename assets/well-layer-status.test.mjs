import assert from "node:assert/strict";
import test from "node:test";
import { describeWellState } from "./well-layer-status.mjs";

test("off layers stay quiet", () => {
  assert.equal(describeWellState({ on: false, zoom: 8, health: "ok", title: "4 drawn" }), "");
});

test("below min zoom asks the user to zoom", () => {
  assert.equal(
    describeWellState({ on: true, zoom: 4, minZoom: 6, health: "idle", title: "" }),
    "zoom in to see (minzoom 6)",
  );
});

test("counts and failures", () => {
  assert.equal(describeWellState({ on: true, zoom: 8, health: "loading" }), "loading");
  assert.equal(describeWellState({ on: true, zoom: 8, health: "ok", title: "12 drawn (bbox sample)" }), "12 shown");
  assert.equal(describeWellState({ on: true, zoom: 8, health: "empty", title: "0 drawn" }), "0 shown");
  assert.equal(describeWellState({ on: true, zoom: 8, health: "blocked" }), "source unavailable");
  assert.equal(describeWellState({ on: true, zoom: 8, health: "error" }), "source unavailable");
});

import assert from "node:assert/strict";
import test from "node:test";
import { afterLayerToggle, applyLegendClick, applyMapTap, gasStatusSummary, shouldCloseOnMapTap } from "./dock-mode.mjs";

test("Inspect card persists across map taps", () => {
  let state = { mode: "inspect", open: true, tab: "inspect", pin: null };
  state = applyMapTap(state, { lng: -97.66, lat: 26.19 });
  state = applyMapTap(state, { lng: -97.5, lat: 26.2 });
  assert.equal(state.open, true);
  assert.equal(state.tab, "inspect");
  assert.deepEqual(state.pin, { lng: -97.5, lat: 26.2 });
  const browse = applyMapTap({ mode: "browse", open: true, tab: "layers", pin: { lng: 1, lat: 2 } }, { lng: 3, lat: 4 });
  assert.equal(browse.pin, null);
});

test("Browse legend click opens info", () => {
  const next = applyLegendClick({ mode: "browse", open: false, tab: "layers", infoLayer: null }, "sl-well-gas");
  assert.equal(next.open, true);
  assert.equal(next.tab, "layers");
  assert.equal(next.infoLayer, "sl-well-gas");
  const inspect = applyLegendClick({ mode: "inspect", open: true, infoLayer: null }, "sl-well-gas");
  assert.equal(inspect.infoLayer, null);
});

test("open Layers, toggle 3 layers, card stays open and scroll is unchanged", () => {
  let state = { open: true, tab: "layers", scroll: 140, mode: "browse" };
  for (let i = 0; i < 3; i++) {
    assert.equal(shouldCloseOnMapTap({ mode: state.mode, insideDock: true, onEmptyMap: true }), false);
    state = afterLayerToggle(state);
  }
  assert.equal(state.open, true);
  assert.equal(state.tab, "layers");
  assert.equal(state.scroll, 140);
});

test("gas well summary counts match the features in view", () => {
  const features = [
    { properties: { commodity_group: "gas", status_code: "current_gas_schedule" } },
    { properties: { commodity_group: "gas", status_code: "current_gas_schedule" } },
    { properties: { commodity_group: "gas", status_code: "inactive_gas" } },
    { properties: { commodity_group: "gas", status_code: "plugged_abandoned_confirmed" } },
    { properties: { commodity_group: "gas", status_code: "orphan" } },
    { properties: { commodity_group: "gas", status_code: "historical_gas_unconfirmed" } },
  ];
  const inView = features.filter((feature) => feature.properties.commodity_group === "gas");
  assert.deepEqual(gasStatusSummary(inView), {
    active: 2,
    inactive: 1,
    plugged_abandoned: 1,
    orphan: 1,
    unknown: 1,
  });
});

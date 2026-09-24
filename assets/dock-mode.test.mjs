import assert from "node:assert/strict";
import test from "node:test";
import { afterFieldInput, afterLayerToggle, applyLegendClick, applyMapTap, DOCK_TABS, dockTabMove, escapeInField, gasStatusSummary, keyboardResizeKeepsSheet, shouldCloseFromPointer, shouldCloseOnMapTap, shouldMoveDockTab, shouldSwipeClose } from "./dock-mode.mjs";

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

test("dock tabs run Layers, Jump, Inspect, Wells, About", () => {
  assert.deepEqual(
    DOCK_TABS.map((tab) => tab.id),
    ["layers", "jump", "inspect", "wells", "about"],
  );
  assert.deepEqual(
    DOCK_TABS.map((tab) => tab.pane),
    ["sl-pane-layers", "sl-pane-jump", "sl-pane-inspect", "sl-pane-wells", "sl-pane-about"],
  );
  const wells = DOCK_TABS.find((tab) => tab.id === "wells");
  assert.equal(wells.badge, true);
  assert.equal(DOCK_TABS.find((tab) => tab.id === "about").badge, undefined);
  const inspect = DOCK_TABS.findIndex((tab) => tab.id === "inspect");
  assert.equal(DOCK_TABS[dockTabMove(inspect, "ArrowRight")].id, "wells");
  assert.equal(DOCK_TABS[dockTabMove(inspect + 1, "ArrowRight")].id, "about");
  assert.equal(DOCK_TABS[dockTabMove(DOCK_TABS.length - 1, "ArrowLeft")].id, "wells");
  assert.equal(DOCK_TABS[dockTabMove(2, "Home")].id, "layers");
  assert.equal(DOCK_TABS[dockTabMove(0, "End")].id, "about");
});

test("type 10 characters into a Wells input, card stays open, input keeps focus and value", () => {
  let state = { open: true, tab: "wells", value: "", caret: 0, focused: true };
  const text = "abandoned1";
  for (const ch of text) {
    assert.equal(shouldMoveDockTab({ tagName: "INPUT", closest: () => null }), false);
    assert.equal(shouldCloseFromPointer({ insideCard: true, fromCard: true, typing: true }), false);
    state = afterFieldInput(state, { value: state.value + ch, caret: state.value.length + 1 });
  }
  assert.equal(text.length, 10);
  assert.equal(state.open, true);
  assert.equal(state.tab, "wells");
  assert.equal(state.focused, true);
  assert.equal(state.value, text);
  assert.equal(state.caret, 10);
  const cleared = escapeInField({ value: state.value, focused: true });
  assert.equal(cleared.action, "clear");
  assert.equal(cleared.focused, true);
  const blurred = escapeInField({ value: "", focused: true });
  assert.equal(blurred.action, "blur");
  assert.equal(keyboardResizeKeepsSheet(state.open), true);
  assert.equal(shouldSwipeClose({ dy: 80, typing: true, fromHandle: true }), false);
  assert.equal(shouldCloseFromPointer({ insideCard: false, fromCard: false, typing: false }), true);
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

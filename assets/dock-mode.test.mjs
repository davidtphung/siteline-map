import assert from "node:assert/strict";
import test from "node:test";
import { afterFieldInput, afterLayerToggle, applyBrowseFeatureTap, applyEmptyBrowseTap, applyInspectFeatureTap, applyLegendClick, applyMapTap, clusterStatusLine, cycleFeature, DOCK_TABS, dockTabMove, escapeInField, featureSummary, gasStatusSummary, hitBox, hitPadding, isInteractiveFeature, keyboardResizeKeepsSheet, moreHereLine, registeredLayerIds, shouldCloseFromPointer, shouldCloseOnMapTap, shouldMoveDockTab, shouldSwipeClose, tapHandlerFor } from "./dock-mode.mjs";

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

test("Browse tap on a feature opens the popup with the right fields", () => {
  const well = {
    layer: { id: "sl-wells-pt", type: "circle" },
    properties: {
      api_raw: "06100001",
      operator_name: "Fixture Operator",
      status_label: "Historical gas well \u2014 status unconfirmed",
      commodity_group: "gas",
      dataset_origin: "fixture",
      source_of_record: "Texas RRC",
    },
  };
  const other = { layer: { id: "hifld-subs", type: "circle" }, properties: { NAME: "Ashburn" } };
  const state = applyBrowseFeatureTap({ mode: "browse", open: true, tab: "layers", pin: null, popup: null }, [well, other]);
  assert.equal(state.pin, null);
  assert.equal(state.popup.total, 2);
  assert.equal(state.popup.index, 0);
  const card = featureSummary(well);
  assert.equal(card.name, "06100001");
  assert.equal(card.layer, "Wells");
  assert.equal(card.source, "Texas RRC");
  assert.equal(card.vintage, "UNKNOWN");
  assert.equal(card.sample, true);
  assert.deepEqual(card.fields.find((row) => row[0] === "Operator"), ["Operator", "Fixture Operator"]);
  assert.equal(card.fields.find((row) => row[0] === "Status")[1].includes("\u2014"), false);
  assert.equal(moreHereLine(1), "+1 more here");
  assert.equal(cycleFeature(state.popup).index, 1);
  assert.equal(hitPadding(false), 10);
  assert.equal(hitPadding(true), 14);
  assert.deepEqual(hitBox({ x: 20, y: 30 }, false), [[10, 20], [30, 40]]);
});

test("gas well popup shows the dashed API, raw status, and a real date", () => {
  const card = featureSummary({
    layer: { id: "sl-gaswells-pt", type: "circle" },
    properties: {
      api: "30015203680000",
      name: "LITTLE JEWEL COM #001",
      operator: "MEWBOURNE OIL CO",
      commodity: "gas",
      status_raw: "Active",
      status_date: "2026-07-01",
      source_updated: "2026-08-01",
      state: "NM",
      source_name: "New Mexico Oil Conservation Division",
    },
  });
  assert.equal(card.name, "LITTLE JEWEL COM #001");
  assert.equal(card.fields.find((row) => row[0] === "API")[1], "30-015-20368");
  assert.equal(card.fields.find((row) => row[0] === "Status")[1], "Active");
  assert.equal(card.fields.find((row) => row[0] === "Type")[1], "gas");
  assert.equal(card.source, "New Mexico Oil Conservation Division");
  assert.equal(card.vintage, "data as of 2026-07-01");
  const dashed = featureSummary({
    layer: { id: "sl-gaswells-pt", type: "circle" },
    properties: { api: "30-015-20325", status_raw: "Temporary Abandonment", status_date: "UNKNOWN", source_updated: "2026-08-01", state: "NM" },
  });
  assert.equal(dashed.fields.find((row) => row[0] === "API")[1], "30-015-20325");
  assert.equal(dashed.vintage, "data as of 2026-08-01");
});

test("Browse tap on empty map opens no popup", () => {
  const state = applyEmptyBrowseTap({ mode: "browse", open: true, tab: "layers", pin: null, popup: { index: 0, total: 1 } });
  assert.equal(state.popup, null);
  assert.equal(state.pin, null);
  const missed = applyBrowseFeatureTap({ mode: "browse", pin: null, popup: { index: 0, total: 1 } }, [
    { layer: { id: "sl-contour-lines", type: "line" }, properties: {} },
  ]);
  assert.equal(missed.popup, null);
});

test("Inspect tap still pins and keeps feature details", () => {
  const feature = { layer: { id: "hifld-subs", type: "circle" }, properties: { NAME: "Ashburn sub" } };
  const state = applyInspectFeatureTap({ mode: "inspect", open: true, tab: "inspect", pin: null }, { lng: -77.49, lat: 39.04 }, [feature]);
  assert.equal(state.open, true);
  assert.equal(state.tab, "inspect");
  assert.deepEqual(state.pin, { lng: -77.49, lat: 39.04 });
  assert.equal(state.feature.properties.NAME, "Ashburn sub");
  assert.equal(featureSummary(feature).layer, "Substations");
  const again = applyInspectFeatureTap(state, { lng: -77.5, lat: 39.1 }, [feature]);
  assert.equal(again.open, true);
  assert.deepEqual(again.pin, { lng: -77.5, lat: 39.1 });
});

test("every registered layer has a tap handler", () => {
  const ids = registeredLayerIds();
  assert.ok(ids.includes("sl-wells-cluster"));
  assert.ok(ids.includes("sl-live-wells-cluster"));
  assert.ok(ids.includes("hifld-subs"));
  assert.ok(ids.includes("hifld-tx"));
  assert.ok(ids.includes("eia-plants"));
  assert.ok(ids.includes("osm-datacenters"));
  assert.ok(ids.includes("fema-flood"));
  assert.ok(ids.includes("fcc-bdc"));
  assert.ok(ids.includes("nhd-flowline"));
  assert.ok(ids.includes("sl-util-territory"));
  for (const id of ids) assert.equal(typeof tapHandlerFor(id), "function");
  assert.equal(isInteractiveFeature({ layer: { id: "fema-flood", type: "fill" } }), true);
  assert.equal(tapHandlerFor("a-layer-added-later")({ layer: { id: "a-layer-added-later" }, properties: {} }).kind, "feature");
  assert.equal(clusterStatusLine([{ properties: { status: "Active" } }, { properties: { status_class: "inactive" } }]), "Active 1, Inactive or TA 1");
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

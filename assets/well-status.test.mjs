import assert from "node:assert/strict";
import test from "node:test";
import { ORANGE, AMBER, PARTIAL_NOT_PLUGGED_LABEL, TEXAS_ACTIVE_LABEL, TEXAS_SHUTIN_LABEL, honestStatus, includeWell, statusClass, statusPaint, styleWaitDecision } from "./well-status.mjs";

test("style wait resets on every trigger and does not stick after 12 misses", () => {
  const stuck = 12;
  const missed = styleWaitDecision(false);
  assert.equal(missed.action, "wait-idle");
  assert.equal(missed.tries, 0);
  assert.notEqual(missed.tries, stuck);
  const ready = styleWaitDecision(true);
  assert.equal(ready.action, "fetch");
  assert.equal(ready.tries, 0);
});

test("active wells are solid orange and inactive wells are an amber ring", () => {
  assert.equal(statusClass("Active"), "active");
  assert.equal(statusClass("PR"), "active");
  assert.equal(statusClass("Temporary Abandonment"), "inactive");
  assert.equal(statusClass("TA expired"), "inactive");
  assert.equal(statusClass("SI"), "inactive");
  assert.equal(statusClass("TA"), "inactive");
  assert.equal(statusClass("Plugged"), "plugged");
  assert.equal(statusClass("Cancelled"), "plugged");
  const active = statusPaint("active");
  const idle = statusPaint("inactive");
  assert.equal(active.fill, ORANGE);
  assert.equal(active.stroke, "#14120e");
  assert.ok(active.radius >= 5);
  assert.equal(idle.fill, AMBER);
  assert.equal(idle.stroke, ORANGE);
  assert.equal(includeWell("Plugged", false), false);
  assert.equal(includeWell("Active", false), true);
  assert.equal(includeWell("Plugged", true), true);
});

test("partial states keep colors and say what the source does not confirm", () => {
  assert.equal(honestStatus({ state: "TX", status_class: "active", status_raw: "Gas Well" }), TEXAS_ACTIVE_LABEL);
  assert.equal(honestStatus({ state: "TX", status_class: "inactive", status_raw: "Shut-In Gas" }), TEXAS_SHUTIN_LABEL);
  assert.equal(honestStatus({ state: "TX", status_class: "plugged", status_raw: "Plugged Gas Well" }), "Plugged Gas Well");
  assert.equal(honestStatus({ state: "KS", status_class: "active", status_raw: "GAS" }), PARTIAL_NOT_PLUGGED_LABEL);
  assert.equal(honestStatus({ state: "KY", status_class: "active", status_raw: "0" }), PARTIAL_NOT_PLUGGED_LABEL);
  assert.equal(honestStatus({ state: "IL", status_class: "active", status_raw: "Active" }), PARTIAL_NOT_PLUGGED_LABEL);
  assert.equal(honestStatus({ state: "AK", status_class: "active", status_raw: "1-GAS" }), PARTIAL_NOT_PLUGGED_LABEL);
  assert.equal(honestStatus({ state: "KS", status_class: "plugged", status_raw: "GAS-P&A" }), "GAS-P&A");
  assert.equal(honestStatus({ state: "NM", status_class: "active", status_raw: "Active" }), "Active");
  assert.equal(TEXAS_ACTIVE_LABEL.includes("\u2014"), false);
});

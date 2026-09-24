import assert from "node:assert/strict";
import test from "node:test";
import { ORANGE, AMBER, includeWell, statusClass, statusPaint, styleWaitDecision } from "./well-status.mjs";

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

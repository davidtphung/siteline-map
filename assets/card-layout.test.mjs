import assert from "node:assert/strict";
import test from "node:test";
import { boxesIntersect, cardRects, layoutConflicts, openCard } from "./card-layout.mjs";

test("Site Brief and Wells do not overlap at 390, 470, or 1280", () => {
  const heights = { 390: 844, 470: 900, 1280: 800 };
  for (const width of [390, 470, 1280]) {
    let state = { width, open: {} };
    state = openCard(state, "brief");
    state = openCard(state, "wells");
    const { placed, hits } = layoutConflicts(state, { width, height: heights[width] });
    assert.equal(hits.length, 0, width + " " + JSON.stringify(hits) + " " + JSON.stringify(placed.rects));
    const cards = Object.values(placed.rects);
    assert.equal(cards.length, 2);
    assert.equal(boxesIntersect(cards[0], cards[1]), false);
    assert.equal(boxesIntersect(cards[0], placed.dock), false);
    assert.equal(boxesIntersect(cards[1], placed.zoom), false);
    assert.equal(boxesIntersect(cards[0], placed.modeSwitch), false);
  }
});

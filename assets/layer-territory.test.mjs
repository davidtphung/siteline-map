import assert from "node:assert/strict";
import test from "node:test";
import {
  esriPolygonsToCollection,
  utilitySummary,
  utilityTypeLabel,
} from "./layer-territory.mjs";

test("utility type labels stay plain", () => {
  assert.equal(utilityTypeLabel("COOPERATIVE"), "Co-op");
  assert.equal(utilityTypeLabel("INVESTOR OWNED"), "IOU");
  assert.equal(utilityTypeLabel("MUNICIPAL"), "Muni");
  assert.equal(utilityTypeLabel(""), "UNKNOWN");
  assert.equal(utilityTypeLabel(null), "UNKNOWN");
});

test("summary never invents a name", () => {
  assert.deepEqual(utilitySummary({ NAME: "MAGIC VALLEY ELECTRIC COOP INC", TYPE: "COOPERATIVE" }), {
    name: "MAGIC VALLEY ELECTRIC COOP INC",
    type: "Co-op",
  });
  assert.deepEqual(utilitySummary({}), { name: "UNKNOWN", type: "UNKNOWN" });
});

test("esri rings become polygons and drop empty geometry", () => {
  const collection = esriPolygonsToCollection({
    features: [
      { attributes: { OBJECTID: 7, NAME: "A", TYPE: "MUNICIPAL" }, geometry: { rings: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } },
      { attributes: { NAME: "skip" }, geometry: {} },
    ],
  });
  assert.equal(collection.features.length, 1);
  assert.equal(collection.features[0].geometry.type, "Polygon");
  assert.equal(collection.features[0].id, 7);
});

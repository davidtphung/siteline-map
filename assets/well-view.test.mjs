import assert from "node:assert/strict";
import test from "node:test";
import { featuresInBounds, sourceForView, wellViewHeader } from "./well-view.mjs";

test("wells header follows Cameron and the Permian", () => {
  const cameron = wellViewHeader({
    center: [-97.66, 26.19],
    fixtureInView: 14,
  });
  assert.equal(cameron.place, "Cameron County, TX");
  assert.equal(cameron.source, "Sample data");
  assert.equal(cameron.sample, true);

  const permian = wellViewHeader({
    center: [-103.7, 32.4],
    fixtureInView: 0,
  });
  assert.equal(permian.place, "Permian Basin and SE New Mexico");
  assert.equal(permian.sample, false);
  assert.notEqual(permian.source, "Sample data");
  assert.equal(sourceForView([-103.7, 32.4]), "NM OCD");
  assert.equal(sourceForView([-102.2, 31.8]), "Texas RRC");
  assert.equal(sourceForView([-105.5, 39.7]), "CO ECMC");

  const inView = featuresInBounds(
    [
      { geometry: { coordinates: [-97.66, 26.19] } },
      { geometry: { coordinates: [-103.7, 32.4] } },
    ],
    { west: -98, east: -97, south: 26, north: 27 },
  );
  assert.equal(inView.length, 1);
});

import assert from "node:assert/strict";
import test from "node:test";
import { featuresInBounds, sourceForView, wellViewHeader } from "./well-view.mjs";

const manifest = {
  states: {
    TX: {
      coverage: "partial status",
      agency: "Railroad Commission of Texas (RRC)",
      source_name: "RRC GIS",
      source_url: "https://www.rrc.texas.gov/",
      source_updated: "UNKNOWN",
      counts: { active: 10, inactive: 2, plugged: 3 },
      note: "RRC GIS has shut-in versus gas-well status only.",
    },
    NM: {
      coverage: "live full status",
      agency: "NM EMNRD Oil Conservation Division",
      source_name: "NM OCD",
      source_url: "https://www.emnrd.nm.gov/",
      source_updated: "2026-08-01",
      counts: { active: 4, inactive: 1, plugged: 2 },
    },
  },
};

test("wells header follows the state under the map", () => {
  const cameron = wellViewHeader({
    center: [-97.66, 26.19],
    manifest,
    fixtureInView: 14,
  });
  assert.equal(cameron.place, "Texas");
  assert.equal(cameron.source, "Railroad Commission of Texas (RRC)");
  assert.equal(cameron.sample, false);
  assert.equal(cameron.card.coverage, "partial status");
  assert.equal(cameron.sourceNote.includes("fixture"), false);

  const permian = wellViewHeader({
    center: [-103.7, 32.4],
    manifest,
    fixtureInView: 0,
  });
  assert.equal(permian.place, "New Mexico");
  assert.equal(permian.sample, false);
  assert.equal(permian.source, "NM EMNRD Oil Conservation Division");
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

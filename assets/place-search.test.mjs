import assert from "node:assert/strict";
import test from "node:test";
import { expandUsRoadQuery, parseNominatim, parsePhoton, rankHits, viewboxParam } from "./place-search.mjs";

test("FM and RM numbers expand to OSM road names", () => {
  const fm = expandUsRoadQuery("FM 1420 Harlingen");
  assert.equal(fm.expanded, true);
  assert.equal(fm.query, "Farm to Market Road 1420 Harlingen");
  assert.equal(expandUsRoadQuery("rm-12").query, "Ranch to Market Road 12");
  assert.equal(expandUsRoadQuery("I-2 Harlingen").query, "Interstate 2 Harlingen");
  assert.equal(expandUsRoadQuery("118 E Van Buren Ave, Harlingen, TX").expanded, false);
  assert.equal(expandUsRoadQuery("  ").query, "");
});

test("viewbox is west,north,east,south", () => {
  assert.equal(
    viewboxParam({ west: -97.9, north: 26.4, east: -97.4, south: 26.0 }),
    "-97.90000,26.40000,-97.40000,26.00000",
  );
  assert.equal(viewboxParam(null), "");
});

test("area bias ranks the in-view road above a distant namesake", () => {
  const area = { west: -98.05, south: 25.9, east: -97.25, north: 26.55, center: [-97.66, 26.19] };
  const hits = parseNominatim([
    {
      osm_type: "way",
      osm_id: 1,
      lat: "31.57",
      lon: "-94.59",
      display_name: "Farm to Market Road 507, Nacogdoches, Texas, United States",
      name: "Farm to Market Road 507",
      boundingbox: ["31.5", "31.6", "-94.7", "-94.5"],
      type: "residential",
      importance: 0.4,
    },
    {
      osm_type: "way",
      osm_id: 2,
      lat: "26.23",
      lon: "-97.58",
      display_name: "Farm to Market Road 1420, Cameron County, Texas, United States",
      name: "Farm to Market Road 1420",
      boundingbox: ["26.20", "26.30", "-97.70", "-97.50"],
      type: "secondary",
      importance: 0.05,
    },
  ]);
  const ranked = rankHits(hits, area);
  assert.equal(ranked[0].id, "way:2");
  assert.equal(ranked[0].outside, false);
  assert.equal(ranked[1].outside, true);
  const framed = rankHits(hits, {
    ...area,
    strict: { west: -97.68, south: 26.17, east: -97.64, north: 26.21 },
    frame: { west: -98.2, south: 25.8, east: -97.1, north: 26.7 },
  });
  assert.equal(framed.find((hit) => hit.id === "way:2").outside, false);
  assert.match(ranked[0].subtitle, /Cameron County/);
  assert.doesNotMatch(ranked[0].subtitle, /United States/);
});

test("photon drops non-US hits and reads extent", () => {
  const hits = parsePhoton({
    features: [
      {
        properties: {
          osm_type: "W",
          osm_id: 9,
          countrycode: "HN",
          name: "Rio Hondo",
          type: "district",
        },
        geometry: { type: "Point", coordinates: [-87.2, 14.2] },
      },
      {
        properties: {
          osm_type: "N",
          osm_id: 10,
          countrycode: "US",
          name: "Rio Hondo",
          state: "Texas",
          type: "city",
          extent: [-97.6, 26.25, -97.55, 26.22],
        },
        geometry: { type: "Point", coordinates: [-97.58, 26.235] },
      },
    ],
  });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].title, "Rio Hondo");
  assert.ok(hits[0].west < hits[0].east);
  assert.ok(hits[0].south < hits[0].north);
});

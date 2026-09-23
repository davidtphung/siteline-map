import assert from "node:assert/strict";
import test from "node:test";
import {
  expandUsRoadQuery,
  nominatimSearchParams,
  parseNominatim,
  parsePhoton,
  parseUsAddress,
  rankHits,
  roadQueryWithPlace,
  texasHint,
  viewboxParam,
} from "./place-search.mjs";

test("FM and RM numbers expand to OSM road names", () => {
  const fm = expandUsRoadQuery("FM 1420 Harlingen");
  assert.equal(fm.expanded, true);
  assert.equal(fm.query, "Farm to Market Road 1420 Harlingen");
  assert.equal(expandUsRoadQuery("rm-12").query, "Ranch to Market Road 12");
  assert.equal(expandUsRoadQuery("I-2 Harlingen").query, "Interstate 2 Harlingen");
  assert.equal(expandUsRoadQuery("118 E Van Buren Ave, Harlingen, TX").expanded, false);
  assert.equal(expandUsRoadQuery("  ").query, "");
  assert.equal(expandUsRoadQuery("FM1420").query, "Farm to Market Road 1420");
  assert.equal(expandUsRoadQuery("F.M. 510").query, "Farm to Market Road 510");
  assert.equal(expandUsRoadQuery("RR 12").query, "Ranch to Market Road 12");
  assert.equal(expandUsRoadQuery("US-77").query, "US Highway 77");
  assert.equal(expandUsRoadQuery("U.S. 83").query, "US Highway 83");
  assert.equal(expandUsRoadQuery("SH 100").query, "State Highway 100");
  assert.equal(expandUsRoadQuery("I69").query, "Interstate 69");
  assert.equal(expandUsRoadQuery("Farm to Market Road 1420").expanded, false);
  assert.equal(expandUsRoadQuery("Farm to Market Road 1420").kind, "Farm to Market Road");
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

test("structured US queries bias Nominatim to address or place", () => {
  const place = parseUsAddress("Rio Hondo, Texas");
  assert.equal(place.mode, "place");
  assert.equal(place.city, "Rio Hondo");
  assert.equal(place.state, "Texas");
  const street = parseUsAddress("123 Main St, Cameron, TX 76520");
  assert.equal(street.mode, "address");
  assert.equal(street.street, "123 Main St");
  assert.equal(street.city, "Cameron");
  assert.equal(street.state, "Texas");
  assert.equal(street.postalcode, "76520");
  assert.equal(parseUsAddress("FM 1420"), null);

  const area = { west: -97.9, north: 26.4, east: -97.4, south: 26.0 };
  const cityParams = nominatimSearchParams("Rio Hondo, Texas", area);
  assert.equal(cityParams.params.get("countrycodes"), "us");
  assert.equal(cityParams.params.get("city"), "Rio Hondo");
  assert.equal(cityParams.params.get("state"), "Texas");
  assert.equal(cityParams.params.get("q"), null);
  assert.ok(cityParams.params.get("viewbox"));

  const streetParams = nominatimSearchParams("123 Main St, Cameron, TX", area);
  assert.equal(streetParams.params.get("street"), "123 Main St");
  assert.equal(streetParams.params.get("city"), "Cameron");
  assert.equal(streetParams.params.get("state"), "Texas");
  assert.equal(streetParams.params.get("q"), null);

  const roadParams = nominatimSearchParams("FM 1420", area);
  assert.equal(roadParams.params.get("q"), "Farm to Market Road 1420");
  assert.equal(roadParams.road, true);
  assert.equal(roadParams.params.get("countrycodes"), "us");
});

test("road retry appends a nearby place and Texas when the map is in Texas", () => {
  assert.equal(
    roadQueryWithPlace("Farm to Market Road 1420", "Rio Hondo, Texas"),
    "Farm to Market Road 1420, Rio Hondo, Texas",
  );
  assert.equal(roadQueryWithPlace("Farm to Market Road 1420, Rio Hondo", "Rio Hondo"), "Farm to Market Road 1420, Rio Hondo");
  assert.equal(texasHint({ center: [-97.66, 26.19] }), "Texas");
  assert.equal(texasHint({ center: [-118.2, 34.0] }), "");
});

test("exact in-view place outranks a distant namesake", () => {
  const area = { west: -97.7, south: 26.15, east: -97.5, north: 26.35, center: [-97.58, 26.24] };
  const ranked = rankHits(
    [
      {
        id: "far",
        title: "Rio Hondo",
        subtitle: "California",
        lon: -118.3,
        lat: 33.9,
        west: -118.4,
        east: -118.2,
        south: 33.8,
        north: 34.0,
        importance: 0.9,
        kind: "city",
      },
      {
        id: "near",
        title: "Rio Hondo",
        subtitle: "Cameron County, Texas",
        lon: -97.58,
        lat: 26.23,
        west: -97.6,
        east: -97.55,
        south: 26.2,
        north: 26.26,
        importance: 0.15,
        kind: "town",
      },
    ],
    area,
    "Rio Hondo, Texas",
  );
  assert.equal(ranked[0].id, "near");
  assert.equal(ranked[0].outside, false);
  assert.equal(ranked[1].outside, true);
  assert.ok(ranked[0].score > ranked[1].score);
});

test("address kinds beat a distant same-name place", () => {
  const area = { west: -97.5, south: 30.9, east: -97.2, north: 31.2, center: [-97.4, 31.05] };
  const rows = parseNominatim([
    {
      osm_type: "node",
      osm_id: 3,
      lat: "31.05",
      lon: "-97.40",
      display_name: "Main Street, Cameron, Texas, United States",
      name: "Main Street",
      address: { house_number: "123", road: "Main Street" },
      boundingbox: ["31.05", "31.05", "-97.40", "-97.40"],
      type: "house",
      importance: 0.1,
    },
  ]);
  assert.equal(rows[0].title, "123 Main Street");
  const numbered = parseNominatim([
    {
      osm_type: "node",
      osm_id: 5,
      lat: "26.19",
      lon: "-97.70",
      display_name: "118, East Van Buren Avenue, Harlingen, Cameron County, Texas, 78550, United States",
      name: "",
      address: { house_number: "118", road: "East Van Buren Avenue", city: "Harlingen", state: "Texas" },
      boundingbox: ["26.19", "26.19", "-97.70", "-97.70"],
      type: "house",
    },
  ]);
  assert.equal(numbered[0].title, "118 East Van Buren Avenue");
  assert.match(numbered[0].subtitle, /Harlingen/);
  assert.doesNotMatch(numbered[0].subtitle, /East Van Buren/);
  const ranked = rankHits(
    [
      rows[0],
      {
        id: "town",
        title: "Main Street",
        subtitle: "Ohio",
        lon: -83.0,
        lat: 40.0,
        west: -83,
        east: -83,
        south: 40,
        north: 40,
        importance: 0.7,
        kind: "city",
      },
    ],
    area,
    "123 Main St, Cameron, TX",
  );
  assert.equal(ranked[0].id, "node:3");
  assert.equal(ranked[0].kind, "house");
});

test("hyphenated Farm-to-Market stays with the map view", () => {
  const area = { west: -97.8, south: 26.1, east: -97.4, north: 26.4, center: [-97.58, 26.23] };
  const hits = parseNominatim([
    {
      osm_type: "way",
      osm_id: 9,
      lat: "31.5",
      lon: "-94.6",
      display_name: "Farm-to-Market Road 1420, Nacogdoches County, Texas, United States",
      name: "Farm-to-Market Road 1420",
      boundingbox: ["31.4", "31.6", "-94.7", "-94.5"],
      type: "secondary",
      importance: 0.4,
    },
    {
      osm_type: "way",
      osm_id: 8,
      lat: "26.25",
      lon: "-97.59",
      display_name: "Farm-to-Market Road 1420, Cameron County, Texas, United States",
      name: "Farm-to-Market Road 1420",
      boundingbox: ["26.2", "26.3", "-97.7", "-97.5"],
      type: "secondary",
      importance: 0.05,
    },
  ]);
  const ranked = rankHits(hits, area, "FM 1420");
  assert.equal(ranked[0].id, "way:8");
  assert.equal(ranked[0].outside, false);
  assert.equal(ranked[1].outside, true);
});

test("rankHits keeps at most six and still prefers the map view", () => {
  const area = { west: -97.6, south: 30.9, east: -97.2, north: 31.2, center: [-97.4, 31.0] };
  const hits = [];
  for (let i = 0; i < 8; i += 1) {
    hits.push({
      id: "far-" + i,
      title: "Place " + i,
      subtitle: "Ohio",
      lon: -83,
      lat: 40,
      west: -83,
      east: -83,
      south: 40,
      north: 40,
      importance: 0.4 + i / 100,
      kind: "city",
    });
  }
  hits.push({
    id: "here",
    title: "Cameron",
    subtitle: "Texas",
    lon: -97.4,
    lat: 31.0,
    west: -97.4,
    east: -97.4,
    south: 31,
    north: 31,
    importance: 0.05,
    kind: "town",
  });
  const ranked = rankHits(hits, area, "Cameron, TX");
  assert.equal(ranked.length, 6);
  assert.equal(ranked[0].id, "here");
});

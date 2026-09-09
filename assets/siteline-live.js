/** Siteline live map. Skips the React bundle that freezes the tab. */
import maplibregl from "https://esm.sh/maplibre-gl@4.7.1";

const EIA = "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Power_Plants_in_the_US/FeatureServer/0/query";
const SUBS = "https://services.arcgis.com/njFNhDsUCentVYJW/ArcGIS/rest/services/Substations/FeatureServer/0/query";
const TX = "https://services2.arcgis.com/LYMgRMwHfrWWEg3s/arcgis/rest/services/HIFLD_US_Electric_Power_Transmission_Lines/FeatureServer/0/query";
const FCC = "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/FCC_Broadband_Data_Collection_December_2024_View/FeatureServer";
const OVERPASS = "https://overpass-api.de/api/interpreter";

const empty = { type: "FeatureCollection", features: [] };

function boundsOf(map) {
  const b = map.getBounds();
  return { xmin: b.getWest(), ymin: b.getSouth(), xmax: b.getEast(), ymax: b.getNorth() };
}

function ringToCoords(ring) {
  return ring.map((p) => [p[0], p[1]]);
}

function esriToFeatures(json, kind) {
  const feats = [];
  for (const f of json.features || []) {
    const g = f.geometry;
    if (!g) continue;
    let geometry = null;
    if (g.x != null && g.y != null) geometry = { type: "Point", coordinates: [g.x, g.y] };
    else if (g.paths) geometry = { type: "MultiLineString", coordinates: g.paths.map(ringToCoords) };
    else if (g.rings) geometry = { type: "Polygon", coordinates: g.rings.map(ringToCoords) };
    if (!geometry) continue;
    feats.push({ type: "Feature", properties: Object.assign({ _kind: kind }, f.attributes || {}), geometry });
  }
  return { type: "FeatureCollection", features: feats };
}

async function arcgis(url, bbox, outFields, limit) {
  const q = new URL(url);
  q.searchParams.set("f", "json");
  q.searchParams.set("where", "1=1");
  q.searchParams.set("geometry", `${bbox.xmin},${bbox.ymin},${bbox.xmax},${bbox.ymax}`);
  q.searchParams.set("geometryType", "esriGeometryEnvelope");
  q.searchParams.set("inSR", "4326");
  q.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  q.searchParams.set("outFields", outFields);
  q.searchParams.set("returnGeometry", "true");
  q.searchParams.set("outSR", "4326");
  q.searchParams.set("resultRecordCount", String(limit));
  const res = await fetch(q.href, { credentials: "omit", mode: "cors" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "ArcGIS error");
  return json;
}

async function overpassDcs(bbox) {
  const s = `${bbox.ymin},${bbox.xmin},${bbox.ymax},${bbox.xmax}`;
  const body = `[out:json][timeout:25];(nwr["telecom"="data_center"](${s});nwr["building"="data_centre"](${s});nwr["building"="data_center"](${s}););out center tags;`;
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: "data=" + encodeURIComponent(body),
  });
  if (!res.ok) throw new Error("Overpass HTTP " + res.status);
  const json = await res.json();
  const features = [];
  for (const el of json.elements || []) {
    const lon = el.lon != null ? el.lon : el.center && el.center.lon;
    const lat = el.lat != null ? el.lat : el.center && el.center.lat;
    if (lon == null || lat == null) continue;
    const tags = el.tags || {};
    features.push({
      type: "Feature",
      properties: {
        _kind: "dc",
        name: tags.name || "Data center",
        operator: tags.operator || "",
        osmId: el.type + "/" + el.id,
      },
      geometry: { type: "Point", coordinates: [lon, lat] },
    });
  }
  return { type: "FeatureCollection", features };
}

function setData(map, id, fc) {
  const src = map.getSource(id);
  if (src && src.setData) src.setData(fc);
}

function status(text) {
  const el = document.getElementById("sl-live-status");
  if (el) el.textContent = text;
}

function fccUrl(zoom) {
  if (zoom < 8) return FCC + "/1/query";
  if (zoom < 10) return FCC + "/2/query";
  return FCC + "/3/query";
}

let token = 0;

async function refresh(map) {
  const n = ++token;
  const bbox = boundsOf(map);
  const zoom = map.getZoom();
  status("Loading GIS in view...");
  const jobs = [];

  jobs.push(
    arcgis(EIA, bbox, "Plant_Name,PrimSource,Total_MW,Utility_Name", 400)
      .then((j) => {
        if (n !== token) return;
        setData(map, "src-plants", esriToFeatures(j, "plant"));
      })
      .catch(() => {})
  );
  jobs.push(
    arcgis(SUBS, bbox, "NAME,MAX_VOLT,TYPE,CITY", 300)
      .then((j) => {
        if (n !== token) return;
        setData(map, "src-subs", esriToFeatures(j, "sub"));
      })
      .catch(() => {})
  );
  if (zoom >= 5) {
    jobs.push(
      arcgis(TX, bbox, "VOLTAGE,OWNER,STATUS", 250)
        .then((j) => {
          if (n !== token) return;
          setData(map, "src-tx", esriToFeatures(j, "tx"));
        })
        .catch(() => {})
    );
  } else {
    setData(map, "src-tx", empty);
  }
  jobs.push(
    arcgis(fccUrl(zoom), bbox, "GEOID,TotalBSLs,ServedBSLs,ServedBSLsFiber,UniqueProvidersFiber", 200)
      .then((j) => {
        if (n !== token) return;
        setData(map, "src-broadband", esriToFeatures(j, "bb"));
      })
      .catch(() => {})
  );
  jobs.push(
    overpassDcs(bbox)
      .then((fc) => {
        if (n !== token) return;
        setData(map, "src-datacenters", fc);
      })
      .catch(() => {})
  );

  await Promise.all(jobs);
  if (n !== token) return;
  const counts = ["src-plants", "src-subs", "src-tx", "src-broadband", "src-datacenters"].map((id) => {
    const src = map.getSource(id);
    const data = src && src._data;
    const nfeat = data && data.features ? data.features.length : 0;
    return id.replace("src-", "") + " " + nfeat;
  });
  status(counts.join("  /  "));
}

function showCard(props) {
  const card = document.getElementById("sl-live-card");
  if (!card) return;
  const kind = props._kind || "feature";
  let title = props.name || props.Plant_Name || props.NAME || props.GEOID || kind;
  const lines = [];
  if (kind === "plant") {
    title = props.Plant_Name || "Plant";
    lines.push(props.PrimSource || "fuel UNKNOWN");
    lines.push(props.Total_MW != null ? props.Total_MW + " MW nameplate" : "MW UNKNOWN");
    if (props.Utility_Name) lines.push(props.Utility_Name);
  } else if (kind === "sub") {
    title = props.NAME || "Substation";
    lines.push(props.MAX_VOLT != null ? props.MAX_VOLT + " kV" : "kV UNKNOWN");
    if (props.TYPE) lines.push(props.TYPE);
  } else if (kind === "tx") {
    title = "Transmission";
    lines.push(props.VOLTAGE != null ? props.VOLTAGE + " kV" : "kV UNKNOWN");
    if (props.OWNER) lines.push(props.OWNER);
  } else if (kind === "bb") {
    title = "Broadband " + (props.GEOID || "");
    lines.push("fiber BSLs " + (props.ServedBSLsFiber != null ? props.ServedBSLsFiber : "UNKNOWN"));
    lines.push("served BSLs " + (props.ServedBSLs != null ? props.ServedBSLs : "UNKNOWN"));
  } else {
    title = props.name || "Data center";
    if (props.operator) lines.push(props.operator);
    if (props.osmId) lines.push(props.osmId);
  }
  card.hidden = false;
  card.innerHTML = "<strong>" + title + "</strong><p>" + lines.join("<br>") + "</p>";
}

const style = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png", "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "OpenStreetMap",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const map = new maplibregl.Map({
  container: "sl-live-map",
  style,
  center: [-98.5, 39.5],
  zoom: 3.8,
  attributionControl: true,
  dragRotate: false,
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");

map.on("load", () => {
  map.addSource("src-broadband", { type: "geojson", data: empty });
  map.addSource("src-tx", { type: "geojson", data: empty });
  map.addSource("src-subs", { type: "geojson", data: empty });
  map.addSource("src-plants", { type: "geojson", data: empty });
  map.addSource("src-datacenters", { type: "geojson", data: empty });
  map.addLayer({ id: "fcc-bdc", type: "fill", source: "src-broadband", paint: { "fill-color": "#22d3ee", "fill-opacity": 0.28 } });
  map.addLayer({ id: "hifld-tx", type: "line", source: "src-tx", paint: { "line-color": "#f59e0b", "line-width": 1.6 } });
  map.addLayer({ id: "hifld-subs", type: "circle", source: "src-subs", paint: { "circle-radius": 5, "circle-color": "#fbbf24", "circle-stroke-width": 1, "circle-stroke-color": "#111" } });
  map.addLayer({ id: "eia-plants", type: "circle", source: "src-plants", paint: { "circle-radius": 5, "circle-color": "#38bdf8", "circle-stroke-width": 1, "circle-stroke-color": "#111" } });
  map.addLayer({ id: "osm-datacenters", type: "circle", source: "src-datacenters", paint: { "circle-radius": 6, "circle-color": "#e879f9", "circle-stroke-width": 1.2, "circle-stroke-color": "#111" } });
  map.on("click", (ev) => {
    const hit = map.queryRenderedFeatures(ev.point, { layers: ["osm-datacenters", "eia-plants", "hifld-subs", "hifld-tx", "fcc-bdc"] })[0];
    if (hit) showCard(hit.properties || {});
  });
  refresh(map);
});

let moveT = 0;
map.on("moveend", () => {
  window.clearTimeout(moveT);
  moveT = window.setTimeout(() => refresh(map), 350);
});

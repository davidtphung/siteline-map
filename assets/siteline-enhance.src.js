/**
 * Siteline enhance: OIM overlays + DEM vector contours (maplibre-contour) + HIFLD/OIM/EIA inspect.
 * Honesty: HIFLD/EIA=CATALOG nameplate; OIM=OSM_MAPPED not as-built; contours=DEM-derived CATALOG not survey; no live MW / MVA.
 * NLT143 RESEARCH by David T Phung
 */
const OIM_TILES = ["https://openinframap.org/tiles/{z}/{x}/{y}.pbf"];
const OIM_ATTR =
  "© OpenInfraMap / OpenStreetMap contributors (OSM-mapped, not as-built)";
const SOURCE_ID = "oim-power";
/** EIA interstate/intrastate natural gas transmission. HIFLD-class public catalog, no key. */
const GAS_QUERY =
  "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Natural_Gas_Interstate_and_Intrastate_Pipelines_1/FeatureServer/0/query";
const GAS_SRC = "sl-gas-src";
const GAS_LAYER = "sl-gas-lines";
const GAS_DETAIL_SRC = "sl-gas-detail-src";
const GAS_DETAIL_LAYER = "sl-gas-detail-lines";
const EMPTY_FC = { type: "FeatureCollection", features: [] };
/** AWS elevation-tiles Terrarium DEM (Mapzen encoding). No API key. */
const DEM_TERRARIUM_URL =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const MLCONTOUR_CDN =
  "https://cdn.jsdelivr.net/npm/maplibre-contour@0.0.8/dist/index.min.js";
const CONTOUR_SOURCE = "sl-contour-src";
const CONTOUR_LINE = "sl-contour-lines";
const CONTOUR_LABEL = "sl-contour-labels";
/** Contours hidden below this zoom (US overview must not spaghetti). */
const CONTOUR_MIN_ZOOM = 12;
const FT_MULTIPLIER = 3.28084;
const EPQS_URL = "https://epqs.nationalmap.gov/v1/json";
/** About tab source catalog. Honesty: LIVE / CATALOG / DEM-derived / OSM_MAPPED / UNKNOWN. */
const ABOUT_SOURCES = [
  {
    name: "USGS National Map topo tiles",
    org: "USGS",
    url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer",
    cadence: "raster basemap tiles",
    honesty: "CATALOG",
  },
  {
    name: "Esri World Topo (opacity blend)",
    org: "Esri",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer",
    cadence: "raster basemap tiles",
    honesty: "CATALOG",
  },
  {
    name: "OpenTopoMap",
    org: "OpenTopoMap / OSM",
    url: "https://opentopomap.org/",
    cadence: "raster basemap tiles",
    honesty: "CATALOG",
  },
  {
    name: "HIFLD transmission + substations",
    org: "HIFLD / DHS",
    url: "https://hifld-geoplatform.opendata.arcgis.com/",
    cadence: "ArcGIS feature catalog",
    honesty: "CATALOG",
  },
  {
    name: "Natural gas interstate & intrastate pipelines",
    org: "EIA (HIFLD-class catalog)",
    url: "https://www.eia.gov/maps/layer_info-m.php",
    cadence: "Public pipeline context, separate from wells",
    honesty: "CATALOG",
  },
  {
    name: "Subsea cables (OpenInfraMap / OSM)",
    org: "OpenInfraMap / OpenStreetMap",
    url: "https://openinframap.org/",
    cadence: "vector tiles · communication lines with location=underwater",
    honesty: "OSM_MAPPED",
  },
  {
    name: "EIA plants (nameplate MW)",
    org: "EIA",
    url: "https://www.eia.gov/maps/layer_info-m.php",
    cadence: "plant catalog · nameplate MW",
    honesty: "CATALOG",
  },
  {
    name: "OpenInfraMap / OSM (power, telecom)",
    org: "OpenInfraMap / OpenStreetMap",
    url: "https://openinframap.org/",
    cadence: "vector tiles · OSM-mapped, not as-built",
    honesty: "OSM_MAPPED",
  },
  {
    name: "Contours 5 ft (maplibre-contour + AWS Terrarium DEM)",
    org: "maplibre-contour / AWS elevation-tiles",
    url: "https://github.com/onthegomap/maplibre-contour",
    cadence: "DEM-derived isolines · CATALOG not survey",
    honesty: "DEM-derived",
  },
  {
    name: "USGS EPQS elevation",
    org: "USGS National Map",
    url: "https://epqs.nationalmap.gov/v1/json",
    cadence: "point elev query (Feet, wkid 4326)",
    honesty: "LIVE",
  },
  {
    name: "FCC BDC",
    org: "FCC",
    url: "https://broadbandmap.fcc.gov/",
    cadence: "availability catalog (not as-built fiber)",
    honesty: "CATALOG",
  },
  {
    name: "NHD",
    org: "USGS",
    url: "https://www.usgs.gov/national-hydrography",
    cadence: "hydrography catalog",
    honesty: "CATALOG",
  },
  {
    name: "NETL wells",
    org: "NETL / DOE",
    url: "https://edx.netl.doe.gov/",
    cadence: "Optional non-TX catalog. Not status authority for Texas.",
    honesty: "CATALOG",
  },
  {
    name: "Texas RRC wells (Cameron County first)",
    org: "Texas Railroad Commission",
    url: "https://www.rrc.texas.gov/resource-center/research/data-sets-available-for-download/",
    cadence: "County well layer well061 plus schedules, inactive, orphan, plug evidence",
    honesty: "RRC",
  },
  {
    name: "FEMA",
    org: "FEMA",
    url: "https://www.fema.gov/flood-maps",
    cadence: "NFHL flood hazard catalog",
    honesty: "CATALOG",
  },
];
const X_LINK = "https://x.com/davidtphung";
const SITE_LINK = "https://davidtphung.com/";
const HL_SOURCE = "sl-feature-hl";
const NATIVE = { tx: "hifld-tx", subs: "hifld-subs", plants: "eia-plants" };
const VOLTAGE_SCALE = [
  [null, "#7A7A85"],
  [10, "#6E97B8"],
  [25, "#55B555"],
  [52, "#B59F10"],
  [132, "#B55D00"],
  [220, "#C73030"],
  [310, "#B54EB2"],
  [550, "#00C1CF"],
];
function voltageKvExpr() {
  return [
    "case",
    [">", ["to-number", ["coalesce", ["get", "voltage"], 0]], 2000],
    ["/", ["to-number", ["coalesce", ["get", "voltage"], 0]], 1000],
    ["to-number", ["coalesce", ["get", "voltage"], 0]],
  ];
}
function voltageColorExpr() {
  const step = ["step", voltageKvExpr(), VOLTAGE_SCALE[0][1]];
  for (let i = 1; i < VOLTAGE_SCALE.length; i++)
    step.push(VOLTAGE_SCALE[i][0] - 0.01, VOLTAGE_SCALE[i][1]);
  return [
    "case",
    [
      "all",
      ["has", "frequency"],
      ["==", ["to-number", ["get", "frequency"]], 0],
    ],
    "#4E01B5",
    step,
  ];
}
function lineWidthExpr() {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    3,
    0.7,
    8,
    [
      "interpolate",
      ["linear"],
      voltageKvExpr(),
      0,
      1.2,
      69,
      1.6,
      138,
      2.2,
      230,
      2.8,
      345,
      3.4,
      500,
      4.2,
    ],
    14,
    [
      "interpolate",
      ["linear"],
      voltageKvExpr(),
      0,
      1.6,
      69,
      2.2,
      138,
      3,
      230,
      3.8,
      345,
      4.6,
      500,
      5.5,
    ],
  ];
}
const LAYERS = {
  powerLine: {
    id: "siteline-oim-power-line",
    type: "line",
    "source-layer": "power_line",
    paint: {
      "line-color": voltageColorExpr(),
      "line-width": lineWidthExpr(),
      "line-opacity": 0.92,
    },
  },
  powerSub: {
    id: "siteline-oim-power-sub",
    type: "circle",
    "source-layer": "power_substation_point",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        2.5,
        12,
        5,
        16,
        8,
      ],
      "circle-color": voltageColorExpr(),
      "circle-stroke-width": 1.2,
      "circle-stroke-color": "#111",
      "circle-opacity": 0.92,
    },
  },
  telecomLine: {
    id: "siteline-oim-telecom-line",
    type: "line",
    "source-layer": "telecoms_communication_line",
    filter: ["!=", ["get", "location"], "underwater"],
    paint: {
      "line-color": "#22d3ee",
      "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.9, 13, 2.4],
      "line-opacity": 0.9,
    },
  },
  subseaLine: {
    id: "siteline-oim-subsea-line",
    type: "line",
    "source-layer": "telecoms_communication_line",
    filter: ["==", ["get", "location"], "underwater"],
    paint: {
      "line-color": "#2dd4bf",
      "line-width": ["interpolate", ["linear"], ["zoom"], 2, 1.2, 5, 1.8, 8, 2.5, 12, 3.3],
      "line-opacity": 0.95,
      "line-dasharray": [2, 1.2],
    },
  },
  telecomMast: {
    id: "siteline-oim-telecom-mast",
    type: "circle",
    "source-layer": "telecoms_mast",
    paint: {
      "circle-radius": 3.5,
      "circle-color": "#67e8f9",
      "circle-stroke-width": 1,
      "circle-stroke-color": "#111",
    },
  },
};
const state = {
  power: true,
  telecom: true,
  gas: true,
  subsea: true,
  contours: true,
  gasDetailReady: false,
  gasDetailBbox: "",
  gasDetailToken: 0,
  gasNationalToken: 0,
  mode: "observe",
  map: null,
  clickBound: false,
  selected: null,
  demSource: null,
  contourReady: false,
  epqsSeq: 0,
  elevPin: null,
};
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function val(p, ...keys) {
  for (const k of keys) {
    const v = p?.[k];
    if (v !== null && v !== undefined && v !== "") return v;
  }
  return null;
}
function fmtKv(v) {
  if (v === null || v === undefined || v === "" || Number.isNaN(Number(v)))
    return "UNKNOWN";
  let n = Number(v);
  if (n > 2000) n = n / 1000;
  if (n < 0 || n > 1200) return "UNKNOWN";
  const r =
    Math.abs(n - Math.round(n)) < 0.05
      ? Math.round(n)
      : Math.round(n * 10) / 10;
  return r + " kV";
}
function fmtMwNameplate(v) {
  if (v === null || v === undefined || v === "" || Number.isNaN(Number(v)))
    return "UNKNOWN";
  return (
    Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 }) +
    " MW nameplate"
  );
}
function setVis(map, id, on) {
  if (!map.getLayer(id)) return;
  const next = on ? "visible" : "none";
  if (map.getLayoutProperty(id, "visibility") === next) return;
  map.setLayoutProperty(id, "visibility", next);
}
function setPaintIf(map, id, prop, value) {
  if (!map.getLayer(id)) return;
  let cur;
  try {
    cur = map.getPaintProperty(id, prop);
  } catch (_) {
    cur = undefined;
  }
  try {
    if (JSON.stringify(cur) === JSON.stringify(value)) return;
  } catch (_) {}
  map.setPaintProperty(id, prop, value);
}
function applyVisibility(map) {
  setVis(map, LAYERS.powerLine.id, state.power);
  setVis(map, LAYERS.powerSub.id, state.power);
  setVis(map, LAYERS.telecomLine.id, state.telecom);
  setVis(map, LAYERS.telecomMast.id, state.telecom);
  setVis(map, LAYERS.subseaLine.id, state.subsea);
  setVis(map, GAS_LAYER, state.gas && !state.gasDetailReady);
  setVis(map, GAS_DETAIL_LAYER, state.gas && state.gasDetailReady);
  setVis(map, CONTOUR_LINE, state.contours);
  setVis(map, CONTOUR_LABEL, state.contours);
}
function setFilterIf(map, id, filter) {
  if (!filter || !map.getLayer(id)) return;
  let cur;
  try {
    cur = map.getFilter(id);
  } catch (_) {
    cur = undefined;
  }
  try {
    if (JSON.stringify(cur) === JSON.stringify(filter)) return;
  } catch (_) {}
  map.setFilter(id, filter);
}
function ensureHighlight(map) {
  if (!map.getSource(HL_SOURCE))
    map.addSource(HL_SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  if (!map.getLayer("sl-feature-hl-line"))
    map.addLayer({
      id: "sl-feature-hl-line",
      type: "line",
      source: HL_SOURCE,
      filter: [
        "any",
        ["==", ["geometry-type"], "LineString"],
        ["==", ["geometry-type"], "MultiLineString"],
      ],
      paint: { "line-color": "#7ec8ff", "line-width": 4, "line-opacity": 0.95 },
    });
  if (!map.getLayer("sl-feature-hl-pt"))
    map.addLayer({
      id: "sl-feature-hl-pt",
      type: "circle",
      source: HL_SOURCE,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": 9,
        "circle-color": "rgba(77,163,255,0.25)",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#7ec8ff",
      },
    });
}
function setHighlight(map, feature) {
  ensureHighlight(map);
  const src = map.getSource(HL_SOURCE);
  if (!src) return;
  if (!feature || !feature.geometry) {
    src.setData({ type: "FeatureCollection", features: [] });
    return;
  }
  src.setData({
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: feature.geometry }],
  });
}
function loadMlContour() {
  if (window.mlcontour) return Promise.resolve(window.mlcontour);
  if (window.__mlcontourPromise) return window.__mlcontourPromise;
  window.__mlcontourPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = MLCONTOUR_CDN;
    s.async = true;
    s.onload = () => {
      if (window.mlcontour) resolve(window.mlcontour);
      else reject(new Error("mlcontour global missing"));
    };
    s.onerror = () => reject(new Error("mlcontour CDN load failed"));
    document.head.appendChild(s);
  });
  return window.__mlcontourPromise;
}
function resolveMaplibre() {
  if (window.maplibregl && typeof window.maplibregl.addProtocol === "function")
    return window.maplibregl;
  const map = window.__SITELINE_MAP__;
  if (map && map.constructor && map.constructor.addProtocol)
    return map.constructor;
  return null;
}
async function ensureDemSource() {
  if (state.demSource) return state.demSource;
  const mlcontour = await loadMlContour();
  const maplibregl = resolveMaplibre();
  if (!maplibregl) throw new Error("maplibregl unavailable for DemSource.setupMaplibre");
  const demSource = new mlcontour.DemSource({
    url: DEM_TERRARIUM_URL,
    encoding: "terrarium",
    maxzoom: 15,
    worker: true,
    cacheSize: 100,
    timeoutMs: 10000,
    id: "siteline-dem",
  });
  demSource.setupMaplibre(maplibregl);
  state.demSource = demSource;
  return demSource;
}
function contourBeforeId(map) {
  const prefer = [LAYERS.powerLine.id, NATIVE.tx, LAYERS.telecomLine.id];
  for (const id of prefer) if (map.getLayer(id)) return id;
  const layers = map.getStyle?.()?.layers || [];
  return layers.length ? layers[layers.length - 1].id : undefined;
}
async function addContours(map) {
  if (!map || typeof map.addSource !== "function") return;
  try {
    const demSource = await ensureDemSource();
    if (!map.getSource(CONTOUR_SOURCE)) {
      map.addSource(CONTOUR_SOURCE, {
        type: "vector",
        tiles: [
          demSource.contourProtocolUrl({
            multiplier: FT_MULTIPLIER,
            thresholds: {
              12: [50, 200],
              13: [25, 100],
              14: [5, 25],
              15: [5, 25],
            },
            contourLayer: "contours",
            elevationKey: "ele",
            levelKey: "level",
          }),
        ],
        minzoom: CONTOUR_MIN_ZOOM,
        maxzoom: 15,
        attribution:
          "Contours DEM-derived (AWS Terrarium / Mapzen) · CATALOG · not survey",
      });
    }
    const before = contourBeforeId(map);
    if (!map.getLayer(CONTOUR_LINE)) {
      const line = {
        id: CONTOUR_LINE,
        type: "line",
        source: CONTOUR_SOURCE,
        "source-layer": "contours",
        minzoom: CONTOUR_MIN_ZOOM,
        layout: { visibility: state.contours ? "visible" : "none" },
        paint: {
          "line-color": [
            "match",
            ["get", "level"],
            1,
            "rgba(232, 220, 180, 0.78)",
            "rgba(200, 190, 150, 0.42)",
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            ["match", ["get", "level"], 1, 1.1, 0.45],
            15,
            ["match", ["get", "level"], 1, 1.8, 0.7],
          ],
          "line-opacity": 0.9,
        },
      };
      if (before) map.addLayer(line, before);
      else map.addLayer(line);
    }
    if (!map.getLayer(CONTOUR_LABEL)) {
      const label = {
        id: CONTOUR_LABEL,
        type: "symbol",
        source: CONTOUR_SOURCE,
        "source-layer": "contours",
        minzoom: 14,
        filter: [">", ["get", "level"], 0],
        layout: {
          visibility: state.contours ? "visible" : "none",
          "symbol-placement": "line",
          "text-field": [
            "concat",
            ["number-format", ["get", "ele"], { "max-fraction-digits": 0 }],
            " ft",
          ],
          "text-size": 10,
          "text-font": ["Noto Sans Regular"],
          "text-max-angle": 25,
          "text-padding": 2,
        },
        paint: {
          "text-color": "rgba(236, 228, 196, 0.92)",
          "text-halo-color": "rgba(8, 10, 12, 0.75)",
          "text-halo-width": 1.2,
        },
      };
      if (before) map.addLayer(label, before);
      else map.addLayer(label);
    }
    applyVisibility(map);
    state.contourReady = true;
    setStatus(
      "OIM + Contours 5 ft (DEM Terrarium). DEM-derived · CATALOG · not survey.",
    );
  } catch (err) {
    console.warn("[siteline-enhance] contours failed", err);
    setStatus("Contours UNKNOWN (DEM/maplibre-contour). As-built / survey UNKNOWN.");
  }
}

function gasPaint() {
  return {
    "line-color": "#f59e0b",
    "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.8, 6, 1.45, 10, 2.4, 13, 3.4],
    "line-opacity": 0.92,
    "line-dasharray": [1.5, 1.15],
  };
}
function gasLineLayer(id, source, minzoom) {
  return {
    id,
    type: "line",
    source,
    minzoom: minzoom || 2,
    layout: {
      visibility: state.gas ? "visible" : "none",
      "line-cap": "butt",
      "line-join": "round",
    },
    paint: gasPaint(),
  };
}
async function fetchGasPage(offset, extra) {
  const q = new URL(GAS_QUERY);
  q.searchParams.set("where", "1=1");
  q.searchParams.set("outFields", "TYPEPIPE,Operator,Status");
  q.searchParams.set("returnGeometry", "true");
  q.searchParams.set("outSR", "4326");
  q.searchParams.set("f", "geojson");
  q.searchParams.set("resultRecordCount", "2000");
  q.searchParams.set("resultOffset", String(offset));
  q.searchParams.set("geometryPrecision", extra.precision || "3");
  q.searchParams.set("maxAllowableOffset", extra.offset || "0.05");
  if (extra.bbox) {
    q.searchParams.set("geometry", extra.bbox);
    q.searchParams.set("geometryType", "esriGeometryEnvelope");
    q.searchParams.set("inSR", "4326");
    q.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  }
  const res = await fetch(q.href, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error("EIA gas HTTP " + res.status);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "EIA gas query failed");
  return (json.features || []).filter((f) => f && f.geometry);
}
async function fetchGasCount() {
  const q = new URL(GAS_QUERY);
  q.searchParams.set("where", "1=1");
  q.searchParams.set("returnCountOnly", "true");
  q.searchParams.set("f", "json");
  const res = await fetch(q.href, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error("EIA gas count HTTP " + res.status);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "EIA gas count failed");
  const n = Number(json.count);
  if (!Number.isFinite(n) || n < 0) throw new Error("EIA gas count UNKNOWN");
  return n;
}
async function fetchGasNational(token) {
  const page = 2000;
  const total = await fetchGasCount();
  const features = [];
  const concurrency = 3;
  for (let offset = 0; offset < total; offset += page * concurrency) {
    if (token !== state.gasNationalToken) return null;
    const batch = [];
    for (let i = 0; i < concurrency && offset + i * page < total; i++)
      batch.push(offset + i * page);
    const pages = await Promise.all(
      batch.map(async (off) => {
        const expected = Math.min(page, total - off);
        let feats = await fetchGasPage(off, { precision: "3", offset: "0.05" });
        if (feats.length < expected)
          feats = await fetchGasPage(off, { precision: "3", offset: "0.05" });
        return feats;
      }),
    );
    for (const feats of pages) features.push(...feats);
  }
  if (token !== state.gasNationalToken) return null;
  return { type: "FeatureCollection", features, total };
}
function ensureGasLayers(map) {
  if (!map.getSource(GAS_SRC))
    map.addSource(GAS_SRC, {
      type: "geojson",
      data: EMPTY_FC,
      attribution: "EIA natural gas interstate/intrastate pipelines · CATALOG",
    });
  if (!map.getSource(GAS_DETAIL_SRC))
    map.addSource(GAS_DETAIL_SRC, { type: "geojson", data: EMPTY_FC });
  const before = map.getLayer(LAYERS.powerLine.id)
    ? LAYERS.powerLine.id
    : map.getLayer(NATIVE.tx)
      ? NATIVE.tx
      : undefined;
  if (!map.getLayer(GAS_LAYER)) {
    const layer = gasLineLayer(GAS_LAYER, GAS_SRC, 2);
    if (before) map.addLayer(layer, before);
    else map.addLayer(layer);
  }
  if (!map.getLayer(GAS_DETAIL_LAYER)) {
    const layer = gasLineLayer(GAS_DETAIL_LAYER, GAS_DETAIL_SRC, 7);
    if (before) map.addLayer(layer, before);
    else map.addLayer(layer);
  }
}
async function refreshGasDetail(map) {
  if (!state.gas) {
    state.gasDetailReady = false;
    applyVisibility(map);
    return;
  }
  const zoom = map.getZoom?.() || 0;
  if (zoom < 7) {
    state.gasDetailReady = false;
    state.gasDetailBbox = "";
    applyVisibility(map);
    return;
  }
  const b = map.getBounds();
  const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
    .map((n) => n.toFixed(3))
    .join(",");
  if (bbox === state.gasDetailBbox && state.gasDetailReady) {
    applyVisibility(map);
    return;
  }
  const token = ++state.gasDetailToken;
  try {
    const feats = await fetchGasPage(0, {
      bbox,
      precision: "5",
      offset: "0.002",
    });
    if (token !== state.gasDetailToken) return;
    const src = map.getSource(GAS_DETAIL_SRC);
    if (src && src.setData)
      src.setData({ type: "FeatureCollection", features: feats });
    state.gasDetailBbox = bbox;
    state.gasDetailReady = true;
    applyVisibility(map);
  } catch (err) {
    if (token !== state.gasDetailToken) return;
    console.warn("[siteline-enhance] gas detail failed", err);
    state.gasDetailReady = false;
    applyVisibility(map);
  }
}
function scheduleGasDetail(map) {
  window.clearTimeout(map.__slGasTimer);
  map.__slGasTimer = window.setTimeout(() => refreshGasDetail(map), 320);
}
function addGas(map) {
  if (!map || typeof map.addSource !== "function") return;
  try {
    ensureGasLayers(map);
    applyVisibility(map);
    if (!map.__slGasMove) {
      map.__slGasMove = true;
      map.on("moveend", () => {
        if (state.gas) scheduleGasDetail(map);
      });
    }
    if (!map.__slGasNational) {
      map.__slGasNational = true;
      const token = ++state.gasNationalToken;
      setStatus("Loading EIA natural gas pipelines (CATALOG)…");
      fetchGasNational(token)
        .then((fc) => {
          if (!fc || token !== state.gasNationalToken) return;
          const src = map.getSource(GAS_SRC);
          if (src && src.setData) src.setData(fc);
          const loaded = fc.features.length.toLocaleString();
          const expected =
            fc.total != null ? " of " + fc.total.toLocaleString() : "";
          setStatus(
            "EIA natural gas pipelines loaded (" +
              loaded +
              expected +
              " segments, CATALOG). Subsea cables are OSM-mapped.",
          );
        })
        .catch((err) => {
          console.warn("[siteline-enhance] gas catalog failed", err);
          setStatus("Natural gas pipelines UNKNOWN (EIA query failed).");
        });
    }
    scheduleGasDetail(map);
  } catch (err) {
    console.warn("[siteline-enhance] gas layer failed", err);
    setStatus("Natural gas pipelines UNKNOWN (layer failed).");
  }
}

function addOim(map) {
  if (!map || typeof map.addSource !== "function") return;
  try {
    if (!map.getSource(SOURCE_ID))
      map.addSource(SOURCE_ID, {
        type: "vector",
        tiles: OIM_TILES,
        minzoom: 0,
        maxzoom: 17,
        attribution: OIM_ATTR,
      });
    for (const def of Object.values(LAYERS)) {
      if (map.getLayer(def.id)) {
        try {
          if (def.filter) setFilterIf(map, def.id, def.filter);
          if (def.id === LAYERS.powerLine.id) {
            setPaintIf(map, def.id, "line-color", def.paint["line-color"]);
            setPaintIf(map, def.id, "line-width", def.paint["line-width"]);
          }
          if (def.id === LAYERS.powerSub.id) {
            setPaintIf(map, def.id, "circle-color", def.paint["circle-color"]);
            setPaintIf(map, def.id, "circle-radius", def.paint["circle-radius"]);
          }
          if (def.id === LAYERS.subseaLine.id) {
            setPaintIf(map, def.id, "line-color", def.paint["line-color"]);
            setPaintIf(map, def.id, "line-width", def.paint["line-width"]);
          }
        } catch (_) {}
        continue;
      }
      const layer = {
        id: def.id,
        type: def.type,
        source: SOURCE_ID,
        "source-layer": def["source-layer"],
        layout: {
          visibility: "visible",
          ...(def.type === "line"
            ? { "line-cap": "round", "line-join": "round" }
            : {}),
        },
        paint: def.paint,
      };
      if (def.filter) layer.filter = def.filter;
      map.addLayer(layer);
    }
    applyVisibility(map);
    ensureHighlight(map);
    setStatus(
      "OpenInfraMap power, telecom, and subsea cables (OSM-mapped). As-built fiber UNKNOWN.",
    );
  } catch (err) {
    console.warn("[siteline-enhance] OIM failed", err);
    setStatus("OpenInfraMap UNKNOWN (tile error). As-built fiber UNKNOWN.");
  }
}
function interactiveLayerIds(map) {
  return [
    LAYERS.powerLine.id,
    LAYERS.powerSub.id,
    LAYERS.telecomLine.id,
    LAYERS.telecomMast.id,
    LAYERS.subseaLine.id,
    GAS_LAYER,
    GAS_DETAIL_LAYER,
    CONTOUR_LINE,
    NATIVE.tx,
    NATIVE.subs,
    NATIVE.plants,
  ].filter((id) => map.getLayer(id));
}
function classifyFeature(f) {
  const id = f?.layer?.id || "";
  const p = f?.properties || {};
  if (id === NATIVE.tx)
    return {
      kind: "tx",
      title: val(p, "ID", "OBJECTID")
        ? "TX " + val(p, "ID", "OBJECTID")
        : "Transmission line",
      primary: fmtKv(val(p, "VOLTAGE")),
      source: "HIFLD",
      honesty: "CATALOG",
      note: "HIFLD transmission catalog. Not as-built; no live MW.",
    };
  if (id === NATIVE.subs)
    return {
      kind: "sub",
      title: val(p, "NAME") || "Substation",
      primary: fmtKv(val(p, "MAX_VOLT", "MIN_VOLT")),
      source: "HIFLD",
      honesty: "CATALOG",
      note: "HIFLD substations catalog. Transformer MVA UNKNOWN.",
    };
  if (id === NATIVE.plants)
    return {
      kind: "plant",
      title: val(p, "Plant_Name") || "Power plant",
      primary: fmtMwNameplate(val(p, "Total_MW", "Install_MW")),
      source: "EIA",
      honesty: "CATALOG",
      note: "EIA nameplate MW. Not live output / interconnect.",
    };
  if (id === LAYERS.powerLine.id)
    return {
      kind: "tx",
      title: val(p, "name", "ref") || "OIM power line",
      primary: fmtKv(val(p, "voltage")),
      source: "OIM",
      honesty: "OSM_MAPPED",
      note: "OpenInfraMap / OSM-mapped. Not utility as-built.",
    };
  if (id === LAYERS.powerSub.id)
    return {
      kind: "sub",
      title: val(p, "name", "Name") || "OIM substation",
      primary: fmtKv(val(p, "voltage")),
      source: "OIM",
      honesty: "OSM_MAPPED",
      note: "OpenInfraMap / OSM-mapped. Not utility as-built.",
    };
  if (id === GAS_LAYER || id === GAS_DETAIL_LAYER)
    return {
      kind: "gas",
      title: val(p, "Operator", "operator") || "Natural gas pipeline",
      primary: val(p, "Status", "status") || val(p, "TYPEPIPE") || "CATALOG",
      source: "EIA",
      honesty: "CATALOG",
      note: "EIA interstate/intrastate natural gas pipelines (HIFLD-class catalog). Not NPMS as-built. Capacity UNKNOWN.",
    };
  if (id === LAYERS.subseaLine.id)
    return {
      kind: "subsea",
      title: val(p, "name", "name_en", "ref") || "Subsea cable",
      primary: val(p, "operator") || "OSM mapped",
      source: "OIM",
      honesty: "OSM_MAPPED",
      note: "OpenInfraMap / OSM submarine telecom (location=underwater). Not a survey of as-built cable routes.",
    };
  if (id === LAYERS.telecomLine.id)
    return {
      kind: "telecom",
      title: "OIM telecom line",
      primary: val(p, "name", "operator") || "OSM mapped",
      source: "OIM",
      honesty: "OSM_MAPPED",
      note: "OSM-mapped telecom. As-built fiber / conduit UNKNOWN.",
    };
  if (id === LAYERS.telecomMast.id)
    return {
      kind: "telecom",
      title: val(p, "name", "Name") || "OIM telecom mast",
      primary: val(p, "operator") || "OSM mapped",
      source: "OIM",
      honesty: "OSM_MAPPED",
      note: "OSM-mapped telecom. As-built fiber / conduit UNKNOWN.",
    };
  if (id === CONTOUR_LINE)
    return {
      kind: "contour",
      title: "Contour " + (val(p, "ele") != null ? val(p, "ele") + " ft" : ""),
      primary: val(p, "ele") != null ? val(p, "ele") + " ft" : "UNKNOWN",
      source: "DEM",
      honesty: "DEM-derived",
      note: "DEM-derived vector contour (AWS Terrarium). CATALOG · not survey / as-built.",
    };
  return {
    kind: "other",
    title: id || "Feature",
    primary: "UNKNOWN",
    source: "UNKNOWN",
    honesty: "UNKNOWN",
    note: "",
  };
}
function observeRows(meta, p) {
  const rows = [];
  if (meta.kind === "tx") {
    rows.push(["Voltage", meta.primary]);
    const o = val(p, "OWNER", "owner", "operator", "Operator");
    if (o) rows.push(["Owner", String(o)]);
    const c = val(p, "VOLT_CLASS");
    if (c) rows.push(["Class", String(c)]);
  } else if (meta.kind === "sub") {
    rows.push(["Voltage", meta.primary]);
    const t = val(p, "TYPE", "type", "substation");
    if (t) rows.push(["Type", String(t)]);
    const o = val(p, "OWNER", "owner", "operator");
    if (o) rows.push(["Owner", String(o)]);
  } else if (meta.kind === "plant") {
    rows.push(["Nameplate", meta.primary]);
    const f = val(p, "PrimSource", "plant:source", "source");
    if (f) rows.push(["Fuel", String(f)]);
  } else if (meta.kind === "gas") {
    rows.push(["Operator", String(val(p, "Operator", "operator") || "UNKNOWN")]);
    rows.push(["Status", String(val(p, "Status", "status") || "UNKNOWN")]);
    rows.push(["Type", String(val(p, "TYPEPIPE", "type") || "UNKNOWN")]);
  } else if (meta.kind === "subsea") {
    const name = val(p, "name", "name_en", "ref");
    if (name) rows.push(["Name", String(name)]);
    rows.push(["Operator", String(val(p, "operator") || "UNKNOWN")]);
    rows.push(["Location", String(val(p, "location") || "underwater")]);
  } else if (meta.kind === "contour") {
    rows.push(["Elevation", meta.primary]);
    rows.push(["Interval", "5 ft minor (DEM isolines)"]);
  } else rows.push(["Detail", meta.primary]);
  rows.push(["Source", meta.source + " · " + meta.honesty]);
  return rows;
}
function gisRows(meta, p, feature, lngLat, nearby) {
  const rows = observeRows(meta, p).slice(0, -1);
  if (meta.kind === "tx" || meta.kind === "sub")
    rows.push(["Transformer MVA", "UNKNOWN"]);
  if (meta.kind === "plant") {
    rows.push(["Tech", String(val(p, "tech_desc", "source_des") || "UNKNOWN")]);
    rows.push(["Utility", String(val(p, "Utility_Na") || "UNKNOWN")]);
    rows.push(["State", String(val(p, "State") || "UNKNOWN")]);
    rows.push(["Period", String(val(p, "Period") || "UNKNOWN")]);
    rows.push(["Live output MW", "UNKNOWN (catalog nameplate only)"]);
  }
  if (meta.kind === "tx") {
    rows.push(["Status", String(val(p, "STATUS", "status") || "UNKNOWN")]);
    rows.push([
      "Line id",
      String(val(p, "ID", "OBJECTID", "ref") || "UNKNOWN"),
    ]);
  }
  if (meta.kind === "sub") {
    rows.push(["Min kV", fmtKv(val(p, "MIN_VOLT"))]);
    rows.push(["Max kV", fmtKv(val(p, "MAX_VOLT"))]);
    rows.push(["Status", String(val(p, "STATUS", "status") || "UNKNOWN")]);
    rows.push(["City", String(val(p, "CITY") || "UNKNOWN")]);
    rows.push(["State", String(val(p, "STATE", "State") || "UNKNOWN")]);
  }
  rows.push(["Layer id", feature?.layer?.id || "UNKNOWN"]);
  if (lngLat)
    rows.push([
      "Coordinates",
      lngLat.lat.toFixed(5) + ", " + lngLat.lng.toFixed(5),
    ]);
  rows.push(["Source", meta.source + " · " + meta.honesty]);
  rows.push(["Honesty", meta.note || meta.honesty]);
  if (nearby) for (const n of nearby) rows.push([n.label, n.value]);
  return rows;
}
function haversineKm(a, b) {
  const R = 6371,
    toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat),
    dLon = toR(b.lng - a.lng);
  const lat1 = toR(a.lat),
    lat2 = toR(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function featureLngLat(f, fallback) {
  const g = f?.geometry;
  if (!g) return fallback;
  if (g.type === "Point" && Array.isArray(g.coordinates))
    return { lng: g.coordinates[0], lat: g.coordinates[1] };
  let c = g.coordinates;
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  if (Array.isArray(c) && c.length >= 2 && typeof c[0] === "number")
    return { lng: c[0], lat: c[1] };
  return fallback;
}
function nearbyAssets(map, point, lngLat, kind) {
  if (state.mode !== "gis" || !map || !lngLat) return [];
  const out = [];
  try {
    const zoom = map.getZoom?.() || 10;
    const px = Math.max(28, Math.min(120, 90000 / Math.pow(2, zoom)));
    const box = [
      [point.x - px, point.y - px],
      [point.x + px, point.y + px],
    ];
    const layers = [NATIVE.subs, LAYERS.powerSub.id, NATIVE.plants].filter(
      (id) => map.getLayer(id),
    );
    if (!layers.length) return out;
    const feats = map.queryRenderedFeatures(box, { layers });
    let bestSub = null,
      bestPlant = null;
    for (const f of feats) {
      const ll = featureLngLat(f, null);
      if (!ll) continue;
      const km = haversineKm(lngLat, ll);
      if (km > 2.2) continue;
      const meta = classifyFeature(f);
      if (meta.kind === "sub" && (!bestSub || km < bestSub.km))
        bestSub = {
          km,
          label: "Nearest substation (~2km)",
          value:
            meta.title + " · " + meta.primary + " · " + km.toFixed(2) + " km",
        };
      if (
        meta.kind === "plant" &&
        kind === "tx" &&
        (!bestPlant || km < bestPlant.km)
      )
        bestPlant = {
          km,
          label: "Nearby plant (~2km)",
          value:
            meta.title + " · " + meta.primary + " · " + km.toFixed(2) + " km",
        };
    }
    if (kind === "tx" && bestSub) out.push(bestSub);
    if (kind === "tx" && bestPlant) out.push(bestPlant);
    if (kind === "plant" && bestSub) out.push(bestSub);
  } catch (_) {}
  return out;
}

function fmtElevFt(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "UNKNOWN";
  return Math.round(Number(v)).toLocaleString() + " ft";
}
async function fetchEpqsFeet(lng, lat, signal) {
  const url =
    EPQS_URL +
    "?x=" +
    encodeURIComponent(String(lng)) +
    "&y=" +
    encodeURIComponent(String(lat)) +
    "&wkid=4326&units=Feet";
  const res = await fetch(url, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    signal,
  });
  if (!res.ok) throw new Error("EPQS HTTP " + res.status);
  const json = await res.json();
  const raw =
    typeof json.value === "string" ? parseFloat(json.value) : json.value;
  if (typeof raw !== "number" || Number.isNaN(raw)) return null;
  return raw;
}
function findNearbyContour(map, point) {
  if (!map || !map.getLayer(CONTOUR_LINE) || !point) return null;
  const pad = 12;
  const box = [
    [point.x - pad, point.y - pad],
    [point.x + pad, point.y + pad],
  ];
  try {
    const feats = map.queryRenderedFeatures(box, { layers: [CONTOUR_LINE] });
    return feats[0] || null;
  } catch (_) {
    return null;
  }
}

function aboutLeadHtml() {
  return (
    '<div class="sl-about-lead">' +
    "<p>Siteline is a public screening map: pin a site, read the lines (grid, power, gas pipelines, wells, fiber, subsea cables, terrain, DEM contours).</p>" +
    "<p>Built so capacity and site work can see public GIS honestly.</p>" +
    "<p>Catalog and DEM-derived layers are labeled.</p>" +
    "<p>Live MW, transformer MVA, as-built fiber, and survey-grade contours stay UNKNOWN.</p>" +
    "</div>"
  );
}
function aboutCreditHtml() {
  return (
    '<p class="sl-about-credit">Built by <a href="' +
    X_LINK +
    '" target="_blank" rel="noopener noreferrer">David T Phung</a>' +
    ' · <a href="' +
    SITE_LINK +
    '" target="_blank" rel="noopener noreferrer">davidtphung.com</a>' +
    " · NLT143 RESEARCH</p>"
  );
}
function aboutListHtml() {
  return ABOUT_SOURCES.map((s) => {
    const honestyClass =
      s.honesty === "OSM_MAPPED"
        ? "osm"
        : s.honesty === "LIVE"
          ? "live"
          : s.honesty === "DEM-derived"
            ? "dem"
            : s.honesty === "UNKNOWN"
              ? "unk"
              : "catalog";
    return (
      '<article class="sl-about-src">' +
      '<header><strong>' +
      esc(s.name) +
      '</strong><span class="sl-honesty-chip ' +
      honestyClass +
      '">' +
      esc(s.honesty) +
      "</span></header>" +
      '<p class="sl-about-meta">' +
      esc(s.org) +
      " · " +
      esc(s.cadence) +
      "</p>" +
      '<a href="' +
      esc(s.url) +
      '" target="_blank" rel="noopener noreferrer">' +
      esc(s.url) +
      "</a>" +
      "</article>"
    );
  }).join("");
}
function elevBlockHtml(contourFt, epqsFt, epqsHonesty, loading) {
  const cChip =
    contourFt != null
      ? '<span class="sl-honesty-chip dem">DEM-derived</span>'
      : "";
  const eChip =
    '<span class="sl-honesty-chip ' +
    (epqsHonesty === "LIVE"
      ? "live"
      : epqsHonesty === "UNKNOWN"
        ? "unk"
        : "catalog") +
    '">' +
    esc(epqsHonesty) +
    "</span>";
  const cTxt2 =
    contourFt != null ? "Contour " + fmtElevFt(contourFt) : "Contour n/a";
  const eTxt = loading
    ? "EPQS ..."
    : "EPQS " + (epqsFt != null ? fmtElevFt(epqsFt) : "UNKNOWN");
  let delta = "Δ n/a";
  if (
    !loading &&
    contourFt != null &&
    epqsFt != null &&
    !Number.isNaN(Number(contourFt)) &&
    !Number.isNaN(Number(epqsFt))
  ) {
    const d = Math.round(Number(epqsFt) - Number(contourFt));
    delta = "Δ " + (d > 0 ? "+" : "") + d + " ft";
  } else if (!loading && contourFt == null && epqsFt != null) {
    delta = "point elev check";
  } else if (!loading && epqsFt == null) {
    delta = "Δ UNKNOWN";
  }
  return (
    '<div class="sl-elev-spot" id="sl-elev-spot">' +
    '<p class="sl-tray-label">Elev spot-check</p>' +
    '<div class="sl-elev-line">' +
    "<span>" +
    esc(cTxt2) +
    "</span> " +
    cChip +
    " <span class=\"sl-elev-sep\">·</span> " +
    "<span>" +
    esc(eTxt) +
    "</span> " +
    eChip +
    " <span class=\"sl-elev-sep\">·</span> " +
    "<span>" +
    esc(delta) +
    "</span>" +
    "</div>" +
    '<p class="sl-fc-note">Contour = DEM-derived CATALOG (not survey). EPQS = USGS point elev. Failures stay UNKNOWN.</p>' +
    "</div>"
  );
}
function renderElevIntoInspect(contourFt) {
  const host = document.getElementById("sl-elev-host");
  if (!host) return;
  host.hidden = false;
  host.innerHTML = elevBlockHtml(contourFt, null, "LIVE", true);
}
function setElevResult(contourFt, epqsFt, honesty) {
  const host = document.getElementById("sl-elev-host");
  if (!host) return;
  host.hidden = false;
  host.innerHTML = elevBlockHtml(contourFt, epqsFt, honesty, false);
}
function hideElevHost() {
  const host = document.getElementById("sl-elev-host");
  if (host) {
    host.hidden = true;
    host.innerHTML = "";
  }
}
async function runEpqsSpotCheck(lngLat, contourFt) {
  const seq = ++state.epqsSeq;
  renderElevIntoInspect(contourFt);
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 12000);
    const ft = await fetchEpqsFeet(lngLat.lng, lngLat.lat, ctrl.signal);
    window.clearTimeout(timer);
    if (seq !== state.epqsSeq) return;
    if (ft == null) setElevResult(contourFt, null, "UNKNOWN");
    else setElevResult(contourFt, ft, "LIVE");
  } catch (_) {
    if (seq !== state.epqsSeq) return;
    setElevResult(contourFt, null, "UNKNOWN");
  }
}

function ensureTray() {
  injectTrayStyles();
  let el = document.getElementById("sl-tray");
  if (el) {
    upgradeTray(el);
    wireTray(el);
    return el;
  }
  el = document.createElement("aside");
  el.id = "sl-tray";
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", "Siteline instrument tray");
  el.dataset.tab = "layers";
  el.dataset.sheet = "half";
  el.dataset.atlas = "sheet";
  el.innerHTML =
    '<div class="sl-tray-grab" id="sl-tray-grab" aria-hidden="true"></div>' +
    '<div class="sl-tray-chrome">' +
    '<div class="sl-tray-tabs" role="tablist" aria-label="Tray sections">' +
    '<button type="button" role="tab" class="sl-chip on" data-tab="layers" id="sl-tab-layers" aria-selected="true">Layers</button>' +
    '<button type="button" role="tab" class="sl-chip" data-tab="inspect" id="sl-tab-inspect" aria-selected="false">Inspect</button>' +
    '<button type="button" role="tab" class="sl-chip" data-tab="about" id="sl-tab-about" aria-selected="false">About</button>' +
    "</div>" +
    '<button type="button" class="sl-tray-close" id="sl-tray-close" aria-label="Clear inspect" hidden>×</button>' +
    "</div>" +
    '<div class="sl-tray-stage">' +
    '<div class="sl-tray-pane" data-pane="layers" id="sl-pane-layers" role="tabpanel">' +
    '<p class="sl-tray-label">Jump</p>' +
    '<div class="sl-jump-row" role="group" aria-label="Map jumps">' +
    '<button type="button" class="sl-chip sl-jump" data-jump="usa">USA</button>' +
    '<button type="button" class="sl-chip sl-jump" data-jump="permian">Permian</button>' +
    '<button type="button" class="sl-chip sl-jump" data-jump="ashburn">Ashburn</button>' +
    "</div>" +
    '<p class="sl-tray-label">OpenInfraMap</p>' +
    '<div class="sl-mode" role="group" aria-label="Inspect mode">' +
    '<button type="button" class="sl-chip on" data-mode="observe" id="sl-mode-observe">Observe</button>' +
    '<button type="button" class="sl-chip" data-mode="gis" id="sl-mode-gis">GIS</button>' +
    "</div>" +
    '<label class="sl-tray-row"><input type="checkbox" id="oim-power-toggle" checked /><span class="swatch power" aria-hidden="true"></span><span>OIM power lines + substations</span></label>' +
    '<label class="sl-tray-row"><input type="checkbox" id="oim-telecom-toggle" checked /><span class="swatch telecom" aria-hidden="true"></span><span>OIM telecom (OSM mapped)</span></label>' +
    '<p class="sl-tray-label">Pipelines</p>' +
    '<label class="sl-tray-row"><input type="checkbox" id="sl-gas-toggle" checked /><span class="swatch gas" aria-hidden="true"></span><span>Natural gas pipelines</span></label>' +
    '<p class="sl-honesty-chip catalog" id="sl-gas-honesty">EIA · CATALOG · public pipeline context</p>' +
    '<p class="sl-tray-label">Cables</p>' +
    '<label class="sl-tray-row"><input type="checkbox" id="sl-subsea-toggle" checked /><span class="swatch subsea" aria-hidden="true"></span><span>Subsea cables</span></label>' +
    '<p class="sl-honesty-chip osm" id="sl-subsea-honesty">OSM-mapped · not survey</p>' +
    '<p class="sl-tray-label">Terrain</p><label class="sl-tray-row"><input type="checkbox" id="sl-contour-toggle" checked /><span class="swatch contour" aria-hidden="true"></span><span>Contours 5 ft (DEM)</span></label><p class="sl-honesty-chip dem" id="sl-contour-honesty">DEM-derived · CATALOG · not survey</p>' +
    '<p class="sl-tray-note">Click a line, substation, plant, gas pipeline, subsea cable, contour, or pin.</p>' +
    '<p class="sl-tray-status" id="oim-status">Waiting for map…</p>' +
    "</div>" +
    '<div class="sl-tray-pane" data-pane="inspect" id="sl-pane-inspect" role="tabpanel" hidden>' +
    '<div id="sl-inspect-empty" class="sl-inspect-empty">Click a line, substation, plant, gas pipeline, subsea cable, contour, or map for elev.</div>' +
    '<div id="sl-inspect-body" class="sl-inspect-body" hidden>' +
    '<div class="sl-fc-head"><h3 id="sl-fc-title">Feature</h3></div>' +
    '<div id="sl-fc-badge" class="sl-fc-badge">CATALOG</div>' +
    '<div id="sl-fc-primary" class="sl-fc-primary"></div>' +
    '<div id="sl-fc-rows"></div>' +
    '<div id="sl-elev-host" class="sl-elev-host" hidden></div>' +
    '<p id="sl-fc-note" class="sl-fc-note"></p>' +
    "</div>" +
    "</div>" +
    '<div class="sl-tray-pane" data-pane="about" id="sl-pane-about" role="tabpanel" hidden>' +
    aboutLeadHtml() +
    '<p class="sl-tray-label">Sources</p>' +
    '<div class="sl-about-list" id="sl-about-list">' +
    aboutListHtml() +
    "</div>" +
    aboutCreditHtml() +
    "</div>" +
    "</div>";
  document.body.appendChild(el);
  document.getElementById("siteline-oim-panel")?.remove();
  document.getElementById("sl-feature-card")?.remove();
  wireTray(el);
  return el;
}

function ensureJumpRow(el) {
  const pane = el.querySelector("#sl-pane-layers");
  if (!pane || pane.querySelector(".sl-jump-row")) return;
  const row = document.createElement("div");
  row.className = "sl-jump-host";
  row.innerHTML =
    '<p class="sl-tray-label">Jump</p>' +
    '<div class="sl-jump-row" role="group" aria-label="Map jumps">' +
    '<button type="button" class="sl-chip sl-jump" data-jump="usa">USA</button>' +
    '<button type="button" class="sl-chip sl-jump" data-jump="permian">Permian</button>' +
    '<button type="button" class="sl-chip sl-jump" data-jump="ashburn">Ashburn</button>' +
    "</div>";
  pane.insertBefore(row, pane.firstChild);
  el.dataset.wired = "0";
}

function upgradeTray(el) {
  el.dataset.atlas = "sheet";
  ensureJumpRow(el);
  const note = el.querySelector("#sl-pane-layers .sl-tray-note");
  if (note && note.textContent && !note.textContent.includes("subsea")) {
    note.textContent =
      "Click a line, substation, plant, gas pipeline, subsea cable, contour, or pin.";
  }
  ensurePipelineToggles(el);
  const tabs = el.querySelector(".sl-tray-tabs");
  if (tabs && !document.getElementById("sl-tab-about")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "tab");
    btn.className = "sl-chip";
    btn.dataset.tab = "about";
    btn.id = "sl-tab-about";
    btn.setAttribute("aria-selected", "false");
    btn.textContent = "About";
    tabs.appendChild(btn);
    el.dataset.wired = "0";
  }
  const stage = el.querySelector(".sl-tray-stage");
  if (stage && !document.getElementById("sl-pane-about")) {
    const pane = document.createElement("div");
    pane.className = "sl-tray-pane";
    pane.dataset.pane = "about";
    pane.id = "sl-pane-about";
    pane.setAttribute("role", "tabpanel");
    pane.hidden = true;
    pane.innerHTML =
      aboutLeadHtml() +
      '<p class="sl-tray-label">Sources</p>' +
      '<div class="sl-about-list" id="sl-about-list">' +
      aboutListHtml() +
      "</div>" +
      aboutCreditHtml();
    stage.appendChild(pane);
  }
  const aboutPane = document.getElementById("sl-pane-about");
  if (aboutPane && !aboutPane.querySelector(".sl-about-lead")) {
    aboutPane.insertAdjacentHTML("afterbegin", aboutLeadHtml());
  }
  const aboutList = document.getElementById("sl-about-list");
  if (aboutList && !aboutList.textContent.includes("Natural gas interstate")) {
    aboutList.innerHTML = aboutListHtml();
  }
  if (aboutPane) {
    const credit = aboutPane.querySelector(".sl-about-credit");
    if (!credit || !credit.innerHTML.includes("davidtphung.com")) {
      if (credit) credit.remove();
      aboutPane.insertAdjacentHTML("beforeend", aboutCreditHtml());
    }
  }
  const body = document.getElementById("sl-inspect-body");
  if (body && !document.getElementById("sl-elev-host")) {
    const host = document.createElement("div");
    host.id = "sl-elev-host";
    host.className = "sl-elev-host";
    host.hidden = true;
    const note = document.getElementById("sl-fc-note");
    if (note) body.insertBefore(host, note);
    else body.appendChild(host);
  }
  const empty = document.getElementById("sl-inspect-empty");
  if (empty && empty.textContent && !empty.textContent.includes("elev")) {
    empty.textContent =
      "Click a line, substation, plant, contour, or map for elev.";
  }
}

function ensurePipelineToggles(el) {
  const pane = el.querySelector("#sl-pane-layers");
  if (!pane || document.getElementById("sl-gas-toggle")) return;
  const html =
    '<p class="sl-tray-label">Pipelines</p>' +
    '<label class="sl-tray-row"><input type="checkbox" id="sl-gas-toggle" checked /><span class="swatch gas" aria-hidden="true"></span><span>Natural gas pipelines</span></label>' +
    '<p class="sl-honesty-chip catalog" id="sl-gas-honesty">EIA · CATALOG · public pipeline context</p>' +
    '<p class="sl-tray-label">Cables</p>' +
    '<label class="sl-tray-row"><input type="checkbox" id="sl-subsea-toggle" checked /><span class="swatch subsea" aria-hidden="true"></span><span>Subsea cables</span></label>' +
    '<p class="sl-honesty-chip osm" id="sl-subsea-honesty">OSM-mapped · not survey</p>';
  const terrain = pane.querySelector("#sl-contour-toggle");
  const anchor = terrain ? terrain.closest(".sl-tray-row") : null;
  const label = anchor ? anchor.previousElementSibling : null;
  if (label && label.classList.contains("sl-tray-label"))
    label.insertAdjacentHTML("beforebegin", html);
  else if (anchor) anchor.insertAdjacentHTML("beforebegin", html);
  else pane.insertAdjacentHTML("beforeend", html);
  el.dataset.wired = "0";
}

function wireTray(el) {
  if (el.dataset.wired === "1") return;
  el.dataset.wired = "1";
  // re-query tabs after upgrade

  el.querySelectorAll(".sl-tray-tabs [data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setTrayTab(btn.getAttribute("data-tab")));
  });

  document.getElementById("sl-tray-close")?.addEventListener("click", () => {
    clearInspect();
    setTrayTab("layers");
  });

  document.getElementById("oim-power-toggle")?.addEventListener("change", (e) => {
    state.power = !!e.target.checked;
    if (window.__SITELINE_MAP__) applyVisibility(window.__SITELINE_MAP__);
  });
  document.getElementById("oim-telecom-toggle")?.addEventListener("change", (e) => {
    state.telecom = !!e.target.checked;
    if (window.__SITELINE_MAP__) applyVisibility(window.__SITELINE_MAP__);
  });
  document.getElementById("sl-contour-toggle")?.addEventListener("change", (e) => {
    state.contours = !!e.target.checked;
    if (window.__SITELINE_MAP__) applyVisibility(window.__SITELINE_MAP__);
  });
  document.getElementById("sl-gas-toggle")?.addEventListener("change", (e) => {
    state.gas = !!e.target.checked;
    if (!state.gas) {
      state.gasDetailReady = false;
      state.gasDetailBbox = "";
    }
    const map = window.__SITELINE_MAP__;
    if (!map) return;
    applyVisibility(map);
    if (state.gas) scheduleGasDetail(map);
  });
  document.getElementById("sl-subsea-toggle")?.addEventListener("change", (e) => {
    state.subsea = !!e.target.checked;
    if (window.__SITELINE_MAP__) applyVisibility(window.__SITELINE_MAP__);
  });

  el.querySelectorAll(".sl-jump[data-jump]").forEach((btn) => {
    btn.addEventListener("click", () => flyJump(btn.getAttribute("data-jump")));
  });

  el.querySelectorAll(".sl-mode [data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.mode = btn.getAttribute("data-mode") === "gis" ? "gis" : "observe";
      el.querySelectorAll(".sl-mode [data-mode]").forEach((b) =>
        b.classList.toggle("on", b === btn),
      );
      if (state.selected && state.map) {
        const ll = featureLngLat(state.selected, null);
        const point = ll
          ? state.map.project([ll.lng, ll.lat])
          : { x: 0, y: 0 };
        showInspect(state.map, state.selected, ll || { lng: 0, lat: 0 }, point);
      }
    });
  });

  // Chip press feedback
  el.addEventListener(
    "pointerdown",
    (e) => {
      const t = e.target.closest(".sl-chip");
      if (!t || !el.contains(t)) return;
      t.classList.add("is-press");
    },
    true,
  );
  const clearPress = (e) => {
    const t = e.target.closest?.(".sl-chip");
    if (t) t.classList.remove("is-press");
  };
  el.addEventListener("pointerup", clearPress, true);
  el.addEventListener("pointerleave", clearPress, true);
  el.addEventListener("pointercancel", clearPress, true);

  // Copyable GIS fields
  el.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.classList && t.classList.contains("copyable")) {
      try {
        navigator.clipboard?.writeText(
          t.getAttribute("data-copy") || t.textContent || "",
        );
      } catch (_) {}
    }
  });

  wireSheetGestures(el);
}

function setTrayTab(tab) {
  const el = ensureTray();
  const next =
    tab === "inspect" ? "inspect" : tab === "about" ? "about" : "layers";
  const prev = el.dataset.tab || "layers";
  if (prev !== next) {
    el.dataset.fly =
      next === "inspect" || next === "about"
        ? "right"
        : "left";
    window.clearTimeout(el._flyTimer);
    el._flyTimer = window.setTimeout(() => {
      el.removeAttribute("data-fly");
    }, 220);
  }
  el.dataset.tab = next;
  el.dataset.empty =
    next === "inspect" && !(state.selected || state.elevPin) ? "1" : "0";
  el.querySelectorAll(".sl-tray-tabs [data-tab]").forEach((b) => {
    const on = b.getAttribute("data-tab") === next;
    b.classList.toggle("on", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  const layers = el.querySelector("#sl-pane-layers");
  const inspect = el.querySelector("#sl-pane-inspect");
  const about = el.querySelector("#sl-pane-about");
  if (layers) layers.hidden = next !== "layers";
  if (inspect) inspect.hidden = next !== "inspect";
  if (about) about.hidden = next !== "about";
  const close = el.querySelector("#sl-tray-close");
  if (close)
    close.hidden =
      next !== "inspect" || !(state.selected || state.elevPin);
  if (next === "inspect" && (state.selected || state.elevPin))
    setSheetHeight(el, "half");
}

function setSheetHeight(el, h) {
  const allowed = { peek: 1, half: 1, full: 1 };
  el.dataset.sheet = allowed[h] ? h : "half";
}

function wireSheetGestures(el) {
  const grab = el.querySelector("#sl-tray-grab");
  if (!grab || grab.dataset.gestured === "1") return;
  grab.dataset.gestured = "1";
  let startY = 0;
  let startH = "half";
  let lastDy = 0;
  const onDown = (e) => {
    startY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    startH = el.dataset.sheet || "half";
    lastDy = 0;
    el.classList.add("is-dragging");
    const move = (ev) => {
      const y = ev.clientY ?? ev.touches?.[0]?.clientY ?? startY;
      lastDy = y - startY;
      el.style.setProperty("--sl-drag", lastDy + "px");
    };
    const up = () => {
      el.classList.remove("is-dragging");
      el.style.removeProperty("--sl-drag");
      const dragged = Math.abs(lastDy) > 8;
      if (dragged) el.dataset.justDrag = "1";
      const order = ["peek", "half", "full"];
      let i = order.indexOf(startH);
      if (i < 0) i = 1;
      if (lastDy > 56) i = Math.max(0, i - 1);
      else if (lastDy < -56) i = Math.min(2, i + 1);
      if (dragged) setSheetHeight(el, order[i]);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
  };
  grab.addEventListener("pointerdown", onDown);
  grab.addEventListener("touchstart", onDown, { passive: true });
  grab.addEventListener("click", () => {
    if (el.dataset.justDrag === "1") {
      el.dataset.justDrag = "0";
      return;
    }
    const cur = el.dataset.sheet || "half";
    setSheetHeight(el, cur === "peek" ? "half" : "peek");
  });
  grab.addEventListener("dblclick", (ev) => {
    ev.preventDefault();
  });
}

const JUMPS = {
  usa: { center: [-98.5, 39.5], zoom: 3.8, duration: 1200 },
  permian: { center: [-103.7, 32.4], zoom: 9, duration: 1400 },
  ashburn: { center: [-77.46, 39.04], zoom: 11, duration: 1400 },
};

function flyJump(id) {
  const spec = JUMPS[id];
  if (!spec) return;
  const map = window.__SITELINE_MAP__;
  if (!map || typeof map.flyTo !== "function") return;
  try {
    map.flyTo({
      center: spec.center,
      zoom: spec.zoom,
      essential: true,
      duration: spec.duration,
    });
  } catch (_) {}
}


function toggleTrayLayers() {
  const tray = ensureTray();
  if (tray.dataset.tab === "layers" && tray.dataset.sheet !== "peek") {
    setSheetHeight(tray, "peek");
  } else {
    setTrayTab("layers");
    setSheetHeight(tray, "half");
  }
  const chip = document.getElementById("sl-layers-chip");
  if (chip)
    chip.setAttribute(
      "aria-expanded",
      tray.dataset.sheet === "peek" ? "false" : "true",
    );
}

function ensureLayersChip() {
  const top = document.querySelector(".topbar");
  if (!top || document.getElementById("sl-layers-chip")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "sl-layers-chip";
  btn.className = "sl-layers-chip";
  btn.textContent = "Layers";
  btn.setAttribute("aria-controls", "sl-tray");
  btn.setAttribute("aria-expanded", "true");
  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    toggleTrayLayers();
  });
  top.appendChild(btn);
}

function parkReactLayers() {
  const shell = document.querySelector(".app-shell");
  if (shell && shell.classList.contains("layers-open"))
    shell.classList.remove("layers-open");
  const panel = document.getElementById("layer-panel");
  if (panel) {
    if (panel.classList.contains("open")) panel.classList.remove("open");
    if (!panel.hasAttribute("hidden")) panel.setAttribute("hidden", "");
    if (panel.getAttribute("aria-hidden") !== "true")
      panel.setAttribute("aria-hidden", "true");
  }
  document.querySelectorAll(".map-jump-bar").forEach((n) => {
    if (!n.hasAttribute("hidden")) n.setAttribute("hidden", "");
    if (n.getAttribute("aria-hidden") !== "true")
      n.setAttribute("aria-hidden", "true");
  });
}

function routeLayersClicks() {
  if (window.__slLayersRouted) return;
  window.__slLayersRouted = true;
  ensureLayersChip();
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!btn) return;
      const isMenu = btn.classList.contains("menu-btn");
      const isLayers =
        btn.getAttribute("aria-controls") === "layer-panel" ||
        (btn.classList.contains("nav-btn") &&
          (btn.textContent || "").trim() === "Layers");
      if (!isMenu && !isLayers) return;
      e.preventDefault();
      e.stopPropagation();
      const tray = ensureTray();
      if (tray.dataset.tab === "layers" && tray.dataset.sheet !== "peek") {
        setSheetHeight(tray, "peek");
      } else {
        setTrayTab("layers");
        setSheetHeight(tray, "half");
      }
      parkReactLayers();
    },
    true,
  );
  const obs = new MutationObserver(() => parkReactLayers());
  const root = document.getElementById("root") || document.body;
  if (root) {
    obs.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  }
  parkReactLayers();
  ensureLayersChip();
  window.setInterval(() => {
    parkReactLayers();
    ensureLayersChip();
  }, 800);
}

function clearInspect() {
  state.selected = null;
  state.elevPin = null;
  state.epqsSeq += 1;
  if (state.map) setHighlight(state.map, null);
  const empty = document.getElementById("sl-inspect-empty");
  const body = document.getElementById("sl-inspect-body");
  if (empty) empty.hidden = false;
  if (body) body.hidden = true;
  hideElevHost();
  const close = document.getElementById("sl-tray-close");
  if (close) close.hidden = true;
}

function hideCard() {
  // Compat alias: clear selection, stay on Layers
  clearInspect();
  setTrayTab("layers");
}

function showFeatureCard(map, feature, lngLat, point) {
  showInspect(map, feature, lngLat, point);
}

function showInspect(map, feature, lngLat, point) {
  ensureTray();
  const p = feature.properties || {};
  const meta = classifyFeature(feature);
  const nearby =
    state.mode === "gis" ? nearbyAssets(map, point, lngLat, meta.kind) : [];
  const rows =
    state.mode === "gis"
      ? gisRows(meta, p, feature, lngLat, nearby)
      : observeRows(meta, p);

  const empty = document.getElementById("sl-inspect-empty");
  const body = document.getElementById("sl-inspect-body");
  if (empty) empty.hidden = true;
  if (body) body.hidden = false;

  document.getElementById("sl-fc-title").textContent = meta.title;
  const badge = document.getElementById("sl-fc-badge");
  badge.textContent = meta.honesty;
  badge.className =
    "sl-fc-badge " +
    (meta.honesty === "OSM_MAPPED"
      ? "osm"
      : meta.kind === "contour"
        ? "dem"
        : "");
  document.getElementById("sl-fc-primary").textContent = meta.primary;
  document.getElementById("sl-fc-note").textContent = meta.note || "";
  document.getElementById("sl-fc-rows").innerHTML = rows
    .map(([k, v]) => {
      const copyable =
        state.mode === "gis" &&
        (k === "Coordinates" || k === "Layer id" || k === "Line id");
      return (
        '<div class="sl-fc-row"><span class="k">' +
        esc(k) +
        '</span><span class="v' +
        (copyable ? " copyable" : "") +
        '"' +
        (copyable ? ' data-copy="' + esc(v) + '" title="Click to copy"' : "") +
        ">" +
        esc(v) +
        "</span></div>"
      );
    })
    .join("");

  state.selected = feature;
  state.elevPin = null;
  setHighlight(map, feature);
  setTrayTab("inspect");

  if (meta.kind === "contour" && lngLat) {
    const eleRaw = val(p, "ele");
    const contourFt =
      eleRaw != null && eleRaw !== "" && !Number.isNaN(Number(eleRaw))
        ? Number(eleRaw)
        : null;
    runEpqsSpotCheck(lngLat, contourFt);
  } else {
    hideElevHost();
  }
}

function showElevPin(map, lngLat, contourFeature) {
  ensureTray();
  const empty = document.getElementById("sl-inspect-empty");
  const body = document.getElementById("sl-inspect-body");
  if (empty) empty.hidden = true;
  if (body) body.hidden = false;

  let contourFt = null;
  if (contourFeature) {
    const p = contourFeature.properties || {};
    const eleRaw = val(p, "ele");
    if (eleRaw != null && eleRaw !== "" && !Number.isNaN(Number(eleRaw)))
      contourFt = Number(eleRaw);
    state.selected = contourFeature;
    setHighlight(map, contourFeature);
    document.getElementById("sl-fc-title").textContent =
      "Contour " + (contourFt != null ? contourFt + " ft" : "elev");
    const badge = document.getElementById("sl-fc-badge");
    badge.textContent = "DEM-derived";
    badge.className = "sl-fc-badge dem";
    document.getElementById("sl-fc-primary").textContent =
      contourFt != null ? contourFt + " ft" : "UNKNOWN";
    document.getElementById("sl-fc-note").textContent =
      "DEM-derived vector contour (AWS Terrarium). CATALOG · not survey / as-built.";
    document.getElementById("sl-fc-rows").innerHTML =
      '<div class="sl-fc-row"><span class="k">Elevation</span><span class="v">' +
      esc(contourFt != null ? contourFt + " ft" : "UNKNOWN") +
      '</span></div><div class="sl-fc-row"><span class="k">Source</span><span class="v">DEM · DEM-derived</span></div>' +
      (lngLat
        ? '<div class="sl-fc-row"><span class="k">Coordinates</span><span class="v copyable" data-copy="' +
          esc(lngLat.lat.toFixed(5) + ", " + lngLat.lng.toFixed(5)) +
          '">' +
          esc(lngLat.lat.toFixed(5) + ", " + lngLat.lng.toFixed(5)) +
          "</span></div>"
        : "");
  } else {
    state.selected = null;
    if (map) setHighlight(map, null);
    document.getElementById("sl-fc-title").textContent = "Point elev check";
    const badge = document.getElementById("sl-fc-badge");
    badge.textContent = "LIVE";
    badge.className = "sl-fc-badge live";
    document.getElementById("sl-fc-primary").textContent = "USGS EPQS";
    document.getElementById("sl-fc-note").textContent =
      "No contour at pin. EPQS point elev only. Failures stay UNKNOWN.";
    document.getElementById("sl-fc-rows").innerHTML = lngLat
      ? '<div class="sl-fc-row"><span class="k">Coordinates</span><span class="v copyable" data-copy="' +
        esc(lngLat.lat.toFixed(5) + ", " + lngLat.lng.toFixed(5)) +
        '">' +
        esc(lngLat.lat.toFixed(5) + ", " + lngLat.lng.toFixed(5)) +
        "</span></div>"
      : "";
  }
  state.elevPin = lngLat ? { lng: lngLat.lng, lat: lngLat.lat } : null;
  setTrayTab("inspect");
  if (lngLat) runEpqsSpotCheck(lngLat, contourFt);
}

function bindInspect(map) {
  if (!map || state.clickBound) return;
  state.clickBound = true;
  state.map = map;
  map.on("mousemove", (e) => {
    const layers = interactiveLayerIds(map);
    if (!layers.length) return;
    let hits = [];
    try {
      hits = map.queryRenderedFeatures(e.point, { layers });
    } catch (_) {
      hits = [];
    }
    map.getCanvas().style.cursor = hits.length ? "pointer" : "";
    if (!state.selected) setHighlight(map, hits[0] || null);
  });
  map.on("click", (e) => {
    if (e.originalEvent && e.originalEvent.__sitelineWellHandled) return;
    const layers = interactiveLayerIds(map);
    let hits = [];
    if (layers.length) {
      try {
        hits = map.queryRenderedFeatures(e.point, { layers });
      } catch (_) {
        hits = [];
      }
    }
    const rank = (f) => {
      const id = f.layer?.id;
      if (id === NATIVE.tx || id === LAYERS.powerLine.id) return 0;
      if (id === NATIVE.subs || id === LAYERS.powerSub.id) return 1;
      if (id === NATIVE.plants) return 2;
      if (id === GAS_LAYER || id === GAS_DETAIL_LAYER) return 3;
      if (id === LAYERS.subseaLine.id) return 4;
      if (id === CONTOUR_LINE) return 5;
      return 6;
    };
    if (hits.length) {
      hits.sort((a, b) => rank(a) - rank(b));
      const best = hits[0];
      if (best.layer?.id === CONTOUR_LINE) {
        showElevPin(map, e.lngLat, best);
        return;
      }
      showInspect(map, best, e.lngLat, e.point);
      return;
    }
    const near = findNearbyContour(map, e.point);
    if (near) {
      showElevPin(map, e.lngLat, near);
      return;
    }
    showElevPin(map, e.lngLat, null);
  });
}

function ensurePanel() {
  ensureTray();
}

function setStatus(text) {
  ensureTray();
  const el = document.getElementById("oim-status");
  if (el) el.textContent = text;
}

function attach(map) {
  ensureTray();
  const run = () => {
    addOim(map);
    addGas(map);
    addContours(map);
    bindInspect(map);
    try {
      if (map.getLayer(NATIVE.tx)) {
        map.on("mouseenter", NATIVE.tx, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", NATIVE.tx, () => {
          map.getCanvas().style.cursor = "";
        });
      }
    } catch (_) {}
  };
  const once = () => {
    if (map.__slEnhanceOnce) return;
    map.__slEnhanceOnce = true;
    run();
  };
  if (typeof map.isStyleLoaded === "function" && map.isStyleLoaded()) once();
  else {
    map.once?.("load", once);
    map.once?.("idle", once);
  }
}

const TRAY_CSS = "/* === Family Values instrument tray (#sl-tray) === */\n/* One traveling object: Layers | Inspect | About morph inside the tray. */\n\n#sl-tray {\n  --sl-drag: 0px;\n  position: fixed;\n  z-index: 45;\n  left: 0.85rem;\n  top: 4.6rem;\n  width: min(var(--tray-w, 300px), calc(100vw - 1.7rem));\n  max-height: calc(100dvh - 7.2rem);\n  display: flex;\n  flex-direction: column;\n  padding: 0.55rem 0.65rem 0.7rem;\n  border-radius: 8px;\n  border: 1px solid rgba(255, 255, 255, 0.08);\n  background: rgba(5, 7, 10, 0.78);\n  color: var(--text);\n  font: 500 12px/1.4 var(--sans);\n  backdrop-filter: blur(18px) saturate(1.08);\n  -webkit-backdrop-filter: blur(18px) saturate(1.08);\n  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);\n  overflow: hidden;\n  transition: opacity 180ms cubic-bezier(0.2, 0.8, 0.2, 1),\n    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);\n  will-change: transform, opacity;\n}\n\n#sl-tray .sl-tray-grab {\n  display: none;\n}\n\n#sl-tray .sl-tray-chrome {\n  display: flex;\n  align-items: center;\n  gap: 0.35rem;\n  margin-bottom: 0.45rem;\n  flex: 0 0 auto;\n}\n\n#sl-tray .sl-tray-tabs {\n  display: inline-flex;\n  gap: 4px;\n  flex: 1;\n  min-width: 0;\n}\n\n#sl-tray .sl-chip {\n  appearance: none;\n  min-height: 26px;\n  padding: 0.2rem 0.62rem;\n  border-radius: 8px;\n  border: 1px solid rgba(255, 255, 255, 0.14);\n  background: transparent;\n  color: var(--muted);\n  font-family: var(--mono);\n  font-size: 0.62rem;\n  font-weight: 500;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n  cursor: pointer;\n  transition: transform 100ms cubic-bezier(0.2, 0.8, 0.2, 1),\n    opacity 160ms cubic-bezier(0.2, 0.8, 0.2, 1),\n    background 160ms cubic-bezier(0.2, 0.8, 0.2, 1),\n    color 160ms cubic-bezier(0.2, 0.8, 0.2, 1),\n    border-color 160ms cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n\n#sl-tray .sl-chip.on {\n  background: rgba(77, 163, 255, 0.16);\n  border-color: rgba(77, 163, 255, 0.55);\n  color: #fff;\n}\n\n#sl-tray .sl-chip.is-press {\n  transform: scale(0.97);\n}\n\n#sl-tray .sl-tray-close {\n  border: 0;\n  background: transparent;\n  color: #94a3b8;\n  font-size: 18px;\n  line-height: 1;\n  cursor: pointer;\n  min-width: 28px;\n  min-height: 28px;\n  border-radius: 8px;\n}\n#sl-tray .sl-tray-close:hover { color: #fff; }\n#sl-tray .sl-tray-close[hidden] { display: none !important; }\n\n#sl-tray .sl-tray-stage {\n  position: relative;\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow: auto;\n}\n\n#sl-tray .sl-tray-pane {\n  transition: opacity 180ms cubic-bezier(0.2, 0.8, 0.2, 1),\n    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n#sl-tray .sl-tray-pane[hidden] { display: none !important; }\n\n#sl-tray[data-fly=\"right\"] #sl-pane-inspect {\n  animation: sl-tray-fly-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n#sl-tray[data-fly=\"left\"] #sl-pane-layers {\n  animation: sl-tray-fly-in-left 220ms cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n@keyframes sl-tray-fly-in {\n  from { opacity: 0; transform: translateX(10px); }\n  to { opacity: 1; transform: translateX(0); }\n}\n@keyframes sl-tray-fly-in-left {\n  from { opacity: 0; transform: translateX(-10px); }\n  to { opacity: 1; transform: translateX(0); }\n}\n\n#sl-tray .sl-tray-label {\n  margin: 0 0 0.4rem;\n  color: var(--muted);\n}\n\n#sl-tray .sl-mode {\n  display: inline-flex;\n  gap: 4px;\n  margin: 0 0 0.55rem;\n}\n\n#sl-tray .sl-tray-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin: 0.28rem 0;\n  cursor: pointer;\n  font-size: 0.76rem;\n  color: var(--soft);\n}\n#sl-tray .sl-tray-row input {\n  accent-color: #4da3ff;\n  width: 0.9rem;\n  height: 0.9rem;\n}\n#sl-tray .swatch {\n  width: 10px;\n  height: 10px;\n  border-radius: 2px;\n  flex: 0 0 auto;\n}\n#sl-tray .swatch.power { background: #C73030; }\n#sl-tray .swatch.telecom { background: #22d3ee; }\n#sl-tray .swatch.gas { background: #f59e0b; }\n#sl-tray .swatch.subsea { background: #2dd4bf; }\n#sl-tray .swatch.contour { background: #e8dcb4; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.35); }\n#sl-tray .sl-honesty-chip {\n  display: inline-flex;\n  margin: 0.15rem 0 0.35rem;\n  padding: 2px 8px;\n  border-radius: 8px;\n  border: 1px solid rgba(232, 220, 180, 0.35);\n  font-family: var(--mono);\n  font-size: 0.58rem;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  color: #e8dcb4;\n  background: rgba(232, 220, 180, 0.08);\n}\n\n#sl-tray .sl-tray-note,\n#sl-tray .sl-tray-status {\n  margin: 0.55rem 0 0;\n  color: #94a3b8;\n  font-weight: 400;\n  font-size: 0.68rem;\n  line-height: 1.45;\n}\n#sl-tray .sl-tray-status { color: #cbd5e1; }\n\n#sl-tray .sl-inspect-empty {\n  padding: 1.1rem 0.2rem;\n  color: var(--muted);\n  font-size: 0.78rem;\n  text-align: center;\n}\n\n#sl-tray .sl-fc-head {\n  display: flex;\n  justify-content: space-between;\n  gap: 8px;\n  margin-bottom: 6px;\n}\n#sl-tray .sl-fc-head h3 {\n  margin: 0;\n  font-size: 0.82rem;\n  font-weight: 600;\n  color: #fff;\n  letter-spacing: -0.01em;\n}\n#sl-tray .sl-fc-badge {\n  display: inline-flex;\n  margin: 0 0 8px;\n  padding: 2px 8px;\n  border-radius: 8px;\n  border: 1px solid rgba(255, 255, 255, 0.14);\n  font-family: var(--mono);\n  font-size: 0.58rem;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n  color: #cbd5e1;\n  background: transparent;\n}\n#sl-tray .sl-fc-badge.osm {\n  color: #fbbf24;\n  border-color: rgba(251, 191, 36, 0.35);\n}\n#sl-tray .sl-fc-primary {\n  font-size: 0.95rem;\n  font-weight: 600;\n  color: #fff;\n  margin: 0 0 8px;\n  font-family: var(--mono);\n}\n#sl-tray .sl-fc-row {\n  display: grid;\n  grid-template-columns: 38% 1fr;\n  gap: 6px;\n  padding: 4px 0;\n  border-top: 1px solid rgba(255, 255, 255, 0.06);\n  font-size: 0.7rem;\n}\n#sl-tray .sl-fc-row .k { color: #94a3b8; }\n#sl-tray .sl-fc-row .v {\n  color: #e2e8f0;\n  word-break: break-word;\n  font-family: var(--mono);\n  font-size: 0.66rem;\n}\n#sl-tray .sl-fc-row .v.copyable { cursor: copy; }\n#sl-tray .sl-fc-note {\n  margin: 8px 0 0;\n  color: #94a3b8;\n  font-size: 0.68rem;\n  font-weight: 400;\n}\n\n/* Hide legacy corner cards if any stale markup remains */\n#siteline-oim-panel,\n#sl-feature-card {\n  display: none !important;\n}\n\n/* React panels: same family tokens as tray */\n.layer-panel,\n.brief-panel {\n  border-radius: 8px;\n  padding: 0.65rem 0.75rem 0.8rem;\n  background: rgba(5, 7, 10, 0.78);\n  border: 1px solid rgba(255, 255, 255, 0.08);\n  backdrop-filter: blur(18px) saturate(1.08);\n  -webkit-backdrop-filter: blur(18px) saturate(1.08);\n}\n.layer-panel {\n  width: min(var(--tray-w, 300px), calc(100vw - 1.7rem));\n}\n.panel-head h2 {\n  font-size: 0.86rem;\n}\n.layer-name { font-size: 0.76rem; }\n\n/* Desktop: keep jump bar clear of tray */\n@media (min-width: 981px) {\n  .map-jump-bar { left: calc(var(--tray-w, 300px) + 1.4rem); }\n  .app-shell.layers-open .map-jump-bar {\n    left: calc(var(--tray-w, 300px) * 2 + 2rem);\n  }\n}\n\n/* Mobile bottom sheet */\n@media (max-width: 980px) {\n  #sl-tray {\n    left: 0;\n    right: 0;\n    top: auto;\n    bottom: calc(3.4rem + env(safe-area-inset-bottom, 0px));\n    width: 100%;\n    max-height: none;\n    border-radius: 8px 8px 0 0;\n    padding-top: 0.35rem;\n    transform: translateY(var(--sl-drag, 0px));\n  }\n  #sl-tray .sl-tray-grab {\n    display: block;\n    width: 36px;\n    height: 4px;\n    border-radius: 999px;\n    background: rgba(255, 255, 255, 0.22);\n    margin: 0.15rem auto 0.45rem;\n    cursor: grab;\n    touch-action: none;\n  }\n  #sl-tray[data-sheet=\"peek\"] {\n    height: 88px;\n    max-height: 88px;\n  }\n  #sl-tray[data-sheet=\"half\"] {\n    height: min(46dvh, 420px);\n    max-height: min(46dvh, 420px);\n  }\n  #sl-tray[data-sheet=\"full\"] {\n    height: min(78dvh, 720px);\n    max-height: min(78dvh, 720px);\n  }\n  #sl-tray.is-dragging {\n    transition: none;\n  }\n  .maplibregl-ctrl-bottom-right { bottom: 6.5rem !important; }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  #sl-tray,\n  #sl-tray .sl-tray-pane,\n  #sl-tray .sl-chip,\n  .layer-panel,\n  .brief-panel {\n    transition: opacity 160ms linear !important;\n    animation: none !important;\n  }\n  #sl-tray[data-fly=\"right\"] #sl-pane-inspect,\n  #sl-tray[data-fly=\"left\"] #sl-pane-layers {\n    animation: none !important;\n  }\n  #sl-tray .sl-chip.is-press { transform: none; }\n}\n\n@media (prefers-reduced-transparency: reduce) {\n  #sl-tray,\n  .layer-panel,\n  .brief-panel,\n  .panel,\n  .sl-panel,\n  .sl-about-card {\n    background: #07080a !important;\n    backdrop-filter: none !important;\n    -webkit-backdrop-filter: none !important;\n  }\n}\n\n#sl-tray .sl-chip {\n  padding: 0.2rem 0.45rem;\n  letter-spacing: 0.08em;\n  font-size: 0.58rem;\n}\n#sl-tray .sl-honesty-chip.live,\n#sl-tray .sl-fc-badge.live {\n  color: #86efac;\n  border-color: rgba(134, 239, 172, 0.4);\n  background: rgba(134, 239, 172, 0.08);\n}\n#sl-tray .sl-honesty-chip.dem,\n#sl-tray .sl-fc-badge.dem {\n  color: #e8dcb4;\n  border-color: rgba(232, 220, 180, 0.35);\n  background: rgba(232, 220, 180, 0.08);\n}\n#sl-tray .sl-honesty-chip.osm {\n  color: #fbbf24;\n  border-color: rgba(251, 191, 36, 0.35);\n  background: rgba(251, 191, 36, 0.08);\n}\n#sl-tray .sl-honesty-chip.catalog {\n  color: #cbd5e1;\n  border-color: rgba(255, 255, 255, 0.14);\n  background: transparent;\n}\n#sl-tray .sl-honesty-chip.unk {\n  color: #94a3b8;\n  border-color: rgba(148, 163, 184, 0.35);\n  background: rgba(148, 163, 184, 0.08);\n}\n#sl-tray .sl-about-list {\n  display: grid;\n  gap: 0.4rem;\n}\n#sl-tray .sl-about-src {\n  border: 1px solid rgba(255, 255, 255, 0.06);\n  border-radius: 8px;\n  padding: 0.4rem 0.5rem;\n  background: rgba(255, 255, 255, 0.03);\n}\n#sl-tray .sl-about-src header {\n  display: flex;\n  justify-content: space-between;\n  gap: 0.4rem;\n  align-items: flex-start;\n  font-size: 0.72rem;\n}\n#sl-tray .sl-about-src header strong {\n  color: #fff;\n  font-weight: 600;\n}\n#sl-tray .sl-about-src .sl-honesty-chip {\n  margin: 0;\n  flex: 0 0 auto;\n}\n#sl-tray .sl-about-meta {\n  margin: 0.15rem 0;\n  color: #94a3b8;\n  font-size: 0.62rem;\n}\n#sl-tray .sl-about-src a {\n  color: #4da3ff;\n  font-size: 0.6rem;\n  word-break: break-all;\n  text-decoration: none;\n}\n#sl-tray .sl-about-src a:hover { text-decoration: underline; }\n#sl-tray .sl-about-credit {\n  margin: 0.7rem 0 0;\n  color: #cbd5e1;\n  font-size: 0.68rem;\n}\n#sl-tray .sl-about-credit a {\n  color: #4da3ff;\n  text-decoration: none;\n}\n#sl-tray .sl-about-credit a:hover { text-decoration: underline; }\n#sl-tray .sl-elev-host {\n  margin-top: 0.55rem;\n  padding-top: 0.35rem;\n  border-top: 1px solid rgba(255, 255, 255, 0.08);\n}\n#sl-tray .sl-elev-line {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 4px 6px;\n  font-family: var(--mono);\n  font-size: 0.66rem;\n  color: #e2e8f0;\n  line-height: 1.45;\n}\n#sl-tray .sl-elev-sep { color: #64748b; }\n#sl-tray[data-fly=\"right\"] #sl-pane-about {\n  animation: sl-tray-fly-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n";


const ATLAS_SHEET_CSS = `/* atlas-sheet: bottom-left float, jumps in tray, map stays visible */

.atlas-nav,
.menu-btn {
  display: none !important;
}
.sl-layers-chip {
  margin-left: auto;
  appearance: none;
  min-height: 28px;
  padding: 0.18rem 0.72rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(5, 6, 8, 0.86);
  color: #fff;
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 0.6rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
}
.sl-layers-chip:hover { border-color: rgba(255, 255, 255, 0.28); }
#sl-tray {
  left: 12px !important;
  right: auto !important;
  top: auto !important;
  bottom: 16px !important;
  width: min(320px, calc(100vw - 24px)) !important;
  max-height: min(52vh, 480px) !important;
  height: auto;
  padding: 8px 10px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(5, 6, 8, 0.94);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55);
  transform: translateY(var(--sl-drag, 0px));
  transform-origin: left bottom;
}
#sl-tray .sl-tray-grab {
  display: block;
  width: 32px;
  height: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  margin: 1px auto 6px;
  cursor: ns-resize;
  touch-action: none;
  flex: 0 0 auto;
}
#sl-tray[data-sheet="peek"] {
  max-height: 64px !important;
  height: auto !important;
}
#sl-tray[data-sheet="peek"] .sl-tray-stage { display: none !important; }
#sl-tray[data-sheet="half"],
#sl-tray[data-sheet="full"] {
  max-height: min(52vh, 480px) !important;
}
#sl-tray[data-tab="inspect"][data-empty="1"] {
  max-height: 132px !important;
}
#sl-tray .sl-tray-label {
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 0.56rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.46);
  margin: 0 0 0.28rem;
}
#sl-tray .sl-jump-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 4px;
  margin: 0 0 8px;
}
#sl-tray .sl-jump-row .sl-chip {
  width: 100%;
  min-height: 26px;
  padding: 0.16rem 0.2rem;
  text-align: center;
}
#sl-tray .sl-tray-note {
  margin: 0.4rem 0 0;
  font-size: 0.64rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.42);
}
#sl-tray .sl-inspect-empty {
  padding: 0.35rem 0.1rem 0.15rem;
  font-size: 0.72rem;
  text-align: left;
}
.map-jump-bar,
.map-wrap > .map-jump-bar,
.map-stage .map-jump-bar,
.map-root + .map-jump-bar {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
.layer-panel,
#layer-panel,
.app-shell.layers-open .layer-panel,
.sheet-backdrop {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
  opacity: 0 !important;
}
#sl-tray .sl-about-lead {
  margin: 0 0 0.55rem;
}
#sl-tray .sl-about-lead p {
  margin: 0 0 0.32rem;
  color: #cbd5e1;
  font-size: 0.68rem;
  line-height: 1.4;
  font-weight: 400;
}
#sl-tray .sl-about-credit {
  margin: 0.65rem 0 0;
  color: #cbd5e1;
  font-size: 0.66rem;
  line-height: 1.45;
}
@media (max-width: 980px) {
  #sl-tray {
    left: 12px !important;
    right: auto !important;
    top: auto !important;
    bottom: 16px !important;
    width: min(320px, calc(100vw - 24px)) !important;
    max-height: min(52vh, 480px) !important;
    border-radius: 10px !important;
  }
}
`;

function injectTrayStyles() {
  if (document.getElementById('sl-tray-css')) return;
  const s = document.createElement('style');
  s.id = 'sl-tray-css';
  s.textContent = TRAY_CSS + ATLAS_SHEET_CSS;
  document.head.appendChild(s);
}

function boot() {
  injectTrayStyles();
  ensureTray();
  routeLayersClicks();
  if (window.__SITELINE_MAP__) attach(window.__SITELINE_MAP__);
  window.addEventListener("siteline-map-ready", (ev) => {
    const map = ev?.detail || window.__SITELINE_MAP__;
    if (map) attach(map);
  });
  window.addEventListener("siteline-map-created", (ev) => {
    const map = ev?.detail || window.__SITELINE_MAP__;
    if (map) attach(map);
  });
  let tries = 0;
  const poll = window.setInterval(() => {
    tries += 1;
    if (window.__SITELINE_MAP__) {
      attach(window.__SITELINE_MAP__);
      window.clearInterval(poll);
    } else if (tries > 80) {
      window.clearInterval(poll);
      setStatus("Map hook missed. Reload once. As-built fiber UNKNOWN.");
    }
  }, 250);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (state.selected) {
        clearInspect();
        setTrayTab("layers");
      }
    }
  });
}
boot();

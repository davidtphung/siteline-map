/**
 * Siteline Hypergrid · GIS · grid layers (public CATALOG endpoints).
 * NLT143 RESEARCH by David T Phung
 *
 * Honesty: plant MW = nameplate catalog not interconnect;
 * HIFLD has no transformer MVA; FCC = availability not as-built fiber;
 * OIM water/telecom = OSM-mapped only. EPQS = point elevation only.
 * Never invent MW/MVA/headroom or as-built routes.
 */
export const GIS_DEBOUNCE_MS = 400;
export const GIS_RECORD_CAP = 2000;

export const USGS_TOPO_TILES = [
  'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
];
export const ESRI_TOPO_TILES = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
];
export const OIM_TILES = ['https://openinframap.org/tiles/{z}/{x}/{y}.pbf'];
export const OIM_TILEJSON = 'https://openinframap.org/map.json';
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
export const EPQS_URL = 'https://epqs.nationalmap.gov/v1/json';

const FCC_BASE =
  'https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/FCC_Broadband_Data_Collection_December_2024_View/FeatureServer';

/** Layer catalog: toggles, zoom gates, defaults, ArcGIS query URLs. */
export const GIS_LAYERS = {
  topo: {
    id: 'topo',
    label: 'USGS topo underlay',
    kind: 'raster',
    defaultOn: true,
    minZoom: 0,
    truth: 'CATALOG',
    sourceNote: 'USGS National Map topo tiles',
  },
  oim: {
    id: 'oim',
    label: 'OpenInfraMap power',
    kind: 'vector',
    defaultOn: true,
    minZoom: 4,
    truth: 'CATALOG',
    sourceNote: 'OpenInfraMap / OSM (DEPRECATED tilejson; tiles still serve)',
  },
  transmission: {
    id: 'transmission',
    label: 'HIFLD transmission',
    kind: 'arcgis',
    url: 'https://services2.arcgis.com/LYMgRMwHfrWWEg3s/arcgis/rest/services/HIFLD_US_Electric_Power_Transmission_Lines/FeatureServer/0/query',
    geom: 'line',
    sourceId: 'gis-tx',
    layerIds: ['gis-tx-line'],
    defaultOn: true,
    minZoom: 5,
    truth: 'CATALOG',
    sourceNote: 'HIFLD electric transmission',
  },
  substations: {
    id: 'substations',
    label: 'HIFLD substations',
    kind: 'arcgis',
    url: 'https://services.arcgis.com/njFNhDsUCentVYJW/ArcGIS/rest/services/Substations/FeatureServer/0/query',
    geom: 'point',
    sourceId: 'gis-subs',
    layerIds: ['gis-subs-sq'],
    defaultOn: true,
    minZoom: 5,
    truth: 'CATALOG',
    sourceNote: 'HIFLD substations (no transformer MVA)',
  },
  plants: {
    id: 'plants',
    label: 'EIA plants',
    kind: 'arcgis',
    url: 'https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Power_Plants_in_the_US/FeatureServer/0/query',
    geom: 'point',
    sourceId: 'gis-plants',
    layerIds: ['gis-plants-pt'],
    defaultOn: true,
    minZoom: 5,
    truth: 'CATALOG',
    sourceNote: 'EIA Power Plants (nameplate MW, not interconnect)',
  },
  wellsOp: {
    id: 'wellsOp',
    label: 'NETL operating wells',
    kind: 'arcgis',
    url: 'https://arcgis.netl.doe.gov/server/rest/services/Hosted/Integrated_Public_Wells_AugEY25/FeatureServer/0/query',
    where: "status_category LIKE '%Active%'",
    geom: 'point',
    sourceId: 'gis-wells-op',
    layerIds: ['gis-wells-op-pt'],
    defaultOn: false,
    minZoom: 7,
    truth: 'CATALOG',
    sourceNote: 'NETL Integrated Public Wells (Active filter)',
  },
  wellsOrphan: {
    id: 'wellsOrphan',
    label: 'NETL orphaned wells',
    kind: 'arcgis',
    url: 'https://arcgis.netl.doe.gov/server/rest/services/Hosted/Orphaned_Wells_v2/FeatureServer/113/query',
    geom: 'point',
    sourceId: 'gis-wells-orphan',
    layerIds: ['gis-wells-orphan-pt'],
    defaultOn: false,
    minZoom: 7,
    truth: 'CATALOG',
    sourceNote: 'NETL Orphaned Wells v2 L113',
  },
  nhd: {
    id: 'nhd',
    label: 'NHD watercourses',
    kind: 'arcgis',
    url: 'https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/6/query',
    geom: 'line',
    sourceId: 'gis-nhd',
    layerIds: ['gis-nhd-line'],
    defaultOn: true,
    minZoom: 8,
    truth: 'CATALOG',
    sourceNote: 'USGS NHD flowlines (watercourses)',
  },
  nhdWaterbodies: {
    id: 'nhdWaterbodies',
    label: 'NHD waterbodies',
    kind: 'arcgis',
    url: 'https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/12/query',
    geom: 'polygon',
    sourceId: 'gis-nhd-wb',
    layerIds: ['gis-nhd-wb-fill', 'gis-nhd-wb-outline'],
    defaultOn: true,
    minZoom: 8,
    truth: 'CATALOG',
    sourceNote: 'USGS NHD waterbodies (lakes / reservoirs)',
  },
  oimWater: {
    id: 'oimWater',
    label: 'OIM water utilities (OSM)',
    kind: 'vector',
    sourceId: 'oim-power',
    layerIds: ['gis-oim-water-line', 'gis-oim-water-pt'],
    defaultOn: true,
    minZoom: 6,
    truth: 'CATALOG',
    sourceNote: 'OpenInfraMap water_pipeline · OSM-mapped only',
  },
  fcc: {
    id: 'fcc',
    label: 'FCC BDC availability',
    kind: 'fcc',
    geom: 'polygon',
    sourceId: 'gis-fcc',
    layerIds: ['gis-fcc-fill'],
    defaultOn: true,
    minZoom: 9,
    truth: 'CATALOG',
    sourceNote: 'FCC BDC Dec 2024 View (availability, not as-built fiber)',
  },
  oimTelecom: {
    id: 'oimTelecom',
    label: 'OIM telecom (OSM mapped)',
    kind: 'vector',
    sourceId: 'oim-power',
    layerIds: ['gis-oim-telecom-line', 'gis-oim-telecom-mast'],
    defaultOn: true,
    minZoom: 6,
    truth: 'OSM_MAPPED_COMMS',
    sourceNote: 'OpenInfraMap telecom · OSM-mapped only · not as-built plant',
  },
  wellsNm: {
    id: 'wellsNm',
    label: 'NM OCD wells',
    kind: 'arcgis',
    url: 'https://services5.arcgis.com/f4lpEvI6fkgVYigk/ArcGIS/rest/services/New_Mexico_Oil_and_Gas_Wells__Nov2024/FeatureServer/30/query',
    geom: 'point',
    sourceId: 'gis-wells-nm',
    layerIds: ['gis-wells-nm-pt'],
    defaultOn: false,
    minZoom: 7,
    truth: 'CATALOG',
    sourceNote: 'NM OCD wells Nov2024',
  },
  wellsCo: {
    id: 'wellsCo',
    label: 'CO OGCC wells',
    kind: 'arcgis',
    url: 'https://data.dnrgis.state.co.us/arcgis/rest/services/DNR_Public/OGCC_Wells/FeatureServer/0/query',
    geom: 'point',
    sourceId: 'gis-wells-co',
    layerIds: ['gis-wells-co-pt'],
    defaultOn: false,
    minZoom: 7,
    truth: 'CATALOG',
    sourceNote: 'CO OGCC wells',
  },
  flood: {
    id: 'flood',
    label: 'FEMA flood (NFHL)',
    kind: 'arcgis',
    url: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query',
    geom: 'polygon',
    sourceId: 'gis-flood',
    layerIds: ['gis-flood-fill', 'gis-flood-outline'],
    defaultOn: false,
    minZoom: 9,
    truth: 'CATALOG',
    sourceNote: 'FEMA NFHL flood hazard zones',
  },
  osmDc: {
    id: 'osmDc',
    label: 'OSM data centers',
    kind: 'overpass',
    sourceId: 'gis-osm-dc',
    layerIds: ['gis-osm-dc-pt'],
    defaultOn: false,
    minZoom: 10,
    truth: 'CATALOG',
    sourceNote: 'OSM Overpass data_center tags only',
  },
};

const EMPTY = { type: 'FeatureCollection', features: [] };

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mapBbox(map) {
  const b = map.getBounds();
  return {
    xmin: b.getWest(),
    ymin: b.getSouth(),
    xmax: b.getEast(),
    ymax: b.getNorth(),
  };
}

function envelopeJson(bb) {
  return JSON.stringify({
    xmin: bb.xmin,
    ymin: bb.ymin,
    xmax: bb.xmax,
    ymax: bb.ymax,
    spatialReference: { wkid: 4326 },
  });
}

function fccUrlForZoom(z) {
  // counties 1, tracts 2, blockGroups 3, h3 5
  if (z < 10) return { url: `${FCC_BASE}/1/query`, label: 'counties' };
  if (z < 11.5) return { url: `${FCC_BASE}/2/query`, label: 'tracts' };
  if (z < 13) return { url: `${FCC_BASE}/3/query`, label: 'block groups' };
  return { url: `${FCC_BASE}/5/query`, label: 'H3' };
}

async function queryArcGisGeoJSON(url, bb, { where = '1=1', signal, recordCap = GIS_RECORD_CAP } = {}) {
  const params = new URLSearchParams({
    where,
    geometry: envelopeJson(bb),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    resultRecordCount: String(recordCap),
    f: 'geojson',
  });
  const res = await fetch(`${url}?${params.toString()}`, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  // Some hosts return FeatureCollection; others return {features:[...]} without type.
  if (json?.type === 'FeatureCollection') return json;
  if (Array.isArray(json?.features)) {
    return {
      type: 'FeatureCollection',
      features: json.features.map((f, i) => ({
        type: 'Feature',
        id: f.id ?? i,
        properties: f.properties || f.attributes || {},
        geometry: f.geometry,
      })).filter((f) => f.geometry),
    };
  }
  if (json?.error) throw new Error(json.error.message || 'ArcGIS error');
  return EMPTY;
}

async function queryOverpassDCs(bb, signal) {
  const s = bb.ymin.toFixed(5);
  const w = bb.xmin.toFixed(5);
  const n = bb.ymax.toFixed(5);
  const e = bb.xmax.toFixed(5);
  const data = `
[out:json][timeout:25];
(
  nwr["telecom"="data_center"](${s},${w},${n},${e});
  nwr["building"="data_center"](${s},${w},${n},${e});
);
out center tags 200;
`.trim();
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data }).toString(),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const features = [];
  const seen = new Set();
  for (const el of json.elements || []) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const osmId = `${el.type}/${el.id}`;
    if (seen.has(osmId)) continue;
    seen.add(osmId);
    const tags = el.tags || {};
    features.push({
      type: 'Feature',
      properties: {
        osmId,
        name: tags.name || null,
        operator: tags.operator || null,
        building: tags.building || null,
        telecom: tags.telecom || null,
      },
      geometry: { type: 'Point', coordinates: [lon, lat] },
    });
    if (features.length >= 200) break;
  }
  return { type: 'FeatureCollection', features };
}


async function fetchEpqsElevation(lng, lat, signal) {
  const url = new URL(EPQS_URL);
  url.searchParams.set('x', String(lng));
  url.searchParams.set('y', String(lat));
  url.searchParams.set('units', 'Feet');
  url.searchParams.set('wkid', '4326');
  const res = await fetch(url.toString(), {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const raw = typeof json.value === 'string' ? parseFloat(json.value) : json.value;
  return typeof raw === 'number' && !Number.isNaN(raw) ? raw : null;
}


export { fetchEpqsElevation };

/** Earth-surface distance (km). Turf-less. */
function haversineKm(lng1, lat1, lng2, lat2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function formatDistKmMi(km) {
  if (km == null || Number.isNaN(km)) return 'UNKNOWN';
  const mi = km * 0.621371;
  if (km < 1) {
    return `${Math.round(km * 1000)} m / ${Math.round(mi * 5280)} ft`;
  }
  return `${km.toFixed(2)} km / ${mi.toFixed(2)} mi`;
}

function collectCoordSamples(geom, out, stride = 1) {
  if (!geom || !geom.coordinates) return;
  const walk = (node, depth) => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      out.push([node[0], node[1]]);
      return;
    }
    for (let i = 0; i < node.length; i += depth === 0 ? stride : 1) {
      walk(node[i], depth + 1);
    }
  };
  walk(geom.coordinates, 0);
}

/** FCC BDC technology codes (catalog). Unknown codes stay numeric. */
const FCC_TECH_LABEL = {
  10: 'Copper',
  40: 'Cable',
  50: 'Fiber',
  60: 'Satellite',
  70: 'Unlicensed FW',
  71: 'Licensed FW',
  72: 'Licensed-by-rule FW',
};

function fccTechLabel(code) {
  const n = Number(code);
  if (Number.isFinite(n) && FCC_TECH_LABEL[n]) return FCC_TECH_LABEL[n];
  if (code == null || code === '') return null;
  return String(code);
}

/**
 * One-shot ArcGIS point query for FCC H3 (then block groups) at pin.
 * Does not require the FCC layer to be enabled.
 */
async function queryFccAtPoint(lng, lat, signal) {
  const pointGeom = JSON.stringify({
    x: lng,
    y: lat,
    spatialReference: { wkid: 4326 },
  });
  const layers = [
    { url: `${FCC_BASE}/5/query`, label: 'H3' },
    { url: `${FCC_BASE}/3/query`, label: 'block groups' },
  ];
  for (const layer of layers) {
    const params = new URLSearchParams({
      geometry: pointGeom,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: 'false',
      outSR: '4326',
      resultRecordCount: '5',
      f: 'geojson',
    });
    const res = await fetch(`${layer.url}?${params.toString()}`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      signal,
    });
    if (!res.ok) continue;
    const json = await res.json();
    const feats = json?.features || [];
    if (!feats.length) continue;
    const props = feats[0].properties || feats[0].attributes || {};
    return { props, grain: layer.label, geoid: props.GEOID || null };
  }
  return null;
}

/** Optional related BDC provider rows for a GEOID (H3 related table). */
async function queryFccProvidersByGeoid(geoid, signal) {
  if (!geoid) return [];
  const params = new URLSearchParams({
    where: `GEOID='${String(geoid).replace(/'/g, "''")}'`,
    outFields: 'ProviderName,Technology,ServedBSLs,TotalBSLs',
    returnGeometry: 'false',
    resultRecordCount: '40',
    f: 'json',
  });
  const url = `${FCC_BASE}/6/query?${params.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    signal,
  });
  if (!res.ok) return [];
  const json = await res.json();
  const rows = [];
  for (const f of json.features || []) {
    const a = f.attributes || f.properties || {};
    const name = a.ProviderName ?? a.provider ?? a.brand ?? null;
    if (!name) continue;
    rows.push({
      name: String(name),
      tech: fccTechLabel(a.Technology ?? a.technology),
      served: a.ServedBSLs ?? null,
      total: a.TotalBSLs ?? null,
      bizRes: a.BusinessResidentialCode ?? a.business ?? a.residential ?? null,
    });
  }
  return rows;
}

/** Pull present FCC summary fields only (never invent). */
function fccSummaryRows(props) {
  if (!props || typeof props !== 'object') return [];
  const want = [
    ['GEOID', 'GEOID'],
    ['TotalBSLs', 'Total BSLs'],
    ['ServedBSLs', 'Served BSLs'],
    ['ServedBSLsFiber', 'Fiber-served BSLs'],
    ['ServedBSLsCable', 'Cable-served BSLs'],
    ['ServedBSLsCopper', 'Copper-served BSLs'],
    ['UniqueProviders', 'Unique providers'],
    ['UniqueProvidersFiber', 'Fiber providers'],
    ['UniqueProvidersCable', 'Cable providers'],
    ['UniqueProvidersCopper', 'Copper providers'],
    ['ProviderName', 'Provider'],
    ['provider', 'Provider'],
    ['brand', 'Brand'],
    ['Technology', 'Technology'],
    ['technology', 'Technology'],
    ['BusinessResidentialCode', 'Biz/Res'],
    ['business', 'Business'],
    ['residential', 'Residential'],
  ];
  const rows = [];
  const seen = new Set();
  for (const [key, label] of want) {
    if (!(key in props)) continue;
    const v = props[key];
    if (v === null || v === undefined || v === '') continue;
    if (seen.has(label)) continue;
    seen.add(label);
    rows.push({ label, value: String(v) });
  }
  return rows;
}


function setVis(map, layerId, on) {
  if (!map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, 'visibility', on ? 'visible' : 'none');
}

function popupRow(k, v) {
  return `<div class="popup-row"><span class="k">${esc(k)}</span><span class="v">${v}</span></div>`;
}

function popupGis(title, rows, sourceNote) {
  return `
    <div class="popup-card">
      <div class="popup-head">
        <h3>${esc(title)}</h3>
        <span class="popup-badge badge-catalog">CATALOG</span>
      </div>
      <div class="popup-meta">
        ${rows.join('')}
        ${popupRow('Source', esc(sourceNote))}
      </div>
      <p class="truth">CATALOG · public GIS · not live telemetry · no invented MVA/headroom</p>
    </div>`;
}

function val(p, ...keys) {
  for (const k of keys) {
    const v = p?.[k];
    if (v !== null && v !== undefined && v !== '') return v;
  }
  return null;
}

function fmtKv(v) {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return 'UNKNOWN';
  const n = Number(v);
  if (n < 0 || n > 1200) return 'UNKNOWN';
  return `${n} kV`;
}

function fmtMwNameplate(v) {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return 'UNKNOWN';
  return `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })} MW nameplate`;
}

/**
 * Create GIS controller bound to a MapLibre map + UI hooks.
 */
export function createGisController(map, popup, hooks = {}) {
  const enabled = {};
  for (const [k, def] of Object.entries(GIS_LAYERS)) {
    enabled[k] = !!def.defaultOn;
  }

  let debounceTimer = null;
  let abort = null;
  let fetching = 0;
  let oimStatus = 'pending'; // pending | ok | unknown
  let oimDetail = '';
  // OIM water / telecom sublayer resolution (source-layer probe results)
  const oimWaterOk = { line: null, point: null }; // resolved source-layer name or null
  const oimTelecomOk = { line: null, mast: null };

  const setLoading = (on) => {
    hooks.onLoading?.(on);
  };
  const setStatus = (id, state, detail) => {
    hooks.onStatus?.(id, state, detail);
  };

  function bumpFetch(delta) {
    fetching = Math.max(0, fetching + delta);
    setLoading(fetching > 0);
  }

  function ensureSourcesAndLayers() {
    // Topo raster underlay (below Hypergrid; try insert before first hypergrid layer)
    if (!map.getSource('usgs-topo')) {
      map.addSource('usgs-topo', {
        type: 'raster',
        tiles: USGS_TOPO_TILES,
        tileSize: 256,
        attribution: 'USGS National Map',
        maxzoom: 16,
      });
    }
    if (!map.getLayer('gis-topo')) {
      const before = map.getLayer('hypergrid-policy-diamond')
        ? 'hypergrid-policy-diamond'
        : undefined;
      const layer = {
        id: 'gis-topo',
        type: 'raster',
        source: 'usgs-topo',
        layout: { visibility: enabled.topo ? 'visible' : 'none' },
        paint: { 'raster-opacity': 0.55 },
      };
      if (before) map.addLayer(layer, before);
      else map.addLayer(layer);
    }

    // OIM vector power
    if (!map.getSource('oim-power')) {
      try {
        map.addSource('oim-power', {
          type: 'vector',
          tiles: OIM_TILES,
          maxzoom: 17,
          attribution: 'OpenInfraMap · © OpenStreetMap',
        });
        oimStatus = 'ok';
        oimDetail = 'vector tiles CORS ok';
      } catch (err) {
        oimStatus = 'unknown';
        oimDetail = `OIM: UNKNOWN (tile CORS) · ${err?.message || 'failed'}`;
      }
    }
    if (map.getSource('oim-power') && !map.getLayer('gis-oim-line')) {
      const before = map.getLayer('hypergrid-policy-diamond')
        ? 'hypergrid-policy-diamond'
        : undefined;
      const add = (spec) => {
        if (before) map.addLayer(spec, before);
        else map.addLayer(spec);
      };
      add({
        id: 'gis-oim-line',
        type: 'line',
        source: 'oim-power',
        'source-layer': 'power_line',
        layout: { visibility: enabled.oim ? 'visible' : 'none' },
        paint: {
          'line-color': '#e6c07b',
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 10, 1.4, 14, 2.2],
          'line-opacity': 0.55,
        },
        minzoom: 4,
      });
      add({
        id: 'gis-oim-sub',
        type: 'circle',
        source: 'oim-power',
        'source-layer': 'power_substation_point',
        layout: { visibility: enabled.oim ? 'visible' : 'none' },
        paint: {
          'circle-radius': 3,
          'circle-color': '#f0c14a',
          'circle-opacity': 0.7,
          'circle-stroke-width': 0.8,
          'circle-stroke-color': 'rgba(0,0,0,0.5)',
        },
        minzoom: 8,
      });

      // OIM water / telecom: probe candidates; MapLibre rarely throws on missing
      // source-layer, so prefer known TileJSON ids (verified live) and mark others UNKNOWN.
      const OIM_KNOWN = new Set([
        'power_line', 'power_tower', 'power_substation', 'power_substation_point',
        'power_plant', 'power_plant_point', 'power_generator', 'power_generator_area',
        'power_heatmap_solar', 'power_transformer', 'power_compensator', 'power_switch',
        'telecoms_communication_line', 'telecoms_data_center', 'telecoms_mast',
        'petroleum_pipeline', 'petroleum_well', 'petroleum_site',
        'water_pipeline', 'water', 'rainwater',
      ]);

      const tryAddOim = (spec, candidates) => {
        if (map.getLayer(spec.id)) {
          return candidates.find((c) => OIM_KNOWN.has(c)) || null;
        }
        for (const sl of candidates) {
          if (!OIM_KNOWN.has(sl)) continue;
          try {
            add({ ...spec, 'source-layer': sl });
            return sl;
          } catch (err) {
            if (map.getLayer(spec.id)) {
              try { map.removeLayer(spec.id); } catch (_) { /* ignore */ }
            }
          }
        }
        // No known candidate: record UNKNOWN without adding a broken layer
        return null;
      };

      if (!oimWaterOk.line) {
        oimWaterOk.line = tryAddOim(
          {
            id: 'gis-oim-water-line',
            type: 'line',
            source: 'oim-power',
            layout: { visibility: enabled.oimWater ? 'visible' : 'none' },
            paint: {
              'line-color': '#56b6c2',
              'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 12, 1.6, 16, 2.4],
              'line-opacity': 0.85,
            },
            minzoom: 6,
          },
          ['water_pipeline', 'pipeline_water', 'waterway'],
        );
      }

      // Water towers / treatment points are not in OIM TileJSON; leave UNKNOWN
      if (oimWaterOk.point === null && !map.getLayer('gis-oim-water-pt')) {
        oimWaterOk.point = tryAddOim(
          {
            id: 'gis-oim-water-pt',
            type: 'circle',
            source: 'oim-power',
            layout: { visibility: enabled.oimWater ? 'visible' : 'none' },
            paint: {
              'circle-radius': 3.5,
              'circle-color': '#4fc3f7',
              'circle-opacity': 0.85,
              'circle-stroke-width': 0.8,
              'circle-stroke-color': 'rgba(0,0,0,0.45)',
            },
            minzoom: 9,
          },
          ['water_tower', 'water_treatment', 'water_point'],
        );
        // Explicit UNKNOWN if none matched (do not invent)
        if (oimWaterOk.point === null) oimWaterOk.point = false;
      }

      if (!oimTelecomOk.line) {
        oimTelecomOk.line = tryAddOim(
          {
            id: 'gis-oim-telecom-line',
            type: 'line',
            source: 'oim-power',
            layout: { visibility: enabled.oimTelecom ? 'visible' : 'none' },
            paint: {
              'line-color': '#c678dd',
              'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.7, 12, 1.5, 16, 2.2],
              'line-opacity': 0.8,
            },
            minzoom: 6,
          },
          ['telecoms_communication_line', 'telecom_line', 'communication_line'],
        );
      }

      if (!oimTelecomOk.mast) {
        oimTelecomOk.mast = tryAddOim(
          {
            id: 'gis-oim-telecom-mast',
            type: 'circle',
            source: 'oim-power',
            layout: { visibility: enabled.oimTelecom ? 'visible' : 'none' },
            paint: {
              'circle-radius': 3.2,
              'circle-color': '#c678dd',
              'circle-opacity': 0.9,
              'circle-stroke-width': 0.9,
              'circle-stroke-color': 'rgba(0,0,0,0.5)',
            },
            minzoom: 8,
          },
          ['telecoms_mast', 'telecom_mast', 'telecoms_data_center', 'data_center'],
        );
      }
    }

    const emptySrc = (id) => {
      if (!map.getSource(id)) {
        map.addSource(id, { type: 'geojson', data: EMPTY });
      }
    };

    emptySrc('gis-tx');
    emptySrc('gis-subs');
    emptySrc('gis-plants');
    emptySrc('gis-wells-op');
    emptySrc('gis-wells-orphan');
    emptySrc('gis-wells-nm');
    emptySrc('gis-wells-co');
    emptySrc('gis-flood');
    emptySrc('gis-nhd');
    emptySrc('gis-nhd-wb');
    emptySrc('gis-fcc');
    emptySrc('gis-osm-dc');

    const beforeHg = map.getLayer('hypergrid-policy-diamond')
      ? 'hypergrid-policy-diamond'
      : undefined;
    const addL = (spec) => {
      if (map.getLayer(spec.id)) return;
      if (beforeHg) map.addLayer(spec, beforeHg);
      else map.addLayer(spec);
    };

    addL({
      id: 'gis-tx-line',
      type: 'line',
      source: 'gis-tx',
      layout: { visibility: enabled.transmission ? 'visible' : 'none' },
      paint: {
        'line-color': [
          'interpolate',
          ['linear'],
          ['max', 0, ['coalesce', ['to-number', ['get', 'VOLTAGE']], 0]],
          0, '#8a6a2f',
          69, '#c9a227',
          138, '#e6c07b',
          230, '#f0d78c',
          345, '#ffe08a',
          500, '#fff3bf',
        ],
        'line-width': [
          'interpolate',
          ['linear'],
          ['max', 0, ['coalesce', ['to-number', ['get', 'VOLTAGE']], 0]],
          0, 0.9,
          69, 1.2,
          138, 1.6,
          230, 2.1,
          345, 2.6,
          500, 3.2,
        ],
        'line-opacity': 0.88,
      },
    });

    addL({
      id: 'gis-subs-sq',
      type: 'circle',
      source: 'gis-subs',
      layout: { visibility: enabled.substations ? 'visible' : 'none' },
      paint: {
        'circle-radius': 4.2,
        'circle-color': '#f0c14a',
        'circle-opacity': 0.9,
        'circle-stroke-width': 1.2,
        'circle-stroke-color': 'rgba(0,0,0,0.65)',
      },
    });

    addL({
      id: 'gis-plants-pt',
      type: 'circle',
      source: 'gis-plants',
      layout: { visibility: enabled.plants ? 'visible' : 'none' },
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['coalesce', ['to-number', ['get', 'Total_MW']], 0],
          0, 4,
          50, 5,
          250, 6.5,
          800, 8,
          2000, 10,
        ],
        'circle-color': [
          'match',
          ['downcase', ['coalesce', ['get', 'PrimSource'], '']],
          'nuclear', '#c4b5fd',
          'coal', '#94a3b8',
          'natural gas', '#38bdf8',
          'gas', '#38bdf8',
          'hydroelectric', '#22d3ee',
          'hydro', '#22d3ee',
          'solar', '#fbbf24',
          'wind', '#34d399',
          'petroleum', '#fb7185',
          'geothermal', '#f472b6',
          'biomass', '#4ade80',
          '#86efac',
        ],
        'circle-opacity': 0.88,
        'circle-stroke-width': 1,
        'circle-stroke-color': 'rgba(0,0,0,0.55)',
      },
    });

    addL({
      id: 'gis-wells-op-pt',
      type: 'circle',
      source: 'gis-wells-op',
      layout: { visibility: enabled.wellsOp ? 'visible' : 'none' },
      paint: {
        'circle-radius': 2.8,
        'circle-color': '#22d3ee',
        'circle-opacity': 0.85,
        'circle-stroke-width': 0.8,
        'circle-stroke-color': 'rgba(0,0,0,0.5)',
      },
    });

    addL({
      id: 'gis-wells-orphan-pt',
      type: 'circle',
      source: 'gis-wells-orphan',
      layout: { visibility: enabled.wellsOrphan ? 'visible' : 'none' },
      paint: {
        'circle-radius': 2.8,
        'circle-color': '#fb7185',
        'circle-opacity': 0.85,
        'circle-stroke-width': 0.8,
        'circle-stroke-color': 'rgba(0,0,0,0.5)',
      },
    });

    addL({
      id: 'gis-nhd-line',
      type: 'line',
      source: 'gis-nhd',
      layout: { visibility: enabled.nhd ? 'visible' : 'none' },
      paint: {
        'line-color': '#4fc3f7',
        'line-width': 1.3,
        'line-opacity': 0.82,
      },
    });

    addL({
      id: 'gis-nhd-wb-fill',
      type: 'fill',
      source: 'gis-nhd-wb',
      layout: { visibility: enabled.nhdWaterbodies ? 'visible' : 'none' },
      paint: {
        'fill-color': '#4fc3f7',
        'fill-opacity': 0.22,
      },
      minzoom: 8,
    });

    addL({
      id: 'gis-nhd-wb-outline',
      type: 'line',
      source: 'gis-nhd-wb',
      layout: { visibility: enabled.nhdWaterbodies ? 'visible' : 'none' },
      paint: {
        'line-color': '#56b6c2',
        'line-width': 0.9,
        'line-opacity': 0.75,
      },
      minzoom: 8,
    });

    addL({
      id: 'gis-fcc-fill',
      type: 'fill',
      source: 'gis-fcc',
      layout: { visibility: enabled.fcc ? 'visible' : 'none' },
      paint: {
        'fill-color': [
          'case',
          ['>', ['coalesce', ['to-number', ['get', 'ServedBSLsFiber']], 0], 0],
          '#5eead4',
          ['>', ['coalesce', ['to-number', ['get', 'ServedBSLs']], 0], 0],
          '#2dd4bf',
          '#334155',
        ],
        'fill-opacity': 0.18,
        'fill-outline-color': 'rgba(94, 234, 212, 0.35)',
      },
    });

    addL({
      id: 'gis-osm-dc-pt',
      type: 'circle',
      source: 'gis-osm-dc',
      layout: { visibility: enabled.osmDc ? 'visible' : 'none' },
      paint: {
        'circle-radius': 5,
        'circle-color': '#e879f9',
        'circle-opacity': 0.9,
        'circle-stroke-width': 1.2,
        'circle-stroke-color': 'rgba(0,0,0,0.55)',
      },
    });
  }

  function bindPopups() {
    const specs = [
      {
        id: 'gis-tx-line',
        html: (p) =>
          popupGis(
            val(p, 'ID', 'OBJECTID') ? `TX ${val(p, 'ID', 'OBJECTID')}` : 'Transmission line',
            [
              popupRow('Voltage', esc(fmtKv(val(p, 'VOLTAGE')))),
              popupRow('Class', esc(val(p, 'VOLT_CLASS') || 'UNKNOWN')),
              popupRow('Owner', esc(val(p, 'OWNER') || 'UNKNOWN')),
              popupRow('Status', esc(val(p, 'STATUS') || 'UNKNOWN')),
              popupRow('Transformer MVA', 'UNKNOWN'),
            ],
            'HIFLD transmission · CATALOG',
          ),
      },
      {
        id: 'gis-subs-sq',
        html: (p) =>
          popupGis(val(p, 'NAME') || 'Substation', [
            popupRow('Type', esc(val(p, 'TYPE') || 'UNKNOWN')),
            popupRow('Max kV', esc(fmtKv(val(p, 'MAX_VOLT')))),
            popupRow('Min kV', esc(fmtKv(val(p, 'MIN_VOLT')))),
            popupRow('City', esc(val(p, 'CITY') || 'UNKNOWN')),
            popupRow('State', esc(val(p, 'STATE') || 'UNKNOWN')),
            popupRow('Transformer MVA', 'UNKNOWN'),
          ], 'HIFLD substations · CATALOG · no MVA field'),
      },
      {
        id: 'gis-plants-pt',
        html: (p) =>
          popupGis(val(p, 'Plant_Name') || 'Power plant', [
            popupRow('Nameplate', esc(fmtMwNameplate(val(p, 'Total_MW', 'Install_MW')))),
            popupRow('Fuel', esc(val(p, 'PrimSource') || 'UNKNOWN')),
            popupRow('Tech', esc(val(p, 'tech_desc', 'source_des') || 'UNKNOWN')),
            popupRow('Utility', esc(val(p, 'Utility_Na') || 'UNKNOWN')),
            popupRow('State', esc(val(p, 'State') || 'UNKNOWN')),
            popupRow('Period', esc(val(p, 'Period') || 'UNKNOWN')),
          ], 'EIA plants · nameplate catalog not interconnect'),
      },
      {
        id: 'gis-wells-op-pt',
        html: (p) =>
          popupGis('NETL operating well', [
            popupRow('Status', esc(val(p, 'status_category', 'wellstatus_forwebapp') || 'UNKNOWN')),
            popupRow('API', esc(val(p, 'api_number', 'API') || 'UNKNOWN')),
          ], 'NETL Integrated Public Wells · CATALOG'),
      },
      {
        id: 'gis-wells-orphan-pt',
        html: (p) =>
          popupGis('NETL orphaned well', [
            popupRow('API', esc(val(p, 'api', 'API', 'api_number') || 'UNKNOWN')),
            popupRow('State', esc(val(p, 'state', 'STATE') || 'UNKNOWN')),
          ], 'NETL Orphaned Wells v2 · CATALOG'),
      },
      {
        id: 'gis-nhd-line',
        html: (p) =>
          popupGis(val(p, 'gnis_name', 'GNIS_NAME') || 'NHD watercourse', [
            popupRow('FType', esc(val(p, 'ftype', 'FType', 'fcode') || 'UNKNOWN')),
          ], 'USGS NHD watercourses · CATALOG'),
      },
      {
        id: 'gis-nhd-wb-fill',
        html: (p) =>
          popupGis(val(p, 'gnis_name', 'GNIS_NAME') || 'NHD waterbody', [
            popupRow('FType', esc(val(p, 'ftype', 'FType', 'FTYPE') || 'UNKNOWN')),
            popupRow('Area km2', esc(val(p, 'areasqkm', 'AREASQKM') ?? 'UNKNOWN')),
          ], 'USGS NHD waterbodies · CATALOG'),
      },
      {
        id: 'gis-oim-water-line',
        html: (p) =>
          popupGis('OIM water pipeline', [
            popupRow('Name', esc(val(p, 'name', 'Name') || 'UNKNOWN')),
            popupRow('Operator', esc(val(p, 'operator', 'Operator') || 'UNKNOWN')),
            popupRow('Note', 'OSM-mapped only · not utility ownership'),
          ], 'OpenInfraMap water_pipeline · CATALOG'),
      },
      {
        id: 'gis-oim-telecom-line',
        html: (p) =>
          popupGis('OIM telecom line', [
            popupRow('Name', esc(val(p, 'name', 'Name') || 'UNKNOWN')),
            popupRow('Operator', esc(val(p, 'operator', 'Operator') || 'UNKNOWN')),
            popupRow('Note', 'OSM-mapped only · not as-built fiber'),
          ], 'OpenInfraMap telecom · OSM_MAPPED_COMMS'),
      },
      {
        id: 'gis-oim-telecom-mast',
        html: (p) =>
          popupGis(val(p, 'name', 'Name') || 'OIM telecom mast', [
            popupRow('Operator', esc(val(p, 'operator', 'Operator') || 'UNKNOWN')),
            popupRow('Note', 'OSM-mapped only · not as-built plant'),
          ], 'OpenInfraMap telecoms_mast · OSM_MAPPED_COMMS'),
      },
      {
        id: 'gis-wells-nm-pt',
        html: (p) =>
          popupGis('NM OCD well', [
            popupRow('API', esc(val(p, 'api', 'API', 'api_number', 'API_NUMBER') || 'UNKNOWN')),
            popupRow('Status', esc(val(p, 'status', 'STATUS', 'well_status') || 'UNKNOWN')),
            popupRow('Operator', esc(val(p, 'operator', 'OPERATOR', 'ogrid_name') || 'UNKNOWN')),
          ], 'NM OCD wells · CATALOG'),
      },
      {
        id: 'gis-wells-co-pt',
        html: (p) =>
          popupGis('CO OGCC well', [
            popupRow('API', esc(val(p, 'api', 'API', 'API_Label', 'api_label') || 'UNKNOWN')),
            popupRow('Facil_Stat', esc(val(p, 'Facil_Stat', 'facil_stat', 'status') || 'UNKNOWN')),
            popupRow('Operator', esc(val(p, 'Operator', 'operator', 'OPERATOR') || 'UNKNOWN')),
          ], 'CO OGCC wells · CATALOG'),
      },
      {
        id: 'gis-flood-fill',
        html: (p) =>
          popupGis('FEMA flood (NFHL)', [
            popupRow('Zone', esc(val(p, 'FLD_ZONE', 'fld_zone') || 'UNKNOWN')),
            popupRow('Subtype', esc(val(p, 'ZONE_SUBTY', 'zone_subty') || 'UNKNOWN')),
            popupRow('SFHA', esc(val(p, 'SFHA_TF', 'sfha_tf') || 'UNKNOWN')),
          ], 'FEMA NFHL · CATALOG'),
      },
      {
        id: 'gis-flood-outline',
        html: (p) =>
          popupGis('FEMA flood (NFHL)', [
            popupRow('Zone', esc(val(p, 'FLD_ZONE', 'fld_zone') || 'UNKNOWN')),
            popupRow('Subtype', esc(val(p, 'ZONE_SUBTY', 'zone_subty') || 'UNKNOWN')),
            popupRow('SFHA', esc(val(p, 'SFHA_TF', 'sfha_tf') || 'UNKNOWN')),
          ], 'FEMA NFHL · CATALOG'),
      },
      {
        id: 'gis-fcc-fill',
        html: (p) =>
          popupGis('FCC BDC availability', [
            popupRow('GEOID', esc(val(p, 'GEOID') || 'UNKNOWN')),
            popupRow('Served BSLs', esc(val(p, 'ServedBSLs') ?? 'UNKNOWN')),
            popupRow('Fiber-served BSLs', esc(val(p, 'ServedBSLsFiber') ?? 'UNKNOWN')),
            popupRow('Note', 'Availability only · not as-built fiber'),
          ], 'FCC BDC Dec 2024 View · CATALOG'),
      },
      {
        id: 'gis-osm-dc-pt',
        html: (p) =>
          popupGis(val(p, 'name') || 'OSM data center', [
            popupRow('Operator', esc(val(p, 'operator') || 'UNKNOWN')),
            popupRow('OSM id', esc(val(p, 'osmId') || 'UNKNOWN')),
            popupRow('Tags', esc([val(p, 'building'), val(p, 'telecom')].filter(Boolean).join(' · ') || 'OSM tags only')),
          ], 'OSM Overpass · CATALOG · partial crowd-sourced'),
      },
    ];

    for (const { id, html } of specs) {
      map.on('click', id, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties || {};
        const coords =
          f.geometry?.type === 'Point'
            ? f.geometry.coordinates.slice()
            : e.lngLat.toArray();
        popup.setLngLat(coords).setHTML(html(p)).addTo(map);
      });
      map.on('mouseenter', id, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', id, () => {
        map.getCanvas().style.cursor = '';
      });
    }
  }

  async function refresh() {
    if (!map.isStyleLoaded()) return;
    ensureSourcesAndLayers();

    const z = map.getZoom();
    const bb = mapBbox(map);

    // Abort prior in-flight ArcGIS/Overpass fetches
    if (abort) abort.abort();
    abort = new AbortController();
    const { signal } = abort;

    // Static layer visibility (topo / oim power / oim water / oim telecom)
    setVis(map, 'gis-topo', enabled.topo);
    setVis(map, 'gis-oim-line', enabled.oim && oimStatus === 'ok');
    setVis(map, 'gis-oim-sub', enabled.oim && oimStatus === 'ok');
    setVis(map, 'gis-oim-water-line', enabled.oimWater && !!oimWaterOk.line);
    setVis(map, 'gis-oim-water-pt', enabled.oimWater && !!oimWaterOk.point);
    setVis(map, 'gis-oim-telecom-line', enabled.oimTelecom && !!oimTelecomOk.line);
    setVis(map, 'gis-oim-telecom-mast', enabled.oimTelecom && !!oimTelecomOk.mast);

    if (enabled.oim) {
      if (oimStatus === 'ok') setStatus('oim', 'ok', oimDetail);
      else setStatus('oim', 'unknown', oimDetail || 'OIM: UNKNOWN (tile CORS)');
    } else {
      setStatus('oim', 'off', '');
    }
    if (enabled.topo) setStatus('topo', 'ok', 'USGS topo underlay');
    else setStatus('topo', 'off', '');

    if (enabled.oimWater) {
      const parts = [];
      if (oimWaterOk.line) parts.push(oimWaterOk.line);
      else parts.push('pipeline UNKNOWN');
      if (oimWaterOk.point) parts.push(oimWaterOk.point);
      else parts.push('towers/treatment UNKNOWN');
      const any = !!(oimWaterOk.line || oimWaterOk.point);
      setStatus('oimWater', any ? 'ok' : 'unknown', parts.join(' · '));
    } else {
      setStatus('oimWater', 'off', '');
    }

    if (enabled.oimTelecom) {
      const parts = [];
      if (oimTelecomOk.line) parts.push(oimTelecomOk.line);
      else parts.push('comms line UNKNOWN');
      if (oimTelecomOk.mast) parts.push(oimTelecomOk.mast);
      else parts.push('mast UNKNOWN');
      const any = !!(oimTelecomOk.line || oimTelecomOk.mast);
      setStatus(
        'oimTelecom',
        any ? 'ok' : 'unknown',
        `${parts.join(' · ')} · OSM mapped only`,
      );
    } else {
      setStatus('oimTelecom', 'off', '');
    }

    const tasks = [];

    const runArc = (key) => {
      const def = GIS_LAYERS[key];
      if (!enabled[key]) {
        for (const lid of def.layerIds) setVis(map, lid, false);
        const src = map.getSource(def.sourceId);
        if (src && src.setData) src.setData(EMPTY);
        setStatus(key, 'off', '');
        return;
      }
      for (const lid of def.layerIds) setVis(map, lid, true);
      if (z < def.minZoom) {
        setStatus(key, 'idle', `Zoom to ${def.minZoom}+`);
        return;
      }
      bumpFetch(1);
      setStatus(key, 'loading', 'loading…');
      const where = def.where || '1=1';
      const cap = key === 'fcc' ? 400 : GIS_RECORD_CAP;
      tasks.push(
        (async () => {
          try {
            let fc;
            if (key === 'fcc') {
              const pick = fccUrlForZoom(z);
              fc = await queryArcGisGeoJSON(pick.url, bb, {
                signal,
                recordCap: Math.min(400, GIS_RECORD_CAP),
              });
              setStatus(
                key,
                fc.features.length ? 'ok' : 'empty',
                `${fc.features.length} · ${pick.label}`,
              );
            } else {
              fc = await queryArcGisGeoJSON(def.url, bb, {
                where,
                signal,
                recordCap: cap,
              });
              setStatus(
                key,
                fc.features.length ? 'ok' : 'empty',
                `${fc.features.length} in view`,
              );
            }
            const src = map.getSource(def.sourceId);
            if (src && src.setData) src.setData(fc);
          } catch (err) {
            if (signal.aborted) return;
            const msg = err?.message || 'fetch failed';
            const cors =
              err instanceof TypeError || /Failed to fetch|NetworkError|CORS/i.test(msg);
            setStatus(
              key,
              cors ? 'cors' : 'error',
              cors ? `CORS / network · ${msg}` : msg,
            );
            const src = map.getSource(def.sourceId);
            if (src && src.setData) src.setData(EMPTY);
          } finally {
            bumpFetch(-1);
          }
        })(),
      );
    };

    for (const key of [
      'transmission',
      'substations',
      'plants',
      'wellsOp',
      'wellsOrphan',
      'wellsNm',
      'wellsCo',
      'flood',
      'nhd',
      'nhdWaterbodies',
      'fcc',
    ]) {
      runArc(key);
    }

    // Overpass OSM DCs
    {
      const key = 'osmDc';
      const def = GIS_LAYERS[key];
      if (!enabled[key]) {
        for (const lid of def.layerIds) setVis(map, lid, false);
        const src = map.getSource(def.sourceId);
        if (src && src.setData) src.setData(EMPTY);
        setStatus(key, 'off', '');
      } else {
        for (const lid of def.layerIds) setVis(map, lid, true);
        if (z < def.minZoom) {
          setStatus(key, 'idle', `Zoom to ${def.minZoom}+`);
        } else {
          bumpFetch(1);
          setStatus(key, 'loading', 'loading…');
          tasks.push(
            (async () => {
              try {
                const fc = await queryOverpassDCs(bb, signal);
                const src = map.getSource(def.sourceId);
                if (src && src.setData) src.setData(fc);
                setStatus(key, fc.features.length ? 'ok' : 'empty', `${fc.features.length} OSM tags`);
              } catch (err) {
                if (signal.aborted) return;
                const msg = err?.message || 'fetch failed';
                setStatus(key, 'error', msg);
              } finally {
                bumpFetch(-1);
              }
            })(),
          );
        }
      }
    }

    await Promise.allSettled(tasks);
  }

  function scheduleRefresh() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      refresh().catch((e) => console.warn('GIS refresh', e));
    }, GIS_DEBOUNCE_MS);
  }

  function setEnabled(id, on) {
    if (!(id in enabled)) return;
    enabled[id] = !!on;
    if (id === 'topo') setVis(map, 'gis-topo', enabled.topo);
    if (id === 'oim') {
      setVis(map, 'gis-oim-line', enabled.oim && oimStatus === 'ok');
      setVis(map, 'gis-oim-sub', enabled.oim && oimStatus === 'ok');
    }
    if (id === 'oimWater') {
      setVis(map, 'gis-oim-water-line', enabled.oimWater && !!oimWaterOk.line);
      setVis(map, 'gis-oim-water-pt', enabled.oimWater && !!oimWaterOk.point);
    }
    if (id === 'oimTelecom') {
      setVis(map, 'gis-oim-telecom-line', enabled.oimTelecom && !!oimTelecomOk.line);
      setVis(map, 'gis-oim-telecom-mast', enabled.oimTelecom && !!oimTelecomOk.mast);
    }
    scheduleRefresh();
  }

  function isEnabled(id) {
    return !!enabled[id];
  }

  // Probe OIM once (non-blocking)
  fetch(OIM_TILEJSON, { mode: 'cors', credentials: 'omit' })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((tj) => {
      if (tj?.tiles?.[0]) {
        oimStatus = 'ok';
        oimDetail = tj.name?.includes('DEPRECATED')
          ? 'tiles OK (tilejson DEPRECATED)'
          : 'tiles OK';
      } else {
        oimStatus = 'unknown';
        oimDetail = 'OIM: UNKNOWN (tile CORS)';
      }
      scheduleRefresh();
    })
    .catch(() => {
      // Tiles may still work even if tilejson blocked
      oimStatus = 'ok';
      oimDetail = 'assuming tiles (tilejson probe failed)';
      scheduleRefresh();
    });

  function collectInteractiveLayerIds(extra = []) {
    const ids = [];
    const push = (lid) => {
      if (lid && map.getLayer(lid) && !ids.includes(lid)) ids.push(lid);
    };
    for (const def of Object.values(GIS_LAYERS)) {
      for (const lid of def.layerIds || []) push(lid);
    }
    for (const lid of [
      'gis-oim-line',
      'gis-oim-sub',
      'gis-oim-water-line',
      'gis-oim-water-pt',
      'gis-oim-telecom-line',
      'gis-oim-telecom-mast',
    ]) {
      push(lid);
    }
    for (const lid of extra) push(lid);
    return ids;
  }

  function nearbyHitCounts(point, extraLayers = []) {
    const layers = collectInteractiveLayerIds(extraLayers);
    if (!layers.length) return [];
    const pad = 14;
    const box = [
      [point.x - pad, point.y - pad],
      [point.x + pad, point.y + pad],
    ];
    let feats = [];
    try {
      feats = map.queryRenderedFeatures(box, { layers });
    } catch (_) {
      feats = [];
    }
    const byLabel = new Map();
    const labelFor = (layerId) => {
      for (const def of Object.values(GIS_LAYERS)) {
        if ((def.layerIds || []).includes(layerId)) return def.label;
      }
      if (layerId.startsWith('gis-oim-water')) return 'OIM water';
      if (layerId.startsWith('gis-oim-telecom')) return 'OIM telecom';
      if (layerId.startsWith('gis-oim')) return 'OpenInfraMap power';
      if (layerId.startsWith('hypergrid-dcs')) return 'Hypergrid AI DCs';
      if (layerId.startsWith('hypergrid-commit')) return 'Hypergrid commitments';
      if (layerId.startsWith('hypergrid-policy')) return 'Hypergrid policy';
      return layerId;
    };
    for (const f of feats) {
      const lid = f.layer?.id;
      if (!lid) continue;
      const label = labelFor(lid);
      byLabel.set(label, (byLabel.get(label) || 0) + 1);
    }
    return [...byLabel.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  let pinMarker = null;
  let pinAbort = null;
  let pinBriefBound = false;

  function hidePinBrief() {
    const el = hooks.pinBriefEl || document.getElementById('pin-brief');
    if (el) {
      el.hidden = true;
      el.innerHTML = '';
    }
    if (pinMarker) {
      pinMarker.remove();
      pinMarker = null;
    }
  }

  /**
   * Nearest OIM telecom line distance from rendered or source features.
   * Samples line vertices (haversine); OSM_MAPPED_COMMS only.
   */
  function nearestOimTelecomLineKm(lng, lat) {
    const feats = [];
    const pushFeats = (arr) => {
      if (Array.isArray(arr)) feats.push(...arr);
    };

    if (map.getLayer('gis-oim-telecom-line')) {
      try {
        pushFeats(map.queryRenderedFeatures({ layers: ['gis-oim-telecom-line'] }));
      } catch (_) {
        /* ignore */
      }
    }

    const sourceLayer =
      typeof oimTelecomOk.line === 'string' ? oimTelecomOk.line : null;
    if (sourceLayer && map.getSource('oim-power')) {
      try {
        pushFeats(
          map.querySourceFeatures('oim-power', { sourceLayer }),
        );
      } catch (_) {
        /* ignore */
      }
    }

    if (!feats.length) {
      const layerMissing = !map.getLayer('gis-oim-telecom-line');
      const layerOff = !enabled.oimTelecom;
      if (layerMissing || layerOff || !sourceLayer) {
        return {
          km: null,
          status: 'unavailable',
          detail: 'OIM telecom: load layer or zoom in',
        };
      }
      return {
        km: null,
        status: 'empty',
        detail: 'No OIM telecom line in loaded tiles',
      };
    }

    let best = null;
    const samples = [];
    for (const f of feats) {
      collectCoordSamples(f.geometry, samples, 1);
    }
    // Cap samples for responsiveness
    const step = samples.length > 4000 ? Math.ceil(samples.length / 4000) : 1;
    for (let i = 0; i < samples.length; i += step) {
      const c = samples[i];
      if (!c || typeof c[0] !== 'number' || typeof c[1] !== 'number') continue;
      const km = haversineKm(lng, lat, c[0], c[1]);
      if (best == null || km < best) best = km;
    }
    if (best == null) {
      return {
        km: null,
        status: 'empty',
        detail: 'No OIM telecom line coordinates',
      };
    }
    return { km: best, status: 'ok', detail: formatDistKmMi(best) };
  }

  /**
   * FCC at pin: prefer already-loaded gis-fcc polygons, else one-shot ArcGIS point query.
   */
  async function resolveFccAtPin(lng, lat, signal) {
    // 1) Rendered / source polygons containing or near pin
    let localProps = null;
    if (map.getLayer('gis-fcc-fill')) {
      try {
        const pt = map.project([lng, lat]);
        const hit = map.queryRenderedFeatures(pt, { layers: ['gis-fcc-fill'] });
        if (hit?.length) localProps = hit[0].properties || null;
      } catch (_) {
        /* ignore */
      }
    }
    if (!localProps && map.getSource('gis-fcc')) {
      try {
        const srcFeats = map.querySourceFeatures('gis-fcc');
        // No point-in-polygon without turf: take first loaded feature only if
        // rendered hit already failed; prefer ArcGIS point query instead.
        void srcFeats;
      } catch (_) {
        /* ignore */
      }
    }

    if (localProps) {
      const rows = fccSummaryRows(localProps);
      let providers = [];
      try {
        providers = await queryFccProvidersByGeoid(localProps.GEOID, signal);
      } catch (_) {
        providers = [];
      }
      return {
        status: 'ok',
        grain: 'loaded layer',
        rows,
        providers,
        detail: null,
      };
    }

    // 2) One-shot point query (works even if FCC toggle is off)
    try {
      const hit = await queryFccAtPoint(lng, lat, signal);
      if (!hit) {
        return {
          status: 'empty',
          grain: null,
          rows: [],
          providers: [],
          detail: 'FCC: no polygon at pin',
        };
      }
      const rows = fccSummaryRows(hit.props);
      let providers = [];
      try {
        providers = await queryFccProvidersByGeoid(hit.geoid, signal);
      } catch (_) {
        providers = [];
      }
      return {
        status: 'ok',
        grain: hit.grain,
        rows,
        providers,
        detail: null,
      };
    } catch (err) {
      if (signal?.aborted) throw err;
      const msg = err?.message || 'FCC query failed';
      return {
        status: 'unavailable',
        grain: null,
        rows: [],
        providers: [],
        detail: /Failed to fetch|NetworkError|CORS|HTTP/i.test(msg)
          ? 'FCC: load layer or zoom in'
          : `FCC: UNKNOWN · ${msg}`,
      };
    }
  }

  function renderFiberBroadbandSection(fiber) {
    if (!fiber) {
      return `
        <div class="pin-brief-subhead">Fiber · broadband</div>
        <div class="pin-brief-row"><span>OIM telecom</span><strong>loading…</strong></div>
        <div class="pin-brief-row"><span>FCC BDC</span><strong>loading…</strong></div>
        <p class="pin-brief-honesty">As-built fiber / conduit UNKNOWN. FCC = availability. OIM = OSM_MAPPED_COMMS only.</p>`;
    }
    const oim = fiber.oim || {};
    const fcc = fiber.fcc; // null = still loading one-shot query
    const oimVal =
      oim.status === 'ok'
        ? oim.detail
        : oim.detail || 'UNKNOWN';
    let fccBlock = '';
    if (fcc == null) {
      fccBlock = `<div class="pin-brief-row"><span>FCC BDC</span><strong>loading…</strong></div>`;
    } else if (fcc.status === 'ok' && (fcc.rows?.length || fcc.providers?.length)) {
      const grain = fcc.grain ? ` · ${esc(fcc.grain)}` : '';
      fccBlock += `<div class="pin-brief-row"><span>FCC BDC${grain}</span><strong>at pin</strong></div>`;
      for (const r of (fcc.rows || []).slice(0, 10)) {
        fccBlock += `<div class="pin-brief-row"><span>${esc(r.label)}</span><strong>${esc(r.value)}</strong></div>`;
      }
      const prov = (fcc.providers || []).slice(0, 8);
      if (prov.length) {
        fccBlock += `<div class="pin-brief-subhead" style="margin-top:0.35rem">FCC providers (BDC)</div>`;
        for (const p of prov) {
          const bits = [p.name];
          if (p.tech) bits.push(p.tech);
          if (p.served != null) bits.push(`served ${p.served}`);
          if (p.bizRes) bits.push(String(p.bizRes));
          fccBlock += `<div class="pin-brief-hit"><span>${esc(p.name)}</span><strong>${esc([p.tech, p.served != null ? `BSL ${p.served}` : null, p.bizRes].filter(Boolean).join(' · ') || 'listed')}</strong></div>`;
        }
      }
    } else if (fcc.status === 'ok') {
      fccBlock = `<div class="pin-brief-row"><span>FCC BDC</span><strong>at pin · no summary fields</strong></div>`;
    } else {
      fccBlock = `<div class="pin-brief-row"><span>FCC BDC</span><strong>${esc(fcc.detail || 'FCC: load layer or zoom in')}</strong></div>`;
    }

    return `
      <div class="pin-brief-subhead">Fiber · broadband</div>
      <div class="pin-brief-row"><span>Nearest OIM telecom line</span><strong>${esc(oimVal)}</strong></div>
      ${fccBlock}
      <p class="pin-brief-honesty">As-built fiber / conduit UNKNOWN. FCC = availability. OIM = OSM_MAPPED_COMMS only.</p>`;
  }

  function renderPinBrief(el, { lng, lat, elevFt, hits, loading, error, fiber }) {
    const elevTxt =
      loading
        ? 'loading…'
        : elevFt == null
          ? 'UNKNOWN'
          : `${Math.round(elevFt).toLocaleString()} ft`;
    const hitRows =
      hits && hits.length
        ? hits
            .slice(0, 8)
            .map(
              (h) =>
                `<div class="pin-brief-hit"><span>${esc(h.label)}</span><strong>${h.count}</strong></div>`,
            )
            .join('')
        : '<p class="pin-brief-note">No enabled layer hits in pin neighborhood.</p>';
    el.innerHTML = `
      <div class="pin-brief-chrome">
        <div class="pin-brief-title-row">
          <h3>Pinned · CATALOG</h3>
          <button type="button" class="pin-brief-close" aria-label="Close pin brief">×</button>
        </div>
      </div>
      <div class="pin-brief-body">
        <div class="pin-brief-row"><span>Coordinates</span><strong>${lat.toFixed(5)}, ${lng.toFixed(5)}</strong></div>
        <div class="pin-brief-row"><span>Elevation</span><strong>${esc(elevTxt)}</strong></div>
        <p class="pin-brief-note">EPQS point elevation only · USGS National Map</p>
        ${error ? `<p class="pin-brief-error">${esc(error)}</p>` : ''}
        ${renderFiberBroadbandSection(fiber)}
        <div class="pin-brief-subhead">Nearby enabled hits</div>
        ${hitRows}
        <p class="pin-brief-note">Hit counts from visible rendered features near pin. Not a full inventory.</p>
      </div>`;
    el.hidden = false;
    el.querySelector('.pin-brief-close')?.addEventListener('click', () => hidePinBrief());
  }

  function bindPinBrief() {
    if (pinBriefBound) return;
    pinBriefBound = true;
    const extra = () => hooks.extraInteractiveLayers?.() || hooks.extraInteractiveLayers || [];

    map.on('click', async (e) => {
      const layerIds = collectInteractiveLayerIds(extra());
      let hitsAtPoint = [];
      try {
        hitsAtPoint = layerIds.length
          ? map.queryRenderedFeatures(e.point, { layers: layerIds })
          : [];
      } catch (_) {
        hitsAtPoint = [];
      }
      if (hitsAtPoint.length) return;

      const el = hooks.pinBriefEl || document.getElementById('pin-brief');
      if (!el) return;

      const { lng, lat } = e.lngLat;
      if (pinAbort) pinAbort.abort();
      pinAbort = new AbortController();
      const signal = pinAbort.signal;

      if (pinMarker) {
        pinMarker.remove();
        pinMarker = null;
      }
      const MarkerCtor = hooks.Marker;
      if (MarkerCtor) {
        try {
          pinMarker = new MarkerCtor({ color: '#4da3ff' })
            .setLngLat([lng, lat])
            .addTo(map);
        } catch (_) {
          pinMarker = null;
        }
      }

      try { popup.remove(); } catch (_) { /* ignore */ }

      const hits = nearbyHitCounts(e.point, extra());
      const oimNear = nearestOimTelecomLineKm(lng, lat);
      renderPinBrief(el, {
        lng,
        lat,
        elevFt: null,
        hits,
        loading: true,
        fiber: { oim: oimNear, fcc: null },
      });

      try {
        const [elev, fcc] = await Promise.all([
          fetchEpqsElevation(lng, lat, signal),
          resolveFccAtPin(lng, lat, signal),
        ]);
        if (signal.aborted) return;
        renderPinBrief(el, {
          lng,
          lat,
          elevFt: elev,
          hits,
          loading: false,
          fiber: { oim: oimNear, fcc },
        });
      } catch (err) {
        if (signal.aborted) return;
        renderPinBrief(el, {
          lng,
          lat,
          elevFt: null,
          hits,
          loading: false,
          error: err?.message || 'EPQS failed',
          fiber: {
            oim: oimNear,
            fcc: { status: 'unavailable', detail: 'FCC: UNKNOWN', rows: [], providers: [] },
          },
        });
      }
    });
  }

  ensureSourcesAndLayers();
  bindPopups();
  bindPinBrief();
  map.on('moveend', scheduleRefresh);
  scheduleRefresh();

  return {
    setEnabled,
    isEnabled,
    refresh: scheduleRefresh,
    getOimStatus: () => ({ status: oimStatus, detail: oimDetail }),
    hidePinBrief,
  };
}

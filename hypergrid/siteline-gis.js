/**
 * Siteline Hypergrid · GIS · grid layers (public CATALOG endpoints).
 * NLT143 RESEARCH by David T Phung
 *
 * Honesty: plant MW = nameplate catalog not interconnect;
 * HIFLD has no transformer MVA; FCC = availability not as-built fiber.
 * Never invent MW/MVA/headroom.
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
    label: 'NHD flowlines',
    kind: 'arcgis',
    url: 'https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/6/query',
    geom: 'line',
    sourceId: 'gis-nhd',
    layerIds: ['gis-nhd-line'],
    defaultOn: false,
    minZoom: 8,
    truth: 'CATALOG',
    sourceNote: 'USGS NHD flowlines',
  },
  fcc: {
    id: 'fcc',
    label: 'FCC BDC availability',
    kind: 'fcc',
    geom: 'polygon',
    sourceId: 'gis-fcc',
    layerIds: ['gis-fcc-fill'],
    defaultOn: false,
    minZoom: 9,
    truth: 'CATALOG',
    sourceNote: 'FCC BDC Dec 2024 View (availability, not as-built fiber)',
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
    emptySrc('gis-nhd');
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
        'line-color': '#38bdf8',
        'line-width': 1.2,
        'line-opacity': 0.8,
      },
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
          '#22d3ee',
          ['>', ['coalesce', ['to-number', ['get', 'ServedBSLs']], 0], 0],
          '#64748b',
          '#334155',
        ],
        'fill-opacity': 0.28,
        'fill-outline-color': '#94a3b8',
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
          popupGis(val(p, 'gnis_name', 'GNIS_NAME') || 'NHD flowline', [
            popupRow('FType', esc(val(p, 'ftype', 'FType', 'fcode') || 'UNKNOWN')),
          ], 'USGS NHD · CATALOG'),
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

    // Static layer visibility (topo / oim)
    setVis(map, 'gis-topo', enabled.topo);
    setVis(map, 'gis-oim-line', enabled.oim && oimStatus === 'ok');
    setVis(map, 'gis-oim-sub', enabled.oim && oimStatus === 'ok');
    if (enabled.oim) {
      if (oimStatus === 'ok') setStatus('oim', 'ok', oimDetail);
      else setStatus('oim', 'unknown', oimDetail || 'OIM: UNKNOWN (tile CORS)');
    } else {
      setStatus('oim', 'off', '');
    }
    if (enabled.topo) setStatus('topo', 'ok', 'USGS topo underlay');
    else setStatus('topo', 'off', '');

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
      'nhd',
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

  ensureSourcesAndLayers();
  bindPopups();
  map.on('moveend', scheduleRefresh);
  scheduleRefresh();

  return {
    setEnabled,
    isEnabled,
    refresh: scheduleRefresh,
    getOimStatus: () => ({ status: oimStatus, detail: oimDetail }),
  };
}

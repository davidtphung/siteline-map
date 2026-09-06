/**
 * Siteline Hypergrid overlay (static ES module, no build step).
 * NLT143 RESEARCH by David T Phung
 */
import maplibregl from 'https://esm.sh/maplibre-gl@4.7.1';

const DC_URL = './data/hypergrid-datacenters.geojson';
const COMMIT_URL = './data/hypergrid-commitments.geojson';
const POLICY_URL = './data/hypergrid-policy.geojson';
const AI_ORIENTED_URL = './data/hypergrid-ai-oriented.geojson';

const CARTO_VECTOR = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const CARTO_RASTER_STYLE = {
  version: 8,
  name: 'Carto Dark Matter Raster Fallback',
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
  },
  layers: [
    {
      id: 'carto-dark-layer',
      type: 'raster',
      source: 'carto-dark',
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

const STATUS_COLOR = [
  'match',
  ['downcase', ['coalesce', ['get', 'status'], '']],
  'operating', '#3dd68c',
  'operational', '#3dd68c',
  'construction', '#4da3ff',
  'announced', '#e6c07b',
  'paused', '#8b949e',
  '#8b949e',
];

const TECH_COLOR = [
  'match',
  ['downcase', ['coalesce', ['get', 'techType'], '']],
  'gas', '#f07178',
  'smr', '#61afef',
  'nuclear-existing', '#61afef',
  'nuclear-restart', '#61afef',
  'solar', '#e5c07b',
  'wind', '#56b6c2',
  'geothermal', '#d19a66',
  'fusion', '#c678dd',
  'datacenter', '#4da3ff',
  'mixed-renewable', '#98c379',
  'fuel-cell', '#abb2bf',
  '#8b949e',
];

const POLICY_COLOR = [
  'match',
  ['downcase', ['coalesce', ['get', 'stance'], '']],
  'for', '#3dd68c',
  'against', '#f07178',
  'mixed', '#c678dd',
  '#c678dd',
];

/** Radius from capacityMW (clamp). Null / missing => fixed. */
const DC_RADIUS = [
  'interpolate',
  ['linear'],
  ['coalesce', ['get', 'capacityMW'], 0],
  0, 4.5,
  10, 5.5,
  50, 7,
  100, 8.5,
  250, 10,
  500, 12,
  1000, 14,
  2500, 16,
  5000, 18,
];

let map;
let dcGeo = null;
let commitGeo = null;
let policyGeo = null;
let dcFilter = 'all'; // all | ai | us
let popup;
let openSheetId = null; // 'layers' | 'live' | null

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtMW(v) {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return 'UNKNOWN';
  const n = Number(v);
  if (n >= 1000) return `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} MW`;
  if (n >= 10) return `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} MW`;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 3 })} MW`;
}

function capacityParts(v) {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) {
    return { num: 'UNKNOWN', unit: '' };
  }
  const n = Number(v);
  const digits = n >= 10 ? 1 : 3;
  return {
    num: n.toLocaleString(undefined, { maximumFractionDigits: digits }),
    unit: 'MW',
  };
}

function badgeClass(raw) {
  const s = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');
  if (!s) return 'badge-other';
  return `badge-${s}`;
}

function sumCapacity(features) {
  let sum = 0;
  let counted = 0;
  for (const f of features) {
    const v = f.properties?.capacityMW;
    if (v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v))) {
      sum += Number(v);
      counted += 1;
    }
  }
  return { sum, counted };
}

function filterDCs(collection, mode) {
  if (!collection) return { type: 'FeatureCollection', features: [] };
  const feats = collection.features.filter((f) => {
    const p = f.properties || {};
    if (mode === 'ai') return p.aiOriented === true;
    if (mode === 'us') {
      const c = String(p.country || '').toLowerCase();
      return c === 'united states' || c === 'usa' || c === 'us';
    }
    return true;
  });
  return { type: 'FeatureCollection', features: feats };
}

function updateStats() {
  const dcEl = document.getElementById('stat-dcs');
  const cmEl = document.getElementById('stat-commitments');
  const mwEl = document.getElementById('stat-mw');
  const dcMwEl = document.getElementById('stat-dc-mw');

  const dcsOn = document.getElementById('layer-dcs')?.checked;
  const cmOn = document.getElementById('layer-commitments')?.checked;

  const visibleDCs = dcsOn ? filterDCs(dcGeo, dcFilter).features : [];
  const visibleCm = cmOn && commitGeo ? commitGeo.features : [];

  const dcCount = visibleDCs.length;
  const cmCount = visibleCm.length;
  const { sum: dcSum } = sumCapacity(visibleDCs);
  const { sum: cmSum } = sumCapacity(visibleCm);
  // Commitments MW matches Hypergrid headline (~121.1 GW). Do NOT add DC registry MW
  // (that would double-count facilities that also appear as commitments).

  if (dcEl) dcEl.textContent = dcsOn ? String(dcCount) : 'off';
  if (cmEl) cmEl.textContent = cmOn ? String(cmCount) : 'off';
  if (mwEl) {
    mwEl.textContent =
      !cmOn
        ? 'off'
        : cmSum > 0
          ? cmSum.toLocaleString(undefined, { maximumFractionDigits: 0 })
          : 'UNKNOWN';
  }
  if (dcMwEl) {
    dcMwEl.textContent =
      !dcsOn
        ? 'off'
        : dcSum > 0
          ? dcSum.toLocaleString(undefined, { maximumFractionDigits: 0 })
          : 'UNKNOWN';
  }
}

function applyDcFilter() {
  if (!map || !map.getSource('hypergrid-dcs') || !dcGeo) return;
  const filtered = filterDCs(dcGeo, dcFilter);
  map.getSource('hypergrid-dcs').setData(filtered);
  updateStats();
}

function setLayerVisibility(id, visible) {
  if (!map || !map.getLayer(id)) return;
  map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
}

function capacityHtml(v) {
  const { num, unit } = capacityParts(v);
  if (!unit) return `<div class="popup-capacity">${esc(num)}</div>`;
  return `<div class="popup-capacity">${esc(num)}<span class="cap-unit">${esc(unit)}</span></div>`;
}

function popupHtmlDC(p) {
  const name = p.facility || p.id || 'Facility';
  const op = p.operator || p.parentCompany || 'UNKNOWN';
  const loc = [p.city, p.region || p.state, p.country].filter(Boolean).join(', ') || 'UNKNOWN';
  const year = p.yearOperational ?? 'UNKNOWN';
  const status = p.status || 'UNKNOWN';
  const src = p.sourceName
    ? p.sourceUrl
      ? `<a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(p.sourceName)}</a>`
      : esc(p.sourceName)
    : 'UNKNOWN';
  return `
    <div class="popup-card">
      <div class="popup-head">
        <h3>${esc(name)}</h3>
        <span class="popup-badge ${esc(badgeClass(status))}">${esc(status)}</span>
      </div>
      ${capacityHtml(p.capacityMW)}
      <div class="popup-meta">
        <div class="popup-row"><span class="k">Operator</span><span class="v">${esc(op)}</span></div>
        <div class="popup-row"><span class="k">Year</span><span class="v">${esc(year)}</span></div>
        <div class="popup-row"><span class="k">Location</span><span class="v">${esc(loc)}</span></div>
        <div class="popup-row"><span class="k">AI-oriented</span><span class="v">${p.aiOriented === true ? 'yes' : p.aiOriented === false ? 'no' : 'UNKNOWN'}</span></div>
        <div class="popup-row"><span class="k">Source</span><span class="v">${src}</span></div>
      </div>
      <p class="truth">Hypergrid curated · not live telemetry</p>
    </div>`;
}

function popupHtmlCommit(p) {
  const name = p.project || p.headline || p.id || 'Project';
  const buyer = p.buyer || p.counterparty || 'UNKNOWN';
  const loc = [p.city, p.state, p.country].filter(Boolean).join(', ') || 'UNKNOWN';
  const status = p.status || 'UNKNOWN';
  const src = p.sourceName
    ? p.sourceUrl
      ? `<a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(p.sourceName)}</a>`
      : esc(p.sourceName)
    : 'UNKNOWN';
  return `
    <div class="popup-card">
      <div class="popup-head">
        <h3>${esc(name)}</h3>
        <span class="popup-badge ${esc(badgeClass(status))}">${esc(status)}</span>
      </div>
      ${capacityHtml(p.capacityMW)}
      <div class="popup-meta">
        <div class="popup-row"><span class="k">Buyer</span><span class="v">${esc(buyer)}</span></div>
        <div class="popup-row"><span class="k">Tech</span><span class="v">${esc(p.techType || 'UNKNOWN')}</span></div>
        <div class="popup-row"><span class="k">Date</span><span class="v">${esc(p.date || 'UNKNOWN')}</span></div>
        <div class="popup-row"><span class="k">Location</span><span class="v">${esc(loc)}</span></div>
        <div class="popup-row"><span class="k">Source</span><span class="v">${src}</span></div>
      </div>
      <p class="truth">Hypergrid curated · not live telemetry</p>
    </div>`;
}

function popupHtmlPolicy(p) {
  const name = p.title || p.id || 'Policy';
  const loc = [p.jurisdiction, p.country].filter(Boolean).join(', ') || 'UNKNOWN';
  const stance = p.stance || 'UNKNOWN';
  const src = p.sourceName
    ? p.sourceUrl
      ? `<a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(p.sourceName)}</a>`
      : esc(p.sourceName)
    : 'UNKNOWN';
  return `
    <div class="popup-card">
      <div class="popup-head">
        <h3>${esc(name)}</h3>
        <span class="popup-badge ${esc(badgeClass(stance))}">${esc(stance)}</span>
      </div>
      <div class="popup-meta">
        <div class="popup-row"><span class="k">Level</span><span class="v">${esc(p.level || 'UNKNOWN')}</span></div>
        <div class="popup-row"><span class="k">Category</span><span class="v">${esc(p.category || 'UNKNOWN')}</span></div>
        <div class="popup-row"><span class="k">Date</span><span class="v">${esc(p.date || 'UNKNOWN')}</span></div>
        <div class="popup-row"><span class="k">Location</span><span class="v">${esc(loc)}</span></div>
        <div class="popup-row"><span class="k">Summary</span><span class="v">${esc(p.summary || 'UNKNOWN')}</span></div>
        <div class="popup-row"><span class="k">Source</span><span class="v">${src}</span></div>
      </div>
      <p class="truth">Hypergrid curated · not live telemetry</p>
    </div>`;
}

function bindPopups() {
  const layers = [
    { id: 'hypergrid-dcs-circle', kind: 'dc' },
    { id: 'hypergrid-commit-square', kind: 'commit' },
    { id: 'hypergrid-policy-diamond', kind: 'policy' },
  ];

  for (const { id, kind } of layers) {
    map.on('click', id, (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties || {};
      const coords = f.geometry?.type === 'Point' ? f.geometry.coordinates.slice() : e.lngLat.toArray();
      let html = '';
      if (kind === 'dc') html = popupHtmlDC(p);
      else if (kind === 'commit') html = popupHtmlCommit(p);
      else html = popupHtmlPolicy(p);
      popup.setLngLat(coords).setHTML(html).addTo(map);
    });
    map.on('mouseenter', id, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', id, () => {
      map.getCanvas().style.cursor = '';
    });
  }
}

function addHypergridLayers() {
  map.addSource('hypergrid-dcs', {
    type: 'geojson',
    data: filterDCs(dcGeo, dcFilter),
  });
  map.addSource('hypergrid-commitments', {
    type: 'geojson',
    data: commitGeo || { type: 'FeatureCollection', features: [] },
  });
  map.addSource('hypergrid-policy', {
    type: 'geojson',
    data: policyGeo || { type: 'FeatureCollection', features: [] },
  });

  map.addLayer({
    id: 'hypergrid-policy-diamond',
    type: 'circle',
    source: 'hypergrid-policy',
    layout: { visibility: 'none' },
    paint: {
      'circle-radius': 7,
      'circle-color': POLICY_COLOR,
      'circle-opacity': 0.85,
      'circle-stroke-width': 1.2,
      'circle-stroke-color': 'rgba(255,255,255,0.55)',
    },
  });

  map.addLayer({
    id: 'hypergrid-commit-halo',
    type: 'circle',
    source: 'hypergrid-commitments',
    paint: {
      'circle-radius': 9,
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-width': 2,
      'circle-stroke-color': TECH_COLOR,
      'circle-opacity': 0.95,
    },
  });

  map.addLayer({
    id: 'hypergrid-commit-square',
    type: 'circle',
    source: 'hypergrid-commitments',
    paint: {
      'circle-radius': 4.5,
      'circle-color': TECH_COLOR,
      'circle-opacity': 0.95,
      'circle-stroke-width': 1,
      'circle-stroke-color': 'rgba(0,0,0,0.55)',
    },
  });

  map.addLayer({
    id: 'hypergrid-dcs-circle',
    type: 'circle',
    source: 'hypergrid-dcs',
    paint: {
      'circle-radius': DC_RADIUS,
      'circle-color': STATUS_COLOR,
      'circle-opacity': 0.88,
      'circle-stroke-width': 1,
      'circle-stroke-color': 'rgba(255,255,255,0.35)',
    },
  });

  bindPopups();
  updateStats();
}

async function loadGeoJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res.json();
}

function createMap(style) {
  return new maplibregl.Map({
    container: 'map',
    style,
    center: [-98, 39],
    zoom: 3.5,
    attributionControl: true,
  });
}

function isMobileUi() {
  return window.matchMedia('(max-width: 819px)').matches;
}

function setSheetButtons(active) {
  const layersBtn = document.getElementById('btn-layers');
  const liveBtn = document.getElementById('btn-live');
  if (layersBtn) layersBtn.setAttribute('aria-expanded', active === 'layers' ? 'true' : 'false');
  if (liveBtn) liveBtn.setAttribute('aria-expanded', active === 'live' ? 'true' : 'false');
}

function closeSheets() {
  openSheetId = null;
  document.getElementById('layers-panel')?.classList.remove('is-open');
  document.getElementById('live-panel')?.classList.remove('is-open');
  const backdrop = document.getElementById('sheet-backdrop');
  if (backdrop) {
    backdrop.classList.remove('is-visible');
    backdrop.hidden = true;
  }
  setSheetButtons(null);
}

function openSheet(which) {
  if (!isMobileUi()) return;
  if (openSheetId === which) {
    closeSheets();
    return;
  }
  closeSheets();
  openSheetId = which;
  const panelId = which === 'layers' ? 'layers-panel' : 'live-panel';
  document.getElementById(panelId)?.classList.add('is-open');
  const backdrop = document.getElementById('sheet-backdrop');
  if (backdrop) {
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add('is-visible'));
  }
  setSheetButtons(which);
}

function wireSheets() {
  document.getElementById('btn-layers')?.addEventListener('click', () => openSheet('layers'));
  document.getElementById('btn-live')?.addEventListener('click', () => openSheet('live'));
  document.getElementById('sheet-backdrop')?.addEventListener('click', () => closeSheets());
  document.querySelectorAll('[data-close-sheet]').forEach((btn) => {
    btn.addEventListener('click', () => closeSheets());
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheets();
  });

  const mq = window.matchMedia('(max-width: 819px)');
  const onBreak = () => {
    if (!mq.matches) closeSheets();
  };
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onBreak);
  else if (typeof mq.addListener === 'function') mq.addListener(onBreak);
}

function wireUi() {
  wireSheets();

  document.getElementById('layer-dcs')?.addEventListener('change', (e) => {
    setLayerVisibility('hypergrid-dcs-circle', e.target.checked);
    updateStats();
  });
  document.getElementById('layer-commitments')?.addEventListener('change', (e) => {
    const on = e.target.checked;
    setLayerVisibility('hypergrid-commit-square', on);
    setLayerVisibility('hypergrid-commit-halo', on);
    updateStats();
  });
  document.getElementById('layer-policy')?.addEventListener('change', (e) => {
    setLayerVisibility('hypergrid-policy-diamond', e.target.checked);
  });

  document.querySelectorAll('[data-dc-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-dc-filter]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      dcFilter = btn.getAttribute('data-dc-filter') || 'all';
      applyDcFilter();
    });
  });

  document.getElementById('refresh-live')?.addEventListener('click', () => {
    refreshLiveFeeds();
  });
}

function formatLocalStamp(d = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

async function fetchUkCarbon() {
  const intensityUrl = 'https://api.carbonintensity.org.uk/intensity';
  const genUrl = 'https://api.carbonintensity.org.uk/generation';

  const [intensityRes, genRes] = await Promise.all([
    fetch(intensityUrl),
    fetch(genUrl),
  ]);

  if (!intensityRes.ok) throw new Error(`intensity HTTP ${intensityRes.status}`);
  if (!genRes.ok) throw new Error(`generation HTTP ${genRes.status}`);

  const intensityJson = await intensityRes.json();
  const genJson = await genRes.json();

  const row = intensityJson?.data?.[0];
  const intensity = row?.intensity;
  const mix = genJson?.data?.generationmix || [];

  if (!intensity) throw new Error('intensity payload missing data');

  const top = [...mix]
    .filter((x) => typeof x.perc === 'number')
    .sort((a, b) => b.perc - a.perc)
    .slice(0, 5);

  return {
    actual: intensity.actual ?? null,
    forecast: intensity.forecast ?? null,
    index: intensity.index ?? 'UNKNOWN',
    from: row.from,
    to: row.to,
    top,
    intensityUrl,
    genUrl,
  };
}

async function fetchUsOpenFeed() {
  // USGS earthquakes: CORS-friendly public JSON probe.
  // EIA open data typically needs a key; document that if this path also fails.
  const url =
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const n = json?.metadata?.count ?? json?.features?.length;
    if (n === undefined || n === null) throw new Error('missing count');
    return {
      ok: true,
      label: 'USGS M2.5+ quakes (24h)',
      value: String(n),
      note: 'Reference public feed (not DC load). US ISO live: UNKNOWN (CORS or key).',
      url,
    };
  } catch (err) {
    return {
      ok: false,
      label: 'US ISO live',
      value: 'UNKNOWN',
      note: `CORS or key (${err?.message || 'fetch failed'}). EIA needs a key. USGS attempt also failed.`,
      url: null,
    };
  }
}

function renderLive(uk, us, errUk) {
  const el = document.getElementById('live-content');
  const meta = document.getElementById('live-meta');
  if (!el) return;

  let ukHtml;
  if (errUk || !uk) {
    ukHtml = `
      <div class="live-block">
        <p class="live-title">UK Carbon Intensity</p>
        <div class="live-value error">UNKNOWN</div>
        <p class="live-sub">${esc(errUk?.message || 'fetch failed')}</p>
        <p class="live-sub"><a href="https://api.carbonintensity.org.uk/intensity" target="_blank" rel="noopener noreferrer">api.carbonintensity.org.uk</a></p>
      </div>`;
  } else {
    const actual =
      uk.actual === null || uk.actual === undefined ? 'UNKNOWN' : `${uk.actual} gCO2/kWh`;
    const forecast =
      uk.forecast === null || uk.forecast === undefined ? 'UNKNOWN' : `${uk.forecast} gCO2/kWh`;
    const fuels = uk.top
      .map(
        (f) =>
          `<li><span>${esc(f.fuel)}</span><span>${esc(Number(f.perc).toFixed(1))}%</span></li>`,
      )
      .join('');
    ukHtml = `
      <div class="live-block">
        <p class="live-title">UK Carbon Intensity</p>
        <div class="live-value${uk.actual == null ? ' unknown' : ''}">${esc(actual)}</div>
        <p class="live-sub">Forecast ${esc(forecast)} · index ${esc(uk.index)}</p>
        <p class="live-sub">Window ${esc(uk.from || '?')} → ${esc(uk.to || '?')}</p>
        <ul class="fuel-list">${fuels}</ul>
        <p class="live-sub"><a href="${esc(uk.intensityUrl)}" target="_blank" rel="noopener noreferrer">intensity</a> · <a href="${esc(uk.genUrl)}" target="_blank" rel="noopener noreferrer">generation</a></p>
      </div>`;
  }

  const usClass = us.ok ? '' : ' unknown';
  const usLink = us.url
    ? `<p class="live-sub"><a href="${esc(us.url)}" target="_blank" rel="noopener noreferrer">source</a></p>`
    : '';
  const usHtml = `
    <div class="live-block">
      <p class="live-title">${esc(us.label)}</p>
      <div class="live-value${usClass}">${esc(us.value)}</div>
      <p class="live-sub">${esc(us.note)}</p>
      ${usLink}
    </div>`;

  el.innerHTML = ukHtml + usHtml;
  if (meta) {
    meta.textContent = `Updated ${formatLocalStamp()} · auto-refresh every 5 min (UK carbon only)`;
  }
}

async function refreshLiveFeeds() {
  const el = document.getElementById('live-content');
  if (el) el.innerHTML = '<p class="muted">Refreshing open feeds…</p>';

  let uk = null;
  let errUk = null;
  try {
    uk = await fetchUkCarbon();
  } catch (err) {
    errUk = err;
  }
  const us = await fetchUsOpenFeed();
  renderLive(uk, us, errUk);
}

async function init() {
  wireUi();
  popup = new maplibregl.Popup({
    closeButton: true,
    closeOnClick: true,
    maxWidth: 'min(92vw, 320px)',
    offset: 12,
  });

  const loadPromise = Promise.all([
    loadGeoJSON(DC_URL).catch((e) => {
      console.error(e);
      return null;
    }),
    loadGeoJSON(COMMIT_URL).catch((e) => {
      console.error(e);
      return null;
    }),
    loadGeoJSON(POLICY_URL).catch((e) => {
      console.error(e);
      return null;
    }),
    // Optional AI-oriented file (used as cross-check; filter uses aiOriented property).
    loadGeoJSON(AI_ORIENTED_URL).catch(() => null),
  ]);

  let layersReady = false;
  let usingRasterFallback = false;

  async function onMapReady() {
    if (layersReady) return;
    layersReady = true;
    const [dcs, commits, policy, aiOriented] = await loadPromise;
    dcGeo = dcs || { type: 'FeatureCollection', features: [] };
    commitGeo = commits || { type: 'FeatureCollection', features: [] };
    policyGeo = policy || { type: 'FeatureCollection', features: [] };

    if (aiOriented?.features && dcGeo.features) {
      console.info(
        `Hypergrid DCs: ${dcGeo.features.length}; AI-oriented file: ${aiOriented.features.length}`,
      );
    }

    addHypergridLayers();
    await refreshLiveFeeds();
  }

  map = createMap(CARTO_VECTOR);
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'bottom-right');
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }), 'bottom-left');

  map.on('load', () => {
    onMapReady();
  });

  map.on('error', (e) => {
    const msg = String(e?.error?.message || e?.message || '');
    console.warn('Map style/source error', msg);
    if (!usingRasterFallback && !layersReady) {
      usingRasterFallback = true;
      console.warn('Falling back to Carto dark raster tiles');
      map.setStyle(CARTO_RASTER_STYLE);
      map.once('style.load', () => {
        layersReady = false;
        onMapReady();
      });
    }
  });

  setInterval(() => {
    refreshLiveFeeds();
  }, 5 * 60 * 1000);
}

init().catch((err) => {
  console.error(err);
  const el = document.getElementById('live-content');
  if (el) {
    el.innerHTML = `<p class="live-value error">UNKNOWN</p><p class="live-sub">${esc(err?.message || 'init failed')}</p>`;
  }
});

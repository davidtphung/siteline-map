/**
 * Siteline enhance: OpenInfraMap power + telecom overlays.
 * Hooks window.__SITELINE_MAP__ / siteline-map-ready from maplibre-siteline-hook.js.
 * Honesty: OIM is OSM-mapped only. As-built fiber / conduit stays UNKNOWN.
 * NLT143 RESEARCH by David T Phung
 */
const OIM_TILES = ['https://openinframap.org/tiles/{z}/{x}/{y}.pbf'];
const OIM_ATTR =
  '© OpenInfraMap / OpenStreetMap contributors (OSM-mapped infrastructure, not as-built plant)';

const SOURCE_ID = 'oim-power';
const LAYERS = {
  powerLine: {
    id: 'siteline-oim-power-line',
    type: 'line',
    'source-layer': 'power_line',
    paint: {
      'line-color': '#fbbf24',
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 12, 2.2],
      'line-opacity': 0.85,
    },
  },
  powerSub: {
    id: 'siteline-oim-power-sub',
    type: 'circle',
    'source-layer': 'power_substation_point',
    paint: {
      'circle-radius': 4.5,
      'circle-color': '#f59e0b',
      'circle-stroke-width': 1.2,
      'circle-stroke-color': '#111',
    },
  },
  telecomLine: {
    id: 'siteline-oim-telecom-line',
    type: 'line',
    'source-layer': 'telecoms_communication_line',
    paint: {
      'line-color': '#22d3ee',
      'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.9, 13, 2.4],
      'line-opacity': 0.9,
    },
  },
  telecomMast: {
    id: 'siteline-oim-telecom-mast',
    type: 'circle',
    'source-layer': 'telecoms_mast',
    paint: {
      'circle-radius': 3.5,
      'circle-color': '#67e8f9',
      'circle-stroke-width': 1,
      'circle-stroke-color': '#111',
    },
  },
};

const state = {
  power: true,
  telecom: true,
};

function setVis(map, id, on) {
  if (!map.getLayer(id)) return;
  map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
}

function applyVisibility(map) {
  setVis(map, LAYERS.powerLine.id, state.power);
  setVis(map, LAYERS.powerSub.id, state.power);
  setVis(map, LAYERS.telecomLine.id, state.telecom);
  setVis(map, LAYERS.telecomMast.id, state.telecom);
}

function addOim(map) {
  if (!map || typeof map.addSource !== 'function') return;
  try {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'vector',
        tiles: OIM_TILES,
        minzoom: 0,
        maxzoom: 17,
        attribution: OIM_ATTR,
      });
    }
    for (const def of Object.values(LAYERS)) {
      if (map.getLayer(def.id)) continue;
      map.addLayer({
        id: def.id,
        type: def.type,
        source: SOURCE_ID,
        'source-layer': def['source-layer'],
        layout: { visibility: 'visible' },
        paint: def.paint,
      });
    }
    applyVisibility(map);
    setStatus('OpenInfraMap power + telecom loaded (OSM-mapped). As-built fiber UNKNOWN.');
  } catch (err) {
    console.warn('[siteline-enhance] OIM failed', err);
    setStatus('OpenInfraMap UNKNOWN (tile error). As-built fiber UNKNOWN.');
  }
}

function ensurePanel() {
  if (document.getElementById('siteline-oim-panel')) return;
  const panel = document.createElement('div');
  panel.id = 'siteline-oim-panel';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'OpenInfraMap layers');
  panel.innerHTML = `
    <style>
      #siteline-oim-panel {
        position: fixed;
        left: 12px;
        bottom: 56px;
        z-index: 40;
        max-width: min(320px, calc(100vw - 24px));
        padding: 10px 12px;
        border: 1px solid rgba(148,163,184,0.28);
        border-radius: 10px;
        background: rgba(5,7,10,0.88);
        color: #e2e8f0;
        font: 500 12px/1.35 Inter, system-ui, sans-serif;
        backdrop-filter: blur(8px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      }
      #siteline-oim-panel .oim-title {
        font-size: 11px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #94a3b8;
        margin: 0 0 6px;
      }
      #siteline-oim-panel label {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 4px 0;
        cursor: pointer;
      }
      #siteline-oim-panel .swatch {
        width: 10px;
        height: 10px;
        border-radius: 2px;
        flex: 0 0 auto;
      }
      #siteline-oim-panel .swatch.power { background: #fbbf24; }
      #siteline-oim-panel .swatch.telecom { background: #22d3ee; }
      #siteline-oim-panel .note {
        margin: 8px 0 0;
        color: #94a3b8;
        font-weight: 400;
        font-size: 11px;
      }
      #siteline-oim-panel .status {
        margin: 6px 0 0;
        color: #cbd5e1;
        font-weight: 400;
        font-size: 11px;
      }
      @media (max-width: 720px) {
        #siteline-oim-panel { bottom: 72px; left: 8px; }
      }
    </style>
    <p class="oim-title">OpenInfraMap (open source)</p>
    <label>
      <input type="checkbox" id="oim-power-toggle" checked />
      <span class="swatch power" aria-hidden="true"></span>
      <span>OIM power lines + substations</span>
    </label>
    <label>
      <input type="checkbox" id="oim-telecom-toggle" checked />
      <span class="swatch telecom" aria-hidden="true"></span>
      <span>OIM telecom (OSM mapped)</span>
    </label>
    <p class="note">Source: openinframap.org / OSM. Availability-style map only. As-built fiber / conduit UNKNOWN.</p>
    <p class="status" id="oim-status">Waiting for map…</p>
  `;
  document.body.appendChild(panel);

  const powerEl = document.getElementById('oim-power-toggle');
  const telecomEl = document.getElementById('oim-telecom-toggle');
  powerEl?.addEventListener('change', () => {
    state.power = !!powerEl.checked;
    const map = window.__SITELINE_MAP__;
    if (map) applyVisibility(map);
  });
  telecomEl?.addEventListener('change', () => {
    state.telecom = !!telecomEl.checked;
    const map = window.__SITELINE_MAP__;
    if (map) applyVisibility(map);
  });
}

function setStatus(text) {
  ensurePanel();
  const el = document.getElementById('oim-status');
  if (el) el.textContent = text;
}

function attach(map) {
  ensurePanel();
  const run = () => addOim(map);
  if (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) {
    run();
  } else {
    map.once?.('load', run);
    map.once?.('idle', run);
  }
  map.on?.('styledata', () => {
    if (map.isStyleLoaded?.()) addOim(map);
  });
}

function boot() {
  ensurePanel();
  if (window.__SITELINE_MAP__) attach(window.__SITELINE_MAP__);
  window.addEventListener('siteline-map-ready', (ev) => {
    const map = ev?.detail || window.__SITELINE_MAP__;
    if (map) attach(map);
  });
  window.addEventListener('siteline-map-created', (ev) => {
    const map = ev?.detail || window.__SITELINE_MAP__;
    if (map) attach(map);
  });
  // Late bind if React map mounts after this module
  let tries = 0;
  const poll = window.setInterval(() => {
    tries += 1;
    if (window.__SITELINE_MAP__) {
      attach(window.__SITELINE_MAP__);
      window.clearInterval(poll);
    } else if (tries > 80) {
      window.clearInterval(poll);
      setStatus('Map hook missed. Reload once. As-built fiber UNKNOWN.');
    }
  }, 250);
}

boot();

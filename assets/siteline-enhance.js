/** Siteline enhance gzip+b64 multi-part loader (instrument tray). */
const PARTS = ['siteline-enhance.gz0.txt', 'siteline-enhance.gz1.txt', 'siteline-enhance.gz2.txt', 'siteline-enhance.gz3.txt', 'siteline-enhance.gz4.txt', 'siteline-enhance.gz5.txt', 'siteline-enhance.gz6.txt', 'siteline-enhance.gz7.txt', 'siteline-enhance.gz8.txt'];
const ASSET_V = 'wells-ac-1';
const base = new URL('.', import.meta.url);
const atlas = document.createElement('link');
atlas.rel = 'stylesheet';
atlas.href = new URL('siteline-atlas.css?v=' + ASSET_V, base).href;
document.head.appendChild(atlas);
(async () => {
  try {
    const texts = await Promise.all(
      PARTS.map((p) =>
        fetch(new URL(p + '?v=' + ASSET_V, base)).then((r) => {
          if (!r.ok) throw new Error(p + ' ' + r.status);
          return r.text();
        }),
      ),
    );
    const b64 = texts.join('').replace(/\s+/g, '');
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
    const code = await new Response(stream).text();
    const s = document.createElement('script');
    s.textContent = code;
    document.head.appendChild(s);
  } catch (e) {
    console.warn('[siteline-enhance] loader failed', e);
  }
})();

installBriefCollapse();
bootPlaceSearch();

function installBriefCollapse() {
  if (document.getElementById('sl-brief-collapse-css')) return;
  document.documentElement.classList.add('sl-brief-collapsed');
  const style = document.createElement('style');
  style.id = 'sl-brief-collapse-css';
  style.textContent = `
.brief-panel .panel-head { cursor: pointer; }
.brief-panel h2::after {
  content: "";
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-left: 8px;
  border-right: 1.5px solid rgba(255,255,255,0.72);
  border-bottom: 1.5px solid rgba(255,255,255,0.72);
  transform: rotate(45deg);
  vertical-align: 1px;
}
html.sl-brief-collapsed .brief-panel h2::after { transform: rotate(-45deg); vertical-align: 0; }
.brief-panel .panel-head::after {
  content: attr(data-sl-summary);
  display: block;
  margin-top: 2px;
  color: rgba(255,255,255,0.5);
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.62rem;
  font-weight: 500;
  letter-spacing: 0.03em;
}
html.sl-brief-collapsed .brief-panel.open {
  max-height: 108px !important;
  overflow: hidden !important;
}
html.sl-brief-collapsed .brief-panel .brief-body,
html.sl-brief-collapsed .brief-panel .loading,
html.sl-brief-collapsed .brief-panel .brief-empty,
html.sl-brief-collapsed .brief-panel .unknown-list,
html.sl-brief-collapsed .brief-panel .error-list { display: none !important; }
@media (min-width: 981px) {
  .brief-panel.open {
    top: calc(12px + var(--sl-well-stack, 76px) + 8px) !important;
    right: 12px !important;
    left: auto !important;
    bottom: auto !important;
    width: min(340px, calc(100vw - 24px)) !important;
    max-height: min(40vh, 420px);
    transform: none !important;
    z-index: 43;
  }
  html.sl-brief-collapsed .brief-panel.open { max-height: 108px !important; }
}
`;
  document.head.appendChild(style);

  const toggle = () => {
    document.documentElement.classList.toggle('sl-brief-collapsed');
    refreshBriefChrome();
  };
  document.addEventListener('click', (event) => {
    const head = event.target.closest?.('.brief-panel .panel-head');
    if (!head || event.target.closest('button, a, input, label')) return;
    toggle();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const head = event.target.closest?.('.brief-panel .panel-head');
    if (!head || event.target.closest('button, a, input, label')) return;
    event.preventDefault();
    toggle();
  });

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      refreshBriefChrome();
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  schedule();
}

function rowText(row) {
  const strong = row.querySelector('strong');
  if (!strong) return '';
  const clone = strong.cloneNode(true);
  clone.querySelectorAll('em, .truth').forEach((node) => node.remove());
  return clone.textContent.replace(/\s+/g, ' ').trim();
}

function briefSummary(panel) {
  if (panel.querySelector('.loading')) return 'Querying public GIS';
  if (panel.querySelector('.brief-empty') && !panel.querySelector('.brief-body')) return 'Click the map';
  const sections = [...panel.querySelectorAll('.section-label')];
  const grid = sections.find((el) => /grid/i.test(el.textContent || ''));
  if (!grid) return 'Site brief';
  const rows = [];
  let node = grid.nextElementSibling;
  while (node && !node.classList.contains('section-label')) {
    if (node.classList.contains('brief-row')) {
      rows.push({
        label: node.querySelector('span')?.textContent?.trim() || '',
        value: rowText(node),
      });
    }
    node = node.nextElementSibling;
  }
  const name = rows.find((row) => /substation name/i.test(row.label))?.value || '';
  const nearest = rows.find((row) => /nearest substation/i.test(row.label))?.value || '';
  const clip = (value) => (value.length > 32 ? value.slice(0, 29) + '...' : value);
  if (name && name.toUpperCase() !== 'UNKNOWN') return 'GRID ' + clip(name);
  if (nearest && nearest.toUpperCase() !== 'UNKNOWN') return 'GRID ' + clip(nearest);
  return 'GRID UNKNOWN';
}

function refreshBriefChrome() {
  const panel = document.querySelector('.brief-panel');
  if (!panel) return;
  const head = panel.querySelector('.panel-head');
  if (!head) return;
  const collapsed = document.documentElement.classList.contains('sl-brief-collapsed');
  panel.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  const summary = briefSummary(panel);
  if (head.dataset.slSummary !== summary) head.dataset.slSummary = summary;
}

function bootPlaceSearch() {
  if (document.getElementById('sl-place')) return;
  const style = document.createElement('style');
  style.id = 'sl-place-css';
  style.textContent = `
#sl-place {
  position: fixed;
  z-index: 60;
  top: 10px;
  left: 168px;
  width: min(380px, calc(100vw - 560px));
  min-width: 220px;
}
#sl-place-form {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(5, 6, 8, 0.9);
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
#sl-place-form svg { flex: 0 0 auto; color: rgba(255,255,255,0.55); }
#sl-place-input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: #fff;
  font: 500 13px/1.2 Inter, system-ui, sans-serif;
}
#sl-place-input::placeholder { color: rgba(255,255,255,0.42); }
#sl-place-note {
  margin: 5px 2px 0;
  color: rgba(255,255,255,0.48);
  font: 500 10px/1.35 "JetBrains Mono", ui-monospace, monospace;
  letter-spacing: 0.01em;
}
#sl-place-list {
  list-style: none;
  margin: 6px 0 0;
  padding: 4px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(5, 6, 8, 0.96);
  box-shadow: 0 12px 32px rgba(0,0,0,0.45);
  max-height: 280px;
  overflow: auto;
}
#sl-place-list button {
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  color: #fff;
  border-radius: 8px;
  padding: 0.38rem 0.5rem;
  cursor: pointer;
}
#sl-place-list button[aria-selected="true"],
#sl-place-list button:hover { background: rgba(255,255,255,0.06); }
#sl-place-list .sl-place-title { display: block; font: 500 13px/1.3 Inter, system-ui, sans-serif; }
#sl-place-list .sl-place-sub {
  display: block;
  margin-top: 1px;
  color: rgba(255,255,255,0.5);
  font: 400 11px/1.35 "JetBrains Mono", ui-monospace, monospace;
}
.sl-place-pin {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #4da3ff;
  box-shadow: 0 0 0 4px rgba(77,163,255,0.28);
}
@media (max-width: 980px) {
  #sl-place {
    top: 56px;
    left: 12px;
    right: 12px;
    width: auto;
    min-width: 0;
  }
}
`;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'sl-place';
  root.innerHTML =
    '<form id="sl-place-form" role="search">' +
    '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="6" cy="6" r="4.25" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M9.2 9.2 L12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
    '<input id="sl-place-input" type="search" role="combobox" aria-expanded="false" aria-controls="sl-place-list" aria-autocomplete="list" aria-describedby="sl-place-note" placeholder="Search address or place" autocomplete="off" spellcheck="false" />' +
    '</form>' +
    '<p id="sl-place-note" class="sl-place-note"></p>' +
    '<ul id="sl-place-list" role="listbox" hidden></ul>';
  document.body.appendChild(root);

  const input = root.querySelector('#sl-place-input');
  const list = root.querySelector('#sl-place-list');
  const note = root.querySelector('#sl-place-note');
  const ui = { hits: [], active: -1, timer: 0, controller: null, marker: null, token: 0, chosenAt: 0 };

  const areaNow = () => {
    let site = null;
    try {
      site = window.__SITELINE_WELL_AREA__?.() || null;
    } catch (_) {
      site = null;
    }
    const map = window.__SITELINE_MAP__;
    let frame = null;
    if (map?.getBounds) {
      const bounds = map.getBounds();
      const center = map.getCenter();
      frame = {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
        center: [center.lng, center.lat],
      };
    }
    if (site && Number.isFinite(site.west)) {
      return { ...site, label: 'site area', strict: site, frame: frame || site };
    }
    if (frame) return { ...frame, label: 'map view', frame };
    return { label: 'map view', center: [-98.5, 31.2] };
  };

  const biasNote = (extra) => {
    const area = areaNow();
    const bias = area.label === 'site area' ? 'Biased to the site area.' : 'Biased to the map view.';
    note.textContent = extra || 'OpenStreetMap geocoder. Approximate, not a survey pin. ' + bias;
  };
  biasNote();

  const closeList = () => {
    list.hidden = true;
    list.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    ui.active = -1;
  };

  const paintList = () => {
    list.innerHTML = '';
    if (!ui.hits.length) {
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      const item = document.createElement('li');
      item.textContent = 'No OSM place for that text.';
      item.style.cssText = 'padding:0.45rem 0.55rem;color:rgba(255,255,255,0.55);font:500 12px/1.3 Inter,system-ui,sans-serif;';
      list.appendChild(item);
      return;
    }
    ui.hits.forEach((hit, index) => {
      const item = document.createElement('li');
      item.setAttribute('role', 'presentation');
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'sl-place-opt-' + index;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', index === ui.active ? 'true' : 'false');
      const title = document.createElement('span');
      title.className = 'sl-place-title';
      title.textContent = hit.title;
      const sub = document.createElement('span');
      sub.className = 'sl-place-sub';
      sub.textContent = hit.outside ? (hit.subtitle ? hit.subtitle + ' · outside this view' : 'outside this view') : hit.subtitle;
      button.append(title, sub);
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', () => choose(index));
      item.appendChild(button);
      list.appendChild(item);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    if (ui.active >= 0) input.setAttribute('aria-activedescendant', 'sl-place-opt-' + ui.active);
    else input.removeAttribute('aria-activedescendant');
  };

  const choose = (index) => {
    const hit = ui.hits[index];
    if (!hit) return;
    const now = Date.now();
    if (now - ui.chosenAt < 350) return;
    ui.chosenAt = now;
    input.value = hit.title;
    closeList();
    if (hit.outside) biasNote('OpenStreetMap match is outside this view. Approximate, not a survey pin.');
    else biasNote();
    flyToHit(hit);
  };

  const flyToHit = (hit) => {
    const map = window.__SITELINE_MAP__;
    if (!map?.flyTo) {
      ui.pending = hit;
      return;
    }
    ui.pending = null;
    const span = Math.max(hit.north - hit.south, hit.east - hit.west);
    const zoom = ui.zoomForKind(hit.kind);
    if (span > 0.0004 && map.fitBounds) {
      map.fitBounds(
        [
          [hit.west, hit.south],
          [hit.east, hit.north],
        ],
        { padding: 80, maxZoom: zoom, duration: 1200, essential: true },
      );
    } else {
      map.flyTo({ center: [hit.lon, hit.lat], zoom, essential: true, duration: 1200 });
    }
    dropPin(map, hit.lon, hit.lat);
  };

  const dropPin = (map, lon, lat) => {
    const ml = window.maplibregl;
    if (!ml?.Marker) return;
    if (!ui.marker) {
      const el = document.createElement('div');
      el.className = 'sl-place-pin';
      ui.marker = new ml.Marker({ element: el, anchor: 'center' }).setLngLat([lon, lat]).addTo(map);
    } else {
      ui.marker.setLngLat([lon, lat]);
    }
  };

  const runSearch = async (raw) => {
    const query = raw.trim();
    ui.controller?.abort();
    if (query.length < 3) {
      ui.hits = [];
      closeList();
      biasNote();
      return;
    }
    const controller = new AbortController();
    ui.controller = controller;
    const token = ++ui.token;
    const area = areaNow();
    try {
      const mod = await import('./place-search.mjs?v=cards-3');
      ui.zoomForKind = mod.zoomForKind;
      if (controller.signal.aborted || token !== ui.token) return;
      const expanded = mod.expandUsRoadQuery(query);
      let queryArea = area;
      if (area.kind === 'site' && area.strict) {
        const padded = mod.padArea(area.strict);
        queryArea = {
          ...area,
          west: padded.west,
          east: padded.east,
          south: padded.south,
          north: padded.north,
          strict: area.strict,
          frame: area.frame,
        };
      }
      const hits = await fetchPlaces(expanded.query, queryArea, controller.signal, mod);
      if (controller.signal.aborted || token !== ui.token) return;
      ui.hits = hits.slice(0, 6);
      ui.active = ui.hits.length ? 0 : -1;
      paintList();
    } catch (err) {
      if (err?.name === 'AbortError' || token !== ui.token) return;
      ui.hits = [];
      list.hidden = false;
      list.innerHTML = '';
      const item = document.createElement('li');
      item.textContent = 'Place search unavailable. Try again.';
      item.style.cssText = 'padding:0.45rem 0.55rem;color:rgba(255,255,255,0.55);font:500 12px/1.3 Inter,system-ui,sans-serif;';
      list.appendChild(item);
      input.setAttribute('aria-expanded', 'true');
    }
  };

  input.addEventListener('input', () => {
    window.clearTimeout(ui.timer);
    ui.timer = window.setTimeout(() => runSearch(input.value), 320);
  });
  input.addEventListener('focus', () => biasNote());
  root.querySelector('#sl-place-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (ui.active >= 0 && ui.hits[ui.active]) choose(ui.active);
    else {
      window.clearTimeout(ui.timer);
      runSearch(input.value).then(() => {
        if (ui.hits[0]) choose(0);
      });
    }
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!ui.hits.length) return;
      ui.active = Math.min(ui.hits.length - 1, ui.active + 1);
      paintList();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!ui.hits.length) return;
      ui.active = Math.max(0, ui.active - 1);
      paintList();
    } else if (event.key === 'Escape') {
      closeList();
      biasNote();
    } else if (event.key === 'Enter' && ui.active >= 0) {
      event.preventDefault();
      choose(ui.active);
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!root.contains(event.target)) closeList();
  });
  window.addEventListener('siteline-well-area', () => {
    if (list.hidden) biasNote();
  });
  window.addEventListener('siteline-map-ready', () => {
    bindMapNote();
    if (ui.pending) flyToHit(ui.pending);
  });
  window.addEventListener('siteline-map-created', bindMapNote);
  bindMapNote();
  const wait = window.setInterval(() => {
    if (window.__SITELINE_MAP__) {
      bindMapNote();
      window.clearInterval(wait);
    }
  }, 400);

  function bindMapNote() {
    const map = window.__SITELINE_MAP__;
    if (!map || map.__slPlaceNote) return;
    map.__slPlaceNote = true;
    map.on?.('moveend', () => {
      if (list.hidden) biasNote();
    });
  }

  ui.zoomForKind = (kind) => {
    const value = String(kind || '').toLowerCase();
    if (/house|address|building/.test(value)) return 16;
    if (/road|street|highway|secondary/.test(value)) return 14;
    if (/city|town|village|hamlet/.test(value)) return 12;
    return 13;
  };
}

async function fetchPlaces(query, area, signal, mod) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: query,
    limit: '6',
    addressdetails: '1',
    countrycodes: 'us',
  });
  const box = mod.viewboxParam(area);
  if (box) {
    params.set('viewbox', box);
    params.set('bounded', '0');
  }
  try {
    const res = await fetch('https://nominatim.openstreetmap.org/search?' + params.toString(), {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('nominatim ' + res.status);
    const hits = mod.rankHits(mod.parseNominatim(await res.json()), area);
    if (hits.length) return hits;
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
  }
  const photon = new URLSearchParams({ q: query, limit: '6', lang: 'en' });
  if (area?.center) {
    photon.set('lat', String(area.center[1]));
    photon.set('lon', String(area.center[0]));
  }
  const res = await fetch('https://photon.komoot.io/api/?' + photon.toString(), {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('photon ' + res.status);
  return mod.rankHits(mod.parsePhoton(await res.json()), area);
}

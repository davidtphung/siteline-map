/**
 * Siteline Intel card. Mounts into a host the dock provides, or a collapsed chip.
 * window.SitelineIntel.mount(containerEl)
 * window.SitelineIntel.onPin({ lng, lat, label })
 */
import {
  HONESTY,
  buildChecklist,
  formatPct,
  siteBriefCsv,
  siteBriefMarkdown,
} from "./intel/transforms.mjs";

const SCENARIO_KEY = "siteline-intel-scenario";
const COMPARE_MAX = 3;

const state = {
  container: null,
  floating: false,
  open: false,
  details: false,
  pin: null,
  place: null,
  context: null,
  series: null,
  seriesError: null,
  fetches: [],
  compare: [],
  busy: false,
  token: 0,
};

function scenario() {
  try {
    return JSON.parse(localStorage.getItem(SCENARIO_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveScenario(next) {
  localStorage.setItem(SCENARIO_KEY, JSON.stringify(next));
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function chip(label) {
  const kind = String(label || "UNKNOWN").toLowerCase();
  return `<span class="sl-intel-truth sl-intel-truth-${esc(kind)}">${esc(label || "UNKNOWN")}</span>`;
}

function statusChip(status) {
  const kind = String(status || "Unknown").toLowerCase();
  return `<span class="sl-intel-status sl-intel-status-${esc(kind)}">${esc(status || "Unknown")}</span>`;
}

function sparkline(points) {
  const rows = (points || []).filter((p) => Number.isFinite(Number(p.peak)));
  if (rows.length < 2) return `<span class="sl-intel-muted">No peak series</span>`;
  const w = 120;
  const h = 28;
  const values = rows.map((p) => Number(p.peak));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 2) - 1;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return `<svg class="sl-intel-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="#4da3ff" stroke-width="1.4"/></svg>`;
}

function lineChart(hourly, forecast) {
  const hours = hourly || [];
  if (hours.length < 2) return `<p class="sl-intel-muted">No hourly series.</p>`;
  const w = 520;
  const h = 140;
  const all = hours.map((r) => Number(r.value));
  for (const row of forecast || []) {
    if (Number.isFinite(Number(row.value))) all.push(Number(row.value));
  }
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const start = hours[0].period;
  const end = hours[hours.length - 1].period;
  const index = new Map(hours.map((r, i) => [r.period, i]));
  const xOf = (period, i, n) => (i / Math.max(1, n - 1)) * (w - 8) + 4;
  const yOf = (v) => h - 16 - ((v - min) / span) * (h - 28);
  const path = hours
    .map((r, i) => `${i === 0 ? "M" : "L"}${xOf(r.period, i, hours.length).toFixed(1)} ${yOf(Number(r.value)).toFixed(1)}`)
    .join(" ");
  const cast = (forecast || []).filter((r) => r.period >= start && Number.isFinite(Number(r.value)));
  const forecastPath = cast
    .map((r, n) => {
      const i = index.has(r.period) ? index.get(r.period) : hours.length - 1;
      return `${n === 0 ? "M" : "L"}${xOf(r.period, i, hours.length).toFixed(1)} ${yOf(Number(r.value)).toFixed(1)}`;
    })
    .join(" ");
  return `<svg class="sl-intel-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Seven day hourly demand">
    <path d="${path}" fill="none" stroke="#4da3ff" stroke-width="1.6"/>
    ${forecastPath ? `<path d="${forecastPath}" fill="none" stroke="#3dd68c" stroke-width="1.4" stroke-dasharray="4 3"/>` : ""}
    <text x="4" y="${h - 4}" fill="rgba(255,255,255,0.45)" font-size="10" font-family="JetBrains Mono, monospace">${esc(start)} to ${esc(end)}</text>
  </svg>`;
}

function historyBars(peaks) {
  const rows = (peaks || []).slice(-730);
  if (rows.length < 2) return `<p class="sl-intel-muted">No daily peak history.</p>`;
  const w = 520;
  const h = 88;
  const values = rows.map((p) => Number(p.peak));
  const max = Math.max(...values) || 1;
  const step = w / rows.length;
  const bars = rows
    .map((p, i) => {
      const bh = (Number(p.peak) / max) * (h - 18);
      const x = i * step;
      return `<rect x="${x.toFixed(2)}" y="${(h - 16 - bh).toFixed(2)}" width="${Math.max(0.4, step - 0.2).toFixed(2)}" height="${bh.toFixed(2)}" fill="#4da3ff" opacity="0.85"/>`;
    })
    .join("");
  return `<svg class="sl-intel-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Daily peaks">${bars}<text x="4" y="${h - 3}" fill="rgba(255,255,255,0.45)" font-size="10" font-family="JetBrains Mono, monospace">${esc(rows[0].date)} to ${esc(rows[rows.length - 1].date)}</text></svg>`;
}

function answers() {
  const place = state.place;
  const series = state.series;
  const who = !state.pin
    ? { answer: "Pin a site", truth: "UNKNOWN", source: null, url: null, asOf: null, retrievedAt: null }
    : !place
      ? { answer: "Looking up catalog boundaries", truth: "UNKNOWN", source: null, url: null, asOf: null, retrievedAt: null }
      : {
          answer: `${place.utility && place.utility.name ? place.utility.name : "Utility UNKNOWN"} · ${
            place.ba && place.ba.name ? place.ba.name : "Grid operator UNKNOWN"
          }${place.ba && place.ba.code ? ` (${place.ba.code})` : ""}`,
          truth: place.ba && place.ba.name ? place.ba.label : place.utility && place.utility.name ? place.utility.label : "UNKNOWN",
          source: place.ba && place.ba.source,
          url: place.ba && place.ba.url,
          asOf: place.ba && place.ba.asOf,
          retrievedAt: place.ba && place.ba.retrievedAt,
        };
  let demand;
  if (!state.pin) demand = { answer: "Pin a site", truth: "UNKNOWN" };
  else if (state.seriesError === "EIA key not configured") demand = { answer: "EIA key not configured", truth: "UNKNOWN", source: "EIA Open Data", url: "https://www.eia.gov/opendata/browser/electricity/rto/region-data" };
  else if (!place || !place.ba || !place.ba.code) demand = { answer: "UNKNOWN", truth: "UNKNOWN", source: place && place.ba && place.ba.source, url: place && place.ba && place.ba.url };
  else if (!series) demand = { answer: state.busy ? "Loading EIA-930" : "UNKNOWN", truth: "UNKNOWN" };
  else {
    const yoy = series.yoy || {};
    demand = {
      answer: `${formatPct(yoy.pct)} peak, ${yoy.month || "month"} vs ${yoy.priorMonth || "prior year"}`,
      truth: yoy.label || "UNKNOWN",
      source: series.source,
      url: series.url,
      asOf: series.asOf,
      retrievedAt: series.retrievedAt,
      units: series.units,
    };
  }
  return { who, demand };
}

function mergedChecklist() {
  const base = (state.context && state.context.checklist) || buildChecklist({ scenario: {} });
  const s = scenario();
  return base.map((row) => {
    if (row.status === "Known") return row;
    const text = s[row.id];
    if (text && String(text).trim()) {
      return {
        ...row,
        status: "Scenario",
        label: "SCENARIO",
        text: String(text).trim(),
        source: "Local scenario input",
      };
    }
    return { ...row, status: "Unknown", label: "UNKNOWN", text: "UNKNOWN", source: null };
  });
}

function briefModel() {
  const { who, demand } = answers();
  const rows = [
    {
      question: "Who serves this site?",
      answer: who.answer,
      status: who.answer.includes("UNKNOWN") && !who.answer.includes("·") ? "Unknown" : "Known",
      truth: who.truth,
      source: who.source,
      url: who.url,
      asOf: who.asOf,
      retrievedAt: who.retrievedAt,
    },
    {
      question: "Is demand rising here?",
      answer: demand.answer,
      status: demand.truth === "UNKNOWN" ? "Unknown" : "Known",
      truth: demand.truth,
      source: demand.source,
      url: demand.url,
      asOf: demand.asOf,
      retrievedAt: demand.retrievedAt,
    },
  ];
  for (const item of mergedChecklist()) {
    rows.push({
      question: item.title,
      answer: item.text,
      status: item.status,
      truth: item.label,
      source: item.source,
      url: item.url,
      asOf: item.asOf,
      retrievedAt: item.retrievedAt,
    });
  }
  return { pin: state.pin, label: state.pin && state.pin.label, rows, fetches: state.fetches };
}

function scenarioFields() {
  const s = scenario();
  const fields = [
    ["customer", "Customer and chip mix"],
    ["halls", "Halls"],
    ["hv", "HV transformer and switchgear"],
    ["lv", "LV gear"],
    ["chillers", "Chillers"],
    ["generation", "Generation, bridge or permanent"],
    ["oem", "OEM supply"],
    ["labor", "Labor"],
    ["nuclear", "Nuclear or SMR (scenario only)"],
  ];
  return fields
    .map(([id, title]) => {
      const value = s[id] ? esc(s[id]) : "";
      const shown = s[id] ? esc(s[id]) : "EMPTY PRIMARY";
      return `<label class="sl-intel-field"><span>${esc(title)} ${chip(s[id] ? "SCENARIO" : "UNKNOWN")}</span><input data-scenario="${esc(id)}" value="${value}" placeholder="${shown}"/></label>`;
    })
    .join("");
}

function render() {
  const root = state.container;
  if (!root) return;
  const { who, demand } = answers();
  const list = mergedChecklist();
  const pinLine = state.pin ? `${Number(state.pin.lat).toFixed(4)}, ${Number(state.pin.lng).toFixed(4)}` : "No pin yet";
  const summary = state.pin ? who.answer : "Pin a site";
  root.innerHTML = `
    <section class="sl-intel ${state.open ? "is-open" : ""}" data-open="${state.open ? "true" : "false"}">
      <button type="button" class="sl-intel-toggle" aria-expanded="${state.open ? "true" : "false"}">
        <span class="sl-intel-kicker">Intel</span>
        <span class="sl-intel-summary">${esc(state.open ? pinLine : summary)}</span>
      </button>
      <div class="sl-intel-body">
        <p class="sl-intel-honesty">${esc(HONESTY)}</p>
        <div class="sl-intel-q">
          <div class="sl-intel-q-label">Who serves this site? ${statusChip(who.answer.includes("UNKNOWN") && !(placeKnown()) ? "Unknown" : state.pin ? "Known" : "Unknown")} ${chip(who.truth)}</div>
          <div class="sl-intel-q-value">${esc(who.answer)}</div>
          <div class="sl-intel-meta">${metaLine(who)}</div>
        </div>
        <div class="sl-intel-q">
          <div class="sl-intel-q-label">Is demand rising here? ${chip(demand.truth)}</div>
          <div class="sl-intel-q-value sl-intel-demand">${sparkline(state.series && state.series.sparkline)} <span>${esc(demand.answer)}</span></div>
          <div class="sl-intel-meta">${metaLine(demand)}${demand.units ? ` · Unit ${esc(demand.units)}` : ""}</div>
        </div>
        <div class="sl-intel-q">
          <div class="sl-intel-q-label">What is missing to build?</div>
          <ul class="sl-intel-check">
            ${list
              .map(
                (item) =>
                  `<li><span>${esc(item.title)}</span> ${statusChip(item.status)} ${chip(item.label)} <em>${esc(item.text)}</em></li>`,
              )
              .join("")}
          </ul>
        </div>
        <div class="sl-intel-actions">
          <button type="button" data-act="copy">Copy site brief</button>
          <button type="button" data-act="csv">Download CSV</button>
          <button type="button" data-act="compare" ${state.pin ? "" : "disabled"}>Add to compare</button>
        </div>
        ${compareTable()}
        <button type="button" class="sl-intel-details-toggle" aria-expanded="${state.details ? "true" : "false"}">Details</button>
        <div class="sl-intel-details" ${state.details ? "" : "hidden"}>
          <h3>Last 7 days ${chip(state.series ? state.series.hourlyLabel : "UNKNOWN")}</h3>
          ${state.seriesError === "EIA key not configured" ? `<p>EIA key not configured</p>` : lineChart(state.series && state.series.hourly7d, state.series && state.series.forecast)}
          <p class="sl-intel-meta">Solid line is hourly demand. Dashed line is the day-ahead forecast when EIA publishes type DF.</p>
          <h3>Daily peaks, last 12 to 24 months ${chip("CATALOG")}</h3>
          ${historyBars(state.series && state.series.dailyPeaks)}
          <p class="sl-intel-meta">${esc(snapshotNote())}</p>
          <h3>Line item demand and supply ${chip("SCENARIO")}</h3>
          <p class="sl-intel-meta">Every value stays EMPTY PRIMARY until you type a local note. Notes stay in this browser. Nuclear and SMR stay scenario only.</p>
          <div class="sl-intel-fields">${scenarioFields()}</div>
          <h3>Sources and history</h3>
          <ul class="sl-intel-log">
            ${(state.fetches.length ? state.fetches : [{ source: "none", query: "", retrievedAt: "", status: "no fetches yet" }])
              .map(
                (row) =>
                  `<li><strong>${esc(row.source)}</strong> ${esc(row.query || "")}<br/>${esc(row.retrievedAt || "")} · ${esc(row.status || "")}${
                    row.url ? `<br/><a href="${esc(row.url)}" target="_blank" rel="noreferrer">${esc(row.url)}</a>` : ""
                  }</li>`,
              )
              .join("")}
          </ul>
        </div>
      </div>
    </section>`;
  bind(root);
}

function placeKnown() {
  return Boolean(state.place && ((state.place.utility && state.place.utility.name) || (state.place.ba && state.place.ba.name)));
}

function metaLine(row) {
  const bits = [];
  if (row.source) bits.push(row.source);
  if (row.asOf) bits.push(`as of ${row.asOf}`);
  if (row.retrievedAt) bits.push(`retrieved ${row.retrievedAt}`);
  return esc(bits.join(" · ") || "Source UNKNOWN");
}

function snapshotNote() {
  if (!state.series) return "History is computed from the EIA series when a key is configured.";
  if (state.series.snapshotStore === "kv") return "A daily peak snapshot for this BA is stored in KV.";
  return "No KV binding. This history is computed from the EIA series, not a stored snapshot.";
}

function compareTable() {
  if (state.compare.length < 1) return "";
  const head = state.compare.map((site) => `<th>${esc(site.title)}</th>`).join("");
  const row = (label, pick) =>
    `<tr><th>${esc(label)}</th>${state.compare.map((site) => `<td>${esc(pick(site))}</td>`).join("")}</tr>`;
  return `<div class="sl-intel-compare"><table>
    <thead><tr><th>Up to 3 sites</th>${head}</tr></thead>
    <tbody>
      ${row("Who serves this site?", (s) => s.who)}
      ${row("Is demand rising here?", (s) => s.demand)}
      ${row("What is missing?", (s) => s.missing)}
    </tbody>
  </table><button type="button" data-act="clear-compare">Clear compare</button></div>`;
}

function bind(root) {
  root.querySelector(".sl-intel-toggle").addEventListener("click", () => {
    state.open = !state.open;
    render();
  });
  root.querySelector(".sl-intel-details-toggle").addEventListener("click", () => {
    state.details = !state.details;
    render();
  });
  root.querySelector('[data-act="copy"]').addEventListener("click", async () => {
    const text = siteBriefMarkdown(briefModel());
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
  });
  root.querySelector('[data-act="csv"]').addEventListener("click", () => {
    const blob = new Blob([siteBriefCsv(briefModel())], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "siteline-site-brief.csv";
    a.click();
    URL.revokeObjectURL(url);
  });
  const add = root.querySelector('[data-act="compare"]');
  if (add) add.addEventListener("click", addCompare);
  const clear = root.querySelector('[data-act="clear-compare"]');
  if (clear) {
    clear.addEventListener("click", () => {
      state.compare = [];
      render();
    });
  }
  root.querySelectorAll("[data-scenario]").forEach((input) => {
    input.addEventListener("change", () => {
      const next = scenario();
      const value = input.value.trim();
      if (value) next[input.dataset.scenario] = value;
      else delete next[input.dataset.scenario];
      saveScenario(next);
      render();
    });
  });
}

function addCompare() {
  if (!state.pin) return;
  const { who, demand } = answers();
  const missing = mergedChecklist()
    .filter((row) => row.status !== "Known")
    .map((row) => row.title)
    .join(", ");
  const title = state.pin.label || `${Number(state.pin.lat).toFixed(2)}, ${Number(state.pin.lng).toFixed(2)}`;
  const key = `${state.pin.lng.toFixed(3)},${state.pin.lat.toFixed(3)}`;
  state.compare = state.compare.filter((site) => site.key !== key);
  state.compare.push({ key, title, who: who.answer, demand: demand.answer, missing: missing || "None marked unknown" });
  if (state.compare.length > COMPARE_MAX) state.compare = state.compare.slice(-COMPARE_MAX);
  render();
}

async function getJson(url, token) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (token !== state.token) return null;
  if (!res.ok) {
    const error = new Error(body.error || `HTTP ${res.status}`);
    error.status = res.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function loadPin(pin) {
  const token = ++state.token;
  state.pin = pin;
  state.place = null;
  state.context = null;
  state.series = null;
  state.seriesError = null;
  state.fetches = [];
  state.busy = true;
  render();
  const q = `lng=${encodeURIComponent(pin.lng)}&lat=${encodeURIComponent(pin.lat)}`;
  try {
    const place = await getJson(`/api/intel/place?${q}`, token);
    if (!place) return;
    state.place = place;
    state.fetches.push(...(place.fetches || []));
  } catch (err) {
    state.fetches.push({ source: "place", query: q, retrievedAt: new Date().toISOString(), status: err.message });
  }
  state.busy = false;
  render();
  try {
    const ctx = await getJson(`/api/intel/context?${q}`, token);
    if (!ctx) return;
    state.context = ctx;
    state.fetches.push(...(ctx.fetches || []));
    render();
  } catch (err) {
    state.fetches.push({ source: "context", query: q, retrievedAt: new Date().toISOString(), status: err.message });
    render();
  }
  const code = state.place && state.place.ba && state.place.ba.code;
  if (!code) {
    state.seriesError = "no ba code";
    render();
    return;
  }
  state.busy = true;
  render();
  try {
    const series = await getJson(`/api/intel/series?respondent=${encodeURIComponent(code)}`, token);
    if (!series) return;
    state.series = series;
    state.fetches.push({
      source: series.source || "EIA",
      url: series.url,
      query: `respondent ${code} type D and DF`,
      retrievedAt: series.retrievedAt,
      status: "ok",
    });
  } catch (err) {
    state.seriesError = err.body && err.body.error ? err.body.error : err.message;
    state.fetches.push({
      source: "EIA Open Data",
      url: "https://www.eia.gov/opendata/browser/electricity/rto/region-data",
      query: `respondent ${code}`,
      retrievedAt: new Date().toISOString(),
      status: state.seriesError,
    });
  }
  state.busy = false;
  render();
}

function ensureStyle() {
  if (document.getElementById("sl-intel-css")) return;
  const style = document.createElement("style");
  style.id = "sl-intel-css";
  style.textContent = `
#sl-intel-host { position: fixed; z-index: 44; left: 12px; bottom: 12px; width: min(380px, calc(100vw - 24px)); }
.sl-intel { border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; background: rgba(5,7,10,0.92); color: rgba(255,255,255,0.94); font: 500 12px/1.4 Inter, system-ui, sans-serif; box-shadow: 0 14px 40px rgba(0,0,0,0.45); backdrop-filter: blur(16px); }
.sl-intel-toggle, .sl-intel-details-toggle, .sl-intel-actions button, .sl-intel-compare button { font: inherit; color: inherit; background: transparent; border: 0; cursor: pointer; }
.sl-intel-toggle { display: flex; gap: 8px; align-items: baseline; width: 100%; text-align: left; padding: 8px 10px; }
.sl-intel-kicker { font: 600 11px/1 Inter, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; }
.sl-intel-summary { color: rgba(255,255,255,0.55); font: 500 11px/1.3 "JetBrains Mono", ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sl-intel:not(.is-open) .sl-intel-body { display: none; }
.sl-intel-body { padding: 0 10px 10px; max-height: min(62vh, 560px); overflow: auto; }
.sl-intel-honesty, .sl-intel-meta { color: rgba(255,255,255,0.5); font: 500 10px/1.35 "JetBrains Mono", ui-monospace, monospace; }
.sl-intel-q { padding: 6px 0; border-top: 1px solid rgba(255,255,255,0.08); }
.sl-intel-q-label { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.sl-intel-q-value { margin-top: 3px; }
.sl-intel-demand { display: flex; gap: 8px; align-items: center; }
.sl-intel-truth, .sl-intel-status { border-radius: 999px; padding: 1px 6px; font: 600 9px/1.4 "JetBrains Mono", ui-monospace, monospace; letter-spacing: 0.04em; }
.sl-intel-truth-live, .sl-intel-status-known { color: #04140c; background: #3dd68c; }
.sl-intel-truth-catalog { color: #041018; background: #4da3ff; }
.sl-intel-truth-scenario { color: #1a1404; background: #e6c35c; }
.sl-intel-truth-unknown, .sl-intel-status-unknown { color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.08); }
.sl-intel-truth-claim, .sl-intel-truth-press { color: #1a0d0d; background: #f0a0a8; }
.sl-intel-check { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 4px; }
.sl-intel-check em { font-style: normal; color: rgba(255,255,255,0.72); }
.sl-intel-actions { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.sl-intel-actions button, .sl-intel-compare button, .sl-intel-details-toggle { border: 1px solid rgba(255,255,255,0.14); border-radius: 999px; padding: 4px 8px; }
.sl-intel-compare { overflow: auto; margin-bottom: 8px; }
.sl-intel-compare table { width: 100%; border-collapse: collapse; font: 500 10px/1.35 "JetBrains Mono", ui-monospace, monospace; }
.sl-intel-compare th, .sl-intel-compare td { border-bottom: 1px solid rgba(255,255,255,0.08); text-align: left; vertical-align: top; padding: 4px; }
.sl-intel-details h3 { margin: 10px 0 4px; font-size: 12px; font-weight: 600; }
.sl-intel-chart { width: 100%; height: auto; }
.sl-intel-fields { display: grid; gap: 6px; }
.sl-intel-field { display: grid; gap: 2px; }
.sl-intel-field input { width: 100%; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: rgba(0,0,0,0.35); color: white; padding: 4px 6px; font: 500 12px/1.3 "JetBrains Mono", ui-monospace, monospace; }
.sl-intel-log { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.sl-intel-log a { color: #8cc6ff; }
@media (max-width: 720px) {
  #sl-intel-host { left: 8px; right: 8px; width: auto; bottom: 8px; }
  .sl-intel-body { max-height: 48vh; }
}
`;
  document.head.appendChild(style);
}

function mount(containerEl) {
  ensureStyle();
  state.container = containerEl;
  state.floating = containerEl.id === "sl-intel-host";
  render();
  return {
    unmount() {
      containerEl.innerHTML = "";
      if (state.container === containerEl) state.container = null;
    },
  };
}

function onPin(pin) {
  const lng = Number(pin && (pin.lng != null ? pin.lng : pin.lon));
  const lat = Number(pin && pin.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
  if (!state.container) boot();
  loadPin({ lng, lat, label: pin.label || pin.name || null });
}

function boot() {
  if (state.container) return;
  const slotted = document.querySelector("[data-siteline-intel-host]");
  if (slotted) {
    mount(slotted);
    return;
  }
  let host = document.getElementById("sl-intel-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "sl-intel-host";
    document.body.appendChild(host);
  }
  mount(host);
}

function hookMap(map) {
  if (!map || map.__slIntelHook) return;
  map.__slIntelHook = true;
  map.on?.("click", (event) => {
    const lng = event.lngLat && event.lngLat.lng;
    const lat = event.lngLat && event.lngLat.lat;
    if (lng == null || lat == null) return;
    onPin({ lng, lat });
  });
}

const api = { mount, onPin, open() { state.open = true; render(); } };
window.SitelineIntel = api;

window.addEventListener("siteline-pin", (event) => onPin(event.detail || {}));
window.addEventListener("siteline-map-ready", (event) => hookMap(event.detail || window.__SITELINE_MAP__));
window.addEventListener("siteline-map-created", (event) => hookMap(event.detail || window.__SITELINE_MAP__));
if (window.__SITELINE_MAP__) hookMap(window.__SITELINE_MAP__);
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

export { mount, onPin };

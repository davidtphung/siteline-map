/**
 * Siteline Intel Worker routes. EIA key stays on the server.
 */
import {
  assignLabel,
  baCodeForName,
  buildChecklist,
  dailyPeaks,
  finiteNumber,
  formatMiles,
  haversineMiles,
  hourlyWindow,
  lastNDays,
  nearestPoint,
  pickSmallestTerritory,
  yearOverYearPeak,
} from "./assets/intel/transforms.mjs";

const SOURCES_URL = "/config/intel-sources.json";
const CACHE_SECONDS = 3600;
const EIA_PAGE = 5000;

let sourcesPromise = null;

async function loadSources(env, request) {
  if (!sourcesPromise) {
    sourcesPromise = (async () => {
      if (!env.ASSETS) throw new Error("ASSETS binding missing");
      const res = await env.ASSETS.fetch(new URL(SOURCES_URL, request.url));
      if (!res.ok) throw new Error("intel sources missing");
      return res.json();
    })();
  }
  return sourcesPromise;
}

function json(body, status, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? `public, max-age=${CACHE_SECONDS}` : "no-store",
      ...(extra || {}),
    },
  });
}

function cors(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin === "null" ? "*" : origin,
    Vary: "Origin",
  };
}

function withCors(request, response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(cors(request))) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

function cacheRequest(url) {
  return new Request(url, { method: "GET" });
}

async function readCache(url) {
  try {
    const hit = await caches.default.match(cacheRequest(url));
    if (!hit) return null;
    return hit;
  } catch {
    return null;
  }
}

async function writeCache(url, response, seconds) {
  try {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", `public, max-age=${seconds}`);
    const stored = new Response(response.body, { status: response.status, headers });
    await caches.default.put(cacheRequest(url), stored.clone());
    return stored;
  } catch {
    return response;
  }
}

function healthStore() {
  if (!globalThis.__SITELINE_INTEL_HEALTH__) {
    globalThis.__SITELINE_INTEL_HEALTH__ = { sources: {}, updatedAt: null };
  }
  return globalThis.__SITELINE_INTEL_HEALTH__;
}

function noteSource(name, patch) {
  const store = healthStore();
  store.sources[name] = { ...(store.sources[name] || {}), ...patch };
  store.updatedAt = new Date().toISOString();
}

async function persistHealth(env) {
  const store = healthStore();
  const body = JSON.stringify(store);
  if (env.INTEL_KV) {
    try {
      await env.INTEL_KV.put("intel:health", body);
    } catch (err) {
      noteSource("kv", { status: "error", detail: String(err && err.message ? err.message : err) });
    }
  }
  try {
    await caches.default.put(
      cacheRequest("https://siteline.internal/intel/health"),
      new Response(body, { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" } }),
    );
  } catch {
    /* isolate memory still holds the latest note */
  }
}

async function readPersistedHealth(env) {
  if (env.INTEL_KV) {
    try {
      const raw = await env.INTEL_KV.get("intel:health");
      if (raw) return JSON.parse(raw);
    } catch {
      /* fall through */
    }
  }
  try {
    const hit = await caches.default.match(cacheRequest("https://siteline.internal/intel/health"));
    if (hit) return hit.json();
  } catch {
    /* ignore */
  }
  return healthStore();
}

async function arcgisQuery(queryUrl, params, timeoutMs) {
  const url = new URL(queryUrl);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.href, {
    headers: { Accept: "application/json", "User-Agent": "SitelineMap/1.0 (nlt143.energy; research)" },
    signal: AbortSignal.timeout(timeoutMs || 12000),
  });
  const retrievedAt = new Date().toISOString();
  if (!res.ok) {
    return { ok: false, status: res.status, retrievedAt, url: url.href, json: null };
  }
  const body = await res.json();
  if (body && body.error) {
    return { ok: false, status: body.error.code || 400, retrievedAt, url: url.href, json: body };
  }
  return { ok: true, status: 200, retrievedAt, url: url.href, json: body };
}

function pointParams(lng, lat, distanceMiles) {
  const params = {
    f: "json",
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    returnGeometry: "false",
    resultRecordCount: "8",
  };
  if (distanceMiles) {
    params.distance = String(distanceMiles);
    params.units = "esriSRUnit_StatuteMile";
  }
  return params;
}

function envelope(lng, lat, delta) {
  const west = lng - delta;
  const south = lat - delta;
  const east = lng + delta;
  const north = lat + delta;
  return {
    f: "json",
    geometry: `${west},${south},${east},${north}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outSR: "4326",
    returnGeometry: "true",
    resultRecordCount: "30",
  };
}

function esriPoint(feature) {
  const g = feature && feature.geometry;
  if (!g) return null;
  if (g.x != null && g.y != null) return { lng: g.x, lat: g.y };
  return null;
}

function lineVertices(feature) {
  const g = feature && feature.geometry;
  const paths = (g && g.paths) || [];
  const pts = [];
  for (const path of paths) {
    for (const pair of path) {
      if (pts.length > 400) return pts;
      pts.push({ lng: pair[0], lat: pair[1] });
    }
  }
  return pts;
}

async function lookupPlace(sources, lng, lat) {
  const fetches = [];
  const [baRes, utilRes] = await Promise.all([
    arcgisQuery(sources.balancingAuthority.query, {
      ...pointParams(lng, lat),
      outFields: "NAME,ID,STATE,CITY,WEBSITE,SOURCEDATE,YEAR",
    }),
    arcgisQuery(sources.utility.query, {
      ...pointParams(lng, lat),
      outFields: "NAME,STATE,CNTRL_AREA,Shape__Area",
    }),
  ]);
  fetches.push({
    source: sources.balancingAuthority.name,
    url: sources.balancingAuthority.url,
    query: `point ${lng},${lat}`,
    retrievedAt: baRes.retrievedAt,
    status: baRes.ok ? "ok" : `error ${baRes.status}`,
  });
  fetches.push({
    source: sources.utility.name,
    url: sources.utility.url,
    query: `point ${lng},${lat}`,
    retrievedAt: utilRes.retrievedAt,
    status: utilRes.ok ? "ok" : `error ${utilRes.status}`,
  });

  let ba = null;
  if (baRes.ok) {
    const feat = (baRes.json.features || [])[0];
    const name = feat && feat.attributes && feat.attributes.NAME;
    if (name) {
      const code = baCodeForName(name, sources.baCodeByName);
      const sourcedate = feat.attributes.SOURCEDATE;
      ba = {
        name,
        code: code || null,
        label: assignLabel("hifld"),
        source: sources.balancingAuthority.name,
        url: sources.balancingAuthority.url,
        asOf: sourcedate ? new Date(sourcedate).toISOString().slice(0, 10) : feat.attributes.YEAR || null,
        retrievedAt: baRes.retrievedAt,
        website: feat.attributes.WEBSITE || null,
      };
    }
  }
  if (!ba) {
    ba = {
      name: null,
      code: null,
      label: "UNKNOWN",
      source: sources.balancingAuthority.name,
      url: sources.balancingAuthority.url,
      asOf: null,
      retrievedAt: baRes.retrievedAt,
    };
  }

  let utility = {
    name: null,
    label: "UNKNOWN",
    source: sources.utility.name,
    url: sources.utility.url,
    asOf: null,
    retrievedAt: utilRes.retrievedAt,
    overlap: 0,
    controlAreaCode: null,
  };
  if (utilRes.ok) {
    const picked = pickSmallestTerritory(utilRes.json.features || []);
    if (picked.utility) {
      const code = String(picked.utility.CNTRL_AREA || "").trim();
      utility = {
        name: picked.utility.NAME,
        label: assignLabel("hifld"),
        source: sources.utility.name,
        url: sources.utility.url,
        asOf: null,
        retrievedAt: utilRes.retrievedAt,
        overlap: picked.overlap,
        controlAreaCode: code && code.toUpperCase() !== "NOT AVAILABLE" ? code : null,
      };
      if (!ba.code && utility.controlAreaCode && !ba.name) {
        ba = {
          ...ba,
          code: utility.controlAreaCode,
          name: null,
          label: assignLabel("hifld"),
          source: sources.utility.name,
          url: sources.utility.url,
          note: "EIA respondent code from the retail territory attribute. Control area polygon did not hit.",
        };
      }
    }
  }

  noteSource("balancing-authority", { status: baRes.ok ? "ok" : "error", retrievedAt: baRes.retrievedAt });
  noteSource("utility", { status: utilRes.ok ? "ok" : "error", retrievedAt: utilRes.retrievedAt });
  return { ba, utility, fetches };
}

function catalogSubName(attrs) {
  const raw = String((attrs && (attrs.NAME || attrs.name)) || "").trim();
  const city = attrs && attrs.CITY && String(attrs.CITY).toUpperCase() !== "NOT AVAILABLE" ? attrs.CITY : null;
  const state = attrs && attrs.STATE && String(attrs.STATE).toUpperCase() !== "NOT AVAILABLE" ? attrs.STATE : null;
  const kv = finiteNumber(attrs && attrs.MAX_VOLT);
  const named = raw && !/^UNKNOWN/i.test(raw) && raw.toUpperCase() !== "NOT AVAILABLE";
  const place = [city, state].filter(Boolean).join(", ");
  const bits = [];
  if (named) bits.push(raw);
  else bits.push(place ? `unnamed catalog substation in ${place}` : "unnamed catalog substation");
  if (kv != null) bits.push(`${kv} kV`);
  return bits.join(", ");
}

function gridText(sub, line) {
  const parts = [];
  if (sub) {
    parts.push(`Substation ${catalogSubName(sub.feature.attributes)}, ${formatMiles(sub.miles)} (catalog distance)`);
  } else parts.push("Substation UNKNOWN");
  if (line) {
    parts.push(`Line ${formatMiles(line.miles)} to nearest catalog vertex`);
  } else parts.push("Line UNKNOWN");
  return parts.join(". ");
}

async function lookupContext(sources, lng, lat) {
  const box = envelope(lng, lat, 0.45);
  const [subRes, lineRes, waterRes, fiberRes, floodRes] = await Promise.all([
    arcgisQuery(sources.grid.substations.url, { ...box, outFields: "NAME,MAX_VOLT,CITY,STATE" }, 10000),
    arcgisQuery(sources.grid.transmission.url, { ...box, outFields: "VOLTAGE,OWNER,ID" }, 10000),
    arcgisQuery(sources.water.url, { ...pointParams(lng, lat, 3), outFields: "GNIS_NAME,FTYPE", returnGeometry: "false" }, 8000).catch((err) => ({
      ok: false,
      status: 0,
      retrievedAt: new Date().toISOString(),
      url: sources.water.url,
      error: String(err && err.message ? err.message : err),
    })),
    arcgisQuery(sources.fiber.url, { ...pointParams(lng, lat), outFields: "CountyName,StateAbbr,ServedBSLsFiber,ServedBSLs", returnGeometry: "false" }, 8000).catch((err) => ({
      ok: false,
      status: 0,
      retrievedAt: new Date().toISOString(),
      url: sources.fiber.url,
      error: String(err && err.message ? err.message : err),
    })),
    arcgisQuery(sources.flood.url, { ...pointParams(lng, lat), outFields: "FLD_ZONE,ZONE_SUBTY", returnGeometry: "false" }, 8000).catch((err) => ({
      ok: false,
      status: 0,
      retrievedAt: new Date().toISOString(),
      url: sources.flood.url,
      error: String(err && err.message ? err.message : err),
    })),
  ]);

  const fetches = [
    { source: sources.grid.substations.name, url: sources.grid.substations.url, query: `envelope ${lng},${lat}`, retrievedAt: subRes.retrievedAt, status: subRes.ok ? "ok" : `error ${subRes.status}` },
    { source: sources.grid.transmission.name, url: sources.grid.transmission.url, query: `envelope ${lng},${lat}`, retrievedAt: lineRes.retrievedAt, status: lineRes.ok ? "ok" : `error ${lineRes.status}` },
    { source: sources.water.name, url: sources.water.url, query: `point ${lng},${lat}`, retrievedAt: waterRes.retrievedAt, status: waterRes.ok ? "ok" : `error ${waterRes.status}` },
    { source: sources.fiber.name, url: sources.fiber.url, query: `point ${lng},${lat}`, retrievedAt: fiberRes.retrievedAt, status: fiberRes.ok ? "ok" : `error ${fiberRes.status}` },
    { source: sources.flood.name, url: sources.flood.url, query: `point ${lng},${lat}`, retrievedAt: floodRes.retrievedAt, status: floodRes.ok ? "ok" : `error ${floodRes.status}` },
  ];

  let grid = null;
  if (subRes.ok || lineRes.ok) {
    const sub = subRes.ok
      ? nearestPoint(lng, lat, subRes.json.features || [], esriPoint)
      : null;
    let line = null;
    if (lineRes.ok) {
      let best = null;
      for (const feature of lineRes.json.features || []) {
        for (const pt of lineVertices(feature)) {
          const miles = haversineMiles(lng, lat, pt.lng, pt.lat);
          if (miles == null) continue;
          if (!best || miles < best.miles) best = { miles, feature };
        }
      }
      line = best;
    }
    if (sub || line) {
      grid = {
        text: gridText(sub, line) + ". Proximity is not deliverability.",
        source: sources.grid.substations.name,
        url: sources.grid.substations.url,
        retrievedAt: subRes.retrievedAt || lineRes.retrievedAt,
        asOf: null,
      };
    }
  }

  const water = describePresence(waterRes, sources.water, (attrs) => {
    const name = attrs.GNIS_NAME || attrs.FTYPE || "NHD feature";
    return `Catalog water feature nearby: ${name}. Withdrawal right UNKNOWN.`;
  }, "No NHD flowline within 3 mi. Withdrawal right UNKNOWN.");

  const fiber = describePresence(fiberRes, sources.fiber, (attrs) => {
    const fiberBsl = finiteNumber(attrs.ServedBSLsFiber);
    const anyBsl = finiteNumber(attrs.ServedBSLs);
    if (fiberBsl == null && anyBsl == null) return null;
    const where = [attrs.CountyName, attrs.StateAbbr].filter(Boolean).join(", ");
    return `FCC BDC Dec 2024${where ? " " + where : ""}: fiber BSL ${fiberBsl == null ? "UNKNOWN" : fiberBsl}, served BSL ${anyBsl == null ? "UNKNOWN" : anyBsl}. As-built route UNKNOWN.`;
  }, null);

  const flood = describePresence(floodRes, sources.flood, (attrs) => {
    const zone = attrs.FLD_ZONE || "mapped";
    return `FEMA NFHL zone ${zone}. Presence is not a permit outcome.`;
  }, "No NFHL flood polygon at this point. Other hazards UNKNOWN.");

  noteSource("grid", { status: subRes.ok || lineRes.ok ? "ok" : "error", retrievedAt: subRes.retrievedAt });
  noteSource("water", { status: waterRes.ok ? "ok" : "error", retrievedAt: waterRes.retrievedAt });
  noteSource("fiber", { status: fiberRes.ok ? "ok" : "error", retrievedAt: fiberRes.retrievedAt });
  noteSource("flood", { status: floodRes.ok ? "ok" : "error", retrievedAt: floodRes.retrievedAt });

  return {
    checklist: buildChecklist({ grid, water, fiber, flood, scenario: {} }),
    fetches,
  };
}

function describePresence(res, source, onHit, emptyText) {
  if (!res || !res.ok) return null;
  const feats = (res.json && res.json.features) || [];
  if (!feats.length) {
    if (!emptyText) return null;
    return { text: emptyText, source: source.name, url: source.url, retrievedAt: res.retrievedAt, asOf: null };
  }
  const text = onHit(feats[0].attributes || {});
  if (!text) return null;
  return { text, source: source.name, url: source.url, retrievedAt: res.retrievedAt, asOf: null };
}

function eiaUrl(sources, key, respondent, type, start, end, offset) {
  const url = new URL(sources.eia.url);
  url.searchParams.set("api_key", key);
  url.searchParams.set("frequency", "hourly");
  url.searchParams.set("data[0]", "value");
  url.searchParams.append("facets[respondent][]", respondent);
  url.searchParams.append("facets[type][]", type);
  if (start) url.searchParams.set("start", start);
  if (end) url.searchParams.set("end", end);
  url.searchParams.set("sort[0][column]", "period");
  url.searchParams.set("sort[0][direction]", "asc");
  url.searchParams.set("length", String(EIA_PAGE));
  url.searchParams.set("offset", String(offset || 0));
  return url;
}

async function fetchEiaPages(sources, key, respondent, type, start, end) {
  const rows = [];
  let offset = 0;
  let pages = 0;
  while (pages < 6) {
    const url = eiaUrl(sources, key, respondent, type, start, end, offset);
    const res = await fetch(url.href, {
      headers: { Accept: "application/json", "User-Agent": "SitelineMap/1.0 (nlt143.energy; research)" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, status: res.status, detail: text.slice(0, 280), rows };
    }
    const body = await res.json();
    const page = (body.response && body.response.data) || [];
    rows.push(...page);
    pages += 1;
    if (page.length < EIA_PAGE) break;
    offset += page.length;
  }
  return { ok: true, status: 200, rows };
}

function publicEiaCacheUrl(request, respondent, type, start, end) {
  const u = new URL(request.url);
  u.pathname = "/api/intel/eia";
  u.search = "";
  u.searchParams.set("respondent", respondent);
  u.searchParams.set("type", type);
  if (start) u.searchParams.set("start", start);
  if (end) u.searchParams.set("end", end);
  return u.href;
}

async function eiaSeries(env, request, sources, respondent, type, start, end) {
  const key = env.EIA_API_KEY;
  if (!key) {
    noteSource("eia", { status: "missing-key", retrievedAt: new Date().toISOString() });
    return { error: true, status: 503, body: { error: "EIA key not configured", code: "EIA_API_KEY_MISSING" } };
  }
  const cacheUrl = publicEiaCacheUrl(request, respondent, type, start, end);
  const hit = await readCache(cacheUrl);
  if (hit) {
    const body = await hit.json();
    return { error: false, status: 200, body, cached: true };
  }
  const result = await fetchEiaPages(sources, key, respondent, type, start, end);
  const retrievedAt = new Date().toISOString();
  if (!result.ok) {
    noteSource("eia", { status: "error", retrievedAt, detail: result.detail || String(result.status) });
    return { error: true, status: 502, body: { error: "EIA request failed", status: result.status, detail: result.detail || null } };
  }
  const body = {
    respondent,
    type,
    label: type === "DF" ? assignLabel("eia-forecast") : assignLabel("eia-hourly"),
    source: sources.eia.name,
    url: sources.eia.docs,
    retrievedAt,
    rows: result.rows.map((row) => ({
      period: row.period,
      value: row.value,
      units: row["value-units"] || null,
      name: row["respondent-name"] || null,
    })),
  };
  noteSource("eia", { status: "ok", retrievedAt, respondent, type });
  const response = json(body, 200);
  await writeCache(cacheUrl, response.clone(), sources.eia.cacheSeconds || CACHE_SECONDS);
  return { error: false, status: 200, body, cached: false };
}

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 13).replace("T", "T");
}

function eiaStart(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}T00`;
}

async function buildDemand(env, request, sources, respondent) {
  const start = eiaStart(800);
  const [demand, forecast] = await Promise.all([
    eiaSeries(env, request, sources, respondent, sources.eia.types.demand, start, null),
    eiaSeries(env, request, sources, respondent, sources.eia.types.dayAheadForecast, eiaStart(10), null),
  ]);
  if (demand.error && demand.status === 503) return demand;
  if (demand.error) return demand;
  const peaks = dailyPeaks(demand.body.rows);
  const yoy = yearOverYearPeak(peaks);
  const spark = lastNDays(peaks, 365);
  const recent = hourlyWindow(demand.body.rows, 24 * 7);
  const forecastRows = forecast.error ? [] : hourlyWindow(forecast.body.rows, 24 * 8);
  const units = (demand.body.rows.find((r) => r.units) || {}).units || null;
  const asOf = recent.length ? recent[recent.length - 1].period : peaks.length ? peaks[peaks.length - 1].date : null;
  const payload = {
    respondent,
    units,
    label: assignLabel("eia-peak"),
    hourlyLabel: assignLabel("eia-hourly"),
    forecastLabel: forecast.error ? "UNKNOWN" : assignLabel("eia-forecast"),
    source: sources.eia.name,
    url: sources.eia.docs,
    gridMonitor: sources.eia.gridMonitor,
    retrievedAt: demand.body.retrievedAt,
    asOf,
    sparkline: spark,
    dailyPeaks: peaks,
    yoy,
    hourly7d: recent,
    forecast: forecastRows,
    forecastStatus: forecast.error ? forecast.body : "ok",
    snapshotStore: env.INTEL_KV ? "kv" : "computed-from-eia-series",
  };
  if (env.INTEL_KV && peaks.length) {
    const last = peaks[peaks.length - 1];
    try {
      await env.INTEL_KV.put(`intel:peak:${respondent}:${last.date}`, JSON.stringify({ respondent, ...last, retrievedAt: demand.body.retrievedAt }));
    } catch {
      payload.snapshotStore = "computed-from-eia-series";
    }
  }
  return { error: false, status: 200, body: payload };
}

export async function handleIntel(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });
  let sources;
  try {
    sources = await loadSources(env, request);
  } catch (err) {
    return withCors(request, json({ error: String(err && err.message ? err.message : err) }, 500));
  }

  if (path === "/api/intel/health") {
    const persisted = await readPersistedHealth(env);
    return withCors(
      request,
      json(
        {
          ok: true,
          keyConfigured: Boolean(env.EIA_API_KEY),
          snapshotStore: env.INTEL_KV ? "INTEL_KV" : "none",
          snapshotNote: env.INTEL_KV
            ? "Daily BA peaks are written to INTEL_KV."
            : "No INTEL_KV binding. Peaks are computed from the EIA series on read. Add [[kv_namespaces]] binding INTEL_KV to accrue snapshots. See README.",
          cronRespondents: sources.cronRespondents,
          presetBas: sources.presetBas,
          updatedAt: persisted.updatedAt || null,
          sources: persisted.sources || {},
        },
        200,
      ),
    );
  }

  if (path === "/api/intel/eia") {
    const respondent = (url.searchParams.get("respondent") || "").toUpperCase();
    const type = (url.searchParams.get("type") || "D").toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(respondent)) return withCors(request, json({ error: "respondent required" }, 400));
    if (type !== "D" && type !== "DF") return withCors(request, json({ error: "type must be D or DF" }, 400));
    const result = await eiaSeries(env, request, sources, respondent, type, url.searchParams.get("start"), url.searchParams.get("end"));
    await persistHealth(env);
    return withCors(request, json(result.body, result.status));
  }

  if (path === "/api/intel/place") {
    const lng = Number(url.searchParams.get("lng"));
    const lat = Number(url.searchParams.get("lat"));
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return withCors(request, json({ error: "lng and lat required" }, 400));
    const place = await lookupPlace(sources, lng, lat);
    await persistHealth(env);
    return withCors(request, json({ lng, lat, ...place, honesty: sources.honesty }, 200));
  }

  if (path === "/api/intel/context") {
    const lng = Number(url.searchParams.get("lng"));
    const lat = Number(url.searchParams.get("lat"));
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return withCors(request, json({ error: "lng and lat required" }, 400));
    const ctx = await lookupContext(sources, lng, lat);
    await persistHealth(env);
    return withCors(request, json({ lng, lat, ...ctx }, 200));
  }

  if (path === "/api/intel/series") {
    const respondent = (url.searchParams.get("respondent") || "").toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(respondent)) return withCors(request, json({ error: "respondent required" }, 400));
    const result = await buildDemand(env, request, sources, respondent);
    await persistHealth(env);
    return withCors(request, json(result.body, result.status));
  }

  return withCors(request, json({ error: "not found" }, 404));
}

export async function refreshIntel(env) {
  const request = new Request("https://siteline.internal/intel/cron");
  let sources;
  try {
    sources = await loadSources(env, request);
  } catch (err) {
    noteSource("cron", { status: "error", detail: String(err && err.message ? err.message : err), retrievedAt: new Date().toISOString() });
    await persistHealth(env);
    return;
  }
  if (!env.EIA_API_KEY) {
    noteSource("eia", { status: "missing-key", retrievedAt: new Date().toISOString() });
    noteSource("cron", { status: "skipped", detail: "EIA key not configured", retrievedAt: new Date().toISOString() });
    await persistHealth(env);
    return;
  }
  const respondents = sources.cronRespondents || [];
  for (const respondent of respondents) {
    try {
      const result = await buildDemand(env, request, sources, respondent);
      noteSource(`cron:${respondent}`, {
        status: result.error ? "error" : "ok",
        retrievedAt: new Date().toISOString(),
        detail: result.error ? result.body.error : "refreshed",
      });
    } catch (err) {
      noteSource(`cron:${respondent}`, { status: "error", retrievedAt: new Date().toISOString(), detail: String(err && err.message ? err.message : err) });
    }
  }
  noteSource("cron", { status: "ok", retrievedAt: new Date().toISOString(), respondents });
  await persistHealth(env);
}

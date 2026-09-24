/**
 * Siteline Worker: public assets, security headers, brand PNGs, allowlisted proxies.
 */
const KARDASHEV = "https://data.kardashevlabs.org";
const CAISO = "https://www.caiso.com/outlook/current";
const NM_WELLS = "https://gis.emnrd.nm.gov/arcgis/rest/services/OCDView/Wells_Public/FeatureServer/0";

const KARDASHEV_PATHS = new Set(["/api/kardashev/health"]);

const BRAND_ROUTES = {
  "/favicon-16.png": ["/brand/favicon-16.png.b64"],
  "/favicon-32.png": ["/brand/favicon-32.png.b64"],
  "/apple-touch-icon.png": ["/brand/apple-touch-icon.png.b64"],
  "/icon-192.png": ["/brand/icon-192.png.b64"],
};

const BLOCKED = [
  /^\/\.git(?:\/|$)/i,
  /^\/worker\.js$/i,
  /^\/wrangler\.toml$/i,
  /^\/package\.json$/i,
  /^\/package-lock\.json$/i,
  /^\/docs(?:\/|$)/i,
  /^\/services(?:\/|$)/i,
  /\.md$/i,
  /\.src\.js$/i,
  /\.test\.mjs$/i,
  /^\/\.env/i,
  /^\/\.assetsignore$/i,
  /^\/secrets\.json$/i,
];

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://esm.sh https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.tile.opentopomap.org https://basemap.nationalmap.gov https://server.arcgisonline.com https://*.tile.openstreetmap.org https://openinframap.org https://s3.amazonaws.com",
  "connect-src 'self' https://esm.sh https://cdn.jsdelivr.net https://nominatim.openstreetmap.org https://photon.komoot.io https://overpass-api.de https://epqs.nationalmap.gov https://arcgis.netl.doe.gov https://services.arcgis.com https://services2.arcgis.com https://services3.arcgis.com https://services5.arcgis.com https://services8.arcgis.com https://data.dnrgis.state.co.us https://hazards.fema.gov https://hydro.nationalmap.gov https://api.eia.gov https://waterservices.usgs.gov https://www.caiso.com https://basemap.nationalmap.gov https://server.arcgisonline.com https://openinframap.org https://s3.amazonaws.com https://*.tile.openstreetmap.org https://*.tile.opentopomap.org",
  "worker-src 'self' blob:",
].join("; ");

function allowedOrigin(origin) {
  if (!origin) return "";
  if (origin === "https://siteline.nlt143.energy") return origin;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    if (local && (url.protocol === "http:" || url.protocol === "https:")) return origin;
  } catch {
    return "";
  }
  return "";
}

function corsHeaders(request) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    Vary: "Origin",
  };
  const origin = allowedOrigin(request.headers.get("Origin"));
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function securityHeaders() {
  return {
    "Strict-Transport-Security": "max-age=31536000",
    "Content-Security-Policy": CSP,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
  };
}

function withHeaders(response, extra) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries({ ...securityHeaders(), ...(extra || {}) })) {
    if (value) headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function blockedPath(path) {
  return BLOCKED.some((rule) => rule.test(path));
}

function requestProtocol(request, url) {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim().toLowerCase();
  const cfVisitor = request.headers.get("cf-visitor");
  if (cfVisitor) {
    try {
      const parsed = JSON.parse(cfVisitor);
      if (parsed.scheme) return String(parsed.scheme).toLowerCase();
    } catch {
      /* ignore */
    }
  }
  const host = url.hostname;
  const publicHost = host === "siteline.nlt143.energy" || host.endsWith(".nlt143.energy");
  if (!publicHost) return "https";
  return url.protocol.replace(":", "");
}

async function serveBrandPng(env, request, b64Paths) {
  let b64 = "";
  for (const b64Path of b64Paths) {
    const res = await env.ASSETS.fetch(new URL(b64Path, request.url));
    if (!res.ok) return new Response("Brand asset missing: " + b64Path, { status: 404, headers: securityHeaders() });
    b64 += (await res.text()).replace(/\s+/g, "");
  }
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Response(bin, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
      ...securityHeaders(),
      ...corsHeaders(request),
    },
  });
}

async function proxyRequest(target, request, cacheControl) {
  const headers = {
    Accept: request.headers.get("Accept") || "*/*",
    "User-Agent": "SitelineMap/1.0 (nlt143.energy; research)",
  };
  const init = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
    const type = request.headers.get("Content-Type");
    if (type) headers["Content-Type"] = type;
  }
  const upstream = await fetch(target, init);
  const out = new Headers(upstream.headers);
  for (const [key, value] of Object.entries({ ...securityHeaders(), ...corsHeaders(request) })) out.set(key, value);
  out.set("Cache-Control", cacheControl || "public, max-age=60");
  out.delete("access-control-allow-origin");
  const origin = allowedOrigin(request.headers.get("Origin"));
  if (origin) out.set("Access-Control-Allow-Origin", origin);
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

const assetBodyCache = new Map();

function byteRange(header) {
  const match = /^bytes=(\d+)-(\d*)$/.exec(header || "");
  if (!match) return null;
  const offset = Number(match[1]);
  if (!match[2]) return { offset };
  const end = Number(match[2]);
  return { offset, length: end - offset + 1 };
}

async function serveR2OrAsset(request, env, key, contentType, maxAge) {
  const headers = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=" + maxAge,
    ...corsHeaders(request),
  };
  if (env.TILES) {
    const range = byteRange(request.headers.get("Range"));
    const object = await env.TILES.get(key, range ? { range } : undefined);
    if (object) {
      if (range && object.range) {
        const start = object.range.offset ?? range.offset;
        const length = object.range.length ?? range.length ?? 0;
        const end = start + length - 1;
        headers["Content-Range"] = "bytes " + start + "-" + end + "/" + object.size;
        headers["Content-Length"] = String(length);
        return new Response(object.body, { status: 206, headers });
      }
      if (object.size) headers["Content-Length"] = String(object.size);
      return new Response(object.body, { status: 200, headers });
    }
  }
  if (env.ASSETS) {
    const range = byteRange(request.headers.get("Range"));
    const assetUrl = new URL("/" + key, request.url);
    if (!range) return env.ASSETS.fetch(new Request(assetUrl, request));
    if (!assetBodyCache.has(key)) {
      const pending = env.ASSETS.fetch(new Request(assetUrl)).then((response) => {
        if (!response.ok) throw new Error("asset " + response.status);
        return response.arrayBuffer();
      });
      assetBodyCache.set(key, pending);
    }
    let bytes;
    try {
      bytes = await assetBodyCache.get(key);
    } catch (error) {
      assetBodyCache.delete(key);
      throw error;
    }
    const start = Math.min(range.offset, bytes.byteLength);
    const end = range.length == null ? bytes.byteLength : Math.min(bytes.byteLength, start + range.length);
    const slice = bytes.slice(start, end);
    headers["Content-Range"] = "bytes " + start + "-" + Math.max(start, end - 1) + "/" + bytes.byteLength;
    headers["Content-Length"] = String(slice.byteLength);
    return new Response(slice, { status: 206, headers });
  }
  return new Response("Tile store is not configured", { status: 404, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (requestProtocol(request, url) === "http") {
      url.protocol = "https:";
      return new Response(null, {
        status: 301,
        headers: {
          Location: url.toString(),
          ...securityHeaders(),
        },
      });
    }

    if (blockedPath(path)) {
      return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", ...securityHeaders() } });
    }

    if (path in BRAND_ROUTES) {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: { ...securityHeaders(), ...corsHeaders(request) } });
      }
      return serveBrandPng(env, request, BRAND_ROUTES[path]);
    }

    if (request.method === "OPTIONS" && path.startsWith("/api/")) {
      return new Response(null, { status: 204, headers: { ...securityHeaders(), ...corsHeaders(request) } });
    }

    if (path.startsWith("/api/kardashev/")) {
      if (!KARDASHEV_PATHS.has(path) || url.search) {
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...securityHeaders(), ...corsHeaders(request) },
        });
      }
      return proxyRequest(`${KARDASHEV}/health`, request);
    }

    if (path.startsWith("/api/wells") || path.startsWith("/api/gas-wells") || path.startsWith("/api/sites") || path === "/api/sources" || path === "/api/imports" || path === "/api/methodology" || path === "/api/quality-report" || path === "/api/health") {
      const origin = env.WELL_INTEL_ORIGIN;
      if (!origin) {
        return new Response(JSON.stringify({ error: "WELL_INTEL_ORIGIN is not configured", fallback: "/data/cameron-wells.geojson" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...securityHeaders(), ...corsHeaders(request) },
        });
      }
      return proxyRequest(`${origin.replace(/\/$/, "")}${path}${url.search}`, request);
    }

    if (path.startsWith("/api/hydro/")) {
      const rest = path.slice("/api/hydro".length) || "/";
      return proxyRequest(`https://hydro.nationalmap.gov${rest}${url.search}`, request);
    }

    if (path === "/tiles/gaswells.pmtiles") {
      return serveR2OrAsset(request, env, "tiles/gaswells.pmtiles", "application/vnd.pmtiles", 300);
    }

    if (path === "/tiles/gaswells-manifest.json") {
      return serveR2OrAsset(request, env, "tiles/gaswells-manifest.json", "application/json", 300);
    }

    if (path === "/api/nmwells" || path === "/api/nmwells/query") {
      const suffix = path.endsWith("/query") ? "/query" : "";
      return proxyRequest(`${NM_WELLS}${suffix}${url.search}`, request, "public, max-age=3600");
    }

    if (path.startsWith("/api/caiso/")) {
      const file = path.replace(/^\/api\/caiso\//, "").replace(/[^a-z0-9_.-]/gi, "");
      if (!file.endsWith(".csv")) {
        return new Response("Not found", { status: 404, headers: { ...securityHeaders(), ...corsHeaders(request) } });
      }
      return proxyRequest(`${CAISO}/${file}`, request);
    }

    if (path.startsWith("/api/")) {
      return new Response("Not found", { status: 404, headers: { ...securityHeaders(), ...corsHeaders(request) } });
    }

    if (env.ASSETS) return withHeaders(await env.ASSETS.fetch(request));
    return new Response("ASSETS binding missing", { status: 500, headers: securityHeaders() });
  },
};

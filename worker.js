/**
 * Siteline Worker: assets + brand PNG (from .b64) + Kardashev/CAISO proxies.
 */
const KARDASHEV = "https://data.kardashevlabs.org";
const CAISO = "https://www.caiso.com/outlook/current";

const BRAND_ROUTES = {
  "/favicon-16.png": ["/brand/favicon-16.png.b64"],
  "/favicon-32.png": ["/brand/favicon-32.png.b64"],
  "/apple-touch-icon.png": ["/brand/apple-touch-icon.png.b64"],
  "/icon-192.png": ["/brand/icon-192.png.b64"],
  "/og-image.png": ["/brand/og-image.png.b64.part1", "/brand/og-image.png.b64.part2"],
};

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin === "null" ? "*" : origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    Vary: "Origin",
  };
}

async function serveBrandPng(env, request, b64Paths) {
  let b64 = "";
  for (const b64Path of b64Paths) {
    const res = await env.ASSETS.fetch(new URL(b64Path, request.url));
    if (!res.ok) return new Response("Brand asset missing: " + b64Path, { status: 404 });
    b64 += (await res.text()).trim();
  }
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Response(bin, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
      ...corsHeaders(request),
    },
  });
}

async function proxyGet(target, request) {
  const upstream = await fetch(target, {
    headers: {
      Accept: request.headers.get("Accept") || "*/*",
      "User-Agent": "SitelineMap/1.0 (nlt143.energy; research)",
    },
  });
  const headers = new Headers(upstream.headers);
  for (const [k, v] of Object.entries(corsHeaders(request))) headers.set(k, v);
  headers.set("Cache-Control", "public, max-age=60");
  return new Response(upstream.body, { status: upstream.status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path in BRAND_ROUTES) {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(request) });
      }
      return serveBrandPng(env, request, BRAND_ROUTES[path]);
    }

    if (request.method === "OPTIONS" && path.startsWith("/api/")) {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (path.startsWith("/api/kardashev/")) {
      const rest = path.replace(/^\/api\/kardashev/, "");
      return proxyGet(`${KARDASHEV}${rest}${url.search}`, request);
    }

    if (path.startsWith("/api/caiso/")) {
      const file = path.replace(/^\/api\/caiso\//, "").replace(/[^a-z0-9_.-]/gi, "");
      if (!file.endsWith(".csv")) {
        return new Response("Not found", { status: 404, headers: corsHeaders(request) });
      }
      return proxyGet(`${CAISO}/${file}`, request);
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("ASSETS binding missing", { status: 500 });
  },
};

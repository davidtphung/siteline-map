import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { STATIC_FILES, aboutJsonLd, indexJsonLd, replaceMarked } from "./discoverability-pages.mjs";
import { CRAWLER_AGENTS, FAQ, GAPS, INDEXNOW_KEY, LAYERS, REGIONS } from "./site-catalog.mjs";
import worker from "../worker.js";

const root = new URL("../", import.meta.url);

function read(rel) {
  return readFileSync(new URL(rel, root), "utf8");
}

const PUBLIC = [
  "index.html",
  "about.html",
  "well-methodology.html",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "llms-full.txt",
  "regions/index.html",
  ...REGIONS.map((region) => "regions/" + region.id + ".html"),
  INDEXNOW_KEY + ".txt",
];

test("generated files match the catalog and avoid banned copy", () => {
  for (const [rel, render] of Object.entries(STATIC_FILES)) {
    assert.equal(read(rel), render(), rel);
  }
  const index = read("index.html");
  assert.match(index, /id="siteline-jsonld"/);
  assert.match(index, /id="siteline-summary"/);
  assert.match(index, /<noscript>/);
  assert.match(index, /siteline-view\.js/);
  for (const rel of PUBLIC) {
    const text = read(rel);
    assert.equal(text.includes("\u2014"), false, rel + " em dash");
    assert.equal(text.includes("\u2013"), false, rel + " en dash");
    assert.equal(/\bKate\b/.test(text), false, rel);
    assert.equal(/Fluidstack/i.test(text), false, rel);
    assert.equal(/\d[\d,]*(?:\.\d+)?\s*MW\b/i.test(text), false, rel + " invented MW");
    assert.equal(/\bMVA\b/.test(text) && /\d/.test(text.slice(Math.max(0, text.search(/\bMVA\b/) - 8), text.search(/\bMVA\b/) + 8)), false);
    assert.equal(text.includes("sere.davidtphung.com"), false, rel);
  }
});

test("robots allows the answer engine crawlers and keeps the sitemap", () => {
  const robots = read("robots.txt");
  assert.match(robots, /User-agent: \*\nAllow: \/\n/);
  assert.match(robots, /Sitemap: https:\/\/siteline\.nlt143\.energy\/sitemap\.xml\n?$/);
  for (const agent of CRAWLER_AGENTS) {
    assert.match(robots, new RegExp("User-agent: " + agent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\nAllow: /"));
  }
});

test("sitemap lists every public page with lastmod", () => {
  const xml = read("sitemap.xml");
  for (const loc of [
    "https://siteline.nlt143.energy/",
    "https://siteline.nlt143.energy/about",
    "https://siteline.nlt143.energy/regions",
    "https://siteline.nlt143.energy/well-methodology",
    "https://siteline.nlt143.energy/llms.txt",
    "https://siteline.nlt143.energy/llms-full.txt",
    ...REGIONS.map((region) => "https://siteline.nlt143.energy/regions/" + region.id),
  ]) {
    assert.ok(xml.includes("<loc>" + loc + "</loc>"), loc);
  }
  assert.equal((xml.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) || []).length, 6 + REGIONS.length);
});

test("pages carry canonical, Open Graph, and Twitter tags", () => {
  for (const rel of ["index.html", "about.html", "well-methodology.html", "regions/index.html", ...REGIONS.map((region) => "regions/" + region.id + ".html")]) {
    const html = read(rel);
    assert.match(html, /rel="canonical"/, rel);
    assert.match(html, /property="og:title"/, rel);
    assert.match(html, /property="og:url"/, rel);
    assert.match(html, /property="og:image"/, rel);
    assert.match(html, /name="twitter:card"/, rel);
    assert.match(html, /name="twitter:creator" content="@davidtphung"/, rel);
  }
});

test("JSON-LD matches the visible about answers and names the gaps", () => {
  const about = aboutJsonLd();
  const faq = about["@graph"].find((node) => node["@type"] === "FAQPage");
  assert.equal(faq.mainEntity.length, FAQ.length);
  const aboutHtml = read("about.html");
  for (const item of FAQ) {
    assert.ok(aboutHtml.includes(item.question), item.question);
    assert.ok(aboutHtml.includes(item.answer), item.question);
    const node = faq.mainEntity.find((entry) => entry.name === item.question);
    assert.equal(node.acceptedAnswer.text, item.answer);
  }
  const home = indexJsonLd();
  const types = home["@graph"].map((node) => node["@type"]);
  assert.ok(types.includes("WebApplication"));
  assert.ok(types.includes("Organization"));
  assert.ok(types.includes("Person"));
  assert.ok(types.includes("Dataset"));
  const person = home["@graph"].find((node) => node["@type"] === "Person");
  assert.equal(person.sameAs, "https://x.com/davidtphung");
  assert.equal(person.name, "David T Phung");
  const datasets = home["@graph"].filter((node) => node["@type"] === "Dataset");
  assert.ok(datasets.length >= 8);
  for (const layer of LAYERS.filter((item) => item.major && item.licenseUrl)) {
    assert.ok(datasets.some((node) => node.name === layer.name && node.license === layer.licenseUrl), layer.id);
  }
  const wildfire = datasets.find((node) => node.name === "Wildfire hazard");
  assert.equal(wildfire.license, undefined);
  assert.match(wildfire.description, /UNKNOWN/);
  for (const gap of GAPS) {
    assert.ok(read("llms.txt").includes(gap.name), gap.name);
    assert.ok(read("llms-full.txt").includes(gap.name), gap.name);
  }
  assert.match(read("llms.txt"), /NLT143 RESEARCH by David T Phung \(@davidtphung\)/);
  assert.equal(read(INDEXNOW_KEY + ".txt"), INDEXNOW_KEY);
});

test("index markers round trip", () => {
  const index = read("index.html");
  const next = replaceMarked(index, "siteline:summary", "kept");
  assert.match(next, /<!-- siteline:summary -->\nkept\n<!-- \/siteline:summary -->/);
});

test("worker keeps CSP and serves discovery text as plain text", async () => {
  const blocked = await worker.fetch(new Request("https://siteline.nlt143.energy/docs/indexnow.md"), {});
  assert.equal(blocked.status, 404);
  const env = {
    ASSETS: {
      fetch() {
        return new Response("catalog", { headers: { "Content-Type": "application/octet-stream" } });
      },
    },
  };
  const llms = await worker.fetch(new Request("https://siteline.nlt143.energy/llms.txt"), env);
  assert.equal(llms.status, 200);
  assert.equal(llms.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(llms.headers.get("cache-control"), "no-cache");
  const csp = llms.headers.get("content-security-policy");
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.equal(csp.includes("unsafe-eval"), false);
  const source = read("worker.js");
  const literal = source.slice(source.indexOf("const CSP = ["), source.indexOf("].join("));
  assert.ok(literal.includes("default-src 'self'"));
  assert.equal(source.includes("unsafe-eval"), false);
  const about = await worker.fetch(new Request("https://siteline.nlt143.energy/about"), env);
  assert.equal(about.headers.get("cache-control"), "no-cache");
  assert.equal(about.headers.get("content-security-policy"), csp);
});

/** Render crawlable Siteline text from the catalog. ASCII punctuation only. */

import {
  CRAWLER_AGENTS,
  CREDIT,
  FAQ,
  GAPS,
  INDEXNOW_KEY,
  LASTMOD,
  LAYERS,
  ORG,
  ORIGIN,
  PERSON,
  REGIONS,
  mapHref,
  placePath,
} from "./site-catalog.mjs";

export function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonScript(data) {
  return JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
}

function abs(path) {
  if (!path) return ORIGIN + "/";
  if (path.startsWith("http")) return path;
  return ORIGIN + (path.startsWith("/") ? path : "/" + path);
}

function majorLayers() {
  return LAYERS.filter((layer) => layer.major);
}

export function pageShell({ title, description, path, body, jsonLd }) {
  const url = abs(path);
  const image = ORIGIN + "/og-image.png?v=2";
  const ld = jsonLd
    ? `<script type="application/ld+json">\n${jsonScript(jsonLd)}\n</script>\n`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${esc(url)}" />
  <meta name="theme-color" content="#05070a" />
  <meta name="color-scheme" content="dark" />
  <link rel="icon" href="/favicon.ico" sizes="32x32" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Siteline" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(url)}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="en_US" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="twitter:creator" content="@davidtphung" />
  <link rel="alternate" type="text/plain" href="${ORIGIN}/llms.txt" title="Siteline for language models" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap" />
  <link rel="stylesheet" href="/assets/static-page.css" />
  ${ld}</head>
<body>
  <a class="skip" href="#content">Skip to content</a>
  <header class="top">
    <a class="brand" href="/">Siteline</a>
    <nav aria-label="Pages">
      <a href="/about">About</a>
      <a href="/regions">Regions</a>
      <a href="/well-methodology">Wells</a>
      <a href="/llms.txt">llms.txt</a>
    </nav>
  </header>
  <main id="content">
${body}
  </main>
  <footer>
    <p>${esc(CREDIT)}. <a href="${esc(PERSON.sameAs)}">x.com/davidtphung</a></p>
    <p>Screening map only. UNKNOWN means the layer does not carry that fact.</p>
  </footer>
</body>
</html>
`;
}

function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": ORIGIN + "/#website",
    name: "Siteline",
    url: ORIGIN + "/",
    description: "Pin a site. Read power, grid, fiber, water, gas wells, and flood layers. Every layer names its source.",
    publisher: { "@id": ORG.id },
  };
}

function orgNode() {
  return {
    "@type": "Organization",
    "@id": ORG.id,
    name: ORG.name,
    url: ORIGIN + "/",
    founder: { "@id": PERSON.id },
  };
}

function personNode() {
  return {
    "@type": "Person",
    "@id": PERSON.id,
    name: PERSON.name,
    sameAs: PERSON.sameAs,
    affiliation: { "@id": ORG.id },
  };
}

function datasetNode(layer) {
  const node = {
    "@type": "Dataset",
    "@id": ORIGIN + "/#dataset-" + layer.id,
    name: layer.name,
    description: layer.summary + " " + layer.limitation,
    creator: { "@type": "Organization", name: layer.sourceName },
    isAccessibleForFree: true,
    spatialCoverage: { "@type": "Place", name: "United States" },
    includedInDataCatalog: { "@id": ORIGIN + "/#catalog" },
  };
  if (layer.sourceUrl) node.url = layer.sourceUrl;
  if (layer.catalogUrl) node.citation = layer.catalogUrl;
  if (layer.licenseUrl) node.license = layer.licenseUrl;
  return node;
}

export function indexJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      websiteNode(),
      orgNode(),
      personNode(),
      {
        "@type": "DataCatalog",
        "@id": ORIGIN + "/#catalog",
        name: "Siteline layer catalog",
        url: ORIGIN + "/llms-full.txt",
        description: "Public layers Siteline draws, each with the source Siteline actually requests.",
        publisher: { "@id": ORG.id },
      },
      {
        "@type": "WebApplication",
        "@id": ORIGIN + "/#app",
        name: "Siteline",
        url: ORIGIN + "/",
        applicationCategory: "Geographic information system",
        operatingSystem: "Web",
        browserRequirements: "JavaScript for the interactive map. Text pages do not require JavaScript.",
        isAccessibleForFree: true,
        description:
          "Pin a site in a US region and read power, grid, fiber, water, gas wells, and flood layers. Every layer names its public source. Live MW load, interconnection headroom, transformer MVA, as-built fiber, title, zoning, and wildfire hazard stay UNKNOWN.",
        creator: { "@id": ORG.id },
        author: { "@id": PERSON.id },
        featureList: LAYERS.map((layer) => layer.name),
      },
      ...majorLayers().map(datasetNode),
    ],
  };
}

export function aboutJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      websiteNode(),
      orgNode(),
      personNode(),
      {
        "@type": "FAQPage",
        "@id": ORIGIN + "/about#faq",
        url: ORIGIN + "/about",
        name: "About Siteline",
        isPartOf: { "@id": ORIGIN + "/#website" },
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };
}

function breadcrumb(items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: abs(item.path),
    })),
  };
}

function regionJsonLd(region) {
  const [lng, lat] = region.center;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": abs(placePath(region)) + "#page",
        url: abs(placePath(region)),
        name: region.name,
        description: region.description,
        isPartOf: { "@id": ORIGIN + "/#website" },
        about: { "@id": abs(placePath(region)) + "#place" },
      },
      {
        "@type": "Place",
        "@id": abs(placePath(region)) + "#place",
        name: region.name,
        geo: {
          "@type": "GeoCoordinates",
          latitude: lat,
          longitude: lng,
        },
      },
      breadcrumb([
        { name: "Siteline", path: "/" },
        { name: "Regions", path: "/regions" },
        { name: region.name, path: placePath(region) },
      ]),
    ],
  };
}

function gapsList() {
  return GAPS.map((gap) => `      <li><strong>${esc(gap.name)}.</strong> ${esc(gap.detail)}</li>`).join("\n");
}

function layerRows() {
  return LAYERS.map((layer) => {
    const source = layer.sourceUrl
      ? `<a href="${esc(layer.sourceUrl)}">${esc(layer.sourceName)}</a>`
      : esc(layer.sourceName);
    const license = layer.licenseUrl
      ? `<a href="${esc(layer.licenseUrl)}">${esc(layer.licenseName)}</a>`
      : esc(layer.licenseName);
    return `      <tr>
        <td>${esc(layer.group)}</td>
        <td>${esc(layer.name)}</td>
        <td><span class="chip">${esc(layer.honesty)}</span></td>
        <td>${source}</td>
        <td>${license}</td>
        <td>${esc(layer.limitation)}</td>
      </tr>`;
  }).join("\n");
}

export function renderAbout() {
  const faq = FAQ.map(
    (item) => `    <section class="faq">
      <h2>${esc(item.question)}</h2>
      <p>${esc(item.answer)}</p>
    </section>`,
  ).join("\n");
  const regions = REGIONS.map(
    (region) =>
      `      <li><a href="${esc(placePath(region))}">${esc(region.name)}</a> <a href="${esc(mapHref(region))}">Open the map</a></li>`,
  ).join("\n");
  const body = `    <p class="kicker">${esc(ORG.name)}</p>
    <h1>About Siteline</h1>
    <p class="lede">Pin a site. Read the power, grid, fiber, water, gas wells, and flood layers around it. Every layer names its source. Where the source stops, the map says UNKNOWN.</p>
    <p><a class="button" href="/">Open the map</a></p>
${faq}
    <section>
      <h2>Layer sources and licenses</h2>
      <p>The table lists each layer Siteline can draw, the honesty label used in the product, the public source, and the limit on what that source supports.</p>
      <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Group</th><th>Layer</th><th>Label</th><th>Source</th><th>License</th><th>Limit</th></tr>
        </thead>
        <tbody>
${layerRows()}
        </tbody>
      </table>
      </div>
    </section>
    <section>
      <h2>Gaps kept as UNKNOWN</h2>
      <ul>
${gapsList()}
      </ul>
    </section>
    <section>
      <h2>Preset regions</h2>
      <ul>
${regions}
      </ul>
    </section>
    <section>
      <h2>How to cite</h2>
      <p>Cite the map as Siteline, ${esc(CREDIT)}, ${ORIGIN}/. Cite a layer fact to the source named on that layer. Siteline is the viewer, not the measuring authority. Well rules are on the <a href="/well-methodology">well methodology</a> page. A plain text copy of this catalog is at <a href="/llms.txt">/llms.txt</a> and <a href="/llms-full.txt">/llms-full.txt</a>.</p>
    </section>`;
  return pageShell({
    title: "About Siteline",
    description:
      "Siteline pins a US site and reads power, grid, fiber, water, gas wells, and flood layers. Every layer names its public source. Gaps stay UNKNOWN.",
    path: "/about",
    body,
    jsonLd: aboutJsonLd(),
  });
}

function coordText(region) {
  const [lng, lat] = region.center;
  return `longitude ${lng}, latitude ${lat}, zoom ${region.zoom}`;
}

export function renderRegion(region) {
  const paras = region.paragraphs.map((paragraph) => `    <p>${esc(paragraph)}</p>`).join("\n");
  const body = `    <p class="kicker">Preset region</p>
    <h1>${esc(region.name)}</h1>
    <p class="lede">${esc(region.description)}</p>
    <p><a class="button" href="${esc(mapHref(region))}">Open this view on the map</a></p>
    <section>
      <h2>Camera</h2>
      <dl>
        <dt>Center and zoom</dt>
        <dd>${esc(coordText(region))}</dd>
        <dt>Deep link</dt>
        <dd><a href="${esc(mapHref(region))}">${esc(mapHref(region))}</a></dd>
        <dt>Coordinate form</dt>
        <dd><a href="/?lat=${region.center[1]}&amp;lng=${region.center[0]}&amp;z=${region.zoom}">/?lat=${region.center[1]}&amp;lng=${region.center[0]}&amp;z=${region.zoom}</a></dd>
      </dl>
    </section>
    <section>
      <h2>What the layers support here</h2>
${paras}
    </section>
    <section>
      <h2>Not on this map</h2>
      <ul>
${gapsList()}
      </ul>
      <p>More on the sources: <a href="/about">About Siteline</a>. Well rules: <a href="/well-methodology">Well methodology</a>.</p>
    </section>`;
  return pageShell({
    title: region.name + " | Siteline",
    description: region.description,
    path: placePath(region),
    body,
    jsonLd: regionJsonLd(region),
  });
}

export function renderRegionsIndex() {
  const items = REGIONS.map((region) => {
    return `    <article>
      <h2><a href="${esc(placePath(region))}">${esc(region.name)}</a></h2>
      <p>${esc(region.description)}</p>
      <p>Camera: ${esc(coordText(region))}. <a href="${esc(mapHref(region))}">Open the map</a>.</p>
    </article>`;
  }).join("\n");
  const body = `    <p class="kicker">Preset regions</p>
    <h1>Open the map on a preset</h1>
    <p class="lede">Four cameras ship with Siteline. Each page states only what the public layers support. None of them states a megawatt load, a transformer size, a headroom figure, a title, or a well count for the view.</p>
${items}`;
  return pageShell({
    title: "Siteline preset regions",
    description:
      "Preset Siteline views: Ashburn, Abilene, the Permian and southeast New Mexico, and Carlsbad. Each page states only what the public layers support.",
    path: "/regions",
    body,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          "@id": ORIGIN + "/regions#page",
          url: ORIGIN + "/regions",
          name: "Siteline preset regions",
          isPartOf: { "@id": ORIGIN + "/#website" },
        },
        breadcrumb([
          { name: "Siteline", path: "/" },
          { name: "Regions", path: "/regions" },
        ]),
      ],
    },
  });
}

function layerLine(layer) {
  const source = layer.sourceUrl || "UNKNOWN";
  const license = layer.licenseUrl || "UNKNOWN";
  return `- ${layer.name} (${layer.honesty}). Source: ${layer.sourceName}, ${source}. License: ${layer.licenseName}, ${license}. ${layer.summary} ${layer.limitation}`;
}

export function renderLlms() {
  const regions = REGIONS.map(
    (region) =>
      `- [${region.name}](${abs(placePath(region))}): camera ${coordText(region)}. Map: ${abs(mapHref(region))}.`,
  ).join("\n");
  const gaps = GAPS.map((gap) => `- ${gap.name}: ${gap.detail}`).join("\n");
  return `# Siteline

> Pin a site in a US region and read power, grid, fiber, water, gas wells, and flood layers. Every layer names its public source. Where the source stops, Siteline says UNKNOWN.

Siteline is a public screening map from ${CREDIT}. It is not a title search, a capacity study, or an environmental opinion. The interactive map is a JavaScript application. This file, /about, and the region pages are the crawlable text.

The map is ${ORIGIN}/.

## How to use

- Open ${ORIGIN}/ and pin a site, or search. Place search uses OpenStreetMap Nominatim, then Photon. It is approximate, not a survey pin.
- Read the layer card. The card names the source.
- Open a preset with a query parameter: ${ORIGIN}/?place=ashburn (also abilene, permian, carlsbad).
- Aliases: nova and loudoun open Ashburn. senm and se-nm open the Permian window.
- Or pass coordinates: ${ORIGIN}/?lat=39.04&lng=-77.49&z=9.5. If lat and lng are both set, they override place.

## Preset regions

${regions}

## What Siteline will not invent

${gaps}

## Sources, short

- Power lines, substations, retail territories: HIFLD. https://hifld-geoplatform.opendata.arcgis.com/
- Plant nameplate and natural gas pipelines: EIA. https://www.eia.gov/maps/layer_info-m.php
- Broadband availability: FCC Broadband Data Collection. https://broadbandmap.fcc.gov/
- Hydrography: USGS National Hydrography Dataset. https://www.usgs.gov/national-hydrography
- Flood: FEMA National Flood Hazard Layer. https://www.fema.gov/flood-maps
- Gas wells: state regulators, including the Texas Railroad Commission, Virginia Energy, and NM EMNRD OCD. Manifest: ${ORIGIN}/tiles/gaswells-manifest.json
- NETL wells: optional catalog, not Texas status authority. https://edx.netl.doe.gov/
- Mapped power, telecom, subsea cables, and data centers: OpenStreetMap via OpenInfraMap and Overpass. https://openinframap.org/ and https://www.openstreetmap.org/copyright
- Wildfire hazard: UNKNOWN. The row is not wired.

## Cite

Siteline, ${CREDIT}, ${ORIGIN}/. Cite a layer fact to the source named on that layer.

## Optional

- [Full layer catalog](${ORIGIN}/llms-full.txt)
- [About](${ORIGIN}/about)
- [Well methodology](${ORIGIN}/well-methodology)
- [Preset regions](${ORIGIN}/regions)
`;
}

export function renderLlmsFull() {
  const layers = LAYERS.map(layerLine).join("\n");
  const gaps = GAPS.map((gap) => `- ${gap.name}: ${gap.detail}`).join("\n");
  const regions = REGIONS.map((region) => {
    const body = region.paragraphs.join("\n\n");
    return `## ${region.name}\n\nCamera: ${coordText(region)}.\nText: ${abs(placePath(region))}\nMap: ${abs(mapHref(region))}\n\n${body}`;
  }).join("\n\n");
  return `# Siteline, full layer catalog

> ${CREDIT}. Screening map at ${ORIGIN}/. This file is the long public description for answer engines. It does not add measurements that are not in the layers.

Siteline pins a site and draws public infrastructure layers. The honesty labels in the product are CATALOG, OSM_MAPPED, DEM-derived, LIVE, RRC, and UNKNOWN.

Texas wells are map symbol status only. The headline is Status not confirmed (RRC map symbol). Producing status is not confirmed. Inactive is not abandoned. Orphan is not abandoned. Historical and missing status are not abandoned. Plugged and abandoned is confirmed only with explicit official evidence. Well proximity is not gas deliverability, capacity, pressure, or service. Well proximity is not oil liability. EIA natural gas pipelines are public pipeline context, separate from wells.

A state with no verified gas well feed is labeled "No public wells feed wired for this state yet" and hatched. The hatch is not a count of zero wells.

## Every layer

${layers}

## UNKNOWN gaps

${gaps}

## Preset regions

${regions}

## Use

Open ${ORIGIN}/. Presets: place=ashburn, place=abilene, place=permian, place=carlsbad. Coordinates: lat, lng, and z. If lat and lng are both present they override place.

Well methodology: ${ORIGIN}/well-methodology

Cite Siteline, ${CREDIT}, ${ORIGIN}/. Cite layer facts to the source URL on that layer.
`;
}

export function renderSitemap() {
  const paths = ["/", "/about", "/regions", "/well-methodology", "/llms.txt", "/llms-full.txt", ...REGIONS.map(placePath)];
  const urls = paths
    .map(
      (path) => `  <url>
    <loc>${abs(path)}</loc>
    <lastmod>${LASTMOD}</lastmod>
  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function renderRobots() {
  const groups = CRAWLER_AGENTS.map((agent) => `User-agent: ${agent}\nAllow: /`).join("\n\n");
  return `# Siteline is public. User-agent * allows every client.
# The groups below repeat that allow for answer engine crawlers.
# xAI has not published an official robots token. Grok, GrokBot, xAI, and xAI-Grok are allowed by name.
# LLM description: ${ORIGIN}/llms.txt

${groups}

User-agent: *
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`;
}

function regionItems(tabIndex) {
  const extra = tabIndex == null ? "" : ` tabindex="${tabIndex}"`;
  return REGIONS.map(
    (region) =>
      `<li><a${extra} href="${esc(placePath(region))}">${esc(region.name)}</a> (<a${extra} href="${esc(mapHref(region))}">map</a>)</li>`,
  ).join("");
}

export function renderIndexSummary() {
  const text = FAQ.map((item) => `<h2>${esc(item.question)}</h2><p>${esc(item.answer)}</p>`).join("");
  const gaps = GAPS.map((gap) => `<li>${esc(gap.name)}: ${esc(gap.detail)}</li>`).join("");
  return `    <div class="sl-crawler-summary" id="siteline-summary">
      <p>Siteline, ${esc(CREDIT)}. ${esc(ORIGIN)}/</p>
      ${text}
      <h2>Preset regions</h2>
      <ul>${regionItems(-1)}</ul>
      <h2>UNKNOWN</h2>
      <ul>${gaps}</ul>
      <p><a tabindex="-1" href="/about">About Siteline</a> <a tabindex="-1" href="/llms.txt">llms.txt</a> <a tabindex="-1" href="/llms-full.txt">llms-full.txt</a> <a tabindex="-1" href="/well-methodology">Well methodology</a></p>
    </div>
    <noscript>
      <main class="sl-noscript">
        <p class="kicker">${esc(ORG.name)}</p>
        <h1>Siteline</h1>
        <p>The interactive map needs JavaScript. The same facts are on the text pages.</p>
        ${text}
        <p><a href="/about">About Siteline</a></p>
        <ul>${regionItems()}</ul>
      </main>
    </noscript>`;
}

export function renderIndexJsonLdScript() {
  return `<script type="application/ld+json" id="siteline-jsonld">\n${jsonScript(indexJsonLd())}\n</script>`;
}

export const STATIC_FILES = {
  "llms.txt": renderLlms,
  "llms-full.txt": renderLlmsFull,
  "robots.txt": renderRobots,
  "sitemap.xml": renderSitemap,
  "about.html": renderAbout,
  "regions/index.html": renderRegionsIndex,
  ...Object.fromEntries(REGIONS.map((region) => ["regions/" + region.id + ".html", () => renderRegion(region)])),
  [INDEXNOW_KEY + ".txt"]: () => INDEXNOW_KEY,
};

export function replaceMarked(html, name, inner) {
  const pattern = new RegExp(`<!-- ${name} -->[\\s\\S]*?<!-- /${name} -->`);
  if (!pattern.test(html)) throw new Error("Missing marker " + name);
  return html.replace(pattern, `<!-- ${name} -->\n${inner}\n<!-- /${name} -->`);
}

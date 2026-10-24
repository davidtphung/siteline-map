/**
 * Public facts for crawlable Siteline pages.
 * Coordinates match the map preset chips. No parcel, MW, MVA, or headroom claims.
 * NLT143 RESEARCH by David T Phung.
 */

export const ORIGIN = "https://siteline.nlt143.energy";
export const LASTMOD = "2026-10-24";
export const INDEXNOW_KEY = "bc08844cf5b5a04d130d728582cf137a";

export const PERSON = {
  id: ORIGIN + "/#david",
  name: "David T Phung",
  sameAs: "https://x.com/davidtphung",
  handle: "@davidtphung",
};

export const ORG = {
  id: ORIGIN + "/#org",
  name: "NLT143 RESEARCH",
};

export const CREDIT = "NLT143 RESEARCH by David T Phung (@davidtphung)";

export const CRAWLER_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Grok",
  "GrokBot",
  "xAI",
  "xAI-Grok",
  "Googlebot",
  "Google-Extended",
  "Bingbot",
];

const GOV = "https://www.usa.gov/government-works";
const EIA_LICENSE = "https://www.eia.gov/about/copyrights_reuse.php";
const USGS_LICENSE = "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits";
const ODBL = "https://opendatacommons.org/licenses/odbl/1-0/";

export const LAYERS = [
  {
    id: "transmission",
    group: "Power",
    name: "Transmission lines",
    summary: "High voltage transmission lines. Line weight follows voltage when the source has kV. The line is grey-amber when kV is missing.",
    honesty: "CATALOG",
    sourceName: "HIFLD",
    sourceUrl: "https://services2.arcgis.com/LYMgRMwHfrWWEg3s/arcgis/rest/services/HIFLD_US_Electric_Power_Transmission_Lines/FeatureServer",
    catalogUrl: "https://hifld-geoplatform.opendata.arcgis.com/",
    licenseName: "US government work",
    licenseUrl: GOV,
    limitation: "Not live load and not interconnection headroom.",
    major: true,
  },
  {
    id: "substations",
    group: "Power",
    name: "Substations",
    summary: "Electric substations from the HIFLD catalog.",
    honesty: "CATALOG",
    sourceName: "HIFLD",
    sourceUrl: "https://services.arcgis.com/njFNhDsUCentVYJW/ArcGIS/rest/services/Substations/FeatureServer",
    catalogUrl: "https://hifld-geoplatform.opendata.arcgis.com/",
    licenseName: "US government work",
    licenseUrl: GOV,
    limitation: "Transformer MVA is not in this layer. It stays UNKNOWN.",
    major: true,
  },
  {
    id: "plants",
    group: "Power",
    name: "Power plants",
    summary: "US power plants. The megawatt field is EIA catalog nameplate.",
    honesty: "CATALOG",
    sourceName: "EIA",
    sourceUrl: "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Power_Plants_in_the_US/FeatureServer",
    catalogUrl: "https://www.eia.gov/maps/layer_info-m.php",
    licenseName: "EIA public domain",
    licenseUrl: EIA_LICENSE,
    limitation: "Nameplate is not live output, not interconnection, and not the pinned site's draw.",
    major: true,
  },
  {
    id: "territories",
    group: "Power",
    name: "Electric retail service territories",
    summary: "Which utility sells retail power in an area. Service areas can lag.",
    honesty: "CATALOG",
    sourceName: "HIFLD public copy",
    sourceUrl: "https://services3.arcgis.com/OYP7N6mAJJCyH6hd/ArcGIS/rest/services/Electric_Retail_Service_Territories_HIFLD/FeatureServer/0",
    catalogUrl: "https://hifld-geoplatform.opendata.arcgis.com/",
    licenseName: "US government work",
    licenseUrl: GOV,
    limitation: "A territory is not a contract and not available capacity.",
    major: true,
  },
  {
    id: "oim-power",
    group: "Power",
    name: "OpenInfraMap power lines and substations",
    summary: "Power lines and substations mapped in OpenStreetMap and drawn by OpenInfraMap.",
    honesty: "OSM_MAPPED",
    sourceName: "OpenInfraMap / OpenStreetMap",
    sourceUrl: "https://openinframap.org/",
    catalogUrl: "https://www.openstreetmap.org/copyright",
    licenseName: "Open Database License",
    licenseUrl: ODBL,
    limitation: "Mapped by OpenStreetMap contributors. Not an as-built utility record.",
    major: true,
  },
  {
    id: "caiso",
    group: "Power",
    name: "CAISO system demand",
    summary: "Current CAISO system demand from the public outlook CSV. The brief requests it only when the nearest EIA plant state is California.",
    honesty: "LIVE",
    sourceName: "CAISO",
    sourceUrl: "https://www.caiso.com/outlook/current/systemstatus.csv",
    catalogUrl: "https://www.caiso.com/outlook/current",
    licenseName: "See the CAISO outlook page",
    licenseUrl: "https://www.caiso.com/outlook/current",
    limitation: "System demand for CAISO. Not the pinned site's MW draw. Texas shows an ERCOT label only as a proxy from a Texas plant state, and that path does not fetch live demand.",
    major: false,
  },
  {
    id: "bdc",
    group: "Fiber and broadband",
    name: "FCC broadband availability",
    summary: "Broadband service reported by location in the FCC Broadband Data Collection, December 2024 view.",
    honesty: "CATALOG",
    sourceName: "FCC BDC",
    sourceUrl: "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/FCC_Broadband_Data_Collection_December_2024_View/FeatureServer",
    catalogUrl: "https://broadbandmap.fcc.gov/",
    licenseName: "US government work",
    licenseUrl: GOV,
    limitation: "Reported availability. Not as-built fiber.",
    major: true,
  },
  {
    id: "oim-telecom",
    group: "Fiber and broadband",
    name: "OpenInfraMap telecom",
    summary: "Telecom lines mapped in OpenStreetMap and drawn by OpenInfraMap.",
    honesty: "OSM_MAPPED",
    sourceName: "OpenInfraMap / OpenStreetMap",
    sourceUrl: "https://openinframap.org/",
    catalogUrl: "https://www.openstreetmap.org/copyright",
    licenseName: "Open Database License",
    licenseUrl: ODBL,
    limitation: "Not an as-built fiber route or splice record.",
    major: true,
  },
  {
    id: "subsea",
    group: "Fiber and broadband",
    name: "Subsea cables",
    summary: "Communication lines in OpenStreetMap with location underwater, drawn from OpenInfraMap tiles.",
    honesty: "OSM_MAPPED",
    sourceName: "OpenInfraMap / OpenStreetMap",
    sourceUrl: "https://openinframap.org/",
    catalogUrl: "https://www.openstreetmap.org/copyright",
    licenseName: "Open Database License",
    licenseUrl: ODBL,
    limitation: "A mapped cable is not a landing-station contract or a lit capacity.",
    major: true,
  },
  {
    id: "nhd",
    group: "Water",
    name: "NHD flowlines and waterbodies",
    summary: "Rivers, streams, and waterbodies from the National Hydrography Dataset. Flowlines are National Map layer 6. Waterbodies are layer 12.",
    honesty: "CATALOG",
    sourceName: "USGS NHD",
    sourceUrl: "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer",
    catalogUrl: "https://www.usgs.gov/national-hydrography",
    licenseName: "USGS public domain",
    licenseUrl: USGS_LICENSE,
    limitation: "Hydrography is not a water right and not a withdrawal volume.",
    major: true,
  },
  {
    id: "nwis",
    group: "Water",
    name: "USGS streamflow",
    summary: "Instantaneous streamflow, parameter 00060, when the National Water Information System returns a gage in the search window.",
    honesty: "LIVE",
    sourceName: "USGS NWIS",
    sourceUrl: "https://waterservices.usgs.gov/nwis/iv/",
    catalogUrl: "https://waterservices.usgs.gov/",
    licenseName: "USGS public domain",
    licenseUrl: USGS_LICENSE,
    limitation: "A gage reading is not a water right. Data center withdrawal volume is UNKNOWN.",
    major: false,
  },
  {
    id: "gas-wells",
    group: "Oil and gas wells",
    name: "State regulator gas wells",
    summary: "Nationwide natural gas wells from each state's public regulator feed, drawn from vector tiles. The card reads the manifest for the state under the map: agency, coverage, and source date. Coverage is live full status, partial status, or file snapshot. A state with no verified feed is hatched and labeled. The hatch is not a count of zero wells.",
    honesty: "CATALOG",
    sourceName: "State oil and gas agencies",
    sourceUrl: ORIGIN + "/tiles/gaswells-manifest.json",
    catalogUrl: ORIGIN + "/well-methodology",
    licenseName: "Public agency records. Terms are on each state source.",
    licenseUrl: ORIGIN + "/well-methodology",
    limitation: "Well proximity is not gas deliverability, capacity, pressure, or service. Counts on a state row are statewide feed counts, not a preset-window count.",
    major: true,
  },
  {
    id: "rrc",
    group: "Oil and gas wells",
    name: "Texas RRC wells",
    summary: "Texas wells come from Railroad Commission of Texas GIS map symbols. The manifest classifies Texas as partial status. The headline status is Status not confirmed (RRC map symbol). Producing status is not confirmed. The layer has no operator and no dates. Data as of stays UNKNOWN until the source file carries a refresh date.",
    honesty: "RRC",
    sourceName: "Railroad Commission of Texas",
    sourceUrl: "https://gis.rrc.texas.gov/server/rest/services/rrc_public/RRC_Public_Viewer_Srvs/MapServer/1",
    catalogUrl: "https://www.rrc.texas.gov/resource-center/research/data-sets-available-for-download/",
    licenseName: "Texas RRC public GIS. See the download page.",
    licenseUrl: "https://www.rrc.texas.gov/resource-center/research/data-sets-available-for-download/",
    limitation: "NETL, HIFLD, New Mexico OCD, and Colorado OGCC are not the status authority for a Texas well. Inactive is not abandoned. A plugged map symbol alone is not confirmed plugged and abandoned.",
    major: true,
  },
  {
    id: "nm-ocd",
    group: "Oil and gas wells",
    name: "New Mexico OCD wells",
    summary: "Public wells from the NM EMNRD Oil Conservation Division OCDView service. The manifest classifies this feed as live full status and records the source date 2026-08-01.",
    honesty: "CATALOG",
    sourceName: "NM EMNRD Oil Conservation Division",
    sourceUrl: "https://gis.emnrd.nm.gov/arcgis/rest/services/OCDView/Wells_Public/FeatureServer/0",
    catalogUrl: "https://www.emnrd.nm.gov/ocd/",
    licenseName: "New Mexico public GIS. See the agency service.",
    licenseUrl: "https://gis.emnrd.nm.gov/arcgis/rest/services/OCDView/Wells_Public/FeatureServer/0",
    limitation: "This is not the status authority for a Texas well. This page does not state a well count.",
    major: true,
  },
  {
    id: "co-ecmc",
    group: "Oil and gas wells",
    name: "Colorado ECMC wells",
    summary: "Colorado public wells. Commodity is unconfirmed on this layer. Status dates in the product run through 2025-03-26.",
    honesty: "CATALOG",
    sourceName: "Colorado ECMC",
    sourceUrl: "https://data.dnrgis.state.co.us/arcgis/rest/services/DNR_Public/OGCC_Wells/FeatureServer/0",
    catalogUrl: "https://ecmc.state.co.us/documents/data/downloads/gis/WELLS_SHP.ZIP",
    licenseName: "Colorado public GIS. See the agency download.",
    licenseUrl: "https://ecmc.state.co.us/",
    limitation: "Not the status authority for a Texas well.",
    major: true,
  },
  {
    id: "va-dgo",
    group: "Oil and gas wells",
    name: "Virginia gas wells",
    summary: "Virginia wells from Virginia Energy, Division of Gas and Oil. The manifest classifies this statewide feed as live full status and records the source date 2026-09-22.",
    honesty: "CATALOG",
    sourceName: "Virginia Energy, Division of Gas and Oil",
    sourceUrl: "https://energy.virginia.gov/gis/rest/services/DGO/DGO_wells/FeatureServer/0",
    catalogUrl: "https://energy.virginia.gov/",
    licenseName: "Virginia public GIS. See the agency service.",
    licenseUrl: "https://energy.virginia.gov/gis/rest/services/DGO/DGO_wells/FeatureServer/0",
    limitation: "The source date describes the statewide feed, not a count of wells in Loudoun County.",
    major: true,
  },
  {
    id: "netl",
    group: "Oil and gas wells",
    name: "NETL orphaned and operating wells",
    summary: "Optional well catalogs from NETL. Orphaned wells are Hosted/Orphaned_Wells_v2. Operating wells are Hosted/Integrated_Public_Wells_AugEY25.",
    honesty: "CATALOG",
    sourceName: "NETL / DOE",
    sourceUrl: "https://edx.netl.doe.gov/",
    catalogUrl: "https://arcgis.netl.doe.gov/server/rest/services/Hosted/Orphaned_Wells_v2/FeatureServer/113",
    licenseName: "US government work",
    licenseUrl: GOV,
    limitation: "Not the status authority for a Texas well. Commodity on the orphaned catalog is not confirmed.",
    major: true,
  },
  {
    id: "pipelines",
    group: "Oil and gas wells",
    name: "Natural gas pipelines",
    summary: "Interstate and intrastate natural gas transmission lines from the EIA catalog.",
    honesty: "CATALOG",
    sourceName: "EIA",
    sourceUrl: "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Natural_Gas_Interstate_and_Intrastate_Pipelines_1/FeatureServer/0",
    catalogUrl: "https://www.eia.gov/maps/layer_info-m.php",
    licenseName: "EIA public domain",
    licenseUrl: EIA_LICENSE,
    limitation: "Public pipeline context. Not wellbores and not capacity.",
    major: true,
  },
  {
    id: "flood",
    group: "Hazards",
    name: "FEMA flood zones",
    summary: "Flood hazard zones from the National Flood Hazard Layer, public MapServer layer 28.",
    honesty: "CATALOG",
    sourceName: "FEMA",
    sourceUrl: "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28",
    catalogUrl: "https://www.fema.gov/flood-maps",
    licenseName: "US government work",
    licenseUrl: "https://www.fema.gov/about/openfema/data-sets",
    limitation: "A flood zone on this map is not an elevation certificate and not a title exception.",
    major: true,
  },
  {
    id: "wildfire",
    group: "Hazards",
    name: "Wildfire hazard",
    summary: "The wildfire row is on the layer list and switched off.",
    honesty: "UNKNOWN",
    sourceName: "UNKNOWN",
    sourceUrl: "",
    catalogUrl: "",
    licenseName: "UNKNOWN",
    licenseUrl: "",
    limitation: "No wildfire layer is attached. Wildfire hazard is UNKNOWN.",
    major: true,
  },
  {
    id: "topo",
    group: "Base and context",
    name: "Topographic basemaps",
    summary: "USGS National Map topo tiles, an Esri World Topo blend, and OpenTopoMap.",
    honesty: "CATALOG",
    sourceName: "USGS, Esri, OpenTopoMap",
    sourceUrl: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer",
    catalogUrl: "https://opentopomap.org/",
    licenseName: "USGS public domain. Esri and OpenTopoMap keep their own terms.",
    licenseUrl: USGS_LICENSE,
    limitation: "Context imagery. Not a boundary survey.",
    major: false,
  },
  {
    id: "contours",
    group: "Base and context",
    name: "Elevation contours",
    summary: "Isolines derived from AWS Terrain Tiles (Terrarium DEM) with maplibre-contour. Contours are hidden below zoom 12.",
    honesty: "DEM-derived",
    sourceName: "AWS Terrain Tiles / maplibre-contour",
    sourceUrl: "https://registry.opendata.aws/terrain-tiles/",
    catalogUrl: "https://github.com/onthegomap/maplibre-contour",
    licenseName: "Source-dependent attribution on the Tilezen joerd page",
    licenseUrl: "https://github.com/tilezen/joerd/blob/master/docs/attribution.md",
    limitation: "DEM-derived. Not a survey.",
    major: false,
  },
  {
    id: "epqs",
    group: "Base and context",
    name: "USGS elevation point",
    summary: "Elevation in feet for one point from the USGS Elevation Point Query Service.",
    honesty: "LIVE",
    sourceName: "USGS EPQS",
    sourceUrl: "https://epqs.nationalmap.gov/v1/json",
    catalogUrl: "https://epqs.nationalmap.gov/v1/json",
    licenseName: "USGS public domain",
    licenseUrl: USGS_LICENSE,
    limitation: "A point elevation is not a survey and not a flood elevation certificate.",
    major: false,
  },
  {
    id: "datacenters",
    group: "Base and context",
    name: "OSM data centers",
    summary: "Points OpenStreetMap has tagged as data centers, from Overpass.",
    honesty: "OSM_MAPPED",
    sourceName: "OpenStreetMap",
    sourceUrl: "https://overpass-api.de/api/interpreter",
    catalogUrl: "https://www.openstreetmap.org/copyright",
    licenseName: "Open Database License",
    licenseUrl: ODBL,
    limitation: "Partial crowd-sourced catalog. Not a complete inventory and not a capacity.",
    major: true,
  },
];

export const GAPS = [
  {
    name: "Live MW load",
    detail: "Megawatts on a plant are EIA catalog nameplate. They are not live output and not the pinned site's draw. When the nearest plant state is California, the brief may show CAISO system demand from the public CSV. That figure is the CAISO system, not the site. Other ISOs are not fetched.",
  },
  {
    name: "Interconnection headroom",
    detail: "No queue, deliverability, or headroom layer is wired.",
  },
  {
    name: "Transformer MVA",
    detail: "HIFLD substations on this map do not include transformer MVA.",
  },
  {
    name: "As-built fiber",
    detail: "FCC BDC is reported broadband availability. OpenInfraMap telecom is OpenStreetMap. Neither is an as-built splice record.",
  },
  {
    name: "Title and zoning",
    detail: "Siteline is not a title search and not a zoning determination.",
  },
  {
    name: "Wildfire hazard",
    detail: "The wildfire row is labeled UNKNOWN. No wildfire layer is attached.",
  },
];

export const FAQ = [
  {
    question: "What is Siteline?",
    answer:
      "Siteline is a public screening map. You pin a site in the United States and read the power, grid, fiber, water, gas wells, and flood layers around it. Every layer names its public source. Where the source stops, Siteline says UNKNOWN. It is not a title search, a capacity study, or an environmental opinion. Siteline is from NLT143 RESEARCH by David T Phung (@davidtphung).",
  },
  {
    question: "Which layers can I read?",
    answer:
      "The map can show HIFLD transmission lines, HIFLD substations, HIFLD electric retail service territories, EIA power plants at catalog nameplate, OpenInfraMap power lines, FCC Broadband Data Collection availability, OpenInfraMap telecom, OpenStreetMap subsea cables, National Hydrography Dataset flowlines and waterbodies, USGS streamflow when a gage is returned, state regulator gas wells, Texas Railroad Commission wells, NETL orphaned and operating wells, New Mexico OCD wells, Colorado ECMC wells, Virginia Energy gas wells, EIA natural gas pipelines, FEMA flood zones, topographic basemaps, DEM-derived contours, a USGS elevation point, and OpenStreetMap data center points. The wildfire row is on the list and switched off. It is UNKNOWN because no wildfire layer is attached.",
  },
  {
    question: "Where do the layers come from?",
    answer:
      "Transmission, substations, and retail service territories come from HIFLD. Power plant nameplate and natural gas pipelines come from EIA. Broadband availability comes from the FCC Broadband Data Collection. Hydrography comes from the USGS National Hydrography Dataset on the National Map. Flood zones come from the FEMA National Flood Hazard Layer. Gas wells come from state regulators, including the Railroad Commission of Texas, Virginia Energy, and the New Mexico EMNRD Oil Conservation Division. NETL is an optional well catalog and is not the status authority for a Texas well. OpenInfraMap power and telecom are OpenStreetMap features, not as-built records. Source and license URLs are listed on this page and in the full LLM text.",
  },
  {
    question: "What does Siteline leave as UNKNOWN?",
    answer:
      "Live MW load at the pin, interconnection headroom, transformer MVA, as-built fiber, title, zoning, and wildfire hazard. Plant megawatts are EIA catalog nameplate, not live output and not the site draw. A CAISO figure, when shown, is CAISO system demand, not the site. HIFLD substations on this map do not include transformer MVA. FCC BDC is reported availability, not an as-built fiber map.",
  },
  {
    question: "How do I use Siteline?",
    answer:
      "Open the map. Search for a place or pin a point. Place search uses OpenStreetMap Nominatim, then Photon if that fails. The result is approximate, not a survey pin. Turn layers on in the tray and read the card. Each card names the source. You can also open a preset view for Ashburn and Loudoun County in Virginia, Abilene in Texas, the Permian Basin and southeast New Mexico, or Carlsbad in New Mexico. Each preset has a text page and a deep link such as /?place=ashburn. The same camera accepts latitude, longitude, and zoom query parameters. If lat and lng are both set, they override place.",
  },
];

export const REGIONS = [
  {
    id: "ashburn",
    aliases: ["nova", "loudoun"],
    name: "Ashburn and Loudoun County, Virginia",
    nav: "Ashburn, VA",
    description:
      "Preset map of Ashburn and Loudoun County, Virginia. National power, broadband, water, and flood catalogs, plus the Virginia gas well feed. Gaps stay UNKNOWN.",
    center: [-77.49, 39.04],
    zoom: 9.5,
    paragraphs: [
      "This is the Ashburn and Loudoun County, Virginia preset. The map opens at longitude -77.49, latitude 39.04, zoom 9.5. Those are the camera values used by the preset chips. They are not a parcel corner and not a surveyed site pin.",
      "Power lines and substations in the view come from HIFLD. Plant points come from the EIA catalog and show nameplate, not live output. Retail electric service territories come from the HIFLD public copy. Broadband shading comes from FCC Broadband Data Collection reported availability. Telecom lines and extra power lines come from OpenInfraMap, which draws OpenStreetMap and is not as-built fiber. Water lines and waterbodies come from the National Hydrography Dataset. Flood zones come from the FEMA National Flood Hazard Layer. Data center points appear only where OpenStreetMap has mapped them. A point on that layer is not a capacity and not a complete inventory.",
      "Gas wells in Virginia come from Virginia Energy, Division of Gas and Oil. The wells manifest classifies that statewide feed as live full status and records the source date 2026-09-22. That class and that date describe the statewide feed. They are not a count of wells in Loudoun County. This page does not state a well count.",
      "The site brief has no free national balancing authority polygon. The ISO hint is a named proxy only when the nearest EIA plant state is California, Texas, or New York. Virginia is not one of those three. Unless a nearer plant falls in one of them, the ISO hint stays UNKNOWN. Live site load stays UNKNOWN either way.",
    ],
  },
  {
    id: "abilene",
    aliases: [],
    name: "Abilene, Texas",
    nav: "Abilene, TX",
    description:
      "Preset map of Abilene, Texas. HIFLD power, EIA pipelines, and Texas RRC map symbol wells. Producing status is not confirmed. Site load stays UNKNOWN.",
    center: [-99.73, 32.45],
    zoom: 9.5,
    paragraphs: [
      "This is the Abilene, Texas preset. The map opens at longitude -99.73, latitude 32.45, zoom 9.5. Those are the camera values used by the preset chips. They are not a parcel corner and not a surveyed site pin.",
      "Texas wells in the nationwide layer come from Railroad Commission of Texas GIS map symbols. The wells manifest classifies Texas as partial status. The headline status is Status not confirmed (RRC map symbol). Producing status is not confirmed. This layer has no operator and no dates. Data as of stays UNKNOWN until the source file carries a refresh date. NETL, HIFLD, New Mexico OCD, and Colorado OGCC are not the status authority for a Texas well. Inactive is not abandoned. A plugged map symbol alone is not confirmed plugged and abandoned.",
      "EIA natural gas pipelines are a separate catalog layer. They are public pipeline context. They are not wellbores and not pipeline capacity.",
      "If the nearest EIA plant in the brief is in Texas, the balancing authority hint reads ERCOT (PROXY from nearest EIA plant state). That hint is a proxy from the plant state. It is not proof of interconnection. Live ERCOT demand is not fetched. Live site load stays UNKNOWN. Power, broadband, water, and flood layers are the same national catalogs used on the rest of the map.",
    ],
  },
  {
    id: "permian",
    aliases: ["senm", "se-nm"],
    name: "Permian Basin and southeast New Mexico",
    nav: "Permian and SE New Mexico",
    description:
      "Preset map window on the Permian Basin and southeast New Mexico. Texas RRC and New Mexico OCD wells, plus the national power, water, and flood catalogs.",
    center: [-103.7, 32.4],
    zoom: 9,
    paragraphs: [
      "This is the Permian Basin and southeast New Mexico preset. The map opens at longitude -103.7, latitude 32.4, zoom 9. The camera is a screening window. It is not a surveyed basin outline and not a parcel.",
      "The window covers ground in Texas and in New Mexico, so two well authorities can appear. On the Texas side, status is the Railroad Commission of Texas map symbol: partial status, producing status not confirmed, no operator, no dates, and data as of UNKNOWN. NETL and the New Mexico service are not the status authority for a Texas well. On the New Mexico side, wells come from the NM EMNRD Oil Conservation Division public service. The wells manifest classifies that feed as live full status and records the source date 2026-08-01. This page does not state a well count for either state or for the view.",
      "EIA pipeline geometry is catalog context, not capacity. HIFLD power, FCC broadband, National Hydrography Dataset water, and FEMA flood zones are the same national catalogs as the rest of Siteline. Live site load, interconnection headroom, transformer MVA, as-built fiber, title, zoning, and wildfire hazard stay UNKNOWN.",
    ],
  },
  {
    id: "carlsbad",
    aliases: [],
    name: "Carlsbad, New Mexico",
    nav: "Carlsbad, NM",
    description:
      "Preset map of Carlsbad, New Mexico. New Mexico OCD public wells and the national power, water, broadband, and flood catalogs. Site load stays UNKNOWN.",
    center: [-104.228, 32.421],
    zoom: 11,
    paragraphs: [
      "This is the Carlsbad, New Mexico preset. The map opens at longitude -104.228, latitude 32.421, zoom 11. It is a closer camera on the southeast New Mexico side of the Permian preset. The coordinates are the preset chips, not a parcel corner.",
      "Wells here use the New Mexico EMNRD Oil Conservation Division public service. The wells manifest classifies that statewide feed as live full status and records the source date 2026-08-01. This page does not state a well count. Texas Railroad Commission records are not the status authority for a New Mexico well.",
      "New Mexico is not California, Texas, or New York, so the brief does not assign a named ISO proxy from the state alone. The balancing authority hint stays UNKNOWN unless the nearest EIA plant falls in one of those three states. Live site load stays UNKNOWN. Power, broadband, water, flood, and OpenStreetMap layers are the same national catalogs as the rest of Siteline.",
    ],
  },
];

export function regionById(id) {
  const key = String(id || "").trim().toLowerCase();
  if (!key) return null;
  return REGIONS.find((region) => region.id === key || region.aliases.includes(key)) || null;
}

export function placePath(region) {
  return "/regions/" + region.id;
}

export function mapHref(region) {
  return "/?place=" + region.id;
}

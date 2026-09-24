# Siteline

Public screening map from NLT143 RESEARCH by David T Phung.

Pin a site. Read the lines.

Live: https://siteline.nlt143.energy/

React app bundle is preserved (`assets/index-CxleVYPI.js`). Enhancements (OpenInfraMap overlay, Live Grid, About sources, nav) load via `assets/siteline-enhance.js` and `assets/maplibre-siteline-hook.js`.

Wells (Phases A-C, cache `?v=cards-3`): Cameron County oil and natural gas screening. Natural gas on by default. Oil, mixed, and other/unknown are independent and off. Texas RRC is the status authority. The map ships a fixture GeoJSON until `well061.zip` is loaded. Rings use EPSG:3081. Methodology: `/well-methodology.html` and `docs/well-methodology.md`. Service: `services/well-intel`.

The gas well card and the site brief (Grid HIFLD and the other brief sections) start collapsed. Each header keeps a title and a one-line summary. Place search sits over the map: OpenStreetMap Nominatim, Photon if that fails. FM, RM, SH, US, and Interstate numbers are expanded before the request. Results bias to the active well polygon or ring, otherwise to the current map view. The geocoder is approximate, not a survey pin.

Layers tray (cache `?v=cards-3`):

- Pipelines → Natural gas pipelines. EIA interstate/intrastate transmission (`Natural_Gas_Interstate_and_Intrastate_Pipelines_1`). Amber dashed. Honesty: CATALOG. No capacity or MW.
- Cables → Subsea cables. OpenInfraMap / OSM `telecoms_communication_line` with `location=underwater`. Teal dashed. Honesty: OSM_MAPPED.

Power-line clicks still rank ahead of gas and subsea. Visibility writes no-op when the value is already set.

Worker `siteline-map` serves assets and proxies `/api/kardashev/*` and `/api/caiso/*` for browser CORS.

Intel (cache `?v=intel-1`) is a collapsed card, or an Intel tab if a dock calls `window.SitelineIntel.mount(containerEl)`. A pin calls `window.SitelineIntel.onPin({ lng, lat })`. The card answers who serves the site, whether regional demand is rising, and what is still unknown before a build. Regional grid demand, not site capacity. Proximity is not deliverability.

EIA-930 hourly demand is proxied at `/api/intel/eia`. The browser never sees the key. Set it with:

```
npx wrangler secret put EIA_API_KEY
```

If `EIA_API_KEY` is missing, `/api/intel/eia` and `/api/intel/series` return HTTP 503 JSON `{ "error": "EIA key not configured" }` and the card says `EIA key not configured`. Responses cache for about 1 hour. A daily cron (`15 11 * * *` UTC) refreshes ERCO, PJM, MISO, SWPP, CISO, NYIS, and ISNE. Cameron County, TX resolves to ERCO. Ashburn, VA resolves to PJM. `/api/intel/health` reports the last refresh per source.

Daily peak snapshots need a KV binding named `INTEL_KV`. Without it, peaks are computed from the EIA series on read and labeled that way. To add the binding:

```
npx wrangler kv namespace create INTEL_KV
```

Put the printed id in `wrangler.toml` under `[[kv_namespaces]]` with `binding = "INTEL_KV"`.

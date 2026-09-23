# Siteline

Public screening map from NLT143 RESEARCH by David T Phung.

Pin a site. Read the lines.

Live: https://siteline.nlt143.energy/

React app bundle is preserved (`assets/index-CxleVYPI.js`). Enhancements (OpenInfraMap overlay, Live Grid, About sources, nav) load via `assets/siteline-enhance.js` and `assets/maplibre-siteline-hook.js`.

Wells: natural gas on by default. Oil, mixed, and other/unknown are independent and off. Texas RRC is the status authority in Texas. New Mexico OCD is the status authority in New Mexico. The map ships `data/cameron-wells.geojson` (`dataset_origin: fixture`) until a well API is set. With `?wellApi=` or `window.SITELINE_WELL_API`, the map requests `GET {wellApi}/api/wells` with the current bbox on a 400ms moveend debounce and falls back to the fixture if that call fails inside Cameron County. Rings use EPSG:3081. Methodology: `/well-methodology.html`. Service: `services/well-intel`.

```bash
cd services/well-intel
python3 -m pip install -r requirements.txt
PYTHONPATH=. python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8088
```

Open the map with `?wellApi=http://127.0.0.1:8088`. On production, set the same query parameter or `window.SITELINE_WELL_API` before `siteline-wells.js` loads. The Worker proxies `/api/wells` and `/api/health/wells` when `WELL_INTEL_ORIGIN` is set. `GET /api/health/wells` reports each source. A request without `bbox` stays on the Cameron fixture and does not download a national well set.

The gas well card and the site brief (Grid HIFLD and the other brief sections) start collapsed. Each header keeps a title and a one-line summary. Place search sits over the map: OpenStreetMap Nominatim, Photon if that fails. FM, RM, SH, US, and Interstate numbers are expanded before the request. Results bias to the active well polygon or ring, otherwise to the current map view. The geocoder is approximate, not a survey pin.

Layers tray (cache `?v=cards-3`):

- Pipelines → Natural gas pipelines. EIA interstate/intrastate transmission (`Natural_Gas_Interstate_and_Intrastate_Pipelines_1`). Amber dashed. Honesty: CATALOG. No capacity or MW.
- Cables → Subsea cables. OpenInfraMap / OSM `telecoms_communication_line` with `location=underwater`. Teal dashed. Honesty: OSM_MAPPED.

Power-line clicks still rank ahead of gas and subsea. Visibility writes no-op when the value is already set.

Worker `siteline-map` serves assets and proxies `/api/kardashev/*` and `/api/caiso/*` for browser CORS.

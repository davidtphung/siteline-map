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

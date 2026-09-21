# Siteline

Public screening map from NLT143 RESEARCH by David T Phung.

Pin a site. Read the lines.

Live: https://siteline.nlt143.energy/

React app bundle is preserved (`assets/index-CxleVYPI.js`). Enhancements (OpenInfraMap overlay, Live Grid, About sources, nav) load via `assets/siteline-enhance.js` and `assets/maplibre-siteline-hook.js`.

Layers tray (cache `?v=gas-subsea-1`):

- Pipelines → Natural gas pipelines. EIA interstate/intrastate transmission (`Natural_Gas_Interstate_and_Intrastate_Pipelines_1`). Amber dashed. Honesty: CATALOG. No capacity or MW.
- Cables → Subsea cables. OpenInfraMap / OSM `telecoms_communication_line` with `location=underwater`. Teal dashed. Honesty: OSM_MAPPED.

Power-line clicks still rank ahead of gas and subsea. Visibility writes no-op when the value is already set.

Worker `siteline-map` serves assets and proxies `/api/kardashev/*` and `/api/caiso/*` for browser CORS.

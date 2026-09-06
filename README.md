# Siteline

Public screening map from NLT143 RESEARCH by David T Phung.

Pin a site. Read the lines.

Live: https://rawcdn.githack.com/davidtphung/siteline-map/main/index.html

Source of truth: davidtphung/fluidstack-site-fit.

## OSM / OpenInfraMap (Watt A World parity)

Siteline draws OpenStreetMap power and telecom from OpenInfraMap vector tiles — the same OSM stack David’s Watt A World / Substack maps use.

Toggles (on by default):

- **Grid — OSM / OpenInfraMap (Watt A World parity)** — `power_line`, `power_substation` / `power_substation_point`, `power_plant` / `power_plant_point`, `power_tower`
- **Telecom / fiber — OSM / OpenInfraMap (Watt A World parity)** — `telecoms_communication_line`, `telecoms_mast`, `telecoms_data_center`

Tile endpoints that load (2026-09-06):

- Combined vector: `https://openinframap.org/tiles/{z}/{x}/{y}.pbf` (MapLibre-friendly; used by Siteline)
- Split vector: `https://openinframap.org/map/power/{z}/{x}/{y}.pbf` and `https://openinframap.org/map/telecoms/{z}/{x}/{y}.pbf`
- TileJSON: `https://openinframap.org/map.json`

Raster overlays `https://tiles-{a,b,c}.openinframap.org/power|telecoms/{z}/{x}/{y}.png` do not resolve (DNS). Siteline does not use them.

Existing HIFLD transmission/subs, EIA generation, FCC BDC, NHD, OSM data centers, and topo stay in place. FCC BDC remains availability-only. As-built fiber routes stay **UNKNOWN** unless OSM / OpenInfraMap has mapped a telecom line.

Note: wattaworld.davidtphung.com currently resolves to OnchainFlow, not the infra map.

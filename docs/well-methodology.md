# Well methodology

Siteline Phases A through C screen **Cameron County, Texas** oil and natural gas wells for AI data center siting. This is a screening aid. It is not a title search, a capacity study, or an environmental opinion.

## System of record

Texas Railroad Commission (RRC) records are the system of record for Texas wells. NETL, HIFLD, New Mexico OCD, and Colorado OGCC are optional context **outside Texas**. They are not status authority for a Texas well.

EIA interstate and intrastate natural gas pipelines stay **public pipeline context**, on their own layer. They are not wellbores and they are not capacity.

## Defaults

| Toggle | Default |
| --- | --- |
| Natural gas wells | On |
| Oil wells | Off |
| Mixed oil and gas | Off |
| Other / unknown | Off |

The toggles are independent. A gas count, summary, ring, export, API payload, and URL state include commodity `gas` only. Mixed wells do not fall into the gas total or the oil total. Injection, water, dry hole, and unknown sit on Other / unknown.

`GET /api/gas-wells` ignores `include_oil`, `include_mixed`, and `include_other`.

## Status

Siteline does not label inactive, historical, missing, orphan, dry hole, or a plugged map symbol as abandoned.

**Plugged & abandoned — confirmed** is used only when there is explicit official evidence:

- a plug date from statewide API, wellbore, imaged record, or plug-record source, or
- a plug document with a source URL, or
- an unambiguous P&A flag plus a linkable source URL.

The RRC map symbol for plugged oil, plugged gas, or plugged oil/gas (SYMNUM 7, 8, 10) is raw evidence. Alone, it becomes **Historical … status unconfirmed** and is marked review needed. The words "plugged" or "abandoned" in a note are not evidence.

SYMNUM 9 stays **Canceled location**. The official symbol phrase is kept on the raw field and is not the Siteline status line.

Orphan is its own status, with a commodity sublabel (natural gas, oil, oil and gas, or commodity unconfirmed). An orphan flag does not override confirmed plug evidence.

Inactive / shut-in is not abandoned. A newer schedule file wins over an older shut-in file, and the reverse. Equal timestamps become **Unknown, review needed**. A schedule newer than a plug date keeps the confirmed plug status and flags review.

Freshness uses the newest observation date. Older than 400 days is **May be stale**. Missing dates stay **Freshness unknown**. Age does not by itself turn a scheduled well into a historical well.

## Distance

Rings and polygon tests use **EPSG:3081** (NAD83 / Texas Centric Lambert), in meters, with the international mile (1609.344 m). Web Mercator is not used. Preset rings are 0.25, 0.5, 1, 5, and 10 miles, plus a custom distance.

Well proximity is not gas deliverability, capacity, pressure, or service. Well proximity is not oil liability.

## Site tools

- Upload a GeoJSON Polygon or MultiPolygon.
- Draw a polygon (click vertices, double-click or Enter to close, Escape to cancel).
- Draw a radius, then choose a preset or custom mile length.
- Sites persist in `localStorage` (`siteline.well.site.v1`) and in the URL hash. The API also accepts `POST /api/sites` and returns `/gas-context`, `/oil-context`, and `/well-context`.
- Corridor analysis around a line is deferred to v1.1.

## Cameron fixture

The map ships `data/cameron-wells.geojson`, classified from `services/well-intel/fixtures/cameron/raw_wells.json`. Every feature is `dataset_origin: fixture` and the operator is Fixture Operator. It is a layout for Harlingen-Rio Hondo, not a live RRC extract. Replace it by running the ETL against `well061.zip` and the manual CSV imports described in `docs/adapters.md`.

## Required statements

These sentences are on the map card, in `/api/methodology`, and on `/well-methodology.html`:

- Texas RRC is the system of record for Texas wells.
- NETL, HIFLD, New Mexico OCD, and Colorado OGCC are not status authority for Texas.
- Inactive is not abandoned.
- Orphan is not abandoned.
- Historical and missing status are not abandoned.
- Plugged and abandoned is confirmed only with explicit official RRC evidence.
- Well proximity is not gas deliverability, capacity, pressure, or service.
- Well proximity is not oil liability.
- EIA natural gas pipelines are public pipeline context, separate from wells.

Rules version: `2026-09-23.2` in `config/well-status-rules.json`.

## Live viewport

With `?wellApi=` or `window.SITELINE_WELL_API`, the map sends the current bbox to `GET /api/wells` and draws that response. Texas status comes from the RRC public GIS viewer. A symbol is not a schedule file and is not plug evidence. New Mexico status comes from OCD, and a plug date counts only when it is a real timestamp. Views below zoom 7 return cell counts. An empty Ashburn view is expected. NETL is not used to fill it. Without `wellApi`, the Cameron fixture remains the map layer.

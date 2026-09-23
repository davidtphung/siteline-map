# RRC adapters

Checked against the RRC download page and public MapServer on 2026-09-23.

## County well layer (system of record geometry)

- Dataset: Well Layers by County
- Page: https://www.rrc.texas.gov/resource-center/research/data-sets-available-for-download/
- MFT: https://mft.rrc.texas.gov/link/d551fb20-442e-4b67-84fa-ac3f23ecabb4
- Guide: https://www.rrc.texas.gov/media/kmld3uzj/digital-map-information-user-guide.pdf
- Cameron County RRC code **061**. The county archive is `well061.zip` (not the all-layers `Shp061.zip`).
- Read with `etl/rrc_well_layer.py`. The API field is text. Leading zeros are kept. This loader does **not** prefix state code `42`.
- Map position uses NAD83 `LAT83` / `LONG83`. NAD27 fields are preserved on the raw record when present.
- SYMNUM is an input to `config/well-status-rules.json`. It is not, by itself, a plugged-and-abandoned confirmation.

Each import stores filename, SHA-256, retrieval time, and the raw field dict.

## Statewide API join

- ASCII: https://mft.rrc.texas.gov/link/701db9a3-32b5-488d-812b-cd6ff7d0fe85
- dBase: https://mft.rrc.texas.gov/link/1eb94d66-461d-4114-93f7-b4bc04a70674
- Manual: https://www.rrc.texas.gov/media/bkyl5qvx/well-api-manual.pdf
- Join on the 8-character API string. A non-empty plug date from this file, stored as observation kind `plug_date` and source `rrc_statewide_api`, is explicit P&A evidence.

## Schedules, inactive, orphan, imaged records

G-10, W-10, and full wellbore files are published as EBCDIC. This release does not claim to parse those binaries.

Load a reviewed UTF-8 CSV through `etl/manual_csv.py`:

| Helper | Kind | Source | Meaning |
| --- | --- | --- | --- |
| `read_gas_schedule` | `schedule` | `rrc_gas_schedule` | Current gas well on RRC schedule |
| `read_oil_schedule` | `schedule` | `rrc_oil_schedule` | Current oil well on RRC schedule |
| `read_inactive_aging` | `shut_in` | `rrc_inactive_aging` | Inactive / shut-in. Not abandoned. |
| `read_orphan_list` | `orphan` | `rrc_orphan_wells` | Orphan list. Not abandoned. |
| `read_plug_documents` | `plug_document` | `rrc_imaged_record` | Needs `source_url` before it can confirm P&A. |

CSV columns: `api` (or `api_raw`), `observed_at`, optional `plug_date`, `source_url`, `commodity`, `text`, `pa_unambiguous`.

Public file pointers (not parsed here):

- Gas Well Status (26 Month G-10): https://mft.rrc.texas.gov/link/1363c373-fe71-4044-aa23-3c90cd162ff9
- Oil Well Status (26 Month W-10): https://mft.rrc.texas.gov/link/af355cae-e78b-4337-aba8-7ce57073dba3
- Full wellbore ASCII: https://mft.rrc.texas.gov/link/b070ce28-5c58-4fe2-9eb7-8b70befb7af9

## Viewer MapServer (QA only)

Service: https://gis.rrc.texas.gov/server/rest/services/rrc_public/RRC_Public_Viewer_Srvs/MapServer

| Layer | Name | Role |
| --- | --- | --- |
| 1 | Well Locations | QA geometry cross-check |
| 2 | Orphan Wells | QA cross-check |
| 4 | Injection/Disposal | QA cross-check |
| 13 | Pipelines | QA. Not the EIA public pipeline layer. |

`etl/qa_mapserver.py` builds a query URL. It does not copy symbol text into Siteline status. Do not scrape the GIS Viewer for status.

Viewer link shown on a well: https://gis.rrc.texas.gov/GISViewer/ plus the API string to search. A viewer URL is not a plug document.

## Live viewport query

`GET /api/wells` with `bbox=west,south,east,north` reads the RRC public viewer MapServer by layer name (`Well Locations`, `Orphan Wells`, `Injection/Disposal`) and, for envelopes that cross New Mexico, `NMOCD_Wells_V3` (`NMOCD_Active`, `NMOCD_Inactive`). Ids discovered on 2026-09-23 are in `config/well-sources.json`. The service resolves those names again on each process so a renamed layer is not queried under an old id.

`RAC_GM/MapServer` returned 404 on the public RRC catalog that day. `well061.zip` remains the county extract path above. It is not downloaded per map move.

A GIS SYMNUM is not a G-10 or W-10 schedule and is not plug evidence. Orphan comes only from the orphan layer. NM `plug_date` counts only when the timestamp falls in 1901 through 2100. HIFLD Open and the NASA NCCS host are not queried.

## What this ETL will not do

- Invent deliverability, pressure, or interconnect capacity.
- Treat injection-from-oil (SYMNUM 21) or water-from-gas (SYMNUM 75) as an oil or gas well.
- Use NETL, New Mexico, or Colorado feeds for a Texas status.

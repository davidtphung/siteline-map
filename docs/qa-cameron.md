# Cameron County QA

## What is live vs fixture

| Piece | State on this branch |
| --- | --- |
| County well layer `well061.zip` | Not ingested. Adapter is `etl/rrc_well_layer.py`. |
| Statewide API plug dates | Not ingested. Fixture wells `06100008`, `06100013`, and `06100024` carry plug-date observations so the rule can be tested. |
| G-10 / W-10 / inactive aging / orphan file | Not parsed (EBCDIC). CSV manual path plus fixture observations. |
| MapServer layers 1, 2, 4, 13 | Documented and URL-tested. Not used as status. |
| Map demo | `data/cameron-wells.geojson`, 26 fixture points around Harlingen-Rio Hondo. Operator is Fixture Operator. `dataset_origin` is `fixture`. |

Anchor: longitude `-97.66`, latitude `26.19`, EPSG:3081 offsets in the fixture file. Jump label **Cameron**, subtitle **Harlingen-Rio Hondo**.

## How to replace the fixture

```bash
cd services/well-intel
PYTHONPATH=. python3 - << 'PY'
from etl.rrc_well_layer import read_well_shapefile
print(read_well_shapefile("/path/to/well061.zip")["record_count"])
PY
```

Then map SYMNUM through `app.rules.classify_well`, keep the raw record, and write a new GeoJSON with `dataset_origin` set to `rrc_well_layer`. Until that file replaces the fixture, the map honesty line stays **Cameron fixture**.

## Checks that must stay true

- API `06100001` stays `06100001` (leading zero). No invented `42` prefix.
- `06100007` has a plugged gas symbol and the words "plugged and abandoned" in a note. Status is historical gas, unconfirmed, review needed.
- `06100008` has an RRC plug date. Status is Plugged and abandoned, confirmed.
- `06100010` is inactive oil on the 1 mile ring. It is absent from gas ring counts.
- `06100012` is an orphan gas well, not abandoned. `06100013` is orphan plus a plug date, so plug evidence wins.
- `06100015` displays as Canceled location.
- `06100017` (injection from oil) and `06100019` (water from gas) stay on Other / unknown.
- A north-south mile near latitude 26.2 is about 1110 m in EPSG:3081, not the Web Mercator length (about 1241 m).

## Known limits

- Fixture coordinates are offsets from the Harlingen-Rio Hondo anchor, not surveyed well spots.
- No statewide schedule parser.
- Corridor-around-a-line is v1.1.
- The Cloudflare worker serves the fixture GeoJSON. It proxies `/api/wells` only when `WELL_INTEL_ORIGIN` is set.

# Well intelligence service

FastAPI plus PostGIS for Siteline oil and natural gas screening. The map can run from the committed Cameron fixture without this process. Start the API when you want query endpoints and a database.

## Run the API on the fixture

```bash
cd services/well-intel
python3 -m pip install -r requirements.txt
PYTHONPATH=. python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8088
```

Open `http://127.0.0.1:8088/api/health`.

Point the map at it with `?wellApi=http://127.0.0.1:8088` or `window.SITELINE_WELL_API`.

Without `DATABASE_URL`, a request that has no `bbox` stays on the Cameron fixture in memory. A request with `bbox` queries Texas RRC and, when the envelope crosses New Mexico, NM OCD. Zoom below 7 returns cell counts. More than 20000 wells returns HTTP 413 `zoom_in` and draws nothing. The cache key includes a geohash-5 of the view center.

```bash
curl -s "http://127.0.0.1:8088/api/health/wells"
curl -s "http://127.0.0.1:8088/api/wells?bbox=-97.72,26.15,-97.60,26.25&zoom=10&limit=500&include_gas=1&include_oil=1&include_mixed=1&include_other=1"
```

Environment: `RRC_FEATURE_URL`, `NM_OCD_URL`, `CO_ECMC_URL`, `OCC_URL`, `WELL_CACHE_DIR`, `WELL_STALE_HOURS` (clamped to 6 through 24), `PUBLIC_WELL_API_ORIGIN`. Discovered layer ids are in `/config/well-sources.json`. Colorado and Oklahoma services are recorded and are not drawn until a status crosswalk exists.

## PostGIS

```bash
cd services/well-intel
docker compose up --build
```

`DATABASE_URL=postgresql://postgres:wells@db:5432/wells` loads `schema/001_init.sql` and writes `geom_3081`. Radius SQL uses `ST_DWithin` in EPSG:3081. There is no Web Mercator distance in this service.

Schema tables: `wells`, `completions`, `well_status_observations`, `well_status_current`, `source_imports`, `well_documents`, `sites`.

## Tests

From the repo root:

```bash
PYTHONPATH=services/well-intel python3 -m pytest services/well-intel/tests -q
node --test assets/well-context.test.mjs
```

Regenerate the static GeoJSON after a rule change:

```bash
cd services/well-intel && PYTHONPATH=. python3 -m etl.export_seed
```

## Endpoints

Commodity filters: `include_gas`, `include_oil`, `include_mixed`, `include_other`. Defaults are gas on, the rest off.

- `GET /api/wells`, `/api/wells/{id}`, `/search`, `/within-radius`, `/within-polygon`, `/summary`, `/{id}/evidence`
- `GET /api/gas-wells` and the same suffixes. Gas routes drop oil, mixed, and other even if those flags are set.
- `GET /api/sources`, `/api/imports`, `/api/methodology`, `/api/quality-report`
- `POST /api/sites`
- `GET /api/sites/{id}/gas-context`, `/oil-context`, `/well-context`

Rules live in `/config/well-status-rules.json`.

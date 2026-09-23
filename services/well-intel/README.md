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

Without `DATABASE_URL`, wells stay in memory, classified from `fixtures/cameron/raw_wells.json`.

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

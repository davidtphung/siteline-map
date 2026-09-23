"""Well intelligence API. Gas routes never return oil, mixed, or other wells."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .context import build_context, feature_collection
from .rules import flags_from_query, force_gas_only, force_oil_only, load_rules
from .seed import build_wells, load_fixture
from .store import MemoryStore

ROOT = Path(__file__).resolve().parents[3]


def _status_list(raw: str | None) -> list[str] | None:
    if not raw:
        return None
    items = [part.strip() for part in raw.split(",") if part.strip()]
    return items or None


def _open_store(rules: dict) -> MemoryStore:
    fixture = load_fixture(os.environ.get("WELLS_FIXTURE_PATH"))
    wells = build_wells(fixture, rules)
    dsn = os.environ.get("DATABASE_URL")
    if dsn:
        from .postgis import PostgisStore

        return PostgisStore(dsn, wells, fixture, rules)
    return MemoryStore(wells, fixture, rules)


def create_app(store: MemoryStore | None = None, rules: dict | None = None) -> FastAPI:
    rules = rules or load_rules()
    if store is None:
        store = _open_store(rules)

    app = FastAPI(title="Siteline well intelligence", version=rules["version"])
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )
    app.state.store = store
    app.state.rules = rules

    def flags(request: Request, gas_route: bool = False, oil_route: bool = False) -> dict:
        found = flags_from_query(dict(request.query_params), rules)
        if gas_route:
            return force_gas_only(found)
        if oil_route:
            return force_oil_only(found)
        return found

    @app.get("/api/health")
    def health():
        return {
            "ok": True,
            "rules_version": rules["version"],
            "wells": len(store.wells),
            "dataset_origin": store.fixture.get("dataset_origin"),
            "distance_crs": "EPSG:3081",
        }

    @app.get("/api/methodology")
    def methodology():
        return {
            "rules_version": rules["version"],
            "system_of_record": "Texas Railroad Commission for Texas wells",
            "distance_crs": rules["crs"],
            "defaults": rules["defaults"],
            "disclaimers": rules["disclaimers"],
            "notes": rules["notes"],
            "phases": ["A Cameron County", "B status depth", "C site polygons and radius rings"],
            "deferred": ["Corridor analysis around a line is v1.1"],
            "page": "/well-methodology.html",
        }

    @app.get("/api/sources")
    def sources():
        return {
            "system_of_record_tx": "Texas RRC",
            "county_well_layers": {
                "name": "Well Layers by County",
                "cameron_file": "well061.zip",
                "mft": "https://mft.rrc.texas.gov/link/d551fb20-442e-4b67-84fa-ac3f23ecabb4",
                "guide": "https://www.rrc.texas.gov/media/kmld3uzj/digital-map-information-user-guide.pdf",
            },
            "statewide_api": {
                "ascii": "https://mft.rrc.texas.gov/link/701db9a3-32b5-488d-812b-cd6ff7d0fe85",
                "dbase": "https://mft.rrc.texas.gov/link/1eb94d66-461d-4114-93f7-b4bc04a70674",
            },
            "viewer_mapserver_qa_only": {
                "service": "https://gis.rrc.texas.gov/server/rest/services/rrc_public/RRC_Public_Viewer_Srvs/MapServer",
                "layers": {
                    "1": "Well Locations",
                    "2": "Orphan Wells",
                    "4": "Injection/Disposal",
                    "13": "Pipelines",
                },
                "note": "QA cross-check only. Not status authority.",
            },
            "public_pipeline_context": {
                "name": "EIA natural gas interstate and intrastate pipelines",
                "role": "Public pipeline context, separate from wells",
            },
            "non_tx_optional": ["NETL", "NM OCD", "CO OGCC"],
            "disclaimers": rules["disclaimers"],
        }

    @app.get("/api/imports")
    def imports():
        return {"imports": store.imports}

    @app.get("/api/quality-report")
    def quality():
        plugged_symbol = [
            w["id"]
            for w in store.wells
            if w["symnum_role"] == "plugged_symbol" and not w["pa_confirmed"]
        ]
        missing_xy = [w["id"] for w in store.wells if w.get("lon") is None]
        dupes = []
        seen = {}
        for well in store.wells:
            seen.setdefault(well["api_normalized"], []).append(well["id"])
        for api, ids in seen.items():
            if len(ids) > 1:
                dupes.append({"api_normalized": api, "ids": ids})
        labels = sorted({w["status_label"] for w in store.wells if not w["pa_confirmed"]})
        return {
            "dataset_origin": store.fixture.get("dataset_origin"),
            "well_count": len(store.wells),
            "plugged_symbol_without_pa_evidence": plugged_symbol,
            "missing_coordinates": missing_xy,
            "duplicate_api_normalized": dupes,
            "non_pa_labels": labels,
            "forbidden_status_word_absent": all("abandoned" not in label.lower() for label in labels),
            "disclaimers": rules["disclaimers"],
        }

    def _collection(request: Request, gas_route: bool = False):
        chosen = flags(request, gas_route=gas_route)
        rows = store.list_wells(chosen, _status_list(request.query_params.get("status")))
        return JSONResponse(feature_collection(rows))

    @app.get("/api/wells")
    def wells(request: Request):
        return _collection(request)

    @app.get("/api/gas-wells")
    def gas_wells(request: Request):
        return _collection(request, gas_route=True)

    @app.get("/api/wells/summary")
    def wells_summary(request: Request):
        chosen = flags(request)
        rows = store.list_wells(chosen, _status_list(request.query_params.get("status")))
        counts: dict[str, int] = {}
        for well in rows:
            counts[well["status_code"]] = counts.get(well["status_code"], 0) + 1
        return {
            "enabled": chosen,
            "well_count": len(rows),
            "counts_by_status": counts,
            "review_needed_count": sum(1 for w in rows if w["review_needed"]),
            "disclaimers": rules["disclaimers"],
        }

    @app.get("/api/gas-wells/summary")
    def gas_summary(request: Request):
        chosen = force_gas_only(flags(request))
        rows = store.list_wells(chosen)
        counts: dict[str, int] = {}
        for well in rows:
            counts[well["status_code"]] = counts.get(well["status_code"], 0) + 1
        return {
            "enabled": chosen,
            "well_count": len(rows),
            "counts_by_status": counts,
            "commodities": sorted({w["commodity"] for w in rows}),
            "disclaimers": rules["disclaimers"],
        }

    @app.get("/api/wells/search")
    def wells_search(request: Request, q: str = Query("")):
        return feature_collection(store.search(q, flags(request)))

    @app.get("/api/gas-wells/search")
    def gas_search(request: Request, q: str = Query("")):
        return feature_collection(store.search(q, force_gas_only(flags(request))))

    @app.get("/api/wells/within-radius")
    def wells_radius(
        request: Request,
        lng: float = Query(...),
        lat: float = Query(...),
        miles: float = Query(...),
    ):
        if miles < 0 or miles > 100:
            raise HTTPException(400, "miles must be between 0 and 100")
        return feature_collection(store.within_radius(lng, lat, miles, flags(request)))

    @app.get("/api/gas-wells/within-radius")
    def gas_radius(
        request: Request,
        lng: float = Query(...),
        lat: float = Query(...),
        miles: float = Query(...),
    ):
        return feature_collection(
            store.within_radius(lng, lat, miles, force_gas_only(flags(request)))
        )

    @app.api_route("/api/wells/within-polygon", methods=["GET", "POST"])
    async def wells_polygon(request: Request):
        geometry = await _geometry_from_request(request)
        return feature_collection(store.within_polygon(geometry, flags(request)))

    @app.api_route("/api/gas-wells/within-polygon", methods=["GET", "POST"])
    async def gas_polygon(request: Request):
        geometry = await _geometry_from_request(request)
        return feature_collection(
            store.within_polygon(geometry, force_gas_only(flags(request)))
        )

    @app.get("/api/wells/{well_id}")
    def well_detail(well_id: str):
        well = store.get(well_id)
        if not well:
            raise HTTPException(404, "Well not found")
        return {
            "well": well_public(well),
            "disclaimers": rules["disclaimers"],
        }

    @app.get("/api/wells/{well_id}/evidence")
    def well_evidence(well_id: str):
        well = store.get(well_id)
        if not well:
            raise HTTPException(404, "Well not found")
        return {
            "id": well["id"],
            "api_raw": well["api_raw"],
            "api_normalized": well["api_normalized"],
            "status_code": well["status_code"],
            "status_label": well["status_label"],
            "pa_confirmed": well["pa_confirmed"],
            "review_needed": well["review_needed"],
            "conflict": well["conflict"],
            "evidence": well["evidence"],
            "freshness": well["freshness"],
            "symnum": well["symnum"],
            "symnum_raw_label": well["symnum_raw_label"],
            "timeline": well["observations"],
            "completions": well["completions"],
            "rrc_viewer_url": well["rrc_viewer_url"],
            "viewer_note": "Open the RRC GIS Viewer and search this API. Siteline does not scrape the viewer.",
            "disclaimers": rules["disclaimers"],
        }

    @app.get("/api/gas-wells/{well_id}")
    def gas_detail(well_id: str):
        well = store.get(well_id)
        if not well or well["commodity_group"] != "gas":
            raise HTTPException(404, "Gas well not found")
        return {"well": well_public(well), "disclaimers": rules["disclaimers"]}

    @app.get("/api/gas-wells/{well_id}/evidence")
    def gas_evidence(well_id: str):
        well = store.get(well_id)
        if not well or well["commodity_group"] != "gas":
            raise HTTPException(404, "Gas well not found")
        return well_evidence(well_id)

    @app.post("/api/sites")
    async def create_site(request: Request):
        body = await request.json()
        return store.create_site(body)

    @app.get("/api/sites/{site_id}")
    def get_site(site_id: str):
        site = store.get_site(site_id)
        if not site:
            raise HTTPException(404, "Site not found")
        return site

    def _site_or_404(site_id: str) -> dict:
        site = store.get_site(site_id)
        if not site:
            raise HTTPException(404, "Site not found")
        return site

    @app.get("/api/sites/{site_id}/gas-context")
    def gas_context(site_id: str, request: Request):
        site = _site_or_404(site_id)
        return build_context(store, site, force_gas_only(flags(request)), rules)

    @app.get("/api/sites/{site_id}/oil-context")
    def oil_context(site_id: str, request: Request):
        site = _site_or_404(site_id)
        return build_context(store, site, force_oil_only(flags(request)), rules)

    @app.get("/api/sites/{site_id}/well-context")
    def well_context(site_id: str, request: Request):
        site = _site_or_404(site_id)
        return build_context(store, site, flags(request), rules)

    return app


async def _geometry_from_request(request: Request) -> dict:
    if request.method == "POST":
        body = await request.json()
        geometry = body.get("geometry", body)
    else:
        import json

        raw = request.query_params.get("geometry")
        if not raw:
            raise HTTPException(400, "geometry is required")
        geometry = json.loads(raw)
    if geometry.get("type") == "Feature":
        geometry = geometry["geometry"]
    if geometry.get("type") not in {"Polygon", "MultiPolygon"}:
        raise HTTPException(400, "Polygon or MultiPolygon required")
    return geometry


def well_public(well: dict) -> dict:
    hidden = {"raw"}
    return {k: v for k, v in well.items() if k not in hidden}


app = create_app()

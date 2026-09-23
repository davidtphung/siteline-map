"""Live viewport wells: RRC and OCD adapters, bbox guard, and health."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services" / "well-intel"))

from app.adapt import adapt_nm_row, adapt_texas_rows, merge_nm_wells  # noqa: E402
from app.geo import distance_miles  # noqa: E402
from app.live import LiveCatalog, buffer_bbox, geohash5, load_sources  # noqa: E402
from app.main import create_app  # noqa: E402
from app.rules import load_rules  # noqa: E402

RULES = load_rules()
TX_SERVICE = (
    "https://gis.rrc.texas.gov/server/rest/services/"
    "rrc_public/RRC_Public_Viewer_Srvs/MapServer"
)
NM_SERVICE = (
    "https://mapservice.nmstatelands.org/arcgis/rest/services/"
    "Public/NMOCD_Wells_V3/MapServer"
)
CAMERON = (-97.72, 26.15, -97.60, 26.25)
FLAGS_ALL = {
    "include_gas": True,
    "include_oil": True,
    "include_mixed": True,
    "include_other": True,
}


def _tx_meta():
    return {
        "layers": [
            {"id": 1, "name": "Well Locations"},
            {"id": 2, "name": "Orphan Wells"},
            {"id": 4, "name": "Injection/Disposal"},
        ]
    }


def _nm_meta():
    return {"layers": [{"id": 5, "name": "NMOCD_Active"}, {"id": 4, "name": "NMOCD_Inactive"}]}


def _tx_features():
    rows = [
        ("06130534", 5, "Gas", "1", -97.67, 26.18),
        ("06130538", 4, "Orphan Well", "6", -97.66, 26.19),
        ("06130540", 8, "Plugged Gas Well", "2", -97.65, 26.20),
        ("06130541", 20, "Shut-In Well (Gas)", "3", -97.64, 26.17),
        ("061", 3, "Dry Hole", "1", -97.63, 26.16),
        ("06130542", 5, "Orphan Well", "4", -97.62, 26.21),
    ]
    features = []
    for api, sym, label, number, lon, lat in rows:
        features.append(
            {
                "attributes": {
                    "API": api,
                    "SYMNUM": sym,
                    "GIS_SYMBOL_DESCRIPTION": label,
                    "GIS_WELL_NUMBER": number,
                    "GIS_LONG83": lon,
                    "GIS_LAT83": lat,
                    "RELIAB": "55",
                },
                "geometry": {"x": lon, "y": lat},
            }
        )
    return features


class FakeTransport:
    def __init__(self, count=4):
        self.count = count
        self.urls = []

    def __call__(self, url, timeout=25):
        self.urls.append(url)
        if "returnCountOnly" in url:
            return {"count": self.count}
        if "/1/query" in url:
            return {"features": _tx_features(), "exceededTransferLimit": False}
        if "/2/query" in url:
            return {"features": [{"attributes": {"API": "06130534"}}]}
        if "/4/query" in url:
            return {"features": []}
        if url.startswith(TX_SERVICE) and "/query" not in url:
            return _tx_meta()
        if url.startswith(NM_SERVICE) and "/query" not in url:
            return _nm_meta()
        if "dnrgis.state.co.us" in url:
            return {"name": "wells", "id": 0}
        if "gis.occ.ok.gov" in url:
            return {"layers": [{"id": 0, "name": "RBDMS_WELLS"}]}
        if "NMOCD" in url and "/query" in url:
            return {"features": [], "exceededTransferLimit": False}
        raise AssertionError(url)


def _catalog(count=4):
    transport = FakeTransport(count=count)
    return LiveCatalog(RULES, transport=transport), transport


def test_sources_record_discovered_layers_and_reject_hifld_nasa():
    sources = load_sources()
    text = json.dumps(sources)
    assert sources["discovered_at"] == "2026-09-23"
    tx = next(row for row in sources["sources"] if row["id"] == "tx_rrc_public_viewer")
    names = {layer["name"]: layer["id"] for layer in tx["layers"]}
    assert names["Well Locations"] == 1
    assert names["Orphan Wells"] == 2
    assert names["Injection/Disposal"] == 4
    nm = next(row for row in sources["sources"] if row["id"] == "nm_ocd_wells_v3")
    nm_names = {layer["name"]: layer["id"] for layer in nm["layers"]}
    assert nm_names == {"NMOCD_Active": 5, "NMOCD_Inactive": 4}
    assert "maps.nccs.nasa.gov" not in text
    assert any(row["id"] == "hifld_open_nccs" for row in sources["rejected"])
    assert any(row["id"] == "rac_gm" for row in sources["rejected"])
    assert tx["query_enabled"] is True
    assert next(row for row in sources["sources"] if row["state"] == "OK")["query_enabled"] is False


def test_buffer_uses_epsg_3081():
    west, south, east, north = buffer_bbox((-97.66, 26.19, -97.66, 26.19), 1)
    assert distance_miles(west, 26.19, east, 26.19) == pytest.approx(2, abs=0.05)
    assert distance_miles(-97.66, south, -97.66, north) == pytest.approx(2, abs=0.05)
    assert geohash5(-97.66, 26.19)


def test_national_extent_does_not_call_upstream():
    catalog, transport = _catalog()
    status, body = catalog.query(
        bbox=(-125, 24, -66, 49),
        zoom=3.8,
        limit=5000,
        states=None,
        flags=FLAGS_ALL,
    )
    assert status == 413
    assert body["error"] == "zoom_in"
    assert body["features"] == []
    assert transport.urls == []
    assert "national" in body["message"]


def test_ashburn_is_empty_without_a_backfill():
    catalog, transport = _catalog()
    status, body = catalog.query(
        bbox=(-77.55, 38.95, -77.35, 39.15),
        zoom=11,
        limit=500,
        states=None,
        flags=FLAGS_ALL,
    )
    assert status == 200
    assert body["features"] == []
    assert "Ashburn" in body["message"]
    assert "NETL" in body["message"]
    assert transport.urls == []
    assert body["dataset_origin"] != "fixture"


def test_zoom_below_seven_returns_clusters_not_dots():
    catalog, transport = _catalog(count=12)
    status, body = catalog.query(
        bbox=CAMERON,
        zoom=6,
        limit=5000,
        states=["TX"],
        flags=FLAGS_ALL,
    )
    assert status == 200
    assert body["mode"] == "clusters"
    assert body["features"]
    assert all(feature["properties"].get("well_count") for feature in body["features"])
    assert all("SYMNUM" not in url for url in transport.urls)
    assert all("1=1" not in url and "1%3D1" not in url for url in transport.urls)
    assert any("returnCountOnly" in url for url in transport.urls)


def test_rrc_adapter_keeps_plug_symbol_and_orphan_rules():
    catalog, transport = _catalog(count=4)
    status, body = catalog.query(
        bbox=CAMERON,
        zoom=10,
        limit=5000,
        states=["TX"],
        flags=FLAGS_ALL,
        as_of="2026-09-23",
    )
    assert status == 200
    assert body["mode"] == "features"
    assert body["crs_distance"] == "EPSG:3081"
    by_api = {feature["properties"]["api_normalized"]: feature["properties"] for feature in body["features"]}
    assert "061" not in by_api
    orphan = by_api["06130534"]
    assert orphan["status_code"] == "tx_orphan"
    assert orphan["pa_confirmed"] is False
    assert orphan["status_label"] == "Orphan well, natural gas"
    assert "abandoned" not in orphan["status_label"].lower()
    described = by_api["06130542"]
    assert described["status_code"] == "tx_historical_gas_unconfirmed"
    assert described["pa_confirmed"] is False
    plugged = by_api["06130540"]
    assert plugged["pa_confirmed"] is False
    assert plugged["status_code"] == "tx_historical_gas_unconfirmed"
    assert plugged["review_needed"] is True
    shut = by_api["06130541"]
    assert shut["status_code"] == "tx_inactive_gas"
    assert "abandoned" not in shut["status_label"].lower()
    assert shut["operator_name"] == ""
    assert body["dataset_origin"] == "rrc_public_viewer"
    assert "Texas RRC is the system of record for Texas wells." in body["disclaimers"]
    assert any("outFields=API%2CSYMNUM" in url or "outFields=API,SYMNUM" in url for url in transport.urls)


def test_include_oil_zero_drops_oil_wells():
    catalog, _transport = _catalog(count=4)
    _status, body = catalog.query(
        bbox=CAMERON,
        zoom=10,
        limit=5000,
        states=["TX"],
        flags={
            "include_gas": True,
            "include_oil": False,
            "include_mixed": False,
            "include_other": False,
        },
    )
    groups = {feature["properties"]["commodity_group"] for feature in body["features"]}
    assert groups == {"gas"}
    assert all(feature["properties"]["state"] == "TX" for feature in body["features"])


def test_over_cap_does_not_return_a_partial_extract():
    catalog, transport = _catalog(count=25000)
    status, body = catalog.query(
        bbox=CAMERON,
        zoom=10,
        limit=5000,
        states=["TX"],
        flags=FLAGS_ALL,
    )
    assert status == 413
    assert body["error"] == "zoom_in"
    assert body["features"] == []
    assert all("SYMNUM" not in url for url in transport.urls)


def test_cache_skips_the_second_identical_query():
    catalog, transport = _catalog(count=4)
    kwargs = dict(bbox=CAMERON, zoom=10, limit=5000, states=["TX"], flags=FLAGS_ALL)
    catalog.query(**kwargs)
    used = len(transport.urls)
    catalog.query(**kwargs)
    assert len(transport.urls) == used


def test_nm_plug_date_sentinel_is_not_confirmation():
    active = adapt_nm_row(
        {
            "attributes": {
                "API": "30-025-36458",
                "wellname": "RAWHIDE 29 STATE #001",
                "well_type": "G",
                "type": "Gas",
                "status_cod": "A",
                "status": "Active",
                "ogrid_name": "COG OPERATING LLC",
                "county": "Lea",
                "plug_date": 253402214400000,
                "latitude": 32.44,
                "longitude": -103.39,
            }
        },
        RULES,
        as_of="2026-09-23",
        source_url=NM_SERVICE,
    )
    assert active["status_code"] == "nm_active_gas"
    assert active["pa_confirmed"] is False
    assert active["commodity_group"] == "gas"
    assert "\u2014" not in active["status_label"]
    confirmed = adapt_nm_row(
        {
            "attributes": {
                "API": "30-025-36924",
                "type": "Gas",
                "well_type": "G",
                "status_cod": "P",
                "status": "Plugged (site released)",
                "plug_date": 1131926400000,
                "latitude": 32.40,
                "longitude": -103.39,
                "ogrid_name": "Operator",
                "county": "Lea",
            }
        },
        RULES,
        as_of="2026-09-23",
        source_url=NM_SERVICE,
    )
    assert confirmed["pa_confirmed"] is True
    assert confirmed["status_code"] == "nm_plugged_confirmed"
    assert "nm_ocd_plug_date" in confirmed["evidence"]
    unconfirmed = adapt_nm_row(
        {
            "attributes": {
                "API": "30-025-03527",
                "type": "Oil",
                "well_type": "O",
                "status_cod": "P",
                "status": "Plugged (site released)",
                "plug_date": -2208988800000,
                "latitude": 32.44,
                "longitude": -103.39,
            }
        },
        RULES,
        as_of="2026-09-23",
        source_url=NM_SERVICE,
    )
    assert unconfirmed["pa_confirmed"] is False
    assert unconfirmed["status_code"] == "nm_plug_unconfirmed"
    assert "abandoned" not in unconfirmed["status_label"].lower()
    canceled = adapt_nm_row(
        {
            "attributes": {
                "API": "30-025-44489",
                "type": "Oil",
                "well_type": "O",
                "status_cod": "X",
                "status": "Never Drilled",
                "plug_date": 253402214400000,
                "latitude": 32.38,
                "longitude": -103.39,
            }
        },
        RULES,
        as_of="2026-09-23",
        source_url=NM_SERVICE,
    )
    assert canceled["status_code"] == "nm_canceled"
    assert canceled["pa_confirmed"] is False
    conflict = merge_nm_wells([active, {**confirmed, "api_raw": active["api_raw"], "api_normalized": active["api_normalized"], "id": active["id"]}])
    assert conflict[0]["pa_confirmed"] is False
    assert conflict[0]["status_code"] == "nm_unknown_review"


def test_direct_tx_rows_do_not_treat_a_symbol_as_a_plug():
    wells = adapt_texas_rows(_tx_features(), set(), RULES, as_of="2026-09-23")
    by_api = {well["api_normalized"]: well for well in wells}
    assert by_api["06130540"]["pa_confirmed"] is False
    assert all(not well["pa_confirmed"] for well in wells)


def test_health_lists_sources():
    catalog, _transport = _catalog()
    body = catalog.health()
    assert "ok" in body
    assert body["ok"] is True
    ids = {row["id"] for row in body["sources"]}
    assert "tx_rrc_public_viewer" in ids
    assert "nm_ocd_wells_v3" in ids
    tx = next(row for row in body["sources"] if row["id"] == "tx_rrc_public_viewer")
    assert any(layer["name"] == "Well Locations" for layer in tx["layers"])


def test_api_bbox_route_and_fixture_without_bbox():
    catalog, _transport = _catalog(count=4)
    client = TestClient(create_app(live=catalog, rules=RULES))
    health = client.get("/api/health/wells")
    assert health.status_code == 200
    assert health.json()["sources"]
    live = client.get(
        "/api/wells?bbox=-97.72,26.15,-97.60,26.25&zoom=10&limit=100&include_gas=1&include_oil=0&include_mixed=0&include_other=0"
    )
    assert live.status_code == 200
    assert live.json()["dataset_origin"] == "rrc_public_viewer"
    assert all(row["properties"]["commodity_group"] == "gas" for row in live.json()["features"])
    fixture = client.get("/api/wells?include_gas=1&include_oil=0")
    assert fixture.status_code == 200
    assert fixture.json()["features"]
    assert all(row["properties"]["dataset_origin"] == "fixture" for row in fixture.json()["features"])

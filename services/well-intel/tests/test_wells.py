"""Rules, isolation, projected distance, and API contracts for Phases A-C."""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

import pytest
import shapefile
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services" / "well-intel"))

from app.api_numbers import normalize_api  # noqa: E402
from app.context import build_context  # noqa: E402
from app.geo import distance_meters  # noqa: E402
from app.main import create_app  # noqa: E402
from app.rules import classify_well, label_uses_abandoned, load_rules  # noqa: E402
from app.seed import build_wells, load_fixture  # noqa: E402
from app.store import MemoryStore  # noqa: E402
from etl.manual_csv import read_inactive_aging  # noqa: E402
from etl.qa_mapserver import QA_LAYERS, layer_query_url, qa_note  # noqa: E402
from etl.rrc_well_layer import read_well_shapefile  # noqa: E402

RULES = load_rules()
FIXTURE = load_fixture()
WELLS = build_wells(FIXTURE, RULES)
BY_API = {w["api_raw"]: w for w in WELLS}
AS_OF = date(2026, 9, 23)
DISCLAIMERS = RULES["disclaimers"]


def well(api: str) -> dict:
    return BY_API[api]


def test_api_leading_zeros_are_preserved():
    assert normalize_api("06100001") == "06100001"
    assert normalize_api("042-061-00123") == "04206100123"
    assert normalize_api("06100001") != str(int("06100001"))
    assert well("06100026")["api10_raw"] == "0610002601"
    assert well("06100026")["api_normalized"] == "06100026"
    assert not well("06100001")["api_normalized"].startswith("42")


def test_multi_completion_rolls_up_to_mixed_and_injection_does_not():
    mixed = well("06100006")
    assert mixed["commodity"] == "oil_and_gas"
    assert mixed["is_mixed_oil_gas"] is True
    assert mixed["is_gas_related"] is False
    assert mixed["status_code"] == "historical_mixed_unconfirmed"
    injection = classify_well(
        {
            "api_raw": "06100999",
            "symnum": 5,
            "completions": [{"fluid": "injection"}, {"fluid": "gas"}],
        },
        RULES,
        AS_OF,
    )
    assert injection["commodity"] == "gas"


def test_pa_requires_explicit_evidence():
    symbol_only = well("06100007")
    assert symbol_only["pa_confirmed"] is False
    assert symbol_only["status_code"] == "historical_gas_unconfirmed"
    assert symbol_only["review_needed"] is True
    assert "abandoned" not in symbol_only["status_label"].lower()
    confirmed = well("06100008")
    assert confirmed["pa_confirmed"] is True
    assert confirmed["status_label"] == "Plugged & abandoned — confirmed"
    assert well("06100009")["pa_confirmed"] is True
    assert well("06100009")["commodity"] == "oil"


def test_historical_inactive_orphan_and_canceled_are_not_abandoned_labels():
    assert well("06100001")["status_label"] == "Historical gas well — status unconfirmed"
    assert well("06100003")["status_label"] == "Historical oil well — status unconfirmed"
    assert well("06100010")["status_code"] == "inactive_oil"
    assert well("06100011")["status_code"] == "inactive_gas"
    assert "abandoned" not in well("06100010")["status_label"].lower()
    assert "abandoned" not in well("06100011")["status_label"].lower()
    orphan = well("06100012")
    assert orphan["status_code"] == "orphan"
    assert orphan["status_label"] == "Orphan well, natural gas"
    assert orphan["pa_confirmed"] is False
    assert well("06100013")["pa_confirmed"] is True
    assert well("06100013")["status_code"] == "plugged_abandoned_confirmed"
    canceled = well("06100015")
    assert canceled["status_label"] == "Canceled location"
    assert "abandoned" not in canceled["status_label"].lower()
    assert "Abandoned" in canceled["symnum_raw_label"]
    for row in WELLS:
        if not row["pa_confirmed"]:
            assert not label_uses_abandoned(row["status_label"])


def test_schedule_recency_stale_and_dry_hole():
    assert well("06100002")["status_code"] == "current_gas_schedule"
    assert well("06100002")["freshness"] == "Within freshness window"
    assert well("06100020")["status_code"] == "current_gas_schedule"
    assert well("06100020")["freshness"] == "May be stale"
    assert well("06100022")["status_code"] == "current_gas_schedule"
    assert well("06100023")["status_code"] == "inactive_gas"
    tie = well("06100021")
    assert tie["status_code"] == "unknown_review"
    assert tie["conflict"] == "schedule_shut_in_tie"
    assert well("06100024")["pa_confirmed"] is True
    assert well("06100024")["conflict"] == "schedule_newer_than_plug"
    assert well("06100014")["status_code"] == "dry_hole"
    assert well("06100014")["commodity_group"] == "other"
    assert well("06100016")["commodity"] == "injection_or_disposal"
    assert well("06100017")["is_oil_related"] is False
    assert well("06100017")["commodity_group"] == "other"
    assert well("06100019")["commodity"] == "water"
    assert well("06100019")["is_gas_related"] is False
    assert well("06100018")["status_code"] == "permitted_drilling_gas"
    assert well("06100025")["status_code"] == "permitted_drilling_unknown"


def test_projected_distance_is_epsg_3081_not_web_mercator():
    meters = distance_meters(-97.66, 26.2, -97.66, 26.21)
    assert meters == pytest.approx(1109.6584504542068, abs=0.01)
    assert meters != pytest.approx(1240.7158907712437, abs=1)
    one_mile = well("06100010")
    from app.geo import distance_miles

    assert distance_miles(-97.66, 26.19, one_mile["lon"], one_mile["lat"]) == pytest.approx(1, abs=1e-6)


def test_gas_default_does_not_include_oil_mixed_or_other():
    store = MemoryStore(WELLS, FIXTURE, RULES)
    flags = {"include_gas": True, "include_oil": False, "include_mixed": False, "include_other": False}
    ids = {w["api_raw"] for w in store.list_wells(flags)}
    assert "06100001" in ids
    assert "06100003" not in ids
    assert "06100005" not in ids
    assert "06100006" not in ids
    assert "06100016" not in ids
    assert "06100019" not in ids
    oil = {w["api_raw"] for w in store.list_wells({**flags, "include_gas": False, "include_oil": True})}
    assert "06100003" in oil
    assert "06100001" not in oil


def test_site_context_rings_and_titles_stay_isolated():
    store = MemoryStore(WELLS, FIXTURE, RULES)
    site = {"id": "s", "center": [-97.66, 26.19], "geometry": None}
    gas_flags = {"include_gas": True, "include_oil": False, "include_mixed": False, "include_other": False}
    ctx = build_context(store, site, gas_flags, RULES)
    assert ctx["title"] == "Gas well context"
    assert "06100003" not in json.dumps(ctx["counts_by_status"])
    ring = ctx["rings"]["1"]
    assert ring["crs"] == "EPSG:3081"
    # Oil shut-in sits on the 1 mile ring and must not enter the gas ring count.
    assert ring["counts_by_status"].get("inactive_oil", 0) == 0
    oil = build_context(
        store,
        site,
        {"include_gas": False, "include_oil": True, "include_mixed": False, "include_other": False},
        RULES,
    )
    assert oil["title"] == "Oil well context"
    assert oil["rings"]["1"]["counts_by_status"].get("inactive_oil") == 1
    assert oil["rings"]["0.5"]["counts_by_status"].get("inactive_oil", 0) == 0
    both = build_context(
        store,
        site,
        {"include_gas": True, "include_oil": True, "include_mixed": False, "include_other": False},
        RULES,
    )
    assert both["title"] == "Oil & gas well context"
    assert both["separated"]["gas"]["well_count"] != both["separated"]["oil"]["well_count"]
    for line in DISCLAIMERS:
        assert line in ctx["disclaimers"]


def test_polygon_contains_only_the_enabled_commodity():
    store = MemoryStore(WELLS, FIXTURE, RULES)
    gas = well("06100001")
    poly = {
        "type": "Polygon",
        "coordinates": [[
            [gas["lon"] - 0.01, gas["lat"] - 0.01],
            [gas["lon"] + 0.01, gas["lat"] - 0.01],
            [gas["lon"] + 0.01, gas["lat"] + 0.01],
            [gas["lon"] - 0.01, gas["lat"] + 0.01],
            [gas["lon"] - 0.01, gas["lat"] - 0.01],
        ]],
    }
    gas_hits = store.within_polygon(poly, {"include_gas": True, "include_oil": False, "include_mixed": False, "include_other": False})
    assert any(w["api_raw"] == "06100001" for w in gas_hits)
    assert all(w["commodity_group"] == "gas" for w in gas_hits)


@pytest.fixture()
def client():
    store = MemoryStore(WELLS, FIXTURE, RULES)
    return TestClient(create_app(store, RULES))


def test_api_defaults_disclaimers_and_gas_route_isolation(client):
    summary = client.get("/api/wells/summary")
    assert summary.status_code == 200
    body = summary.json()
    assert body["enabled"]["include_gas"] is True
    assert body["enabled"]["include_oil"] is False
    assert body["enabled"]["include_mixed"] is False
    assert body["enabled"]["include_other"] is False
    for line in DISCLAIMERS:
        assert line in body["disclaimers"]
    gas = client.get("/api/gas-wells?include_oil=true&include_mixed=true&include_other=true")
    apis = {f["properties"]["api_raw"] for f in gas.json()["features"]}
    assert "06100003" not in apis
    assert "06100005" not in apis
    assert "06100016" not in apis
    assert "06100001" in apis
    missing = client.get("/api/gas-wells/tx-061-06100003")
    assert missing.status_code == 404
    method = client.get("/api/methodology").json()
    assert "Texas RRC is the system of record for Texas wells." in method["disclaimers"]
    assert "EPSG:3081" in method["distance_crs"]
    quality = client.get("/api/quality-report").json()
    assert quality["forbidden_status_word_absent"] is True


def test_radius_endpoint_and_site_contexts(client):
    url = "/api/wells/within-radius?lng=-97.66&lat=26.19&miles=0.5&include_oil=true"
    # include_gas stays at its default (on) and include_oil is explicit.
    body = client.get(url).json()
    apis = {f["properties"]["api_raw"] for f in body["features"]}
    assert "06100001" in apis
    assert "06100003" in apis
    gas_only = client.get("/api/gas-wells/within-radius?lng=-97.66&lat=26.19&miles=1&include_oil=true").json()
    gas_apis = {f["properties"]["api_raw"] for f in gas_only["features"]}
    assert "06100010" not in gas_apis
    created = client.post("/api/sites", json={"name": "Harlingen", "center": [-97.66, 26.19]}).json()
    gas_ctx = client.get(f"/api/sites/{created['id']}/gas-context?include_oil=true").json()
    oil_ctx = client.get(f"/api/sites/{created['id']}/oil-context").json()
    well_ctx = client.get(f"/api/sites/{created['id']}/well-context?include_gas=1&include_oil=1").json()
    assert gas_ctx["title"] == "Gas well context"
    assert oil_ctx["title"] == "Oil well context"
    assert well_ctx["title"] == "Oil & gas well context"
    assert gas_ctx["rings"]["1"]["counts_by_status"].get("inactive_oil", 0) == 0
    assert oil_ctx["rings"]["1"]["counts_by_status"].get("inactive_oil") == 1
    evidence = client.get("/api/wells/tx-061-06100008/evidence").json()
    assert evidence["pa_confirmed"] is True
    assert "Siteline does not scrape the viewer." in evidence["viewer_note"]


def test_seed_geojson_matches_classifier():
    path = ROOT / "data" / "cameron-wells.geojson"
    assert path.exists(), "run python -m etl.export_seed"
    fc = json.loads(path.read_text(encoding="utf-8"))
    exported = {f["properties"]["api_raw"]: f["properties"] for f in fc["features"]}
    for row in WELLS:
        assert exported[row["api_raw"]]["status_code"] == row["status_code"]
        if not row["pa_confirmed"]:
            assert "abandoned" not in exported[row["api_raw"]]["status_label"].lower()


def test_shapefile_keeps_api_text_and_csv_inactive_is_not_abandoned(tmp_path: Path):
    shp = tmp_path / "well061"
    writer = shapefile.Writer(str(shp), shapeType=shapefile.POINT)
    writer.field("API", "C", 8)
    writer.field("SYMNUM", "N", 4, 0)
    writer.field("LAT83", "N", 12, 6)
    writer.field("LONG83", "N", 12, 6)
    writer.point(-97.66, 26.19)
    writer.record("06100001", 5, 26.19, -97.66)
    writer.close()
    parsed = read_well_shapefile(str(shp) + ".shp")
    assert parsed["wells"][0]["api_raw"] == "06100001"
    csv_path = tmp_path / "inactive.csv"
    csv_path.write_text("api,observed_at,notes\n06100011,2026-07-01,shut-in\n", encoding="utf-8")
    loaded = read_inactive_aging(csv_path)
    assert loaded["rows"][0]["observation"]["kind"] == "shut_in"
    assert loaded["checksum_sha256"]
    assert "abandoned" not in loaded["rows"][0]["observation"]["text"]


def test_mapserver_qa_is_not_a_status_label():
    url = layer_query_url(1, (-97.8, 25.9, -97.3, 26.5))
    assert "/MapServer/1/query" in url
    assert QA_LAYERS[2] == "Orphan Wells"
    assert QA_LAYERS[4] == "Injection/Disposal"
    assert QA_LAYERS[13] == "Pipelines"
    assert "not status authority" in qa_note().lower() or "QA cross-check" in qa_note()

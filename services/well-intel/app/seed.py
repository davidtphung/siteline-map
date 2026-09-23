"""Build classified Cameron wells from the fixture file. Raw rows are kept intact."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from .geo import offset_lonlat
from .rules import classify_well, load_rules

PACKAGE = Path(__file__).resolve().parents[1]
DEFAULT_FIXTURE = PACKAGE / "fixtures" / "cameron" / "raw_wells.json"
RRC_VIEWER = "https://gis.rrc.texas.gov/GISViewer/"


def load_fixture(path: Path | None = None) -> dict:
    src = Path(path or DEFAULT_FIXTURE)
    with src.open(encoding="utf-8") as fh:
        return json.load(fh)


def build_wells(fixture: dict | None = None, rules: dict | None = None) -> list[dict]:
    fixture = fixture or load_fixture()
    rules = rules or load_rules()
    as_of = date.fromisoformat(fixture["as_of"])
    anchor = fixture["anchor"]
    wells = []
    for raw in fixture["wells"]:
        lon, lat = offset_lonlat(
            anchor["lon"],
            anchor["lat"],
            float(raw.get("offset_east_m") or 0),
            float(raw.get("offset_north_m") or 0),
        )
        classified = classify_well(raw, rules, as_of=as_of)
        api = classified["api_normalized"]
        well_id = f"tx-{fixture['county_code']}-{api}"
        wells.append(
            {
                **classified,
                "id": well_id,
                "lon": lon,
                "lat": lat,
                "county_code": fixture["county_code"],
                "county_name": fixture["county_name"],
                "state": fixture["state"],
                "lease_name": raw.get("lease_name") or "",
                "well_number": raw.get("well_number") or "",
                "operator_name": "Fixture Operator",
                "dataset_origin": fixture["dataset_origin"],
                "rrc_viewer_url": RRC_VIEWER,
                "source_of_record": "Texas RRC",
                "raw": raw,
            }
        )
    return wells


def wells_to_feature_collection(wells: list[dict], fixture: dict) -> dict:
    features = []
    for well in wells:
        props = {k: v for k, v in well.items() if k not in {"raw", "lon", "lat"}}
        props["lon"] = well["lon"]
        props["lat"] = well["lat"]
        features.append(
            {
                "type": "Feature",
                "id": well["id"],
                "geometry": {"type": "Point", "coordinates": [well["lon"], well["lat"]]},
                "properties": props,
            }
        )
    return {
        "type": "FeatureCollection",
        "name": "cameron-wells",
        "crs_distance": "EPSG:3081",
        "dataset_origin": fixture["dataset_origin"],
        "as_of": fixture["as_of"],
        "features": features,
    }

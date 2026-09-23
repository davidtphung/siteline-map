"""In-memory well store. PostGIS uses the same records when DATABASE_URL is set."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from uuid import uuid4

from .geo import distance_miles, point_in_geojson
from .rules import well_matches


class MemoryStore:
    def __init__(self, wells: list[dict], fixture: dict, rules: dict):
        self.wells = wells
        self.by_id = {w["id"]: w for w in wells}
        self.rules = rules
        self.fixture = fixture
        payload = json.dumps(fixture, sort_keys=True).encode()
        self.imports = [
            {
                "id": "import-cameron-fixture",
                "source_name": fixture.get("source_name"),
                "filename": fixture.get("filename"),
                "checksum_sha256": hashlib.sha256(payload).hexdigest(),
                "retrieved_at": fixture.get("as_of") + "T00:00:00Z",
                "record_count": len(wells),
                "dataset_origin": fixture.get("dataset_origin"),
                "notes": fixture.get("note"),
            }
        ]
        self.sites: dict[str, dict] = {}

    def list_wells(self, flags: dict, statuses: list[str] | None = None) -> list[dict]:
        rows = [w for w in self.wells if well_matches(w, flags)]
        if statuses:
            wanted = set(statuses)
            rows = [w for w in rows if w["status_code"] in wanted]
        return rows

    def get(self, well_id: str) -> dict | None:
        return self.by_id.get(well_id)

    def search(self, query: str, flags: dict) -> list[dict]:
        q = (query or "").strip().lower()
        if not q:
            return []
        hits = []
        for well in self.list_wells(flags):
            blob = " ".join(
                [
                    well.get("api_raw") or "",
                    well.get("api_normalized") or "",
                    well.get("api10_raw") or "",
                    well.get("lease_name") or "",
                    well.get("operator_name") or "",
                    well.get("well_number") or "",
                ]
            ).lower()
            if q in blob:
                hits.append(well)
        return hits

    def within_radius(self, lon: float, lat: float, miles: float, flags: dict) -> list[dict]:
        hits = []
        for well in self.list_wells(flags):
            miles_away = distance_miles(lon, lat, well["lon"], well["lat"])
            if miles_away <= miles + 1e-9:
                hits.append({**well, "distance_miles": miles_away})
        hits.sort(key=lambda item: item["distance_miles"])
        return hits

    def within_polygon(self, geometry: dict, flags: dict) -> list[dict]:
        hits = []
        for well in self.list_wells(flags):
            if point_in_geojson(well["lon"], well["lat"], geometry):
                hits.append(well)
        return hits

    def create_site(self, body: dict) -> dict:
        site_id = body.get("id") or f"site-{uuid4().hex[:12]}"
        site = {
            "id": site_id,
            "name": body.get("name") or "Site",
            "geometry": body.get("geometry"),
            "center": body.get("center"),
            "radius_miles": body.get("radius_miles"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self.sites[site_id] = site
        return site

    def get_site(self, site_id: str) -> dict | None:
        return self.sites.get(site_id)

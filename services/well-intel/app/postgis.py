"""Optional PostGIS persistence. Queries that measure distance use EPSG:3081."""

from __future__ import annotations

from pathlib import Path

from .store import MemoryStore

SCHEMA = Path(__file__).resolve().parents[1] / "schema" / "001_init.sql"
RADIUS_SQL = """
SELECT id
FROM wells
WHERE commodity_group = ANY(%(groups)s)
  AND ST_DWithin(
    geom_3081,
    ST_Transform(ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326), 3081),
    %(meters)s
  )
"""


class PostgisStore(MemoryStore):
    """Loads the classified set into PostGIS, then serves reads from that set.

    Radius SQL is EPSG:3081. The in-memory copy stays aligned for the screening API
    so a missing spatial index cannot silently fall back to Web Mercator.
    """

    def __init__(self, dsn: str, wells: list[dict], fixture: dict, rules: dict):
        super().__init__(wells, fixture, rules)
        import psycopg

        self.dsn = dsn
        with psycopg.connect(dsn) as conn:
            conn.execute(SCHEMA.read_text(encoding="utf-8"))
            for well in wells:
                conn.execute(
                    """
                    INSERT INTO wells (
                      id, api_raw, api_normalized, api10_raw, api10_normalized,
                      county_code, county_name, state, lease_name, well_number, operator_name,
                      symnum, symnum_raw_label, commodity, commodity_raw, commodity_source,
                      commodity_confidence, commodity_group, is_gas_related, is_oil_related,
                      is_mixed_oil_gas, status_code, status_label, pa_confirmed, review_needed,
                      freshness, dataset_origin, rules_version, geom, geom_3081, raw
                    ) VALUES (
                      %(id)s, %(api_raw)s, %(api_normalized)s, %(api10_raw)s, %(api10_normalized)s,
                      %(county_code)s, %(county_name)s, %(state)s, %(lease_name)s, %(well_number)s,
                      %(operator_name)s, %(symnum)s, %(symnum_raw_label)s, %(commodity)s,
                      %(commodity_raw)s, %(commodity_source)s, %(commodity_confidence)s,
                      %(commodity_group)s, %(is_gas_related)s, %(is_oil_related)s,
                      %(is_mixed_oil_gas)s, %(status_code)s, %(status_label)s, %(pa_confirmed)s,
                      %(review_needed)s, %(freshness)s, %(dataset_origin)s, %(rules_version)s,
                      ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326),
                      ST_Transform(ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326), 3081),
                      %(raw)s::jsonb
                    )
                    ON CONFLICT (id) DO UPDATE SET
                      status_code = EXCLUDED.status_code,
                      status_label = EXCLUDED.status_label,
                      pa_confirmed = EXCLUDED.pa_confirmed,
                      geom_3081 = EXCLUDED.geom_3081
                    """,
                    {**well, "raw": __import__("json").dumps(well.get("raw") or {})},
                )
            conn.commit()

    def within_radius(self, lon: float, lat: float, miles: float, flags: dict) -> list[dict]:
        import psycopg

        groups = []
        if flags.get("include_gas"):
            groups.append("gas")
        if flags.get("include_oil"):
            groups.append("oil")
        if flags.get("include_mixed"):
            groups.append("mixed")
        if flags.get("include_other"):
            groups.append("other")
        if not groups:
            return []
        with psycopg.connect(self.dsn) as conn:
            ids = [
                row[0]
                for row in conn.execute(
                    RADIUS_SQL,
                    {"groups": groups, "lng": lon, "lat": lat, "meters": miles * 1609.344},
                ).fetchall()
            ]
        wanted = set(ids)
        hits = []
        for well in self.wells:
            if well["id"] in wanted:
                from .geo import distance_miles

                hits.append({**well, "distance_miles": distance_miles(lon, lat, well["lon"], well["lat"])})
        hits.sort(key=lambda item: item["distance_miles"])
        return hits

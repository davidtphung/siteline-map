"""Site context. Gas, oil, mixed, and other counts stay in separate buckets."""

from __future__ import annotations

from .geo import centroid_lonlat, distance_miles, point_in_geojson
from .rules import context_title, well_matches

RING_MILES = (0.25, 0.5, 1, 5, 10)


def _counts(wells: list[dict]) -> dict:
    counts: dict[str, int] = {}
    for well in wells:
        code = well["status_code"]
        counts[code] = counts.get(code, 0) + 1
    return counts


def _nearest_by_status(wells: list[dict], lon: float, lat: float) -> dict:
    best: dict[str, dict] = {}
    for well in wells:
        miles = distance_miles(lon, lat, well["lon"], well["lat"])
        code = well["status_code"]
        current = best.get(code)
        if current is None or miles < current["distance_miles"]:
            best[code] = {
                "id": well["id"],
                "api_raw": well["api_raw"],
                "api_normalized": well["api_normalized"],
                "status_code": code,
                "status_label": well["status_label"],
                "commodity": well["commodity"],
                "distance_miles": round(miles, 4),
                "distance_crs": "EPSG:3081",
            }
    return best


def _public_well(well: dict, miles: float | None = None) -> dict:
    out = {
        "id": well["id"],
        "api_raw": well["api_raw"],
        "api_normalized": well["api_normalized"],
        "api10_raw": well.get("api10_raw") or "",
        "commodity": well["commodity"],
        "commodity_group": well["commodity_group"],
        "commodity_confidence": well["commodity_confidence"],
        "commodity_source": well["commodity_source"],
        "is_gas_related": well["is_gas_related"],
        "is_oil_related": well["is_oil_related"],
        "is_mixed_oil_gas": well["is_mixed_oil_gas"],
        "status_code": well["status_code"],
        "status_label": well["status_label"],
        "status_color": well["status_color"],
        "pa_confirmed": well["pa_confirmed"],
        "review_needed": well["review_needed"],
        "freshness": well["freshness"],
        "symnum": well["symnum"],
        "lease_name": well.get("lease_name"),
        "operator_name": well.get("operator_name"),
        "dataset_origin": well.get("dataset_origin"),
        "county_code": well.get("county_code"),
        "county_name": well.get("county_name"),
        "rrc_viewer_url": well.get("rrc_viewer_url"),
        "rules_version": well.get("rules_version"),
        "lon": well["lon"],
        "lat": well["lat"],
    }
    if miles is not None:
        out["distance_miles"] = round(miles, 4)
        out["distance_crs"] = "EPSG:3081"
    return out


def separated_counts(wells: list[dict]) -> dict:
    groups = {"gas": [], "oil": [], "mixed": [], "other": []}
    for well in wells:
        groups[well["commodity_group"]].append(well)
    return {
        name: {"well_count": len(rows), "counts_by_status": _counts(rows)}
        for name, rows in groups.items()
    }


def build_context(store, site: dict, flags: dict, rules: dict) -> dict:
    wells = store.wells
    center = site.get("center")
    geometry = site.get("geometry")
    if geometry and not center:
        center = centroid_lonlat(geometry)
    if isinstance(center, dict):
        center = [center.get("lon"), center.get("lat")]
    lon = lat = None
    if center and len(center) >= 2 and center[0] is not None:
        lon, lat = float(center[0]), float(center[1])

    enabled = [w for w in wells if well_matches(w, flags)]
    polygon_hits = []
    if geometry:
        polygon_hits = [w for w in enabled if point_in_geojson(w["lon"], w["lat"], geometry)]

    rings = {}
    if lon is not None:
        for miles in rules.get("rings_miles") or RING_MILES:
            inside = []
            for well in enabled:
                away = distance_miles(lon, lat, well["lon"], well["lat"])
                if away <= float(miles) + 1e-9:
                    inside.append(well)
            rings[str(miles)] = {
                "miles": miles,
                "crs": "EPSG:3081",
                "well_count": len(inside),
                "counts_by_status": _counts(inside),
                "review_needed_count": sum(1 for w in inside if w["review_needed"]),
            }

    focus = polygon_hits if geometry else enabled
    nearest = _nearest_by_status(enabled, lon, lat) if lon is not None else {}
    stale = sum(1 for w in focus if w["freshness"] == "May be stale")
    return {
        "title": context_title(flags, rules),
        "enabled": flags,
        "site_id": site.get("id"),
        "counts_by_status": _counts(polygon_hits if geometry else enabled),
        "well_count": len(polygon_hits if geometry else enabled),
        "polygon": None
        if not geometry
        else {
            "well_count": len(polygon_hits),
            "counts_by_status": _counts(polygon_hits),
            "review_needed_count": sum(1 for w in polygon_hits if w["review_needed"]),
        },
        "rings": rings,
        "nearest_by_status": nearest,
        "review_needed_count": sum(1 for w in focus if w["review_needed"]),
        "freshness": {
            "may_be_stale_count": stale,
            "as_of": store.fixture.get("as_of"),
            "label": "May be stale" if stale else "See each well",
        },
        "separated": {
            name: bucket
            for name, bucket in separated_counts(wells).items()
            if flags.get("include_" + name)
        },
        "disclaimers": list(rules["disclaimers"]),
        "dataset_origin": store.fixture.get("dataset_origin"),
        "distance_crs": "EPSG:3081",
        "rules_version": rules["version"],
    }


def feature_collection(wells: list[dict]) -> dict:
    features = []
    for well in wells:
        miles = well.get("distance_miles")
        props = _public_well(well, miles)
        features.append(
            {
                "type": "Feature",
                "id": well["id"],
                "geometry": {"type": "Point", "coordinates": [well["lon"], well["lat"]]},
                "properties": props,
            }
        )
    return {"type": "FeatureCollection", "features": features, "crs_distance": "EPSG:3081"}

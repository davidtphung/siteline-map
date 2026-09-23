"""Bounded ArcGIS queries. No national where clause and no wildcard field list."""

from __future__ import annotations

from urllib.parse import urlencode

WHERE = "API IS NOT NULL"


def build_query_url(
    service: str,
    layer_id: int,
    bbox: tuple[float, float, float, float],
    out_fields: str,
    *,
    count_only: bool = False,
    offset: int = 0,
    page: int = 1000,
) -> str:
    fields = (out_fields or "").strip()
    if not count_only and (not fields or fields == "*"):
        raise ValueError("outFields must name columns")
    if "1=1" in WHERE.replace(" ", ""):
        raise ValueError("unbounded where is not allowed")
    west, south, east, north = bbox
    if east <= west or north <= south:
        raise ValueError("bbox is empty")
    params = {
        "f": "json",
        "where": WHERE,
        "geometry": f"{west},{south},{east},{north}",
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "returnGeometry": "false" if count_only else "true",
        "outSR": "4326",
    }
    if count_only:
        params["returnCountOnly"] = "true"
    else:
        params["outFields"] = fields
        params["orderByFields"] = "OBJECTID"
        params["resultOffset"] = str(max(0, offset))
        params["resultRecordCount"] = str(max(1, page))
    root = service.rstrip("/")
    return f"{root}/{int(layer_id)}/query?{urlencode(params)}"


def service_metadata_url(service: str) -> str:
    root = service.rstrip("/")
    if root.endswith("/query"):
        raise ValueError("service url must be the layer root, not a query")
    return root + "?f=json"


def layers_by_name(metadata: dict) -> dict[str, int]:
    found = {}
    for layer in metadata.get("layers") or []:
        name = layer.get("name")
        if name is not None and layer.get("id") is not None:
            found[str(name)] = int(layer["id"])
    return found

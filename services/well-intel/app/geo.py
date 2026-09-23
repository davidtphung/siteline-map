"""Projected distance and containment in EPSG:3081. Not Web Mercator."""

from __future__ import annotations

from pyproj import Transformer
from shapely.geometry import Point, shape
from shapely.ops import transform

METERS_PER_MILE = 1609.344
CRS = "EPSG:3081"

_TO_3081 = Transformer.from_crs("EPSG:4326", CRS, always_xy=True)
_TO_4326 = Transformer.from_crs(CRS, "EPSG:4326", always_xy=True)


def to_3081(lon: float, lat: float) -> tuple[float, float]:
    x, y = _TO_3081.transform(lon, lat)
    return float(x), float(y)


def to_4326(x: float, y: float) -> tuple[float, float]:
    lon, lat = _TO_4326.transform(x, y)
    return float(lon), float(lat)


def distance_meters(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    x1, y1 = to_3081(lon1, lat1)
    x2, y2 = to_3081(lon2, lat2)
    return ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5


def distance_miles(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    return distance_meters(lon1, lat1, lon2, lat2) / METERS_PER_MILE


def offset_lonlat(lon: float, lat: float, east_m: float, north_m: float) -> tuple[float, float]:
    x, y = to_3081(lon, lat)
    return to_4326(x + east_m, y + north_m)


def _project_geom(geom):
    return transform(lambda x, y, z=None: to_3081(x, y), geom)


def point_in_geojson(lon: float, lat: float, geometry: dict) -> bool:
    if not geometry:
        return False
    projected = _project_geom(shape(geometry))
    return bool(projected.covers(Point(to_3081(lon, lat))))


def ring_polygon(lon: float, lat: float, miles: float, steps: int = 64) -> dict:
    cx, cy = to_3081(lon, lat)
    radius = miles * METERS_PER_MILE
    coords = []
    import math

    for i in range(steps + 1):
        theta = (2 * math.pi * i) / steps
        coords.append(list(to_4326(cx + radius * math.sin(theta), cy + radius * math.cos(theta))))
    return {"type": "Polygon", "coordinates": [coords]}


def centroid_lonlat(geometry: dict) -> tuple[float, float] | None:
    if not geometry:
        return None
    projected = _project_geom(shape(geometry))
    c = projected.centroid
    return to_4326(c.x, c.y)

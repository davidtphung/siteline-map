"""Viewport well query. Texas RRC and New Mexico OCD, bounded by the map."""

from __future__ import annotations

import copy
import json
import logging
import os
import threading
import time
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

from .adapt import (
    NM_FIELDS,
    NM_SOURCE,
    ORPHAN_FIELDS,
    TX_FIELDS,
    TX_SOURCE,
    adapt_nm_row,
    adapt_texas_rows,
    merge_nm_wells,
)
from .api_numbers import normalize_api
from .arcgis import build_query_url, layers_by_name, service_metadata_url
from .geo import offset_lonlat
from .rules import well_matches

logger = logging.getLogger("siteline.wells")

ROOT = Path(__file__).resolve().parents[3]
SOURCES_PATH = Path(os.environ.get("WELL_SOURCES_PATH", str(ROOT / "config" / "well-sources.json")))

STATE_EXTENTS = {
    "TX": (-106.65, 25.83, -93.51, 36.50),
    "NM": (-109.05, 31.33, -103.00, 37.00),
    "CO": (-109.06, 36.99, -102.04, 41.00),
    "OK": (-103.00, 33.62, -94.43, 37.00),
}

_GEOHASH = "0123456789bcdefghjkmnpqrstuvwxyz"


class UpstreamError(Exception):
    pass


def load_sources(path: Path | None = None) -> dict:
    with Path(path or SOURCES_PATH).open(encoding="utf-8") as fh:
        return json.load(fh)


def stale_hours() -> float:
    raw = os.environ.get("WELL_STALE_HOURS", "12")
    try:
        hours = float(raw)
    except ValueError:
        hours = 12.0
    return min(24.0, max(6.0, hours))


def parse_bbox(raw: str) -> tuple[float, float, float, float]:
    parts = [float(piece.strip()) for piece in str(raw).split(",")]
    if len(parts) != 4 or not all(map(_finite, parts)):
        raise ValueError("bbox must be west,south,east,north")
    west, south, east, north = parts
    if west < -180 or east > 180 or south < -90 or north > 90:
        raise ValueError("bbox is outside WGS84")
    if east <= west or north <= south:
        raise ValueError("bbox is empty")
    return west, south, east, north


def _finite(value: float) -> bool:
    return value == value and abs(value) != float("inf")


def buffer_bbox(bbox: tuple[float, float, float, float], miles: float) -> tuple[float, float, float, float]:
    """Expand an envelope in EPSG:3081. Web Mercator is not used."""
    west, south, east, north = bbox
    if miles <= 0:
        return bbox
    meters = miles * 1609.344
    mid_lat = (south + north) / 2
    mid_lon = (west + east) / 2
    west2, _ = offset_lonlat(west, mid_lat, -meters, 0)
    east2, _ = offset_lonlat(east, mid_lat, meters, 0)
    _, south2 = offset_lonlat(mid_lon, south, 0, -meters)
    _, north2 = offset_lonlat(mid_lon, north, 0, meters)
    west2 = max(-180.0, west2)
    east2 = min(180.0, east2)
    south2 = max(-90.0, south2)
    north2 = min(90.0, north2)
    if east2 <= west2 or north2 <= south2:
        raise ValueError("buffered bbox is empty")
    return west2, south2, east2, north2


def overlaps(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> bool:
    return a[0] <= b[2] and a[2] >= b[0] and a[1] <= b[3] and a[3] >= b[1]


def geohash5(lon: float, lat: float) -> str:
    lat_r = [-90.0, 90.0]
    lon_r = [-180.0, 180.0]
    bits = []
    even = True
    while len(bits) < 25:
        if even:
            mid = (lon_r[0] + lon_r[1]) / 2
            if lon >= mid:
                bits.append(1)
                lon_r[0] = mid
            else:
                bits.append(0)
                lon_r[1] = mid
        else:
            mid = (lat_r[0] + lat_r[1]) / 2
            if lat >= mid:
                bits.append(1)
                lat_r[0] = mid
            else:
                bits.append(0)
                lat_r[1] = mid
        even = not even
    chars = []
    for i in range(0, 25, 5):
        value = 0
        for bit in bits[i : i + 5]:
            value = (value << 1) | bit
        chars.append(_GEOHASH[value])
    return "".join(chars)


def urllib_transport(url: str, timeout: float = 25) -> dict:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "SitelineMap/1.0 (nlt143.energy; research)",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


class ResponseCache:
    def __init__(self, hours: float, directory: str | None = None):
        self.ttl = hours * 3600
        self.directory = Path(directory) if directory else None
        self._mem: dict[str, tuple[float, dict]] = {}
        self._lock = threading.Lock()

    def get(self, key: str, allow_stale: bool = False) -> dict | None:
        now = time.time()
        with self._lock:
            hit = self._mem.get(key)
            if hit and (allow_stale or now - hit[0] <= self.ttl):
                return copy.deepcopy(hit[1])
        if not self.directory:
            return None
        path = self.directory / f"{_safe(key)}.json"
        if not path.exists():
            return None
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        age = now - float(payload.get("_stored_at") or 0)
        if not allow_stale and age > self.ttl:
            return None
        body = payload.get("body")
        return copy.deepcopy(body) if isinstance(body, dict) else None

    def put(self, key: str, body: dict) -> None:
        stored = copy.deepcopy(body)
        with self._lock:
            self._mem[key] = (time.time(), stored)
            if len(self._mem) > 48:
                oldest = min(self._mem, key=lambda item: self._mem[item][0])
                self._mem.pop(oldest, None)
        if not self.directory:
            return
        self.directory.mkdir(parents=True, exist_ok=True)
        path = self.directory / f"{_safe(key)}.json"
        path.write_text(
            json.dumps({"_stored_at": time.time(), "body": stored}),
            encoding="utf-8",
        )


def _safe(key: str) -> str:
    return "".join(ch if ch.isalnum() else "_" for ch in key)[:180]


def _cluster(lon: float, lat: float, count: int, origin: str) -> dict:
    return {
        "type": "Feature",
        "id": f"cluster-{lon:.3f}-{lat:.3f}",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": {
            "id": f"cluster-{lon:.3f}-{lat:.3f}",
            "well_count": count,
            "status_code": "cluster",
            "status_label": "Well count in this cell",
            "status_color": "#4da3ff",
            "dataset_origin": origin,
            "pa_confirmed": False,
            "review_needed": True,
            "commodity_group": "other",
            "lon": lon,
            "lat": lat,
        },
    }


def _feature(well: dict) -> dict:
    props = dict(well)
    props["lon"] = well["lon"]
    props["lat"] = well["lat"]
    return {
        "type": "Feature",
        "id": well["id"],
        "geometry": {"type": "Point", "coordinates": [well["lon"], well["lat"]]},
        "properties": props,
    }


class LiveCatalog:
    def __init__(self, rules: dict, transport=None, sources: dict | None = None, cache: ResponseCache | None = None):
        self.rules = rules
        self.transport = transport or urllib_transport
        self.sources = sources or load_sources()
        self.cache = cache or ResponseCache(
            stale_hours(),
            os.environ.get("WELL_CACHE_DIR") or None,
        )
        self._meta: dict[str, dict] = {}
        self._health: tuple[float, dict] | None = None

    def _source(self, source_id: str) -> dict:
        for source in self.sources.get("sources") or []:
            if source.get("id") == source_id:
                found = dict(source)
                break
        else:
            found = {}
        if source_id == "tx_rrc_public_viewer" and os.environ.get("RRC_FEATURE_URL"):
            found["service"] = os.environ["RRC_FEATURE_URL"]
        if source_id == "nm_ocd_wells_v3" and os.environ.get("NM_OCD_URL"):
            found["service"] = os.environ["NM_OCD_URL"]
        if source_id == "co_ecmc_ogcc_wells" and os.environ.get("CO_ECMC_URL"):
            found["service"] = os.environ["CO_ECMC_URL"]
        if source_id == "ok_occ_rbdms" and os.environ.get("OCC_URL"):
            found["service"] = os.environ["OCC_URL"]
        return found

    def _get(self, url: str, timeout: float = 25) -> dict:
        try:
            data = self.transport(url, timeout=timeout)
        except TypeError:
            data = self.transport(url)
        if not isinstance(data, dict):
            raise UpstreamError("source did not return JSON")
        if data.get("error"):
            raise UpstreamError(str(data["error"].get("message") or "source error"))
        return data

    def _metadata(self, service: str) -> dict:
        cached = self._meta.get(service)
        if cached:
            return cached
        data = self._get(service_metadata_url(service), timeout=20)
        self._meta[service] = data
        return data

    def _layer_id(self, service: str, name: str) -> int | None:
        return layers_by_name(self._metadata(service)).get(name)

    def health(self) -> dict:
        now = time.time()
        if self._health and now - self._health[0] < 600:
            return copy.deepcopy(self._health[1])
        probes = []
        for source_id, timeout in (
            ("tx_rrc_public_viewer", 20),
            ("nm_ocd_wells_v3", 20),
            ("co_ecmc_ogcc_wells", 8),
            ("ok_occ_rbdms", 8),
        ):
            probes.append(self._probe(source_id, timeout))
        enabled = [row for row in probes if row.get("query_enabled")]
        ok = any(row.get("ok") for row in enabled)
        degraded = any(not row.get("ok") for row in enabled)
        body = {
            "ok": ok,
            "degraded": degraded,
            "checked_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "distance_crs": "EPSG:3081",
            "sources": probes,
        }
        self._health = (now, body)
        return copy.deepcopy(body)

    def _probe(self, source_id: str, timeout: float) -> dict:
        source = self._source(source_id)
        service = source.get("service") or ""
        started = time.time()
        row = {
            "id": source_id,
            "role": source.get("role"),
            "query_enabled": bool(source.get("query_enabled")),
            "service": service,
            "ok": False,
            "layers": [],
            "error": "",
        }
        if not service:
            row["error"] = "service url missing"
            row["latency_ms"] = 0
            return row
        try:
            meta = self._get(service_metadata_url(service), timeout=timeout)
            self._meta[service] = meta
            layers = [
                {"id": layer.get("id"), "name": layer.get("name")}
                for layer in (meta.get("layers") or [])
                if layer.get("name")
            ]
            if not layers and meta.get("name"):
                layers = [{"id": meta.get("id", 0), "name": meta.get("name")}]
            row["layers"] = layers
            row["ok"] = True
        except Exception as exc:  # noqa: BLE001 - probe records the failure
            row["error"] = exc.__class__.__name__
        row["latency_ms"] = int((time.time() - started) * 1000)
        logger.info(
            "wells health source=%s ok=%s latency_ms=%s layers=%s",
            source_id,
            row["ok"],
            row["latency_ms"],
            len(row["layers"]),
        )
        return row

    def query(
        self,
        *,
        bbox: tuple[float, float, float, float],
        zoom: float | None,
        limit: int,
        states: list[str] | None,
        flags: dict,
        as_of: str | None = None,
    ) -> tuple[int, dict]:
        started = time.time()
        as_of = as_of or date.today().isoformat()
        cap = int(self.rules.get("max_features") or 5000)
        limit = max(1, min(int(limit or cap), cap))
        too_wide = (bbox[2] - bbox[0]) > 8 or (bbox[3] - bbox[1]) > 8
        if too_wide:
            body = self._envelope(
                [],
                origin="state_sor",
                as_of=as_of,
                mode="zoom_in",
                message=(
                    "This extent is too wide to query. Zoom in. "
                    "Siteline does not download a national well set."
                ),
                matched=None,
            )
            body["error"] = "zoom_in"
            return 413, body

        wanted = self._states(bbox, states)
        sor = [code for code in wanted if code in {"TX", "NM"}]
        if not sor:
            return 200, self._empty_outside(bbox, as_of, wanted)

        clusters = self._cluster_zoom(zoom, bbox)
        key = self._cache_key(bbox, zoom, flags, sor, "clusters" if clusters else "features", limit)
        cached = self.cache.get(key)
        if cached:
            cached["cached"] = True
            return int(cached.pop("_status", 200)), cached

        try:
            status, body = self._query_sources(
                bbox, sor, flags, as_of, limit, clusters, started
            )
        except UpstreamError:
            stale = self.cache.get(key, allow_stale=True)
            if stale:
                stale["stale"] = True
                stale["cached"] = True
                stale["message"] = "Showing the last good load for this view. A source check failed."
                return 200, stale
            body = self._envelope(
                [],
                origin="state_sor",
                as_of=as_of,
                mode="error",
                message="The state well service did not answer for this view. No wells were estimated.",
                matched=0,
            )
            body["stale"] = False
            return 502, body
        body["_status"] = status
        if status == 200 and body.get("mode") != "error":
            self.cache.put(key, body)
        body = copy.deepcopy(body)
        body.pop("_status", None)
        return status, body

    def _query_sources(self, bbox, sor, flags, as_of, limit, clusters, started) -> tuple[int, dict]:
        counts = {}
        errors = []
        if "TX" in sor:
            try:
                counts["TX"] = self._tx_count(bbox)
            except (UpstreamError, LookupError) as exc:
                errors.append(f"Texas RRC: {exc}")
        if "NM" in sor:
            try:
                counts["NM"] = self._nm_count(bbox)
            except (UpstreamError, LookupError) as exc:
                errors.append(f"New Mexico OCD: {exc}")
        if not counts:
            raise UpstreamError("; ".join(errors) or "no source")
        matched = sum(counts.values())
        origin = "rrc_public_viewer" if list(counts) == ["TX"] else "state_sor"
        if "NM" in counts and "TX" not in counts:
            origin = "nm_ocd"
        note = ""
        if errors:
            note = " ".join(errors) + " Those wells were omitted, not estimated."
        min_zoom = float(self.rules.get("live_min_zoom") or 7)
        above = int(self.rules.get("cluster_above_count") or 20000)
        if not clusters and matched > above:
            body = self._envelope(
                [],
                origin=origin,
                as_of=as_of,
                mode="zoom_in",
                message=(
                    f"This view has {matched} wells, above {above}. Zoom in. "
                    "Individual status dots were not drawn."
                ),
                matched=matched,
            )
            body["error"] = "zoom_in"
            body["message"] = (body["message"] + " " + note).strip()
            self._log(counts, bbox, None, matched, started, "zoom_in")
            return 413, body
        if clusters or matched > limit:
            features = self._cluster_grid(bbox, sor, counts)
            message = (
                f"Zoom to {min_zoom:g} or closer for individual wells. "
                "Cell counts are not a status and include every commodity."
            )
            if not clusters and matched > limit:
                message = (
                    f"{matched} wells in this view, above the {limit} cap. "
                    "Zoom in for individual status. A partial extract was not drawn."
                )
            body = self._envelope(
                features,
                origin=origin,
                as_of=as_of,
                mode="clusters",
                message=(message + " " + note).strip(),
                matched=matched,
            )
            self._log(counts, bbox, None, matched, started, "clusters")
            return 200, body
        wells = []
        if "TX" in counts:
            wells.extend(self._tx_wells(bbox, as_of, limit))
        if "NM" in counts:
            wells.extend(self._nm_wells(bbox, as_of, limit))
        wells = [well for well in wells if well_matches(well, flags)]
        features = [_feature(well) for well in wells[:limit]]
        message = note
        if matched == 0:
            message = (note + " " + self._zero_message(bbox)).strip()
        body = self._envelope(
            features,
            origin=origin,
            as_of=as_of,
            mode="features",
            message=message,
            matched=matched,
        )
        body["orphan_layer"] = "rrc_orphan_wells" if "TX" in counts else ""
        self._log(counts, bbox, None, matched, started, "features")
        return 200, body

    def _tx_service(self) -> str:
        return self._source("tx_rrc_public_viewer").get("service") or TX_SOURCE

    def _nm_service(self) -> str:
        return self._source("nm_ocd_wells_v3").get("service") or NM_SOURCE

    def _tx_ids(self) -> dict[str, int]:
        service = self._tx_service()
        names = layers_by_name(self._metadata(service))
        if "Well Locations" not in names:
            raise LookupError("Well Locations layer was not in the RRC service metadata")
        return {
            "wells": names["Well Locations"],
            "orphan": names.get("Orphan Wells"),
            "injection": names.get("Injection/Disposal"),
        }

    def _nm_ids(self) -> list[int]:
        names = layers_by_name(self._metadata(self._nm_service()))
        ids = []
        for name in ("NMOCD_Active", "NMOCD_Inactive"):
            if name in names:
                ids.append(names[name])
        if not ids:
            raise LookupError("NMOCD well layers were not in the service metadata")
        return ids

    def _tx_count(self, bbox) -> int:
        return self._count(self._tx_service(), self._tx_ids()["wells"], bbox)

    def _nm_count(self, bbox) -> int:
        return sum(self._count(self._nm_service(), layer_id, bbox) for layer_id in self._nm_ids())

    def _count(self, service: str, layer_id: int, bbox) -> int:
        url = build_query_url(service, layer_id, bbox, "API", count_only=True)
        data = self._get(url)
        if "count" not in data:
            raise UpstreamError("count missing")
        return int(data["count"])

    def _pages(self, service: str, layer_id: int, bbox, fields: str, limit: int) -> list[dict]:
        rows: list[dict] = []
        offset = 0
        while len(rows) < limit and offset <= 20000:
            page = min(1000, limit - len(rows))
            url = build_query_url(service, layer_id, bbox, fields, offset=offset, page=page)
            data = self._get(url)
            feats = data.get("features") or []
            rows.extend(feats)
            if len(feats) < page:
                break
            offset += len(feats)
        return rows

    def _tx_wells(self, bbox, as_of: str, limit: int) -> list[dict]:
        service = self._tx_service()
        ids = self._tx_ids()
        rows = self._pages(service, ids["wells"], bbox, TX_FIELDS, limit)
        orphan: set[str] = set()
        if ids.get("orphan") is not None:
            for row in self._pages(service, ids["orphan"], bbox, ORPHAN_FIELDS, limit):
                api = str((row.get("attributes") or {}).get("API") or "")
                norm = normalize_api(api)
                if len(norm) == 8:
                    orphan.add(norm)
        wells = adapt_texas_rows(rows, orphan, self.rules, as_of=as_of, source_url=service)
        if ids.get("injection") is not None:
            known = {well["api_normalized"] for well in wells}
            extra = []
            for row in self._pages(service, ids["injection"], bbox, ORPHAN_FIELDS, limit):
                attrs = row.get("attributes") or {}
                norm = normalize_api(attrs.get("API"))
                if len(norm) != 8 or norm in known:
                    continue
                geometry = row.get("geometry") or {}
                if geometry.get("x") is None:
                    continue
                extra.append(
                    {
                        "attributes": {
                            "API": attrs.get("API"),
                            "SYMNUM": 11,
                            "GIS_SYMBOL_DESCRIPTION": "Injection/Disposal",
                            "GIS_WELL_NUMBER": "",
                            "GIS_LONG83": geometry.get("x"),
                            "GIS_LAT83": geometry.get("y"),
                        },
                        "geometry": geometry,
                    }
                )
            wells.extend(adapt_texas_rows(extra, orphan, self.rules, as_of=as_of, source_url=service))
        return wells

    def _nm_wells(self, bbox, as_of: str, limit: int) -> list[dict]:
        service = self._nm_service()
        rows = []
        for layer_id in self._nm_ids():
            for raw in self._pages(service, layer_id, bbox, NM_FIELDS, limit):
                rows.append(adapt_nm_row(raw, self.rules, as_of=as_of, source_url=service))
        return merge_nm_wells(rows)

    def _cluster_grid(self, bbox, sor, totals: dict[str, int]) -> list[dict]:
        west, south, east, north = bbox
        features = []
        step_lon = (east - west) / 3
        step_lat = (north - south) / 3
        for ix in range(3):
            for iy in range(3):
                cell = (
                    west + ix * step_lon,
                    south + iy * step_lat,
                    west + (ix + 1) * step_lon,
                    south + (iy + 1) * step_lat,
                )
                count = 0
                try:
                    if "TX" in sor and "TX" in totals:
                        count += self._tx_count(cell)
                    if "NM" in sor and "NM" in totals:
                        count += self._nm_count(cell)
                except (UpstreamError, LookupError):
                    continue
                if count:
                    features.append(
                        _cluster((cell[0] + cell[2]) / 2, (cell[1] + cell[3]) / 2, count, "state_sor")
                    )
        if not features and sum(totals.values()):
            features.append(
                _cluster((west + east) / 2, (south + north) / 2, sum(totals.values()), "state_sor")
            )
        return features

    def _states(self, bbox, requested: list[str] | None) -> list[str]:
        found = [code for code, box in STATE_EXTENTS.items() if overlaps(bbox, box)]
        if requested:
            allow = {code.strip().upper() for code in requested if code.strip()}
            found = [code for code in found if code in allow]
        return found

    def _cluster_zoom(self, zoom: float | None, bbox) -> bool:
        minimum = float(self.rules.get("live_min_zoom") or 7)
        if zoom is not None and zoom < minimum:
            return True
        if zoom is None and ((bbox[2] - bbox[0]) > 1.5 or (bbox[3] - bbox[1]) > 1.5):
            return True
        return False

    def _cache_key(self, bbox, zoom, flags, states, mode, limit) -> str:
        cx = (bbox[0] + bbox[2]) / 2
        cy = (bbox[1] + bbox[3]) / 2
        rounded = ",".join(f"{value:.2f}" for value in bbox)
        flag = "".join("1" if flags.get(key) else "0" for key in (
            "include_gas",
            "include_oil",
            "include_mixed",
            "include_other",
        ))
        bucket = "na" if zoom is None else str(int(zoom))
        return f"{geohash5(cx, cy)}|{bucket}|{flag}|{','.join(states)}|{mode}|{limit}|{rounded}"

    def _zero_message(self, bbox) -> str:
        ashburn = self._ashburn_box()
        if ashburn and overlaps(bbox, ashburn):
            return (
                "No oil or gas wells from a state system of record in this view. "
                "An empty result is expected near Ashburn. NETL is not used to fill this view."
            )
        return "No wells from the state system of record in this envelope."

    def _empty_outside(self, bbox, as_of: str, states: list[str]) -> dict:
        ashburn = self._ashburn_box()
        if ashburn and overlaps(bbox, ashburn):
            message = (
                "No oil or gas wells from a state system of record in this view. "
                "An empty result is expected near Ashburn. NETL is not used to fill this view."
            )
        elif "CO" in states:
            message = (
                "Colorado ECMC wells were not drawn. The status crosswalk is not verified, "
                "so this view stays empty rather than guessing."
            )
        elif "OK" in states:
            message = (
                "Oklahoma OCC wells were not drawn. The public layer crosswalk is not verified, "
                "so this view stays empty rather than guessing."
            )
        else:
            message = (
                "No state system of record is queried for this view. "
                "NETL is not used to fill it."
            )
        return self._envelope([], origin="state_sor", as_of=as_of, mode="features", message=message, matched=0)

    def _ashburn_box(self) -> tuple[float, float, float, float] | None:
        raw = ((self.sources.get("aois") or {}).get("ashburn") or {}).get("bbox")
        if not raw or len(raw) != 4:
            raw = (self.rules.get("aois") or {}).get("ashburn", {}).get("bbox")
        if not raw or len(raw) != 4:
            return None
        return tuple(raw)

    def _envelope(self, features, *, origin, as_of, mode, message, matched) -> dict:
        tx = self._source("tx_rrc_public_viewer")
        nm = self._source("nm_ocd_wells_v3")
        return {
            "type": "FeatureCollection",
            "name": "siteline-wells",
            "mode": mode,
            "crs_distance": "EPSG:3081",
            "dataset_origin": origin,
            "as_of": as_of,
            "stale": False,
            "cached": False,
            "confidence": "screening",
            "matched_count": 0 if matched is None else matched,
            "returned_count": len(features),
            "message": message,
            "attribution": [
                {
                    "name": "Texas Railroad Commission",
                    "url": tx.get("service") or TX_SOURCE,
                    "role": "System of record for Texas wells",
                },
                {
                    "name": "New Mexico Oil Conservation Division",
                    "url": nm.get("service") or NM_SOURCE,
                    "role": "System of record for New Mexico wells",
                },
            ],
            "disclaimers": list(self.rules.get("disclaimers") or []),
            "features": features,
        }

    def _log(self, counts, bbox, zoom, matched, started, mode) -> None:
        logger.info(
            "wells source=%s bbox=%s count=%s latency_ms=%s mode=%s",
            ",".join(f"{key}:{value}" for key, value in counts.items()),
            [round(value, 3) for value in bbox],
            matched,
            int((time.time() - started) * 1000),
            mode,
        )



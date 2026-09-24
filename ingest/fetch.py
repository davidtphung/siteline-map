"""Pull official well sources and normalize one schema."""

import json
import os
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

from ingest.status_map import commodity_for, status_class

SCHEMA = (
    "api",
    "name",
    "operator",
    "state",
    "commodity",
    "status_raw",
    "status_class",
    "status_date",
    "last_prod_date",
    "lat",
    "lon",
    "source_name",
    "source_url",
    "source_updated",
    "fetched_at_utc",
)


def utc_now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _get(url, user_agent, timeout=45):
    req = urllib.request.Request(url, headers={"User-Agent": user_agent, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _get_json(url, user_agent, timeout=90):
    raw = _get(url, user_agent, timeout=timeout)
    return json.loads(raw.decode("utf-8", "replace"))


def _first(attrs, keys):
    for key in keys or []:
        if key in attrs and attrs[key] not in (None, ""):
            return attrs[key]
        short = key.split(".")[-1]
        if short in attrs and attrs[short] not in (None, ""):
            return attrs[short]
        for attr_key, value in attrs.items():
            if attr_key.split(".")[-1].lower() == short.lower() and value not in (None, ""):
                return value
    return None


def _join(attrs, keys):
    parts = []
    for key in keys or []:
        value = _first(attrs, [key])
        if value is None:
            continue
        text = str(value).strip()
        if text and text not in parts:
            parts.append(text)
    return " ".join(parts).strip()


def _date(value):
    if value in (None, ""):
        return ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        number = int(value)
        if number > 30000000:
            year = datetime.fromtimestamp(number / 1000, timezone.utc).year
            if year >= 2100 or year < 1900:
                return ""
            return datetime.fromtimestamp(number / 1000, timezone.utc).strftime("%Y-%m-%d")
        text = str(number)
        if len(text) == 8 and text.startswith("20"):
            if text.startswith("2099"):
                return ""
            return f"{text[0:4]}-{text[4:6]}-{text[6:8]}"
        if 1900 <= number <= 2100:
            return str(number)
        return ""
    text = str(value).strip()
    if not text or text.startswith("9999") or text.startswith("2099"):
        return ""
    if "T" in text:
        text = text.split("T", 1)[0]
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        return text[:10]
    return text[:32]


def _float(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:
        return None
    return number


def _api(value):
    if value is None:
        return ""
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return str(value).rstrip("0").rstrip(".")
    return str(value).strip()


def normalize(src, attrs, geom, fetched_at, force_class=None, force_status=None):
    lng = None
    lat = None
    if isinstance(geom, dict):
        lng = _float(geom.get("x"))
        lat = _float(geom.get("y"))
    if lng is None:
        lng = _float(_first(attrs, src.get("lon") or []))
    if lat is None:
        lat = _float(_first(attrs, src.get("lat") or []))
    if lng is None or lat is None:
        return None
    if not (-180 <= lng <= -50 and 15 <= lat <= 75):
        return None
    raw_type = _join(attrs, src.get("type_fields") or [])
    raw_status = force_status or _first(attrs, src.get("status") or [])
    raw_status = "" if raw_status is None else str(raw_status).strip()
    if src.get("plugged_flag"):
        flag = raw_status.upper()
        kind = "plugged" if flag in {"Y", "YES", "TRUE", "1", "-1", "PLUGGED"} else "active"
    elif force_class:
        kind = force_class
    else:
        kind = status_class(raw_status, src["status_table"])
        if src["state"] == "IL" and "plugged" in raw_status.casefold():
            kind = "plugged"
        elif src["state"] == "IL" and kind == "unknown" and raw_status:
            kind = "active"
        elif src["state"] == "AK" and "GAS" in raw_status.upper() and kind == "unknown":
            kind = "active"
    dates = [_date(_first(attrs, [key])) for key in (src.get("date_fields") or [])]
    dates = [item for item in dates if item]
    status_date = dates[0] if dates else ""
    last_prod = ""
    if src["state"] == "NM":
        last_prod = _date(_first(attrs, ["last_production_date"]))
        status_date = last_prod or status_date
    if src["state"] == "OH" and len(dates) > 1 and kind == "active":
        status_date = dates[0]
    commodity = commodity_for(src["state"], raw_type)
    if src["state"] == "ND" and raw_type.upper() == "OG":
        commodity = "oil_gas_combined"
    if src["state"] == "TX":
        commodity = commodity_for("TX", raw_status if raw_status in {"Oil/Gas Well", "Plugged Oil / Gas"} else raw_type)
        if raw_status in {"Oil/Gas Well", "Plugged Oil / Gas"}:
            commodity = "oil_gas_combined"
    record = {
        "api": _api(_first(attrs, src.get("api") or [])),
        "name": _join(attrs, src.get("name") or []) or "Well",
        "operator": _join(attrs, src.get("operator") or []),
        "state": src["state"],
        "commodity": commodity,
        "status_raw": raw_status or "UNKNOWN",
        "status_class": kind,
        "status_date": status_date or "UNKNOWN",
        "last_prod_date": last_prod,
        "lat": round(lat, 6),
        "lon": round(lng, 6),
        "source_name": src["source_name"],
        "source_url": src["source_url"],
        "source_updated": src.get("source_updated") or "UNKNOWN",
        "fetched_at_utc": fetched_at,
    }
    return record


def _query_url(base, params):
    joiner = "&" if "?" in base else "?"
    return base.rstrip("/") + "/query" + joiner + urllib.parse.urlencode(params)


def _arcgis_page(src, where, offset, object_ids=None):
    params = {
        "where": where,
        "outFields": src.get("out_fields") or "*",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "json",
    }
    if object_ids:
        params["objectIds"] = ",".join(str(item) for item in object_ids)
    else:
        params["resultOffset"] = str(offset)
        params["resultRecordCount"] = str(src.get("page_size") or 1000)
    url = _query_url(src["source_url"], params)
    last = None
    for attempt in range(4):
        try:
            return _get_json(url, src["user_agent"])
        except Exception as exc:
            last = exc
            time.sleep(1.5 * (attempt + 1))
    raise last


def _object_ids(src, where):
    params = {"where": where, "returnIdsOnly": "true", "f": "json"}
    payload = _get_json(_query_url(src["source_url"], params), src["user_agent"])
    ids = payload.get("objectIds") or []
    return sorted(int(item) for item in ids)


def _count(src, where):
    params = {"where": where, "returnCountOnly": "true", "f": "json"}
    payload = _get_json(_query_url(src["source_url"], params), src["user_agent"], timeout=40)
    return int(payload.get("count") or 0)


def _page_rows(src, where, offset, fetched_at, force_class, force_status):
    payload = _arcgis_page(src, where, offset)
    if payload.get("error"):
        raise RuntimeError(str(payload["error"])[:300])
    rows = []
    for feature in payload.get("features") or []:
        record = normalize(src, feature.get("attributes") or {}, feature.get("geometry") or {}, fetched_at, force_class, force_status)
        if record:
            rows.append(record)
    return rows


def _by_object_ids(src, where, fetched_at, force_class, force_status, log):
    ids = _object_ids(src, where)
    log(f"  {src['state']} object ids {len(ids)}")
    rows = []
    page_size = min(int(src.get("page_size") or 500), 500)
    for start in range(0, len(ids), page_size):
        payload = _arcgis_page(src, where, 0, object_ids=ids[start : start + page_size])
        if payload.get("error"):
            raise RuntimeError(str(payload["error"])[:300])
        for feature in payload.get("features") or []:
            record = normalize(src, feature.get("attributes") or {}, feature.get("geometry") or {}, fetched_at, force_class, force_status)
            if record:
                rows.append(record)
    return rows


def fetch_arcgis(src, where, force_class=None, force_status=None, log=print):
    fetched_at = utc_now()
    page_size = int(src.get("page_size") or 1000)
    try:
        total = _count(src, where)
    except Exception as exc:
        message = str(exc)
        if "Pagination" in message or "400" in message:
            log(f"  {src['state']} offset paging refused; using object ids")
            return _by_object_ids(src, where, fetched_at, force_class, force_status, log)
        log(f"  {src['state']} count failed ({exc})")
        total = 0
    log(f"  {src['state']} count {total}")
    if total <= 0:
        return _page_rows(src, where, 0, fetched_at, force_class, force_status)
    offsets = list(range(0, total, page_size))
    rows = []
    workers = 6
    try:
        probe = _page_rows(src, where, 0, fetched_at, force_class, force_status)
    except Exception as exc:
        if "Pagination" in str(exc) or "400" in str(exc):
            log(f"  {src['state']} offset paging refused; using object ids")
            return _by_object_ids(src, where, fetched_at, force_class, force_status, log)
        raise
    rows.extend(probe)
    offsets = [offset for offset in offsets if offset]
    if not offsets:
        return rows
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(_page_rows, src, where, offset, fetched_at, force_class, force_status): offset
            for offset in offsets
        }
        done = 0
        for future in as_completed(futures):
            rows.extend(future.result())
            done += 1
            if done % 20 == 0 or done == len(futures):
                log(f"  {src['state']} pages {done}/{len(futures)} rows {len(rows)}")
    return rows


def fetch_socrata(src, log=print):
    fetched_at = utc_now()
    page_size = int(src.get("page_size") or 5000)
    rows = []
    offset = 0
    while True:
        params = {
            "$where": src["where"],
            "$limit": str(page_size),
            "$offset": str(offset),
            "$order": "api_well_number",
        }
        url = src["source_url"] + "?" + urllib.parse.urlencode(params)
        payload = _get_json(url, src["user_agent"])
        if not isinstance(payload, list) or not payload:
            break
        for item in payload:
            geom = {}
            record = normalize(src, item, geom, fetched_at)
            if record:
                rows.append(record)
        log(f"  {src['state']} offset {offset} got {len(payload)}")
        if len(payload) < page_size:
            break
        offset += len(payload)
    return rows


def _download(url, dest, user_agent):
    req = urllib.request.Request(url, headers={"User-Agent": user_agent})
    with urllib.request.urlopen(req, timeout=180) as resp, open(dest, "wb") as handle:
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            handle.write(chunk)


def fetch_shapefile(src, log=print):
    fetched_at = utc_now()
    with tempfile.TemporaryDirectory() as tmp:
        archive = os.path.join(tmp, "wells.zip")
        _download(src["source_url"], archive, src["user_agent"])
        out = os.path.join(tmp, "wells.geojsonl")
        values = ",".join("'" + item.replace("'", "''") + "'" for item in src["where_values"])
        where = f"{src['where_field']} IN ({values})"
        cmd = ["ogr2ogr", "-f", "GeoJSONSeq", out, f"/vsizip/{archive}", "-where", where, "-t_srs", "EPSG:4326"]
        subprocess.run(cmd, check=True, capture_output=True)
        rows = []
        with open(out, "r", encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                feature = json.loads(line)
                props = feature.get("properties") or {}
                coords = (feature.get("geometry") or {}).get("coordinates") or [None, None]
                geom = {"x": coords[0], "y": coords[1]} if coords and coords[0] is not None else {}
                record = normalize(src, props, geom, fetched_at)
                if record:
                    rows.append(record)
        log(f"  {src['state']} shapefile {len(rows)}")
        return rows


def fetch_source(src, log=print):
    rows = []
    if src["kind"] == "arcgis":
        rows.extend(fetch_arcgis(src, src["where"], log=log))
        for extra in src.get("extra_layers") or []:
            copy = dict(src)
            copy["source_url"] = extra["url"]
            rows.extend(
                fetch_arcgis(
                    copy,
                    extra.get("where") or "1=1",
                    force_class=extra.get("force_class"),
                    force_status=extra.get("force_status"),
                    log=log,
                )
            )
    elif src["kind"] == "socrata":
        rows.extend(fetch_socrata(src, log=log))
    elif src["kind"] == "shapefile":
        rows.extend(fetch_shapefile(src, log=log))
    else:
        raise RuntimeError("unsupported kind " + src["kind"])
    return rows

"""Map state GIS rows into the Siteline well schema. Status stays conservative."""

from __future__ import annotations

from datetime import datetime, timezone

from .api_numbers import normalize_api
from .rules import classify_well, commodity_group

TX_FIELDS = (
    "API,SYMNUM,GIS_SYMBOL_DESCRIPTION,GIS_WELL_NUMBER,"
    "GIS_LAT83,GIS_LONG83,RELIAB,GIS_LOCATION_SOURCE"
)
NM_FIELDS = (
    "API,wellname,well_type,type,status_cod,status,status2,"
    "ogrid_name,county,plug_date,latitude,longitude"
)
ORPHAN_FIELDS = "API"

TX_VIEWER = "https://gis.rrc.texas.gov/GISViewer/"
TX_SOURCE = (
    "https://gis.rrc.texas.gov/server/rest/services/"
    "rrc_public/RRC_Public_Viewer_Srvs/MapServer"
)
NM_SOURCE = (
    "https://mapservice.nmstatelands.org/arcgis/rest/services/"
    "Public/NMOCD_Wells_V3/MapServer"
)


def _num(value):
    try:
        if value is None or value == "":
            return None
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:
        return None
    return number


def _plug_iso(value) -> str:
    """Return YYYY-MM-DD when the Esri millisecond value is a real plug date."""
    ms = _num(value)
    if ms is None or ms <= 0 or ms >= 10**14:
        return ""
    year = 1970 + (ms / 1000.0) / 86400.0 / 365.25
    if year < 1901 or year > 2100:
        return ""
    try:
        return datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc).date().isoformat()
    except (OverflowError, OSError, ValueError):
        return ""


def _xy(attrs: dict, lon_key: str, lat_key: str, geometry: dict | None) -> tuple[float, float] | None:
    lon = _num(attrs.get(lon_key))
    lat = _num(attrs.get(lat_key))
    if lon is None or lat is None:
        point = (geometry or {}).get("x"), (geometry or {}).get("y")
        lon = _num(point[0])
        lat = _num(point[1])
    if lon is None or lat is None:
        return None
    if not (-180 <= lon <= 180 and -90 <= lat <= 90):
        return None
    return lon, lat


def _base_public(well: dict) -> dict:
    return well


def adapt_texas_rows(
    rows: list[dict],
    orphan_apis: set[str],
    rules: dict,
    *,
    as_of: str,
    source_url: str = TX_SOURCE,
) -> list[dict]:
    wells = []
    for row in rows:
        attrs = row.get("attributes") or row
        api_raw = str(attrs.get("API") or "").strip()
        api_norm = normalize_api(api_raw)
        if len(api_norm) != 8:
            continue
        xy = _xy(attrs, "GIS_LONG83", "GIS_LAT83", row.get("geometry"))
        if not xy:
            continue
        observations = []
        if api_norm in orphan_apis:
            observations.append(
                {
                    "kind": "orphan",
                    "source": "rrc_orphan_wells",
                    "text": "API is on the RRC Orphan Wells layer for this view.",
                }
            )
        record = {
            "api_raw": api_raw,
            "symnum": attrs.get("SYMNUM"),
            "observations": observations,
            "completions": [],
        }
        classified = classify_well(record, rules)
        evidence = list(classified["evidence"])
        if "rrc_gis_symbol_not_schedule" not in evidence:
            evidence.append("rrc_gis_symbol_not_schedule")
        review = bool(classified["review_needed"])
        if "no_current_schedule" in evidence or "plugged_symbol_without_pa_evidence" in evidence:
            review = True
        base = classified["status_code"]
        county = api_norm[:3]
        well_id = f"tx-{county}-{api_norm}"
        wells.append(
            {
                **classified,
                "id": well_id,
                "status_code_base": base,
                "status_code": "tx_" + base,
                "status_namespace": "tx",
                "evidence": evidence,
                "review_needed": review,
                "pa_confirmed": classified["pa_confirmed"] is True and base == "plugged_abandoned_confirmed",
                "lon": xy[0],
                "lat": xy[1],
                "county_code": county,
                "county_name": "",
                "state": "TX",
                "lease_name": "",
                "well_number": str(attrs.get("GIS_WELL_NUMBER") or "").strip(),
                "operator_name": "",
                "dataset_origin": "rrc_public_viewer",
                "source_of_record": "Texas Railroad Commission",
                "source_url": source_url + "/1",
                "viewer_url": TX_VIEWER,
                "rrc_viewer_url": TX_VIEWER,
                "as_of": as_of,
                "freshness": "Freshness unknown",
                "symnum_description": str(attrs.get("GIS_SYMBOL_DESCRIPTION") or ""),
            }
        )
    return wells


def _nm_commodity(attrs: dict) -> str:
    text = " ".join(
        str(attrs.get(key) or "").strip().lower() for key in ("type", "well_type")
    )
    if any(token in text for token in ("injection", "disposal", "swd", "salt water")):
        return "injection_or_disposal"
    if "oil" in text and "gas" in text:
        return "oil_and_gas"
    if text.strip() in {"g", "gas"} or " gas" in f" {text}" or text.startswith("gas"):
        return "gas"
    if text.strip() in {"o", "oil"} or " oil" in f" {text}" or text.startswith("oil"):
        return "oil"
    if "water" in text and "salt" not in text:
        return "water"
    return "unknown"


def _nm_bucket(commodity: str) -> str:
    if commodity == "oil":
        return "oil"
    if commodity == "oil_and_gas":
        return "mixed"
    if commodity == "gas":
        return "gas"
    return ""


def adapt_nm_row(row: dict, rules: dict, *, as_of: str, source_url: str) -> dict | None:
    attrs = row.get("attributes") or row
    api_raw = str(attrs.get("API") or "").strip()
    api_norm = normalize_api(api_raw)
    if len(api_norm) != 10:
        return None
    xy = _xy(attrs, "longitude", "latitude", row.get("geometry"))
    if not xy:
        return None
    commodity = _nm_commodity(attrs)
    group = commodity_group(commodity, rules)
    code_raw = str(attrs.get("status_cod") or "").strip().upper()
    text = str(attrs.get("status") or "").strip().lower()
    plug_iso = _plug_iso(attrs.get("plug_date"))
    review = False
    conflict = ""
    evidence = ["nm_ocd_status_field"]
    plugged = code_raw in {"P", "H"} or "plug" in text
    if commodity == "injection_or_disposal":
        status = "nm_injection"
        pa = False
    elif plugged:
        if plug_iso:
            status = "nm_plugged_confirmed"
            pa = True
            evidence.append("nm_ocd_plug_date")
        else:
            status = "nm_plug_unconfirmed"
            pa = False
            review = True
            evidence.append("plug_text_without_usable_plug_date")
    elif code_raw == "A" or text == "active":
        bucket = _nm_bucket(commodity)
        status = f"nm_active_{bucket}" if bucket else "nm_unknown_review"
        pa = False
        if not bucket:
            review = True
    elif code_raw in {"N", "I", "S", "SI", "TA"} or any(
        token in text for token in ("inactive", "shut", "temporary")
    ):
        bucket = _nm_bucket(commodity)
        status = f"nm_inactive_{bucket}" if bucket else "nm_unknown_review"
        pa = False
        if not bucket:
            review = True
    elif code_raw in {"X", "C"} or "never drilled" in text or "cancel" in text:
        status = "nm_canceled"
        pa = False
    else:
        status = "nm_unknown_review"
        pa = False
        review = True
    label = (rules.get("statuses") or {}).get(status, {}).get("label") or status
    color = (rules.get("statuses") or {}).get(status, {}).get("color") or "#e7d7b1"
    if pa and status != "nm_plugged_confirmed":
        pa = False
    return {
        "id": f"nm-{api_norm}",
        "api_raw": api_raw,
        "api_normalized": api_norm,
        "api10_raw": api_raw,
        "api10_normalized": api_norm,
        "symnum": None,
        "symnum_raw_label": "",
        "symnum_role": "",
        "commodity": commodity,
        "commodity_raw": str(attrs.get("type") or attrs.get("well_type") or ""),
        "commodity_source": "nm_ocd_type",
        "commodity_confidence": "high" if commodity != "unknown" else "low",
        "commodity_group": group,
        "is_gas_related": commodity == "gas",
        "is_oil_related": commodity == "oil",
        "is_mixed_oil_gas": commodity == "oil_and_gas",
        "status_code": status,
        "status_code_base": status,
        "status_namespace": "nm",
        "status_label": label,
        "status_color": color,
        "pa_confirmed": pa,
        "review_needed": review or status.endswith("unknown_review"),
        "conflict": conflict,
        "evidence": evidence,
        "freshness": "Freshness unknown",
        "as_of": as_of,
        "rules_version": rules.get("version"),
        "observations": [
            {
                "kind": "nm_ocd_status",
                "source": "nm_ocd",
                "status_cod": code_raw,
                "status": str(attrs.get("status") or ""),
                "plug_date": plug_iso,
            }
        ],
        "completions": [],
        "county_code": api_norm[2:5],
        "county_name": str(attrs.get("county") or ""),
        "state": "NM",
        "lease_name": str(attrs.get("wellname") or ""),
        "well_number": "",
        "operator_name": str(attrs.get("ogrid_name") or ""),
        "dataset_origin": "nm_ocd",
        "source_of_record": "New Mexico Oil Conservation Division",
        "source_url": source_url,
        "viewer_url": source_url,
        "rrc_viewer_url": "",
        "lon": xy[0],
        "lat": xy[1],
    }


def merge_nm_wells(rows: list[dict]) -> list[dict]:
    """Same API on both OCD layers must not keep a confident status when they disagree."""
    chosen: dict[str, dict] = {}
    for row in rows:
        if not row:
            continue
        key = row["api_normalized"]
        prev = chosen.get(key)
        if prev is None:
            chosen[key] = row
            continue
        if prev["status_code"] != row["status_code"] or prev["pa_confirmed"] != row["pa_confirmed"]:
            conflicted = dict(row)
            conflicted["status_code"] = "nm_unknown_review"
            conflicted["status_code_base"] = "nm_unknown_review"
            conflicted["pa_confirmed"] = False
            conflicted["review_needed"] = True
            conflicted["conflict"] = "nm_layer_status_disagreement"
            evidence = list(row.get("evidence") or [])
            evidence.append("nm_layer_status_disagreement")
            conflicted["evidence"] = evidence
            chosen[key] = conflicted
    return list(chosen.values())

"""Read an RRC county well-layer shapefile. API is kept as text."""

from __future__ import annotations

import hashlib
import zipfile
from pathlib import Path

import shapefile

API_ALIASES = ("API", "api")
API10_ALIASES = ("API10", "api10")
SYM_ALIASES = ("SYMNUM", "symnum")
LAT_ALIASES = ("LAT83", "lat83")
LON_ALIASES = ("LONG83", "long83", "LON83")
LAT27_ALIASES = ("LAT27", "lat27")
LON27_ALIASES = ("LONG27", "long27", "LON27")


def _field(rec: dict, names: tuple[str, ...]):
    lowered = {str(k).upper(): v for k, v in rec.items()}
    for name in names:
        if name.upper() in lowered:
            return lowered[name.upper()]
    return None


def _records_from_reader(reader) -> list[dict]:
    fields = [f[0] for f in reader.fields if f[0] != "DeletionFlag"]
    rows = []
    for sr in reader.iterShapeRecords():
        values = list(sr.record)
        rec = {}
        for key, value in zip(fields, values):
            if isinstance(value, bytes):
                value = value.decode("latin-1", errors="replace")
            rec[key] = value
        api = _field(rec, API_ALIASES)
        rows.append(
            {
                "api_raw": "" if api is None else str(api).strip(),
                "api10_raw": "" if _field(rec, API10_ALIASES) is None else str(_field(rec, API10_ALIASES)).strip(),
                "symnum": _field(rec, SYM_ALIASES),
                "lat83": _field(rec, LAT_ALIASES),
                "lon83": _field(rec, LON_ALIASES),
                "lat27": _field(rec, LAT27_ALIASES),
                "lon27": _field(rec, LON27_ALIASES),
                "raw": rec,
            }
        )
    return rows


def read_well_shapefile(path: str | Path) -> dict:
    """Read a .shp or a county zip that contains well*.shp (Cameron: well061)."""
    src = Path(path)
    blob = src.read_bytes()
    checksum = hashlib.sha256(blob).hexdigest()
    if src.suffix.lower() == ".zip":
        with zipfile.ZipFile(src) as zf:
            names = [n for n in zf.namelist() if n.lower().endswith(".shp")]
            if not names:
                raise ValueError("zip has no shapefile")
            # Prefer the well points layer: well061.shp over a full Shp061 bundle.
            preferred = [n for n in names if Path(n).stem.lower().startswith("well")]
            chosen = preferred[0] if preferred else names[0]
            extract_dir = src.parent / (src.stem + "_extract")
            zf.extractall(extract_dir)
            shp = extract_dir / chosen
            reader = shapefile.Reader(str(shp))
            filename = chosen
    else:
        reader = shapefile.Reader(str(src))
        filename = src.name
    rows = _records_from_reader(reader)
    numeric_api = any(isinstance(row["raw"].get("API"), (int, float)) for row in rows)
    return {
        "filename": filename,
        "checksum_sha256": checksum,
        "record_count": len(rows),
        "api_field_numeric": numeric_api,
        "wells": rows,
    }

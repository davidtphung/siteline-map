"""Manual import path for schedule, inactive aging, orphan, and plug documents.

Live G-10 / W-10 / full wellbore dumps are EBCDIC. This parser accepts a UTF-8
CSV so a reviewed extract can be loaded without pretending the EBCDIC file was parsed.
"""

from __future__ import annotations

import csv
import hashlib
from pathlib import Path


def read_observation_csv(path: str | Path, kind: str, source: str) -> dict:
    src = Path(path)
    blob = src.read_bytes()
    rows = []
    with src.open(newline="", encoding="utf-8") as fh:
        for rec in csv.DictReader(fh):
            api = (rec.get("api") or rec.get("api_raw") or "").strip()
            rows.append(
                {
                    "api_raw": api,
                    "observation": {
                        "kind": kind,
                        "source": source,
                        "observed_at": (rec.get("observed_at") or rec.get("status_date") or "").strip(),
                        "plug_date": (rec.get("plug_date") or "").strip(),
                        "source_url": (rec.get("source_url") or rec.get("document_url") or "").strip(),
                        "commodity": (rec.get("commodity") or "").strip(),
                        "text": (rec.get("text") or rec.get("notes") or "").strip(),
                        "pa_unambiguous": str(rec.get("pa_unambiguous") or "").strip().lower() == "true",
                    },
                }
            )
    return {
        "filename": src.name,
        "checksum_sha256": hashlib.sha256(blob).hexdigest(),
        "kind": kind,
        "source": source,
        "record_count": len(rows),
        "rows": rows,
    }


def read_gas_schedule(path: str | Path) -> dict:
    return read_observation_csv(path, "schedule", "rrc_gas_schedule")


def read_oil_schedule(path: str | Path) -> dict:
    return read_observation_csv(path, "schedule", "rrc_oil_schedule")


def read_inactive_aging(path: str | Path) -> dict:
    """Inactive Well Aging. Does not mark wells abandoned."""
    return read_observation_csv(path, "shut_in", "rrc_inactive_aging")


def read_orphan_list(path: str | Path) -> dict:
    return read_observation_csv(path, "orphan", "rrc_orphan_wells")


def read_plug_documents(path: str | Path) -> dict:
    return read_observation_csv(path, "plug_document", "rrc_imaged_record")

"""Ingest official gas wells and write a manifest plus GeoJSONSeq for tippecanoe."""

import argparse
import json
import os
import sys
from collections import Counter

from ingest.fetch import SCHEMA, fetch_source, utc_now
from ingest.sources import ALL_AREAS, PRIORITY, sources_for

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def counts_for(rows):
    counts = Counter(row["status_class"] for row in rows)
    return {key: counts.get(key, 0) for key in ("active", "inactive", "plugged", "other", "unknown")}


def feature(row):
    props = {
        "api": row["api"],
        "name": (row["name"] or "Well")[:80],
        "operator": (row["operator"] or "")[:80],
        "state": row["state"],
        "commodity": row["commodity"],
        "status_raw": row["status_raw"] or "UNKNOWN",
        "status_class": row["status_class"],
        "status_date": row["status_date"] or "UNKNOWN",
        "source_name": row["source_name"],
        "source_updated": row["source_updated"] or "UNKNOWN",
    }
    return {
        "type": "Feature",
        "properties": props,
        "geometry": {"type": "Point", "coordinates": [row["lon"], row["lat"]]},
    }


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--states", default=",".join(PRIORITY))
    parser.add_argument("--out", default=os.path.join(ROOT, "data"))
    parser.add_argument("--geojson", default="")
    args = parser.parse_args(argv)
    states = [item.strip().upper() for item in args.states.split(",") if item.strip()]
    if states == ["ALL"]:
        states = []
    os.makedirs(args.out, exist_ok=True)
    geo_path = args.geojson or os.path.join(args.out, "gaswells.geojsonl")
    fetched_at = utc_now()
    manifest_states = {code: {"coverage": "UNKNOWN", "counts": {}, "source_updated": "UNKNOWN", "fetched_at": "", "errors": "no official gas-well source in the verified catalog", "source_name": "", "source_url": "", "agency": ""} for code in ALL_AREAS}
    selected = sources_for(states)
    for src in selected:
        manifest_states[src["state"]] = {
            "coverage": src["coverage"],
            "counts": {},
            "source_updated": src.get("source_updated") or "UNKNOWN",
            "fetched_at": "",
            "errors": "",
            "source_name": src["source_name"],
            "source_url": src["source_url"],
            "agency": src["agency"],
            "note": src.get("note") or "",
        }
    grand = Counter()
    with open(geo_path, "w", encoding="utf-8") as geo:
        for src in selected:
            code = src["state"]
            print(f"fetch {code}", flush=True)
            try:
                rows = fetch_source(src)
            except Exception as exc:
                manifest_states[code]["coverage"] = "UNKNOWN"
                manifest_states[code]["errors"] = str(exc)[:500]
                print(f"  FAIL {code}: {exc}", flush=True)
                continue
            counts = counts_for(rows)
            manifest_states[code]["counts"] = counts
            manifest_states[code]["fetched_at"] = rows[0]["fetched_at_utc"] if rows else fetched_at
            manifest_states[code]["total"] = len(rows)
            if not rows:
                manifest_states[code]["errors"] = manifest_states[code]["errors"] or "source returned 0 gas wells"
            for row in rows:
                grand[code] += 1
                geo.write(json.dumps(feature(row), ensure_ascii=False) + "\n")
            print(f"  {code} {len(rows)} {counts}", flush=True)
    manifest = {
        "fetched_at": fetched_at,
        "schema": list(SCHEMA),
        "states": manifest_states,
        "totals": {code: grand.get(code, 0) for code in ALL_AREAS},
    }
    manifest_path = os.path.join(args.out, "gaswells-manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)
        handle.write("\n")
    print("wrote", manifest_path, "features", sum(grand.values()), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

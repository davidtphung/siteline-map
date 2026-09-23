"""Write data/cameron-wells.geojson from the classified Cameron fixture."""

from __future__ import annotations

import json
from pathlib import Path

from app.seed import build_wells, load_fixture, wells_to_feature_collection

ROOT = Path(__file__).resolve().parents[3]


def main() -> None:
    fixture = load_fixture()
    wells = build_wells(fixture)
    fc = wells_to_feature_collection(wells, fixture)
    dest = ROOT / "data" / "cameron-wells.geojson"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(fc, indent=2), encoding="utf-8")
    print(f"wrote {dest} features={len(fc['features'])}")


if __name__ == "__main__":
    main()

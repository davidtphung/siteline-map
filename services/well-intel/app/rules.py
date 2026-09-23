"""Status rules. Raw RRC fields are never overwritten. Siteline labels are derived."""

from __future__ import annotations

import json
import os
from datetime import date, datetime
from pathlib import Path

from .api_numbers import split_api_fields

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_RULES = Path(
    os.environ.get("WELLS_RULES_PATH", str(ROOT / "config" / "well-status-rules.json"))
)

HYDROCARBON = {"gas", "oil", "oil_and_gas"}
GROUP_FLAGS = ("include_gas", "include_oil", "include_mixed", "include_other")


def load_rules(path: Path | None = None) -> dict:
    src = Path(path or DEFAULT_RULES)
    with src.open(encoding="utf-8") as fh:
        rules = json.load(fh)
    if "disclaimers" not in rules or len(rules["disclaimers"]) < 9:
        raise ValueError("well-status-rules.json is missing required disclaimers")
    return rules


def parse_day(value) -> date | None:
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    text = text[:10]
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError:
        return None


def commodity_group(commodity: str, rules: dict) -> str:
    for group, members in rules["commodity_groups"].items():
        if commodity in members:
            return group
    return "other"


def flags_from_query(params: dict, rules: dict) -> dict:
    defaults = rules["defaults"]
    out = {}
    for key in GROUP_FLAGS:
        if key in params and params[key] is not None and params[key] != "":
            out[key] = _truthy(params[key])
        else:
            out[key] = bool(defaults[key])
    return out


def force_gas_only(flags: dict) -> dict:
    return {
        "include_gas": True,
        "include_oil": False,
        "include_mixed": False,
        "include_other": False,
    }


def force_oil_only(flags: dict) -> dict:
    return {
        "include_gas": False,
        "include_oil": True,
        "include_mixed": False,
        "include_other": False,
    }


def _truthy(value) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def context_title(flags: dict, rules: dict) -> str:
    gas = bool(flags.get("include_gas"))
    oil = bool(flags.get("include_oil"))
    mixed = bool(flags.get("include_mixed"))
    titles = rules["titles"]
    if gas and not oil and not mixed:
        return titles["gas"]
    if oil and not gas and not mixed:
        return titles["oil"]
    if oil or mixed:
        return titles["both"]
    return titles["gas"]


def well_matches(well: dict, flags: dict) -> bool:
    group = well.get("commodity_group")
    if group == "gas":
        return bool(flags.get("include_gas"))
    if group == "oil":
        return bool(flags.get("include_oil"))
    if group == "mixed":
        return bool(flags.get("include_mixed"))
    return bool(flags.get("include_other"))


def _status_def(rules: dict, code: str) -> dict:
    found = rules["statuses"].get(code)
    if not found:
        raise KeyError(code)
    return found


def _bucket(commodity: str) -> str:
    if commodity == "oil":
        return "oil"
    if commodity == "oil_and_gas":
        return "mixed"
    if commodity == "gas":
        return "gas"
    return ""


def _historical_code(commodity: str) -> str:
    bucket = _bucket(commodity)
    if bucket == "oil":
        return "historical_oil_unconfirmed"
    if bucket == "mixed":
        return "historical_mixed_unconfirmed"
    if bucket == "gas":
        return "historical_gas_unconfirmed"
    return "unknown_review"


def _inactive_code(commodity: str) -> str:
    bucket = _bucket(commodity)
    if bucket == "oil":
        return "inactive_oil"
    if bucket == "mixed":
        return "inactive_mixed"
    if bucket == "gas":
        return "inactive_gas"
    return "unknown_review"


def _current_code(commodity: str) -> str:
    bucket = _bucket(commodity)
    if bucket == "oil":
        return "current_oil_schedule"
    if bucket == "mixed":
        return "current_mixed_schedule"
    if bucket == "gas":
        return "current_gas_schedule"
    return "unknown_review"


def _orphan_label(commodity: str, rules: dict) -> str:
    labels = rules["orphan_labels"]
    if commodity in labels:
        return labels[commodity]
    return labels["other"]


def _sym(rules: dict, symnum) -> dict:
    if symnum is None or symnum == "":
        return {"raw_label": "", "role": "unknown", "commodity": None}
    return rules["symnum"].get(
        str(int(symnum)),
        {"raw_label": f"SYMNUM {symnum}", "role": "unknown", "commodity": None},
    )


def _completion_fluids(completions: list) -> set[str]:
    fluids = set()
    for item in completions or []:
        fluid = str(item.get("fluid") or "").strip().lower()
        if fluid in {"gas", "oil"}:
            fluids.add(fluid)
        # injection, water, and other completion fluids do not change commodity
    return fluids


def resolve_commodity(record: dict, rules: dict) -> dict:
    spec = _sym(rules, record.get("symnum"))
    fluids = _completion_fluids(record.get("completions") or [])
    permit = str(record.get("permit_fluid") or "").strip().lower()
    source = "rrc_symnum"
    confidence = "high"
    review = False
    base = spec.get("commodity")

    if "oil" in fluids and "gas" in fluids:
        commodity = "oil_and_gas"
        source = "rrc_completions"
        if base not in {None, "oil_and_gas"}:
            confidence = "medium"
            review = True
    elif fluids == {"gas"}:
        commodity = "gas"
        source = "rrc_completions"
        if base not in {None, "gas"}:
            confidence = "low"
            review = True
    elif fluids == {"oil"}:
        commodity = "oil"
        source = "rrc_completions"
        if base not in {None, "oil"}:
            confidence = "low"
            review = True
    elif permit in {"gas", "oil"} and spec.get("role") == "permitted":
        commodity = permit
        source = "rrc_permit"
        confidence = "medium"
    elif base:
        commodity = base
        source = "rrc_symnum"
    elif permit in {"gas", "oil"}:
        commodity = permit
        source = "rrc_permit"
        confidence = "low"
        review = True
    else:
        commodity = "unknown"
        source = "unresolved"
        confidence = "low"
        review = True

    return {
        "commodity": commodity,
        "commodity_raw": spec.get("raw_label") or "",
        "commodity_source": source,
        "commodity_confidence": confidence,
        "commodity_review": review,
        "symnum_role": spec.get("role") or "unknown",
        "symnum_raw_label": spec.get("raw_label") or "",
    }


def _pa_hits(observations: list, rules: dict) -> list:
    allowed = set(rules["pa_evidence_sources"])
    hits = []
    for obs in observations or []:
        kind = obs.get("kind")
        plug_date = str(obs.get("plug_date") or "").strip()
        if kind == "plug_date" and plug_date and obs.get("source") in allowed:
            if parse_day(plug_date):
                hits.append(obs)
        elif kind == "plug_document" and str(obs.get("source_url") or "").strip():
            hits.append(obs)
        elif obs.get("pa_unambiguous") is True and str(obs.get("source_url") or "").strip():
            hits.append(obs)
    return hits


def _dated(observations: list, kind: str) -> list[tuple[date, dict]]:
    rows = []
    for obs in observations or []:
        if obs.get("kind") != kind:
            return_row = False
        else:
            return_row = True
        if not return_row:
            continue
        day = parse_day(obs.get("observed_at") or obs.get("plug_date"))
        if day:
            rows.append((day, obs))
    return rows


def classify_well(record: dict, rules: dict | None = None, as_of: date | None = None) -> dict:
    rules = rules or load_rules()
    as_of = as_of or date.today()
    commodity = resolve_commodity(record, rules)
    observations = list(record.get("observations") or [])
    pa_hits = _pa_hits(observations, rules)
    schedules = _dated(observations, "schedule")
    shutins = _dated(observations, "shut_in")
    orphans = [obs for obs in observations if obs.get("kind") == "orphan"]
    review = bool(commodity["commodity_review"])
    conflict = ""
    evidence = []

    code = "unknown_review"
    if pa_hits:
        code = "plugged_abandoned_confirmed"
        evidence.append("explicit_pa_evidence")
        plug_days = []
        for hit in pa_hits:
            day = parse_day(hit.get("plug_date") or hit.get("observed_at"))
            if day:
                plug_days.append(day)
        if schedules and plug_days and max(day for day, _ in schedules) > max(plug_days):
            review = True
            conflict = "schedule_newer_than_plug"
            evidence.append(conflict)
    elif orphans:
        code = "orphan"
        evidence.append("rrc_orphan_list")
    elif schedules and shutins:
        sched_day = max(day for day, _ in schedules)
        shut_day = max(day for day, _ in shutins)
        if sched_day > shut_day:
            code = _current_code(commodity["commodity"])
            evidence.append("newer_schedule")
        elif shut_day > sched_day:
            code = _inactive_code(commodity["commodity"])
            evidence.append("newer_shut_in")
        else:
            code = "unknown_review"
            review = True
            conflict = "schedule_shut_in_tie"
            evidence.append(conflict)
    elif schedules:
        code = _current_code(commodity["commodity"])
        evidence.append("rrc_schedule")
    elif shutins or commodity["symnum_role"] == "shut_in":
        code = _inactive_code(commodity["commodity"])
        evidence.append("shut_in")
    elif commodity["symnum_role"] == "dry_hole":
        code = "dry_hole"
    elif commodity["symnum_role"] == "permitted":
        if commodity["commodity"] == "gas":
            code = "permitted_drilling_gas"
        elif commodity["commodity"] == "oil":
            code = "permitted_drilling_oil"
        else:
            code = "permitted_drilling_unknown"
            review = True
    elif commodity["symnum_role"] == "canceled":
        code = "canceled_location"
    elif commodity["symnum_role"] == "plugged_symbol":
        code = _historical_code(commodity["commodity"])
        review = True
        evidence.append("plugged_symbol_without_pa_evidence")
    elif commodity["symnum_role"] == "producing":
        code = _historical_code(commodity["commodity"])
        evidence.append("no_current_schedule")
    elif commodity["symnum_role"] == "injection":
        code = "injection_or_disposal"
    elif commodity["symnum_role"] == "water":
        code = "water_supply"
    else:
        code = "unknown_review"
        review = True

    if code == "unknown_review":
        review = True

    status = _status_def(rules, code)
    label = status["label"]
    if code == "orphan":
        label = _orphan_label(commodity["commodity"], rules)

    dated = []
    for obs in observations:
        day = parse_day(obs.get("observed_at") or obs.get("plug_date"))
        if day:
            dated.append(day)
    if not dated:
        freshness = "Freshness unknown"
    else:
        age = (as_of - max(dated)).days
        freshness = "May be stale" if age > int(rules["stale_after_days"]) else "Within freshness window"

    apis = split_api_fields(record.get("api_raw"), record.get("api10_raw"))
    group = commodity_group(commodity["commodity"], rules)
    symnum = record.get("symnum")
    return {
        **apis,
        "symnum": None if symnum in (None, "") else int(symnum),
        "symnum_raw_label": commodity["symnum_raw_label"],
        "symnum_role": commodity["symnum_role"],
        "commodity": commodity["commodity"],
        "commodity_raw": commodity["commodity_raw"],
        "commodity_source": commodity["commodity_source"],
        "commodity_confidence": commodity["commodity_confidence"],
        "commodity_group": group,
        "is_gas_related": commodity["commodity"] == "gas",
        "is_oil_related": commodity["commodity"] == "oil",
        "is_mixed_oil_gas": commodity["commodity"] == "oil_and_gas",
        "status_code": code,
        "status_label": label,
        "status_color": status["color"],
        "pa_confirmed": code == "plugged_abandoned_confirmed",
        "review_needed": review,
        "conflict": conflict,
        "evidence": evidence,
        "freshness": freshness,
        "rules_version": rules["version"],
        "observations": observations,
        "completions": list(record.get("completions") or []),
    }


def label_uses_abandoned(label: str) -> bool:
    return "abandoned" in label.lower()

"""Per-state gas-well status maps. Values were verified 2026-09-24."""

STATUS_CLASSES = ("active", "inactive", "plugged", "other", "unknown")

# Bucket names follow the catalog. Active_or_unknown is a partial status:
# the source does not split producing from idle, so the symbol is classed active
# and the state coverage stays "partial status".
_BUCKET = {
    "Active": "active",
    "Inactive": "inactive",
    "Plugged": "plugged",
    "Other": "other",
    "Active_or_unknown": "active",
}


_NOTE = ("verify", "orphan", "state funds", "location abandoned", "not producing", "temp inactive", "layer ")


def _keys(label):
    text = str(label or "").strip()
    if not text or text.lower() in {"layer 5 (all)", "not plugged", "plugged flag"}:
        return []
    keys = [text]
    if "(" in text and ")" in text:
        prefix = text.split("(", 1)[0].strip()
        note = text[text.find("(") + 1 : text.rfind(")")].casefold()
        if prefix and any(token in note for token in _NOTE):
            keys.append(prefix)
    return keys


def compile_map(mapping):
    table = {}
    for bucket, labels in (mapping or {}).items():
        kind = _BUCKET.get(bucket)
        if not kind:
            continue
        for label in labels or []:
            for code in _keys(label):
                table[code.casefold()] = kind
    return table


def status_class(raw, mapping):
    text = str(raw or "").strip()
    if not text:
        return "unknown"
    table = mapping if mapping and not any(k in _BUCKET for k in mapping) else compile_map(mapping)
    kind = table.get(text.casefold())
    if kind:
        return kind
    return "unknown"


def commodity_for(state, raw_type):
    text = str(raw_type or "").strip()
    folded = text.casefold()
    combined = {
        "oil/gas well",
        "plugged oil / gas",
        "comb. oil&gas",
        "oil and gas",
        "plugged oil and gas",
        "og",
        "o&g",
        "o&g-p&a",
        "combination oil and gas producer",
        "oil and gas producer",
        "go",
        "oil/gas well",
    }
    if folded in combined or "oil and gas" in folded or folded in {"o&g", "o&g-p&a"}:
        return "oil_gas_combined"
    if state == "ND" and folded == "og":
        return "oil_gas_combined"
    if state == "CO" and folded in {"", "unconfirmed"}:
        return "unconfirmed"
    if not text:
        return "unconfirmed"
    return "gas"

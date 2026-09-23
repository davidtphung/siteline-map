"""API number handling. Strings only. Leading zeros are significant."""


def normalize_api(raw) -> str:
    """Digits only, preserving leading zeros. Never cast through int."""
    if raw is None:
        return ""
    if isinstance(raw, bool):
        return ""
    if isinstance(raw, int):
        # Integer input has already dropped leading zeros. Keep the decimal
        # digits but do not invent a pad or a state-code prefix.
        text = str(raw)
    elif isinstance(raw, float):
        if raw != raw:  # NaN
            return ""
        text = str(int(raw)) if raw.is_integer() else str(raw).strip()
    else:
        text = str(raw).strip()
    return "".join(ch for ch in text if ch.isdigit())


def split_api_fields(api_raw, api10_raw=None) -> dict:
    raw_text = "" if api_raw is None else str(api_raw).strip()
    api10_text = "" if api10_raw is None else str(api10_raw).strip()
    return {
        "api_raw": raw_text,
        "api_normalized": normalize_api(raw_text),
        "api10_raw": api10_text,
        "api10_normalized": normalize_api(api10_text),
    }

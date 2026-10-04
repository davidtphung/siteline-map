/** Site Brief summary lines and the three honest field states. */

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function fieldState(value, failed) {
  const text = clean(value);
  if (failed || /timeout|timed out|failed|cors blocked|unavailable|network/i.test(text)) return "LOOKUP FAILED";
  if (!text || text.toUpperCase() === "UNKNOWN" || text.toUpperCase() === "N/A") return "UNKNOWN";
  if (/^none returned$/i.test(text) || /^none found$/i.test(text) || text === "0") return "NONE FOUND";
  return text;
}

function pick(rows, pattern) {
  return (rows || []).find((row) => pattern.test(row.label || "")) || null;
}

function shown(row) {
  if (!row) return "UNKNOWN";
  return fieldState(row.value, row.failed);
}

export function briefSummaryLines(rows) {
  const distance = shown(pick(rows, /nearest transmission/i));
  const kv = shown(pick(rows, /line kv/i));
  const subName = shown(pick(rows, /substation name/i));
  const subDistance = shown(pick(rows, /^nearest substation$/i));
  const utility = shown(pick(rows, /serving utility/i));
  const wells = shown(pick(rows, /wells within 5/i));
  const flood = shown(pick(rows, /flood flag|fema flood/i));
  const wildfire = shown(pick(rows, /wildfire|whp/i));

  let transmission = "Nearest transmission: UNKNOWN";
  if (distance === "LOOKUP FAILED" || kv === "LOOKUP FAILED") transmission = "Nearest transmission: LOOKUP FAILED";
  else if (distance === "NONE FOUND") transmission = "Nearest transmission: NONE FOUND";
  else if (distance !== "UNKNOWN") {
    const kvBit = kv !== "UNKNOWN" && kv !== "NONE FOUND" && kv !== "LOOKUP FAILED" ? kv + ", " : "";
    transmission = "Nearest transmission: " + kvBit + distance;
  }

  let substation = "Nearest substation: UNKNOWN";
  if (subName === "LOOKUP FAILED" || subDistance === "LOOKUP FAILED") substation = "Nearest substation: LOOKUP FAILED";
  else if (subName !== "UNKNOWN" && subName !== "NONE FOUND") substation = "Nearest substation: " + subName;
  else if (subDistance !== "UNKNOWN") substation = "Nearest substation: " + subDistance;

  const floodLine = wildfire && wildfire !== "UNKNOWN" ? "Flood: " + flood + ". Wildfire: " + wildfire : "Flood: " + flood;
  return [
    transmission,
    substation,
    "Serving utility: " + utility,
    "Wells within 5 mi: " + wells,
    floodLine,
  ];
}

export function groupUnknowns(sections) {
  return (sections || []).map((section) => {
    const states = (section.fields || []).map((field) => fieldState(field.value, field.failed));
    const unknownCount = states.filter((state) => state === "UNKNOWN").length;
    return {
      title: section.title || "",
      fields: section.fields || [],
      states,
      unknownCount,
      allUnknown: states.length > 0 && unknownCount === states.length,
    };
  });
}

/**
 * Siteline Intel transforms. Pure functions: peaks, year-over-year, truth labels, exports.
 * No network. Empty stays empty.
 */

export const TRUTH_LABELS = ["LIVE", "CATALOG", "CLAIM", "PRESS", "SCENARIO", "UNKNOWN"];

const HONESTY = "Regional grid demand, not site capacity. Proximity is not deliverability.";

export function assignLabel(kind) {
  switch (kind) {
    case "eia-hourly":
      return "LIVE";
    case "eia-peak":
    case "eia-forecast":
    case "hifld":
    case "catalog":
      return "CATALOG";
    case "claim":
      return "CLAIM";
    case "press":
      return "PRESS";
    case "scenario":
      return "SCENARIO";
    default:
      return "UNKNOWN";
  }
}

export function normalizeBaName(name) {
  return String(name || "")
    .toUpperCase()
    .replace(/\.+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function baCodeForName(name, table) {
  const key = normalizeBaName(name);
  if (!key || !table) return null;
  for (const [raw, code] of Object.entries(table)) {
    if (normalizeBaName(raw) === key) return code;
  }
  return null;
}

export function haversineMiles(lng1, lat1, lng2, lat2) {
  const n = [lng1, lat1, lng2, lat2].map(Number);
  if (n.some((v) => !Number.isFinite(v))) return null;
  const R = 3958.7613;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(n[3] - n[1]);
  const dLng = rad(n[2] - n[0]);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(n[1])) * Math.cos(rad(n[3])) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function finiteNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n <= -999999) return null;
  return n;
}

export function dailyPeaks(rows) {
  const byDay = new Map();
  for (const row of rows || []) {
    const period = String(row?.period || "");
    const day = period.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const value = finiteNumber(row.value);
    if (value == null) continue;
    const prev = byDay.get(day);
    if (prev == null || value > prev) byDay.set(day, value);
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, peak]) => ({
      date,
      peak,
      label: assignLabel("eia-peak"),
    }));
}

export function peaksInMonth(peaks, yyyyMm) {
  return (peaks || []).filter((p) => p.date.slice(0, 7) === yyyyMm && finiteNumber(p.peak) != null);
}

export function monthPeak(peaks, yyyyMm) {
  const rows = peaksInMonth(peaks, yyyyMm);
  if (!rows.length) return null;
  return rows.reduce((m, r) => (r.peak > m ? r.peak : m), -Infinity);
}

export function shiftMonth(yyyyMm, delta) {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}`;
}

/**
 * Same calendar month, year over year, using the latest month present in the series.
 * A partial month is still compared, and the day counts travel with the result.
 */
export function yearOverYearPeak(peaks) {
  const dated = (peaks || []).filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && finiteNumber(p.peak) != null);
  if (!dated.length) {
    return { pct: null, label: "UNKNOWN", month: null, priorMonth: null, reason: "no peaks" };
  }
  const month = dated[dated.length - 1].date.slice(0, 7);
  const priorMonth = shiftMonth(month, -12);
  const current = monthPeak(dated, month);
  const prior = monthPeak(dated, priorMonth);
  const currentDays = peaksInMonth(dated, month).length;
  const priorDays = peaksInMonth(dated, priorMonth).length;
  if (current == null || prior == null || prior === 0) {
    return {
      pct: null,
      label: "UNKNOWN",
      month,
      priorMonth,
      currentPeak: current,
      priorPeak: prior,
      currentDays,
      priorDays,
      reason: "missing comparison month",
    };
  }
  const pct = ((current - prior) / prior) * 100;
  return {
    pct: Math.round(pct * 10) / 10,
    label: assignLabel("eia-peak"),
    month,
    priorMonth,
    currentPeak: current,
    priorPeak: prior,
    currentDays,
    priorDays,
  };
}

export function lastNDays(peaks, days, endDate) {
  const end = endDate || (peaks && peaks.length ? peaks[peaks.length - 1].date : null);
  if (!end) return [];
  const start = new Date(`${end}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const startKey = start.toISOString().slice(0, 10);
  return (peaks || []).filter((p) => p.date >= startKey && p.date <= end);
}

export function hourlyWindow(rows, hours) {
  const clean = (rows || [])
    .map((row) => ({
      period: String(row.period || ""),
      value: finiteNumber(row.value),
      label: assignLabel("eia-hourly"),
    }))
    .filter((row) => row.period && row.value != null)
    .sort((a, b) => (a.period < b.period ? -1 : 1));
  if (!hours || clean.length <= hours) return clean;
  return clean.slice(clean.length - hours);
}

export function pickSmallestTerritory(features) {
  const rows = (features || [])
    .map((f) => f.attributes || f)
    .filter((a) => a && a.NAME && String(a.NAME).toUpperCase() !== "NOT AVAILABLE");
  rows.sort((a, b) => {
    const aa = finiteNumber(a.Shape__Area);
    const bb = finiteNumber(b.Shape__Area);
    if (aa == null && bb == null) return 0;
    if (aa == null) return 1;
    if (bb == null) return -1;
    return aa - bb;
  });
  if (!rows.length) return { utility: null, overlap: 0 };
  return { utility: rows[0], overlap: rows.length };
}

export function nearestPoint(originLng, originLat, features, readLngLat) {
  let best = null;
  for (const feature of features || []) {
    const pos = readLngLat(feature);
    if (!pos) continue;
    const miles = haversineMiles(originLng, originLat, pos.lng, pos.lat);
    if (miles == null) continue;
    if (!best || miles < best.miles) best = { miles, feature, lng: pos.lng, lat: pos.lat };
  }
  return best;
}

export function checklistRow(spec) {
  const scenario = spec.scenarioText != null ? String(spec.scenarioText).trim() : "";
  if (spec.known) {
    return {
      id: spec.id,
      title: spec.title,
      status: "Known",
      label: spec.label || assignLabel("catalog"),
      text: spec.known.text,
      source: spec.known.source || null,
      url: spec.known.url || null,
      asOf: spec.known.asOf || null,
      retrievedAt: spec.known.retrievedAt || null,
    };
  }
  if (scenario) {
    return {
      id: spec.id,
      title: spec.title,
      status: "Scenario",
      label: assignLabel("scenario"),
      text: scenario,
      source: "Local scenario input",
      url: null,
      asOf: null,
      retrievedAt: null,
    };
  }
  return {
    id: spec.id,
    title: spec.title,
    status: "Unknown",
    label: "UNKNOWN",
    text: "UNKNOWN",
    source: null,
    url: null,
    asOf: null,
    retrievedAt: null,
  };
}

export function buildChecklist({ grid, water, fiber, flood, scenario }) {
  const s = scenario || {};
  return [
    checklistRow({
      id: "grid",
      title: "Grid path",
      known: grid && grid.text ? grid : null,
      label: assignLabel("hifld"),
    }),
    checklistRow({
      id: "hv",
      title: "HV transformer and switchgear",
      scenarioText: s.hv,
    }),
    checklistRow({
      id: "chillers",
      title: "Chillers",
      scenarioText: s.chillers,
    }),
    checklistRow({
      id: "generation",
      title: "Generation (bridge or permanent)",
      scenarioText: s.generation,
    }),
    checklistRow({
      id: "water",
      title: "Water",
      known: water && water.text ? water : null,
    }),
    checklistRow({
      id: "fiber",
      title: "Fiber",
      known: fiber && fiber.text ? fiber : null,
    }),
    checklistRow({
      id: "flood",
      title: "Flood and hazard",
      known: flood && flood.text ? flood : null,
    }),
  ];
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function siteBriefCsv(model) {
  const header = [
    "question",
    "answer",
    "status",
    "truth",
    "source",
    "source_url",
    "as_of",
    "retrieved_at",
    "lng",
    "lat",
  ];
  const lines = [header.join(",")];
  const pin = model.pin || {};
  const push = (row) => {
    lines.push(
      [
        row.question,
        row.answer,
        row.status || "",
        row.truth || "",
        row.source || "",
        row.url || "",
        row.asOf || "",
        row.retrievedAt || "",
        pin.lng ?? "",
        pin.lat ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  };
  for (const row of model.rows || []) push(row);
  return lines.join("\n") + "\n";
}

export function siteBriefMarkdown(model) {
  const pin = model.pin || {};
  const where =
    pin.lng != null && pin.lat != null
      ? `${Number(pin.lat).toFixed(5)}, ${Number(pin.lng).toFixed(5)}`
      : "UNKNOWN";
  const lines = [
    `# Siteline site brief`,
    ``,
    `Pin: ${where}`,
    model.label ? `Label: ${model.label}` : null,
    ``,
    HONESTY,
    ``,
  ].filter((line) => line != null);
  for (const row of model.rows || []) {
    lines.push(`## ${row.question}`);
    lines.push(`${row.answer}`);
    const bits = [
      row.status ? `Status: ${row.status}` : null,
      row.truth ? `Truth: ${row.truth}` : null,
      row.source ? `Source: ${row.source}` : null,
      row.url ? `URL: ${row.url}` : null,
      row.asOf ? `As of: ${row.asOf}` : null,
      row.retrievedAt ? `Retrieved: ${row.retrievedAt}` : null,
    ].filter(Boolean);
    if (bits.length) lines.push(bits.join(". ") + ".");
    lines.push("");
  }
  if (model.fetches && model.fetches.length) {
    lines.push("## Sources and history");
    for (const fetchRow of model.fetches) {
      lines.push(
        `- ${fetchRow.source || "source"} | ${fetchRow.query || ""} | ${fetchRow.retrievedAt || ""} | ${fetchRow.status || ""}`,
      );
      if (fetchRow.url) lines.push(`  ${fetchRow.url}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function formatPct(pct) {
  if (pct == null || !Number.isFinite(Number(pct))) return "UNKNOWN";
  const n = Number(pct);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function formatMiles(miles) {
  if (miles == null || !Number.isFinite(Number(miles))) return null;
  return `${Number(miles).toFixed(1)} mi`;
}

export { HONESTY };

/** Nationwide gas-well tiles: coverage table, popup line, plugged filter. */

export const GAS_TILE_URLS = ["/tiles/gaswells.pmtiles", "/data/gaswells.pmtiles"];
export const GAS_MANIFEST_URL = "/tiles/gaswells-manifest.json";
export const TEXAS_GIS_NOTE = "Texas RRC data has shut-in versus gas-well status only, with no operator or dates in the GIS layer.";

export function sourceAsOf(props) {
  const agency = String(props?.source_name || props?.agency || "").trim() || "UNKNOWN";
  const dated = String(props?.status_date || "").trim();
  const updated = String(props?.source_updated || "").trim();
  const date = dated && dated !== "UNKNOWN" ? dated : updated && updated !== "UNKNOWN" ? updated : "UNKNOWN";
  return { agency, date, line: "Source: " + agency + ", data as of " + date };
}

export function coverageRows(manifest) {
  const states = manifest?.states || {};
  return Object.keys(states)
    .sort()
    .map((code) => {
      const row = states[code] || {};
      const counts = row.counts || {};
      const covered = row.coverage && row.coverage !== "UNKNOWN";
      return {
        state: code,
        coverage: row.coverage || "UNKNOWN",
        active: covered && Number.isFinite(counts.active) ? counts.active : covered ? counts.active ?? 0 : "UNKNOWN",
        inactive: covered && Number.isFinite(counts.inactive) ? counts.inactive : covered ? counts.inactive ?? 0 : "UNKNOWN",
        source_updated: row.source_updated || "UNKNOWN",
        agency: row.agency || "",
        note: row.note || "",
        errors: row.errors || "",
      };
    });
}

export function coverageTableText(rows) {
  const lines = ["State | Coverage | Active | Inactive | As of"];
  for (const row of rows || []) {
    lines.push([row.state, row.coverage, row.active, row.inactive, row.source_updated].join(" | "));
  }
  return lines.join("\n");
}

export function pointFilter(showPlugged) {
  const base = ["!", ["has", "point_count"]];
  if (showPlugged) return base;
  return ["all", base, ["!=", ["get", "status_class"], "plugged"]];
}

export function useCameronFixture(manifest) {
  const coverage = manifest?.states?.TX?.coverage;
  return !coverage || coverage === "UNKNOWN";
}

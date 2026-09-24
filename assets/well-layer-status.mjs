/** Tray status for remote well catalogs. */

export function describeWellState({ on, zoom, minZoom = 6, health, title, hint }) {
  if (!on) return "";
  const zoomNote = "zoom in to see (minzoom " + minZoom + ")";
  if (typeof zoom === "number" && zoom < minZoom) return zoomNote;
  const text = String(title || hint || "");
  if (/zoom to/i.test(text)) return zoomNote;
  if (health === "blocked" || health === "error") return "source unavailable";
  if (health === "loading" || health === "" || health === "idle") return "loading";
  const drawn = text.match(/(\d+)\s+drawn/);
  if (health === "empty") return "0 shown";
  if (drawn) return drawn[1] + " shown";
  if (health === "ok") return "0 shown";
  return "loading";
}

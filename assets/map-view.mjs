/** Open the map on a preset or on lat, lng, and zoom. No parcel claims. */

import { regionById } from "./site-catalog.mjs";

function num(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * place=ashburn, or lat and lng with optional z or zoom.
 * When lat and lng are both valid, they override place.
 */
export function viewFromSearch(search) {
  const params = typeof search === "string" ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search) : search;
  if (!params) return null;
  const lat = num(params.get("lat"));
  const lng = num(params.get("lng") ?? params.get("lon"));
  const zoom = num(params.get("z") ?? params.get("zoom"));
  if (lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    const z = zoom == null ? 9.5 : Math.min(22, Math.max(0, zoom));
    return { center: [lng, lat], zoom: z, id: null, source: "coordinates" };
  }
  const region = regionById(params.get("place") || params.get("region"));
  if (!region) return null;
  return { center: region.center.slice(), zoom: region.zoom, id: region.id, source: "place" };
}

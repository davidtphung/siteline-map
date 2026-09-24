/** Header for the wells card from the current map center. */

import { JUMP_PLACES } from "./jump-places.mjs";

export function regionForView(center, places = JUMP_PLACES) {
  const lng = Number(center?.[0]);
  const lat = Number(center?.[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  let best = null;
  let bestD = Infinity;
  for (const place of places) {
    if (!place?.center || place.id === "usa") continue;
    const d = Math.hypot(lng - place.center[0], lat - place.center[1]);
    if (d < bestD) {
      bestD = d;
      best = place;
    }
  }
  if (!best || bestD > 1.35) return null;
  return best;
}

export function sourceForView(center) {
  const lng = Number(center?.[0]);
  const lat = Number(center?.[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return "NETL";
  if (lat >= 37 && lat <= 41.1 && lng >= -109.1 && lng <= -102) return "CO ECMC";
  if (lat >= 31.3 && lat < 37 && lng >= -109.15 && lng <= -103.05) return "NM OCD";
  if (lat >= 25.8 && lat <= 36.6 && lng >= -106.7 && lng <= -93.5) return "Texas RRC";
  return "NETL";
}

export function wellViewHeader({ center, fixtureInView, places }) {
  const region = regionForView(center, places);
  const sample = fixtureInView > 0 && (!region || region.id === "cameron");
  const place = region?.name || "This view";
  return {
    place,
    source: sample ? "Sample data" : sourceForView(center),
    sample,
  };
}

export function featuresInBounds(features, bounds) {
  if (!bounds) return features || [];
  const west = bounds.west ?? bounds.getWest?.();
  const east = bounds.east ?? bounds.getEast?.();
  const south = bounds.south ?? bounds.getSouth?.();
  const north = bounds.north ?? bounds.getNorth?.();
  return (features || []).filter((feature) => {
    const pair = feature?.geometry?.coordinates;
    if (!pair || pair.length < 2) return false;
    const lng = pair[0];
    const lat = pair[1];
    return lng >= west && lng <= east && lat >= south && lat <= north;
  });
}

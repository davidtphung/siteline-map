/**
 * EPSG:3081 NAD83 / Texas Centric Lambert conformal conic.
 * Distances and rings use this CRS. Web Mercator is not used.
 * Parameters match pyproj CRS.from_epsg(3081).
 */
const A = 6378137.0;
const F = 1 / 298.257222101;
const E2 = F * (2 - F);
const E = Math.sqrt(E2);
const LAT0 = 31.1666666666667;
const LON0 = -100;
const LAT1 = 27.4166666666667;
const LAT2 = 34.9166666666667;
const X0 = 1000000;
const Y0 = 1000000;
export const METERS_PER_MILE = 1609.344;
export const CRS = "EPSG:3081";

function rad(d) {
  return (d * Math.PI) / 180;
}
function deg(r) {
  return (r * 180) / Math.PI;
}
function mOf(phi) {
  const s = Math.sin(phi);
  return Math.cos(phi) / Math.sqrt(1 - E2 * s * s);
}
function tOf(phi) {
  const s = Math.sin(phi);
  const es = E * s;
  return Math.tan(Math.PI / 4 - phi / 2) / ((1 - es) / (1 + es)) ** (E / 2);
}

const phi1 = rad(LAT1);
const phi2 = rad(LAT2);
const phi0 = rad(LAT0);
const lam0 = rad(LON0);
const m1 = mOf(phi1);
const m2 = mOf(phi2);
const t1 = tOf(phi1);
const t2 = tOf(phi2);
const t0 = tOf(phi0);
const n = (Math.log(m1) - Math.log(m2)) / (Math.log(t1) - Math.log(t2));
const Fconst = m1 / (n * t1 ** n);
const rho0 = A * Fconst * t0 ** n;

export function forward3081(lon, lat) {
  const phi = rad(lat);
  const lam = rad(lon);
  const rho = A * Fconst * tOf(phi) ** n;
  const theta = n * (lam - lam0);
  return [X0 + rho * Math.sin(theta), Y0 + rho0 - rho * Math.cos(theta)];
}

export function inverse3081(x, y) {
  const dx = x - X0;
  const dy = rho0 - (y - Y0);
  const rho = Math.sign(n) * Math.hypot(dx, dy);
  const theta = Math.atan2(dx, dy);
  const tVal = (rho / (A * Fconst)) ** (1 / n);
  let phi = Math.PI / 2 - 2 * Math.atan(tVal);
  for (let i = 0; i < 15; i++) {
    const es = E * Math.sin(phi);
    phi = Math.PI / 2 - 2 * Math.atan(tVal * ((1 - es) / (1 + es)) ** (E / 2));
  }
  const lam = theta / n + lam0;
  return [deg(lam), deg(phi)];
}

export function distanceMeters(lon1, lat1, lon2, lat2) {
  const [x1, y1] = forward3081(lon1, lat1);
  const [x2, y2] = forward3081(lon2, lat2);
  return Math.hypot(x2 - x1, y2 - y1);
}

export function distanceMiles(lon1, lat1, lon2, lat2) {
  return distanceMeters(lon1, lat1, lon2, lat2) / METERS_PER_MILE;
}

function segmentMeters(lon, lat, lon1, lat1, lon2, lat2) {
  const point = forward3081(lon, lat);
  const start = forward3081(lon1, lat1);
  const end = forward3081(lon2, lat2);
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) {
    t = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy));
}

/** Miles from a point to the nearest EIA line vertex segment, in EPSG:3081. */
export function nearestLineMiles(lon, lat, features) {
  let best = null;
  const lines = features || [];
  for (const feature of lines) {
    const geometry = feature?.geometry || feature;
    const parts =
      geometry?.type === "LineString"
        ? [geometry.coordinates]
        : geometry?.type === "MultiLineString"
          ? geometry.coordinates
          : [];
    for (const line of parts) {
      if (!line || line.length < 2) continue;
      for (let i = 1; i < line.length; i++) {
        const meters = segmentMeters(lon, lat, line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]);
        if (best == null || meters < best) best = meters;
      }
    }
  }
  if (best == null) return null;
  return best / METERS_PER_MILE;
}

export function offsetLonLat(lon, lat, eastM, northM) {
  const [x, y] = forward3081(lon, lat);
  return inverse3081(x + eastM, y + northM);
}

/** Closed ring in EPSG:4326, vertices computed in EPSG:3081. */
export function ringPolygon(lon, lat, miles, steps = 64) {
  const [cx, cy] = forward3081(lon, lat);
  const r = miles * METERS_PER_MILE;
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    const theta = (2 * Math.PI * i) / steps;
    const [lonI, latI] = inverse3081(cx + r * Math.sin(theta), cy + r * Math.cos(theta));
    coords.push([lonI, latI]);
  }
  return {
    type: "Polygon",
    coordinates: [coords],
  };
}

export function ringFeatureCollection(lon, lat, milesList) {
  return {
    type: "FeatureCollection",
    features: milesList.map((miles) => ({
      type: "Feature",
      properties: { miles, crs: CRS },
      geometry: ringPolygon(lon, lat, miles),
    })),
  };
}

function projectedRing(ring) {
  return ring.map(([lon, lat]) => forward3081(lon, lat));
}

/** Ray cast in EPSG:3081. Boundary counts as inside. */
export function pointInRing3081(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const dx = xj - xi;
    const dy = yj - yi;
    const len2 = dx * dx + dy * dy;
    if (len2 > 0) {
      const t = ((x - xi) * dx + (y - yi) * dy) / len2;
      if (t >= 0 && t <= 1) {
        const px = xi + t * dx;
        const py = yi + t * dy;
        if (Math.hypot(x - px, y - py) < 0.05) return true;
      }
    }
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInGeometry(lon, lat, geometry) {
  if (!geometry) return false;
  const [x, y] = forward3081(lon, lat);
  const polys =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];
  for (const poly of polys) {
    if (!poly || !poly.length) continue;
    const outer = projectedRing(poly[0]);
    if (!pointInRing3081(x, y, outer)) continue;
    let inHole = false;
    for (let h = 1; h < poly.length; h++) {
      if (pointInRing3081(x, y, projectedRing(poly[h]))) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

export function geometryCentroid(geometry) {
  const ring =
    geometry?.type === "Polygon"
      ? geometry.coordinates?.[0]
      : geometry?.type === "MultiPolygon"
        ? geometry.coordinates?.[0]?.[0]
        : null;
  if (!ring || ring.length < 3) return null;
  let sx = 0;
  let sy = 0;
  let n = 0;
  const limit = ring.length - (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? 1 : 0);
  for (let i = 0; i < limit; i++) {
    const [x, y] = forward3081(ring[i][0], ring[i][1]);
    sx += x;
    sy += y;
    n += 1;
  }
  if (!n) return null;
  return inverse3081(sx / n, sy / n);
}

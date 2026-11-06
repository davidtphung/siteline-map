/**
 * USGS 3DEP terrain math for Siteline.
 * Elevations from the ImageServer are meters. Volumes and labels are estimates.
 */

export const M_PER_FT = 0.3048;
export const FT_PER_M = 1 / M_PER_FT;
export const M3_PER_YD3 = 0.764554857984;
export const ACRE_M2 = 4046.8564224;
export const R_MERC = 6378137;

export const ELEV_STOPS = [
  [0, [32, 56, 140]],
  [0.18, [38, 128, 186]],
  [0.38, [72, 184, 176]],
  [0.55, [176, 214, 154]],
  [0.72, [250, 214, 120]],
  [0.86, [236, 112, 62]],
  [1, [168, 28, 42]],
];

export const SLOPE_STOPS = [
  [0, [232, 232, 226]],
  [0.25, [186, 210, 140]],
  [0.5, [236, 190, 84]],
  [0.75, [210, 96, 42]],
  [1, [120, 24, 28]],
];

export const CUT_STOPS = [
  [0, [32, 102, 176]],
  [0.28, [116, 176, 214]],
  [0.5, [244, 244, 244]],
  [0.72, [236, 150, 110]],
  [1, [168, 36, 36]],
];

export function isLidarMeter(value) {
  return typeof value === "number" && value === value && value > -500 && value < 9000;
}

export function metersToFeet(meters) {
  return meters * FT_PER_M;
}

export function formatReadout(elevM, lat, lon) {
  const la = Number(lat).toFixed(5);
  const lo = Number(lon).toFixed(5);
  if (!isLidarMeter(elevM)) return "no lidar here · " + la + ", " + lo;
  return metersToFeet(elevM).toFixed(2) + " ft (" + Number(elevM).toFixed(2) + " m) · " + la + ", " + lo;
}

export function acresLabel(acres) {
  if (!Number.isFinite(acres)) return "UNKNOWN";
  if (acres >= 10 && Math.abs(acres - Math.round(acres)) < 0.05) return Math.round(acres) + " ac";
  if (acres >= 100) return Math.round(acres) + " ac";
  return acres.toFixed(1) + " ac";
}

export function lngLatToMerc(lng, lat) {
  const x = R_MERC * lng * Math.PI / 180;
  const s = Math.sin(lat * Math.PI / 180);
  const y = (R_MERC * Math.log((1 + s) / (1 - s))) / 2;
  return [x, y];
}

export function mercToLngLat(x, y) {
  const lng = (x / R_MERC) * 180 / Math.PI;
  const lat = (2 * Math.atan(Math.exp(y / R_MERC)) - Math.PI / 2) * 180 / Math.PI;
  return [lng, lat];
}

export function localFeet(origin, lng, lat) {
  const lat0 = origin[1] * Math.PI / 180;
  const north = (lat - origin[1]) * Math.PI / 180 * R_MERC * FT_PER_M;
  const east = (lng - origin[0]) * Math.PI / 180 * Math.cos(lat0) * R_MERC * FT_PER_M;
  return [east, north];
}

export function haversineM(a, b) {
  const p1 = a[1] * Math.PI / 180;
  const p2 = b[1] * Math.PI / 180;
  const dp = (b[1] - a[1]) * Math.PI / 180;
  const dl = (b[0] - a[0]) * Math.PI / 180;
  const s = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_MERC * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function bearingDeg(a, b) {
  const p1 = a[1] * Math.PI / 180;
  const p2 = b[1] * Math.PI / 180;
  const dl = (b[0] - a[0]) * Math.PI / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function bilinear(grid, width, x, y) {
  const height = Math.floor(grid.length / width);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  if (x0 < 0 || y0 < 0 || x1 >= width || y1 >= height) return null;
  const ax = x - x0;
  const ay = y - y0;
  const v00 = grid[y0 * width + x0];
  const v10 = grid[y0 * width + x1];
  const v01 = grid[y1 * width + x0];
  const v11 = grid[y1 * width + x1];
  if (!isLidarMeter(v00) || !isLidarMeter(v10) || !isLidarMeter(v01) || !isLidarMeter(v11)) {
    const cx = Math.max(0, Math.min(width - 1, Math.round(x)));
    const cy = Math.max(0, Math.min(height - 1, Math.round(y)));
    const c = grid[cy * width + cx];
    return isLidarMeter(c) ? c : null;
  }
  return (v00 * (1 - ax) + v10 * ax) * (1 - ay) + (v01 * (1 - ax) + v11 * ax) * ay;
}

export function tileBBox(z, x, y, tile = 256) {
  const world = Math.PI * R_MERC * 2;
  const size = world / 2 ** z;
  const px = size / tile;
  const minX = -world / 2 + x * size - px;
  const maxX = minX + size + 2 * px;
  const maxY = world / 2 - y * size + px;
  const minY = maxY - size - 2 * px;
  const latC = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / 2 ** z)));
  return { bbox: [minX, minY, maxX, maxY], cell: px * Math.cos(latC) };
}

export function rampColor(stops, t) {
  const u = Math.max(0, Math.min(1, t));
  let k = 0;
  while (k < stops.length - 2 && u > stops[k + 1][0]) k += 1;
  const a = stops[k];
  const b = stops[k + 1];
  const f = (u - a[0]) / ((b[0] - a[0]) || 1);
  return [
    Math.round(a[1][0] + (b[1][0] - a[1][0]) * f),
    Math.round(a[1][1] + (b[1][1] - a[1][1]) * f),
    Math.round(a[1][2] + (b[1][2] - a[1][2]) * f),
  ];
}

export function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function ringAcres(lnglat) {
  if (!lnglat || lnglat.length < 3) return 0;
  const origin = lnglat[0];
  const pts = lnglat.map((p) => localFeet(origin, p[0], p[1]));
  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  const m2 = (Math.abs(area) / 2) * M_PER_FT * M_PER_FT;
  return m2 / ACRE_M2;
}

export function densifyLngLat(pts, stepM) {
  if (!pts || pts.length < 2) return { samples: [], totalM: 0, vtxM: [0] };
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = haversineM(pts[i - 1], pts[i]);
    seg.push(d);
    total += d;
  }
  const step = Math.max(stepM || 1, total / 1500);
  const samples = [];
  const vtxM = [0];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const length = seg[i - 1];
    const n = Math.max(1, Math.ceil(length / step));
    const k0 = i === 1 ? 0 : 1;
    for (let k = k0; k <= n; k++) {
      const f = k / n;
      samples.push({
        lng: a[0] + (b[0] - a[0]) * f,
        lat: a[1] + (b[1] - a[1]) * f,
        dM: acc + length * f,
      });
    }
    acc += length;
    vtxM.push(acc);
  }
  return { samples, totalM: total, vtxM };
}

export function profileStats(samples, totalM) {
  const good = (samples || []).filter((p) => isLidarMeter(p.zM));
  if (good.length < 2) return null;
  const feet = good.map((p) => p.zM * FT_PER_M);
  const startFt = feet[0];
  const endFt = feet[feet.length - 1];
  const riseFt = endFt - startFt;
  const distFt = (totalM || 0) * FT_PER_M;
  return {
    lengthM: totalM || 0,
    lengthFt: distFt,
    startFt,
    endFt,
    riseFt,
    gradePct: distFt ? (riseFt / distFt) * 100 : 0,
    lowFt: Math.min(...feet),
    highFt: Math.max(...feet),
  };
}

export function profileCsv(samples) {
  const rows = ["distance_ft,elevation_ft,lat,lon"];
  for (const p of samples || []) {
    const dist = ((p.dM || 0) * FT_PER_M).toFixed(2);
    const elev = isLidarMeter(p.zM) ? (p.zM * FT_PER_M).toFixed(3) : "";
    rows.push(dist + "," + elev + "," + Number(p.lat).toFixed(7) + "," + Number(p.lng).toFixed(7));
  }
  return rows.join("\r\n") + "\r\n";
}

export function pointAtDistance(samples, dM) {
  if (!samples || !samples.length) return null;
  if (dM <= samples[0].dM) return samples[0];
  const last = samples[samples.length - 1];
  if (dM >= last.dM) return last;
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].dM < dM) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const f = (dM - a.dM) / ((b.dM - a.dM) || 1);
  const zA = isLidarMeter(a.zM) ? a.zM : null;
  const zB = isLidarMeter(b.zM) ? b.zM : null;
  let zM = null;
  if (zA != null && zB != null) zM = zA + (zB - zA) * f;
  else zM = zA != null ? zA : zB;
  return {
    lng: a.lng + (b.lng - a.lng) * f,
    lat: a.lat + (b.lat - a.lat) * f,
    dM,
    zM,
  };
}

export function buildGridSpec(ringLngLat, maxCells = 160000) {
  const merc = ringLngLat.map(([lng, lat]) => lngLatToMerc(lng, lat));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of merc) {
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  const latC = mercToLngLat((minX + maxX) / 2, (minY + maxY) / 2)[1];
  const k = Math.cos((latC * Math.PI) / 180) || 1;
  const gw = (maxX - minX) * k;
  const gh = (maxY - minY) * k;
  let cell = Math.max(1, Math.sqrt((gw * gh) / maxCells), Math.max(gw, gh) / 1800);
  cell = Math.round(cell * 10) / 10;
  let cm = cell / k;
  minX -= cm;
  minY -= cm;
  maxX += cm;
  maxY += cm;
  let width = Math.ceil((maxX - minX) / cm);
  let height = Math.ceil((maxY - minY) / cm);
  if (width * height > maxCells * 1.15) {
    const scale = Math.sqrt((width * height) / maxCells);
    cell = Math.round(cell * scale * 10) / 10;
    cm = cell / k;
    width = Math.ceil((maxX - minX) / cm);
    height = Math.ceil((maxY - minY) / cm);
  }
  maxX = minX + width * cm;
  minY = maxY - height * cm;
  return { width, height, cm, cell, k, minX, minY, maxX, maxY, merc, latC };
}

export function maskGrid(spec, elevMeters) {
  const { width, height, cm, k, minX, maxY, maxX, minY, merc } = spec;
  const n = width * height;
  const ex = new Float32Array(n);
  const inside = new Uint8Array(n);
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  const sec = new Int16Array(n);
  sec.fill(-1);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  let count = 0;
  let minM = Infinity;
  let maxM = -Infinity;
  for (let j = 0; j < height; j++) {
    const y = maxY - (j + 0.5) * cm;
    for (let i = 0; i < width; i++) {
      const x = minX + (i + 0.5) * cm;
      const idx = j * width + i;
      const v = elevMeters[idx];
      const ok = isLidarMeter(v);
      ex[idx] = ok ? v : NaN;
      xs[idx] = (x - cx) * k;
      ys[idx] = (y - cy) * k;
      if (ok && pointInRing(x, y, merc)) {
        inside[idx] = 1;
        sec[idx] = 0;
        count += 1;
        if (v < minM) minM = v;
        if (v > maxM) maxM = v;
      }
    }
  }
  return { ex, inside, sec, xs, ys, count, cx, cy, minM, maxM };
}

export function gridPointLngLat(spec, gx, gy) {
  const x = spec.minX + gx * spec.cm;
  const y = spec.maxY - gy * spec.cm;
  return mercToLngLat(x, y);
}

export function cellLngLat(spec, i, j) {
  return gridPointLngLat(spec, i + 0.5, j + 0.5);
}

export function smoothFeet(exMeters, width, height) {
  let src = new Float32Array(width * height);
  for (let i = 0; i < src.length; i++) src[i] = isLidarMeter(exMeters[i]) ? exMeters[i] * FT_PER_M : NaN;
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(src.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
            const v = src[yy * width + xx];
            if (v === v) {
              sum += v;
              n += 1;
            }
          }
        }
        out[y * width + x] = n ? sum / n : NaN;
      }
    }
    src = out;
  }
  return src;
}

function solve3(matrix, vector) {
  const m = matrix.map((row, i) => [row[0], row[1], row[2], vector[i]]);
  for (let c = 0; c < 3; c++) {
    let piv = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
    const swap = m[c];
    m[c] = m[piv];
    m[piv] = swap;
    const div = m[c][c];
    if (Math.abs(div) < 1e-12) return null;
    for (let q = c; q < 4; q++) m[c][q] /= div;
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = m[r][c];
      for (let q = c; q < 4; q++) m[r][q] -= f * m[c][q];
    }
  }
  return [m[0][3], m[1][3], m[2][3]];
}

export function fitPlane(xs, ys, zs, sec, sectionId) {
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let sxz = 0;
  let syz = 0;
  let n = 0;
  for (let i = 0; i < zs.length; i++) {
    if (sec[i] !== sectionId || zs[i] !== zs[i]) continue;
    const x = xs[i];
    const y = ys[i];
    const z = zs[i];
    sxx += x * x;
    sxy += x * y;
    syy += y * y;
    sx += x;
    sy += y;
    sz += z;
    sxz += x * z;
    syz += y * z;
    n += 1;
  }
  if (n < 3) return { slope: 0, heading: 0, n };
  const sol = solve3(
    [
      [sxx, sxy, sx],
      [sxy, syy, sy],
      [sx, sy, n],
    ],
    [sxz, syz, sz],
  );
  if (!sol) return { slope: 0, heading: 0, n };
  const slope = Math.round(Math.hypot(sol[0], sol[1]) * 100 * 1000) / 1000;
  const heading = Math.round(((Math.atan2(-sol[0], -sol[1]) * 180) / Math.PI + 360) % 360 * 10) / 10;
  return { slope, heading, n };
}

function sectionVolumes(xs, ys, zs, sec, sectionId, slope, heading, ratio) {
  const h = (heading * Math.PI) / 180;
  const ux = Math.sin(h);
  const uy = Math.cos(h);
  const idx = [];
  const tilt = [];
  let zmin = Infinity;
  let zmax = -Infinity;
  for (let i = 0; i < zs.length; i++) {
    if (sec[i] !== sectionId || zs[i] !== zs[i]) continue;
    const t = -(slope / 100) * (xs[i] * ux + ys[i] * uy);
    const residual = zs[i] - t;
    idx.push(i);
    tilt.push(t);
    if (residual < zmin) zmin = residual;
    if (residual > zmax) zmax = residual;
  }
  if (!idx.length || zmin === Infinity) return null;
  const target = Math.max(0.5, Math.min(3, Number.isFinite(ratio) ? ratio : 1));
  const vols = (offset) => {
    let cut = 0;
    let fill = 0;
    for (let k = 0; k < idx.length; k++) {
      const d = zs[idx[k]] - tilt[k] - offset;
      if (d > 0) cut += d;
      else fill -= d;
    }
    return [cut, fill];
  };
  let lo = zmin;
  let hi = zmax;
  for (let it = 0; it < 52; it++) {
    const mid = (lo + hi) / 2;
    const pair = vols(mid);
    if (pair[0] > target * pair[1]) lo = mid;
    else hi = mid;
  }
  const offset = (lo + hi) / 2;
  const pair = vols(offset);
  let maxCut = 0;
  let maxFill = 0;
  const designAt = new Map();
  for (let k = 0; k < idx.length; k++) {
    const design = offset + tilt[k];
    designAt.set(idx[k], design);
    const d = zs[idx[k]] - design;
    if (d > maxCut) maxCut = d;
    if (-d > maxFill) maxFill = -d;
  }
  return {
    idx,
    designAt,
    cutM: pair[0],
    fillM: pair[1],
    maxCutM: maxCut,
    maxFillM: maxFill,
    cells: idx.length,
    centroidIndex: idx[Math.floor(idx.length / 2)],
  };
}

export function analyzeCutFill({ xs, ys, zs, sec, cellM, ratio = 1, overrides = {} }) {
  const ids = [];
  const seen = new Set();
  for (let i = 0; i < sec.length; i++) {
    if (sec[i] >= 0 && !seen.has(sec[i])) {
      seen.add(sec[i]);
      ids.push(sec[i]);
    }
  }
  ids.sort((a, b) => a - b);
  const design = new Float32Array(zs.length);
  design.fill(NaN);
  const area = cellM * cellM;
  const sections = [];
  for (const id of ids) {
    const fit = fitPlane(xs, ys, zs, sec, id);
    const slope = overrides[id] && Number.isFinite(overrides[id].slope) ? overrides[id].slope : fit.slope;
    const heading = overrides[id] && Number.isFinite(overrides[id].heading) ? overrides[id].heading : fit.heading;
    const solved = sectionVolumes(xs, ys, zs, sec, id, slope, heading, ratio);
    if (!solved) continue;
    for (const [index, value] of solved.designAt) design[index] = value;
    const acres = (solved.cells * area) / ACRE_M2;
    const cutYd = (solved.cutM * area) / M3_PER_YD3;
    const fillYd = (solved.fillM * area) / M3_PER_YD3;
    sections.push({
      id,
      slope,
      heading,
      acres,
      cutYd,
      fillYd,
      maxCutFt: solved.maxCutM * FT_PER_M,
      maxFillFt: solved.maxFillM * FT_PER_M,
      cells: solved.cells,
    });
  }
  const totals = sections.reduce(
    (t, s) => {
      t.acres += s.acres;
      t.cutYd += s.cutYd;
      t.fillYd += s.fillYd;
      t.maxCutFt = Math.max(t.maxCutFt, s.maxCutFt);
      t.maxFillFt = Math.max(t.maxFillFt, s.maxFillFt);
      return t;
    },
    { acres: 0, cutYd: 0, fillYd: 0, maxCutFt: 0, maxFillFt: 0 },
  );
  totals.ratio = totals.fillYd > 0 ? totals.cutYd / totals.fillYd : null;
  return { design, sections, totals };
}

export function rasterSegment(width, height, x0, y0, x1, y1) {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 4));
  const out = [];
  let px = null;
  let py = null;
  for (let t = 0; t <= n; t++) {
    const x = Math.round(x0 + ((x1 - x0) * t) / n);
    const y = Math.round(y0 + ((y1 - y0) * t) / n);
    if (x >= 0 && y >= 0 && x < width && y < height) out.push(y * width + x);
    if (px != null && x !== px && y !== py && px >= 0 && y >= 0 && px < width && y < height) out.push(y * width + px);
    px = x;
    py = y;
  }
  return out;
}

export function splitByBarrier(sec, width, height, barrierIdxs) {
  const n = width * height;
  const barrier = new Uint8Array(n);
  for (const i of barrierIdxs || []) if (i >= 0 && i < n) barrier[i] = 1;
  const out = new Int16Array(sec);
  const touched = [];
  const seenTouch = new Set();
  for (let i = 0; i < n; i++) {
    if (barrier[i] && sec[i] >= 0 && !seenTouch.has(sec[i])) {
      seenTouch.add(sec[i]);
      touched.push(sec[i]);
    }
  }
  let nextId = 0;
  for (let i = 0; i < n; i++) if (sec[i] >= nextId) nextId = sec[i] + 1;
  let added = 0;
  for (const sid of touched) {
    const comp = new Int32Array(n);
    comp.fill(-1);
    const sizes = [];
    let ncomp = 0;
    const queue = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      if (sec[i] !== sid || barrier[i] || comp[i] !== -1) continue;
      let head = 0;
      let tail = 0;
      let size = 0;
      queue[tail++] = i;
      comp[i] = ncomp;
      while (head < tail) {
        const c = queue[head++];
        const x = c % width;
        size += 1;
        const nbs = [];
        if (x > 0) nbs.push(c - 1);
        if (x < width - 1) nbs.push(c + 1);
        if (c >= width) nbs.push(c - width);
        if (c + width < n) nbs.push(c + width);
        for (const nb of nbs) {
          if (sec[nb] === sid && !barrier[nb] && comp[nb] === -1) {
            comp[nb] = ncomp;
            queue[tail++] = nb;
          }
        }
      }
      sizes.push(size);
      ncomp += 1;
    }
    const total = sizes.reduce((a, b) => a + b, 0);
    const minSize = Math.max(4, Math.floor(total * 0.02));
    const big = sizes
      .map((sz, index) => [sz, index])
      .filter(([sz]) => sz >= minSize)
      .sort((a, b) => b[0] - a[0]);
    if (big.length < 2) continue;
    const remap = new Map();
    remap.set(big[0][1], sid);
    for (let k = 1; k < big.length; k++) {
      remap.set(big[k][1], nextId++);
      added += 1;
    }
    let pending = [];
    for (let i = 0; i < n; i++) {
      if (sec[i] !== sid) continue;
      const cc = comp[i];
      if (cc >= 0 && remap.has(cc)) out[i] = remap.get(cc);
      else {
        out[i] = -2;
        pending.push(i);
      }
    }
    for (let pass = 0; pass < width + height && pending.length; pass++) {
      const still = [];
      for (const c of pending) {
        const x = c % width;
        const nbs = [];
        if (x > 0) nbs.push(c - 1);
        if (x < width - 1) nbs.push(c + 1);
        if (c >= width) nbs.push(c - width);
        if (c + width < n) nbs.push(c + width);
        let lab = -1;
        for (const nb of nbs) {
          if (out[nb] >= 0) {
            lab = out[nb];
            break;
          }
        }
        if (lab >= 0) out[c] = lab;
        else still.push(c);
      }
      if (still.length === pending.length) break;
      pending = still;
    }
    for (const c of pending) out[c] = sid;
  }
  return { sec: out, added };
}

export function traceContours(values, width, height, interval, inside) {
  const lines = [];
  if (!(interval > 0)) return lines;
  const majorEvery = interval >= 1 ? 5 : Math.max(1, Math.round(1 / interval));
  const buckets = new Map();
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const i0 = y * width + x;
      const i1 = i0 + 1;
      const i2 = i0 + width + 1;
      const i3 = i0 + width;
      if (inside && (!inside[i0] || !inside[i1] || !inside[i2] || !inside[i3])) continue;
      const a = values[i0];
      const b = values[i1];
      const c = values[i2];
      const d = values[i3];
      if (a !== a || b !== b || c !== c || d !== d) continue;
      const lo = Math.min(a, b, c, d);
      const hi = Math.max(a, b, c, d);
      const k0 = Math.ceil(lo / interval);
      const k1 = Math.floor(hi / interval);
      for (let k = k0; k <= k1; k++) {
        const level = k * interval;
        const pts = [];
        if ((a < level) !== (b < level)) pts.push([x + (level - a) / (b - a), y]);
        if ((b < level) !== (c < level)) pts.push([x + 1, y + (level - b) / (c - b)]);
        if ((d < level) !== (c < level)) pts.push([x + (level - d) / (c - d), y + 1]);
        if ((a < level) !== (d < level)) pts.push([x, y + (level - a) / (d - a)]);
        if (pts.length < 2) continue;
        const key = String(k);
        if (!buckets.has(key)) buckets.set(key, []);
        const bucket = buckets.get(key);
        bucket.push([pts[0], pts[1], k]);
        if (pts.length === 4) bucket.push([pts[2], pts[3], k]);
      }
    }
  }
  for (const segs of buckets.values()) {
    const level = segs[0][2] * interval;
    const major = Math.abs(segs[0][2]) % majorEvery === 0;
    const chained = chainSegments(segs);
    for (const pts of chained) lines.push({ level, major, pts });
  }
  return lines;
}

function chainSegments(segs) {
  const key = (p) => p[0].toFixed(3) + "," + p[1].toFixed(3);
  const open = new Map();
  const alive = new Uint8Array(segs.length);
  alive.fill(1);
  const add = (k, idx) => {
    const list = open.get(k);
    if (list) list.push(idx);
    else open.set(k, [idx]);
  };
  segs.forEach((seg, idx) => {
    add(key(seg[0]), idx);
    add(key(seg[1]), idx);
  });
  const take = (k) => {
    const list = open.get(k);
    if (!list) return -1;
    while (list.length && !alive[list[list.length - 1]]) list.pop();
    if (!list.length) return -1;
    return list.pop();
  };
  const lines = [];
  for (let s = 0; s < segs.length; s++) {
    if (!alive[s]) continue;
    alive[s] = 0;
    const line = [segs[s][0], segs[s][1]];
    let grew = true;
    while (grew) {
      grew = false;
      const ends = [
        [0, line[0]],
        [1, line[line.length - 1]],
      ];
      for (const [atStart, end] of ends) {
        const idx = take(key(end));
        if (idx < 0 || !alive[idx]) continue;
        alive[idx] = 0;
        const seg = segs[idx];
        const other = key(seg[0]) === key(end) ? seg[1] : seg[0];
        if (atStart) line.unshift(other);
        else line.push(other);
        grew = true;
        break;
      }
    }
    if (line.length >= 2) lines.push(line);
  }
  return lines;
}

const DX = [-1, 0, 1, -1, 1, -1, 0, 1];
const DY = [-1, -1, -1, 0, 0, 1, 1, 1];

export function computeDrainage(elevFt, width, height, inside) {
  const n = width * height;
  const z = elevFt;
  const filled = new Float32Array(n);
  const closed = new Uint8Array(n);
  const heapK = new Float64Array(n);
  const heapI = new Int32Array(n);
  let hs = 0;
  const push = (i, k) => {
    let p = hs++;
    while (p > 0) {
      const q = (p - 1) >> 1;
      if (heapK[q] <= k) break;
      heapK[p] = heapK[q];
      heapI[p] = heapI[q];
      p = q;
    }
    heapK[p] = k;
    heapI[p] = i;
  };
  const pop = () => {
    const top = heapI[0];
    hs -= 1;
    const k = heapK[hs];
    const i = heapI[hs];
    let p = 0;
    while (true) {
      let c = p * 2 + 1;
      if (c >= hs) break;
      if (c + 1 < hs && heapK[c + 1] < heapK[c]) c += 1;
      if (heapK[c] >= k) break;
      heapK[p] = heapK[c];
      heapI[p] = heapI[c];
      p = c;
    }
    if (hs > 0) {
      heapK[p] = k;
      heapI[p] = i;
    }
    return top;
  };
  for (let i = 0; i < n; i++) {
    filled[i] = z[i];
    if (z[i] !== z[i]) {
      closed[i] = 1;
      continue;
    }
    const x = i % width;
    const y = (i / width) | 0;
    let edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    if (!edge) {
      for (let d = 0; d < 8 && !edge; d++) {
        const nb = (y + DY[d]) * width + x + DX[d];
        if (z[nb] !== z[nb]) edge = true;
      }
    }
    if (edge) {
      closed[i] = 1;
      push(i, z[i]);
    }
  }
  const order = new Int32Array(n);
  let oc = 0;
  const eps = 1e-4;
  while (hs) {
    const c = pop();
    order[oc++] = c;
    const cx = c % width;
    const cy = (c / width) | 0;
    for (let d = 0; d < 8; d++) {
      const xx = cx + DX[d];
      const yy = cy + DY[d];
      if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
      const nn = yy * width + xx;
      if (closed[nn]) continue;
      closed[nn] = 1;
      if (filled[nn] <= filled[c] + eps) filled[nn] = filled[c] + eps;
      push(nn, filled[nn]);
    }
  }
  const receiver = new Int32Array(n);
  receiver.fill(-1);
  for (let i = 0; i < n; i++) {
    if (z[i] !== z[i]) continue;
    const x0 = i % width;
    const y0 = (i / width) | 0;
    let best = 0;
    let bi = -1;
    for (let d = 0; d < 8; d++) {
      const x1 = x0 + DX[d];
      const y1 = y0 + DY[d];
      if (x1 < 0 || y1 < 0 || x1 >= width || y1 >= height) continue;
      const j = y1 * width + x1;
      if (z[j] !== z[j]) continue;
      const dist = DX[d] && DY[d] ? Math.SQRT2 : 1;
      const slope = (filled[i] - filled[j]) / dist;
      if (slope > best) {
        best = slope;
        bi = j;
      }
    }
    receiver[i] = bi;
  }
  const acc = new Float32Array(n);
  for (let i = 0; i < n; i++) if (z[i] === z[i]) acc[i] = 1;
  for (let k = oc - 1; k >= 0; k--) {
    const c = order[k];
    const r = receiver[c];
    if (r >= 0) acc[r] += acc[c];
  }
  const pondFt = new Float32Array(n);
  let pondCells = 0;
  for (let i = 0; i < n; i++) {
    if (!inside || !inside[i]) continue;
    const dep = filled[i] - z[i];
    if (dep >= 0.1) {
      pondFt[i] = dep;
      pondCells += 1;
    }
  }
  return { receiver, acc, pondFt, filled, pondCells };
}

function chaikin(pts) {
  let cur = pts;
  for (let it = 0; it < 2 && cur.length > 2; it++) {
    const out = [cur[0]];
    for (let k = 0; k < cur.length - 1; k++) {
      const a = cur[k];
      const b = cur[k + 1];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out.push(cur[cur.length - 1]);
    cur = out;
  }
  return cur;
}

export function traceDrainage(spec, elevFt, inside, drain, minAcres) {
  const width = spec.width;
  const n = elevFt.length;
  const cellArea = spec.cell * spec.cell;
  const threshold = Math.max(1, (minAcres * ACRE_M2) / cellArea);
  const channel = (i) => i >= 0 && inside[i] && drain.acc[i] >= threshold && !(drain.pondFt[i] > 0);
  const tierOf = (i) => {
    const a = drain.acc[i];
    if (a >= 16 * threshold) return 2;
    if (a >= 4 * threshold) return 1;
    return 0;
  };
  const up = new Uint16Array(n);
  const seen = new Uint8Array(n);
  const outlets = [];
  for (let i = 0; i < n; i++) {
    if (!channel(i)) continue;
    const r = drain.receiver[i];
    if (channel(r)) up[r] = Math.min(65535, up[r] + 1);
    const leaves = r < 0 || !inside[r] || drain.pondFt[r] > 0;
    if (leaves) outlets.push({ index: i, acres: (drain.acc[i] * cellArea) / ACRE_M2 });
  }
  const tiers = [[], [], []];
  const trace = (start) => {
    let c = start;
    let run = [c];
    let tier = tierOf(c);
    seen[c] = 1;
    while (true) {
      const r = drain.receiver[c];
      if (!channel(r)) {
        if (r >= 0 && inside[r]) run.push(r);
        break;
      }
      const nextTier = tierOf(r);
      run.push(r);
      if (nextTier !== tier) {
        tiers[tier].push(run.map((idx) => cellLngLat(spec, idx % width, (idx / width) | 0)));
        run = [r];
        tier = nextTier;
      }
      if (seen[r]) break;
      seen[r] = 1;
      c = r;
    }
    if (run.length > 1) tiers[tier].push(run.map((idx) => cellLngLat(spec, idx % width, (idx / width) | 0)));
  };
  for (let i = 0; i < n; i++) if (channel(i) && up[i] === 0) trace(i);
  for (let i = 0; i < n; i++) if (channel(i) && !seen[i]) trace(i);
  const lines = [];
  const widths = [1.6, 2.8, 4.4];
  tiers.forEach((group, tier) => {
    for (const raw of group) {
      const coords = chaikin(raw);
      if (coords.length > 1) lines.push({ coords, tier, width: widths[tier] });
    }
  });
  outlets.sort((a, b) => b.acres - a.acres);
  const shown = [];
  for (const ot of outlets) {
    const lnglat = cellLngLat(spec, ot.index % width, (ot.index / width) | 0);
    if (shown.length >= 12) break;
    if (shown.some((s) => haversineM(s.lnglat, lnglat) < 80)) continue;
    const r = drain.receiver[ot.index];
    let bearing = 90;
    if (r >= 0) {
      const next = cellLngLat(spec, r % width, (r / width) | 0);
      bearing = bearingDeg(lnglat, next);
    }
    shown.push({ lnglat, acres: ot.acres, bearing, label: acresLabel(ot.acres) });
  }
  const arrows = [];
  for (const line of lines) {
    let walked = 0;
    let since = 1e9;
    const spacing = 18 + line.tier * 10;
    for (let i = 1; i < line.coords.length; i++) {
      const step = haversineM(line.coords[i - 1], line.coords[i]);
      walked += step;
      since += step;
      if (since < spacing) continue;
      since = 0;
      arrows.push({
        lnglat: line.coords[i],
        bearing: bearingDeg(line.coords[i - 1], line.coords[i]),
      });
    }
  }
  let pondCells = 0;
  for (let i = 0; i < n; i++) if (inside[i] && drain.pondFt[i] > 0) pondCells += 1;
  return {
    lines,
    outlets: shown,
    arrows,
    pondAcres: (pondCells * cellArea) / ACRE_M2,
    pondCells,
  };
}

export function existingCsv(points) {
  const rows = ["point,lat,lon,existing_ft,source"];
  points.forEach((p, i) => {
    rows.push(
      i +
        1 +
        "," +
        Number(p.lat).toFixed(8) +
        "," +
        Number(p.lon).toFixed(8) +
        "," +
        Number(p.existingFt).toFixed(3) +
        ",USGS 3DEP estimate. Verify with survey.",
    );
  });
  return rows.join("\r\n") + "\r\n";
}

export function designCsv(points) {
  const rows = ["point,section,lat,lon,design_ft,cut_fill_ft,source"];
  points.forEach((p, i) => {
    rows.push(
      [
        i + 1,
        p.section,
        Number(p.lat).toFixed(8),
        Number(p.lon).toFixed(8),
        Number(p.designFt).toFixed(3),
        Number(p.cutFillFt).toFixed(3),
        "USGS 3DEP estimate. Verify with survey.",
      ].join(","),
    );
  });
  return rows.join("\r\n") + "\r\n";
}

function dxfNum(n) {
  return Number.isFinite(n) ? n.toFixed(3) : "0.000";
}

function lwpolyline(layer, pts, closed) {
  if (!pts || pts.length < 2) return "";
  let s = "0\nLWPOLYLINE\n8\n" + layer + "\n90\n" + pts.length + "\n70\n" + (closed ? 1 : 0) + "\n";
  for (const p of pts) s += "10\n" + dxfNum(p[0]) + "\n20\n" + dxfNum(p[1]) + "\n";
  return s;
}

function pointEnt(layer, xy) {
  return "0\nPOINT\n8\n" + layer + "\n10\n" + dxfNum(xy[0]) + "\n20\n" + dxfNum(xy[1]) + "\n";
}

function textEnt(layer, xy, text, height) {
  const clean = String(text || "").replace(/[\r\n]/g, " ").slice(0, 180);
  return (
    "0\nTEXT\n8\n" +
    layer +
    "\n10\n" +
    dxfNum(xy[0]) +
    "\n20\n" +
    dxfNum(xy[1]) +
    "\n40\n" +
    dxfNum(height || 8) +
    "\n1\n" +
    clean +
    "\n"
  );
}

export function buildDxf(doc) {
  const note = doc.note || "USGS 3DEP estimate. Verify with survey. Plan units are feet east and north of the origin.";
  let ents = textEnt("NOTES", [0, 0], note, 6);
  for (const pl of doc.polylines || []) ents += lwpolyline(pl.layer, pl.pts, !!pl.closed);
  for (const pt of doc.points || []) {
    ents += pointEnt(pt.layer || "OUTLETS", pt.xy);
    if (pt.label) ents += textEnt(pt.layer || "OUTLETS", [pt.xy[0] + 4, pt.xy[1] + 4], pt.label, 4);
  }
  return (
    "0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n2\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n" +
    "0\nSECTION\n2\nENTITIES\n" +
    ents +
    "0\nENDSEC\n0\nEOF\n"
  );
}

export function terrainGeoJSON(parts) {
  const features = [];
  if (parts.pad && parts.pad.length >= 3) {
    const ring = parts.pad.slice();
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
    features.push({ type: "Feature", properties: { layer: "PAD", source: "USGS 3DEP estimate" }, geometry: { type: "Polygon", coordinates: [ring] } });
  }
  if (parts.profile && parts.profile.length >= 2) {
    features.push({
      type: "Feature",
      properties: { layer: "PROFILE", source: "USGS 3DEP estimate" },
      geometry: { type: "LineString", coordinates: parts.profile },
    });
  }
  for (const line of parts.drainage || []) {
    features.push({
      type: "Feature",
      properties: { layer: "DRAINAGE", tier: line.tier, source: "USGS 3DEP estimate" },
      geometry: { type: "LineString", coordinates: line.coords },
    });
  }
  for (const ot of parts.outlets || []) {
    features.push({
      type: "Feature",
      properties: { layer: "OUTLETS", acres: ot.acres, label: ot.label, source: "USGS 3DEP estimate" },
      geometry: { type: "Point", coordinates: ot.lnglat },
    });
  }
  return { type: "FeatureCollection", features };
}

function pdfEscape(text) {
  return String(text)
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapPdf(text, width) {
  const clean = pdfEscape(text);
  if (clean.length <= width) return [clean];
  const out = [];
  let rest = clean;
  while (rest.length > width) {
    let cut = rest.lastIndexOf(" ", width);
    if (cut < 12) cut = width;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

export function buildPdf({ title, lines, jpeg }) {
  const chunks = [];
  const pushStr = (s) => chunks.push(new TextEncoder().encode(s));
  const pushBytes = (b) => chunks.push(b);
  pushStr("%PDF-1.4\n");
  const offsets = [0];
  const addObj = (n, body) => {
    let size = 0;
    for (const c of chunks) size += c.length;
    offsets[n] = size;
    pushStr(n + " 0 obj\n");
    if (typeof body === "string") pushStr(body);
    else pushBytes(body);
    pushStr("\nendobj\n");
  };
  const text = [];
  let y = 750;
  const all = [title || "Siteline terrain", ...(lines || []), "USGS 3DEP estimate. Verify with survey."];
  for (const line of all) {
    for (const part of wrapPdf(line, 92)) {
      if (y < (jpeg ? 280 : 48)) break;
      text.push("BT /F1 " + (line === all[0] ? 14 : 10) + " Tf 48 " + y + " Td (" + part + ") Tj ET");
      y -= line === all[0] ? 22 : 13;
    }
  }
  let drawImage = "";
  if (jpeg && jpeg.bytes && jpeg.width && jpeg.height) {
    const maxW = 516;
    const maxH = Math.max(80, y - 72);
    const scale = Math.min(maxW / jpeg.width, maxH / jpeg.height);
    const w = Math.max(1, Math.round(jpeg.width * scale));
    const h = Math.max(1, Math.round(jpeg.height * scale));
    drawImage = "\nq " + w + " 0 0 " + h + " 48 56 cm /Im1 Do Q";
  }
  const stream = text.join("\n") + drawImage + "\n";
  const streamBytes = new TextEncoder().encode(stream);
  const resources = jpeg && jpeg.bytes ? "/Resources << /Font << /F1 5 0 R >> /XObject << /Im1 6 0 R >> >>" : "/Resources << /Font << /F1 5 0 R >> >>";
  addObj("1", "<< /Type /Catalog /Pages 2 0 R >>");
  addObj("2", "<< /Type /Pages /Count 1 /Kids [3 0 R] >>");
  addObj("3", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R " + resources + " >>");
  addObj("4", "<< /Length " + streamBytes.length + " >>\nstream\n" + stream + "endstream");
  addObj("5", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let count = 6;
  if (jpeg && jpeg.bytes) {
    const header =
      "<< /Type /XObject /Subtype /Image /Width " +
      jpeg.width +
      " /Height " +
      jpeg.height +
      " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
      jpeg.bytes.length +
      " >>\nstream\n";
    let size = 0;
    for (const c of chunks) size += c.length;
    offsets[6] = size;
    pushStr("6 0 obj\n" + header);
    pushBytes(jpeg.bytes);
    pushStr("\nendstream\nendobj\n");
    count = 7;
  }
  let size = 0;
  for (const c of chunks) size += c.length;
  const xrefAt = size;
  let xref = "xref\n0 " + count + "\n0000000000 65535 f \n";
  for (let i = 1; i < count; i++) xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  xref += "trailer\n<< /Size " + count + " /Root 1 0 R >>\nstartxref\n" + xrefAt + "\n%%EOF\n";
  pushStr(xref);
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

export const ESTIMATE_NOTE = "USGS 3DEP estimate. Verify with survey.";

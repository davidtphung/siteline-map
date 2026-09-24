/** Place Site Brief and the Wells card so their boxes never overlap. */

export function boxesIntersect(a, b) {
  if (!a || !b || a.w <= 0 || b.w <= 0 || a.h <= 0 || b.h <= 0) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function openCard(state, id) {
  const open = { ...(state.open || {}), [id]: true };
  return { ...state, open };
}

function dockBox(width, height) {
  if (width <= 768) return { x: 0, y: height - 132, w: width, h: 132 };
  return { x: 16, y: height - 108, w: Math.min(420, width - 32), h: 96 };
}

function zoomBox(width) {
  return { x: width - 52, y: width <= 768 ? 180 : 16, w: 40, h: 148 };
}

function switchBox(width, height, dock) {
  if (width <= 768) return { x: 8, y: dock.y + 8, w: width - 16, h: 44 };
  return { x: dock.x + 4, y: dock.y + 4, w: dock.w - 8, h: 36 };
}

export function cardRects(state, viewport) {
  const width = viewport.width;
  const height = viewport.height;
  const phone = width <= 768;
  const dock = dockBox(width, height);
  const zoom = zoomBox(width);
  const modeSwitch = switchBox(width, height, dock);
  const open = state.open || {};
  const rects = {};
  if (phone) {
    const ids = ["brief", "wells"].filter((id) => open[id]);
    const gap = 8;
    let y = zoom.y + zoom.h + 8;
    const available = Math.max(80, dock.y - y - 8);
    const each = Math.floor((available - gap * Math.max(0, ids.length - 1)) / Math.max(ids.length, 1));
    for (const id of ids) {
      rects[id] = { x: 8, y, w: width - 16, h: Math.min(each, available) };
      y += rects[id].h + gap;
    }
  } else {
    if (open.brief) rects.brief = { x: 16, y: 64, w: 320, h: Math.min(480, height - 180) };
    if (open.wells) {
      const w = 340;
      const h = 260;
      let x = Math.min(width - w - 72, Math.max(360, (width - w) / 2));
      let y = dock.y - h - 12;
      rects.wells = { x, y, w, h };
      if (rects.brief && boxesIntersect(rects.brief, rects.wells)) {
        x = rects.brief.x + rects.brief.w + 16;
        y = Math.max(64, dock.y - h - 12);
        rects.wells = { x, y, w, h };
      }
    }
  }
  return { rects, dock, zoom, modeSwitch, phone };
}

export function layoutConflicts(state, viewport) {
  const placed = cardRects(state, viewport);
  const obstacles = [placed.dock, placed.zoom, placed.modeSwitch];
  const cards = Object.values(placed.rects);
  const hits = [];
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (boxesIntersect(cards[i], cards[j])) hits.push(["cards", i, j]);
    }
    for (const obstacle of obstacles) {
      if (boxesIntersect(cards[i], obstacle)) hits.push(["obstacle"]);
    }
  }
  return { placed, hits };
}

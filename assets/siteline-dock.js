/**
 * Atlas-style dock: a slim pill under a card that opens on demand.
 * Collapsed on first visit. Last open state is kept in localStorage.
 */
import { JUMP_PLACES, renderJumpList } from "./jump-places.mjs";
import { DOCK_TABS, cycleFeature, dockTabMove, escapeInField, featureSummary, hitBox, isInteractiveFeature, isTypingTarget, keyboardResizeKeepsSheet, moreHereLine, normalizeMode, shouldCloseFromPointer, shouldCloseOnMapTap, shouldMoveDockTab, shouldSwipeClose } from "./dock-mode.mjs";

const STORE = "siteline.dock.v1";
const TAB_META = {
  layers: { label: "Layers", icon: "layers" },
  jump: { label: "Jump", icon: "jump" },
  inspect: { label: "Inspect", icon: "inspect" },
  wells: { label: "Wells", icon: "wells" },
  about: { label: "About", icon: "about" },
};
const TABS = DOCK_TABS.map((tab) => ({ ...tab, ...TAB_META[tab.id] }));

const ICONS = {
  layers:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4.5 8 2l6 2.5L8 7 2 4.5Z"/><path d="M2 8 8 10.5 14 8"/><path d="M2 11.5 8 14l6-2.5"/></svg>',
  jump:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3"/></svg>',
  inspect:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8c2.4 0 4.2 1.9 4.2 4.3 0 3.2-4.2 8.1-4.2 8.1S3.8 9.3 3.8 6.1C3.8 3.7 5.6 1.8 8 1.8Z"/><circle cx="8" cy="6.1" r="1.4"/></svg>',
  about:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 7.2V11.4M8 4.8h.01"/></svg>',
  wells:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6c2.6 3 4.2 5 4.2 7.2a4.2 4.2 0 1 1-8.4 0C3.8 6.6 5.4 4.6 8 1.6Z"/></svg>',
};

let applying = false;
let typingInside = false;
let gestureFromCard = false;

function readStore() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return data;
  } catch {
    return null;
  }
}

function writeStore(open, tab, mode) {
  try {
    localStorage.setItem(
      STORE,
      JSON.stringify({
        open: !!open,
        tab: tab || "layers",
        mode: normalizeMode(mode),
      }),
    );
  } catch {
    /* private mode */
  }
}

function modeOf(tray) {
  return normalizeMode(tray?.dataset.dockView);
}

function injectCss() {
  let style = document.getElementById("sl-dock-css");
  if (!style) {
    style = document.createElement("style");
    style.id = "sl-dock-css";
  }
  if (style.textContent !== DOCK_CSS) style.textContent = DOCK_CSS;
  if (!style.isConnected) document.head.appendChild(style);
}

function icon(name) {
  return '<span class="sl-dock-ico">' + (ICONS[name] || "") + "</span>";
}

function ensureStructure(tray) {
  if (tray.dataset.slDock === "1" && document.getElementById("sl-dock-bar")) return;
  tray.classList.add("sl-dock");
  tray.dataset.slDock = "1";

  let card = document.getElementById("sl-dock-card");
  if (!card) {
    card = document.createElement("div");
    card.id = "sl-dock-card";
    card.className = "sl-dock-card";
    card.setAttribute("role", "region");
    card.setAttribute("aria-label", "Siteline panel");
  }
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "sl-dock-handle";
  handle.id = "sl-dock-handle";
  handle.setAttribute("aria-label", "Drag down to collapse");
  card.prepend(handle);

  const stage = tray.querySelector(".sl-tray-stage") || document.createElement("div");
  stage.classList.add("sl-tray-stage");
  if (!card.contains(stage)) card.appendChild(stage);

  let jump = document.getElementById("sl-pane-jump");
  if (!jump) {
    jump = document.createElement("div");
    jump.id = "sl-pane-jump";
    jump.className = "sl-tray-pane";
    jump.dataset.pane = "jump";
    jump.setAttribute("role", "tabpanel");
    jump.setAttribute("aria-labelledby", "sl-dock-tab-jump");
    jump.hidden = true;
    stage.appendChild(jump);
  }
  renderJumpList(jump);
  const stray = tray.querySelectorAll(".sl-jump-row, .sl-jump-host");
  if (stray.length) stray.forEach((node) => node.remove());

  let wells = document.getElementById("sl-pane-wells");
  if (!wells) {
    wells = document.createElement("div");
    wells.id = "sl-pane-wells";
    wells.className = "sl-tray-pane";
    wells.dataset.pane = "wells";
    wells.setAttribute("role", "tabpanel");
    wells.setAttribute("aria-labelledby", "sl-dock-tab-wells");
    wells.hidden = true;
    stage.appendChild(wells);
  }

  let bar = document.getElementById("sl-dock-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "sl-dock-bar";
    bar.className = "sl-dock-bar";
    bar.setAttribute("role", "tablist");
    bar.setAttribute("aria-label", "Siteline");
    bar.innerHTML =
      '<div class="sl-mode-toggle" role="group" aria-label="Map mode">' +
      '<button type="button" data-dock-mode="browse" aria-pressed="true">Browse</button>' +
      '<button type="button" data-dock-mode="inspect" aria-pressed="false">Inspect</button>' +
      '</div><div class="sl-dock-tabs" role="tablist" aria-label="Siteline">' +
      TABS.map((tab) => {
      const badge = tab.badge ? '<span class="sl-dock-badge" id="sl-dock-wells-badge" hidden>0</span>' : "";
      return (
        '<button type="button" class="sl-dock-tab" role="tab" id="sl-dock-tab-' +
        tab.id +
        '" data-dock-tab="' +
        tab.id +
        '" aria-controls="' +
        tab.pane +
        '" aria-selected="false" aria-expanded="false">' +
        icon(tab.icon) +
        "<span>" +
        tab.label +
        "</span>" +
        badge +
        "</button>"
      );
    }).join("") +
      '<button type="button" class="sl-dock-chevron" id="sl-dock-chevron" aria-controls="sl-dock-card" aria-expanded="false" aria-label="Show panel">' +
      '<span class="sl-dock-chev" aria-hidden="true"></span></button></div>';
  }

  if (tray.firstChild !== card) tray.prepend(card);
  if (bar.parentElement !== tray) tray.appendChild(bar);

  for (const tab of TABS) {
    const pane = document.getElementById(tab.pane);
    if (!pane) continue;
    pane.setAttribute("role", "tabpanel");
    pane.setAttribute("aria-labelledby", "sl-dock-tab-" + tab.id);
  }
}

function legacyTab(id) {
  if (id !== "layers" && id !== "inspect" && id !== "about") return;
  const btn = document.getElementById("sl-tab-" + id);
  if (!btn) return;
  applying = true;
  btn.click();
  applying = false;
}

function isOpen(tray) {
  return tray.dataset.dock === "open";
}

function apply(tray, open, tab, persist) {
  const next = TABS.some((item) => item.id === tab) ? tab : "layers";
  const was = tray.dataset.dockTab;
  tray.dataset.dock = open ? "open" : "closed";
  tray.dataset.dockTab = next;
  tray.dataset.sheet = open ? "half" : "peek";
  cardVisibility(tray, open);
  for (const item of TABS) {
    const pane = document.getElementById(item.pane);
    const btn = document.getElementById("sl-dock-tab-" + item.id);
    const on = open && item.id === next;
    if (pane) pane.hidden = !open || item.id !== next;
    if (btn) {
      btn.classList.toggle("is-on", item.id === next && open);
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.setAttribute("aria-expanded", on ? "true" : "false");
      btn.tabIndex = item.id === next ? 0 : -1;
    }
  }
  const chevron = document.getElementById("sl-dock-chevron");
  if (chevron) {
    chevron.setAttribute("aria-expanded", open ? "true" : "false");
    chevron.setAttribute("aria-label", open ? "Hide panel" : "Show panel");
  }
  if (open && next !== was) legacyTab(next);
  else if (open && (next === "layers" || next === "inspect" || next === "about") && tray.dataset.tab !== next) {
    legacyTab(next);
  }
  if (persist !== false) writeStore(open, next, modeOf(tray));
  if (open && next !== was) tray.querySelector(".sl-dock-card")?.scrollTo?.(0, 0);
}

function cardVisibility(tray, open) {
  const card = document.getElementById("sl-dock-card");
  if (!card) return;
  if (open) {
    card.hidden = false;
    card.setAttribute("aria-hidden", "false");
  } else {
    card.setAttribute("aria-hidden", "true");
  }
}

function openDock(tab) {
  const tray = document.getElementById("sl-tray");
  if (!tray) return;
  ensureStructure(tray);
  apply(tray, true, tab || tray.dataset.dockTab || "layers");
}

function closeDock() {
  const tray = document.getElementById("sl-tray");
  if (!tray || !isOpen(tray)) return;
  apply(tray, false, tray.dataset.dockTab || "layers");
}

function toggleTab(tab) {
  const tray = document.getElementById("sl-tray");
  if (!tray) return;
  ensureStructure(tray);
  if (isOpen(tray) && tray.dataset.dockTab === tab) closeDock();
  else openDock(tab);
}

function parkWells(tray) {
  const card = document.getElementById("sl-well-card");
  const inspect = document.getElementById("sl-pane-inspect");
  const wells = document.getElementById("sl-pane-wells");
  const dest = modeOf(tray) === "inspect" && isOpen(tray) ? inspect : wells;
  if (!card || !dest || dest.contains(card)) return;
  dest.appendChild(card);
}

function dismissBrief() {
  const hide = document.querySelector(".brief-panel .sheet-close");
  if (hide) hide.click();
}

function setMode(mode) {
  const tray = document.getElementById("sl-tray");
  if (!tray) return;
  const next = normalizeMode(mode);
  const prev = modeOf(tray);
  tray.dataset.dockView = next;
  tray.querySelectorAll("[data-dock-mode]").forEach((btn) => {
    const on = btn.getAttribute("data-dock-mode") === next;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.classList.toggle("is-on", on);
  });
  writeStore(isOpen(tray), tray.dataset.dockTab || "layers", next);
  if (prev === "inspect" && next === "browse") {
    dismissBrief();
    if (isOpen(tray) && tray.dataset.dockTab === "inspect") closeDock();
  }
  parkWells(tray);
}

function parkBrief() {
  const pane = document.getElementById("sl-pane-inspect");
  const panel = document.querySelector(".brief-panel");
  if (!pane || !panel) return;
  if (panel.parentElement !== pane) pane.prepend(panel);
  const open = panel.classList.contains("open");
  if (modeOf(document.getElementById("sl-tray")) !== "inspect") {
    if (open) dismissBrief();
    return;
  }
  if (open && panel.dataset.slDockOpen !== "1") {
    panel.dataset.slDockOpen = "1";
    openDock("inspect");
  }
  if (open) openDock("inspect");
  if (!open) panel.dataset.slDockOpen = "0";
}

function syncWellBadge() {
  const badge = document.getElementById("sl-dock-wells-badge");
  const title = document.getElementById("sl-well-title");
  if (!badge) return;
  const match = (title?.textContent || "").match(/(\d+)/);
  if (!match) {
    badge.hidden = true;
    return;
  }
  badge.hidden = false;
  badge.textContent = match[1];
}

function onTrayMutation(tray) {
  if (applying) return;
  if (tray.dataset.tab === "inspect" && tray.dataset.slDockFollow !== "inspect") {
    tray.dataset.slDockFollow = "inspect";
    if (!isOpen(tray) || tray.dataset.dockTab !== "inspect") openDock("inspect");
  }
  if (tray.dataset.tab !== "inspect") tray.dataset.slDockFollow = tray.dataset.tab || "";
}

function wire(tray) {
  if (tray.dataset.slDockWired === "1") return;
  tray.dataset.slDockWired = "1";
  const card = document.getElementById("sl-dock-card");
  if (card && card.dataset.slStop !== "1") {
    card.dataset.slStop = "1";
    const stop = (event) => event.stopPropagation();
    card.addEventListener("click", stop);
    card.addEventListener("pointerdown", stop);
    card.addEventListener("pointerup", stop);
    card.addEventListener("touchstart", stop);
    card.addEventListener("touchend", stop);
    card.addEventListener("focusin", stop);
  }
  tray.addEventListener("click", (event) => {
    const modeBtn = event.target.closest?.("button[data-dock-mode]");
    if (modeBtn && tray.contains(modeBtn)) {
      event.preventDefault();
      setMode(modeBtn.getAttribute("data-dock-mode"));
      return;
    }
    const tab = event.target.closest?.(".sl-dock-tab");
    if (tab && tray.contains(tab)) {
      event.preventDefault();
      toggleTab(tab.getAttribute("data-dock-tab"));
      return;
    }
    if (event.target.closest?.("#sl-dock-chevron")) {
      event.preventDefault();
      if (isOpen(tray)) closeDock();
      else openDock(tray.dataset.dockTab || "layers");
    }
  });
  tray.addEventListener("keydown", (event) => {
    if (!shouldMoveDockTab(event.target)) return;
    const tabs = [...tray.querySelectorAll(".sl-dock-tab")];
    const current = document.activeElement;
    const index = tabs.indexOf(current);
    if (index < 0) return;
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") return;
    const next = dockTabMove(index, event.key, tabs.length);
    event.preventDefault();
    tabs[next].focus();
    openDock(tabs[next].getAttribute("data-dock-tab"));
  });

  const handle = document.getElementById("sl-dock-handle");
  if (handle && handle.dataset.swipe !== "1") {
    handle.dataset.swipe = "1";
    handle.addEventListener("pointerdown", (event) => {
      if (event.button != null && event.button !== 0) return;
      handle.setPointerCapture?.(event.pointerId);
      const startY = event.clientY || 0;
      let dy = 0;
      const move = (ev) => {
        dy = (ev.clientY || 0) - startY;
        if (dy > 0) tray.style.setProperty("--sl-dock-drag", Math.min(dy, 180) + "px");
      };
      const up = () => {
        tray.style.removeProperty("--sl-dock-drag");
        if (shouldSwipeClose({ dy, typing: typingInside, fromHandle: true })) closeDock();
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    });
  }
}

function wireGlobal() {
  if (window.__slDockGlobal) return;
  window.__slDockGlobal = true;
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (isTypingTarget(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      const field = event.target;
      const next = escapeInField({ value: field.value, focused: true });
      if (next.action === "clear") {
        field.value = "";
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.focus();
        field.setSelectionRange?.(0, 0);
      } else field.blur();
      return;
    }
    const tray = document.getElementById("sl-tray");
    if (!tray || !isOpen(tray)) return;
    event.preventDefault();
    closeDock();
  });
  const markTyping = (event) => {
    const tray = document.getElementById("sl-tray");
    if (!tray) return;
    const node = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    if (!node || !tray.contains(node)) return;
    if (event.type === "focusin" || event.type === "pointerdown" || event.type === "touchstart") {
      gestureFromCard = true;
      if (isTypingTarget(node)) {
        typingInside = true;
        tray.classList.add("sl-dock-typing");
        const card = document.getElementById("sl-dock-card");
        if (card && keyboardResizeKeepsSheet(isOpen(tray))) {
          tray.style.setProperty("--sl-dock-card-lock", Math.max(card.clientHeight, 120) + "px");
        }
      }
    }
  };
  document.addEventListener("focusin", markTyping);
  document.addEventListener("pointerdown", markTyping, true);
  document.addEventListener("touchstart", markTyping, true);
  document.addEventListener("focusout", (event) => {
    const tray = document.getElementById("sl-tray");
    const next = event.relatedTarget;
    if (next && tray?.contains(next) && isTypingTarget(next)) return;
    requestAnimationFrame(() => {
      if (isTypingTarget(document.activeElement) && tray?.contains(document.activeElement)) return;
      typingInside = false;
      gestureFromCard = false;
      tray?.classList.remove("sl-dock-typing");
    });
  });
  const holdSheet = () => {
    if (!typingInside) return;
    const tray = document.getElementById("sl-tray");
    if (tray && keyboardResizeKeepsSheet(isOpen(tray))) tray.style.removeProperty("--sl-dock-drag");
  };
  window.addEventListener("resize", holdSheet);
  window.visualViewport?.addEventListener("resize", holdSheet);
  const insideDock = (event) => {
    const tray = document.getElementById("sl-tray");
    if (!tray) return false;
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (path.includes(tray)) return true;
    const node = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    return !!(node && tray.contains(node));
  };
  const onPointer = (event) => {
    const tray = document.getElementById("sl-tray");
    if (!tray || !isOpen(tray)) return;
    const node = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    const onEmptyMap = !!(node && node.closest?.(".maplibregl-canvas, .maplibregl-map"));
    const fromCard = gestureFromCard || insideDock(event);
    if (!shouldCloseFromPointer({ insideCard: insideDock(event), fromCard, typing: typingInside })) return;
    if (!shouldCloseOnMapTap({ mode: modeOf(tray), insideDock: fromCard, onEmptyMap })) return;
    closeDock();
  };
  document.addEventListener("click", onPointer);
  document.addEventListener("touchend", onPointer);
}

function ensureInspectClose() {
  const pane = document.getElementById("sl-pane-inspect");
  if (!pane || document.getElementById("sl-inspect-dock-close")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "sl-inspect-dock-close";
  btn.className = "sl-inspect-dock-close";
  btn.textContent = "Close";
  btn.addEventListener("click", () => {
    dismissBrief();
    closeDock();
  });
  pane.appendChild(btn);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
}

let featurePopup = null;
let featureHits = [];
let featureIndex = 0;

function queryHits(map, point, touch) {
  if (!map?.queryRenderedFeatures || !point) return [];
  try {
    const hits = (map.queryRenderedFeatures(hitBox(point, touch)) || []).filter(isInteractiveFeature);
    const points = [];
    const lines = [];
    for (const feature of hits) {
      if (feature.layer?.type === "line") lines.push(feature);
      else points.push(feature);
    }
    points.sort((a, b) => distance2(map, point, a) - distance2(map, point, b));
    return [...points, ...lines];
  } catch (_) {
    return [];
  }
}

function distance2(map, point, feature) {
  if (feature?.geometry?.type !== "Point" || !map.project) return 1e9;
  const projected = map.project(feature.geometry.coordinates);
  const dx = (projected?.x || 0) - (point.x || 0);
  const dy = (projected?.y || 0) - (point.y || 0);
  return dx * dx + dy * dy;
}

function popupHtml(feature, total, index) {
  const card = featureSummary(feature);
  const rows = card.fields
    .map((row) => "<p>" + esc(row[0]) + ": " + esc(row[1]) + "</p>")
    .join("");
  const sample = card.sample ? "<p>Sample data</p>" : "";
  const more = moreHereLine(total - 1);
  const cycle = more
    ? "<button type=\"button\" class=\"sl-feature-more\" data-sl-more=\"1\">" + esc(more) + "</button>"
    : "";
  return (
    "<div class=\"sl-feature-card\" data-feature-index=\"" + index + "\">" +
    "<p class=\"sl-feature-name\">" + esc(card.name) + "</p>" +
    "<p>Layer: " + esc(card.layer) + "</p>" +
    rows +
    "<p>Source: " + esc(card.source) + "</p>" +
    "<p>Vintage: " + esc(card.vintage) + "</p>" +
    sample +
    cycle +
    "</div>"
  );
}

function popupAnchor(map, point) {
  const height = map.getCanvas?.()?.clientHeight || 0;
  const width = map.getCanvas?.()?.clientWidth || 0;
  if (!point) return "top";
  if (point.y < 180) return "top";
  if (height && point.y > height - 240) return "bottom";
  if (width && point.x < 90) return "left";
  if (width && point.x > width - 90) return "right";
  return "bottom";
}

function closeFeaturePopup() {
  featurePopup?.remove?.();
  featurePopup = null;
  featureHits = [];
  featureIndex = 0;
}

function showFeaturePopup(map, lngLat, point, hits, index) {
  if (!window.maplibregl?.Popup || !hits.length) return;
  const feature = hits[index] || hits[0];
  const at = feature?.geometry?.type === "Point" && feature.geometry.coordinates
    ? { lng: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1] }
    : lngLat;
  closeFeaturePopup();
  featureHits = hits;
  featureIndex = index;
  featurePopup = new window.maplibregl.Popup({
    closeButton: true,
    closeOnClick: false,
    maxWidth: "min(280px, calc(100vw - 24px))",
    anchor: popupAnchor(map, point),
    offset: 12,
    className: "sl-feature-popup",
  })
    .setLngLat(at)
    .setHTML(popupHtml(feature, hits.length, index))
    .addTo(map);
  featurePopup.getElement?.()?.querySelector("[data-sl-more]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const next = cycleFeature({ index: featureIndex, total: featureHits.length });
    showFeaturePopup(map, lngLat, point, featureHits, next.index);
  });
}

function renderInspectFeature(hits) {
  const pane = document.getElementById("sl-pane-inspect");
  if (!pane) return;
  let box = document.getElementById("sl-inspect-feature");
  if (!hits.length) {
    box?.remove();
    return;
  }
  if (!box) {
    box = document.createElement("div");
    box.id = "sl-inspect-feature";
    pane.prepend(box);
  }
  const feature = hits[0];
  const card = featureSummary(feature);
  const extra = moreHereLine(hits.length - 1);
  box.innerHTML =
    "<p class=\"sl-feature-name\">" + esc(card.name) + "</p>" +
    "<p>Layer: " + esc(card.layer) + "</p>" +
    card.fields.map((row) => "<p>" + esc(row[0]) + ": " + esc(row[1]) + "</p>").join("") +
    "<p>Source: " + esc(card.source) + "</p>" +
    "<p>Vintage: " + esc(card.vintage) + "</p>" +
    (card.sample ? "<p>Sample data</p>" : "") +
    (extra ? "<p>" + esc(extra) + "</p>" : "");
}

function guardMapClicks() {
  const map = window.__SITELINE_MAP__;
  if (!map || map.__slModeGuard || typeof map.fire !== "function") return;
  map.__slModeGuard = true;
  const fire = map.fire.bind(map);
  map.fire = (type, data) => {
    const name = typeof type === "string" ? type : type && type.type;
    if (name === "click") {
      const touch = data?.originalEvent?.pointerType === "touch" || data?.originalEvent?.type === "touchend";
      const hits = queryHits(map, data?.point, touch);
      const mode = modeOf(document.getElementById("sl-tray"));
      if (mode === "browse") {
        if (hits.length && data?.lngLat) showFeaturePopup(map, data.lngLat, data.point, hits, 0);
        else closeFeaturePopup();
        return map;
      }
      if (mode === "inspect") renderInspectFeature(hits);
    }
    if (name === "mousemove" && data?.point) {
      const canvas = map.getCanvas?.();
      if (canvas) canvas.style.cursor = queryHits(map, data.point, false).length ? "pointer" : "";
      if (!data.originalEvent) return map;
    }
    return fire(type, data);
  };
  if (map.__slCursor !== "1") {
    map.__slCursor = "1";
    map.on("mousemove", (event) => {
      const canvas = map.getCanvas?.();
      if (!canvas) return;
      const hits = queryHits(map, event?.point, false);
      canvas.style.cursor = hits.length ? "pointer" : "";
    });
  }
}

function boot() {
  injectCss();
  const tray = document.getElementById("sl-tray");
  if (!tray || !tray.querySelector("#sl-pane-layers")) return false;
  ensureStructure(tray);
  wire(tray);
  wireGlobal();
  parkWells(tray);
  parkBrief();
  syncWellBadge();
  const jumpPane = document.getElementById("sl-pane-jump");
  if (jumpPane) {
    renderJumpList(jumpPane);
    if (jumpPane.dataset.slJumpWired !== "1") {
      jumpPane.dataset.slJumpWired = "1";
      jumpPane.addEventListener("click", (event) => {
        const btn = event.target.closest?.("[data-jump]");
        if (!btn || !jumpPane.contains(btn)) return;
        const place = JUMP_PLACES.find((item) => item.id === btn.dataset.jump);
        const map = window.__SITELINE_MAP__;
        if (!place || !map?.flyTo) return;
        map.flyTo({ center: place.center, zoom: place.zoom, essential: true, duration: 1200 });
      });
    }
  }
  const stray = tray.querySelectorAll(".sl-jump-row, .sl-jump-host");
  if (stray.length) stray.forEach((node) => node.remove());
  if (tray.dataset.slDockReady !== "1") {
    tray.dataset.slDockReady = "1";
    const saved = readStore();
    const open = saved ? !!saved.open : false;
    const tab = saved && saved.tab ? saved.tab : "layers";
    tray.dataset.dockView = normalizeMode(saved && saved.mode);
    tray.querySelectorAll("[data-dock-mode]").forEach((btn) => {
      const on = btn.getAttribute("data-dock-mode") === tray.dataset.dockView;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.classList.toggle("is-on", on);
    });
    apply(tray, open, tab, false);
    ensureInspectClose();
  }
  guardMapClicks();
  ensureInspectClose();
  return true;
}

const DOCK_CSS = `
#sl-tray.sl-dock {
  position: fixed !important;
  left: 16px !important;
  right: auto !important;
  top: auto !important;
  bottom: 36px !important;
  width: min(420px, calc(100vw - 32px)) !important;
  max-height: none !important;
  height: auto !important;
  padding: 0 !important;
  margin: 0 !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: stretch !important;
  z-index: 45 !important;
  transform: translateY(var(--sl-dock-drag, 0px)) !important;
  pointer-events: none !important;
  overflow: visible !important;
}
#sl-tray.sl-dock[data-sheet="peek"],
#sl-tray.sl-dock[data-sheet="half"],
#sl-tray.sl-dock[data-sheet="full"] {
  max-height: none !important;
  height: auto !important;
}
#sl-tray.sl-dock .sl-tray-grab,
#sl-tray.sl-dock .sl-tray-chrome,
.sl-layers-chip { display: none !important; }
#sl-tray.sl-dock .sl-dock-card,
#sl-tray.sl-dock .sl-dock-bar { pointer-events: auto; }
#sl-tray.sl-dock .sl-dock-card {
  display: flex;
  flex-direction: column;
  max-height: 60vh;
  margin: 0 0 8px;
  overflow: auto;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(5, 6, 8, 0.96);
  box-shadow: 0 12px 32px rgba(0,0,0,0.45);
  color: #e7e5e4;
  font-family: Inter, system-ui, sans-serif;
  transform-origin: center bottom;
  transition: opacity 180ms ease, transform 180ms ease, max-height 180ms ease, margin 180ms ease;
}
.sl-feature-popup.maplibregl-popup { z-index: 50; max-width: min(280px, calc(100vw - 24px)); }
.sl-feature-popup .maplibregl-popup-content {
  max-height: min(42vh, 280px);
  overflow: auto;
  background: rgba(5, 6, 8, 0.96);
  color: #e7e5e4;
  border-radius: 12px;
  font: 500 12px/1.35 Inter, system-ui, sans-serif;
}
.sl-feature-popup .sl-feature-name { margin: 0 0 4px; font-size: 13px; color: #fff; }
.sl-feature-popup p { margin: 0 0 3px; }
.sl-feature-popup .sl-feature-more {
  appearance: none;
  margin-top: 6px;
  min-height: 32px;
  border: 0;
  background: transparent;
  color: #fff;
  font: 500 12px/1 Inter, system-ui, sans-serif;
  cursor: pointer;
}
#sl-inspect-feature {
  margin: 0 0 8px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.12);
}
#sl-inspect-feature p { margin: 0 0 3px; font-size: 12px; }
@media (max-width: 700px) {
  .sl-feature-popup .sl-feature-more { min-height: 44px; }
}
#sl-tray.sl-dock.sl-dock-typing .sl-dock-card {
  max-height: var(--sl-dock-card-lock, 60vh) !important;
  opacity: 1 !important;
  overflow: auto !important;
  pointer-events: auto !important;
}
#sl-tray.sl-dock[data-dock="closed"] .sl-dock-card {
  max-height: 0 !important;
  margin-bottom: 0;
  opacity: 0;
  overflow: hidden;
  transform: translateY(8px);
  pointer-events: none;
  border-color: transparent;
}
#sl-tray.sl-dock .sl-dock-handle {
  display: none !important;
  appearance: none;
  width: 100%;
  min-height: 22px;
  margin: 0;
  padding: 8px 0 4px;
  border: 0;
  background: transparent;
  cursor: grab;
}
#sl-tray.sl-dock .sl-dock-handle::before {
  content: "";
  display: block;
  width: 36px;
  height: 4px;
  margin: 0 auto;
  border-radius: 999px;
  background: rgba(255,255,255,0.28);
}
#sl-tray.sl-dock .sl-tray-stage { display: block !important; padding: 4px 12px 12px; }
#sl-pane-jump .sl-jump-list { display: flex; flex-direction: column; gap: 4px; }
#sl-pane-jump .sl-jump-place {
  appearance: none;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 2px;
  width: 100%;
  min-height: 44px;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  background: transparent;
  color: #fff;
  text-align: left;
  text-transform: none;
  letter-spacing: 0;
  font-family: Inter, system-ui, sans-serif;
  cursor: pointer;
}
#sl-pane-jump .sl-jump-place:hover,
#sl-pane-jump .sl-jump-place:focus-visible { background: rgba(255,255,255,0.06); }
#sl-pane-jump .sl-jump-name { font-size: 13px; font-weight: 500; }
#sl-pane-jump .sl-jump-detail {
  color: rgba(255,255,255,0.55);
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 11px;
  font-weight: 500;
}
#sl-tray.sl-dock[data-sheet="peek"] .sl-tray-stage { display: block !important; }
#sl-tray.sl-dock .sl-dock-bar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  width: 100%;
  min-height: 44px;
  padding: 4px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(5, 6, 8, 0.96);
  box-shadow: 0 10px 28px rgba(0,0,0,0.45);
}
#sl-tray.sl-dock .sl-dock-tabs { display: flex; align-items: center; gap: 2px; width: 100%; }
#sl-tray.sl-dock .sl-mode-toggle { display: flex; gap: 4px; }
#sl-tray.sl-dock .sl-mode-toggle button {
  appearance: none;
  flex: 1;
  min-height: 32px;
  margin: 0;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.12);
  background: transparent;
  color: rgba(255,255,255,0.78);
  font: 500 12px/1 Inter, system-ui, sans-serif;
  cursor: pointer;
}
#sl-tray.sl-dock .sl-mode-toggle button.is-on { background: rgba(255,255,255,0.1); color: #fff; }
#sl-tray.sl-dock .sl-inspect-dock-close {
  appearance: none;
  min-height: 36px;
  margin: 0 0 8px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.14);
  background: transparent;
  color: #fff;
  font: 500 12px/1 Inter, system-ui, sans-serif;
  cursor: pointer;
}
#sl-layer-info {
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.12);
}
#sl-layer-info h3 { margin: 0 0 4px; font: 500 13px/1.3 Inter, system-ui, sans-serif; }
#sl-layer-info p { margin: 0 0 4px; color: rgba(255,255,255,0.72); font-size: 12px; }
#sl-layer-info .sl-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 6px; }
#sl-layer-info .sl-info-grid div {
  padding: 6px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.08);
  font: 500 11px/1.3 "JetBrains Mono", ui-monospace, monospace;
}
#sl-tray.sl-dock .sl-dock-tab,
#sl-tray.sl-dock .sl-dock-chevron {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 36px;
  margin: 0;
  padding: 0 8px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: rgba(255,255,255,0.78);
  font-family: Inter, system-ui, sans-serif;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  cursor: pointer;
  white-space: nowrap;
}
#sl-tray.sl-dock .sl-dock-tab.is-on {
  background: rgba(255,255,255,0.08);
  color: #fff;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14);
}
#sl-tray.sl-dock .sl-dock-tab:focus-visible,
#sl-tray.sl-dock .sl-dock-chevron:focus-visible {
  outline: 2px solid rgba(255,255,255,0.7);
  outline-offset: 1px;
}
#sl-tray.sl-dock .sl-dock-ico { display: inline-flex; width: 14px; height: 14px; }
#sl-tray.sl-dock .sl-dock-ico svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
#sl-tray.sl-dock .sl-dock-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: rgba(255,255,255,0.12);
  color: #fff;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 10px;
  font-weight: 500;
}
#sl-tray.sl-dock .sl-dock-chevron { margin-left: auto; min-width: 32px; padding: 0 8px; }
#sl-tray.sl-dock .sl-dock-chev {
  width: 7px;
  height: 7px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(-135deg);
  margin-top: 3px;
}
#sl-tray.sl-dock[data-dock="open"] .sl-dock-chev { transform: rotate(45deg); margin-top: -3px; }
#sl-pane-wells #sl-well-card {
  position: static !important;
  top: auto !important;
  right: auto !important;
  width: 100% !important;
  max-height: none !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
#sl-tray.sl-dock[data-dock-tab="wells"] #sl-well-card .sl-well-body { display: block !important; }
#sl-dock-card .brief-panel,
#sl-dock-card .brief-panel.open {
  position: static !important;
  inset: auto !important;
  width: 100% !important;
  max-height: none !important;
  transform: none !important;
  opacity: 1 !important;
  pointer-events: auto !important;
  box-shadow: none !important;
  border: 0 !important;
  background: transparent !important;
  margin: 0 0 8px;
}
#sl-tray.sl-dock[data-dock="open"][data-dock-tab="inspect"] .brief-panel .brief-body,
#sl-tray.sl-dock[data-dock="open"][data-dock-tab="inspect"] .brief-panel .loading,
#sl-tray.sl-dock[data-dock="open"][data-dock-tab="inspect"] .brief-panel .unknown-list,
#sl-tray.sl-dock[data-dock="open"][data-dock-tab="inspect"] .brief-panel .error-list {
  display: block !important;
}
#sl-tray.sl-dock[data-dock="open"][data-dock-tab="inspect"] .brief-panel.open {
  max-height: none !important;
  overflow: visible !important;
}
@media (max-width: 700px) {
  #sl-tray.sl-dock {
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    padding: 0 0 env(safe-area-inset-bottom) !important;
  }
  #sl-tray.sl-dock .sl-dock-card {
    max-height: min(60vh, calc(100dvh - 168px));
    margin: 0 8px 8px;
    border-radius: 18px 18px 14px 14px;
  }
  #sl-tray.sl-dock .sl-dock-handle { display: block !important; min-height: 28px; }
  #sl-tray.sl-dock .sl-dock-bar {
    width: auto;
    margin: 0 8px calc(44px + env(safe-area-inset-bottom));
    border-radius: 16px;
  }
  #sl-tray.sl-dock .sl-mode-toggle button,
  #sl-tray.sl-dock .sl-inspect-dock-close { min-height: 44px; }
  #sl-tray.sl-dock .sl-dock-tab,
  #sl-tray.sl-dock .sl-dock-chevron {
    min-height: 44px;
    min-width: 44px;
    padding: 0 6px;
    font-size: 11px;
  }
}
@media (prefers-reduced-motion: reduce) {
  #sl-tray.sl-dock .sl-dock-card { transition: none !important; }
}
`;

const obs = new MutationObserver(() => {
  const tray = document.getElementById("sl-tray");
  boot();
  if (tray) onTrayMutation(tray);
  syncWellBadge();
});
obs.observe(document.body, { childList: true, subtree: true });
const watchTray = () => {
  const tray = document.getElementById("sl-tray");
  if (!tray || tray.dataset.slDockWatch === "1") return;
  tray.dataset.slDockWatch = "1";
  new MutationObserver(() => onTrayMutation(tray)).observe(tray, { attributes: true, attributeFilter: ["data-tab"] });
};
watchTray();
setInterval(watchTray, 500);
boot();

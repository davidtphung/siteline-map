/**
 * Atlas-style dock: a slim pill under a card that opens on demand.
 * Collapsed on first visit. Last open state is kept in localStorage.
 */
const STORE = "siteline.dock.v1";
const TABS = [
  { id: "layers", label: "Layers", pane: "sl-pane-layers", icon: "layers" },
  { id: "jump", label: "Jump", pane: "sl-pane-jump", icon: "jump" },
  { id: "inspect", label: "Inspect", pane: "sl-pane-inspect", icon: "inspect" },
  { id: "about", label: "About", pane: "sl-pane-about", icon: "about" },
  { id: "wells", label: "Wells", pane: "sl-pane-wells", icon: "wells", badge: true },
];

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

function writeStore(open, tab) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ open: !!open, tab: tab || "layers" }));
  } catch {
    /* private mode */
  }
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
  const row = tray.querySelector(".sl-jump-row");
  if (row && !jump.contains(row)) {
    const label = row.previousElementSibling;
    if (label && label.classList.contains("sl-tray-label")) jump.appendChild(label);
    else {
      const p = document.createElement("p");
      p.className = "sl-tray-label";
      p.textContent = "Jump";
      jump.appendChild(p);
    }
    jump.appendChild(row);
  }

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
    bar.innerHTML = TABS.map((tab) => {
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
      '<span class="sl-dock-chev" aria-hidden="true"></span></button>';
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
  if (persist !== false) writeStore(open, next);
  if (open) tray.querySelector(".sl-dock-card")?.scrollTo?.(0, 0);
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
  const pane = document.getElementById("sl-pane-wells");
  const card = document.getElementById("sl-well-card");
  if (!pane || !card || pane.contains(card)) return;
  pane.appendChild(card);
}

function parkBrief() {
  const pane = document.getElementById("sl-pane-inspect");
  const panel = document.querySelector(".brief-panel");
  if (!pane || !panel) return;
  if (panel.parentElement !== pane) pane.prepend(panel);
  const open = panel.classList.contains("open");
  if (open && panel.dataset.slDockOpen !== "1") {
    panel.dataset.slDockOpen = "1";
    openDock("inspect");
  }
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
  tray.addEventListener("click", (event) => {
    const tab = event.target.closest?.("[data-dock-tab]");
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
    const tabs = [...tray.querySelectorAll(".sl-dock-tab")];
    const current = document.activeElement;
    const index = tabs.indexOf(current);
    if (index < 0) return;
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
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
        if (dy > 36) closeDock();
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
    const tag = (event.target && event.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
    const tray = document.getElementById("sl-tray");
    if (!tray || !isOpen(tray)) return;
    event.preventDefault();
    closeDock();
  });
  document.addEventListener("click", (event) => {
    const tray = document.getElementById("sl-tray");
    if (!tray || !isOpen(tray)) return;
    if (event.target.closest?.("#sl-tray, #sl-place, .maplibregl-ctrl, .maplibregl-popup")) return;
    if (event.target.closest?.(".maplibregl-canvas, .maplibregl-map")) closeDock();
  });
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
  const jump = document.querySelector(".sl-jump-row");
  const jumpPane = document.getElementById("sl-pane-jump");
  if (jump && jumpPane && !jumpPane.contains(jump)) {
    const label = jump.previousElementSibling;
    if (label && label.classList.contains("sl-tray-label")) jumpPane.appendChild(label);
    jumpPane.appendChild(jump);
  }
  if (tray.dataset.slDockReady !== "1") {
    tray.dataset.slDockReady = "1";
    const saved = readStore();
    const open = saved ? !!saved.open : false;
    const tab = saved && saved.tab ? saved.tab : "layers";
    apply(tray, open, tab, false);
  }
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
#sl-tray.sl-dock .sl-tray-chrome { display: none !important; }
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
#sl-tray.sl-dock[data-sheet="peek"] .sl-tray-stage { display: block !important; }
#sl-tray.sl-dock .sl-dock-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  width: 100%;
  min-height: 44px;
  padding: 4px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(5, 6, 8, 0.96);
  box-shadow: 0 10px 28px rgba(0,0,0,0.45);
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

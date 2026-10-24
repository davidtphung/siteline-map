/** Apply ?place= or ?lat=&lng=&z= once the MapLibre map exists. */
import { viewFromSearch } from "./map-view.mjs";

let applied = false;

export function applyMapView(map, search) {
  if (applied || !map) return false;
  const view = viewFromSearch(search == null ? location.search : search);
  if (!view) return false;
  const camera = { center: view.center, zoom: view.zoom };
  if (typeof map.jumpTo === "function") map.jumpTo(camera);
  else if (typeof map.flyTo === "function") map.flyTo({ ...camera, essential: true, duration: 0 });
  else return false;
  applied = true;
  const bar = document.getElementById("sl-explainer");
  if (bar) bar.hidden = true;
  return true;
}

function boot(event) {
  const map = event?.detail || window.__SITELINE_MAP__;
  applyMapView(map);
}

window.addEventListener("siteline-map-created", boot);
window.addEventListener("siteline-map-ready", boot);
if (window.__SITELINE_MAP__) boot({ detail: window.__SITELINE_MAP__ });

/** Capture MapLibre Map instances for Siteline. Stock Map, not a subclass. */
import maplibregl from "https://esm.sh/maplibre-gl@4.7.1";

const OriginalMap = maplibregl.Map;

const SIMPLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png"
      ],
      tileSize: 256,
      attribution: "OpenStreetMap"
    }
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }]
};

function SitelineMap(options) {
  const opts = options || {};
  let map;
  try {
    map = new OriginalMap(opts);
  } catch (_) {
    map = new OriginalMap(Object.assign({}, opts, { style: SIMPLE }));
  }
  try {
    window.__SITELINE_MAP__ = map;
    window.dispatchEvent(new CustomEvent("siteline-map-created", { detail: map }));
    const emitReady = () => {
      window.dispatchEvent(new CustomEvent("siteline-map-ready", { detail: map }));
    };
    map.once("load", emitReady);
    map.once("error", () => {
      try {
        if (typeof map.isStyleLoaded === "function" && !map.isStyleLoaded()) map.setStyle(SIMPLE);
      } catch (_) {}
    });
    if (typeof map.loaded === "function" && map.loaded()) emitReady();
    window.setTimeout(() => {
      try {
        if (typeof map.loaded === "function" && !map.loaded()) {
          map.setStyle(SIMPLE);
          map.resize();
        }
      } catch (_) {}
    }, 1200);
  } catch (_) {}
  return map;
}

SitelineMap.prototype = OriginalMap.prototype;
maplibregl.Map = SitelineMap;
try { window.maplibregl = maplibregl; } catch (_) {}
export default maplibregl;

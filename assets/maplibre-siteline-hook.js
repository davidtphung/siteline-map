/** Capture MapLibre Map instances for Siteline enhance overlays. */
import maplibregl from "https://esm.sh/maplibre-gl@4.7.1";
import { layerWithNoto, withGlyphs } from "./glyphs.mjs";

const OriginalMap = maplibregl.Map;

const addLayer = OriginalMap.prototype.addLayer;
OriginalMap.prototype.addLayer = function (layer, before) {
  const next = layerWithNoto(layer);
  return before === undefined ? addLayer.call(this, next) : addLayer.call(this, next, before);
};

const setLayout = OriginalMap.prototype.setLayoutProperty;
OriginalMap.prototype.setLayoutProperty = function (id, name, value) {
  if (name === "visibility") {
    try {
      if (this.getLayer(id) && this.getLayoutProperty(id, "visibility") === value) return;
    } catch (_) {}
  }
  return setLayout.call(this, id, name, value);
};

class SitelineMap extends OriginalMap {
  constructor(options) {
    const next = options ? { ...options } : {};
    if (next.style && typeof next.style === "object") next.style = withGlyphs(next.style);
    super(next);
    try {
      window.__SITELINE_MAP__ = this;
      window.dispatchEvent(new CustomEvent("siteline-map-created", { detail: this }));
      const emitReady = () => {
        window.dispatchEvent(new CustomEvent("siteline-map-ready", { detail: this }));
      };
      this.once("load", emitReady);
      if (typeof this.loaded === "function" && this.loaded()) emitReady();
    } catch (_) {}
  }
}

maplibregl.Map = SitelineMap;
try { window.maplibregl = maplibregl; } catch (_) {}
export default maplibregl;

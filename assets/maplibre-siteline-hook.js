/** Capture MapLibre Map instances for Siteline enhance overlays. */
import maplibregl from "https://esm.sh/maplibre-gl@4.7.1";

const OriginalMap = maplibregl.Map;

class SitelineMap extends OriginalMap {
  constructor(options) {
    super(options);
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
export default maplibregl;

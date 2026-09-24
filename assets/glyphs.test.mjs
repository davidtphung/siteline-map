import assert from "node:assert/strict";
import test from "node:test";
import { GLYPHS_URL, layerWithNoto, notoFont, withGlyphs } from "./glyphs.mjs";

test("style gets a public glyph url and symbol layers use published Noto faces", () => {
  const style = withGlyphs({ version: 8, sources: {}, layers: [] });
  assert.equal(style.glyphs, GLYPHS_URL);
  assert.equal(withGlyphs({ glyphs: "https://example.test/{fontstack}/{range}.pbf" }).glyphs.includes("example.test"), true);
  assert.deepEqual(notoFont(["Open Sans Bold", "Arial Unicode MS Bold"]), ["Noto Sans Bold"]);
  assert.deepEqual(notoFont(["Open Sans Regular", "Arial Unicode MS Regular"]), ["Noto Sans Regular"]);
  const layer = layerWithNoto({
    id: "sl-contour-labels",
    type: "symbol",
    layout: { "text-field": "1", "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"] },
  });
  assert.deepEqual(layer.layout["text-font"], ["Noto Sans Regular"]);
  assert.equal(layerWithNoto({ id: "usgs-topo", type: "raster" }).type, "raster");
});

/** Public MapLibre demo glyphs. Noto Sans Regular and Bold are published; Open Sans Regular is not. */

export const GLYPHS_URL = "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";

export function withGlyphs(style) {
  if (!style || typeof style !== "object" || Array.isArray(style) || typeof style === "string") return style;
  if (style.glyphs) return style;
  return { ...style, glyphs: GLYPHS_URL };
}

export function notoFont(stack) {
  const text = Array.isArray(stack) ? stack.join(" ") : String(stack || "");
  if (/bold|semibold|medium/i.test(text)) return ["Noto Sans Bold"];
  return ["Noto Sans Regular"];
}

export function layerWithNoto(layer) {
  if (!layer || layer.type !== "symbol") return layer;
  const layout = layer.layout || {};
  if (!layout["text-field"] && !layout["text-font"]) return layer;
  return { ...layer, layout: { ...layout, "text-font": notoFont(layout["text-font"]) } };
}

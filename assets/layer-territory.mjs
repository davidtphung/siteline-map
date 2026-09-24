/** HIFLD electric retail service territories. Public ArcGIS Online copy. */

export const TERRITORY_QUERY =
  "https://services3.arcgis.com/OYP7N6mAJJCyH6hd/ArcGIS/rest/services/Electric_Retail_Service_Territories_HIFLD/FeatureServer/0/query";

export const TERRITORY_LAYER_NOTE =
  "Which utility sells retail power here. HIFLD public copy, service areas can lag.";

export const TERRITORY_SOURCE_NOTE =
  "HIFLD Electric Retail Service Territories (ORNL / DOE CESER). ArcGIS Online FeatureServer Electric_Retail_Service_Territories_HIFLD. HIFLD Open NASA root was discontinued. This Living Atlas copy is the public feed.";

const TYPE_LABELS = {
  "INVESTOR OWNED": "IOU",
  COOPERATIVE: "Co-op",
  MUNICIPAL: "Muni",
  "POLITICAL SUBDIVISION": "Political subdivision",
  FEDERAL: "Federal",
  STATE: "State",
  "BEHIND METER": "Behind meter",
};

export function utilityTypeLabel(raw) {
  const text = String(raw == null ? "" : raw).trim();
  if (!text) return "UNKNOWN";
  const key = text.toUpperCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return TYPE_LABELS[key] || text;
}

export function utilitySummary(attributes) {
  const name = String(attributes?.NAME || attributes?.name || "").trim() || "UNKNOWN";
  const type = utilityTypeLabel(attributes?.TYPE || attributes?.type);
  return { name, type };
}

/** ArcGIS JSON feature set (rings) to a GeoJSON FeatureCollection. */
export function esriPolygonsToCollection(payload) {
  const rows = Array.isArray(payload?.features) ? payload.features : [];
  const features = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || {};
    const rings = row.geometry?.rings;
    if (!Array.isArray(rings) || !rings.length) continue;
    features.push({
      type: "Feature",
      id: row.attributes?.OBJECTID ?? i,
      properties: row.attributes || {},
      geometry: { type: "Polygon", coordinates: rings },
    });
  }
  return { type: "FeatureCollection", features };
}

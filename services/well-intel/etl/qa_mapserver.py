"""Build RRC GIS Viewer MapServer QA urls. This module does not assign status."""

MAPSERVER = (
    "https://gis.rrc.texas.gov/server/rest/services/"
    "rrc_public/RRC_Public_Viewer_Srvs/MapServer"
)
QA_LAYERS = {
    1: "Well Locations",
    2: "Orphan Wells",
    4: "Injection/Disposal",
    13: "Pipelines",
}


def layer_query_url(layer_id: int, bbox: tuple[float, float, float, float]) -> str:
    if layer_id not in QA_LAYERS:
        raise ValueError("QA layers are 1 wells, 2 orphan, 4 injection, 13 pipelines")
    west, south, east, north = bbox
    return (
        f"{MAPSERVER}/{layer_id}/query?f=geojson&where=1%3D1&outFields=*&returnGeometry=true"
        f"&geometry={west}%2C{south}%2C{east}%2C{north}&geometryType=esriGeometryEnvelope"
        f"&inSR=4326&spatialRel=esriSpatialRelIntersects"
    )


def qa_note() -> str:
    return (
        "MapServer layers are a QA cross-check only. "
        "Texas RRC downloads and explicit plug evidence are the status authority. "
        "Viewer symbol text is not a Siteline abandoned label."
    )

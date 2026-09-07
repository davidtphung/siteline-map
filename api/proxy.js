const ALLOWED_HOSTS = new Set([
  "epqs.nationalmap.gov",
  "arcgis.netl.doe.gov",
  "services.arcgis.com",
  "services1.arcgis.com",
  "services2.arcgis.com",
  "services5.arcgis.com",
  "services7.arcgis.com",
  "services8.arcgis.com",
  "data.dnrgis.state.co.us",
  "hazards.fema.gov",
  "broadbandmap.fcc.gov",
  "geo.fcc.gov",
  "hydro.nationalmap.gov",
  "overpass-api.de",
  "waterservices.usgs.gov",
  "www.caiso.com",
  "basemap.nationalmap.gov",
  "a.tile.openstreetmap.org",
  "b.tile.openstreetmap.org",
  "c.tile.openstreetmap.org",
  "a.tile.opentopomap.org",
  "b.tile.opentopomap.org",
  "c.tile.opentopomap.org",
  "server.arcgisonline.com",
])

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === "OPTIONS") return res.status(204).end()

  try {
    const target = typeof req.query.url === "string" ? req.query.url : ""
    if (!target) return res.status(400).json({ error: "Missing url query param" })

    let parsed
    try {
      parsed = new URL(target)
    } catch {
      return res.status(400).json({ error: "Invalid url" })
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return res.status(400).json({ error: "Only http(s) allowed" })
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return res.status(403).json({ error: "Host not allowlisted", host: parsed.hostname })
    }

    const method = req.method === "POST" ? "POST" : "GET"
    const headers = { Accept: "application/json,*/*" }
    let body
    if (method === "POST") {
      headers["Content-Type"] = "application/x-www-form-urlencoded"
      if (typeof req.body === "string") body = req.body
      else if (req.body && typeof req.body === "object") {
        body = new URLSearchParams(req.body).toString()
      }
    }

    const upstream = await fetch(parsed.toString(), { method, headers, body })
    const text = await upstream.text()
    const ct = upstream.headers.get("content-type") || "application/json"
    res.setHeader("Content-Type", ct)
    return res.status(upstream.status).send(text)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proxy failure"
    return res.status(502).json({ error: message })
  }
}

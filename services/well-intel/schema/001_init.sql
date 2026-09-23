-- Siteline well intelligence. Distances use EPSG:3081, not Web Mercator.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS source_imports (
  id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  filename TEXT,
  checksum_sha256 TEXT,
  retrieved_at TIMESTAMPTZ NOT NULL,
  record_count INTEGER,
  dataset_origin TEXT,
  notes TEXT,
  raw_manifest JSONB
);

CREATE TABLE IF NOT EXISTS wells (
  id TEXT PRIMARY KEY,
  api_raw TEXT NOT NULL,
  api_normalized TEXT NOT NULL,
  api10_raw TEXT,
  api10_normalized TEXT,
  county_code TEXT,
  county_name TEXT,
  state TEXT NOT NULL DEFAULT 'TX',
  lease_name TEXT,
  well_number TEXT,
  operator_name TEXT,
  symnum INTEGER,
  symnum_raw_label TEXT,
  commodity TEXT NOT NULL,
  commodity_raw TEXT,
  commodity_source TEXT,
  commodity_confidence TEXT,
  commodity_group TEXT NOT NULL,
  is_gas_related BOOLEAN NOT NULL DEFAULT FALSE,
  is_oil_related BOOLEAN NOT NULL DEFAULT FALSE,
  is_mixed_oil_gas BOOLEAN NOT NULL DEFAULT FALSE,
  status_code TEXT NOT NULL,
  status_label TEXT NOT NULL,
  pa_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  review_needed BOOLEAN NOT NULL DEFAULT FALSE,
  freshness TEXT,
  dataset_origin TEXT NOT NULL,
  rules_version TEXT NOT NULL,
  source_import_id TEXT REFERENCES source_imports (id),
  geom geometry(Point, 4326),
  geom_3081 geometry(Point, 3081),
  raw JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS wells_geom_3081_gix ON wells USING GIST (geom_3081);
CREATE INDEX IF NOT EXISTS wells_api_normalized_idx ON wells (api_normalized);
CREATE INDEX IF NOT EXISTS wells_group_idx ON wells (commodity_group);

CREATE TABLE IF NOT EXISTS completions (
  id TEXT PRIMARY KEY,
  well_id TEXT REFERENCES wells (id),
  api_raw TEXT,
  completion_date TEXT,
  fluid TEXT,
  raw JSONB
);

CREATE TABLE IF NOT EXISTS well_status_observations (
  id TEXT PRIMARY KEY,
  well_id TEXT REFERENCES wells (id),
  observed_at DATE,
  source_name TEXT,
  source_url TEXT,
  kind TEXT,
  status_raw TEXT,
  symnum INTEGER,
  plug_date DATE,
  raw JSONB
);

CREATE TABLE IF NOT EXISTS well_status_current (
  well_id TEXT PRIMARY KEY REFERENCES wells (id),
  status_code TEXT NOT NULL,
  status_label TEXT NOT NULL,
  commodity TEXT NOT NULL,
  freshness TEXT,
  review_needed BOOLEAN NOT NULL DEFAULT FALSE,
  pa_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_summary TEXT,
  rules_version TEXT NOT NULL,
  classified_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS well_documents (
  id TEXT PRIMARY KEY,
  well_id TEXT REFERENCES wells (id),
  doc_type TEXT,
  title TEXT,
  source_url TEXT,
  retrieved_at TIMESTAMPTZ,
  raw JSONB
);

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name TEXT,
  geometry JSONB,
  center JSONB,
  radius_miles DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Radius queries must use geom_3081. Example:
-- ST_DWithin(geom_3081, ST_Transform(ST_SetSRID(ST_MakePoint(:lng,:lat),4326),3081), :miles * 1609.344)

# Natural gas well tiles

The map reads `/tiles/gaswells.pmtiles` and `/tiles/gaswells-manifest.json`. The Worker serves those objects from the R2 bucket binding `TILES` with HTTP range requests and a 5 minute cache. Until that binding exists, the Worker serves the same paths from the static asset bundle.

## Bucket and secrets

Create an R2 bucket named `siteline-gaswells` in the Cloudflare account that deploys the `siteline-map` Worker.

Create an R2 API token that can read and write that bucket. Add these repository secrets (Settings, Secrets and variables, Actions). Do not commit the values.

| Secret | Value |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id |
| `R2_ACCESS_KEY_ID` | R2 token access key id |
| `R2_SECRET_ACCESS_KEY` | R2 token secret |
| `R2_BUCKET` | `siteline-gaswells` |

Object keys the workflow writes:

- `tiles/gaswells.pmtiles`
- `tiles/gaswells-manifest.json`

Add this binding to `wrangler.toml` after the bucket exists, then deploy:

```toml
[[r2_buckets]]
binding = "TILES"
bucket_name = "siteline-gaswells"
```

The nightly workflow `.github/workflows/gas-wells.yml` also runs on `workflow_dispatch`. If any of the four secrets is missing, it still builds the tiles, uploads them as the `gaswells` workflow artifact, and exits successfully.

## Coverage

`ingest/sources.py` is the verified catalog (2026-09-24). States with no usable official gas type stay `UNKNOWN` in the manifest. Texas coverage is `partial status`: the RRC GIS layer has shut-in versus gas-well status only, and it has no operator or dates. Colorado uses the daily ECMC `WELLS_SHP.ZIP` file, not the stale live service that has no well class.

The Cameron County fixture is drawn for gas wells only when Texas coverage is `UNKNOWN`, and that fallback is labeled Sample data.

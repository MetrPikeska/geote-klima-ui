# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GEOTE Climate UI is a full-stack GIS web application for analysing and visualising climate indicators across Czech administrative units (ORP, CHKO, obce, okresy, kraje) and custom-drawn polygons. It connects to a home PostgreSQL/PostGIS database via Cloudflare Tunnel, with static frontend files hosted on Wedos.

**Live demo:** https://petrmikeska.cz/geote

## Architecture

```
[Wedos hosting — static files]          [Home server]
  index.html, css/, js/          →      Node.js backend :4000
  (loads config.production.js)   →      pg_featureserv  :9000
                                              ↑
                                    Cloudflare Tunnel (Quick Tunnels)
```

- **Frontend:** Vanilla JS with Leaflet.js (map), Chart.js (graphs), Leaflet.draw (polygon editing). No build step — plain files served statically.
- **Backend:** `backend/server.js` — Express.js, single endpoint `POST /climate/polygon` (supports single & batch). Computes weighted-average climate normals via PostGIS spatial intersection.
- **Database:** PostgreSQL + PostGIS, database name `klima`. Primary table: `climate_master_geom` (katastrální území, EPSG:5514). Results cached in `climate_results_cache` (MD5 hash of geometry, 30-day TTL).
- **GeoAPI:** `pg_featureserv` serves administrative unit geometries (ORP, CHKO, etc.) as OGC API Features at `:9000`.

### Frontend module system

All JS modules attach to the `window.ClimateApp` namespace object:
- `js/config.js` — local dev URLs (overridden by `js/config.production.js` in production)
- `js/api.js` — fetches unit geometries from pg_featureserv and posts polygons to the backend
- `js/compute.js` — client-side climate index calculations (De Martonne, PET Thornthwaite, differences between normals)
- `js/charts.js` — Chart.js rendering (5 modes: klimatogram, teploty, srážky, index, delta)
- `js/map.js` — Leaflet map setup, WMS layer switching, draw toolbar
- `js/ui.js` — UI event handlers, bottom sheet, result rendering

### Climate data periods ("normals")
The `year` column in `climate_master_geom` determines the period:
- `<= 1990` → "Starý normál"
- `1991–2020` → "Nový normál"
- `>= 2041` → "Predikce 2050"

## Running locally

```bash
# 1. Install backend dependencies
cd backend && npm install && cd ..

# 2. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env — set DB_HOST, DB_PASSWORD, etc.

# 3. Start backend + pg_featureserv
./start.sh          # → backend :4000, pg_featureserv :9000
./stop.sh           # graceful shutdown

# 4. Serve frontend (must use HTTP, not file://, due to CORS)
npx http-server . -p 8080
# → http://localhost:8080
```

View logs:
```bash
tail -f logs/backend.log
tail -f logs/pg-featureserv.log
```

## Production deployment

```bash
# On home server — start tunnels and auto-generate config.production.js
./start-tunnels.sh

# Then upload to Wedos:
#   js/config.production.js   ← generated with current tunnel URLs
# (all other files are static and rarely change)
```

`js/config.production.js` is `.gitignore`d — it contains the ephemeral Cloudflare Quick Tunnel URLs and is regenerated every time tunnels restart.

## Backend `.env` variables

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `localhost` | PostgreSQL host (e.g. `192.168.34.11`) |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | DB user |
| `DB_PASSWORD` | *(required)* | DB password |
| `DB_NAME` | `klima` | Database name |
| `PORT` | `4000` | Backend listen port |
| `NODE_ENV` | `development` | `development` or `production` |

## Database schema

### `climate_master_geom`
- `geom` — MultiPolygon, EPSG:5514
- `tavg_m1–m12` — monthly avg temperatures (°C)
- `sra_m1–m12` — monthly precipitation (mm)
- `rh_m1–m12` — relative humidity (%)
- `wv_m1–m12` — wind speed (m/s)
- `tavg_avg` — annual average temperature
- `de_martonn`, `pet` — precomputed indices
- `year` — distinguishes climate normals (see above)

### `climate_results_cache`
Caches spatial computation results keyed by MD5 hash of the input geometry. Cache is valid for 30 days.

## Adding new climate indicators

1. **Backend** (`backend/server.js`): extend the SQL query in `computeClimateForGeometry()` to include new column(s) from `climate_master_geom`. Return them in the normals array.
2. **Cache** (`climate_results_cache`): add new columns if the indicator should be persisted, then update `getCachedResult()` and `saveToCache()`.
3. **Frontend compute** (`js/compute.js`): add a new `case` in `computeForIndicator()` with the formula.
4. **Charts** (`js/charts.js`): add a new render function and hook it into the chart mode switcher.

## Key constraints

- The frontend has **no build step** — no TypeScript, no bundler. Changes are immediate.
- CORS is locked to `petrmikeska.cz` and `*.trycloudflare.com` — adding a new origin requires editing `corsOptions` in `backend/server.js`.
- Incoming geometries may be in EPSG:4326 (Leaflet default) or EPSG:5514. The backend auto-detects based on coordinate magnitude and reprojects as needed.
- Rate limiting: 30 requests/minute per IP on `POST /climate/polygon`.
- The `pg_featureserv` binary is not committed — must be downloaded separately (Linux amd64 binary from CrunchyData releases).

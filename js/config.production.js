// === config.production.js ===
// Production configuration — Cloudflare Tunnel → FastAPI na Ubuntu serveru

window.ClimateApp = window.ClimateApp || {};

ClimateApp.config = {
  // FastAPI backend přes Cloudflare Tunnel
  BACKEND_URL: "https://api.petrmikeska.cz",

  // pg_featureserv (OGC API Features) — pokud stále běží, jinak přes FastAPI
  BASE_API_URL: "https://api.petrmikeska.cz",

  // Tile server — volitelné
  TILE_URL: "https://api.petrmikeska.cz/tiles/public.climate_master_geom/{z}/{x}/{y}.png"
};

// Cloudflare Tunnel config: ~/.cloudflared/config.yml na Ubuntu serveru
// FastAPI běží na portu 8000, tunel ho vystaví jako api.petrmikeska.cz

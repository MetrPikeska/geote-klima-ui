// === config.production.js ===
// Production configuration — Cloudflare Tunnel
// Subdomény směřují na lokální server přes cloudflared tunel

window.ClimateApp = window.ClimateApp || {};

ClimateApp.config = {
  // pg_featureserv (OGC API Features) přes Cloudflare Tunnel
  BASE_API_URL: "https://api.petrmikeska.cz",

  // Node.js backend přes Cloudflare Tunnel
  BACKEND_URL: "https://backend.petrmikeska.cz",

  // Tile server přes Cloudflare Tunnel (pokud běží pg_tileserv)
  TILE_URL: "https://tiles.petrmikeska.cz/public.climate_master_geom/{z}/{x}/{y}.png"
};

// Cloudflare Tunnel config: ~/.cloudflared/config.yml na Ubuntu serveru
// Systemd služba: sudo systemctl status cloudflared

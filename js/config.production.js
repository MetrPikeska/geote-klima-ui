// === config.production.js ===
// Production configuration for deployment
// Replace this with config.local.js for local development

window.ClimateApp = window.ClimateApp || {};

ClimateApp.config = {
  // pg_featureserv na serveru (lokální IP)
  BASE_API_URL: "http://192.168.34.4:9000",

  // Node.js backend na serveru
  BACKEND_URL: "http://192.168.34.4:4000",

  // Tile server (pokud běží)
  TILE_URL: "http://192.168.34.4:7800/public.climate_master_geom/{z}/{x}/{y}.png"
};

// Note: Tailscale IP 100.95.250.20 je přístupné jen v Tailscale síti
// Pro veřejný přístup by musela být veřejná IP nebo domain

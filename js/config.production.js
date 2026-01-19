// === config.production.js ===
// Production configuration for deployment
// Replace this with config.local.js for local development

window.ClimateApp = window.ClimateApp || {};

ClimateApp.config = {
  // pg_featureserv na tvém serveru (Tailscale IP)
  BASE_API_URL: "http://100.95.250.20:9000",
  
  // Node.js backend na tvém serveru
  BACKEND_URL: "http://100.95.250.20:4000",
  
  // Tile server (pokud běží)
  TILE_URL: "http://100.95.250.20:7800/public.climate_master_geom/{z}/{x}/{y}.png"
};

// Note: Tailscale IP 100.95.250.20 je přístupné jen v Tailscale síti
// Pro veřejný přístup by musela být veřejná IP nebo domain

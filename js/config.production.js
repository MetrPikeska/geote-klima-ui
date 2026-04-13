// === config.production.js ===
// Vercel deployment — BACKEND_URL je prázdný, requesty jdou přes Vercel rewrite na tunnel
// Tunnel URL je v vercel.json

window.ClimateApp = window.ClimateApp || {};

ClimateApp.config = {
  BACKEND_URL: "",
  TILE_URL:    ""
};

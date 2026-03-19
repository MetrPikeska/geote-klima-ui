#!/usr/bin/env bash
# GEOTE Climate — spustí Cloudflare tunnely a automaticky aktualizuje config.production.js

set -e
PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CF="$HOME/cloudflared"

# Zruš staré tunely
if [ -f /tmp/tunnel-backend.pid ]; then kill $(cat /tmp/tunnel-backend.pid) 2>/dev/null || true; fi
if [ -f /tmp/tunnel-geo.pid ];     then kill $(cat /tmp/tunnel-geo.pid)     2>/dev/null || true; fi
sleep 1

echo "Spouštím tunely..."
$CF tunnel --url http://localhost:4000 --no-autoupdate > /tmp/tunnel-backend.log 2>&1 &
echo $! > /tmp/tunnel-backend.pid
$CF tunnel --url http://localhost:9000 --no-autoupdate > /tmp/tunnel-geo.log 2>&1 &
echo $! > /tmp/tunnel-geo.pid

echo -n "Čekám na URL"
for i in $(seq 1 20); do
  sleep 1; echo -n "."
  BACKEND=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/tunnel-backend.log 2>/dev/null | head -1)
  GEO=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/tunnel-geo.log 2>/dev/null | head -1)
  [ -n "$BACKEND" ] && [ -n "$GEO" ] && break
done
echo ""

if [ -z "$BACKEND" ] || [ -z "$GEO" ]; then
  echo "❌ Nepodařilo se získat URL tunelů. Zkontroluj /tmp/tunnel-backend.log"
  exit 1
fi

echo "✓ Backend:      $BACKEND"
echo "✓ pg_featureserv: $GEO"

# Aktualizuj config.production.js
cat > "$PROJECT/js/config.production.js" << EOF
// === config.production.js ===
// Automaticky generováno skriptem start-tunnels.sh — $(date)

window.ClimateApp = window.ClimateApp || {};

ClimateApp.config = {
  BASE_API_URL: "$GEO",
  BACKEND_URL:  "$BACKEND",
  TILE_URL:     ""
};
EOF

echo ""
echo "✓ config.production.js aktualizován"
echo ""
echo "══════════════════════════════════════════"
echo "  Nahraj na Wedos hosting:"
echo "  → Soubor js/config.production.js"
echo "  (ostatní soubory se nemění)"
echo "══════════════════════════════════════════"
echo ""
echo "  Veřejná URL aplikace: https://petrmikeska.cz"
echo ""
echo "  Pro zastavení tunelů:"
echo "  kill \$(cat /tmp/tunnel-backend.pid) \$(cat /tmp/tunnel-geo.pid)"

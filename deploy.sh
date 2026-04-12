#!/usr/bin/env bash
# GeoKlima — sestaví hosting/ adresář připravený k nahrání na Wedos
# Spusť VŽDY po ./start-tunnels.sh (generuje config.production.js)

set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$DIR/hosting"

echo "→ Čistím hosting/..."
rm -rf "$DIST"
mkdir -p "$DIST/js" "$DIST/css"

# Zkontroluj že config.production.js existuje a má platné URL
if [ ! -f "$DIR/js/config.production.js" ]; then
  echo "✗ Chybí js/config.production.js — spusť nejdřív ./start-tunnels.sh"
  exit 1
fi
if grep -q "PLACEHOLDER" "$DIR/js/config.production.js"; then
  echo "✗ config.production.js obsahuje PLACEHOLDER URL — spusť ./start-tunnels.sh"
  exit 1
fi

# index.html — přepne config.js → config.production.js
sed 's|js/config\.js|js/config.production.js|g' "$DIR/index.html" > "$DIST/index.html"
echo "✓ index.html (config → production)"

# CSS
cp "$DIR/css/style.css" "$DIST/css/style.css"
echo "✓ css/style.css"

# JS — všechny soubory kromě config.js (ten nahrazuje config.production.js)
for f in api.js compute.js charts.js map.js ui.js; do
  cp "$DIR/js/$f" "$DIST/js/$f"
  echo "✓ js/$f"
done
cp "$DIR/js/config.production.js" "$DIST/js/config.production.js"
echo "✓ js/config.production.js"

echo ""
echo "══════════════════════════════════════════"
echo "  hosting/ je připravený k nahrání"
echo "══════════════════════════════════════════"
echo "  Nahraj obsah hosting/ na Wedos do:"
echo "  public_html/geote/"
echo ""
echo "  Soubory:"
find "$DIST" -type f | sed "s|$DIST/|    |" | sort

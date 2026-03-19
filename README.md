# GEOTE Climate UI

![GitHub last commit](https://img.shields.io/github/last-commit/MetrPikeska/geote-klima-ui)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

> Webová GIS aplikace pro analýzu a vizualizaci klimatických ukazatelů v České republice pomocí PostGIS prostorové analýzy a interaktivního mapování.

**🌍 Live demo:** [petrmikeska.cz/geote](https://petrmikeska.cz/geote)

---

## 📋 Přehled projektu

**GEOTE Climate UI** je full-stack geoinformační webová aplikace pro analýzu klimatických dat napříč administrativními jednotkami a vlastními geografickými oblastmi.

Aplikace umožňuje:
- Analýzu klimatických ukazatelů pro ORP, CHKO nebo vlastní polygony
- Výpočet a vizualizaci De Martonne indexu a PET
- Porovnání historických normálů s predikcemi do roku 2050
- Přepínání mapových podkladů: OSM, Letecká (ČÚZK), Katastr nemovitostí (ČÚZK)

---

## ✨ Klíčové funkce

### 🗺️ Mapové podklady (WMS)
- **Mapa** — CartoDB dark (výchozí)
- **OSM** — OpenStreetMap
- **Letecká** — ČÚZK Ortofoto WMS
- **Katastr** — ČÚZK Katastr nemovitostí WMS

### 📈 Interaktivní grafy (5 módů)
- **Klimatogram** — Walter-Lieth diagram (teploty + srážky, dvojitá osa)
- **Teploty** — průměrné měsíční teploty pro všechny normály
- **Srážky** — průměrné měsíční srážky
- **Index** — trend klimatického indexu s T a R jako doplňkové datasety
- **Δ Změny** — delta porovnání normálů oproti starému normálu

### 🎨 UI Design (Mapy.cz styl)
- Fullscreen mapa jako základ
- Floating glassmorphism panely
- Pill segmented control pro přepínání mapových podkladů
- Editační nástroje vlevo, controls panel vpravo od nich
- Výsledky v slide-up bottom sheetu

### ⚡ Výkon
- Database caching (MD5 hash geometrie)
- Dávkové zpracování více geometrií
- Vážený průměr klimatických dat dle prostorového překryvu polygonů

---

## 🛠️ Technologie

| Vrstva | Technologie |
|---|---|
| Frontend | Vanilla JS, Leaflet.js, Leaflet.draw, Chart.js |
| Mapové WMS | ČÚZK Ortofoto, ČÚZK Katastr, CartoDB, OSM |
| Backend | Node.js + Express.js |
| Databáze | PostgreSQL 12+ + PostGIS |
| GeoAPI | pg_featureserv (OGC API Features) |
| Deployment | Wedos hosting + Cloudflare Tunnel (zdarma) |

---

## 🚀 Lokální spuštění

```bash
git clone https://github.com/MetrPikeska/geote-klima-ui.git
cd geote-klima-ui

# Instalace závislostí
cd backend && npm install && cd ..

# Konfigurace
cp backend/.env.example backend/.env
nano backend/.env   # doplň PostgreSQL přihlašovací údaje
nano pg-featureserv/config/pg_featureserv.toml  # doplň DbConnection

# Spuštění
./start.sh

# Frontend (nutný HTTP server kvůli CORS)
npx http-server . -p 8080
# → http://localhost:8080
```

---

## 🌐 Deployment (vlastní server + Wedos)

```
[Wedos hosting]              [Vlastní server]
petrmikeska.cz/geote  ──→   backend :4000
(statické soubory)    ──→   pg_featureserv :9000
                              ↑
                        Cloudflare Tunnel (zdarma)
```

### Na serveru

```bash
# Spuštění backend + pg_featureserv
./start.sh

# Spuštění Cloudflare tunelů (automaticky aktualizuje config.production.js)
./start-tunnels.sh
```

### Na Wedos

Nahraj do `public_html/geote/`:
- `index.html`, `css/`, `js/` (vč. vygenerovaného `config.production.js`)

> `config.production.js` je v `.gitignore` — generuje se vždy skriptem `start-tunnels.sh` a obsahuje aktuální tunnel URL.

---

## ⚙️ Konfigurace

### `backend/.env`
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=klima
PORT=4000
NODE_ENV=development
```

### `pg-featureserv/config/pg_featureserv.toml`
```toml
[Database]
DbConnection = "postgresql://postgres:password@host:5432/klima"

[Server]
HttpPort = 9000
HttpHost = "0.0.0.0"

[Paging]
LimitDefault = 10000
LimitMax = 10000
```

---

## 🗄️ Databázová architektura

### `climate_master_geom`

| Sloupce | Popis |
|---|---|
| `geom` | MultiPolygon (EPSG:5514) |
| `tavg_m1–m12` | Průměrné měsíční teploty (°C) |
| `sra_m1–m12` | Měsíční srážky (mm) |
| `rh_m1–m12` | Relativní vlhkost (%) |
| `wv_m1–m12` | Rychlost větru (m/s) |
| `de_martonn`, `pet` | Předpočítané klimatické indexy |
| `year` | Rok — rozlišuje normály (≤1990, 1991–2020, ≥2041) |

### `climate_results_cache`
Cachuje výsledky prostorových výpočtů — MD5 hash geometrie → normály (T, R, měsíční teploty, srážky).

---

## 📁 Struktura projektu

```
geote-klima-ui/
├── index.html              # Vstupní bod
├── start.sh / stop.sh      # Správa služeb
├── start-tunnels.sh        # Cloudflare Tunnel + auto-update config
├── backend/
│   ├── server.js           # Express API (spatial queries, caching)
│   ├── db.js               # PostgreSQL pool
│   └── .env.example
├── css/
│   └── style.css           # Design system (glassmorphism)
├── js/
│   ├── config.js           # Lokální konfigurace
│   ├── api.js              # API komunikace
│   ├── compute.js          # Klimatické výpočty
│   ├── charts.js           # Chart.js (5 módů, Walter-Lieth klimatogram)
│   ├── map.js              # Leaflet + WMS + layer switching
│   └── ui.js               # UI handlers
└── pg-featureserv/
    └── config/pg_featureserv.toml
```

---

## 🎓 Akademický kontext

Projekt vyvinut pro předmět GEOTE (Katedra geoinformatiky, ZS 2025). Demonstruje PostGIS prostorovou analýzu, OGC API Features, transformace EPSG:5514, full-stack vývoj a deployment s Cloudflare Tunnel.

---

## 📜 Licence

MIT License — Copyright (c) 2025 Petr Mikeška

---

**Autor:** [Petr Mikeška](https://github.com/MetrPikeska) · [petrmikeska.cz](https://petrmikeska.cz)  
**Verze:** 2.0.0 · **Aktualizováno:** Březen 2026

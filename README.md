# GeoKlima

![GitHub last commit](https://img.shields.io/github/last-commit/MetrPikeska/geote-klima-ui)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black)

> Webová GIS aplikace pro analýzu a vizualizaci klimatických ukazatelů v České republice. Využívá PostGIS prostorovou analýzu, interaktivní mapu s administrativními jednotkami a porovnání klimatických normálů 1961–1990, 1991–2020 a predikcí do roku 2050.

**Live demo:** [geote-klima-ui.vercel.app](https://geote-klima-ui.vercel.app)

---

## Architektura

```
[Vercel — statický frontend]        [Domácí server]
  index.html, css/, js/    ──→      FastAPI backend :8001
  vercel.json (rewrites)   ──→      PostgreSQL + PostGIS
                                          ↑
                                   Cloudflare Tunnel (geote-tunnel)
                                   → houston-pitch-emerald-violin.trycloudflare.com
```

- **Frontend** — Vanilla JS, Leaflet.js, Chart.js, Leaflet.draw. Žádný build step.
- **Backend** — FastAPI (Python), endpoint `POST /climate/polygon` (single + batch). Prostorový výpočet váženého průměru klimatických normálů přes PostGIS.
- **Databáze** — PostgreSQL + PostGIS, db `klima`. Hlavní tabulka: `climate_master_geom`. Cache výsledků: `climate_results_cache` (MD5 hash geometrie, 30 dní TTL).
- **Proxy** — Vercel rewrite pravidla v `vercel.json` přesměrovávají `/units/*` a `/climate/*` na Cloudflare Tunnel.

---

## Funkce

### Administrativní jednotky
- Kraje, Okresy, ORP (výchozí), Obce, CHKO/NP, vlastní polygon
- Interaktivní vrstva na mapě — kliknutím spustíš výpočet
- Lazy loading jednotek při přepínání typů

### Klimatické ukazatele
| Ukazatel | Popis |
|---|---|
| De Martonne AI | Index aridity: R / (T + 10) |
| Lang LDF | Langův dešťový faktor: R / T |
| PET Thornthwaite | Potenciální evapotranspirace (mm/rok) |
| VPD | Vapor Pressure Deficit (kPa) |
| MVJ | Minářova vláhová jistota, veg. období 4–9 (%) |
| KIZ | Končekův index zavlažení, léto 6–8 (mm) |
| Δ Srážky | Rozdíl srážek mezi normálami |
| Δ Teplota | Rozdíl teplot mezi normálami |

### Klimatické normály
- **Starý normál** — roky ≤ 1990
- **Nový normál** — 1991–2020
- **Predikce 2050** — roky ≥ 2041

### Ostatní
- Dávkový výpočet (multi-select, max 50 jednotek)
- Export výsledků jako GeoJSON
- Mapové podklady: Dark, OSM, Letecká (ČÚZK), Katastr nemovitostí (ČÚZK)
- Přepínání jazyka CS / EN (i18n)
- GeoJSON upload + automatická reprojekce S-JTSK → WGS84

---

## Technologie

| Vrstva | Stack |
|---|---|
| Frontend | Vanilla JS, Leaflet.js 1.9, Leaflet.draw, Chart.js, proj4js |
| Backend | FastAPI (Python 3.12), asyncpg, slowapi, uvicorn |
| Databáze | PostgreSQL 12+ + PostGIS |
| Hosting (frontend) | Vercel (GitHub auto-deploy) |
| Hosting (backend) | Vlastní server + Cloudflare Tunnel |

---

## Lokální spuštění

```bash
git clone https://github.com/MetrPikeska/geote-klima-ui.git
cd geote-klima-ui

# Backend
cd api
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
nano .env   # doplň DB_HOST, DB_PASSWORD atd.

# Spuštění backendu
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (nutný HTTP server kvůli CORS)
cd ..
npx http-server . -p 8080
# → http://localhost:8080
```

Frontend v `config.js` používá `BACKEND_URL: "http://localhost:8000"` automaticky.

---

## Deployment

### Frontend → Vercel

Propojeno s GitHub repozitářem. Každý `git push` na `main` spustí automatický redeploy.

```bash
git add .
git commit -m "..."
git push   # → Vercel redeploys za ~30s
```

### Tunnel URL se změnila?

Když se restartuje Cloudflare Tunnel (`geote-tunnel`), změní se URL. Aktualizuj `vercel.json`:

```bash
# 1. Zjisti novou URL na serveru
pm2 logs geote-tunnel --lines 30 --nostream

# 2. Uprav vercel.json lokálně (nahraď všechna výskyty tunnel URL)
# 3. Push
git add vercel.json && git commit -m "fix: update tunnel URL" && git push
```

### PM2 na serveru

```
cloudflare-tunnel  — port 8000 → volebni-api
geote-tunnel       — port 8001 → geote-api  ← tento tunel
geote-api          — uvicorn :8001
volebni-api        — uvicorn :8000
```

---

## Konfigurace backendu (`api/.env`)

```env
DB_HOST=192.168.34.x
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=klima
```

---

## Bezpečnost

- Rate limiting: 20 req/min/IP na `/climate/polygon`, 30 req/min/IP na `/units/`
- Max body size: 256 KB
- Max vrcholů geometrie: 8 000
- Validace typu geometrie (pouze Polygon/MultiPolygon)
- Batch limit: max 50 geometrií
- CORS: `allow_origins=["*"]` (záměrně — Cloudflare Quick Tunnel mění subdomény)
- Docs UI vypnutý (`docs_url=None`)

---

## Databázové schéma

### `climate_master_geom`
| Sloupec | Popis |
|---|---|
| `geom` | MultiPolygon (EPSG:5514) |
| `tavg_m1–m12` | Průměrné měsíční teploty (°C) |
| `sra_m1–m12` | Měsíční srážky (mm) |
| `rh_m1–m12` | Relativní vlhkost (%) |
| `wv_m1–m12` | Rychlost větru (m/s) |
| `year` | Rok — určuje normál (≤1990 / 1991–2020 / ≥2041) |

### `climate_results_cache`
Cachuje výsledky prostorových výpočtů (MD5 hash geometrie, platnost 30 dní).

---

## Struktura projektu

```
geote-klima-ui/
├── index.html              # Vstupní bod
├── vercel.json             # Vercel rewrite pravidla (proxy na tunnel)
├── deploy.sh               # Build skript pro Wedos (legacy)
├── api/
│   ├── main.py             # FastAPI aplikace
│   ├── database.py         # asyncpg connection pool
│   └── requirements.txt
├── css/
│   └── style.css
├── js/
│   ├── config.js           # Lokální dev konfigurace (localhost:8000)
│   ├── config.production.js # Produkční konfigurace (BACKEND_URL: "")
│   ├── i18n.js             # CS/EN překlady
│   ├── api.js              # Fetch wrapper (units + climate)
│   ├── compute.js          # Klimatické výpočty na klientu
│   ├── charts.js           # Chart.js grafy
│   ├── map.js              # Leaflet mapa, WMS, draw toolbar
│   └── ui.js               # UI event handlers, bottom sheet
└── backend/                # Starý Node.js backend (nepoužívá se)
```

---

## Akademický kontext

Projekt vyvinut pro předmět GEOTE (Katedra geoinformatiky, ZS 2025). Demonstruje PostGIS prostorovou analýzu, OGC API Features, transformace EPSG:5514, full-stack vývoj a deployment s Cloudflare Tunnel.

---

**Autor:** [Petr Mikeska](https://github.com/MetrPikeska) · [petrmikeska.cz](https://petrmikeska.cz)
MIT License · Aktualizováno: Duben 2026

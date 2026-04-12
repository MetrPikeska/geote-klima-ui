# GeoKlima — Plán vývoje

> Webová GIS aplikace pro klimatickou analýzu ČR. Portfolio projekt.
> Autor: Petr Mikeska

---

## Architektura

```
[Wedos hosting — statické soubory]     [Domácí server — 192.168.34.4]
  index.html, css/, js/         →      Node.js backend :4000
  (config.production.js)        →      pg_featureserv  :9000
                                              ↑
                                    Cloudflare Tunnel (Quick Tunnels)
```

- **Frontend:** Vanilla JS + Leaflet + Chart.js, bez build stepu
- **Backend:** Express.js, `POST /climate/polygon` (single + batch)
- **DB:** PostgreSQL + PostGIS, databáze `klima`, host `192.168.34.4`, port `5432`
- **Cache:** tabulka `climate_results_cache` (MD5 hash geometrie, 30 dní TTL)
- **GeoAPI:** `pg_featureserv` slouží administrativní vrstvy jako OGC API Features

---

## Databázové vrstvy

| Tabulka              | Sloupec názvu  | Počet | Typ       |
|----------------------|----------------|-------|-----------|
| `kraje`              | `naz_cznuts3`  | 14    | MultiPolygon EPSG:5514 |
| `okresy`             | `nazev`        | 77    | MultiPolygon EPSG:5514 |
| `orp`                | `NAZ_ORP`      | 206   | MultiPolygon EPSG:5514 |
| `obce`               | `nazev`        | 6 258 | MultiPolygon EPSG:5514 |
| `chko`               | `NAZEV`        | 33    | MultiPolygon EPSG:5514 (včetně NP) |
| `vodni_toky`         | `naz_tok`      | 8 171 | MultiLineString — dekorativní |
| `climate_master_geom`| —              | 91 637| Katastrální území, klimatická data |

### Sloupce `climate_master_geom`
- `tavg_m1–m12`, `tavg_avg` — průměrné teploty
- `sra_m1–m12`, `sra_avg` — srážky
- `rh_m1–m12`, `rh_avg` — relativní vlhkost
- `wv_m1–m12`, `wv_avg` — rychlost větru
- `de_martonn`, `pet`, `heat_index` — předpočítané indexy
- `year` — klimatický normál (≤1990 / 1991–2020 / ≥2041)

---

## Klimatické ukazatele

| Klíč         | Název                        | Vzorec / poznámka                                              | Stav      |
|--------------|------------------------------|----------------------------------------------------------------|-----------|
| `demartonne` | De Martonne index aridity    | `AI = R / (T + 10)`                                            | ✅ hotovo  |
| `ldf`        | Langův dešťový faktor        | `LDF = R / T` (jen T > 0)                                      | ✅ hotovo  |
| `pet`        | PET Thornthwaite             | Σ měsíčních PET, korekce 50°N                                  | ✅ hotovo  |
| `vpd`        | Vapor Pressure Deficit       | `VPD = SVP - AVP`, potřebuje `rh_avg` z backendu              | ⏳ čeká na backend |
| `mvj`        | Minářova vláhová jistota     | `(SRA_veg - PET_veg) / PET_veg × 100`, měs. 4–9               | ✅ hotovo  |
| `kiz`        | Končekův index zavlažení     | `SRA_léto - 0.8 × PET_léto`, měs. 6–8                         | ✅ hotovo  |
| `deltasra`   | Δ Srážky mezi normálami      | `R_normál - R_starý` (mm)                                      | ✅ hotovo  |
| `deltat`     | Δ Teplota mezi normálami     | `T_normál - T_starý` (°C)                                      | ✅ hotovo  |

---

## Co je hotovo ✅

### Frontend
- [x] Nový design — amber/gold paleta, Syne + DM Sans fonty
- [x] Levý sidebar (300px) nahrazuje floating control card
- [x] 6 typů územních jednotek (Kraj, Okres, ORP, Obec, CHKO/NP, Vlastní)
- [x] Live search filtrování unit listu
- [x] 8 klimatických ukazatelů jako chip grid
- [x] Normál segmented control (≤1990 / 1991–2020 / 2050+)
- [x] Výsledkový bottom sheet s metric cards
- [x] Batch výpočet + srovnávací graf
- [x] GeoJSON export
- [x] Mobilní layout (hamburger menu)

### Backend
- [x] `POST /climate/polygon` — single + batch
- [x] MD5 cache do `climate_results_cache` (30 dní)
- [x] Váhovaný průměr dle prostorového překryvu
- [x] Rate limiting (30 req/min per IP)
- [x] Auto-detekce EPSG:5514 vs 4326

---

## Co zbývá udělat 🔧

### Backend (priorita)
- [ ] Vrátit `rh_avg` a `wv_avg` v normálech → umožní VPD výpočet
  - upravit SQL v `computeClimateForGeometry()` v `server.js`
  - přidat do cache tabulky sloupce pro RH a WV
- [ ] Otestovat všechny nové vrstvy (kraje, okresy, obce) přes pg_featureserv
- [ ] Aktualizovat `climate_results_cache` — schéma nestačí pro nová data

### Frontend
- [ ] Přidat dekorativní vrstvu `vodni_toky` jako WMS/vector overlay na mapu
- [ ] Lepší zobrazení výsledků pro delta ukazatele (ΔT, ΔR) — barevné kódování
- [ ] Přidat chart mód pro nové ukazatele (PET, VPD, MVJ, KIZ)
- [ ] Lokalizace jednotek v grafu (osy, popisky)
- [ ] Loading skeleton pro unit list (při načítání obcí)

### Deployment
- [ ] Spustit backend + pg_featureserv lokálně a otestovat celý flow
- [ ] Otestovat Cloudflare tunnely
- [ ] Nahrát statické soubory na Wedos
- [ ] README aktualizovat

---

## Jak spustit lokálně

```bash
# Backend
cd backend && npm install
# Zkontrolovat backend/.env — DB_HOST musí být 192.168.34.4
./start.sh          # spustí backend :4000 + pg_featureserv :9000

# Frontend
npx http-server . -p 8080
# → http://localhost:8080

# Logy
tail -f logs/backend.log
tail -f logs/pg-featureserv.log
```

---

## Poznámky

- `js/config.production.js` je v `.gitignore` — generuje se skriptem `./start-tunnels.sh`
- VPD bude fungovat až po úpravě backendu (vrátit `rh_avg` v normálech)
- Obce má 6 258 záznamů — pg_featureserv potřebuje `limit=7000` v URL
- EPSG:5514 souřadnice mají hodnoty v řádu set tisíc — backend auto-detekuje podle magnitude

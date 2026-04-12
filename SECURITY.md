# SECURITY.md — GeoKlima API

Tento soubor popisuje bezpečnostní opatření projektu a otevřené položky.

## Architektura a hranice

```
[Browser] → [Cloudflare Quick Tunnel] → [FastAPI :8001] → [PostgreSQL klima]
               (ephemeral URL)              uvicorn             asyncpg pool
```

- Cloudflare Quick Tunnel = veřejná URL, mění se při každém restartu tunelu
- PostgreSQL poslouchá pouze na localhost (není přístupný z internetu)
- Frontend je statický (Wedos) — žádná serverová logika tam není

---

## Aktuální opatření

### Rate limiting (slowapi)
| Endpoint              | Limit          | Poznámka                        |
|-----------------------|----------------|---------------------------------|
| `POST /climate/polygon` | 20 req/min/IP  | Výpočetně drahý dotaz           |
| `GET /units/{type}`   | 30 req/min/IP  | Velké GeoJSON odpovědi          |

### CORS
- Povolené origins: `petrmikeska.cz`, `*.petrmikeska.cz`, `localhost:*`, `*.trycloudflare.com`
- `allow_credentials=False` — API nepracuje s cookies

### Validace vstupů
- Max velikost POST těla: **256 KB** (Starlette default override)
- Max počet souřadnic polygonu: **8 000 bodů** (ochrana před pomalými dotazy)
- Povolené typy geometrie: `Polygon`, `MultiPolygon`, `Feature`
- Souřadnice mimo rozumný rozsah jsou odmítnuty

### Databáze
- Veškeré dotazy používají parametrizované SQL (asyncpg `$1`, `$2`, …) — SQL injection není možná
- DB pool min=2, max=10 — omezení simultánních spojení
- Cache (30 dní) snižuje zátěž pro opakované dotazy na stejný polygon

### GitHub
- `.env` soubory jsou v `.gitignore` ✓
- `config.production.js` (s tunnel URL) je v `.gitignore` ✓
- Žádná hesla v commit historii (ověřeno)
- `backend/.env.save` je v `.gitignore` ✓

---

## Otevřené položky / TODO

| Priorita | Položka | Stav |
|----------|---------|------|
| Střední | Přidat `X-Request-ID` do logů pro sledování abuse | ❌ |
| Nízká | Cloudflare Named Tunnel místo Quick Tunnel (stabilní URL, lepší konfigurace) | ❌ |
| Nízká | Firewall pravidlo: port 8001 dostupný pouze přes loopback (cloudflared přistupuje lokálně) | ❌ |
| Info | Zvážit API klíč pokud bude API zneužíváno | — |

---

## Co NENÍ chráněno (záměrně)

- **Autentizace uživatelů** — API je veřejné read-only, auth by rozbila demo
- **HTTPS na backendu** — Cloudflare Tunnel dělá TLS terminaci, backend komunikuje lokálně přes HTTP
- **Audit log** — logy přes pm2, není perzistentní analýza

---

## Cloudflare Quick Tunnel — bezpečnostní vlastnosti

Quick Tunnel (bez účtu) je ephemeral — URL se mění při restartu. To je zároveň:
- ✓ Bezpečnostní výhoda: útočník nezná URL předem
- ✗ Operační nevýhoda: frontend potřebuje nový `config.production.js` po každém restartu

Pro produkci zvážit **Named Tunnel** (vyžaduje Cloudflare účet, stabilní URL, dá se omezit na konkrétní zónu/doménu).

---

## Postup při podezřelé aktivitě

```bash
# Zobrazit logy s IP adresami
pm2 logs geote-api --lines 100 | grep "POST /climate"

# Dočasně zastavit API
pm2 stop geote-api

# Obnovit tunel s novou URL (tím se změní endpoint)
pm2 restart geote-tunnel  # nebo cloudflared znovu ručně
```

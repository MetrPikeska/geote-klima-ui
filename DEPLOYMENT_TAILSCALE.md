# 🚀 Deployment Guide - GEOTE Climate UI na Hostingu s Tailscale

## 📊 Tvoje Setup

```
Hosting Server (Ubuntu)
    ↓ Tailscale Network
100.95.250.20:5432 (PostgreSQL + PostGIS)
    ↑
Docker Containers (backend, pg_featureserv, nginx)
    ↓
https://petrmikeska.cz (Frontend)
```

---

## ✅ Tvoje Údaje

| Co | Hodnota |
|---|---|
| **Tailscale IP** | 100.95.250.20 |
| **Port PostgreSQL** | 5432 |
| **Database** | klima |
| **Username** | postgres |
| **Password** | master |
| **Domain** | petrmikeska.cz |
| **HTTPS** | Máš připraveno |

---

## 🎯 Kompletní Deployment (7 kroků)

### Krok 1: SSH do hostingu

```bash
# Přihlásíš se přes SSH/Tailscale
ssh user@petrmikeska.cz

# Nebo přes Tailscale IP
ssh user@100.95.250.20
```

### Krok 2: Instalace Docker + Docker Compose

```bash
# Instaluj Docker
curl -fsSL https://get.docker.com | sudo sh

# Přidej svého uživatele do docker grupy
sudo usermod -aG docker $USER

# Aktivuj novou skupinu
newgrp docker

# Instaluj Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Ověř, že je všechno nainstalované
docker --version
docker-compose --version
```

### Krok 3: Clone projektu z GitHubu

```bash
# Vytvoř adresář
mkdir -p ~/apps
cd ~/apps

# Naklonuj projekt
git clone https://github.com/MetrPikeska/geote-klima-ui.git
cd geote-klima-ui
```

### Krok 4: Vytvoř .env soubor s heslem

```bash
# Vytvoř soubor s databázovým heslem
echo "DB_PASSWORD=master" > .env

# Ověř, že je soubor vytvořen
cat .env

# Měl bys vidět:
# DB_PASSWORD=master
```

**⚠️ BEZPEČNOST:** Soubor `.env` je v `.gitignore`, takže se NIKDY nepushne na GitHub (heslo je bezpečné).

### Krok 5: Kopírování frontend souborů

```bash
# Vytvoř frontend adresář pro Nginx
mkdir -p frontend

# Zkopíruj frontend soubory (HTML, CSS, JS)
cp index.html frontend/
cp -r css frontend/
cp -r js frontend/

# Ověř, že je všechno tam
ls -la frontend/
# Měl bys vidět: index.html, css/, js/
```

### Krok 6: Build a Spuštění Docker Containers

```bash
# Build Docker image (vytvoří "krabici" s Node.js + aplikace)
# POZOR: Trvá 2-3 minuty, buď trpělivý!
docker-compose build

# Spusť všechny 3 kontejnery na pozadí (-d = detach)
docker-compose up -d

# Ověř, že všechno běží
docker-compose ps

# Měl bys vidět něco jako:
# NAME              STATUS
# geote-backend     Up 2 minutes (healthy)
# geote-featureserv Up 2 minutes
# geote-nginx       Up 2 minutes
```

### Krok 7: Test že to funguje

```bash
# Test frontend (HTML/CSS/JS)
curl http://localhost/

# Test backend API
curl http://localhost:4000/

# Test pg_featureserv
curl http://localhost:9000/collections

# Měl bys vidět JSON odpovědi (ne 500 chybu!)
```

---

## 🌐 HTTPS Setup (Domain + SSL)

Máš HTTPS připraveno, tak jen nakonfiguruj Nginx:

### Varianta 1: Tailscale HTTPS (jednodušší)

Pokud chceš jen privátní přístup přes Tailscale:

```bash
# Tailscale má vestavěný HTTPS
# Přistupuješ přes:
https://100.95.250.20
```

### Varianta 2: Domain + Let's Encrypt (pokud je veřejné)

Pokud chceš `https://petrmikeska.cz`:

```bash
# 1. Nainstaluj Certbot
sudo apt install certbot python3-certbot-nginx

# 2. Vygeneruj SSL certifikát
sudo certbot certonly --standalone -d petrmikeska.cz -d www.petrmikeska.cz

# 3. Updatuj nginx.conf aby používal SSL
# (mohu ti to připravit, jestli chceš)

# 4. Restartuj Nginx
docker-compose restart nginx
```

---

## 🔍 Ověření že je vše v pořádku

### Health check

```bash
# Backend health
curl -v http://localhost:4000

# pg_featureserv health
curl -v http://localhost:9000/collections | head -20

# Frontend health
curl -v http://localhost/
```

### Logy - Debugging

```bash
# Logy všech služeb
docker-compose logs -f

# Jen backend
docker-compose logs -f backend

# Jen pg_featureserv
docker-compose logs -f featureserv

# Jen Nginx
docker-compose logs -f nginx

# Poslední 100 řádků
docker-compose logs --tail=100 backend
```

### Problémy s databází

```bash
# Zkontroluj, jestli se backend připojuje k databázi
docker-compose logs backend | grep -i "database\|postgre\|connection"

# Měl bys vidět: "✓ PostgreSQL connection OK"
```

---

## 📝 Běžné Příkazy

```bash
# Start všechny kontejnery
docker-compose up -d

# Stop všechny kontejnery (data se zachová!)
docker-compose down

# Restart jednoho kontejneru
docker-compose restart backend

#看 co běží
docker-compose ps

# Smazat vše (VAROVÁNÍ: veškerá data se smaže!)
docker-compose down -v

# Updatovat aplikaci (nový kód z GitHubu)
git pull
docker-compose build
docker-compose up -d
```

---

## 🔧 Údržba

### Aktualizace aplikace (nový kód)

```bash
# 1. Stáhni nejnovější kód z GitHubu
git pull

# 2. Rebuild Docker image
docker-compose build

# 3. Restartuj kontejnery (bez downtime)
docker-compose up -d

# 4. Ověř logy
docker-compose logs -f backend
```

### Zálohování databáze

```bash
# Backup databáze (soubor backup.sql)
PGPASSWORD=master pg_dump -h 100.95.250.20 -U postgres klima > backup.sql

# Restore z backupu
PGPASSWORD=master psql -h 100.95.250.20 -U postgres klima < backup.sql

# Kontrola velikosti backupu
ls -lh backup.sql
```

### Monitoring CPU/Memory

```bash
# Kolik RAM/CPU používá Docker
docker stats

# Spojitý monitoring
watch docker stats
```

---

## 🚨 Troubleshooting

### Chyba: "Cannot connect to database"

```bash
# Zkontroluj logy
docker-compose logs backend | tail -20

# Ověř, že je PostgreSQL opravdu na 100.95.250.20
ping 100.95.250.20

# Zkus se připojit ručně
PGPASSWORD=master psql -h 100.95.250.20 -U postgres -d klima -c "SELECT 1"

# Kdyby to nefungovalo:
# - PostgreSQL není na IP 100.95.250.20 (zkontroluj)
# - Firewall blokuje port 5432 (otevři port)
# - Heslo je špatné (zkontroluj)
```

### Chyba: "Port 80 already in use"

```bash
# Zjisti co používá port 80
sudo lsof -i :80

# Změní port v docker-compose.yml
# ports:
#   - "8080:80"

# Pak přistupuješ přes http://localhost:8080
```

### Chyba: "relation 'climate_results_cache' does not exist"

```bash
# Cache tabulka neexistuje, vytvoř ji:
PGPASSWORD=master psql -h 100.95.250.20 -U postgres -d klima -f backend/create-cache-table.sql

# Ověř, že existuje
PGPASSWORD=master psql -h 100.95.250.20 -U postgres -d klima -c "\dt climate_results_cache"
```

### Chyba: "relation 'orp' does not exist"

```bash
# Zkontroluj, jestli máš v databázi tabulky:
PGPASSWORD=master psql -h 100.95.250.20 -U postgres -d klima -c "\dt"

# Měl bys vidět:
# - climate_master_geom
# - orp
# - chko
# - climate_results_cache

# Pokud chybí, musíš je importovat ze shapefilů
```

### Kontejner se spouští a zase se vypíná

```bash
# Zkontroluj logy
docker-compose logs backend

# Hledej slovo "error" nebo "fatal"
docker-compose logs | grep -i error
```

---

## 📚 Dalších 5 minut na server

### SSH bez hesla (SSH key)

```bash
# Na svém notebooku vytvoř SSH key
ssh-keygen -t ed25519 -C "tvuj@email.com"

# Kopíruj veřejný klíč na server
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@100.95.250.20

# Teď se připojíš bez hesla
ssh user@100.95.250.20
```

### Automatické starty po restartu

```bash
# Docker Compose se automaticky restartne po restartu serveru
docker-compose up -d --restart unless-stopped

# Ověř, že je nastaveno
docker inspect geote-backend | grep -i "restart"
```

### Monitorování 24/7 (Uptime monitoring)

```bash
# V docker-compose.yml je healthcheck
# Můžeš používat externí monitoring:
# - Uptime Robot (free)
# - Better Stack (free tier)
# - StatusCake (free)

# Health endpoint
curl http://localhost/health

# Vrátí: "healthy" pokud je vše OK
```

---

## ✅ Checklist - Kontrola před Go Live

- [ ] Docker a Docker Compose nainstalované
- [ ] Projekt naklonován z GitHubu
- [ ] .env soubor vytvořen s DB_PASSWORD=master
- [ ] Frontend soubory zkopírovány do `frontend/`
- [ ] `docker-compose build` proběhlo bez chyb
- [ ] `docker-compose up -d` je spuštěno
- [ ] `docker-compose ps` ukazuje 3 běžící kontejnery
- [ ] `curl http://localhost/health` vrací "healthy"
- [ ] `curl http://localhost:4000` reaguje
- [ ] `curl http://localhost:9000/collections` vrací JSON
- [ ] Aplikace v prohlížeči běží na http://100.95.250.20
- [ ] Logy nemají chyby: `docker-compose logs`
- [ ] PostgreSQL je přístupná: `PGPASSWORD=master psql -h 100.95.250.20 -U postgres -d klima -c "SELECT 1"`

---

## 🎯 Next Steps

Až to bude na serveru, můžeš:

1. **HTTPS setup** - Nakonfiguruj SSL certifikát pro `petrmikeska.cz`
2. **Tailscale firewall** - Nastav kdo má přístup (jen tvoje IP?)
3. **Monitoring** - Nastav alerting jestli web padne
4. **Backup** - Automatizuj daily backupy databáze
5. **CI/CD** - GitHub Actions pro automatic deployement (pokud chceš)

---

## 📞 Otázky?

Postup po kroku:

1. **SSH na server** - `ssh user@100.95.250.20`
2. **Instalace Docker** - Spustit instalační script
3. **Projekt** - `git clone ...`
4. **Environment** - Vytvořit `.env`
5. **Frontend** - Zkopírovat soubory
6. **Build** - `docker-compose build`
7. **Deploy** - `docker-compose up -d`
8. **Test** - `curl http://localhost/`

**Zkoušej krok za krokem a řekni co se nestane!** 🚀

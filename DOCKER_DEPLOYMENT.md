# Docker Deployment Guide - GEOTE Climate UI

## 🐳 Co je Docker? (Vysvětlení)

Docker je jako **virtuální počítač v krabici**:
- **Bez Dockeru:** Aplikace závisí na tom, co máš nainstalované na serveru
- **S Dockerem:** Aplikace má všechno, co potřebuje, v jedné "krabici" (image)
- **Výhody:** Stejně běží na tvém notebooku, na testovacím serveru, i v produkci

**Klíčové pojmy:**
- **Image** = Blueprint (jako recept, instructions)
- **Container** = Běžící instance (jako upečený dort)
- **docker-compose** = Orchestrator (spravuje více containerů najednou)

---

## 📋 Prerequisite - Co potřebuješ na serveru

```bash
# Na Ubuntu serveru si nainstaluj Docker a Docker Compose:

# 1. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. Add user to docker group (aby jsi nemusel sudo)
sudo usermod -aG docker $USER
newgrp docker

# 3. Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 4. Verify installation
docker --version
docker-compose --version
```

---

## 🚀 Deployment kroky (Krok za krokem)

### Krok 1: Příprava na serveru

```bash
# SSH do svého serveru
ssh user@petrmikeska.cz

# Vytvoř adresář pro projekt
mkdir -p ~/projects/geote-klima-ui
cd ~/projects/geote-klima-ui

# Stáhni projekt z GitHubu
git clone https://github.com/MetrPikeska/geote-klima-ui.git .

# Nebo pokud máš SSH key:
git clone git@github.com:MetrPikeska/geote-klima-ui.git .
```

### Krok 2: Vytvoř .env soubor

```bash
# Vytvoř soubor s databázovými údaji
cat > .env << EOF
DB_PASSWORD=master
NODE_ENV=production
EOF

# Alternativně přímou úpravou:
# nano .env
# (pak do souboru napiš: DB_PASSWORD=master)
```

**⚠️ DŮLEŽITÉ:** `.env` soubor je v `.gitignore`, takže se nepushne na GitHub (správně!)

### Krok 3: Zkopíruj frontend do správné cesty

```bash
# Vytvoř frontend adresář pro Nginx
mkdir -p frontend

# Zkopíruj frontend soubory
cp index.html frontend/
cp -r css js frontend/
# (Nginx je bude servírovat)
```

### Krok 4: Build a spuštění Docker containerů

```bash
# Build backend image (vytvoří "krabici" s Node.js)
docker-compose build

# Spusti všechny služby (backend, pg_featureserv, nginx)
docker-compose up -d

# Zkontroluj, že všechno běží
docker-compose ps
```

**Očekávaný výstup:**
```
NAME                    STATUS
geote-backend          Up (healthy)
geote-featureserv      Up
geote-nginx            Up
```

### Krok 5: Ověř funkčnost

```bash
# Zkontroluj backend
curl http://localhost:4000

# Zkontroluj pg_featureserv
curl http://localhost:9000/collections

# Zkontroluj Nginx (frontend)
curl http://localhost/
```

---

## 📝 Běžné Docker příkazy (Cheat Sheet)

```bash
# Spusti kontejnery na pozadí (-d = detach)
docker-compose up -d

# Zastavi všechny kontejnery
docker-compose down

# Sleduj logy v reálném čase
docker-compose logs -f backend

# Logy jen z jedné služby
docker-compose logs -f featureserv

# Restartuj službu
docker-compose restart backend

# Výstup statusu všech služeb
docker-compose ps

# Smaž všechny kontejnery, sítě, ale nikoli data
docker-compose down

# Přistup do běžícího kontejneru (jako SSH)
docker-compose exec backend bash
```

---

## 🔗 Tailscale Setup (Privátní síť)

Pokud chceš, aby aplikace byla přístupná **pouze přes Tailscale**:

```bash
# 1. Na serveru nainstaluj Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# 2. Připoj server k tvé Tailscale síti
sudo tailscale up

# 3. Zkopíruj IP adresu (bude vypadat jako 100.x.x.x)

# 4. V docker-compose.yml uprav porty:
# ports:
#   - "100.x.x.x:80:80"  (Nginx naslouchá jen na Tailscale IP)
```

---

## 🌐 HTTPS s Tailscale (nebo vlastním SSL)

### Varianta 1: Tailscale s HTTPS (nejjednodušší)

```bash
# Tailscale má vestavěný HTTPS
# Jednoduše přistup přes:
https://tvoje-tailscale-ip
```

### Varianta 2: Let's Encrypt (pokud je veřejná)

```bash
# Nainstaluj Certbot
sudo apt install certbot python3-certbot-nginx

# Vygeneruj certifikát
sudo certbot certonly --standalone -d petrmikeska.cz

# Upravi nginx.conf aby používal SSL
# (mohu ti to připravit, pokud chceš)
```

---

## 📊 Logování a Monitoring

```bash
# Sleduj logy všech služeb
docker-compose logs -f

# Jen poslední 50 řádků
docker-compose logs --tail=50 backend

# Exportuj logy do souboru
docker-compose logs > deployment.log

# Zkontroluj resource usage (CPU, memory)
docker stats
```

---

## 🔧 Údržba a Updates

### Aktualizace aplikace

```bash
# 1. Stáhni nejnovější kód
git pull

# 2. Rebuild image
docker-compose build

# 3. Restartuj (bez downtime, pokud je reverse proxy)
docker-compose up -d

# 4. Ověř, že je stále online
curl http://localhost/health
```

### Zálohování databáze

```bash
# Backup PostgreSQL (na tvém serveru 192.168.34.11)
PGPASSWORD=master pg_dump -h 192.168.34.11 -U postgres klima > backup.sql

# Restore
PGPASSWORD=master psql -h 192.168.34.11 -U postgres klima < backup.sql
```

---

## 🚨 Troubleshooting

### Kontejner se spouští, ale zase se vypíná

```bash
# Zkontroluj logy
docker-compose logs backend

# Běžné chyby:
# - "Cannot connect to database" = PostgreSQL IP/heslo špatně
# - "Module not found" = npm install selhal v Dockerfile
```

### Port 80 už používá jiná služba

```bash
# Zkontroluj, co používá port 80
sudo lsof -i :80

# Změň port v docker-compose.yml
ports:
  - "8080:80"  # Nginx bude na 8080

# Pak přistupuj: http://localhost:8080
```

### Kontejnery nevidí PostgreSQL na hostu

```bash
# V docker-compose.yml musíš používat:
DB_HOST: host.docker.internal  # Toto je speciální hostname

# Na Linuxu to někdy nefunguje, pak použij:
DB_HOST: 192.168.34.11  # Přímá IP adresa
```

---

## 📚 Další resources

- [Docker dokumentace](https://docs.docker.com/)
- [Docker Compose reference](https://docs.docker.com/compose/compose-file/)
- [Nginx proxy docs](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)

---

## ✅ Checklist před production

- [ ] `.env` je vytvořen se správným heslem
- [ ] Všechny porty jsou otevřené/firewalled jak je potřeba
- [ ] PostgreSQL je přístupná z Dockeru (testován `docker-compose exec backend psql ...`)
- [ ] Frontend soubory jsou v `frontend/` adresáři
- [ ] Kontejnery startují bez chyb (`docker-compose up -d`)
- [ ] Health check úspěšný (`curl http://localhost/health`)
- [ ] Logy jsou sledovatelné (`docker-compose logs -f`)
- [ ] Tailscale je nakonfigurován (pokud chceš privátní síť)

---

**Máš-li otázky, řekni!** 🚀

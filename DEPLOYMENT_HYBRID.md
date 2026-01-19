# 🚀 Hybrid Deployment - Frontend na Wedos, Backend na Tvém Serveru

## 📊 Architektura

```
┌──────────────────────────────────────┐
│ Wedos Hosting                        │
│ https://petrmikeska.cz               │
│                                      │
│  Frontend (jen statické soubory):   │
│  ✓ index.html                        │
│  ✓ css/style.css                     │
│  ✓ js/*.js                           │
│  ✓ config.production.js              │
└──────────────────────────────────────┘
            │ API volání přes
            │ Tailscale network
            ↓
┌──────────────────────────────────────┐
│ Tvůj Server (100.95.250.20)          │
│                                      │
│  Backend services:                   │
│  ✓ Node.js (port 4000)               │
│  ✓ pg_featureserv (port 9000)        │
│  ✓ PostgreSQL + PostGIS (5432)       │
└──────────────────────────────────────┘
```

---

## ✅ Výhody tohoto setupu

- **Frontend na Wedos** = Rychlé načítání, použití toho co máš
- **Backend na tvém serveru** = Plná kontrola, neplatíš extra
- **Tailscale** = Bezpečné připojení (jen ty můžeš použít)
- **Žádný Docker na Wedos** = Nemusíš nic řešit s hostingem

---

## 🎯 ČÁST 1: Backend na Tvém Serveru

### Krok 1: SSH na server

```bash
ssh metr@100.95.250.20
# nebo přes lokální IP:
ssh metr@192.168.34.11
```

### Krok 2: Nainstaluj Node.js (pokud nemáš)

```bash
# Zkontroluj verzi Node.js
node --version

# Pokud nemáš, nebo máš starou verzi:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Ověř instalaci
node --version  # Měl bys vidět v18.x.x
npm --version
```

### Krok 3: Clone projektu nebo upload souborů

**Varianta A: Git clone (doporučuji)**

```bash
cd ~
git clone https://github.com/MetrPikeska/geote-klima-ui.git
cd geote-klima-ui
```

**Varianta B: rsync z tvého notebooku**

```bash
# Na tvém notebooku (ne na serveru):
rsync -avz ~/projects/geote-klima-ui/ metr@100.95.250.20:~/geote-klima-ui/
```

### Krok 4: Nastav .env

```bash
cd ~/geote-klima-ui/backend

# Vytvoř .env soubor
cat > .env << 'EOF'
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=master
DB_NAME=klima
PORT=4000
NODE_ENV=production
EOF

# Ověř
cat .env
```

### Krok 5: Nainstaluj závislosti

```bash
cd ~/geote-klima-ui/backend
npm install

# Ověř že je vše OK
ls node_modules/
```

### Krok 6: Vytvoř cache tabulku (pokud neexistuje)

```bash
cd ~/geote-klima-ui/backend

# Vytvoř cache tabulku
PGPASSWORD=master psql -h localhost -U postgres -d klima -f create-cache-table.sql

# Ověř že existuje
PGPASSWORD=master psql -h localhost -U postgres -d klima -c "\dt climate_results_cache"
```

### Krok 7: Test backend lokálně

```bash
cd ~/geote-klima-ui/backend
node server.js

# Měl bys vidět:
# 🔍 Testing database connection...
# ✓ Database connected successfully
# ✓ PostgreSQL connection OK
# Backend běží na http://localhost:4000
```

**Nech to běžet a otevři nové SSH okno pro další kroky.**

### Krok 8: Spusť backend na pozadí

```bash
# Ukončni předchozí server (Ctrl+C)

# Spusť na pozadí s nohup
cd ~/geote-klima-ui/backend
nohup node server.js > logs/backend.log 2>&1 &

# Ulož PID
echo $! > logs/backend.pid

# Ověř že běží
tail -f logs/backend.log
# Měl bys vidět "Backend běží na http://localhost:4000"

# Ctrl+C pro stop sledování logů (backend dál běží)
```

### Krok 9: Spusť pg_featureserv

```bash
cd ~/geote-klima-ui/pg-featureserv

# Pokud nemáš binary, stáhni ho:
wget https://github.com/CrunchyData/pg_featureserv/releases/download/v1.3.1/pg_featureserv_1.3.1_linux_amd64.tar.gz
tar -xzf pg_featureserv_1.3.1_linux_amd64.tar.gz
chmod +x pg_featureserv
rm pg_featureserv_1.3.1_linux_amd64.tar.gz

# Ověř config (měl by mít správný connection string)
cat config/pg_featureserv.toml | grep DbConnection
# Mělo by být: DbConnection = "postgresql://postgres:master@192.168.34.11:5432/klima"

# Spusť na pozadí
nohup ./pg_featureserv serve > ../logs/pg-featureserv.log 2>&1 &
echo $! > ../logs/pg-featureserv.pid

# Ověř
tail -f ../logs/pg-featureserv.log
# Měl bys vidět "Serving HTTP at http://0.0.0.0:9000"

# Ctrl+C pro stop sledování
```

### Krok 10: Otevři porty v firewallu (DŮLEŽITÉ!)

```bash
# Zkontroluj firewall
sudo ufw status

# Povolit porty pro Tailscale network
sudo ufw allow from 100.0.0.0/8 to any port 4000
sudo ufw allow from 100.0.0.0/8 to any port 9000

# Nebo pokud chceš jen z tvé lokální sítě:
sudo ufw allow from 192.168.0.0/16 to any port 4000
sudo ufw allow from 192.168.0.0/16 to any port 9000

# Ověř pravidla
sudo ufw status numbered
```

### Krok 11: Test že backend je přístupný z Tailscale

```bash
# Na tvém notebooku (přes Tailscale):
curl http://100.95.250.20:4000

# Měl bys dostat nějakou odpověď (ne Connection refused)

# Test pg_featureserv
curl http://100.95.250.20:9000/collections | head -20
```

---

## 🌐 ČÁST 2: Frontend na Wedos

### Krok 1: Připrav produkční frontend

Na tvém notebooku:

```bash
cd ~/projects/geote-klima-ui

# Vytvoř production folder
mkdir -p wedos-upload
cd wedos-upload

# Zkopíruj frontend soubory
cp ../index.html .
cp -r ../css .
cp -r ../js .

# IMPORTANT: Edituj index.html a aktivuj production config
nano index.html

# Najdi tento řádek (kolem řádku 148):
# <!-- <script src="./js/config.production.js"></script> -->

# Odkomentuj ho (smaž <!-- a -->):
# <script src="./js/config.production.js"></script>

# Ulož (Ctrl+X, Y, Enter)
```

### Krok 2: Upload na Wedos (FTP)

**Varianta A: FileZilla (GUI)**

1. Otevři FileZilla
2. Připoj se k Wedos FTP:
   - Host: ftp.petrmikeska.cz (nebo podle Wedos dokumentace)
   - Username: tvoje_ftp_uzivatelske_jmeno
   - Password: tvoje_ftp_heslo
   - Port: 21

3. Nahraj soubory:
   - Vlevo: `~/projects/geote-klima-ui/wedos-upload/*`
   - Vpravo: `/www/` (nebo kde máš root webu)

4. Upload:
   - `index.html`
   - `css/` (celý adresář)
   - `js/` (celý adresář)

**Varianta B: SFTP/SCP (command line)**

```bash
# Z tvého notebooku
cd ~/projects/geote-klima-ui/wedos-upload

# Upload přes SCP (pokud Wedos podporuje)
scp -r * ftp_user@petrmikeska.cz:/www/

# Nebo přes LFTP
lftp -u ftp_user,ftp_heslo ftp.petrmikeska.cz
> cd /www
> mirror -R .
> exit
```

### Krok 3: Test frontendu

1. Otevři prohlížeč
2. Jdi na: `https://petrmikeska.cz`
3. Otevři Developer Tools (F12)
4. Podívej se do Console
   - Hledej chyby jako "CORS" nebo "Failed to fetch"

---

## 🔧 ČÁST 3: Troubleshooting

### Chyba: "Failed to fetch" nebo "CORS error"

**Příčina:** Backend nepovoluje request z tvé domény

**Řešení:**

```bash
# Na serveru edituj backend/server.js
nano ~/geote-klima-ui/backend/server.js

# Zkontroluj že v corsOptions je tvoje doména:
origin: [
  'https://petrmikeska.cz',
  'http://petrmikeska.cz',
  // ...
],

# Restartuj backend
pkill -f "node server.js"
cd ~/geote-klima-ui/backend
nohup node server.js > logs/backend.log 2>&1 &
```

### Chyba: "Connection refused"

**Příčina:** Firewall blokuje porty nebo služby neběží

**Řešení:**

```bash
# Zkontroluj že backend běží
ps aux | grep "node server.js"

# Zkontroluj že pg_featureserv běží
ps aux | grep pg_featureserv

# Zkontroluj firewall
sudo ufw status

# Test z lokálního serveru
curl http://localhost:4000
curl http://localhost:9000/collections
```

### Chyba: Frontend načte, ale dropdown menu prázdné

**Příčina:** pg_featureserv není přístupný nebo CORS chyba

**Řešení:**

```bash
# Zkontroluj logy pg_featureserv
tail -f ~/geote-klima-ui/logs/pg-featureserv.log

# Test přístupnosti
curl http://100.95.250.20:9000/collections/public.orp/items?limit=1
```

### Chyba: "relation 'climate_results_cache' does not exist"

```bash
# Vytvoř cache tabulku
cd ~/geote-klima-ui/backend
PGPASSWORD=master psql -h localhost -U postgres -d klima -f create-cache-table.sql
```

---

## 🔄 Údržba a Updaty

### Update backendu (nový kód)

```bash
# SSH na server
ssh metr@100.95.250.20

# Stáhni nový kód
cd ~/geote-klima-ui
git pull

# Restart backendu
pkill -f "node server.js"
cd backend
nohup node server.js > logs/backend.log 2>&1 &
```

### Update frontendu

```bash
# Na notebooku
cd ~/projects/geote-klima-ui
git pull

# Zkopíruj do wedos-upload
cp index.html css js -r wedos-upload/

# Upload na Wedos (FTP/FileZilla)
```

---

## 🎯 Automatizace s Scriptem

Vytvoř helper script pro start/stop služeb:

```bash
# Na serveru vytvoř ~/geote-start.sh
cat > ~/geote-start.sh << 'EOF'
#!/bin/bash
cd ~/geote-klima-ui

# Start backend
cd backend
nohup node server.js > logs/backend.log 2>&1 &
echo $! > logs/backend.pid
echo "✓ Backend started (PID: $(cat logs/backend.pid))"
cd ..

# Start pg_featureserv
cd pg-featureserv
nohup ./pg_featureserv serve > ../logs/pg-featureserv.log 2>&1 &
echo $! > ../logs/pg-featureserv.pid
echo "✓ pg_featureserv started (PID: $(cat ../logs/pg-featureserv.pid))"
cd ..

echo "✓ Services started"
echo "Backend: http://100.95.250.20:4000"
echo "pg_featureserv: http://100.95.250.20:9000"
EOF

chmod +x ~/geote-start.sh

# Stop script
cat > ~/geote-stop.sh << 'EOF'
#!/bin/bash
cd ~/geote-klima-ui

# Stop backend
if [ -f logs/backend.pid ]; then
  kill $(cat logs/backend.pid)
  rm logs/backend.pid
  echo "✓ Backend stopped"
fi

# Stop pg_featureserv
if [ -f logs/pg-featureserv.pid ]; then
  kill $(cat logs/pg-featureserv.pid)
  rm logs/pg-featureserv.pid
  echo "✓ pg_featureserv stopped"
fi
EOF

chmod +x ~/geote-stop.sh
```

**Použití:**

```bash
# Start
~/geote-start.sh

# Stop
~/geote-stop.sh
```

---

## ✅ Checklist - Kontrola že vše funguje

### Backend server:
- [ ] Backend běží: `ps aux | grep "node server.js"`
- [ ] pg_featureserv běží: `ps aux | grep pg_featureserv`
- [ ] Backend odpovídá: `curl http://100.95.250.20:4000`
- [ ] pg_featureserv odpovídá: `curl http://100.95.250.20:9000/collections`
- [ ] Firewall povoluje porty 4000, 9000
- [ ] Cache tabulka existuje: `psql -c "\dt climate_results_cache"`

### Frontend (Wedos):
- [ ] `index.html` nahráno na Wedos
- [ ] `css/` adresář nahráno
- [ ] `js/` adresář nahráno  
- [ ] `config.production.js` aktivován v index.html
- [ ] Web načte: https://petrmikeska.cz
- [ ] Dropdown menu ORP/CHKO se naplní (F12 → Network)
- [ ] Výpočet funguje (tlačítko Calculate)

---

## 🚀 Hotovo!

Máš hybrid setup:
- **Frontend** = Wedos (statické soubory, rychlé)
- **Backend** = Tvůj server (výpočty, databáze)
- **Tailscale** = Bezpečné propojení

**URL:** https://petrmikeska.cz  
**API:** http://100.95.250.20:4000 (přes Tailscale)

Kdyby něco nefungovalo, řekni mi jakou chybu vidíš! 🎯

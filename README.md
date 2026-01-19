# GEOTE Climate UI

![GitHub last commit](https://img.shields.io/github/last-commit/MetrPikeska/geote-klima-ui)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

> A professional web-based GIS application for analyzing and visualizing climate indicators across the Czech Republic using PostGIS spatial analysis and interactive mapping.

---

## 📋 Project Overview

**GEOTE Climate UI** is a full-stack geospatial web application designed for analyzing climate data across administrative units and custom geographic regions. Built as part of a university geoinformatics project, it demonstrates advanced GIS development skills including PostGIS spatial queries, OGC API Features integration, and interactive web mapping.

This application enables users to:
- Analyze climate indicators for predefined administrative units (ORP, CHKO) or custom-drawn polygons
- Calculate and visualize climate indices (De Martonne Aridity Index, Potential Evapotranspiration)
- Compare historical climate normals with future projections
- Interact with dynamic maps and charts for data exploration

**Target Users:** GIS professionals, climate researchers, environmental planners, and students studying geoinformatics.

---

## ✨ Key Features

### 🗺️ **Advanced Spatial Analysis**
- **Flexible Area Selection:** Choose from predefined administrative boundaries (ORP - Municipalities with Extended Powers, CHKO - Protected Landscape Areas) or draw custom polygons
- **PostGIS Integration:** Server-side spatial queries for efficient processing of large climate datasets
- **Projection Support:** Native EPSG:5514 (S-JTSK / Krovak East North) coordinate system

### 📊 **Climate Indicators**
- **De Martonne Aridity Index:** Assess moisture availability and drought risk
- **Potential Evapotranspiration (Thornthwaite):** Calculate water demand for vegetation
- **Multiple Climate Normals:**
  - Old Normal (pre-1990 baseline)
  - New Normal (1991-2020)
  - Prediction 2050 (2041+ projections)

### 🎨 **Interactive Visualization**
- **Leaflet.js Map Interface:** Pan, zoom, and draw custom analysis areas
- **Dynamic Charts:** Interactive line graphs powered by Chart.js
- **Real-time Results:** Instant tabular and graphical feedback

### ⚡ **Performance Optimization**
- Database caching for repeated queries
- Batch processing support for multiple geometries
- Pre-calculated indices stored in PostgreSQL

---

## 🛠️ Technology Stack

### **Frontend**
- Vanilla JavaScript (ES6 modules)
- [Leaflet.js](https://leafletjs.com/) - Interactive mapping
- [Leaflet.draw](https://leaflet.github.io/Leaflet.draw/) - Polygon drawing tools
- [Chart.js](https://www.chartjs.org/) - Data visualization
- HTML5 / CSS3

### **Backend**
- [Node.js](https://nodejs.org/) with [Express.js](https://expressjs.com/)
- PostgreSQL connection pooling
- CORS and body-parser middleware
- Environment-based configuration

### **Database & Geospatial Services**
- [PostgreSQL](https://www.postgresql.org/) 12+ with [PostGIS](https://postgis.net/) extension
- [pg_featureserv](https://github.com/CrunchyData/pg_featureserv) - OGC API Features server
- Spatial data in EPSG:5514 coordinate system

---

## 🚀 Quick Start (Linux / Ubuntu)

### Prerequisites

- **Ubuntu 22.04+** (or similar Debian-based system)
- **Node.js 16+** with npm
- **PostgreSQL 12+** with PostGIS extension
- **Git** for cloning the repository

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/MetrPikeska/geote-klima-ui.git
cd geote-klima-ui

# 2. Install backend dependencies
cd backend && npm install && cd ..

# 3. Configure environment variables
cd backend && cp .env.example .env && cd ..
nano backend/.env  # Edit with your PostgreSQL credentials

# 4. Download pg_featureserv (Linux binary)
cd pg-featureserv && \
  wget https://github.com/CrunchyData/pg_featureserv/releases/download/v1.3.1/pg_featureserv_1.3.1_linux_amd64.tar.gz && \
  tar -xzf pg_featureserv_1.3.1_linux_amd64.tar.gz && \
  chmod +x pg_featureserv && \
  rm pg_featureserv_1.3.1_linux_amd64.tar.gz && \
  cd ..

# 5. Configure pg_featureserv database connection
nano pg-featureserv/config/pg_featureserv.toml
# Update DbConnection with your PostgreSQL credentials

# 6. Start all services
./start.sh

# 7. Open frontend in browser
xdg-open index.html
```

### Verify Installation

After running `./start.sh`, you should see:
```
✓ Backend started (PID: xxxxx)
✓ pg_featureserv started (PID: xxxxx)
```

Access points:
- **Frontend:** Open `index.html` in your browser
- **Backend API:** http://localhost:4000
- **pg_featureserv:** http://localhost:9000

---

## ⚙️ Configuration

### Environment Variables (`backend/.env`)

```env
# Database Configuration
DB_HOST=localhost          # PostgreSQL host (use IP for remote servers)
DB_PORT=5432              # PostgreSQL port
DB_USER=postgres          # Database user
DB_PASSWORD=your_password  # ⚠️ CHANGE THIS!
DB_NAME=klima             # Database name

# Server Configuration
PORT=4000                 # Backend API port
NODE_ENV=development      # development | production
```

**Important:** 
- Never commit `.env` to version control
- Use `.env.example` as a template
- Ensure PostgreSQL user has SELECT permissions on spatial tables

### pg_featureserv Configuration (`pg-featureserv/config/pg_featureserv.toml`)

```toml
[Database]
DbConnection = "postgresql://postgres:your_password@localhost:5432/klima"

[Server]
HttpPort = 9000
HttpHost = "0.0.0.0"

[Paging]
LimitDefault = 10000
LimitMax = 10000
```

**For Remote PostgreSQL:**
- Update `DB_HOST` in `backend/.env` to server IP
- Update `DbConnection` in `pg_featureserv.toml` with server IP
- Ensure PostgreSQL allows remote connections (`postgresql.conf`, `pg_hba.conf`)

---

## 🐧 Linux Deployment

### Background Services (Development)

The provided scripts use `nohup` to run services in the background:

```bash
# Start services
./start.sh

# View logs in real-time
tail -f logs/backend.log
tail -f logs/pg-featureserv.log

# Stop services
./stop.sh
```

### Production Deployment with systemd

For production servers, use systemd service files:

#### Backend Service (`/etc/systemd/system/geote-backend.service`)

```ini
[Unit]
Description=GEOTE Climate UI Backend
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/geote-klima-ui/backend
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### pg_featureserv Service (`/etc/systemd/system/pg-featureserv.service`)

```ini
[Unit]
Description=pg_featureserv OGC API Features Server
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/geote-klima-ui/pg-featureserv
ExecStart=/var/www/geote-klima-ui/pg-featureserv/pg_featureserv serve
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### Enable and Start Services

```bash
sudo systemctl daemon-reload
sudo systemctl enable geote-backend pg-featureserv
sudo systemctl start geote-backend pg-featureserv
sudo systemctl status geote-backend pg-featureserv
```

### Nginx Reverse Proxy (Optional)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /var/www/geote-klima-ui;
        index index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:4000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # pg_featureserv
    location /features/ {
        proxy_pass http://localhost:9000/;
        proxy_set_header Host $host;
    }
}
```

---

## 🪟 Windows Setup (Legacy Support)

### Prerequisites
- Node.js 16+
- PostgreSQL 12+ with PostGIS

### Quick Start

```batch
REM 1. Install dependencies
cd backend
npm install
cd ..

REM 2. Configure .env file
cd backend
copy .env.example .env
notepad .env
cd ..

REM 3. Start services
start.bat

REM 4. Stop services
stop.bat
```

**Note:** Windows setup uses pre-compiled `pg_featureserv.exe` included in the repository.

---

## 🗄️ Database Architecture

### Master Table: `climate_master_geom`

The core spatial table containing:
- **Geometry:** MultiPolygon in EPSG:5514
- **Climate Variables:** Monthly temperature, precipitation, humidity, wind speed
- **Pre-calculated Indices:** De Martonne, PET (Thornthwaite)
- **Temporal Coverage:** Historical data (pre-1990), new normals (1991-2020), predictions (2041+)

### Derived Tables
- **orp:** Municipalities with Extended Powers (aggregated from climate_master_geom)
- **chko:** Protected Landscape Areas (aggregated)

### Database Requirements

1. **PostgreSQL 12+ with PostGIS:**
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```

2. **Database Name:** `klima` (or update `.env` / `pg_featureserv.toml`)

3. **User Permissions:**
   ```sql
   GRANT SELECT ON climate_master_geom TO your_user;
   GRANT SELECT ON orp TO your_user;
   GRANT SELECT ON chko TO your_user;
   ```

---

## 📖 Usage Guide

### 1. Select Analysis Area

**Option A: Predefined Units**
- Select "ORP" or "CHKO" from the dropdown
- Choose a specific administrative unit

**Option B: Custom Polygon**
- Click the polygon drawing tool (⬟) on the map
- Draw your area of interest by clicking points
- Complete the polygon by clicking the first point again

### 2. Configure Analysis

- **Reference Normal:** Choose climate period (Old Normal / New Normal / Prediction 2050)
- **Climate Indicator:** Select De Martonne or PET

### 3. Calculate & Visualize

Click **"Calculate"** to:
- Perform server-side spatial query
- Display results in table (left panel)
- Show interactive chart (right panel)
- View summary statistics (top-right box)

---

## 📁 Project Structure

```
geote-klima-ui/
├── index.html                  # Main application entry point
├── start.sh                    # Linux start script
├── stop.sh                     # Linux stop script
├── start.bat                   # Windows start script
├── stop.bat                    # Windows stop script
├── README.md                   # This file
├── SECURITY_IMPROVEMENTS.md    # Security documentation
├── CACHING_IMPLEMENTATION.md   # Caching strategy docs
├── backend/
│   ├── server.js              # Express API server
│   ├── db.js                  # PostgreSQL connection pool
│   ├── package.json           # Node dependencies
│   ├── .env.example           # Environment template
│   └── .env                   # Local config (gitignored)
├── css/
│   └── style.css              # Application styles
├── js/
│   ├── api.js                 # API communication layer
│   ├── compute.js             # Climate calculations
│   ├── charts.js              # Chart.js integration
│   ├── map.js                 # Leaflet map setup
│   └── ui.js                  # UI event handlers
├── pg-featureserv/
│   ├── pg_featureserv         # Linux binary (download separately)
│   ├── pg_featureserv.exe     # Windows binary (included)
│   └── config/
│       └── pg_featureserv.toml # Server configuration
├── logs/                       # Runtime logs (created by start.sh)
│   ├── backend.log
│   └── pg-featureserv.log
└── databaze_ready/             # Shapefiles for import
    ├── climate_master_geom.*
    ├── chko.*
    └── orp.*
```

---

## 🔒 Security Best Practices

### ✅ Implemented Security Features

- **Environment Variables:** All credentials stored in `.env` (gitignored)
- **Input Validation:** Geometry data validated before processing
- **Error Handling:** Comprehensive error messages without exposing internals
- **Connection Pooling:** Prevents resource exhaustion
- **CORS Configuration:** Controlled cross-origin access

### 🛡️ Security Checklist

- [ ] `.env` file excluded from git (verify with `git status`)
- [ ] PostgreSQL password changed from default
- [ ] Remote PostgreSQL uses SSL/TLS (production)
- [ ] Firewall rules restrict database access (production)
- [ ] Regular security updates for Node.js and PostgreSQL

See [SECURITY_IMPROVEMENTS.md](SECURITY_IMPROVEMENTS.md) for detailed documentation.

---

## 🐛 Troubleshooting

### Database Connection Fails

```bash
# Test PostgreSQL connectivity
psql -h localhost -U postgres -d klima -c "SELECT PostGIS_Version();"

# Check backend logs
tail -f logs/backend.log

# Verify .env configuration
cat backend/.env
```

**Common Issues:**
- Incorrect password in `.env`
- PostgreSQL not running: `sudo systemctl status postgresql`
- PostGIS not installed: `CREATE EXTENSION postgis;`

### pg_featureserv Won't Start

```bash
# Check binary permissions
ls -l pg-featureserv/pg_featureserv

# Make executable if needed
chmod +x pg-featureserv/pg_featureserv

# Test manually
cd pg-featureserv
./pg_featureserv serve

# Check configuration
cat config/pg_featureserv.toml
```

### Frontend Shows "Network Error"

1. Verify backend is running: `curl http://localhost:4000`
2. Check pg_featureserv: `curl http://localhost:9000`
3. Review browser console for CORS errors
4. Ensure ports 4000 and 9000 are not blocked

---

## 🎓 Academic & Portfolio Context

This project was developed for the GEOTE course (Department of Geoinformatics, Winter Semester 2025) and demonstrates:

### **GIS Development Skills**
- PostGIS spatial analysis and SQL optimization
- OGC API Features implementation
- Coordinate system transformations (EPSG:5514)
- Spatial indexing and query performance tuning

### **Full-Stack Development**
- RESTful API design with Express.js
- Asynchronous JavaScript (Promises, async/await)
- Client-server architecture
- Environment-based configuration management

### **Geospatial Web Development**
- Leaflet.js integration and customization
- Dynamic data visualization with Chart.js
- Interactive drawing tools (Leaflet.draw)
- Responsive UI design

### **DevOps & Deployment**
- Linux server configuration
- Process management (systemd, nohup)
- Environment variable security
- Reverse proxy setup (Nginx)

---

## 📜 License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2025 Petr Mikeška

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Areas for Contribution:**
- Additional climate indicators
- Performance optimizations
- Enhanced visualizations
- Docker containerization
- Internationalization (i18n)

---

## 🙏 Acknowledgments

- **Climate Data:** Provided by the Department of Geoinformatics
- **PostgreSQL/PostGIS:** Open-source spatial database foundation
- **pg_featureserv:** Crunchy Data's excellent OGC API implementation
- **Leaflet.js Community:** Extensive mapping ecosystem
- **Chart.js Developers:** Beautiful, accessible charts

---

## 📧 Contact

**Petr Mikeška**  
GitHub: [@MetrPikeska](https://github.com/MetrPikeska)

For questions, suggestions, or collaboration opportunities, please open an issue on GitHub.

---

## 🗺️ Roadmap

### Planned Features
- [ ] Docker containerization for easier deployment
- [ ] Additional climate indices (Palmer Drought Index, SPEI)
- [ ] Time-series animation for climate change visualization
- [ ] Export results to GeoJSON/CSV
- [ ] User authentication for saved analyses
- [ ] Mobile-responsive interface improvements

### Future Enhancements
- Integration with real-time weather APIs
- Machine learning predictions for climate trends
- Multi-language support (Czech/English)
- Accessibility (WCAG 2.1 compliance)

---

**Last Updated:** January 2026  
**Version:** 1.0.0

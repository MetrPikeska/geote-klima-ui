# pg_featureserv Setup for Linux

This guide provides Linux-specific instructions for setting up and running pg_featureserv with the GEOTE Climate UI project.

## What is pg_featureserv?

pg_featureserv is a lightweight OGC API Features server that provides a RESTful interface to PostGIS spatial tables. It automatically exposes your spatial data as web services without writing any code.

**Official Repository:** https://github.com/CrunchyData/pg_featureserv

---

## Installation on Linux

### Option 1: Download Pre-built Binary (Recommended)

```bash
# Navigate to pg-featureserv directory
cd pg-featureserv

# Download latest release (adjust version as needed)
wget https://github.com/CrunchyData/pg_featureserv/releases/download/v1.3.1/pg_featureserv_1.3.1_linux_amd64.tar.gz

# Extract the binary
tar -xzf pg_featureserv_1.3.1_linux_amd64.tar.gz

# Make it executable
chmod +x pg_featureserv

# Clean up archive
rm pg_featureserv_1.3.1_linux_amd64.tar.gz

# Verify installation
./pg_featureserv --version
```

### Option 2: Build from Source

```bash
# Requires Go 1.16+
git clone https://github.com/CrunchyData/pg_featureserv.git
cd pg_featureserv
go build
chmod +x pg_featureserv
```

---

## Configuration

### 1. Database Connection String

Edit `pg-featureserv/config/pg_featureserv.toml`:

```toml
[Database]
# Format: postgresql://username:password@host:port/database
DbConnection = "postgresql://postgres:your_password@localhost:5432/klima"
```

**For Remote PostgreSQL:**
```toml
DbConnection = "postgresql://postgres:your_password@192.168.34.11:5432/klima"
```

**Using Environment Variable (Alternative):**
```bash
export DATABASE_URL="postgresql://postgres:your_password@localhost:5432/klima"
./pg_featureserv serve
```

### 2. Server Settings

```toml
[Server]
# Listen on all network interfaces
HttpHost = "0.0.0.0"

# Port for HTTP requests
HttpPort = 9000

# Enable response compression
CompressResponse = true
```

### 3. Feature Limits

```toml
[Paging]
# Default number of features returned per request
LimitDefault = 10000

# Maximum number of features that can be requested
LimitMax = 10000
```

---

## Running pg_featureserv

### Development Mode (Manual)

```bash
# From project root
cd pg-featureserv
./pg_featureserv serve

# Or with custom config path
./pg_featureserv serve --config ./config/pg_featureserv.toml
```

### Background Mode (nohup)

```bash
# Start in background
cd pg-featureserv
nohup ./pg_featureserv serve > ../logs/pg-featureserv.log 2>&1 &
echo $! > ../logs/pg-featureserv.pid

# View logs
tail -f ../logs/pg-featureserv.log

# Stop service
kill $(cat ../logs/pg-featureserv.pid)
```

### Production Mode (systemd)

Create service file `/etc/systemd/system/pg-featureserv.service`:

```ini
[Unit]
Description=pg_featureserv OGC API Features Server
Documentation=https://github.com/CrunchyData/pg_featureserv
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data

# Adjust paths to your installation
WorkingDirectory=/var/www/geote-klima-ui/pg-featureserv
ExecStart=/var/www/geote-klima-ui/pg-featureserv/pg_featureserv serve

# Environment (optional - can also use config file)
# Environment="DATABASE_URL=postgresql://user:pass@localhost:5432/klima"

# Restart policy
Restart=on-failure
RestartSec=10

# Security hardening (optional)
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/pg-featureserv

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pg-featureserv

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable pg-featureserv
sudo systemctl start pg-featureserv
sudo systemctl status pg-featureserv

# View logs
sudo journalctl -u pg-featureserv -f
```

---

## Verification

### Check if Service is Running

```bash
# Check process
ps aux | grep pg_featureserv

# Check port binding
sudo netstat -tulpn | grep 9000
# or
sudo ss -tulpn | grep 9000

# Test HTTP endpoint
curl http://localhost:9000

# Should return JSON with API information
```

### Access Web Interface

Open in browser:
- **Landing Page:** http://localhost:9000
- **Collections:** http://localhost:9000/collections
- **Specific Collection:** http://localhost:9000/collections/public.climate_master_geom

### Test Spatial Query

```bash
# Get ORP features
curl "http://localhost:9000/collections/public.orp/items?limit=5"

# Get CHKO features
curl "http://localhost:9000/collections/public.chko/items?limit=5"

# Spatial filter (bounding box)
curl "http://localhost:9000/collections/public.climate_master_geom/items?bbox=14.0,49.0,15.0,50.0&limit=10"
```

---

## Troubleshooting

### Permission Denied

```bash
# Error: bash: ./pg_featureserv: Permission denied
chmod +x pg-featureserv/pg_featureserv
```

### Connection Refused

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test database connection manually
psql -h localhost -U postgres -d klima -c "SELECT version();"

# Verify credentials in pg_featureserv.toml
cat pg-featureserv/config/pg_featureserv.toml | grep DbConnection
```

### Database Connection Errors

Check logs for specific errors:
```bash
tail -f logs/pg-featureserv.log
```

Common issues:
- **Invalid password:** Update `DbConnection` string
- **Database does not exist:** Create database `klima`
- **PostGIS not installed:** `CREATE EXTENSION postgis;`
- **Firewall blocking:** Allow port 5432 for PostgreSQL

### Port Already in Use

```bash
# Find process using port 9000
sudo lsof -i :9000

# Kill existing process
kill <PID>

# Or change port in pg_featureserv.toml
[Server]
HttpPort = 9001
```

---

## Remote Server Configuration

### PostgreSQL Server Setup

Allow remote connections by editing PostgreSQL configuration:

**Edit `postgresql.conf`:**
```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```

```conf
# Change to listen on all addresses
listen_addresses = '*'
```

**Edit `pg_hba.conf`:**
```bash
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Add line to allow remote connections:
```conf
# TYPE  DATABASE   USER        ADDRESS          METHOD
host    klima      postgres    192.168.34.0/24  md5
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### Firewall Configuration

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 5432/tcp
sudo ufw allow 9000/tcp

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=5432/tcp
sudo firewall-cmd --permanent --add-port=9000/tcp
sudo firewall-cmd --reload
```

---

## Performance Tuning

### Connection Pooling

Edit `pg_featureserv.toml`:

```toml
[Database]
# Maximum connections in pool
DbPoolMaxConns = 10

# Close idle connections after this time
DbPoolMaxConnLifeTime = "1h"
```

### Response Optimization

```toml
[Server]
# Enable compression (reduces bandwidth)
CompressResponse = true

# Adjust timeout for slow queries
WriteTimeoutSec = 60

[Paging]
# Reduce default limit for faster responses
LimitDefault = 1000
LimitMax = 5000
```

---

## Security Considerations

### Production Checklist

- [ ] Use strong PostgreSQL password
- [ ] Restrict database access by IP (pg_hba.conf)
- [ ] Enable SSL/TLS for PostgreSQL connections
- [ ] Run pg_featureserv as non-root user (www-data)
- [ ] Use firewall to restrict access to ports 5432 and 9000
- [ ] Consider reverse proxy (Nginx/Apache) for HTTPS
- [ ] Enable systemd security hardening options

### SSL/TLS Configuration

For PostgreSQL SSL:
```toml
[Database]
DbConnection = "postgresql://postgres:password@localhost:5432/klima?sslmode=require"
```

For HTTPS with pg_featureserv:
```toml
[Server]
HttpsPort = 9001
TlsServerCertificateFile = "/etc/ssl/certs/server.crt"
TlsServerPrivateKeyFile = "/etc/ssl/private/server.key"
```

---

## Integration with GEOTE Climate UI

The frontend expects pg_featureserv to be available at:
```
http://localhost:9000
```

Required collections:
- `public.orp` - ORP administrative units
- `public.chko` - CHKO protected areas
- `public.climate_master_geom` - Climate master table

Verify these are exposed:
```bash
curl http://localhost:9000/collections | jq '.collections[].id'
```

---

## Additional Resources

- **Official Documentation:** https://access.crunchydata.com/documentation/pg_featureserv/latest/
- **GitHub Repository:** https://github.com/CrunchyData/pg_featureserv
- **OGC API Features Spec:** https://ogcapi.ogc.org/features/
- **Crunchy Data Blog:** https://www.crunchydata.com/blog/tag/pg_featureserv

---

## Quick Reference

```bash
# Start service (development)
cd pg-featureserv && ./pg_featureserv serve

# Start service (production systemd)
sudo systemctl start pg-featureserv

# Check status
sudo systemctl status pg-featureserv

# View logs
sudo journalctl -u pg-featureserv -f

# Stop service
sudo systemctl stop pg-featureserv

# Test endpoint
curl http://localhost:9000/collections

# Configuration file location
pg-featureserv/config/pg_featureserv.toml
```

---

**Last Updated:** January 2026  
**Maintainer:** Petr Mikeška

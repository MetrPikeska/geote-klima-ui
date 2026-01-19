#!/usr/bin/env bash
# GEOTE Climate UI - Start Script for Linux/Unix
# Starts the Node.js backend and pg_featureserv

set -e  # Exit on error

# Color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   GEOTE Climate UI - Starting...${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if .env file exists
if [ ! -f "${PROJECT_ROOT}/backend/.env" ]; then
    echo -e "${RED}✗ Error: backend/.env file not found!${NC}"
    echo -e "${YELLOW}  Please create it from .env.example:${NC}"
    echo -e "    cd backend && cp .env.example .env"
    echo -e "    # Then edit .env with your database credentials"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "${PROJECT_ROOT}/backend/node_modules" ]; then
    echo -e "${YELLOW}⚠ Node modules not found. Installing dependencies...${NC}"
    cd "${PROJECT_ROOT}/backend"
    npm install
    cd "${PROJECT_ROOT}"
fi

# Start Node.js backend in background
echo -e "${BLUE}→ Starting Node.js backend server...${NC}"
cd "${PROJECT_ROOT}/backend"
nohup node server.js > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../logs/backend.pid
cd "${PROJECT_ROOT}"
echo -e "${GREEN}✓ Backend started (PID: ${BACKEND_PID})${NC}"
echo -e "  Log file: ${PROJECT_ROOT}/logs/backend.log"
sleep 2

# Start pg_featureserv
echo -e "${BLUE}→ Starting pg_featureserv...${NC}"
cd "${PROJECT_ROOT}/pg-featureserv"

# Check if pg_featureserv binary exists
if [ ! -f "./pg_featureserv" ]; then
    echo -e "${RED}✗ Error: pg_featureserv binary not found!${NC}"
    echo -e "${YELLOW}  Please download it for Linux from:${NC}"
    echo -e "    https://github.com/CrunchyData/pg_featureserv/releases"
    echo -e "  Then run: chmod +x pg-featureserv/pg_featureserv"
    
    # Stop the backend we just started
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# Check if executable
if [ ! -x "./pg_featureserv" ]; then
    echo -e "${YELLOW}⚠ pg_featureserv not executable. Setting permissions...${NC}"
    chmod +x ./pg_featureserv
fi

# Check if config exists
if [ ! -f "./config/pg_featureserv.toml" ]; then
    echo -e "${YELLOW}⚠ Warning: pg_featureserv.toml not found!${NC}"
fi

nohup ./pg_featureserv serve > ../logs/pg-featureserv.log 2>&1 &
PG_PID=$!
echo $PG_PID > ../logs/pg-featureserv.pid
cd "${PROJECT_ROOT}"
echo -e "${GREEN}✓ pg_featureserv started (PID: ${PG_PID})${NC}"
echo -e "  Log file: ${PROJECT_ROOT}/logs/pg-featureserv.log"

sleep 2

# Check if services are running
if ps -p $BACKEND_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend failed to start. Check logs/backend.log${NC}"
fi

if ps -p $PG_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✓ pg_featureserv is running${NC}"
else
    echo -e "${RED}✗ pg_featureserv failed to start. Check logs/pg-featureserv.log${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Services Started Successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "  Backend API:      ${BLUE}http://localhost:4000${NC}"
echo -e "  pg_featureserv:   ${BLUE}http://localhost:9000${NC}"
echo -e "  Frontend:         ${BLUE}Open index.html in browser${NC}"
echo ""
echo -e "${YELLOW}To view logs in real-time:${NC}"
echo -e "  Backend:      tail -f logs/backend.log"
echo -e "  pg_featureserv: tail -f logs/pg-featureserv.log"
echo ""
echo -e "${YELLOW}To stop services:${NC}"
echo -e "  Run: ./stop.sh"
echo -e "${GREEN}========================================${NC}"

# Open frontend in browser (optional)
if command -v xdg-open &> /dev/null; then
    echo -e "${BLUE}→ Opening frontend in default browser...${NC}"
    xdg-open "${PROJECT_ROOT}/index.html" &
elif command -v open &> /dev/null; then
    # macOS
    open "${PROJECT_ROOT}/index.html" &
fi

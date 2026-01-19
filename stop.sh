#!/usr/bin/env bash
# GEOTE Climate UI - Stop Script for Linux/Unix
# Stops the Node.js backend and pg_featureserv

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   GEOTE Climate UI - Stopping...${NC}"
echo -e "${BLUE}========================================${NC}"

STOPPED_COUNT=0

# Stop backend
if [ -f "${PROJECT_ROOT}/logs/backend.pid" ]; then
    BACKEND_PID=$(cat "${PROJECT_ROOT}/logs/backend.pid")
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo -e "${BLUE}→ Stopping backend (PID: ${BACKEND_PID})...${NC}"
        kill $BACKEND_PID
        sleep 1
        # Force kill if still running
        if ps -p $BACKEND_PID > /dev/null 2>&1; then
            kill -9 $BACKEND_PID 2>/dev/null || true
        fi
        echo -e "${GREEN}✓ Backend stopped${NC}"
        STOPPED_COUNT=$((STOPPED_COUNT + 1))
    else
        echo -e "${YELLOW}⚠ Backend process not running${NC}"
    fi
    rm -f "${PROJECT_ROOT}/logs/backend.pid"
else
    echo -e "${YELLOW}⚠ Backend PID file not found${NC}"
fi

# Stop pg_featureserv
if [ -f "${PROJECT_ROOT}/logs/pg-featureserv.pid" ]; then
    PG_PID=$(cat "${PROJECT_ROOT}/logs/pg-featureserv.pid")
    if ps -p $PG_PID > /dev/null 2>&1; then
        echo -e "${BLUE}→ Stopping pg_featureserv (PID: ${PG_PID})...${NC}"
        kill $PG_PID
        sleep 1
        # Force kill if still running
        if ps -p $PG_PID > /dev/null 2>&1; then
            kill -9 $PG_PID 2>/dev/null || true
        fi
        echo -e "${GREEN}✓ pg_featureserv stopped${NC}"
        STOPPED_COUNT=$((STOPPED_COUNT + 1))
    else
        echo -e "${YELLOW}⚠ pg_featureserv process not running${NC}"
    fi
    rm -f "${PROJECT_ROOT}/logs/pg-featureserv.pid"
else
    echo -e "${YELLOW}⚠ pg_featureserv PID file not found${NC}"
fi

# Fallback: kill any remaining processes by name
echo -e "${BLUE}→ Checking for remaining processes...${NC}"

# Find and kill any node processes running server.js
BACKEND_PIDS=$(pgrep -f "node.*server.js" 2>/dev/null || true)
if [ ! -z "$BACKEND_PIDS" ]; then
    echo -e "${YELLOW}⚠ Found additional backend processes: ${BACKEND_PIDS}${NC}"
    pkill -f "node.*server.js" 2>/dev/null || true
    echo -e "${GREEN}✓ Killed additional backend processes${NC}"
fi

# Find and kill any pg_featureserv processes
PG_PIDS=$(pgrep -f "pg_featureserv" 2>/dev/null || true)
if [ ! -z "$PG_PIDS" ]; then
    echo -e "${YELLOW}⚠ Found additional pg_featureserv processes: ${PG_PIDS}${NC}"
    pkill -f "pg_featureserv" 2>/dev/null || true
    echo -e "${GREEN}✓ Killed additional pg_featureserv processes${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
if [ $STOPPED_COUNT -gt 0 ]; then
    echo -e "${GREEN}   Services Stopped Successfully!${NC}"
else
    echo -e "${YELLOW}   No running services found${NC}"
fi
echo -e "${GREEN}========================================${NC}"

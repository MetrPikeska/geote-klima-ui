@echo off
REM Start MCP PostgreSQL Server

cd /d "%~dp0"
echo Starting MCP PostgreSQL Server...
echo.

node mcp-postgres-server.js

pause

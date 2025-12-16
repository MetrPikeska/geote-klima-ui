@echo off
echo Starting Chrome with remote debugging on port 9222...
echo.
echo This allows Claude Code to connect via Chrome DevTools MCP server
echo.

"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-debug-profile" "file:///%CD%/index.html"

echo.
echo Chrome closed.
pause

@echo off
cd /d "%~dp0"
title WINGO - Local Server
set PORT=8080

echo.
echo   ============================================
echo     WINGO - independent game  (no login needed)
echo   ============================================
echo.

where python >nul 2>&1
if %ERRORLEVEL%==0 (
  echo   Using Python...
  start "WINGO server" /min cmd /c "python -m http.server %PORT%"
  goto open
)

where node >nul 2>&1
if %ERRORLEVEL%==0 (
  echo   Using Node.js...
  start "WINGO server" /min cmd /c "node ""%~dp0wingo-server.js"" %PORT%"
  goto open
)

echo   Python and Node.js not found - using the PowerShell fallback...
echo   (allow it through the Windows Firewall prompt if one appears)
start "" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0wingo-server.ps1" -Port %PORT%
echo.
echo   Open this in your browser:  http://localhost:%PORT%/index.html
pause
goto :eof

:open
timeout /t 3 /nobreak >nul
start "" "http://localhost:%PORT%/index.html"
echo.
echo   Server started. Browser opening at:
echo       http://localhost:%PORT%/index.html
echo.
echo   The server runs in a minimised window named "WINGO server".
echo   Close that window when you are done playing.
echo.
pause
@echo off
setlocal

set "DIALECTIC_URL=http://127.0.0.1:3042"

cd /d "%~dp0"

echo.
echo DialecticHub starting...
echo Fixed local link: %DIALECTIC_URL%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run this site.
  echo Install Node.js, then run this file again.
  echo.
  pause
  exit /b 1
)

echo Clearing any stale DialecticHub server on port 3042...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 3042 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }"

echo.
echo Starting the fixed local server...
start "DialecticHub Server" cmd /k "cd /d ""%~dp0"" && set PORT=3042 && node server.js"

echo Waiting for DialecticHub to respond...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$url = 'http://127.0.0.1:3042'; for ($i = 0; $i -lt 60; $i++) { try { $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { exit 0 } } catch {} Start-Sleep -Seconds 1 } exit 1"
if errorlevel 1 (
  echo.
  echo DialecticHub did not respond in time. Check the "DialecticHub Server" window for errors.
  echo.
  pause
  exit /b 1
)

echo Opening the fixed link in your browser...
start "" "%DIALECTIC_URL%"

echo.
echo DialecticHub is ready.
echo Close the "DialecticHub Server" window when you want to stop the site.
echo.
pause

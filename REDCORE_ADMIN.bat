@echo off
setlocal
cd /d "%~dp0server"

if not exist node_modules (
  call npm.cmd install
  if errorlevel 1 (
    echo [REDCORE] npm install failed.
    pause
    exit /b 1
  )
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if(-not $p){Start-Process -FilePath 'node.exe' -ArgumentList 'server.js' -WorkingDirectory '%CD%' -WindowStyle Hidden}"

for /l %%i in (1,1,15) do (
  powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/health -TimeoutSec 1; if($r.StatusCode -eq 200){exit 0} } catch {} ; exit 1" >nul 2>&1
  if not errorlevel 1 goto OPEN
  timeout /t 1 /nobreak >nul
)

echo [REDCORE] Server did not respond.
pause
exit /b 1

:OPEN
start "" "http://localhost:3000/admin.html"
exit /b 0

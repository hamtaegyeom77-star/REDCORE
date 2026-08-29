@echo off
setlocal
cd /d "%~dp0server"
if not exist node_modules (
  echo [REDCORE] First run: installing server packages...
  call npm.cmd install
  if errorlevel 1 (echo [REDCORE] npm install failed. Check Node.js/npm installation.&pause&exit /b 1)
)
echo [REDCORE] Starting server...
start "REDCORE Browser" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000/"
call npm.cmd start
pause

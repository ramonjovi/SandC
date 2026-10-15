@echo off
rem TPC Performance OS - double-click to start.
cd /d "%~dp0"
title TPC Performance OS
echo.
echo  TPC Performance OS
echo  ------------------
echo  Backing up your data first...
call npm run backup --silent
if errorlevel 3 (
  echo.
  echo  TPC is already running. Opening it in your browser.
  start "" http://localhost:3001
  timeout /t 3 >nul
  exit /b 0
)
if errorlevel 1 (
  echo.
  echo  The backup did not work. Starting anyway in 10 seconds - press Ctrl+C to cancel.
  timeout /t 10
)
echo.
echo  Preparing the app...
call npm run build --silent
set SEED_DEMO=false
echo.
echo  Opening http://localhost:3001  (keep this window open while you use TPC; close it to stop)
start "" http://localhost:3001
call npm start
pause

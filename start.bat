@echo off
rem TPC Performance OS - double-click to start.
cd /d "%~dp0"
title TPC Performance OS
echo.
echo  TPC Performance OS
echo  ------------------
where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js was not found on this computer. Install it from https://nodejs.org and try again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo  First start: installing the app's parts. This takes a few minutes...
  call npm install
  if errorlevel 1 ( echo  Install failed. Take a photo of this window and send it to your helper. & pause & exit /b 1 )
)
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
if errorlevel 1 (
  echo.
  echo  The app could not be prepared. Take a photo of the messages above and send them to your helper.
  pause
  exit /b 1
)
set SEED_DEMO=false
echo.
echo  Opening http://localhost:3001  (keep this window open while you use TPC; close it to stop)
start "" http://localhost:3001
call npm start
echo.
echo  TPC stopped. If this was not on purpose, read the messages above:
echo    - "EADDRINUSE" or "address already in use": another program is using port 3001. Close it, or restart the computer.
echo    - anything else: take a photo of this window and send it to your helper.
pause

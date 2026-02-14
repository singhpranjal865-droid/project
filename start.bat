@echo off
setlocal enabledelayedexpansion

echo ===========================================
echo   PCB Inventory System - Quick Start
echo ===========================================

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install it from https://nodejs.org/
    pause
    exit /b
)

echo [1/3] Starting Backend Server...
start "PCB Backend" cmd /c "cd server && npm install && npm run dev"

echo [2/3] Starting Frontend Client...
start "PCB Frontend" cmd /c "cd client && npm install && npm run dev"

echo [3/3] Opening Browser...
echo Wait for servers to initialize...
timeout /t 10 /nobreak >nul

start http://localhost:3000

echo ===========================================
echo   System is running! 
echo   - Frontend: http://localhost:3000
echo   - Backend:  http://localhost:5000
echo ===========================================
echo Keep the other terminal windows open to keep the app running.
pause

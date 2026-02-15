@echo off
echo ===================================================
echo   PCB Inventory System - Start Application
echo ===================================================
echo.

echo [1/2] Starting Python Backend...
start "PCB Backend (Python)" /B cmd /c "python -m uvicorn server_python.main:app --reload --port 8000"

echo.
echo [2/2] Starting React Frontend...
cd client
start "PCB Frontend" /B cmd /c "npm run dev"

echo.
echo ===================================================
echo   App is running!
echo   Open Browser: http://localhost:3002 (or 3000/3001)
echo ===================================================
pause

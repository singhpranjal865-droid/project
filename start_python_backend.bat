@echo off
echo ===================================================
echo   PCB Inventory System - Python Backend Setup
echo ===================================================
echo.

echo [1/3] Copying environment variables...
if not exist server_python\.env copy server\.env server_python\.env

echo [2/3] Installing Python dependencies...
echo This may take a few minutes...
pip install -r server_python/requirements.txt

echo.
echo [3/3] Starting FastAPI Server...
echo Access API at: http://localhost:8000
echo Access Docs at: http://localhost:8000/docs
echo.
python -m uvicorn server_python.main:app --reload --port 8000
pause

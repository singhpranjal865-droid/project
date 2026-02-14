#!/bin/bash

echo "==========================================="
echo "  PCB Inventory System - Quick Start"
echo "==========================================="

# Check for Node.js
if ! command -v node &> /dev/null
then
    echo "[ERROR] Node.js is not installed. Please install it from https://nodejs.org/"
    exit 1
fi

echo "[1/3] Starting Backend Server..."
(cd server && npm install && npm run dev) &

echo "[2/3] Starting Frontend Client..."
(cd client && npm install && npm run dev) &

echo "[3/3] Opening Browser..."
echo "Wait for servers to initialize (10s)..."
sleep 10

# Open browser based on OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open http://localhost:3000
elif [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:3000
elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    start http://localhost:3000
else
    echo "Please open http://localhost:3000 in your browser manually."
fi

echo "==========================================="
echo "  System is running!"
echo "  - Frontend: http://localhost:3000"
echo "  - Backend:  http://localhost:5000"
echo "==========================================="
echo "Press Ctrl+C to stop all servers."
wait

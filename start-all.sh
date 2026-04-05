#!/bin/bash
# Start all Bengali Math services

echo "========================================"
echo "Bengali Math - Starting All Services"
echo "========================================"
echo ""

# Start backend in background
echo "[1/2] Starting Backend API (Port 3001)..."
cd server
npm start > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd ..

sleep 2

# Start UI in background
echo "[2/2] Starting Frontend UI (Port 5173)..."
cd ui
npm run dev > ../logs/ui.log 2>&1 &
UI_PID=$!
echo "UI PID: $UI_PID"
cd ..

sleep 3

echo ""
echo "========================================"
echo "All services started!"
echo "========================================"
echo ""
echo "Backend API: http://localhost:3001"
echo "Frontend UI: http://localhost:5173"
echo ""
echo "Database: database/bengali_curriculam.db"
echo ""
echo "Backend PID: $BACKEND_PID"
echo "UI PID: $UI_PID"
echo ""
echo "Logs:"
echo "  Backend: logs/backend.log"
echo "  UI: logs/ui.log"
echo ""
echo "To stop:"
echo "  kill $BACKEND_PID $UI_PID"
echo ""

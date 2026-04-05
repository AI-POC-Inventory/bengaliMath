@echo off
REM Start all Bengali Math services

echo ========================================
echo Bengali Math - Starting All Services
echo ========================================
echo.

REM Start backend in new window
echo [1/2] Starting Backend API (Port 3001)...
start "Bengali Math Backend" cmd /k "cd server && npm start"
timeout /t 3 /nobreak > nul

REM Start UI in new window
echo [2/2] Starting Frontend UI (Port 5173)...
start "Bengali Math UI" cmd /k "cd ui && npm run dev"
timeout /t 2 /nobreak > nul

echo.
echo ========================================
echo All services started!
echo ========================================
echo.
echo Backend API: http://localhost:3001
echo Frontend UI: http://localhost:5173
echo.
echo Database: database/bengali_curriculam.db
echo.
echo Press any key to open the application in browser...
pause > nul

start http://localhost:5173

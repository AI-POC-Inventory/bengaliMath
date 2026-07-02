@echo off
REM Quick start script for Bengali Math Android app development

echo Bengali Math - Android Mobile App Quick Start
echo ===============================================
echo.

REM Check if in correct directory
if not exist "package.json" (
    echo Error: Please run this script from apps/mobile directory
    pause
    exit /b 1
)

echo [1/4] Installing dependencies...
call npm install
if errorlevel 1 (
    echo Error: npm install failed
    pause
    exit /b 1
)

echo.
echo [2/4] Building React UI...
call npm run build
if errorlevel 1 (
    echo Error: UI build failed
    pause
    exit /b 1
)

echo.
echo [3/4] Syncing with Capacitor...
call npx cap sync android
if errorlevel 1 (
    echo Error: Capacitor sync failed
    pause
    exit /b 1
)

echo.
echo [4/4] Opening in Android Studio...
call npx cap open android

echo.
echo ===============================================
echo Setup complete!
echo.
echo Next steps:
echo 1. In Android Studio, click the Run button (green play icon)
echo 2. Select your device or emulator
echo 3. Wait for the app to build and install
echo.
echo For production deployment, see DEPLOYMENT_GUIDE.md
echo ===============================================
pause

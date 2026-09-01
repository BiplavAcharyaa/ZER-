@echo off
setlocal enabledelayedexpansion

echo.
echo PC Remote Control - Startup
echo ---------------------------
echo.

REM ---------------------------------------------------------------------
REM 1. Check that Node.js is installed
REM ---------------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js was not found on PATH.
    echo Please install Node.js 24.x from https://nodejs.org and try again.
    echo.
    pause
    exit /b 1
)

REM ---------------------------------------------------------------------
REM 2. Print detected Node.js version and check compatibility
REM ---------------------------------------------------------------------
for /f "delims=" %%v in ('node -v') do set NODE_VERSION=%%v
echo Detected Node.js version: %NODE_VERSION%

REM NODE_VERSION looks like "v24.1.0" - extract the major version number.
set "NODE_VERSION_NO_V=%NODE_VERSION:v=%"
for /f "delims=. tokens=1" %%a in ("%NODE_VERSION_NO_V%") do set NODE_MAJOR=%%a

if %NODE_MAJOR% LSS 24 (
    echo.
    echo [WARNING] This project targets Node.js 24.x.
    echo Detected major version %NODE_MAJOR% may not be fully compatible.
    echo Continuing anyway - if you hit errors, install Node.js 24.x from https://nodejs.org
    echo.
)

REM ---------------------------------------------------------------------
REM 3. Check that npm is available
REM ---------------------------------------------------------------------
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm was not found on PATH. It should be installed alongside Node.js.
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%v in ('npm -v') do set NPM_VERSION=%%v
echo Detected npm version: %NPM_VERSION%
echo.

REM ---------------------------------------------------------------------
REM 4. Install dependencies only when necessary
REM    (skip if node_modules already exists and looks populated)
REM ---------------------------------------------------------------------
if not exist "node_modules" (
    echo Installing dependencies for the first time...
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed. See the output above for details.
        echo.
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed - skipping npm install.
    echo (Delete the node_modules folder to force a reinstall.)
)

echo.
echo Starting PC Remote Control...
echo.

REM ---------------------------------------------------------------------
REM 5. Start the application
REM ---------------------------------------------------------------------
call npm start

REM ---------------------------------------------------------------------
REM 6. Keep the window open if the app exits with an error, so the
REM    error message can actually be read.
REM ---------------------------------------------------------------------
if errorlevel 1 (
    echo.
    echo [ERROR] The application exited with an error. See the output above.
    echo.
    pause
    exit /b 1
)

pause

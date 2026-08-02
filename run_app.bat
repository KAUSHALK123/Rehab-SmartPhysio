@echo off
title SmartPhysio Control Panel
echo ===================================================
echo             SmartPhysio Launcher Control           
echo ===================================================
echo.
echo Please select a launch profile:
echo [1] Local Dev Mode (Python virtualenv + Node npm)
echo [2] Docker Compose Mode (Requires Docker Desktop)
echo.
set /p choice="Select profile (1 or 2): "

if "%choice%"=="1" goto LOCAL
if "%choice%"=="2" goto DOCKER
goto INVALID

:LOCAL
echo.
echo [+] Launching FastAPI Backend (port 8000) in new shell...
start cmd /k "cd /d %~dp0backend && set PYTHONPATH=.&& .\venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000"

echo [+] Launching React Frontend (port 5173) in new shell...
start cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Waiting for servers to bind sockets (5s)...
timeout /t 5 /nobreak >nul

echo [+] Launching Web UI in browser...
start http://localhost:5173
echo.
echo Launch Complete!
echo - Web Application: http://localhost:5173
echo - Backend API Swagger: http://localhost:8000/docs
echo.
pause
exit

:DOCKER
echo.
echo [+] Triggering Docker Compose daemon up...
docker compose up -d --build

echo.
echo Waiting for containers to complete healthcheck (8s)...
timeout /t 8 /nobreak >nul

echo [+] Launching Web UI in browser...
start http://localhost:5173
echo.
echo Launch Complete!
echo - Web Application: http://localhost:5173
echo - Backend API Swagger: http://localhost:8000/docs
echo.
pause
exit

:INVALID
echo [!] Invalid selection. Exiting start panel...
pause
exit

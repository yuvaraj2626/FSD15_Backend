@echo off
echo ========================================
echo   Complaint Management System
echo   Starting Application...
echo ========================================
echo.

echo [1/2] Starting Backend Server...
start "Backend Server" cmd /k "cd /d %~dp0 && npm run server"

timeout /t 5 /nobreak > nul

echo [2/2] Starting Frontend...
start "Frontend" cmd /k "cd /d %~dp0client && npm start"

echo.
echo ========================================
echo   Application Started!
echo   Backend: http://localhost:5000
echo   Frontend: http://localhost:3000
echo ========================================
echo.
echo Press any key to exit this window...
pause > nul

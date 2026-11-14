@echo off
setlocal
cd /d "%~dp0"
echo ========================================================
echo   MARSWALK: 3D Martian Mission Planner Desktop Workstation
echo   NASA Space Apps Challenge 2026
echo ========================================================
echo.

if exist ".venv\Scripts\python.exe" (
    echo [OK] Using virtual environment (.venv)...
    ".venv\Scripts\python.exe" desktop_app.py
) else (
    echo [OK] Using system Python...
    python desktop_app.py
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Application exited with error code %ERRORLEVEL%.
)
pause

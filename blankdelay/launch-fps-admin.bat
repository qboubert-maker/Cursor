@echo off
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
cd /d "%~dp0"
set PATH=%~dp0.tools\node;%~dp0node_modules\.bin;%PATH%
npx electron electron/main.js --product=fps

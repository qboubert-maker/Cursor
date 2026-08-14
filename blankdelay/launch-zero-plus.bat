@echo off
cd /d "%~dp0"
set PATH=%~dp0.tools\node;%~dp0node_modules\.bin;%PATH%
npx electron electron/main.js --product=zero-plus

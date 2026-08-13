@echo off
title BlankDelay Netlify Upload Folder
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Setup-Netlify-Upload-Folder.ps1"

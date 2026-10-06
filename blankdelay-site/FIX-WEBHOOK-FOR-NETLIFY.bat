@echo off
title Fix BlankDelay Stripe Webhook (UTF-8)
echo.
echo This downloads the FIXED stripe-webhook.js (UTF-8) for Netlify.
echo.

set "URL=https://github.com/qboubert-maker/Cursor/releases/download/netlify-upload/stripe-webhook.js"
set "DESKTOP=%USERPROFILE%\Desktop"
set "TARGET=%DESKTOP%\BlankDelay-Netlify-Upload\netlify\functions"

if not exist "%TARGET%" (
  echo Folder not found:
  echo   %TARGET%
  echo.
  echo Create it by extracting your Netlify upload zip on Desktop first,
  echo OR change TARGET inside this .bat to your site folder.
  pause
  exit /b 1
)

powershell -NoProfile -Command ^
  "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; ^
   Invoke-WebRequest -Uri '%URL%' -OutFile '%TARGET%\stripe-webhook.js'; ^
   $b = [IO.File]::ReadAllBytes('%TARGET%\stripe-webhook.js'); ^
   Write-Host ('First bytes: ' + ($b[0..5] -join ',')); ^
   if ($b[0] -eq 99 -and $b[1] -eq 111) { Write-Host 'OK - UTF-8 JavaScript' -ForegroundColor Green } ^
   elseif ($b[1] -eq 0) { Write-Host 'BAD - File is UTF-16. Try again.' -ForegroundColor Red }"

echo.
echo Next: Netlify -^> Deploys -^> drag folder:
echo   %DESKTOP%\BlankDelay-Netlify-Upload
echo   (or drag ONLY the netlify folder)
echo.
explorer "%DESKTOP%\BlankDelay-Netlify-Upload\netlify"
pause

# BlankDelay — copies THIS folder (blankdelay-site) to Desktop\BlankDelay-Netlify-Upload
$ErrorActionPreference = "Stop"
$folderName = "BlankDelay-Netlify-Upload"
$desktop = [Environment]::GetFolderPath("Desktop")
$target = Join-Path $desktop $folderName
$source = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path (Join-Path $source "netlify\functions\stripe-webhook.js"))) {
    Write-Host "Run this from the blankdelay-site folder (needs netlify\functions)." -ForegroundColor Red
    Read-Host "Press Enter"
    exit 1
}

Write-Host "Copying site to Desktop..."
if (Test-Path $target) { Remove-Item -LiteralPath $target -Recurse -Force }
New-Item -ItemType Directory -Path $target -Force | Out-Null
Copy-Item -Path (Join-Path $source "*") -Destination $target -Recurse -Force

Write-Host "Opening File Explorer: $target" -ForegroundColor Green
Start-Process explorer.exe -ArgumentList $target
Read-Host "Press Enter to close"

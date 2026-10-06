# BlankDelay — puts Netlify drag-drop folder on your Desktop and opens File Explorer
$ErrorActionPreference = "Stop"

$folderName = "BlankDelay-Netlify-Upload"
$desktop = [Environment]::GetFolderPath("Desktop")
$target = Join-Path $desktop $folderName

# Where this script lives (Desktop copy, repo clone, or blankdelay project)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Find-BlankDelaySite {
    param([string]$Start)
    $candidates = @(
        (Join-Path $Start "blankdelay-site"),
        (Join-Path $Start "..\blankdelay-site"),
        (Join-Path $Start "..\..\blankdelay-site"),
        (Join-Path $env:USERPROFILE "blankdelay"),
        (Join-Path $env:USERPROFILE "Cursor\blankdelay-site"),
        (Join-Path $env:USERPROFILE "Documents\GitHub\Cursor\blankdelay-site"),
        (Join-Path $env:USERPROFILE "source\repos\Cursor\blankdelay-site")
    )
    foreach ($p in $candidates) {
        $resolved = (Resolve-Path $p -ErrorAction SilentlyContinue)
        if ($resolved -and (Test-Path (Join-Path $resolved "index.html")) -and (Test-Path (Join-Path $resolved "netlify\functions\stripe-webhook.js"))) {
            return $resolved.Path
        }
    }
    return $null
}

$source = Find-BlankDelaySite -Start $scriptDir

if (-not $source) {
    Write-Host ""
    Write-Host "Could not find blankdelay-site on this PC." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Do ONE of these, then run this script again:"
    Write-Host "  1. GitHub -> github.com/qboubert-maker/Cursor -> branch cursor/blankdelay-fulfillment-f409"
    Write-Host "     Download ZIP -> extract -> note path to blankdelay-site folder"
    Write-Host "  2. Copy your Google Drive blankdelay update folder to:"
    Write-Host "     $env:USERPROFILE\blankdelay"
    Write-Host "     (must include netlify\functions\stripe-webhook.js and downloads\BlankDelay-Setup.exe)"
    Write-Host ""
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host "Source: $source"
Write-Host "Copying to: $target"

if (Test-Path $target) {
    Remove-Item -LiteralPath $target -Recurse -Force
}
New-Item -ItemType Directory -Path $target -Force | Out-Null
Copy-Item -Path (Join-Path $source "*") -Destination $target -Recurse -Force

# Copy these helpers if present next to script
$helpers = @(
    "NETLIFY-UPLOAD-README.txt",
    "AFTER-DEPLOY-EMAIL-SETUP.txt",
    "Setup-Netlify-Upload-Folder.ps1",
    "Setup-Netlify-Upload-Folder.bat"
)
foreach ($h in $helpers) {
    $from = Join-Path $scriptDir $h
    if (Test-Path $from) {
        Copy-Item -LiteralPath $from -Destination (Join-Path $target $h) -Force
    }
}

Write-Host ""
Write-Host "Ready. Opening File Explorer..." -ForegroundColor Green
Write-Host "Drag EVERYTHING inside this folder onto Netlify -> Deploys." -ForegroundColor Cyan
Start-Process explorer.exe -ArgumentList $target

Read-Host "Press Enter to close"

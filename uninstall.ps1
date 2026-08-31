param(
  [string]$BinDir = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  ◆ " -ForegroundColor Magenta -NoNewline
Write-Host "Rofiant Code" -ForegroundColor White
Write-Host "    Uninstalling" -ForegroundColor DarkGray
Write-Host ""

$DataBase = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $HOME "AppData\Local" }
$DataRoot = Join-Path $DataBase "rofiant"
if (-not $BinDir) { $BinDir = Join-Path $DataBase "Programs\Rofiant\bin" }

Write-Host "  > " -ForegroundColor Magenta -NoNewline
Write-Host "Removing app and data"
if (Test-Path $DataRoot) { Remove-Item $DataRoot -Recurse -Force }

Write-Host "  > " -ForegroundColor Magenta -NoNewline
Write-Host "Removing command"
Remove-Item (Join-Path $BinDir "rofiant.cmd") -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "  ✓ Uninstalled" -ForegroundColor Green
Write-Host "    This removed saved sessions, login, and settings too."
Write-Host ""

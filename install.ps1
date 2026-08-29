param(
  [string]$BinDir = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  throw "Rofiant Code requires Bun: https://bun.sh/docs/installation"
}

$RepoArchive = if ($env:ROFIANT_REPO_ARCHIVE) { $env:ROFIANT_REPO_ARCHIVE } else { "https://github.com/RofiantAI/RofiantCode/archive/refs/heads/main.zip" }
$DataBase = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $HOME "AppData\Local" }
$InstallRoot = Join-Path $DataBase "rofiant\app"
if (-not $BinDir) { $BinDir = Join-Path $DataBase "Programs\Rofiant\bin" }
$StageDir = Join-Path ([IO.Path]::GetTempPath()) ("rofiant-install." + [guid]::NewGuid().ToString("N"))
$BackupRoot = "$InstallRoot.previous"

try {
  New-Item -ItemType Directory -Path $StageDir -Force | Out-Null
  $ArchiveZip = Join-Path ([IO.Path]::GetTempPath()) ("rofiant-src." + [guid]::NewGuid().ToString("N") + ".zip")
  Invoke-WebRequest -Uri $RepoArchive -OutFile $ArchiveZip
  $ExtractDir = Join-Path ([IO.Path]::GetTempPath()) ("rofiant-src." + [guid]::NewGuid().ToString("N"))
  Expand-Archive -Path $ArchiveZip -DestinationPath $ExtractDir
  Remove-Item $ArchiveZip -Force
  $SrcRoot = Get-ChildItem $ExtractDir | Select-Object -First 1
  Copy-Item (Join-Path $SrcRoot.FullName "*") -Destination $StageDir -Recurse
  Remove-Item $ExtractDir -Recurse -Force

  Push-Location $StageDir
  try {
    & bun install --production --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw "bun install failed with exit code $LASTEXITCODE" }
  } finally {
    Pop-Location
  }

  $Preload = Join-Path $InstallRoot "node_modules\@opentui\solid\scripts\preload.js"
  $Entry = Join-Path $InstallRoot "src\index.ts"
  @("@echo off", "bun --preload `"$Preload`" `"$Entry`" %*") |
    Set-Content (Join-Path $StageDir "rofiant.cmd") -Encoding ASCII

  New-Item -ItemType Directory -Path (Split-Path -Parent $InstallRoot), $BinDir -Force | Out-Null
  if (Test-Path $BackupRoot) { Remove-Item $BackupRoot -Recurse -Force }
  if (Test-Path $InstallRoot) { Move-Item $InstallRoot $BackupRoot }

  try {
    Move-Item $StageDir $InstallRoot
  } catch {
    if (Test-Path $BackupRoot) { Move-Item $BackupRoot $InstallRoot }
    throw
  }

  Move-Item (Join-Path $InstallRoot "rofiant.cmd") (Join-Path $BinDir "rofiant.cmd") -Force
  if (Test-Path $BackupRoot) { Remove-Item $BackupRoot -Recurse -Force }

  $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
  if (($UserPath -split ";") -notcontains $BinDir) {
    $NewPath = if ($UserPath) { "$($UserPath.TrimEnd(';'));$BinDir" } else { $BinDir }
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
    $env:Path = "$env:Path;$BinDir"
    Write-Host "Added $BinDir to user PATH. Open a new terminal before running rofiant."
  }

  Write-Host "Installed Rofiant Code: $(Join-Path $BinDir 'rofiant.cmd')"
} finally {
  if (Test-Path $StageDir) { Remove-Item $StageDir -Recurse -Force }
}

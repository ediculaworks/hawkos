# ═══════════════════════════════════════════════════════════════
#  🦅 Hawk OS — Installer for Windows
#
# Usage (Admin PowerShell):
#   irm https://your-vps.com/hawk/install.ps1 | iex
#   $env:HAWK_RELEASE_URL="https://..."; irm .../install.ps1 | iex
# ═══════════════════════════════════════════════════════════════

param(
  [string]$HawkReleaseUrl = $env:HAWK_RELEASE_URL,
  [string]$HawkDir        = "$env:USERPROFILE\hawk-os"
)

if (-not $HawkReleaseUrl) { $HawkReleaseUrl = "https://REPLACE_VPS_URL/hawk-os.zip" }

$ErrorActionPreference = "Stop"

# ─── Helpers ──────────────────────────────────────────────────

function Step($msg)  { Write-Host "`n  ▶ $msg" -ForegroundColor White }
function Ok($msg)    { Write-Host "    ✓ $msg" -ForegroundColor Green }
function Warn($msg)  { Write-Host "    ⚠ $msg" -ForegroundColor Yellow }
function Fail($msg)  { Write-Host "    ✗ $msg" -ForegroundColor Red; exit 1 }

function RefreshPath {
  $env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
              [System.Environment]::GetEnvironmentVariable("Path","User")
}

# ─── Check admin ──────────────────────────────────────────────

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]"Administrator"
)
if (-not $isAdmin) {
  Fail "Execute este script como Administrador: clique direito no PowerShell → 'Executar como administrador'"
}

Write-Host ""
Write-Host "  ═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "    🦅 Hawk OS — Installer (Windows)"     -ForegroundColor Cyan
Write-Host "  ═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ─── Dependencies ─────────────────────────────────────────────

Step "Verificando dependências"

# Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Warn "Node.js não encontrado — instalando via winget..."
  winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements | Out-Null
  RefreshPath
  Ok "Node.js instalado"
} else {
  Ok "Node.js $(node --version)"
}

# Bun
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Warn "Bun não encontrado — instalando via winget..."
  winget install Oven-sh.Bun --silent --accept-package-agreements --accept-source-agreements | Out-Null
  RefreshPath
  if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    # Fallback: PowerShell install
    powershell -Command "irm bun.sh/install.ps1 | iex" | Out-Null
    RefreshPath
  }
  Ok "Bun instalado"
} else {
  Ok "Bun $(bun --version)"
}

$BunBin = (Get-Command bun).Source

# PM2
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
  Warn "PM2 não encontrado — instalando..."
  npm install -g pm2 | Out-Null
  RefreshPath
  Ok "PM2 instalado"
} else {
  Ok "PM2 ok"
}

# ─── Download Hawk OS ─────────────────────────────────────────

Step "Baixando Hawk OS"

if ($HawkReleaseUrl -like "*REPLACE_VPS_URL*") {
  Fail "URL de download não configurada. Configure a variável HAWK_RELEASE_URL."
}

New-Item -ItemType Directory -Force -Path $HawkDir | Out-Null

$TmpDir = "$env:TEMP\hawk-install-$(Get-Date -Format 'yyyyMMddHHmmss')"
$TmpZip = "$TmpDir\hawk-os.zip"
New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null

Write-Host "    Baixando de $HawkReleaseUrl..."
Invoke-WebRequest -Uri $HawkReleaseUrl -OutFile $TmpZip -UseBasicParsing

Expand-Archive -Path $TmpZip -DestinationPath "$TmpDir\extracted" -Force
$extracted = Get-ChildItem "$TmpDir\extracted" -Directory | Select-Object -First 1
if (-not $extracted) {
  # No top-level folder — files are directly in extracted/
  Copy-Item "$TmpDir\extracted\*" -Destination $HawkDir -Recurse -Force
} else {
  Copy-Item "$($extracted.FullName)\*" -Destination $HawkDir -Recurse -Force
}

Remove-Item $TmpDir -Recurse -Force

# Save bun path
$BunBin | Out-File -FilePath "$HawkDir\.bun_path" -Encoding utf8 -NoNewline

Ok "Código extraído para $HawkDir"

# ─── Generate hawk.config.json ────────────────────────────────

@{
  autoUpdate     = $true
  updateSchedule = "0 3 * * *"
  updateUrl      = $HawkReleaseUrl -replace '\.tar\.gz$', '.zip'
  dashboardPort  = 3000
  agentApiPort   = 3001
} | ConvertTo-Json | Out-File -FilePath "$HawkDir\hawk.config.json" -Encoding utf8

# ─── Run setup wizard ─────────────────────────────────────────

Step "Configuração inicial"
$env:HAWK_DIR = $HawkDir
Set-Location $HawkDir
& $BunBin scripts/setup.ts

# ─── Install dependencies ─────────────────────────────────────

Step "Instalando dependências"
Set-Location $HawkDir
& $BunBin install --frozen-lockfile | Select-Object -Last 3
Ok "Dependências instaladas"

# ─── Apply database migrations ────────────────────────────────

Step "Configurando banco de dados"
& $BunBin run --env-file=.env scripts/migrate.ts
Ok "Migrations aplicadas"

# ─── Build Next.js ────────────────────────────────────────────

Step "Compilando dashboard (Next.js)"
Write-Host "    Isso pode levar alguns minutos..."
& $BunBin run --cwd apps/web build | Select-Object -Last 5
Ok "Dashboard compilado"

# ─── Generate PM2 ecosystem config ───────────────────────────

Step "Configurando PM2"

$HawkDirEsc = $HawkDir -replace '\\', '\\\\'
$BunBinEsc  = $BunBin  -replace '\\', '\\\\'

@"
const hawkDir = '$($HawkDir -replace "'","\'")';
const bunBin  = '$($BunBin  -replace "'","\'")';
const path    = require('node:path');

module.exports = {
  apps: [
    {
      name: 'hawk-agent',
      script: bunBin,
      args: '--env-file=' + hawkDir + '\\.env ' + hawkDir + '\\apps\\agent\\src\\index.ts',
      interpreter: 'none',
      cwd: hawkDir,
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: hawkDir + '\\logs\\agent-error.log',
      out_file:   hawkDir + '\\logs\\agent-out.log',
    },
    {
      name: 'hawk-web',
      script: bunBin,
      args: 'run start',
      interpreter: 'none',
      cwd: hawkDir + '\\apps\\web',
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      env: { NODE_ENV: 'production', PORT: '3000' },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: hawkDir + '\\logs\\web-error.log',
      out_file:   hawkDir + '\\logs\\web-out.log',
    },
  ],
};
"@ | Out-File -FilePath "$HawkDir\ecosystem.config.js" -Encoding utf8

New-Item -ItemType Directory -Force -Path "$HawkDir\logs" | Out-Null
pm2 start "$HawkDir\ecosystem.config.js"
pm2 save
Ok "Processos iniciados e salvos"

# ─── Auto-start on boot (Task Scheduler) ─────────────────────

Step "Configurando inicialização automática no boot"
try {
  pm2 startup | Out-Null
  Ok "Auto-start configurado via Task Scheduler"
} catch {
  Warn "Não foi possível configurar auto-start automaticamente."
  Write-Host "    Execute manualmente: pm2 startup" -ForegroundColor Yellow
}

# ─── Install 'hawk' CLI command ───────────────────────────────

Step "Instalando comando 'hawk'"

$BinDir = "$HawkDir\bin"
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null

# hawk.bat wrapper
@"
@echo off
powershell -ExecutionPolicy Bypass -File "$HawkDir\scripts\hawk.ps1" %*
"@ | Out-File -FilePath "$BinDir\hawk.bat" -Encoding ascii

# Add bin dir to user PATH if not already there
$userPath = [System.Environment]::GetEnvironmentVariable("Path","User") ?? ""
if ($userPath -notlike "*$BinDir*") {
  [System.Environment]::SetEnvironmentVariable("Path", "$userPath;$BinDir", "User")
  $env:PATH += ";$BinDir"
}
Ok "Comando 'hawk' instalado (reinicie o terminal para usar)"

# ─── Configure auto-update (Task Scheduler) ──────────────────

$config = Get-Content "$HawkDir\hawk.config.json" | ConvertFrom-Json
if ($config.autoUpdate -eq $true) {
  try {
    $action  = New-ScheduledTaskAction -Execute "powershell.exe" `
                 -Argument "-ExecutionPolicy Bypass -File `"$HawkDir\scripts\update.ps1`""
    $trigger = New-ScheduledTaskTrigger -Daily -At "3:00AM"
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable
    Register-ScheduledTask -TaskName "HawkOS-AutoUpdate" `
      -Action $action -Trigger $trigger -Settings $settings `
      -RunLevel Highest -Force | Out-Null
    Ok "Auto-update configurado (3:00 AM diário)"
  } catch {
    Warn "Não foi possível configurar auto-update automático."
  }
}

# ─── Done ─────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ═══════════════════════════════════════" -ForegroundColor Green
Write-Host "    ✅ Hawk OS instalado com sucesso!"     -ForegroundColor Green
Write-Host "  ═══════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard:  http://localhost:3000"       -ForegroundColor Cyan
Write-Host "  Agent:      Rodando em background no Discord"
Write-Host ""
Write-Host "  Comandos (após reiniciar o terminal):"
Write-Host "    hawk status   — ver processos"
Write-Host "    hawk logs     — ver logs"
Write-Host "    hawk update   — atualizar"
Write-Host "    hawk open     — abrir dashboard"
Write-Host ""

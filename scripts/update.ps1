# 🦅 Hawk OS — Update Script (Windows)
# Called by: hawk update  |  Task Scheduler auto-update

$ErrorActionPreference = "Stop"

$HawkDir    = if ($env:HAWK_DIR) { $env:HAWK_DIR } else { "$env:USERPROFILE\hawk-os" }
$BunPathFile = "$HawkDir\.bun_path"
$BunBin     = if (Test-Path $BunPathFile) { (Get-Content $BunPathFile -Raw).Trim() } else { "bun" }

function Log($msg) { Write-Host "[hawk-update] $msg" }

# ─── Read update URL ──────────────────────────────────────────

$config = Get-Content "$HawkDir\hawk.config.json" | ConvertFrom-Json
$UpdateUrl = $config.updateUrl

if (-not $UpdateUrl -or $UpdateUrl -like "*REPLACE_VPS_URL*") {
  Write-Host "❌ updateUrl não configurada em hawk.config.json" -ForegroundColor Red
  Write-Host "   Execute: hawk config"
  exit 1
}

# ─── Download new version ─────────────────────────────────────

Log "Baixando atualização de $UpdateUrl..."
$TmpDir = "$env:TEMP\hawk-update-$(Get-Date -Format 'yyyyMMddHHmmss')"
New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null

$TmpZip = "$TmpDir\hawk-os.zip"
Invoke-WebRequest -Uri $UpdateUrl -OutFile $TmpZip -UseBasicParsing

Expand-Archive -Path $TmpZip -DestinationPath "$TmpDir\extracted" -Force
$extracted = Get-ChildItem "$TmpDir\extracted" -Directory | Select-Object -First 1
$srcDir = if ($extracted) { $extracted.FullName } else { "$TmpDir\extracted" }

# ─── Count migrations before update ──────────────────────────

$migrationsDir = "$HawkDir\packages\db\supabase\migrations"
$OldCount = if (Test-Path $migrationsDir) { (Get-ChildItem $migrationsDir).Count } else { 0 }

# ─── Preserve user files ──────────────────────────────────────
# Copy user's files into the extracted dir so they win on merge

$preserveFiles = @('.env', 'hawk.config.json', 'ecosystem.config.js', '.bun_path')
foreach ($f in $preserveFiles) {
  $src = "$HawkDir\$f"
  if (Test-Path $src) {
    Copy-Item $src "$srcDir\$f" -Force
  }
}

# Ensure logs dir exists in extracted
New-Item -ItemType Directory -Force -Path "$srcDir\logs" | Out-Null

# ─── Apply update ─────────────────────────────────────────────

Log "Aplicando atualização..."
Copy-Item "$srcDir\*" -Destination $HawkDir -Recurse -Force
Remove-Item $TmpDir -Recurse -Force

# ─── Install dependencies ─────────────────────────────────────

Log "Instalando dependências..."
Set-Location $HawkDir
& $BunBin install --frozen-lockfile | Select-Object -Last 2

# ─── Run migrations if new ones exist ────────────────────────

$NewCount = if (Test-Path $migrationsDir) { (Get-ChildItem $migrationsDir).Count } else { 0 }
if ($NewCount -gt $OldCount) {
  $diff = $NewCount - $OldCount
  Log "Aplicando $diff nova(s) migration(s)..."
  & $BunBin run --env-file=.env scripts/migrate.ts
}

# ─── Rebuild Next.js ──────────────────────────────────────────

Log "Compilando dashboard..."
& $BunBin run --cwd apps/web build | Select-Object -Last 3

# ─── Restart services ─────────────────────────────────────────

Log "Reiniciando serviços..."
pm2 restart hawk-agent
pm2 restart hawk-web

Write-Host "[hawk-update] ✅ Atualização concluída" -ForegroundColor Green

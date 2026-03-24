# 🦅 Hawk OS — CLI (Windows)
# Usage: hawk [update|start|stop|restart|status|logs|setup|config|open]

param([string]$Command = "", [string]$Target = "")

$HawkDir    = if ($env:HAWK_DIR) { $env:HAWK_DIR } else { "$env:USERPROFILE\hawk-os" }
$BunPathFile = "$HawkDir\.bun_path"
$BunBin     = if (Test-Path $BunPathFile) { (Get-Content $BunPathFile -Raw).Trim() } else { "bun" }

switch ($Command) {
  "update" {
    & "$HawkDir\scripts\update.ps1"
  }

  "start" {
    pm2 start "$HawkDir\ecosystem.config.js"
  }

  "stop" {
    pm2 stop hawk-agent
    pm2 stop hawk-web
  }

  "restart" {
    pm2 restart hawk-agent
    pm2 restart hawk-web
  }

  "status" {
    pm2 status
  }

  "logs" {
    switch ($Target) {
      "agent" { pm2 logs hawk-agent }
      "web"   { pm2 logs hawk-web }
      default { pm2 logs }
    }
  }

  "setup" {
    $env:HAWK_DIR = $HawkDir
    Set-Location $HawkDir
    & $BunBin scripts/setup.ts
  }

  "config" {
    $editor = if ($env:EDITOR) { $env:EDITOR } else { "notepad" }
    & $editor "$HawkDir\hawk.config.json"
  }

  "open" {
    $port = 3000
    try {
      $config = Get-Content "$HawkDir\hawk.config.json" | ConvertFrom-Json
      $port = $config.dashboardPort ?? 3000
    } catch {}
    Start-Process "http://localhost:$port"
  }

  default {
    Write-Host ""
    Write-Host "  🦅 Hawk OS" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Uso: hawk <comando>"
    Write-Host ""
    Write-Host "  Comandos:"
    Write-Host "    update     Atualizar para a versão mais recente"
    Write-Host "    start      Iniciar agent e dashboard"
    Write-Host "    stop       Parar todos os serviços"
    Write-Host "    restart    Reiniciar todos os serviços"
    Write-Host "    status     Ver status dos processos"
    Write-Host "    logs       Ver logs (hawk logs [agent|web])"
    Write-Host "    setup      Reconfigurar variáveis de ambiente"
    Write-Host "    config     Editar hawk.config.json"
    Write-Host "    open       Abrir dashboard no navegador"
    Write-Host ""
  }
}

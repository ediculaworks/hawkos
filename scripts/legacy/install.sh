#!/usr/bin/env bash
set -e

# ═══════════════════════════════════════════════════════════════
#  🦅 Hawk OS — Installer for Linux/macOS
# ═══════════════════════════════════════════════════════════════
#
# Usage:
#   curl -fsSL https://your-vps.com/hawk/install.sh | bash
#   HAWK_RELEASE_URL=https://... bash install.sh
#
# ═══════════════════════════════════════════════════════════════

HAWK_RELEASE_URL="${HAWK_RELEASE_URL:-https://REPLACE_VPS_URL/hawk-os.tar.gz}"
HAWK_DIR="${HAWK_DIR:-$HOME/.hawk-os}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_banner() {
  echo ""
  echo -e "${CYAN}${BOLD}═══════════════════════════════════════${NC}"
  echo -e "${CYAN}${BOLD}  🦅 Hawk OS — Installer${NC}"
  echo -e "${CYAN}${BOLD}═══════════════════════════════════════${NC}"
  echo ""
}

step()  { echo -e "\n${BOLD}▶ $1${NC}"; }
ok()    { echo -e "  ${GREEN}✓${NC} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${NC} $1"; }
die()   { echo -e "  ${RED}✗ $1${NC}"; exit 1; }

# ─── Detect OS ────────────────────────────────────────────────

step "Detectando sistema operacional"
case "$OSTYPE" in
  darwin*)  OS="mac" ;;
  linux-gnu*) OS="linux" ;;
  *)        die "Sistema operacional não suportado: $OSTYPE" ;;
esac
ok "Sistema: $OS"

# ─── Ensure we have an interactive terminal for the wizard ────

# When running via `curl | bash`, stdin is the pipe. We need /dev/tty.
if [ ! -t 0 ]; then
  if [ -e /dev/tty ]; then
    exec < /dev/tty
  else
    die "Sem terminal interativo. Execute o script diretamente: bash install.sh"
  fi
fi

# ─── Check/install dependencies ──────────────────────────────

step "Verificando dependências"

# Node.js (needed for PM2)
if ! command -v node &>/dev/null; then
  warn "Node.js não encontrado — instalando..."
  if [[ "$OS" == "linux" ]]; then
    if command -v apt-get &>/dev/null; then
      curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - &>/dev/null
      sudo apt-get install -y nodejs &>/dev/null
    elif command -v dnf &>/dev/null; then
      sudo dnf install -y nodejs &>/dev/null
    else
      die "Gerenciador de pacotes não reconhecido. Instale Node.js manualmente: https://nodejs.org"
    fi
  elif [[ "$OS" == "mac" ]]; then
    if command -v brew &>/dev/null; then
      brew install node &>/dev/null
    else
      die "Homebrew não encontrado. Instale Node.js manualmente: https://nodejs.org"
    fi
  fi
  ok "Node.js instalado ($(node --version))"
else
  ok "Node.js $(node --version)"
fi

# Bun
if ! command -v bun &>/dev/null; then
  warn "Bun não encontrado — instalando..."
  curl -fsSL https://bun.sh/install | bash &>/dev/null
  export PATH="$HOME/.bun/bin:$PATH"
  ok "Bun instalado ($(bun --version))"
else
  ok "Bun $(bun --version)"
fi

BUN_BIN=$(which bun)

# PM2
if ! command -v pm2 &>/dev/null; then
  warn "PM2 não encontrado — instalando..."
  npm install -g pm2 &>/dev/null
  ok "PM2 instalado"
else
  ok "PM2 $(pm2 --version)"
fi

# ─── Download Hawk OS ─────────────────────────────────────────

step "Baixando Hawk OS"

if [[ "$HAWK_RELEASE_URL" == *"REPLACE_VPS_URL"* ]]; then
  die "URL de download não configurada. Configure HAWK_RELEASE_URL antes de rodar o installer."
fi

mkdir -p "$HAWK_DIR"

TMP_TAR="/tmp/hawk-os-$(date +%s).tar.gz"
echo -e "  Baixando de ${CYAN}${HAWK_RELEASE_URL}${NC}..."
curl -fsSL "$HAWK_RELEASE_URL" -o "$TMP_TAR" || die "Falha ao baixar hawk-os.tar.gz"
tar xz -C "$HAWK_DIR" --strip-components=1 -f "$TMP_TAR"
rm -f "$TMP_TAR"

# Save bun path for hawk CLI (independent of $PATH)
echo "$BUN_BIN" > "$HAWK_DIR/.bun_path"

ok "Código extraído para $HAWK_DIR"

# ─── Generate hawk.config.json ────────────────────────────────

cat > "$HAWK_DIR/hawk.config.json" << EOF
{
  "autoUpdate": true,
  "updateSchedule": "0 3 * * *",
  "updateUrl": "${HAWK_RELEASE_URL}",
  "dashboardPort": 3000,
  "agentApiPort": 3001
}
EOF

# ─── Run setup wizard ─────────────────────────────────────────

step "Configuração inicial"
export HAWK_DIR
cd "$HAWK_DIR"
"$BUN_BIN" scripts/setup.ts

# ─── Install dependencies ─────────────────────────────────────

step "Instalando dependências"
cd "$HAWK_DIR"
"$BUN_BIN" install --frozen-lockfile 2>&1 | tail -3
ok "Dependências instaladas"

# ─── Apply database migrations ────────────────────────────────

step "Configurando banco de dados"
"$BUN_BIN" run --env-file=.env scripts/migrate.ts
ok "Migrations aplicadas"

# ─── Build Next.js for production ────────────────────────────

step "Compilando dashboard (Next.js)"
echo "  Isso pode levar alguns minutos..."
"$BUN_BIN" run --cwd apps/web build 2>&1 | tail -5
ok "Dashboard compilado"

# ─── Generate PM2 ecosystem config ───────────────────────────

step "Configurando PM2"

cat > "$HAWK_DIR/ecosystem.config.js" << EOF
const hawkDir = '${HAWK_DIR}';
const bunBin  = '${BUN_BIN}';

module.exports = {
  apps: [
    {
      name: 'hawk-agent',
      script: bunBin,
      args: '--env-file=' + hawkDir + '/.env ' + hawkDir + '/apps/agent/src/index.ts',
      interpreter: 'none',
      cwd: hawkDir,
      watch: false,
      restart_delay: 3000,
      max_restarts: 10,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'hawk-web',
      script: bunBin,
      args: 'run start',
      interpreter: 'none',
      cwd: hawkDir + '/apps/web',
      watch: false,
      env: { NODE_ENV: 'production', PORT: '3000' },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
EOF

pm2 start "$HAWK_DIR/ecosystem.config.js"
ok "Processos iniciados"

pm2 save
ok "Configuração PM2 salva"

# ─── Auto-start on boot ───────────────────────────────────────

step "Configurando inicialização automática no boot"
echo ""
echo -e "  ${YELLOW}Execute o comando abaixo para ativar o auto-start:${NC}"
echo ""
pm2 startup 2>&1 | grep "sudo env" || pm2 startup 2>&1 | tail -3
echo ""

# ─── Install 'hawk' CLI command ───────────────────────────────

step "Instalando comando 'hawk'"
chmod +x "$HAWK_DIR/scripts/hawk.sh"

HAWK_BIN="/usr/local/bin/hawk"
if [ -w /usr/local/bin ]; then
  ln -sf "$HAWK_DIR/scripts/hawk.sh" "$HAWK_BIN"
elif command -v sudo &>/dev/null; then
  sudo ln -sf "$HAWK_DIR/scripts/hawk.sh" "$HAWK_BIN"
else
  warn "Não foi possível instalar em /usr/local/bin. Adicione manualmente ao PATH:"
  echo "  export PATH=\"$HAWK_DIR/scripts:\$PATH\""
  echo "  alias hawk='$HAWK_DIR/scripts/hawk.sh'"
fi
ok "Comando 'hawk' instalado"

# ─── Configure auto-update cron ──────────────────────────────

AUTO_UPDATE=$(node -e "try { const c=require('$HAWK_DIR/hawk.config.json'); console.log(c.autoUpdate); } catch(e) { console.log('false'); }" 2>/dev/null)
UPDATE_SCHEDULE=$(node -e "try { const c=require('$HAWK_DIR/hawk.config.json'); console.log(c.updateSchedule || '0 3 * * *'); } catch(e) { console.log('0 3 * * *'); }" 2>/dev/null)

if [[ "$AUTO_UPDATE" == "true" ]]; then
  chmod +x "$HAWK_DIR/scripts/update.sh"
  mkdir -p "$HAWK_DIR/logs"
  CRON_LINE="$UPDATE_SCHEDULE $HAWK_DIR/scripts/update.sh >> $HAWK_DIR/logs/update.log 2>&1"
  (crontab -l 2>/dev/null | grep -v "hawk-os\|hawk/scripts/update"; echo "$CRON_LINE") | crontab -
  ok "Auto-update configurado ($UPDATE_SCHEDULE)"
fi

# ─── Done ─────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✅ Hawk OS instalado com sucesso!${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════${NC}"
echo ""
echo -e "  Dashboard:  ${CYAN}http://localhost:3000${NC}"
echo -e "  Agent:      Rodando em background no Discord"
echo ""
echo -e "  ${BOLD}Comandos úteis:${NC}"
echo -e "  ${CYAN}hawk status${NC}   — ver processos"
echo -e "  ${CYAN}hawk logs${NC}     — ver logs"
echo -e "  ${CYAN}hawk update${NC}   — atualizar"
echo -e "  ${CYAN}hawk open${NC}     — abrir dashboard no navegador"
echo ""

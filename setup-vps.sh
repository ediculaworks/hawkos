#!/usr/bin/env bash
# =============================================================================
# Hawk OS — VPS Setup Script
# Instala tudo do zero numa VPS Ubuntu 22.04+
# Suporta resume: se travar, rode novamente e escolha continuar do ponto anterior.
#
# Uso:
#   chmod +x setup-vps.sh
#   ./setup-vps.sh
# =============================================================================

set -euo pipefail

CHECKPOINT_FILE="/tmp/hawkos-setup-checkpoint"
INSTALL_DIR="$HOME/hawkos"
VPS_IP="168.231.89.31"
REPO_URL=""  # Set dynamically in step 4

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
step() { echo -e "\n${CYAN}═══ Step $1: $2 ═══${NC}"; }

save_checkpoint() {
  echo "$1" > "$CHECKPOINT_FILE"
}

get_checkpoint() {
  if [ -f "$CHECKPOINT_FILE" ]; then
    cat "$CHECKPOINT_FILE"
  else
    echo "0"
  fi
}

# ── Check for previous run ──────────────────────────────────────────────────
last_step=$(get_checkpoint)
start_from=1

if [ "$last_step" != "0" ]; then
  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}  Setup anterior parou no step $last_step.${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "  1) Recomeçar do inicio (step 1)"
  echo "  2) Continuar do step $((last_step + 1))"
  echo ""
  read -p "  Escolha [1/2]: " choice
  case "$choice" in
    1) start_from=1; rm -f "$CHECKPOINT_FILE" ;;
    2) start_from=$((last_step + 1)) ;;
    *) echo "Opção inválida"; exit 1 ;;
  esac
fi

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        Hawk OS — VPS Setup ($VPS_IP)        ║${NC}"
echo -e "${CYAN}║  Starting from step $start_from                          ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: Update system + install essentials
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 1 ]; then
  step 1 "Atualizar sistema e instalar dependências"
  sudo apt-get update -y
  sudo apt-get upgrade -y
  sudo apt-get install -y curl git unzip ca-certificates gnupg lsb-release
  log "Sistema atualizado"
  save_checkpoint 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: Install Docker
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 2 ]; then
  step 2 "Instalar Docker"
  if command -v docker &> /dev/null; then
    warn "Docker já instalado: $(docker --version)"
  else
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    log "Docker instalado. Nota: você pode precisar re-logar para usar docker sem sudo."
  fi
  # Ensure Docker service is running
  sudo systemctl enable docker
  sudo systemctl start docker
  log "Docker ativo"
  save_checkpoint 2
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: Install Docker Compose plugin (if not bundled)
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 3 ]; then
  step 3 "Verificar Docker Compose"
  if docker compose version &> /dev/null; then
    log "Docker Compose: $(docker compose version)"
  else
    sudo apt-get install -y docker-compose-plugin
    log "Docker Compose instalado"
  fi
  save_checkpoint 3
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: Clone repository
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 4 ]; then
  step 4 "Clonar repositório"
  if [ -d "$INSTALL_DIR/.git" ]; then
    warn "Repositório já existe em $INSTALL_DIR, atualizando..."
    cd "$INSTALL_DIR"
    git pull origin main
  else
    # If directory exists but isn't a git repo, back it up
    if [ -d "$INSTALL_DIR" ]; then
      warn "Diretório $INSTALL_DIR existe mas não é git repo. Fazendo backup..."
      mv "$INSTALL_DIR" "${INSTALL_DIR}.bak.$(date +%s)"
    fi

    echo ""
    echo -e "${CYAN}── GitHub Authentication ──${NC}"
    echo "O repositório é privado. Precisamos de autenticação."
    echo ""
    read -p "  GitHub username: " GH_USER
    read -sp "  GitHub Personal Access Token (ghp_...): " GH_TOKEN
    echo ""

    REPO_URL="https://${GH_USER}:${GH_TOKEN}@github.com/ediculaworks/hawkos.git"
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"

    # Store credentials for future git pull (without token in remote URL)
    git remote set-url origin "https://github.com/ediculaworks/hawkos.git"
    git config credential.helper store
    echo "https://${GH_USER}:${GH_TOKEN}@github.com" > ~/.git-credentials
    chmod 600 ~/.git-credentials
    log "Credenciais Git salvas (git pull futuro não vai pedir senha)"
  fi
  log "Repositório pronto em $INSTALL_DIR"
  save_checkpoint 4
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: Create .env file
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 5 ]; then
  step 5 "Configurar .env"
  cd "$INSTALL_DIR"

  if [ -f .env ]; then
    warn ".env já existe. Quer sobrescrever?"
    read -p "  Sobrescrever .env? [s/N]: " overwrite
    if [ "$overwrite" != "s" ] && [ "$overwrite" != "S" ]; then
      log "Mantendo .env existente"
      save_checkpoint 5
    fi
  fi

  if [ ! -f .env ] || [ "${overwrite:-}" = "s" ] || [ "${overwrite:-}" = "S" ]; then
    MASTER_PASS=$(openssl rand -hex 16)

    echo ""
    echo -e "${CYAN}── Endereço de acesso ──${NC}"
    echo "  1) Acessar via IP: http://${VPS_IP}"
    echo "  2) Acessar via domínio (ex: hawk.meudominio.com)"
    echo ""
    read -p "  Escolha [1/2]: " access_choice

    if [ "$access_choice" = "2" ]; then
      read -p "  Digite o domínio (ex: hawk.meudominio.com): " DOMAIN
      APP_BASE="http://${DOMAIN}"
      warn "Certifique-se de que o DNS de ${DOMAIN} aponta para ${VPS_IP}"
    else
      APP_BASE="http://${VPS_IP}"
    fi

    echo ""
    echo -e "${CYAN}── Admin Supabase ──${NC}"
    echo "Crie um projeto em https://supabase.com e pegue as credenciais em Settings → API"
    echo ""

    read -p "  Admin Supabase URL (ex: https://abc123.supabase.co): " ADMIN_URL
    read -p "  Admin Supabase Anon Key: " ADMIN_ANON
    read -p "  Admin Supabase Service Role Key: " ADMIN_SERVICE
    echo ""
    echo "Obtenha o Personal Access Token em: https://app.supabase.com/account/tokens"
    read -p "  Supabase Personal Access Token: " SB_TOKEN

    cat > .env << ENVEOF
# =============================================================================
# Hawk OS — Environment Variables (gerado por setup-vps.sh em $(date))
# =============================================================================

NODE_ENV=production
APP_URL=${APP_BASE}
NEXT_PUBLIC_APP_URL=${APP_BASE}

# Admin Supabase (plataforma central)
ADMIN_SUPABASE_URL=${ADMIN_URL}
NEXT_PUBLIC_ADMIN_SUPABASE_URL=${ADMIN_URL}
ADMIN_SUPABASE_ANON_KEY=${ADMIN_ANON}
ADMIN_SUPABASE_SERVICE_KEY=${ADMIN_SERVICE}

# Supabase Access Token (para onboarding aplicar migrations)
SUPABASE_ACCESS_TOKEN=${SB_TOKEN}

# Onboarding
ONBOARDING_MASTER_PASSWORD=${MASTER_PASS}

# Heartbeat
HEARTBEAT_PROFILE=companion
HEARTBEAT_ACTIVE_HOURS=08:00-22:00
ENVEOF

    log ".env criado com APP_URL=${APP_BASE}"
    echo ""
    warn "ONBOARDING_MASTER_PASSWORD gerado: ${MASTER_PASS}"
    warn "Guarde essa senha em local seguro! Ela permite resetar qualquer conta."
    echo ""
  fi
  save_checkpoint 5
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: Open firewall port 80
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 6 ]; then
  step 6 "Configurar firewall"
  if command -v ufw &> /dev/null; then
    sudo ufw allow 80/tcp
    sudo ufw allow 22/tcp
    # Don't enable ufw if it's not already active (could lock out SSH)
    if sudo ufw status | grep -q "inactive"; then
      warn "UFW está inativo. Para ativar: sudo ufw enable"
    else
      log "UFW: porta 80 liberada"
    fi
  else
    warn "UFW não encontrado. Verifique manualmente se a porta 80 está aberta."
  fi
  save_checkpoint 6
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7: Build and start containers
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 7 ]; then
  step 7 "Build e start dos containers (pode demorar na 1ª vez)"
  cd "$INSTALL_DIR"

  echo "  Fazendo build... (isso leva 3-5 minutos na primeira vez)"
  docker compose build --no-cache 2>&1 | tail -5

  echo "  Iniciando containers..."
  docker compose up -d

  log "Containers iniciados"
  save_checkpoint 7
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8: Wait for web to be healthy
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 8 ]; then
  step 8 "Aguardando web ficar saudável"
  cd "$INSTALL_DIR"

  echo "  Aguardando (até 60s)..."
  for i in $(seq 1 12); do
    if curl -sf http://localhost:80 > /dev/null 2>&1; then
      log "Web está respondendo!"
      break
    fi
    if [ "$i" -eq 12 ]; then
      err "Web não respondeu após 60s. Verifique: docker compose logs web"
      save_checkpoint 7  # Allow retry from build step
      exit 1
    fi
    sleep 5
  done
  save_checkpoint 8
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 9: Show status
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 9 ]; then
  step 9 "Status final"
  cd "$INSTALL_DIR"

  # Read APP_URL from .env
  FINAL_URL=$(grep '^APP_URL=' .env | cut -d= -f2-)

  echo ""
  docker compose ps
  echo ""

  # Cleanup checkpoint
  rm -f "$CHECKPOINT_FILE"

  echo ""
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║              Hawk OS instalado com sucesso!                  ║${NC}"
  echo -e "${GREEN}╠═══════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║                                                             ║${NC}"
  echo -e "${GREEN}║  Dashboard:  ${FINAL_URL}${NC}"
  echo -e "${GREEN}║  Onboarding: ${FINAL_URL}/onboarding${NC}"
  echo -e "${GREEN}║                                                             ║${NC}"
  echo -e "${GREEN}║  Próximos passos:                                           ║${NC}"
  echo -e "${GREEN}║  1. Acesse ${FINAL_URL}/onboarding${NC}"
  echo -e "${GREEN}║  2. Para cada usuário (até 6):                              ║${NC}"
  echo -e "${GREEN}║     - Criar projeto Supabase pessoal                        ║${NC}"
  echo -e "${GREEN}║     - Criar bot Discord                                     ║${NC}"
  echo -e "${GREEN}║     - Obter OpenRouter API key                              ║${NC}"
  echo -e "${GREEN}║     - Completar o wizard de onboarding                      ║${NC}"
  echo -e "${GREEN}║                                                             ║${NC}"
  echo -e "${GREEN}║  Comandos úteis (rodar em $INSTALL_DIR):                    ║${NC}"
  echo -e "${GREEN}║    docker compose logs -f web         # logs do web         ║${NC}"
  echo -e "${GREEN}║    docker compose logs -f agent-ten1  # logs agent 1        ║${NC}"
  echo -e "${GREEN}║    docker compose ps                  # status              ║${NC}"
  echo -e "${GREEN}║    docker compose restart              # reiniciar          ║${NC}"
  echo -e "${GREEN}║    docker compose down                 # parar tudo         ║${NC}"
  echo -e "${GREEN}║    docker compose up -d --build        # rebuild            ║${NC}"
  echo -e "${GREEN}║                                                             ║${NC}"
  echo -e "${GREEN}║  Quando tiver domínio:                                      ║${NC}"
  echo -e "${GREEN}║    1. Editar .env → APP_URL e NEXT_PUBLIC_APP_URL           ║${NC}"
  echo -e "${GREEN}║    2. docker compose up -d --build                          ║${NC}"
  echo -e "${GREEN}║                                                             ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
fi

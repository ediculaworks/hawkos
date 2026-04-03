#!/usr/bin/env bash
# =============================================================================
# Hawk OS — VPS Setup Script
# Instala tudo do zero numa VPS Ubuntu 22.04+ (testado em KVM4 Hostinger)
# Suporta resume: se travar, rode novamente e escolha continuar do ponto anterior.
#
# O que faz:
#   1. Actualiza sistema e instala essenciais
#   2. Cria user 'hawk' com sudo (nao roda como root)
#   3. Hardening SSH (key-based auth, desabilita root login)
#   4. Instala fail2ban (protecao contra brute force)
#   5. Cria swap 2GB (previne OOM em VPS com pouca RAM)
#   6. Instala Docker + Docker Compose
#   7. Clona repositorio
#   8. Gera .env interactivamente
#   9. Configura firewall (22, 80, 443)
#  10. Configura logrotate + unattended-upgrades
#  11. Build e start dos containers
#  12. Health check + status final
#
# Uso:
#   chmod +x setup-vps.sh
#   ./setup-vps.sh
# =============================================================================

set -euo pipefail

CHECKPOINT_FILE="/tmp/hawkos-setup-checkpoint"
INSTALL_DIR="/docker/hawkos"
HAWK_USER="hawk"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
step() { echo -e "\n${CYAN}═══ Step $1/$TOTAL_STEPS: $2 ═══${NC}"; }

TOTAL_STEPS=12

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

# ── Must run as root ───────────────────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
  err "Este script deve ser rodado como root (sudo ./setup-vps.sh)"
  exit 1
fi

# ── Detect VPS IP ──────────────────────────────────────────────────────────────
VPS_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "unknown")

# ── Check for previous run ─────────────────────────────────────────────────────
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
echo -e "${CYAN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          Hawk OS — VPS Setup (${VPS_IP})${NC}"
echo -e "${CYAN}║          Starting from step ${start_from}/${TOTAL_STEPS}${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: Update system + install essentials
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 1 ]; then
  step 1 "Atualizar sistema e instalar dependências"
  apt-get update -y
  apt-get upgrade -y
  apt-get install -y \
    curl git unzip ca-certificates gnupg lsb-release \
    openssl jq
  log "Sistema atualizado"
  save_checkpoint 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: Create 'hawk' user with sudo
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 2 ]; then
  step 2 "Criar user '${HAWK_USER}' com sudo"

  if id "$HAWK_USER" &>/dev/null; then
    warn "User '$HAWK_USER' já existe"
  else
    useradd -m -s /bin/bash "$HAWK_USER"
    usermod -aG sudo "$HAWK_USER"
    log "User '$HAWK_USER' criado"
  fi

  # Passwordless sudo for hawk
  echo "${HAWK_USER} ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/${HAWK_USER}"
  chmod 440 "/etc/sudoers.d/${HAWK_USER}"
  log "Sudo sem password configurado"

  # Copy SSH authorized_keys from root
  if [ -f /root/.ssh/authorized_keys ]; then
    mkdir -p "/home/${HAWK_USER}/.ssh"
    cp /root/.ssh/authorized_keys "/home/${HAWK_USER}/.ssh/"
    chown -R "${HAWK_USER}:${HAWK_USER}" "/home/${HAWK_USER}/.ssh"
    chmod 700 "/home/${HAWK_USER}/.ssh"
    chmod 600 "/home/${HAWK_USER}/.ssh/authorized_keys"
    log "SSH keys copiadas de root para ${HAWK_USER}"
  else
    warn "Nenhuma authorized_keys encontrada em /root/.ssh/"
    warn "Você precisará adicionar sua SSH key manualmente em /home/${HAWK_USER}/.ssh/authorized_keys"
  fi

  # Add hawk to docker group (will be created in Docker step)
  usermod -aG docker "$HAWK_USER" 2>/dev/null || true

  save_checkpoint 2
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: SSH Hardening
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 3 ]; then
  step 3 "Hardening SSH"

  SSHD_CONFIG="/etc/ssh/sshd_config"
  SSHD_BACKUP="/etc/ssh/sshd_config.bak.$(date +%s)"

  # Backup original config
  cp "$SSHD_CONFIG" "$SSHD_BACKUP"
  log "Backup do sshd_config em $SSHD_BACKUP"

  # Disable root login
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' "$SSHD_CONFIG"
  log "Root login desabilitado"

  # Disable password authentication
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD_CONFIG"
  log "Autenticação por password desabilitada (apenas SSH keys)"

  # Disable empty passwords
  sed -i 's/^#\?PermitEmptyPasswords.*/PermitEmptyPasswords no/' "$SSHD_CONFIG"

  # Limit max auth tries
  sed -i 's/^#\?MaxAuthTries.*/MaxAuthTries 3/' "$SSHD_CONFIG"
  log "Max auth tries: 3"

  # Disable X11 forwarding
  sed -i 's/^#\?X11Forwarding.*/X11Forwarding no/' "$SSHD_CONFIG"

  # Validate config before restart
  if sshd -t 2>/dev/null; then
    systemctl restart sshd
    log "SSH reiniciado com nova configuração"
  else
    err "Erro na config SSH. Restaurando backup..."
    cp "$SSHD_BACKUP" "$SSHD_CONFIG"
    systemctl restart sshd
    err "Config restaurada. Verifique manualmente."
  fi

  warn "IMPORTANTE: Antes de fechar esta sessão, teste SSH com o user '${HAWK_USER}':"
  warn "  ssh ${HAWK_USER}@${VPS_IP}"

  save_checkpoint 3
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: Install fail2ban
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 4 ]; then
  step 4 "Instalar fail2ban"

  apt-get install -y fail2ban

  cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200
EOF

  systemctl enable fail2ban
  systemctl restart fail2ban
  log "fail2ban instalado e configurado (ban 2h após 3 tentativas SSH)"

  save_checkpoint 4
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: Create swap (2GB)
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 5 ]; then
  step 5 "Criar swap (2GB)"

  if swapon --show | grep -q '/swapfile'; then
    warn "Swap já existe:"
    swapon --show
  else
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile

    # Persist across reboots
    if ! grep -q '/swapfile' /etc/fstab; then
      echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi

    # Tune swappiness (low value = prefer RAM)
    sysctl vm.swappiness=10
    if ! grep -q 'vm.swappiness' /etc/sysctl.conf; then
      echo 'vm.swappiness=10' >> /etc/sysctl.conf
    fi

    log "Swap 2GB criado e ativado"
  fi
  swapon --show

  save_checkpoint 5
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: Install Docker + Docker Compose
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 6 ]; then
  step 6 "Instalar Docker"

  if command -v docker &> /dev/null; then
    warn "Docker já instalado: $(docker --version)"
  else
    curl -fsSL https://get.docker.com | sh
    log "Docker instalado"
  fi

  # Ensure hawk user is in docker group
  usermod -aG docker "$HAWK_USER"

  systemctl enable docker
  systemctl start docker
  log "Docker ativo"

  # Verify Docker Compose
  if docker compose version &> /dev/null; then
    log "Docker Compose: $(docker compose version)"
  else
    apt-get install -y docker-compose-plugin
    log "Docker Compose instalado"
  fi

  save_checkpoint 6
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7: Clone repository
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 7 ]; then
  step 7 "Clonar repositório"

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
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"

    # Store credentials for future git pull (without token in remote URL)
    git remote set-url origin "https://github.com/ediculaworks/hawkos.git"
    git config credential.helper store
    echo "https://${GH_USER}:${GH_TOKEN}@github.com" > "/home/${HAWK_USER}/.git-credentials"
    chmod 600 "/home/${HAWK_USER}/.git-credentials"
    chown "${HAWK_USER}:${HAWK_USER}" "/home/${HAWK_USER}/.git-credentials"
    log "Credenciais Git salvas para o user ${HAWK_USER}"
  fi

  # Ensure hawk owns the install dir
  chown -R "${HAWK_USER}:${HAWK_USER}" "$INSTALL_DIR"
  log "Repositório pronto em $INSTALL_DIR"

  save_checkpoint 7
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8: Create .env file
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 8 ]; then
  step 8 "Configurar .env"
  cd "$INSTALL_DIR"

  if [ -f .env ]; then
    warn ".env já existe. Quer sobrescrever?"
    read -p "  Sobrescrever .env? [s/N]: " overwrite
    if [ "$overwrite" != "s" ] && [ "$overwrite" != "S" ]; then
      log "Mantendo .env existente"
      save_checkpoint 8
    fi
  fi

  if [ ! -f .env ] || [ "${overwrite:-}" = "s" ] || [ "${overwrite:-}" = "S" ]; then
    MASTER_PASS=$(openssl rand -hex 16)
    JWT_SECRET=$(openssl rand -hex 32)
    ADMIN_MASTER_KEY=$(openssl rand -hex 32)
    POSTGRES_PASSWORD=$(openssl rand -hex 16)

    echo ""
    echo -e "${CYAN}── Endereço de acesso ──${NC}"
    echo "  1) Acessar via IP: http://${VPS_IP}"
    echo "  2) Acessar via domínio com HTTPS (ex: hawk.meudominio.com)"
    echo ""
    read -p "  Escolha [1/2]: " access_choice

    DOMAIN=""
    if [ "$access_choice" = "2" ]; then
      read -p "  Digite o domínio (ex: hawk.meudominio.com): " DOMAIN
      APP_BASE="https://${DOMAIN}"
      warn "Certifique-se de que o DNS de ${DOMAIN} aponta para ${VPS_IP}"
    else
      APP_BASE="http://${VPS_IP}"
    fi

    echo ""
    echo -e "${CYAN}── Discord Bot ──${NC}"
    echo "Crie um bot em https://discord.com/developers/applications"
    echo ""
    read -p "  Discord Bot Token: " DISCORD_BOT_TOKEN
    read -p "  Discord Client ID: " DISCORD_CLIENT_ID
    read -p "  Discord Guild (Server) ID: " DISCORD_GUILD_ID
    read -p "  Discord Channel ID (canal do hawk): " DISCORD_CHANNEL_ID
    read -p "  Discord Authorized User ID (teu user ID): " DISCORD_USER_ID

    echo ""
    echo -e "${CYAN}── OpenRouter (AI) ──${NC}"
    echo "Obtenha a API key em https://openrouter.ai/keys"
    echo ""
    read -p "  OpenRouter API Key: " OPENROUTER_KEY
    read -p "  OpenRouter Model [openrouter/auto]: " OPENROUTER_MODEL
    OPENROUTER_MODEL=${OPENROUTER_MODEL:-openrouter/auto}
    read -p "  Max Tokens [4096]: " OPENROUTER_TOKENS
    OPENROUTER_TOKENS=${OPENROUTER_TOKENS:-4096}

    AGENT_API_SECRET=$(openssl rand -hex 16)

    cat > .env << ENVEOF
# =============================================================================
# Hawk OS — Environment Variables (gerado por setup-vps.sh em $(date))
# =============================================================================

NODE_ENV=production
APP_URL=${APP_BASE}
NEXT_PUBLIC_APP_URL=${APP_BASE}
DOMAIN=${DOMAIN}

# ── Database (PostgreSQL local via Docker) ──
POSTGRES_USER=hawkos
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=postgres://hawkos:${POSTGRES_PASSWORD}@postgres:5432/hawkos
DATABASE_POOL_URL=postgres://hawkos:${POSTGRES_PASSWORD}@pgbouncer:6432/hawkos

# ── Auth ──
JWT_SECRET=${JWT_SECRET}
ADMIN_MASTER_KEY=${ADMIN_MASTER_KEY}

# ── Discord ──
DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN}
DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID}
DISCORD_GUILD_ID=${DISCORD_GUILD_ID}
DISCORD_CHANNEL_ID=${DISCORD_CHANNEL_ID}
DISCORD_AUTHORIZED_USER_ID=${DISCORD_USER_ID}

# ── OpenRouter (AI) ──
OPENROUTER_API_KEY=${OPENROUTER_KEY}
OPENROUTER_MODEL=${OPENROUTER_MODEL}
OPENROUTER_MAX_TOKENS=${OPENROUTER_TOKENS}

# ── Agent API (Mission Control) ──
AGENT_API_PORT=3001
AGENT_API_SECRET=${AGENT_API_SECRET}
NEXT_PUBLIC_AGENT_API_TOKEN=${AGENT_API_SECRET}

# ── Onboarding ──
ONBOARDING_MASTER_PASSWORD=${MASTER_PASS}

# ── Heartbeat ──
HEARTBEAT_PROFILE=companion
HEARTBEAT_ACTIVE_HOURS=08:00-22:00
ENVEOF

    # Set secure permissions
    chmod 600 .env
    chown "${HAWK_USER}:${HAWK_USER}" .env

    log ".env criado com APP_URL=${APP_BASE}"
    echo ""
    echo -e "${BOLD}Credenciais geradas (guarde em local seguro):${NC}"
    echo -e "  ONBOARDING_MASTER_PASSWORD: ${YELLOW}${MASTER_PASS}${NC}"
    echo -e "  POSTGRES_PASSWORD:          ${YELLOW}${POSTGRES_PASSWORD}${NC}"
    echo -e "  AGENT_API_SECRET:           ${YELLOW}${AGENT_API_SECRET}${NC}"
    echo -e "  JWT_SECRET:                 ${YELLOW}${JWT_SECRET:0:16}...${NC}"
    echo -e "  ADMIN_MASTER_KEY:           ${YELLOW}${ADMIN_MASTER_KEY:0:16}...${NC}"
    echo ""
    warn "Guarde essas credenciais! Elas não podem ser recuperadas."
    echo ""
  fi
  save_checkpoint 8
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 9: Configure firewall
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 9 ]; then
  step 9 "Configurar firewall (UFW)"

  if ! command -v ufw &> /dev/null; then
    apt-get install -y ufw
  fi

  # Allow SSH first (critical — never lock yourself out)
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp

  # Default deny incoming, allow outgoing
  ufw default deny incoming
  ufw default allow outgoing

  # Enable UFW (non-interactive)
  echo "y" | ufw enable
  log "UFW ativado com portas 22, 80, 443"
  ufw status verbose

  save_checkpoint 9
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 10: Logrotate + unattended-upgrades
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 10 ]; then
  step 10 "Configurar logrotate e actualizações automáticas"

  # Docker log rotation (belt-and-suspenders with docker-compose logging config)
  cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
  systemctl restart docker
  log "Docker log rotation configurado (10MB × 3 ficheiros)"

  # Unattended security upgrades
  apt-get install -y unattended-upgrades
  cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
  log "Unattended-upgrades configurado (security patches automáticos)"

  save_checkpoint 10
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 11: Build and start containers
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 11 ]; then
  step 11 "Build e start dos containers"
  cd "$INSTALL_DIR"

  echo "  Fazendo build... (isso leva 3-5 minutos na primeira vez)"
  docker compose build --no-cache 2>&1 | tail -10

  echo "  Iniciando containers..."
  docker compose up -d

  log "Containers iniciados"
  save_checkpoint 11
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 12: Health check + final status
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$start_from" -le 12 ]; then
  step 12 "Health check e status final"
  cd "$INSTALL_DIR"

  echo "  Aguardando containers ficarem saudáveis (até 90s)..."

  TIMEOUT=90
  INTERVAL=5
  ELAPSED=0
  WEB_OK=false

  while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
    if curl -sf http://localhost:80 > /dev/null 2>&1; then
      WEB_OK=true
      break
    fi
    echo "  Aguardando... (${ELAPSED}s/${TIMEOUT}s)"
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
  done

  if [ "$WEB_OK" = false ]; then
    err "Web não respondeu após ${TIMEOUT}s."
    err "Verifique: docker compose logs web"
    save_checkpoint 11  # Allow retry from build step
    exit 1
  fi

  log "Web está respondendo!"

  # Read APP_URL from .env
  FINAL_URL=$(grep '^APP_URL=' .env | cut -d= -f2-)

  # Cleanup checkpoint
  rm -f "$CHECKPOINT_FILE"

  echo ""
  docker compose ps
  echo ""
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║              Hawk OS instalado com sucesso!                  ║${NC}"
  echo -e "${GREEN}╠═══════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║                                                             ║${NC}"
  echo -e "${GREEN}║  Dashboard:  ${FINAL_URL}${NC}"
  echo -e "${GREEN}║  Onboarding: ${FINAL_URL}/onboarding${NC}"
  echo -e "${GREEN}║                                                             ║${NC}"
  echo -e "${GREEN}║  Segurança configurada:                                     ║${NC}"
  echo -e "${GREEN}║    ✓ User '${HAWK_USER}' (não usa root)${NC}"
  echo -e "${GREEN}║    ✓ SSH: apenas key-based auth                             ║${NC}"
  echo -e "${GREEN}║    ✓ fail2ban: ban 2h após 3 tentativas                     ║${NC}"
  echo -e "${GREEN}║    ✓ UFW: portas 22, 80, 443                                ║${NC}"
  echo -e "${GREEN}║    ✓ Swap 2GB + unattended-upgrades                         ║${NC}"
  echo -e "${GREEN}║    ✓ Docker log rotation                                    ║${NC}"
  echo -e "${GREEN}║                                                             ║${NC}"
  echo -e "${GREEN}║  Próximos passos:                                           ║${NC}"
  echo -e "${GREEN}║  1. Teste SSH: ssh ${HAWK_USER}@${VPS_IP}${NC}"
  echo -e "${GREEN}║  2. Acesse ${FINAL_URL}/onboarding${NC}"
  echo -e "${GREEN}║  3. Para cada usuário (até 6):                              ║${NC}"
  echo -e "${GREEN}║     - Criar projeto Supabase pessoal                        ║${NC}"
  echo -e "${GREEN}║     - Criar bot Discord                                     ║${NC}"
  echo -e "${GREEN}║     - Obter OpenRouter API key                              ║${NC}"
  echo -e "${GREEN}║     - Completar o wizard de onboarding                      ║${NC}"
  echo -e "${GREEN}║                                                             ║${NC}"
  echo -e "${GREEN}║  Deploy futuro:                                             ║${NC}"
  echo -e "${GREEN}║    cd $INSTALL_DIR && ./deploy.sh                           ║${NC}"
  echo -e "${GREEN}║                                                             ║${NC}"
  echo -e "${GREEN}║  Comandos úteis:                                            ║${NC}"
  echo -e "${GREEN}║    docker compose logs -f web         # logs do web         ║${NC}"
  echo -e "${GREEN}║    docker compose logs -f agent-ten1  # logs agent 1        ║${NC}"
  echo -e "${GREEN}║    docker compose ps                  # status              ║${NC}"
  echo -e "${GREEN}║    fail2ban-client status sshd        # bans SSH            ║${NC}"
  echo -e "${GREEN}║                                                             ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
fi

#!/usr/bin/env bash
set -euo pipefail

# ─── Hawk OS — Deploy Script ────────────────────────────────────────────────
# Usage:
#   ./deploy.sh                  # full deploy (pull + backup + build + up)
#   ./deploy.sh --skip-backup    # skip pg_dump before deploy
#   ./deploy.sh --no-pull        # rebuild without git pull
#   ./deploy.sh --help           # show usage

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ─── Colors ──────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log()   { echo -e "${BLUE}[deploy]${NC} $*"; }
ok()    { echo -e "${GREEN}  ✅ $*${NC}"; }
warn()  { echo -e "${YELLOW}  ⚠️  $*${NC}"; }
fail()  { echo -e "${RED}  ❌ $*${NC}"; }
header(){ echo -e "\n${BOLD}─── $* ───${NC}"; }

# ─── Parse flags ─────────────────────────────────────────────────────────────

SKIP_BACKUP=false
NO_PULL=false

for arg in "$@"; do
  case "$arg" in
    --skip-backup) SKIP_BACKUP=true ;;
    --no-pull)     NO_PULL=true ;;
    --help|-h)
      echo "Usage: ./deploy.sh [--skip-backup] [--no-pull] [--help]"
      echo ""
      echo "  --skip-backup   Skip PostgreSQL backup before deploy"
      echo "  --no-pull       Rebuild without running git pull"
      echo "  --help          Show this message"
      exit 0
      ;;
    *) fail "Unknown flag: $arg"; exit 1 ;;
  esac
done

START_TIME=$(date +%s)
MIGRATIONS_APPLIED=0

# ─── Step 1: Pre-requisites ─────────────────────────────────────────────────

header "Pre-requisites"

if ! command -v docker &>/dev/null; then
  fail "docker not found. Install Docker first."
  exit 1
fi
ok "docker found"

if ! docker compose version &>/dev/null; then
  fail "docker compose not found. Install Docker Compose V2."
  exit 1
fi
ok "docker compose found"

if [[ ! -f .env ]]; then
  fail ".env file not found. Copy .env.example and configure it."
  exit 1
fi
ok ".env exists"

# Check required env vars
source <(grep -E '^(POSTGRES_PASSWORD|DATABASE_URL)=' .env 2>/dev/null || true)
if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  fail "POSTGRES_PASSWORD not set in .env"
  exit 1
fi
ok "Required env vars present"

# ─── Step 2: Git pull ───────────────────────────────────────────────────────

header "Git Pull"

# Count migrations before pull
MIGRATIONS_BEFORE=$(find packages/db/supabase/migrations -name '*.sql' 2>/dev/null | wc -l | tr -d ' ')

if [[ "$NO_PULL" == true ]]; then
  warn "Skipping git pull (--no-pull)"
else
  # Check for uncommitted changes
  if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
    warn "Uncommitted changes detected. Stashing..."
    git stash push -m "deploy-$(date +%Y%m%d-%H%M%S)"
    ok "Changes stashed"
  fi

  git pull origin main
  if [[ $? -ne 0 ]]; then
    fail "git pull failed. Resolve conflicts manually."
    exit 1
  fi
  ok "Code updated"
fi

# Count migrations after pull
MIGRATIONS_AFTER=$(find packages/db/supabase/migrations -name '*.sql' 2>/dev/null | wc -l | tr -d ' ')
NEW_MIGRATIONS=$((MIGRATIONS_AFTER - MIGRATIONS_BEFORE))

if [[ $NEW_MIGRATIONS -gt 0 ]]; then
  log "$NEW_MIGRATIONS new migration(s) detected"
else
  log "No new migrations"
fi

# ─── Step 3: Backup ─────────────────────────────────────────────────────────

header "Database Backup"

BACKUP_DIR="/data/backups/deploy"

if [[ "$SKIP_BACKUP" == true ]]; then
  warn "Skipping backup (--skip-backup)"
else
  # Check if postgres container is running
  if docker compose ps --status running postgres 2>/dev/null | grep -q postgres; then
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/hawkos-$(date +%Y%m%d-%H%M%S).sql.gz"
    POSTGRES_USER="${POSTGRES_USER:-hawkos}"

    log "Backing up to $BACKUP_FILE..."
    docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" hawkos | gzip > "$BACKUP_FILE"

    if [[ -f "$BACKUP_FILE" ]] && [[ $(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE" 2>/dev/null) -gt 0 ]]; then
      BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
      ok "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

      # Retention: keep last 5 deploy backups
      BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/hawkos-*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
      if [[ $BACKUP_COUNT -gt 5 ]]; then
        ls -1t "$BACKUP_DIR"/hawkos-*.sql.gz | tail -n +6 | xargs rm -f
        ok "Old backups cleaned (kept last 5)"
      fi
    else
      fail "Backup file is empty or missing"
      exit 1
    fi
  else
    warn "PostgreSQL not running — skipping backup"
  fi
fi

# ─── Step 4: Migrations ─────────────────────────────────────────────────────

header "Migrations"

if [[ $NEW_MIGRATIONS -gt 0 ]]; then
  if docker compose ps --status running postgres 2>/dev/null | grep -q postgres; then
    log "Applying $NEW_MIGRATIONS new migration(s)..."

    # Run migrations using bun inside a temporary container
    docker compose run --rm -T --no-deps \
      -e DATABASE_URL="${DATABASE_URL:-postgres://${POSTGRES_USER:-hawkos}:${POSTGRES_PASSWORD}@postgres:5432/hawkos}" \
      web bun run /app/scripts/apply-migrations.ts 2>&1 | while IFS= read -r line; do
        echo "  $line"
    done

    MIGRATIONS_APPLIED=$NEW_MIGRATIONS
    ok "$MIGRATIONS_APPLIED migration(s) applied"
  else
    warn "PostgreSQL not running — migrations will run after containers start"
    warn "You may need to run: docker compose exec web bun run scripts/apply-migrations.ts"
  fi
else
  ok "No migrations to apply"
fi

# ─── Step 5: Build ──────────────────────────────────────────────────────────

header "Docker Build"

log "Building images..."
docker compose build 2>&1 | tail -20
ok "Images built"

# ─── Step 6: Start containers ───────────────────────────────────────────────

header "Start Containers"

log "Starting services..."
docker compose up -d
ok "Containers started"

# ─── Step 7: Health checks ──────────────────────────────────────────────────

header "Health Checks"

TIMEOUT=90
INTERVAL=5
ELAPSED=0
ALL_HEALTHY=false

# Get list of services defined in compose
SERVICES=$(docker compose ps --format '{{.Service}}' 2>/dev/null | sort -u)

while [[ $ELAPSED -lt $TIMEOUT ]]; do
  UNHEALTHY=()

  for svc in $SERVICES; do
    STATUS=$(docker compose ps --format '{{.Health}}' "$svc" 2>/dev/null | head -1)
    # Skip services without health checks (pgbouncer)
    if [[ -z "$STATUS" || "$STATUS" == "" ]]; then
      continue
    fi
    if [[ "$STATUS" != "healthy" ]]; then
      UNHEALTHY+=("$svc")
    fi
  done

  if [[ ${#UNHEALTHY[@]} -eq 0 ]]; then
    ALL_HEALTHY=true
    break
  fi

  log "Waiting for: ${UNHEALTHY[*]} (${ELAPSED}s/${TIMEOUT}s)"
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

if [[ "$ALL_HEALTHY" == true ]]; then
  ok "All services healthy"
else
  fail "Some services failed health checks after ${TIMEOUT}s:"
  for svc in "${UNHEALTHY[@]}"; do
    fail "  $svc — showing last 10 log lines:"
    docker compose logs --tail=10 "$svc" 2>&1 | sed 's/^/    /'
  done
  echo ""
  warn "Deploy completed but some services are unhealthy. Check logs above."
fi

# ─── Summary ─────────────────────────────────────────────────────────────────

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

header "Deploy Summary"
echo ""
echo -e "  ${BOLD}Duration:${NC}    ${DURATION}s"
echo -e "  ${BOLD}Migrations:${NC}  ${MIGRATIONS_APPLIED} applied"
echo -e "  ${BOLD}Backup:${NC}      $(if [[ "$SKIP_BACKUP" == true ]]; then echo "skipped"; elif [[ -n "${BACKUP_FILE:-}" ]]; then echo "$BACKUP_FILE"; else echo "n/a (postgres not running)"; fi)"
echo ""

# Show container status
docker compose ps --format 'table {{.Service}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || docker compose ps

# Check if Caddy/HTTPS is working
DOMAIN=$(grep '^DOMAIN=' .env 2>/dev/null | cut -d= -f2-)
if [[ -n "$DOMAIN" && "$DOMAIN" != "localhost" ]]; then
  echo ""
  if curl -sf --max-time 5 "https://${DOMAIN}" > /dev/null 2>&1; then
    ok "HTTPS: https://${DOMAIN} is reachable"
  else
    warn "HTTPS not yet reachable at https://${DOMAIN} (Caddy may still be getting certificate)"
  fi
fi

echo ""
if [[ "$ALL_HEALTHY" == true ]]; then
  echo -e "${GREEN}${BOLD}Deploy completed successfully.${NC}"
else
  echo -e "${YELLOW}${BOLD}Deploy completed with warnings. Check unhealthy services.${NC}"
fi

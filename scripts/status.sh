#!/usr/bin/env bash
# =============================================================================
# Hawk OS — System Status Overview
# Quick dashboard of all services, health, resources, and recent errors.
#
# Usage:
#   ./status.sh             # full overview
#   ssh hawkos-prod "/docker/hawkos/scripts/status.sh"
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          Hawk OS — System Status              ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# ── Containers ────────────────────────────────────────────────────────────────
echo -e "${BOLD}=== Containers ===${NC}"
docker compose ps --format 'table {{.Service}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || docker compose ps
echo ""

# ── Health Checks ─────────────────────────────────────────────────────────────
echo -e "${BOLD}=== Health ===${NC}"

# Web
WEB_HEALTH=$(curl -sf --max-time 3 http://localhost:3000/health 2>/dev/null)
if [ -n "$WEB_HEALTH" ]; then
  WEB_OK=$(echo "$WEB_HEALTH" | jq -r '.ok // false')
  WEB_DB=$(echo "$WEB_HEALTH" | jq -r '.db_latency_ms // "?"')
  if [ "$WEB_OK" = "true" ]; then
    echo -e "  Web:   ${GREEN}OK${NC} (db: ${WEB_DB}ms)"
  else
    echo -e "  Web:   ${RED}DEGRADED${NC}"
  fi
else
  echo -e "  Web:   ${RED}UNREACHABLE${NC}"
fi

# Agents
for i in 1 2 3 4 5 6; do
  PORT=$((3010 + i))
  AGENT_HEALTH=$(curl -sf --max-time 2 "http://localhost:$PORT/health" 2>/dev/null)
  if [ -n "$AGENT_HEALTH" ]; then
    A_OK=$(echo "$AGENT_HEALTH" | jq -r '.ok // false')
    A_UP=$(echo "$AGENT_HEALTH" | jq -r '.uptime_seconds // 0')
    # Format uptime
    if [ "$A_UP" -gt 86400 ] 2>/dev/null; then
      UPTIME="$((A_UP / 86400))d"
    elif [ "$A_UP" -gt 3600 ] 2>/dev/null; then
      UPTIME="$((A_UP / 3600))h"
    else
      UPTIME="${A_UP}s"
    fi
    if [ "$A_OK" = "true" ]; then
      echo -e "  ten$i:  ${GREEN}OK${NC} (up: ${UPTIME})"
    else
      echo -e "  ten$i:  ${YELLOW}DEGRADED${NC} (up: ${UPTIME})"
    fi
  fi
done
echo ""

# ── Resources ─────────────────────────────────────────────────────────────────
echo -e "${BOLD}=== Resources ===${NC}"
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}' 2>/dev/null | head -15
echo ""

# ── Disk ──────────────────────────────────────────────────────────────────────
echo -e "${BOLD}=== Disk ===${NC}"
df -h / | tail -1 | awk '{printf "  Root: %s used of %s (%s)\n", $3, $2, $5}'
DOCKER_SIZE=$(docker system df --format '{{.Type}}\t{{.Size}}' 2>/dev/null | head -3)
if [ -n "$DOCKER_SIZE" ]; then
  echo "  Docker:"
  echo "$DOCKER_SIZE" | while IFS=$'\t' read -r type size; do
    echo "    $type: $size"
  done
fi
echo ""

# ── Recent Errors ─────────────────────────────────────────────────────────────
echo -e "${BOLD}=== Recent Errors (last 30 min) ===${NC}"
ERROR_COUNT=$(docker compose logs --since=30m 2>&1 | grep -ciE "error|fail|fatal|panic" 2>/dev/null || echo "0")
if [ "$ERROR_COUNT" -gt 0 ]; then
  echo -e "  ${YELLOW}${ERROR_COUNT} error lines found${NC}"
  echo "  Last 5:"
  docker compose logs --since=30m 2>&1 | grep -iE "error|fail|fatal|panic" | tail -5 | sed 's/^/    /'
else
  echo -e "  ${GREEN}No errors${NC}"
fi
echo ""

# ── System ────────────────────────────────────────────────────────────────────
echo -e "${BOLD}=== System ===${NC}"
echo "  Uptime: $(uptime -p 2>/dev/null || uptime | sed 's/.*up /up /' | sed 's/,.*//')"
echo "  Load:   $(cat /proc/loadavg 2>/dev/null | awk '{print $1, $2, $3}' || echo 'n/a')"
SWAP=$(free -h 2>/dev/null | grep Swap | awk '{print $3 " / " $2}')
[ -n "$SWAP" ] && echo "  Swap:   $SWAP"
echo ""

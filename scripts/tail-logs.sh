#!/usr/bin/env bash
# =============================================================================
# Hawk OS — Smart Log Tailing
# Usage:
#   ./tail-logs.sh              # tail all services
#   ./tail-logs.sh agents       # tail all 6 agents
#   ./tail-logs.sh errors       # only error lines from all services
#   ./tail-logs.sh web          # tail web only
#   ./tail-logs.sh db           # tail postgres + pgbouncer
#   ./tail-logs.sh ten1         # tail specific agent (ten1-ten6)
#   ./tail-logs.sh caddy        # tail reverse proxy
#
# From local machine:
#   ssh hawkos-prod "/docker/hawkos/scripts/tail-logs.sh errors"
# =============================================================================

set -euo pipefail

SERVICE="${1:-all}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

case "$SERVICE" in
  all)
    docker compose logs -f --tail=50
    ;;
  agents)
    docker compose logs -f --tail=50 agent-ten1 agent-ten2 agent-ten3 agent-ten4 agent-ten5 agent-ten6
    ;;
  errors)
    docker compose logs -f --tail=200 2>&1 | grep --line-buffered -iE "error|fail|fatal|panic|exception|WARN|ERR"
    ;;
  web)
    docker compose logs -f --tail=50 web
    ;;
  db)
    docker compose logs -f --tail=50 postgres pgbouncer
    ;;
  caddy)
    docker compose logs -f --tail=50 caddy
    ;;
  ten[1-6])
    docker compose logs -f --tail=100 "agent-${SERVICE}"
    ;;
  help|--help|-h)
    echo "Usage: $0 [all|agents|errors|web|db|caddy|ten1-6]"
    echo ""
    echo "  all      Tail all services (default)"
    echo "  agents   Tail all 6 agent instances"
    echo "  errors   Filter only error/warning lines from all services"
    echo "  web      Tail Next.js dashboard"
    echo "  db       Tail PostgreSQL + PgBouncer"
    echo "  caddy    Tail reverse proxy"
    echo "  ten1-6   Tail a specific agent (e.g. ten1, ten3)"
    ;;
  *)
    docker compose logs -f --tail=50 "$SERVICE"
    ;;
esac

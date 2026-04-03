#!/usr/bin/env bash
# =============================================================================
# Hawk OS — Metrics Collector
# Scrapes /metrics from each running agent and appends to a daily log file.
# Run via cron: */15 * * * * /docker/hawkos/scripts/collect-metrics.sh
#
# Metrics are stored in /docker/hawkos/data/metrics/ as daily text files.
# Files older than 30 days are automatically cleaned up.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
METRICS_DIR="${PROJECT_DIR}/data/metrics"

mkdir -p "$METRICS_DIR"

DATE=$(date +%Y-%m-%d)
TS=$(date -Iseconds)

# Scrape each agent
for i in 1 2 3 4 5 6; do
  PORT=$((3010 + i))
  METRICS=$(curl -sf --max-time 5 "http://localhost:$PORT/metrics" 2>/dev/null || true)
  if [ -n "$METRICS" ]; then
    {
      echo "# ten$i @ $TS"
      echo "$METRICS"
      echo ""
    } >> "$METRICS_DIR/$DATE.txt"
  fi
done

# Scrape web health for DB latency tracking
WEB_HEALTH=$(curl -sf --max-time 5 "http://localhost:3000/health" 2>/dev/null || true)
if [ -n "$WEB_HEALTH" ]; then
  DB_LATENCY=$(echo "$WEB_HEALTH" | jq -r '.db_latency_ms // empty' 2>/dev/null || true)
  if [ -n "$DB_LATENCY" ]; then
    echo "# web_db_latency @ $TS: ${DB_LATENCY}ms" >> "$METRICS_DIR/$DATE.txt"
  fi
fi

# Cleanup files older than 30 days
find "$METRICS_DIR" -name "*.txt" -mtime +30 -delete 2>/dev/null || true

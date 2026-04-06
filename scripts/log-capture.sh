#!/usr/bin/env bash
# Hawk OS — Continuous Log Capture
# Follows docker logs for each service and writes to /var/log/hawkos/<service>-YYYY-MM-DD.log
# Runs as a systemd service: hawkos-logs.service
# Survives container restarts — re-attaches when container comes back up.

set -euo pipefail

LOG_DIR="/var/log/hawkos"
COMPOSE_DIR="/docker/hawkos"
SERVICES=("agent" "web")

mkdir -p "$LOG_DIR"

capture_service() {
  local SERVICE="$1"
  echo "[log-capture] Starting capture for service: $SERVICE"

  while true; do
    # Get current container ID for the service
    CONTAINER=$(docker compose -f "$COMPOSE_DIR/docker-compose.yml" ps -q "$SERVICE" 2>/dev/null || true)

    if [ -z "$CONTAINER" ]; then
      echo "[log-capture] $SERVICE: container not found, retrying in 10s..."
      sleep 10
      continue
    fi

    LOG_FILE="$LOG_DIR/${SERVICE}-$(date +%Y-%m-%d).log"
    echo "[log-capture] $SERVICE: attaching to $CONTAINER → $LOG_FILE"

    # Follow logs with timestamps; on exit (container restart/stop) loop retries
    docker logs --timestamps -f "$CONTAINER" 2>&1 | \
      while IFS= read -r line; do
        # Rotate to new file at midnight by re-evaluating date per line
        echo "$line" >> "$LOG_DIR/${SERVICE}-$(date +%Y-%m-%d).log"
      done || true

    echo "[log-capture] $SERVICE: stream ended, re-attaching in 5s..."
    sleep 5
  done
}

# Launch one capture loop per service in background
for SVC in "${SERVICES[@]}"; do
  capture_service "$SVC" &
done

# Wait for all background jobs — if any exits, the service manager will restart us
wait

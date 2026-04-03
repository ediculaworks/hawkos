#!/usr/bin/env bash
set -e
# 🦅 Hawk OS — Update Script
# Called by: hawk update  |  cron auto-update

HAWK_DIR="${HAWK_DIR:-$HOME/.hawk-os}"
BUN=$(cat "$HAWK_DIR/.bun_path" 2>/dev/null || which bun 2>/dev/null || echo "bun")

log() { echo "[hawk-update] $*"; }

# ─── Read update URL from hawk.config.json ────────────────────

UPDATE_URL=$(node -e "
  try {
    const c = require('$HAWK_DIR/hawk.config.json');
    console.log(c.updateUrl || '');
  } catch(e) { console.log(''); }
" 2>/dev/null)

if [[ -z "$UPDATE_URL" || "$UPDATE_URL" == *"REPLACE_VPS_URL"* ]]; then
  echo "❌ updateUrl não configurada em hawk.config.json"
  echo "   Execute: hawk config"
  exit 1
fi

# ─── Download new version ─────────────────────────────────────

log "Baixando atualização de $UPDATE_URL..."
TMP_DIR="/tmp/hawk-update-$(date +%s)"
mkdir -p "$TMP_DIR"

curl -fsSL "$UPDATE_URL" | tar xz -C "$TMP_DIR" --strip-components=1 \
  || { echo "❌ Falha ao baixar atualização"; rm -rf "$TMP_DIR"; exit 1; }

# ─── Count migrations before update ──────────────────────────

OLD_COUNT=$(ls "$HAWK_DIR/packages/db/supabase/migrations/" 2>/dev/null | wc -l | tr -d ' ')

# ─── Preserve user files by copying them into extracted dir ──
# (so they override any defaults in the new version)

for f in .env hawk.config.json ecosystem.config.js .bun_path; do
  [[ -f "$HAWK_DIR/$f" ]] && cp "$HAWK_DIR/$f" "$TMP_DIR/$f"
done

# Preserve user logs directory
mkdir -p "$TMP_DIR/logs"

# ─── Apply update ─────────────────────────────────────────────

log "Aplicando atualização..."
cp -r "$TMP_DIR/." "$HAWK_DIR/"
rm -rf "$TMP_DIR"

# ─── Install dependencies ─────────────────────────────────────

log "Instalando dependências..."
cd "$HAWK_DIR"
"$BUN" install --frozen-lockfile 2>&1 | tail -2

# ─── Run migrations if there are new ones ────────────────────

NEW_COUNT=$(ls "$HAWK_DIR/packages/db/supabase/migrations/" 2>/dev/null | wc -l | tr -d ' ')
if [[ "$NEW_COUNT" -gt "$OLD_COUNT" ]]; then
  DIFF=$((NEW_COUNT - OLD_COUNT))
  log "Aplicando $DIFF nova(s) migration(s)..."
  "$BUN" run --env-file=.env scripts/migrate.ts
fi

# ─── Rebuild Next.js ──────────────────────────────────────────

log "Compilando dashboard..."
"$BUN" run --cwd apps/web build 2>&1 | tail -3

# ─── Restart services ─────────────────────────────────────────

log "Reiniciando serviços..."
pm2 restart hawk-agent hawk-web

log "✅ Atualização concluída"

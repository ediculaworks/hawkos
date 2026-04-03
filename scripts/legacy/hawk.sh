#!/usr/bin/env bash
# 🦅 Hawk OS — CLI
# Usage: hawk [update|start|stop|restart|status|logs|setup|config|open]

HAWK_DIR="${HAWK_DIR:-$HOME/.hawk-os}"
BUN=$(cat "$HAWK_DIR/.bun_path" 2>/dev/null || which bun 2>/dev/null || echo "bun")

case "${1:-}" in
  update)
    bash "$HAWK_DIR/scripts/update.sh"
    ;;

  start)
    pm2 start "$HAWK_DIR/ecosystem.config.js"
    ;;

  stop)
    pm2 stop hawk-agent hawk-web
    ;;

  restart)
    pm2 restart hawk-agent hawk-web
    ;;

  status)
    pm2 status
    ;;

  logs)
    # hawk logs          → all
    # hawk logs agent    → agent only
    # hawk logs web      → web only
    case "${2:-}" in
      agent) pm2 logs hawk-agent ;;
      web)   pm2 logs hawk-web ;;
      *)     pm2 logs ;;
    esac
    ;;

  setup)
    cd "$HAWK_DIR" && "$BUN" scripts/setup.ts
    ;;

  config)
    "${EDITOR:-nano}" "$HAWK_DIR/hawk.config.json"
    ;;

  open)
    PORT=$(node -e "try { const c=require('$HAWK_DIR/hawk.config.json'); console.log(c.dashboardPort||3000); } catch(e){console.log(3000);}" 2>/dev/null)
    URL="http://localhost:${PORT}"
    if command -v open &>/dev/null; then
      open "$URL"
    elif command -v xdg-open &>/dev/null; then
      xdg-open "$URL"
    else
      echo "Abra $URL no seu navegador"
    fi
    ;;

  *)
    echo ""
    echo "  🦅 Hawk OS"
    echo ""
    echo "  Uso: hawk <comando>"
    echo ""
    echo "  Comandos:"
    echo "    update     Atualizar para a versão mais recente"
    echo "    start      Iniciar agent e dashboard"
    echo "    stop       Parar todos os serviços"
    echo "    restart    Reiniciar todos os serviços"
    echo "    status     Ver status dos processos"
    echo "    logs       Ver logs (hawk logs [agent|web])"
    echo "    setup      Reconfigurar variáveis de ambiente"
    echo "    config     Editar hawk.config.json"
    echo "    open       Abrir dashboard no navegador"
    echo ""
    ;;
esac

# Deploy — VPS, SSH e Gestão de Serviços

## Acesso SSH

```bash
ssh hawk@168.231.89.31
```

- **VPS:** Hostinger KVM4 (16GB RAM, 4 vCPUs AMD EPYC, CPU-only, Ubuntu)
- **Usuário:** `hawk` (não root)
- **Path do projecto:** `/docker/hawkos`
- **Chave SSH:** já configurada na máquina de desenvolvimento

## Serviços Docker

Todos geridos por `docker compose` em `/docker/hawkos`:

| Serviço | Container | Porta | Memória | Notas |
|---------|-----------|-------|---------|-------|
| postgres | hawkos-postgres-1 | 5432 (interno) | 1G | pgvector/pgvector:pg17 |
| pgbouncer | hawkos-pgbouncer-1 | 6432 (interno) | 128M | Pool de conexões |
| caddy | hawkos-caddy-1 | 80/443 | 128M | Reverse proxy + HTTPS automático |
| web | hawkos-web-1 | 3000 (interno) | 1G | Next.js dashboard |
| agent | hawkos-agent-1 | 3001 | 1G | Bot Discord + API admin |
| ollama | hawkos-ollama-1 | 11434 (interno) | 10G | LLM local (gemma4:e2b) |

## Fluxo de Deploy Padrão

```bash
# 1. Local: commit e push
git add <ficheiros>
git commit -m "feat/fix: descrição"
git push

# 2. VPS: pull + rebuild + restart
ssh hawk@168.231.89.31 "cd /docker/hawkos && git pull && docker compose build agent && docker compose up -d agent"
```

### Quando fazer rebuild do web também

```bash
ssh hawk@168.231.89.31 "cd /docker/hawkos && git pull && docker compose build web agent && docker compose up -d web agent"
```

### Migrations de DB

```bash
ssh hawk@168.231.89.31 "cd /docker/hawkos && bun db:migrate"
# ou via container:
ssh hawk@168.231.89.31 "cd /docker/hawkos && docker compose run --rm agent bun db:migrate"
```

## Comandos Úteis na VPS

```bash
# Status de todos os serviços
docker compose ps

# Health do agent (tenants, DB latency)
curl http://localhost:3001/health

# Logs em tempo real
docker logs hawkos-agent-1 --tail 50 -f
docker logs hawkos-web-1 --tail 50 -f
docker logs hawkos-ollama-1 --tail 20

# Uso de memória por container
docker stats --no-stream

# Reiniciar serviço específico
docker compose restart agent

# Atualizar só a imagem Ollama
docker compose pull ollama && docker compose up -d ollama
```

## Ollama — Inferência Local

O Ollama serve como LLM primário para ~80% das chamadas (simple + moderate + todos os workers).
OpenRouter é usado apenas para tier complex e como fallback.

- **Endpoint interno:** `http://ollama:11434/v1` (só acessível dentro da rede Docker)
- **Modelo:** `gemma4:e2b` (Google Gemma 4, MoE 12B total / 2.3B activos, 128K ctx, ~7.2GB)
- **Usado por:** chat simple, chat moderate, memory extraction, dedup, compression, sub-agents, heartbeat, gap-scanner
- **Activado por:** `OLLAMA_BASE_URL=http://ollama:11434/v1` no `.env`

Para testar manualmente:
```bash
# De dentro do container agent:
docker exec -it hawkos-agent-1 curl -s http://ollama:11434/api/tags

# Listar modelos baixados:
docker exec -it hawkos-ollama-1 ollama list

# Pré-baixar modelo (opcional — baixa sozinho na 1ª chamada):
docker exec -it hawkos-ollama-1 ollama pull gemma4:e2b
```

## Estratégia de LLM

Princípio: **Ollama local (gemma4:e2b) como primário para tudo. OpenRouter só como fallback ou para complex.**

| Componente | Modelo Primário | Fallback |
|---|---|---|
| Chat `simple` | `gemma4:e2b` (local, grátis) | OpenRouter free |
| Chat `moderate` | `gemma4:e2b` (local, grátis) | `qwen/qwen3.6-plus:free` |
| Chat `complex` | `qwen/qwen3.6-plus:free` | `nemotron-120b:free`, `llama-3.3-70b:free` |
| Workers (memory, dedup, compression) | `gemma4:e2b` (local, grátis) | OpenRouter free |
| Sub-agents | `gemma4:e2b` (local, grátis) | OpenRouter free |
| Embeddings | `openai/text-embedding-3-small` (OpenRouter) | — |

Override via env vars: `MODEL_TIER_SIMPLE`, `MODEL_TIER_DEFAULT`, `MODEL_TIER_COMPLEX`.

## Multi-Tenant

- **8 tenants** (ten1-ten6, ten8, ten9). Tenants dinâmicos — sem limite hardcoded.
- Cada tenant tem schema Postgres isolado (`tenant_tenN`)
- Agent carrega todos os tenants no startup automaticamente
- Novos tenants criados via `/dashboard/admin` → botão "+ Novo Tenant"
- Hot-loaded via POST `/admin/tenants/:slug/start`

### Credenciais por Tenant

Cada tenant guarda as suas próprias credenciais (encriptadas AES-256-GCM com per-tenant `key_salt`):
- **OpenRouter API key:** configurável via **Settings → Integrations** ou **Admin → ícone de chave**
- **Discord token:** configurado na criação do tenant ou via Admin → ícone de chave
- A key do `.env` (`OPENROUTER_API_KEY`) serve como fallback global
- **Admin pode re-encriptar credenciais** de qualquer tenant via `/dashboard/admin` → ícone de chave (KeyRound)

Membros da equipa podem adicionar a própria key em **Settings → Integrations → OpenRouter** sem acesso admin.

## Variáveis de Ambiente Importantes

```env
DATABASE_URL=postgres://...@localhost:5432/hawkos
OPENROUTER_API_KEY=sk-or-...         # fallback global
OLLAMA_BASE_URL=http://ollama:11434/v1  # activa inferência local
JWT_SECRET=...
ADMIN_MASTER_KEY=...                 # encriptação de credenciais
AGENT_API_SECRET=...                 # auth agent↔web
DOMAIN=hawk.meudominio.com
```

## Troubleshooting

**Agent não arranca:**
```bash
docker logs hawkos-agent-1 --tail 30
# Verificar se DATABASE_URL está no .env
# Verificar se postgres está healthy: docker compose ps
```

**Ollama não responde:**
```bash
docker logs hawkos-ollama-1 --tail 20
# É normal demorar 10-30s no primeiro arranque
# Se modelo não existe ainda, a 1ª request vai baixar (~7.2GB)
# O modelo carrega na RAM na 1ª chamada (~8-9GB), demora ~10s
```

**Logs persistentes (captura contínua):**
```bash
# Logs gravados em /var/log/hawkos/<service>-YYYY-MM-DD.log
# Serviço systemd: hawkos-logs.service (auto-start, re-attach em restarts)
ls -lh /var/log/hawkos/
grep -i error /var/log/hawkos/agent-$(date +%Y-%m-%d).log
tail -f /var/log/hawkos/agent-$(date +%Y-%m-%d).log
# Logrotate: 30 dias retidos, comprimidos automaticamente
```

**Permissões git na VPS:**
```bash
sudo chown -R hawk:hawk /docker/hawkos/.git
git pull
```

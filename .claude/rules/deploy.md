# Deploy — VPS, SSH e Gestão de Serviços

## Acesso SSH

```bash
ssh hawk@168.231.89.31
```

- **VPS:** Hostinger KVM4 (~8GB RAM, CPU-only, Ubuntu)
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
| ollama | hawkos-ollama-1 | 11434 (interno) | 4G | LLM local (qwen3:4b) |

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

O Ollama serve o tier `simple` do model router (greetings, CRUDs curtos).

- **Endpoint interno:** `http://ollama:11434/v1` (só acessível dentro da rede Docker)
- **Modelo padrão:** `qwen3:4b` (~2.5GB, baixa automaticamente na 1ª requisição)
- **Modelo worker:** `qwen3:4b` (usado por automações, dedup, compactor)
- **Activado por:** `OLLAMA_BASE_URL=http://ollama:11434/v1` no `.env`

Para testar manualmente:
```bash
# De dentro do container agent:
docker exec -it hawkos-agent-1 curl -s http://ollama:11434/api/tags

# Listar modelos baixados:
docker exec -it hawkos-ollama-1 ollama list

# Pré-baixar modelo (opcional — baixa sozinho na 1ª chamada):
docker exec -it hawkos-ollama-1 ollama pull qwen3:4b
```

## Model Routing

| Complexidade | Modelo | Onde |
|---|---|---|
| `simple` | `qwen3:4b` | Ollama local (gratuito, ~1-3s) |
| `moderate` | `qwen/qwen3.6-plus:free` | OpenRouter (gratuito) |
| `complex` | `qwen/qwen3.6-plus:free` | OpenRouter (gratuito) |

Override via env vars: `MODEL_TIER_SIMPLE`, `MODEL_TIER_DEFAULT`, `MODEL_TIER_COMPLEX`.

## Multi-Tenant

- **6 tenants activos:** ten1 → ten6
- Cada tenant tem schema Postgres isolado
- Agent carrega todos os tenants no startup automaticamente
- Novos tenants são hot-loaded via onboarding (POST `/admin/tenants/:slug/start`)

### Credenciais por Tenant

Cada tenant guarda as suas próprias credenciais (encriptadas AES-256-GCM):
- **OpenRouter API key:** configurável via **Settings → Integrations** no dashboard web
- **Discord token:** configurado no onboarding (Step 3)
- A key do `.env` (`OPENROUTER_API_KEY`) serve como fallback global

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
# Se modelo não existe ainda, a 1ª request vai baixar (~2.5GB)
```

**Permissões git na VPS:**
```bash
sudo chown -R hawk:hawk /docker/hawkos/.git
git pull
```

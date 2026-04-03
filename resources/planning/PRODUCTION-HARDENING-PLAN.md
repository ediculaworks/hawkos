# Plano de Hardening para Producao

**Data:** 2026-04-03
**Contexto:** Avaliacao geral do sistema revelou que a arquitetura e solida (9/10) mas o deploy/operacao (6/10) e observabilidade (6/10) nao estao prontos para producao. O objetivo e: formatar a VPS Hostinger KVM4 (Ubuntu), rodar um script, e ter tudo funcionando com seguranca.

**Organizacao:** P0 (fazer agora) → P1 (esta semana) → P2 (antes do deploy)

---

## P0 — CRITICO (fazer agora)

### P0.1: HTTPS + Reverse Proxy — ✅ CONCLUIDO

**Problema:** O sistema roda em HTTP puro. Passwords, tokens de Discord, conversas — tudo em texto claro na rede.

**Solucao:** Caddy como reverse proxy (HTTPS automatico com Let's Encrypt).

**Ficheiros a criar/modificar:**

| Ficheiro | Acao |
|----------|------|
| `docker/Caddyfile` | Criar — config do Caddy |
| `docker-compose.yml` | Modificar — adicionar servico Caddy, remover port 80 do web |

**Steps:**

- [ ] 1. Criar `docker/Caddyfile`:
  ```
  {domain} {
    reverse_proxy web:3000
    encode gzip
    header {
      Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
      X-Content-Type-Options "nosniff"
      X-Frame-Options "DENY"
    }
  }
  ```

- [ ] 2. Adicionar servico Caddy ao `docker-compose.yml`:
  ```yaml
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      web:
        condition: service_healthy
    deploy:
      resources:
        limits:
          memory: 128M
  ```

- [ ] 3. Alterar servico `web`: remover `ports: - "80:3000"`, expor apenas internamente

- [ ] 4. Adicionar volumes `caddy_data` e `caddy_config`

- [ ] 5. Adicionar `DOMAIN` ao `.env.example` (usado pelo Caddyfile)

- [ ] 6. Actualizar `deploy.sh` para incluir Caddy no health check

**Verificacao:**
- `curl -I https://{domain}` retorna 200 com headers HSTS
- `curl http://{domain}` redireciona para HTTPS
- Certificado valido (Let's Encrypt)

---

### P0.2: SSH Hardening + VPS Setup Completo — ✅ CONCLUIDO

**Problema:** O `setup-vps.sh` nao criava user, nao configurava SSH, nao instalava fail2ban, nao criava swap.

**Ficheiro modificado:** `setup-vps.sh` (reescrito de 9 para 12 steps)

**Steps:**

- [ ] 1. Adicionar criacao de user `hawk` com sudo:
  ```bash
  useradd -m -s /bin/bash hawk
  usermod -aG sudo hawk
  echo "hawk ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/hawk
  ```

- [ ] 2. Adicionar SSH hardening:
  ```bash
  # Copiar authorized_keys do root para hawk
  mkdir -p /home/hawk/.ssh
  cp /root/.ssh/authorized_keys /home/hawk/.ssh/
  chown -R hawk:hawk /home/hawk/.ssh
  chmod 700 /home/hawk/.ssh && chmod 600 /home/hawk/.ssh/authorized_keys

  # Desabilitar login por password
  sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
  sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
  systemctl restart sshd
  ```

- [ ] 3. Instalar fail2ban:
  ```bash
  apt-get install -y fail2ban
  cat > /etc/fail2ban/jail.local <<EOF
  [sshd]
  enabled = true
  port = 22
  maxretry = 5
  bantime = 3600
  findtime = 600
  EOF
  systemctl enable --now fail2ban
  ```

- [ ] 4. Criar swap (2GB para KVM4):
  ```bash
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ```

- [ ] 5. Configurar unattended-upgrades:
  ```bash
  apt-get install -y unattended-upgrades
  dpkg-reconfigure -plow unattended-upgrades
  ```

- [ ] 6. Abrir porta 443 no UFW:
  ```bash
  ufw allow 443/tcp
  ```

- [ ] 7. Configurar logrotate para Docker:
  ```bash
  cat > /etc/logrotate.d/docker <<EOF
  /var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    missingok
    delaycompress
    copytruncate
  }
  EOF
  ```

**Verificacao:**
- SSH so aceita key-based auth (`ssh -o PasswordAuthentication=yes hawk@vps` deve falhar)
- `fail2ban-client status sshd` mostra jail activa
- `swapon --show` mostra 2GB
- `ufw status` mostra 22, 80, 443
- Login como root desabilitado

---

### P0.3: Persistir Cost Tracking — ✅ CONCLUIDO

**Problema:** O gasto diario de tokens era guardado em memoria. Se o agent restartasse, perdia o historico.

**Ficheiros a modificar:**

| Ficheiro | Acao |
|----------|------|
| `apps/agent/src/cost-tracker.ts` | Modificar — gravar na DB apos cada sessao |
| Nova migration | Criar — `daily_usage` table (se `tenant_metrics` nao servir) |

**Steps:**

- [ ] 1. Verificar se `admin.tenant_metrics` ja tem colunas para tokens/cost diario
- [ ] 2. Se nao, criar migration com tabela `daily_usage`:
  ```sql
  CREATE TABLE IF NOT EXISTS daily_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    llm_calls INTEGER DEFAULT 0,
    tool_calls INTEGER DEFAULT 0,
    cost_usd NUMERIC(10,6) DEFAULT 0,
    model TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(date, model)
  );
  CREATE INDEX idx_daily_usage_date ON daily_usage(date DESC);
  ```

- [ ] 3. Modificar `cost-tracker.ts`:
  - Apos cada `trackLLMCall()`, fazer upsert na `daily_usage` (debounced, a cada 30s ou fim de sessao)
  - No startup, carregar budget do dia da DB (em vez de comecar do zero)

- [ ] 4. Modificar `model-router.ts` `getBudget()`:
  - Ler `daily_usage` da DB no inicio do dia em vez de confiar em memoria

**Verificacao:**
- Reiniciar o agent → `getBudget()` retorna valores correctos do dia
- `SELECT * FROM daily_usage WHERE date = CURRENT_DATE` mostra dados
- Widget de observabilidade mostra gastos reais

---

## P1 — IMPORTANTE (esta semana)

### P1.1: Testes de Isolamento Multi-Tenant — ✅ CONCLUIDO

**Problema:** Nao havia nenhum teste que verificasse isolamento entre tenants.

**Ficheiro a criar:** `packages/db/src/__tests__/tenant-isolation.test.ts`

**Steps:**

- [ ] 1. Criar teste que:
  - Insere dado no schema `tenant_ten1`
  - Tenta ler do schema `tenant_ten2`
  - Verifica que retorna vazio (nao o dado do ten1)

- [ ] 2. Testar que `SET LOCAL search_path` nao persiste entre transacoes

- [ ] 3. Testar que schema names sao validados (nao aceita SQL injection: `ten1"; DROP TABLE--`)

**Verificacao:**
- `bun run test` passa com todos os testes de isolamento

---

### P1.2: Health Checks de Integracoes — ✅ CONCLUIDO

**Problema:** O agent nao verificava se OpenRouter, Discord e R2 estavam acessiveis.

**Ficheiros a modificar:**

| Ficheiro | Acao |
|----------|------|
| `apps/agent/src/api/server.ts` | Modificar — expandir `/health` |

**Steps:**

- [ ] 1. Expandir `GET /health` para verificar:
  ```json
  {
    "ok": true,
    "checks": {
      "database": { "ok": true, "latency_ms": 12 },
      "discord": { "ok": true, "guild": "connected" },
      "openrouter": { "ok": true },
      "r2": { "ok": true }
    },
    "uptime_seconds": 3600
  }
  ```

- [ ] 2. Cada check com timeout de 5s e fallback graceful

- [ ] 3. Retornar HTTP 200 se DB ok (servico operacional), 503 se DB down

- [ ] 4. Adicionar `GET /health?deep=true` para checks completos (OpenRouter, R2)
  - Health check basico (Docker) so verifica DB
  - Deep check para monitoring manual

**Verificacao:**
- `curl localhost:3001/health` retorna status de cada integracao
- Desligar DB → health check retorna 503
- Container reinicia automaticamente (Docker healthcheck falha)

---

### P1.3: Proteger/Remover Dev-Login — ✅ CONCLUIDO

**Problema:** `/api/admin/dev-login` bypassava auth em dev mode.

**Ficheiros a modificar:**

| Ficheiro | Acao |
|----------|------|
| `apps/web/app/api/admin/dev-login/` | Remover — endpoint perigoso |
| `apps/web/lib/admin-auth.ts` | Modificar — remover bypass por NODE_ENV |

**Steps:**

- [ ] 1. Apagar a pasta `apps/web/app/api/admin/dev-login/`
- [ ] 2. Em `admin-auth.ts`, remover:
  ```typescript
  if (process.env.NODE_ENV === 'development') { return null; }
  ```
- [ ] 3. Substituir por auth real (validar ADMIN_MASTER_KEY ou JWT) em todos os ambientes

**Verificacao:**
- `curl /api/admin/tenants` sem token → 401
- Em dev mode, admin routes continuam a exigir auth

---

## P2 — ANTES DO DEPLOY

### P2.1: Dashboard de Erros e Gastos Historicos — ✅ CONCLUIDO

**Problema:** Erros e gastos eram logados mas nao havia visualizacao agregada.

**Ficheiros a criar:**

| Ficheiro | Acao |
|----------|------|
| `apps/web/components/widgets/agent/cost-history.tsx` | Criar — widget de gastos |
| `apps/web/components/widgets/agent/error-summary.tsx` | Criar — widget de erros |
| `apps/web/lib/widgets/registry.ts` | Modificar — registar novos widgets |
| `apps/web/lib/actions/usage.ts` | Criar — server action para dados de uso |

**Steps:**

- [ ] 1. Criar server action `fetchUsageHistory(days: number)`:
  - Query `daily_usage` table (criada em P0.3)
  - Retorna array de `{ date, tokens, cost, llm_calls }`

- [ ] 2. Criar widget `cost-history.tsx`:
  - Grafico de barras (Recharts) com gastos dos ultimos 7/30 dias
  - Total do periodo
  - Media diaria
  - Comparacao com periodo anterior (seta verde/vermelha)

- [ ] 3. Criar server action `fetchErrorSummary(days: number)`:
  - Query `activity_log` WHERE event_type = 'error' ou 'client_error'
  - Agrupa por tipo/componente
  - Retorna `{ type, count, last_seen }`

- [ ] 4. Criar widget `error-summary.tsx`:
  - Top 5 erros por frequencia
  - Ultimo timestamp de cada tipo
  - Link para logs filtrados

- [ ] 5. Registar ambos widgets no registry com `moduleId: 'memory'`

**Verificacao:**
- Widgets aparecem no dashboard
- Dados reflectem gastos reais dos ultimos dias
- Erros mostram frequencia e ultimo timestamp

---

### P2.2: Backup Verification — ✅ CONCLUIDO

**Problema:** Backups eram criados via R2 mas nunca testados. Tabelas com >50k rows eram truncadas silenciosamente.

**Ficheiro a modificar:** `scripts/backup.ts`

**Steps:**

- [ ] 1. Apos upload, verificar integridade:
  ```typescript
  const downloaded = await downloadFromR2(key);
  const decompressed = gunzipSync(downloaded);
  const parsed = JSON.parse(decompressed.toString());
  const tableCount = Object.keys(parsed).length;
  if (tableCount < BACKUP_TABLES.length * 0.5) {
    throw new Error(`Backup incomplete: only ${tableCount} tables`);
  }
  ```

- [ ] 2. Alertar se alguma tabela atingiu o limite de 50k rows:
  ```typescript
  if (data.length >= 50000) {
    console.warn(`[backup] WARNING: ${table} hit 50k row limit — data truncated`);
    // Log to activity_log
  }
  ```

- [ ] 3. Aumentar limite para 200k ou remover (usar streaming para tabelas grandes)

- [ ] 4. Adicionar notificacao Discord se backup falhar

**Verificacao:**
- Backup com tabela >50k mostra warning
- Backup corrompido e detectado e logado
- Falha de backup envia alerta Discord

---

### P2.3: Consolidar Scripts e Limpar Raiz — ✅ CONCLUIDO

**Problema:** Raiz tinha ficheiros acumulados e scripts legado misturados com scripts de producao.

**Steps:**

- [ ] 1. Mover Dockerfiles:
  ```
  Dockerfile.agent → docker/Dockerfile.agent
  Dockerfile.web → docker/Dockerfile.web
  ```
  Actualizar `docker-compose.yml` paths

- [ ] 2. Consolidar .env.example:
  - Manter apenas `.env.example` (completo, com comentarios por seccao)
  - Remover `.env.example.tenant` e `.env.example.web` (conteudo ja esta no principal)

- [ ] 3. Decidir fluxo de deploy oficial:
  - **Docker (producao):** `setup-vps.sh` + `deploy.sh` — manter
  - **PM2 (legado):** `install.sh` + `update.sh` — marcar como deprecated ou mover para `scripts/legacy/`
  - `install.ps1`, `update.ps1` — mover para `scripts/legacy/`

- [ ] 4. Mover `hawk.sh` e `hawk.ps1` para `scripts/cli/`

- [ ] 5. Remover `hawk.config.json` da raiz se nao for usado no fluxo Docker

**Verificacao:**
- `docker compose build` funciona com novos paths
- Raiz tem apenas ficheiros essenciais: `package.json`, `turbo.json`, `biome.json`, `docker-compose.yml`, `.env.example`, `deploy.sh`, `setup-vps.sh`
- Scripts de legacy nao quebram (movidos, nao apagados)

---

## Resumo

| ID | Tarefa | Ficheiros | Risco |
|----|--------|-----------|-------|
| **P0.1** | HTTPS + Caddy | docker-compose.yml, docker/Caddyfile | Baixo |
| **P0.2** | SSH + VPS hardening | setup-vps.sh | Baixo |
| **P0.3** | Persistir cost tracking | cost-tracker.ts, migration, model-router.ts | Medio |
| **P1.1** | Testes tenant isolation | novo test file | Baixo |
| **P1.2** | Health checks integracoes | server.ts | Baixo |
| **P1.3** | Remover dev-login | dev-login/, admin-auth.ts | Baixo |
| **P2.1** | Dashboard erros + gastos | 4 novos ficheiros, registry.ts | Baixo |
| **P2.2** | Backup verification | backup.ts | Baixo |
| **P2.3** | Limpar raiz + consolidar | Dockerfiles, scripts, .env.example | Baixo |

**Ordem de execucao recomendada:** P0.2 → P0.1 → P0.3 → P1.3 → P1.2 → P1.1 → P2.3 → P2.1 → P2.2

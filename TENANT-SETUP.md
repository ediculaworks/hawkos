# Hawk OS — Guia de Setup de Novo Tenant

Este guia explica como adicionar uma nova pessoa ao sistema Hawk OS multi-tenant.

## Pre-requisitos

- VPS com Docker + Docker Compose instalados
- Acesso ao repositório Hawk OS
- Uma conta Supabase (ou acesso a self-hosted Supabase)

---

## Passo 1: Criar Projeto Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto
2. Anote as seguintes credenciais (Settings → API):
   - **Project URL** (ex: `https://abc123.supabase.co`)
   - **anon key** (public)
   - **service_role key** (secret)
3. Rode as migrations no novo projeto:
   ```bash
   # Na máquina de desenvolvimento, apontando pro novo projeto:
   export SUPABASE_URL=https://abc123.supabase.co
   export SUPABASE_SERVICE_ROLE_KEY=eyJ...
   bun db:migrate
   ```
4. Crie o usuário do tenant em **Authentication → Users → Add User**:
   - Email + senha que o tenant usará no login do dashboard

---

## Passo 2: Criar Bot Discord

1. Acesse [discord.com/developers/applications](https://discord.com/developers/applications)
2. Clique **New Application** → dê um nome (ex: "Hawk - [Nome]")
3. Vá em **Bot** → copie o **Bot Token**
4. Habilite os intents:
   - `Message Content Intent` ✅
   - `Server Members Intent` ✅
   - `Presence Intent` ✅
5. Vá em **OAuth2 → URL Generator**:
   - Scopes: `bot`
   - Permissions: `Send Messages`, `Read Message History`, `Embed Links`, `Attach Files`
   - Copie o link gerado e envie pro tenant adicionar o bot ao servidor dele
6. Anote:
   - **Bot Token**
   - **Guild ID** (ID do servidor Discord)
   - **Channel ID** (canal principal onde o bot vai responder)
   - **User ID** do tenant no Discord (quem pode interagir com o bot)

---

## Passo 3: API Key do OpenRouter

1. Acesse [openrouter.ai](https://openrouter.ai) → API Keys
2. Crie uma nova key (ou compartilhe uma existente)
3. Anote a **API key**

---

## Passo 4: Criar arquivo .env do tenant

Copie o template e preencha:

```bash
cp .env.example.tenant .env.<slug>
# Ex: cp .env.example.tenant .env.user1
```

Edite `.env.<slug>` com as credenciais dos passos anteriores:

```env
SUPABASE_URL=https://abc123.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

DISCORD_BOT_TOKEN=MTIzNDU2Nzg5...
DISCORD_GUILD_ID=123456789
DISCORD_CHANNEL_ID=123456789
DISCORD_CHANNEL_GERAL=123456789
DISCORD_AUTHORIZED_USER_ID=123456789

OPENROUTER_API_KEY=sk-or-...

AGENT_API_PORT=3001
AGENT_API_SECRET=gerar-um-secret-aleatorio
```

> Dica: gere um secret aleatório com `openssl rand -hex 32`

---

## Passo 5: Adicionar ao tenants.json

Edite `tenants.json` na raiz do projeto:

```json
{
  "tenants": [
    {
      "slug": "user1",
      "label": "User 1",
      "supabaseUrl": "https://abc123.supabase.co",
      "supabaseAnonKey": "eyJ...",
      "supabaseServiceRoleKey": "eyJ...",
      "agentApiPort": 3003,
      "agentApiSecret": "mesmo-valor-do-AGENT_API_SECRET-no-env"
    }
  ]
}
```

**Importante:**
- O `slug` deve ser único e URL-safe (lowercase, sem espaços)
- O `agentApiPort` deve ser único (3001, 3002, 3003, ...)
- O `agentApiSecret` deve ser igual ao `AGENT_API_SECRET` no `.env.<slug>`

---

## Passo 6: Adicionar service no docker-compose.yml

```yaml
  agent-user1:
    build:
      context: .
      dockerfile: Dockerfile.agent
    ports:
      - "3003:3001"    # porta host = agentApiPort do tenants.json
    env_file: .env.user1
    restart: unless-stopped
```

---

## Passo 7: Deploy

```bash
# Subir apenas o novo agente
docker-compose up -d --build agent-user1

# Reiniciar o web para carregar o novo tenant do tenants.json
docker-compose restart web

# Verificar logs
docker-compose logs -f agent-user1
docker-compose logs -f web
```

---

## Passo 8: Testar

1. Abrir `http://seu-dominio:3000/login`
2. O dropdown de **Workspace** deve mostrar o novo tenant
3. Selecionar o workspace → logar com email/senha do Supabase
4. Dashboard deve carregar os dados do Supabase correto
5. Chat deve conectar ao agente na porta correta
6. Testar no Discord: mandar mensagem pro bot, verificar resposta

---

## Checklist

- [ ] Projeto Supabase criado
- [ ] Migrations rodadas no novo Supabase
- [ ] Usuário criado no Supabase Auth
- [ ] Bot Discord criado e convidado ao servidor
- [ ] Intents habilitados no bot
- [ ] OpenRouter API key obtida
- [ ] `.env.<slug>` criado com todas as variáveis
- [ ] Entrada adicionada no `tenants.json`
- [ ] Service adicionado no `docker-compose.yml`
- [ ] `docker-compose up -d --build` sem erros
- [ ] Login pelo dashboard funciona
- [ ] Chat funciona
- [ ] Discord funciona

---

## Removendo um Tenant

1. Remover entrada do `tenants.json`
2. Remover service do `docker-compose.yml`
3. `docker-compose down agent-<slug>`
4. `docker-compose restart web`
5. Deletar `.env.<slug>`
6. (Opcional) Deletar o projeto Supabase

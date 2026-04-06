# Hawk OS — Sprint Roadmap

> Plano de execucao baseado no INNOVATION-IDEAS.md. Criado em 2026-04-06.
> Referencia: `resources/planning/INNOVATION-IDEAS.md` para descricao completa de cada ideia.

---

## Principios

1. **Quick wins primeiro** — ideias de alto impacto e baixo esforco abrem caminho
2. **Cost reduction cedo** — reduzir LLM calls antes de adicionar features que consomem mais
3. **Observabilidade antes de complexidade** — medir antes de construir features avancadas
4. **Dados antes de insights** — features de analise so fazem sentido com dados suficientes
5. **Cada sprint entrega valor independente** — sem dependencias bloqueantes entre sprints

---

## Vista Geral

| Sprint | Tema | Ideias | Estimativa |
|--------|------|--------|------------|
| S1 | Quick Wins | #1, #13, #5, #10 | 3-4 dias |
| S2 | Cost Reduction | #4, #3, #43 | 4-5 dias |
| S3 | Engagement | #39, #22, #23, #44 | 5-6 dias |
| S4 | Observabilidade | #2, #6, #15, #12 | 5-7 dias |
| S5 | Onboarding & Integracao | #8, #14, #35, #42 | 7-10 dias |
| S6 | Canais & Import | #41, #11, #9, #46 | 10-14 dias |
| S7 | Inteligencia | #7, #19, #20, #21, #24, #25 | 14-20 dias |
| S8 | Proactividade | #26, #27, #28, #29, #30, #31 | 10-14 dias |
| S9 | Ecosystem | #32, #33, #34, #36, #37, #38, #40, #45 | 14-20 dias |
| S10 | Moonshots | #16, #17, #18 | 14-20 dias |

---

## S1 — Quick Wins

**Objectivo:** Eliminar classes inteiras de erros com mudancas pequenas e de alto impacto.

### 1.1 Prerequisite Guard + Pending Intents (#1 + #13)

**O que ja existe:** Nada — erros de pre-requisito sao tratados pelo LLM (ou ignorados).

**O que construir:**
- Mapa declarativo de pre-requisitos por tool em `apps/agent/src/tools.ts`
- Campo `prerequisites` em cada tool definition (ex: `{ check: 'accounts.count > 0', message: '...' }`)
- Guard no `tool-executor.ts`: antes de executar, verifica pre-requisitos
- Se falha: responde com mensagem guiada + guarda intent em `pending_intents` (tabela ou campo na session)
- Quando pre-requisito e satisfeito (detectado no proximo tool call): oferece executar intent pendente

**Ficheiros a modificar:**
- `apps/agent/src/tools.ts` — adicionar `prerequisites` field
- `apps/agent/src/tool-executor.ts` — guard logic
- Migration nova — tabela `pending_intents(id, tenant_schema, intent_json, prerequisite, status, created_at, resolved_at)`

**Criterio de aceitacao:**
- "Adiciona 1000 de receita" sem conta bancaria → mensagem guiada + intent guardada
- Criar conta bancaria → agente oferece executar intent pendente
- Intent expirada apos 7 dias

---

### 1.2 Diagnostico Self-Service (#5)

**O que ja existe:** `/health` endpoint no agent, mas so acessivel via API.

**O que construir:**
- Nova tool `system_status` (universal, `modules: []`)
- Handler: agrega status de modulos, ultima interaccao por modulo, API key health, proximas automacoes, dados em falta
- Formato: mensagem Discord com emojis de status

**Ficheiros a modificar:**
- `apps/agent/src/tools.ts` — nova tool `system_status`

**Criterio de aceitacao:**
- User diz "status" ou "saude" → relatorio completo
- Mostra modulos configurados vs nao-configurados
- Indica dados em falta ("Nao registas sono ha 3 dias")

---

### 1.3 Undo Actions (#10)

**O que ja existe:** Nenhum mecanismo de undo.

**O que construir:**
- Apos mutacao (create transaction, log sleep, etc.), o agente inclui botao "Desfazer" (Discord button component)
- Botao activo durante 60 segundos
- Click no botao → soft-delete do registo criado
- Evento `action_undone` no activity_log

**Ficheiros a modificar:**
- `apps/agent/src/channels/discord.ts` — enviar mensagem com ActionRow + Button
- `apps/agent/src/tools.ts` — retorno de tools de mutacao inclui `undoable: true` + metadata
- Migration nova — campo `deleted_at TIMESTAMPTZ` nas tabelas relevantes (transactions, health_observations, etc.)

**Criterio de aceitacao:**
- Criar transacao → mensagem com botao [Desfazer (60s)]
- Click no botao → transacao removida + confirmacao
- Apos 60s → botao desaparece ou fica disabled

---

## S2 — Cost Reduction

**Objectivo:** Reduzir LLM calls em 30-40% para accoes rotineiras.

### 2.1 Intent Caching / Short-Circuit (#4)

**O que ja existe:** `isLikelySimpleMessage()` em `model-router.ts` — fast path para saudacoes e mensagens triviais.

**O que construir:**
- Expandir com regex patterns para CRUD comum:
  - `"gastei X em Y"` → parse → `create_transaction`
  - `"quanto gastei este mes"` → query directa
  - `"ver tarefas"` → listar demands
  - `"como estou"` → composicao de L0s
- Classificador em `apps/agent/src/intent-classifier.ts` (novo ficheiro)
- Se match confiante (regex + heuristica) → executa directamente sem LLM
- Se ambiguo → fallback para pipeline normal
- Metricas: contar short-circuits vs LLM calls no cost-tracker

**Ficheiros a criar/modificar:**
- `apps/agent/src/intent-classifier.ts` — novo
- `apps/agent/src/middleware/routing.ts` — integrar classificador antes do LLM
- `apps/agent/src/cost-tracker.ts` — metrica de short-circuits

**Criterio de aceitacao:**
- "Gastei 50 em almoco" → transacao criada sem LLM call
- "Quanto gastei este mes" → resposta directa sem LLM call
- Mensagens ambiguas continuam a usar LLM normalmente
- Dashboard mostra % de short-circuits

---

### 2.2 Quick Actions Discord (#3)

**O que ja existe:** discord.js v14 suporta components (buttons, select menus, modals). Nao estao a ser usados.

**O que construir:**
- Apos registar gasto: Select Menu com categorias mais usadas do tenant
- `/log` slash command: abre Modal com campos estruturados (valor, categoria, nota)
- Confirmacoes com botoes (checkmark / cross) em vez de resposta textual
- Component handler em `apps/agent/src/channels/discord.ts`

**Ficheiros a modificar:**
- `apps/agent/src/channels/discord.ts` — component handlers (buttons, select menus, modals)
- `apps/agent/src/channels/discord-adapter.ts` — registar slash commands

**Criterio de aceitacao:**
- Apos registar transacao → select menu com top 5 categorias
- `/log` abre modal funcional
- Botoes de confirmacao funcionam e executam accao

---

### 2.3 LLM Feedback Loop (#43)

**O que ja existe:** Nenhum mecanismo de feedback.

**O que construir:**
- Apos resposta do agente no Discord: adicionar reacoes (thumbs up / thumbs down) automaticamente
- Listener de reaccao: regista feedback na DB
- Tabela `response_feedback(id, tenant_schema, message_id, rating, module_id, created_at)`
- Widget simples no admin: quality score por tenant/modulo

**Ficheiros a modificar:**
- `apps/agent/src/channels/discord.ts` — auto-react + reaction listener
- Migration nova — tabela response_feedback

**Criterio de aceitacao:**
- Resposta do agente aparece com reacoes de thumbs up/down
- Click numa reaccao regista feedback na DB
- Admin ve quality score agregado

---

## S3 — Engagement

**Objectivo:** Aumentar utilidade e acessibilidade do agente no dia-a-dia.

### 3.1 Notas de Voz (#39)

**O que ja existe:** Discord suporta voice messages nativamente. Agent recebe o attachment mas ignora audio.

**O que construir:**
- Detectar attachment de audio na mensagem Discord
- Transcrever via Whisper (OpenAI Whisper API via OpenRouter, ou whisper.cpp local)
- Processar transcricao como texto normal no pipeline existente
- Confirmar accao com transcricao mostrada

**Ficheiros a modificar:**
- `apps/agent/src/channels/discord.ts` — detectar audio attachments
- `apps/agent/src/transcription.ts` — novo, wrapper para Whisper API
- `apps/agent/src/handler.ts` ou `middleware/context.ts` — injectar transcricao

**Criterio de aceitacao:**
- Voice message no Discord → transcricao + accao executada
- Transcricao mostrada na resposta para confirmacao
- Fallback graceful se Whisper indisponivel

---

### 3.2 Natural Language Cron (#22)

**O que ja existe:** Sistema de crons em `apps/agent/src/automations/`. `node-cron` para scheduling. Per-tenant via `scopedCron()`.

**O que construir:**
- Nova tool `create_reminder` / `create_automation`
- LLM extrai: schedule (cron expression), accao, condicoes
- Persistencia em tabela `custom_automations(id, tenant_schema, cron_expr, action, description, enabled, created_at)`
- Registar cron dinamicamente via `scopedCron()`
- Tool `list_automations` e `remove_automation` para gestao

**Ficheiros a criar/modificar:**
- `apps/agent/src/tools.ts` — 3 novas tools
- `apps/agent/src/automations/custom.ts` — novo, gestao de automacoes custom
- Migration nova — tabela custom_automations

**Criterio de aceitacao:**
- "Lembra-me toda segunda as 9h de verificar o orcamento" → cron criado
- "Automacoes" → lista automacoes activas
- "Remove o lembrete de segunda" → cron removido

---

### 3.3 Heartbeat Autonomy (#23)

**O que ja existe:** `alerts.ts`, `health-insights.ts`, `daily-checkin.ts` — automacoes fixas para todos os tenants.

**O que construir:**
- Refactor: cada modulo tem um `heartbeat()` que analisa dados reais do tenant
- Heartbeat corre 1x/dia (configuravel) por modulo activo
- So notifica quando ha algo relevante (gap detection, anomalias, deadlines)
- Suprimir se tenant inactivo (ja existe logica de [SILENT] cron)

**Ficheiros a criar/modificar:**
- `packages/modules/*/heartbeat.ts` — novo em cada modulo (finances, health, people, objectives, legal)
- `apps/agent/src/automations/heartbeat.ts` — novo, orchestrador que corre heartbeats por tenant
- Modulos existentes de automacao (`alerts.ts`, `health-insights.ts`) migrados para este padrao

**Criterio de aceitacao:**
- Finances: detecta transacao recorrente em falta → notifica
- Health: gap de 3 dias sem sono → nudge
- People: contacto proximo sem interaccao ha X dias → sugere check-in
- So notifica quando relevante — zero spam

---

### 3.4 Offline Resilience (#44)

**O que ja existe:** Nenhum message queue.

**O que construir:**
- Tabela `pending_messages(id, tenant_schema, channel, channel_message_id, content, status, created_at, processed_at)`
- INSERT com `status = 'pending'` ANTES de processar
- UPDATE para `processed` apos sucesso
- No startup: processar mensagens pendentes
- Timeout: pendentes ha >1h marcadas `expired` com notificacao

**Ficheiros a modificar:**
- `apps/agent/src/handler.ts` — wrap processing com pending_messages
- `apps/agent/src/index.ts` — processar pendentes no startup
- Migration nova — tabela pending_messages

**Criterio de aceitacao:**
- Agent crash durante processamento → mensagem re-processada no restart
- Mensagens nao se perdem durante downtime
- Pendentes ha >1h expiram com aviso

---

## S4 — Observabilidade

**Objectivo:** Medir tudo antes de construir features avancadas. Dados informam priorizacao futura.

### 4.1 Painel Admin Monitoring (#2)

**O que ja existe:** Health endpoint, admin dashboard com tenant list, error-summary widget, log viewer por servico.

**O que construir:**
- Status de conexao Discord por tenant: online/offline/reconectando
- API key health: valida/expirada/rate-limited (sem revelar secret)
- Erros recentes por tenant (lista com tipo, modulo, timestamp)
- Timeline de eventos criticos (restarts, falhas auth, migrations)
- Usage summary: mensagens hoje, tokens, custo estimado

**Ficheiros a modificar:**
- `apps/web/components/admin/admin-dashboard.tsx` — expandir com novos widgets
- `apps/agent/src/api/server.ts` — novos endpoints de status por tenant
- `apps/web/components/admin/` — novos componentes de monitoring

**Criterio de aceitacao:**
- Admin ve status Discord de cada tenant em tempo real
- Erros recentes visiveis sem ir ao servidor
- Usage summary por tenant

---

### 4.2 Data Completeness Score (#6)

**O que ja existe:** Nada.

**O que construir:**
- Funcao `calculateCompleteness(tenantSchema)` por modulo
- Checklists por modulo (finances: contas? categorias? orcamento? | health: metas sono? peso base? etc.)
- Widget no dashboard: "Configuracao: 5/8 modulos completos" com barra de progresso
- Mensagem proactiva do agente na primeira semana se score < 50%

**Ficheiros a criar/modificar:**
- `packages/modules/*/completeness.ts` — novo em cada modulo
- `apps/web/components/widgets/system/completeness-score.tsx` — novo widget
- `apps/web/lib/widgets/registry.ts` — registar widget
- `apps/agent/src/automations/onboarding-nudge.ts` — novo, nudge se score baixo

**Criterio de aceitacao:**
- Widget mostra score real por modulo
- Click em modulo incompleto → wizard inline com proximos passos
- Agente sugere configuracao na primeira semana

---

### 4.3 LLM Cost by Intent Type (#15)

**O que ja existe:** `cost-tracker.ts` com tracking de tokens por tenant. Worker token tracking por task type.

**O que construir:**
- Classificar cada chamada LLM por categoria de intent (simple, CRUD, analysis, complex)
- Persistir no activity_log com campo `intent_category`
- Widget admin: grafico de barras com distribuicao de tokens por categoria
- Identificar onde intent caching (#4) teria mais impacto

**Ficheiros a modificar:**
- `apps/agent/src/cost-tracker.ts` — adicionar intent_category
- `apps/agent/src/middleware/routing.ts` — classificar intent antes do LLM
- `apps/web/components/admin/` — widget de cost breakdown

**Criterio de aceitacao:**
- Cada LLM call tem intent_category registado
- Admin ve distribuicao de custo por categoria
- Alerta se custo de uma categoria explode

---

### 4.4 Error Budget (#12)

**O que ja existe:** activity_log com event types variados.

**O que construir:**
- Tracking de "falhas de assistencia": respostas "nao tenho dados", accoes que activaram prerequisite guard, perguntas sem resposta satisfatoria
- Tabela ou event type novo no activity_log: `assistance_failure`
- Admin: ranking de intents mais falhados, error rate por tenant, tendencia

**Ficheiros a modificar:**
- `apps/agent/src/middleware/persistence.ts` — detectar e registar falhas
- `apps/web/components/admin/` — widget de error budget

**Criterio de aceitacao:**
- Falhas de assistencia registadas automaticamente
- Admin ve "ten2: 12 falhas em finance — falta configuracao de contas"
- Tendencia visivel (subir/descer)

---

## S5 — Onboarding & Integracao

**Objectivo:** Melhorar retencao pos-onboarding e integrar com servicos externos chave.

### 5.1 Fila de Accoes Pendentes (#8)

**O que ja existe:** `pending_intents` do S1 (#1 + #13). Este sprint expande para uma fila completa.

**O que construir:**
- Lista de intents pendentes visivel no dashboard
- Comando `pendentes` no Discord
- Execucao automatica quando pre-requisito satisfeito (com confirmacao)
- Expiracao configuravel

**Ficheiros a modificar:**
- `apps/web/app/dashboard/` — pagina de pendentes
- `apps/agent/src/tools.ts` — tool `list_pending`

---

### 5.2 7-Day Onboarding Intelligence (#14)

**O que construir:**
- Sequencia adaptativa para os primeiros 7 dias, baseada no que ja foi feito
- Progressao automatica: se user ja fez accao sugerida, passa a proxima
- Sem spam: se user ignora 2 sugestoes, pausa e pergunta

**Ficheiros a criar:**
- `apps/agent/src/automations/onboarding-sequence.ts` — novo
- Migration — tabela `onboarding_progress(tenant_schema, step, status, created_at)`

---

### 5.3 Weekly Review Guiada (#35)

**O que ja existe:** `weekly-review.ts` — envia resumo passivo.

**O que construir:**
- Tornar interactiva: recap → perguntas → objectivos → proxima semana
- Botoes Discord para navegar entre seccoes
- Resumo guardado como entrada semanal

**Ficheiros a modificar:**
- `apps/agent/src/automations/weekly-review.ts` — refactor para modo interactivo

---

### 5.4 Google Calendar Sync Bidireccional (#42)

**O que ja existe:** Modulo calendar com dados manuais. `token-manager.ts` para OAuth.

**O que construir:**
- OAuth2 flow no dashboard (Settings > Integrations > Google Calendar)
- Import inicial de eventos futuros + 30 dias passados
- Sync continuo via polling (5min) ou webhooks
- Bidireccional: eventos Hawk OS → Google Calendar

**Ficheiros a criar:**
- `packages/modules/calendar/google-sync.ts` — novo
- `apps/web/app/dashboard/settings/integrations/` — UI de conexao
- Migration — tabela `calendar_sync_state(tenant_schema, google_calendar_id, sync_token, last_sync)`

---

## S6 — Canais & Import

**Objectivo:** Expandir acessibilidade e eliminar barreiras de entrada de dados.

### 6.1 Telegram / WhatsApp Channel (#41)

**O que ja existe:** `ChannelCapabilities` com presets em `channels/types.ts`. Feature flag `multi-channel`.

**O que construir:**
- Telegram adapter (Bot API gratuita) seguindo padrao do discord-adapter.ts
- WhatsApp adapter (Meta Cloud API) como segundo canal
- Configuracao de token por tenant no dashboard

**Ficheiros a criar:**
- `apps/agent/src/channels/telegram-adapter.ts` — novo
- `apps/agent/src/channels/whatsapp-adapter.ts` — novo (opcional, Telegram primeiro)

---

### 6.2 Relatorios Configuraveis (#11)

**O que construir:**
- Tipos de relatorio: financeiro semanal, objectivos, saude mensal, pessoas, digest completo
- Configuracao por tenant: dia, hora, canal, nivel de detalhe
- UI no dashboard para activar/desactivar relatorios

**Ficheiros a criar:**
- `apps/agent/src/automations/reports.ts` — novo, sistema de relatorios
- `apps/web/app/dashboard/settings/reports/` — UI de configuracao
- Migration — tabela `report_config(tenant_schema, report_type, schedule, channel, detail_level, enabled)`

---

### 6.3 Import Wizards (#9)

**O que construir:**
- **Prioridade 1:** CSV de extrato bancario com mapping de colunas
- Preview antes de confirmar, rollback 24h
- Deteccao automatica de formato (Nubank, Millennium, etc.)

**Ficheiros a criar:**
- `apps/web/app/dashboard/finances/import/` — wizard step-by-step
- `apps/web/lib/actions/import.ts` — server actions de import

---

### 6.4 Open Banking (#46)

**O que construir:**
- Integracao GoCardless Bank Account Data (EU, gratis)
- OAuth flow no dashboard, sync diario automatico
- Matching de transacoes com categorias existentes

**Ficheiros a criar:**
- `packages/modules/finances/banking-sync.ts` — novo
- `apps/web/app/dashboard/settings/integrations/banking/` — UI

---

## S7 — Inteligencia

**Objectivo:** Features avancadas de analise e exportacao. Requer dados acumulados dos sprints anteriores.

### 7.1 Cross-Module Pattern Detection (#7)

- Job semanal de correlacao cross-module
- LLM sintetiza insights a partir de dados reais
- Resultados guardados como memories tipo `pattern`

### 7.2 Deep Research Mode (#19)

- Multi-step: planear queries → pesquisar em paralelo → sintetizar
- Web search (SearXNG) + crawl (readability) + LLM synthesis
- Resultado como artefacto descarregavel

### 7.3 Skill Auto-Creation (#20)

- Apos tarefa complexa bem sucedida, extrair procedimento como skill
- Skills visiveis e editaveis no dashboard
- Execucao directa na segunda vez

### 7.4 Cross-Session Search (#21)

- FTS index sobre session_archives.content
- Query → matching sessions → LLM extrai contexto relevante
- Resposta com referencia temporal

### 7.5 Artifact Generation (#24)

- PDF/Markdown export de relatorios
- Tipos: relatorio financeiro, CV, resumo de saude, plano de objectivos
- Trigger via Discord ou botao "Exportar" no dashboard

### 7.6 Goal Hierarchy (#25)

- parent_id em objectives, tree UI interactiva
- Progresso do pai calculado pelos filhos
- Drag-and-drop para reorganizar

---

## S8 — Proactividade

**Objectivo:** O sistema torna-se proactivo — antecipa necessidades e confronta o utilizador com dados.

### 8.1 Simulacao Eu Futuro (#26)
- Projecoes 6/12/24 meses baseadas em dados reais
- Grafico de projecao com cenarios (actual vs optimizado)

### 8.2 Detector de Contradicoes (#27)
- Detecta discrepancias entre objectivos declarados e comportamento
- Tom nao-punitivo, max 1 contradicao/modulo/semana

### 8.3 Briefing de Reuniao (#28)
- 30min antes de evento com attendees conhecidos → briefing automatico
- Depende do #42 (Google Calendar sync) estar implementado

### 8.4 Auditoria de Subscricoes (#29)
- Deteccao de recorrencias em transacoes
- Lista de subscricoes activas com custo total
- Sugestao de optimizacoes

### 8.5 Diario de Decisoes (#30)
- Registro estruturado de decisoes importantes
- Follow-up automatico apos N semanas

### 8.6 Radar de Equilibrio de Vida (#31)
- Spider chart com 6 dimensoes calculadas automaticamente
- Historico semanal, alerta quando dimensao cai

---

## S9 — Ecosystem

**Objectivo:** Expandir o ecosistema com integracoes externas e features avancadas.

### 9.1 Detector de Oportunidades (#32)
### 9.2 Delegacao Inteligente (#33)
### 9.3 Web Clipper Extension (#34)
### 9.4 Historico de Evolucao (#36)
### 9.5 Modo Foco (#37)
### 9.6 Coaching de Negociacao (#38)
### 9.7 Assistente de Impostos (#40)
### 9.8 Dashboard Sharing (#45)

> S9 sera detalhado quando S1-S8 estiverem completos. A priorizacao interna depende dos dados de usage recolhidos em S4.

---

## S10 — Moonshots

**Objectivo:** Features ambiciosas que requerem infra adicional.

### 10.1 Sub-Agent Spawning (#16)
- Orchestrator que decompoe tarefas complexas em sub-agents paralelos
- Infra de sub-agents ja existe (gemma4 local)

### 10.2 Browser Automation (#17)
- Headless Chrome para accoes web em nome do utilizador
- Requer instancia separada ou API externa (VPS sem margem de RAM)
- Gate de aprovacao obrigatorio antes de accoes com efeitos financeiros/legais

### 10.3 Web Monitoring (#18)
- Subscricoes de URL com alertas automaticos
- Polling periodico + diff detection + LLM para relevancia

> S10 sera detalhado quando a infra o permitir. Browser automation pode requerer upgrade de VPS ou servico externo.

---

## Dependencias entre Sprints

```
S1 ──→ S2 ──→ S3 ──→ S4 (sequenciais, cada um build on anterior)
                        │
                        ├──→ S5 (onboarding usa dados de S4)
                        ├──→ S6 (canais independentes, mas import beneficia de S4)
                        │
                        └──→ S7 (inteligencia requer dados acumulados de S1-S6)
                              │
                              ├──→ S8 (proactividade usa patterns de S7)
                              └──→ S9 (ecosystem usa tudo anterior)
                                    │
                                    └──→ S10 (moonshots, quando infra permitir)
```

**Nota:** S5 e S6 podem correr em paralelo apos S4. S7+ e sequencial.

---

## Metricas de Sucesso

| Metrica | Baseline | Target pos-S4 |
|---------|----------|----------------|
| LLM calls por dia (media) | 100% | -30% (via S2 intent caching) |
| Erros de pre-requisito | desconhecido | 0 (via S1 guard) |
| Quality score (feedback) | n/a | >80% thumbs up (via S2 feedback loop) |
| Mensagens perdidas | desconhecido | 0 (via S3 message queue) |
| Modulos configurados por tenant | desconhecido | >60% (via S4 completeness score) |
| Admin visibility | parcial | completa (via S4 monitoring) |

---

## Notas Finais

- **Reavaliar apos S4:** Os dados de observabilidade (cost by intent, error budget, completeness score) devem informar a priorizacao de S5+. Ideias podem subir ou descer de prioridade.
- **Hardware:** A VPS actual (16GB RAM, 4 vCPU) suporta tudo ate S9. S10 (browser automation) pode requerer upgrade ou servico externo.
- **Modelos:** O gemma4:e2b local e suficiente para S1-S6. Features de S7+ (deep research, pattern detection) beneficiam de modelos maiores — reavaliar quando chegar la.

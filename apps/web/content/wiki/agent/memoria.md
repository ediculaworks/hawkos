# Sistema de Memória

## Visão Geral

O sistema de memória do Hawk OS é inspirado no OpenViking e usa embeddings vetoriais para recuperação semântica. Memórias são fatos persistentes sobre você — diferentes de mensagens de conversas que têm TTL e são compactadas.

> 🧩 **Para leigos:** A diferença entre memória e histórico de conversa: o histórico é o que você disse ontem (temporário, some depois de 30 min de inatividade). A memória é o que o agente aprendeu sobre você e guarda para sempre — como "prefere respostas diretas" ou "trabalha na EdiculaWorks". O agente usa essas memórias para te conhecer cada vez melhor ao longo do tempo.

Enquanto o contexto L0/L1/L2 é gerado dinamicamente dos dados do banco a cada mensagem, as **memórias** são entidades curadas que representam conhecimento consolidado sobre seus padrões, preferências e identidade.

## Os 7 Tipos de Memória

### 1. `profile` — Fatos sobre quem você é

Informações estáticas ou raramente mudadas sobre sua identidade.

```
"Tenho 27 anos, sou médico"
"Moro em São Paulo, bairro Pinheiros"
"Cofundador da EdiculaWorks"
"Tenho TDAH diagnosticado"
```

**Criação**: majoritariamente manual via `save_memory`. O agente extrai automaticamente quando você menciona algo relevante.

### 2. `preference` — Como você prefere as coisas

Suas preferências de comunicação, estilo, ferramentas, comida, etc.

```
"Prefere respostas diretas, sem floreios"
"Usa Nubank como conta principal"
"Prefere treinar de manhã antes das 08h"
"Não gosta de reuniões às segundas"
```

**Criação**: mista — o agente detecta quando você expressa preferências.

### 3. `entity` — Pessoas, empresas, projetos

Entidades nomeadas com características relevantes.

```
"João Silva: sócio na EdiculaWorks, contato principal WhatsApp"
"EdiculaWorks: empresa de tech saúde, CNPJ ativo, 3 funcionários"
"Projeto Atlas: plataforma de telemedicina, em desenvolvimento"
```

**Criação**: manual ou automática quando entidades novas são mencionadas.

### 4. `event` — Ocorrências significativas

Eventos pontuais que vale lembrar — decisões, marcos, acontecimentos.

```
"18/03/2026: Assinou contrato com Hospital das Clínicas"
"Janeiro/2026: Viagem para Buenos Aires, 5 dias"
"15/02/2026: Decidiu pausar academia por lesão no joelho"
```

**Criação**: automática pelo session compactor ao final de sessões.

### 5. `case` — Situações + aprendizados

Padrões situacionais com contexto e lição aprendida.

```
"Quando não dorme bem, produtividade cai ~40% no dia seguinte"
"Negociação com fornecedores: sempre pedir 3 orçamentos, prazo 2 semanas"
"Problema de ansiedade pré-apresentação: técnica 4-7-8 funcionou bem"
```

**Criação**: automática — o LLM identifica situação + aprendizado nas conversas.

### 6. `pattern` — Padrões comportamentais

Comportamentos recorrentes observados ao longo do tempo.

```
"Gasta mais em delivery às sextas-feiras"
"Produtividade máxima entre 10h-13h"
"Negligeneia rotina de exercícios quando tem projetos urgentes"
"Streak de meditação quebra após viagens"
```

**Criação**: automática — extraída de múltiplas sessões que mostram o mesmo padrão.

### 7. `procedure` — Regras aprendidas / comportamentos corrigidos

Regras que o agente aprendeu a seguir, geralmente a partir de correções do usuário.

```text
"Quando eu digo 'registra', sempre usar a tool create_transaction, nunca save_memory"
"Preferência de formato: relatórios financeiros sempre com breakdown por categoria"
"Nunca sugerir treino em dia de descanso programado"
```

**Criação**: automática — o LLM identifica correções e regras implícitas nas conversas. Half-life de 365 dias (quase permanente).

## Como Memórias São Criadas

### Manual — Tool `save_memory`

Você pode pedir ao agente para salvar qualquer memória:

```
"anota que eu prefiro reuniões curtas de no máximo 30 minutos"
→ Agente chama: save_memory({ type: 'preference', content: '...' })

"lembra que o João me deve R$500 desde fevereiro"
→ Agente chama: save_memory({ type: 'case', content: '...' })
```

### Automático — Session Compactor

Ao final de cada sessão (30 minutos de inatividade), o Session Compactor analisa a conversa e extrai memórias automaticamente. Veja a seção [Session Compactor](#session-compactor) abaixo.

## Scoring e Recuperação

Quando uma mensagem chega, o sistema busca as **top 5 memórias mais relevantes** usando um score composto de 4 sinais:

```text
score = (semântica × 0.45) + (hotness × 0.25) + (importância × 0.15) + (confiança × 0.15)
```

### Similaridade Semântica (45%)

Busca por embeddings no pgvector. O texto da mensagem é convertido em embedding e comparado com os embeddings de todas as memórias via distância coseno.

```sql
SELECT id, content, 1 - (embedding <=> $1) AS similarity
FROM agent_memories
WHERE user_id = $2
ORDER BY similarity DESC
LIMIT 20;
```

### Hotness Score (25%)

Mede frequência de acesso e recência combinadas:

```typescript
function hotnessScore(accessCount: number, updatedAt: Date, module: string): number {
  // Frequência normalizada (sigmoid do log)
  const frequency = 1 / (1 + Math.exp(-Math.log1p(accessCount)));

  // Decaimento exponencial baseado no half-life do módulo
  const daysSince = (Date.now() - updatedAt.getTime()) / 86_400_000;
  const halfLife = MEMORY_HALF_LIVES[module] ?? 180;
  const recency = Math.exp((-Math.LN2 / halfLife) * daysSince);

  return frequency * recency;
}
```

### Half-Lives por Módulo

Memórias de módulos diferentes têm velocidades de decaimento diferentes:

| Módulo | Half-life (dias) | Razão |
|--------|-----------------|-------|
| `routine` | 3 | Hábitos mudam rápido |
| `health` | 7 | Dados de saúde recentes são mais relevantes |
| `calendar` | 14 | Eventos têm janelas curtas |
| `finances` | 30 | Padrões financeiros mensais |
| `objectives` | 30 | Metas mudam com sprints |
| `entertainment` | 60 | Preferências mudam devagar |
| `housing` | 60 | Situação de moradia é estável |
| `knowledge` | 90 | Conhecimento é durável |
| `career` | 90 | Trajetória muda devagar |
| `legal` | 90 | Obrigações têm ciclos longos |
| `assets` | 120 | Patrimônio muda raramente |
| `people` | 180 | Relacionamentos são duráveis |
| `procedure` | 365 | Regras aprendidas — quase permanente |
| `default` | 180 | Para módulos sem half-life definido |

> 💡 **Dica:** O sistema usa half-lives adaptativos via `getAdaptiveHalfLife(module)`. Se houver dados suficientes de acesso, o half-life é ajustado automaticamente. Caso contrário, usa os valores hardcoded acima.

### Importância (15%)

Campo em cada memória, escala 1-10. O LLM atribui importância ao criar a memória. Memórias críticas (type `profile`, fatos fundamentais) recebem 9-10.

### Confiança (15%)

Campo `confidence` (0.0-1.0) indica a certeza da informação extraída:

- **1.0** — Afirmado diretamente pelo usuário ("eu tenho 27 anos")
- **0.8** — Default, informação clara mas não explicitamente confirmada
- **0.5** — Implícito, inferido do contexto
- **0.3** — Incerto, pode estar errado

NaN guard aplicado: se o valor for inválido, usa 0.5 como fallback.

### Busca em Paralelo

A recuperação usa três estratégias simultâneas para garantir diversidade:

```typescript
const [semantic, hottest, topImportance] = await Promise.all([
  semanticSearch(embedding, userId, 10),   // top 10 por similaridade
  hottestMemories(userId, 10),             // top 10 por hotness
  topByImportance(userId, 10),             // top 10 por importância
]);

// Merge em mapa de score, retorna top 5
const scoreMap = mergeAndScore(semantic, hottest, topImportance);
return topN(scoreMap, 5);
```

## Session Compactor

> 🧩 **Para leigos:** O Session Compactor é como um assistente que lê sua conversa depois que você termina e extrai os pontos importantes para guardar na memória de longo prazo. Funciona automaticamente, 30 minutos depois que você para de conversar.

O Session Compactor roda a cada hora via cron e processa sessões inativas há 30+ minutos.

### Pipeline de 5 Estágios

#### Estágio 1 — Detectar Sessões Inativas

```sql
SELECT session_id, channel, last_message_at
FROM conversation_sessions
WHERE last_message_at < NOW() - INTERVAL '30 minutes'
  AND compacted = false;
```

#### Estágio 2 — Gerar Archive

O LLM lê todas as mensagens da sessão e gera:
- **abstract**: 1-2 frases resumindo o que aconteceu
- **overview**: parágrafo detalhado com principais tópicos, decisões, ações

```typescript
const archive = await llm.complete(`
  Summarize this conversation session:
  - abstract: 1-2 sentences
  - overview: detailed paragraph with topics, decisions, actions taken

  Messages: ${sessionMessages}
`);
```

#### Estágio 3 — Extrair Candidatos de Memória

O LLM analisa a sessão inteira e extrai memórias candidatas:

```typescript
const candidates = await llm.complete(`
  Extract memories from this conversation.
  Return JSON array with: { type, content, importance, module }
  Types: profile | preference | entity | event | case | pattern

  Session: ${archive.overview}
  Messages: ${sessionMessages}
`);
```

#### Estágio 4 — Deduplicação Estágio 1 (Embeddings)

Para cada candidato, busca memórias existentes similares:

```typescript
const threshold = ['event', 'case'].includes(candidate.type) ? 0.95 : 0.85;
const similar = await semanticSearch(candidate.embedding, userId, 5);
const duplicates = similar.filter(m => m.similarity > threshold);
```

Thresholds diferentes porque eventos e casos são mais únicos — queremos evitar perder nuances.

#### Estágio 5 — Deduplicação Estágio 2 (LLM Decision)

> ⚠️ **Atenção:** Este é o passo mais caro (chama o LLM uma vez por candidato com similar). O threshold alto do estágio 4 (0.85/0.95) garante que só candidatos realmente similares chegam aqui, mantendo o custo baixo.

Para candidatos com similares encontrados no estágio 4, o LLM decide:

```typescript
const decision = await llm.complete(`
  Existing memory: "${existing.content}"
  New candidate: "${candidate.content}"

  Decision:
  - SKIP: if new candidate is duplicate/redundant
  - MERGE: if new candidate adds information (return merged content)
  - CREATE: if new candidate is distinct enough
`);
```

Isso evita que o banco encha de memórias redundantes enquanto ainda captura nuances importantes.

### Resultado do Compactor

Ao final do pipeline:
- Sessão marcada como `compacted = true`
- Archive salvo em `session_archives`
- Novas memórias salvas em `agent_memories`
- Memórias mescladas atualizadas

## RRF Hybrid Search

Quando a feature flag `rrf-hybrid-search` está habilitada, a busca de memórias usa **Reciprocal Rank Fusion** combinando dois sinais:

1. **Vector search** (pgvector) — similaridade semântica via embeddings
2. **Trigram search** (pg_trgm) — correspondência textual via GIN index

A fórmula RRF combina os rankings:

```text
score = Σ(weight_i / (k + rank_i))
```

Com k=60 (default do Onyx) e pesos default 0.6 vector / 0.4 keyword.

**Fallback chain**: Se a RPC `hybrid_search_memories_rrf` não existir no banco, o sistema cai para busca simples ponderada e depois para vector-only.

## Visualizando Memórias

Acesse `/dashboard/memory` — a página unificada de Memória com 6 abas:
- **Memórias**: explorador avançado com filtros por tipo, módulo, status e importância
- **Sessões**: timeline de sessões arquivadas com resumos e memórias extraídas
- **Notas**: segundo cérebro com notas, bookmarks e promoção para memórias
- **Biblioteca**: rastreamento de livros com status e ratings
- **Grafo**: visualização force-directed da rede de memórias
- **Inteligência**: analytics do sistema — timeline de criação, distribuição por tipo/módulo, half-lives adaptativos

## Tabelas no Banco

```sql
-- Memórias persistentes
agent_memories (
  id, user_id, type, content, module,
  importance, confidence, access_count, embedding,
  created_at, updated_at
)

-- Arquivo de sessões compactadas
session_archives (
  id, session_id, channel, user_id,
  abstract, overview, message_count,
  created_at
)

-- Mensagens individuais (TTL implícito)
conversation_messages (
  id, session_id, role, content, channel,
  created_at
)
```

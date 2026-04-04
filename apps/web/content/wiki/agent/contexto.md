# Sistema de Contexto (L0/L1/L2)

## Conceito

O agente precisa de contexto para responder bem, mas contexto tem custo: tokens custam dinheiro e aumentam latência. O sistema de contexto em camadas resolve isso carregando apenas o que é necessário para cada mensagem.

> 🧩 **Para leigos:** Imagine que o agente tem três gavetas de fichas sobre você. A gaveta L0 tem um resumo de uma linha de cada área da sua vida — sempre aberta. A gaveta L1 tem os detalhes de uma área específica — abre quando você fala sobre ela. A gaveta L2 tem os dados granulares de uma consulta específica — abre só quando você pede um relatório detalhado.

Existem três camadas:

| Camada | Limite | Tokens aprox. | Quando carrega |
|--------|--------|---------------|----------------|
| **L0** | 2.000 chars | ~500 | Sempre, toda mensagem |
| **L1** | 8.000 chars | ~2.000 | Quando módulo é detectado |
| **L2** | 12.000 chars | ~3.000 | Quando query específica detectada |

## L0 — Resumo Permanente

L0 é carregado em **toda mensagem**, sem exceção. É o contexto mínimo para o agente entender sua situação atual. Cada módulo implementa `loadL0()` que retorna uma frase ou parágrafo curto.

Exemplos de L0 por módulo:

```
[finances] Saldo total: R$12.340. Gasto este mês: R$3.200/R$4.000 orçado.
[health] Última semana: 3 treinos, sono médio 7.2h. Peso atual: 78kg.
[objectives] 2 objetivos ativos. 5 tarefas pendentes esta semana.
[routine] 4 hábitos ativos. Streak mais longo: 12 dias (meditação).
[calendar] Próximo compromisso: amanhã 14h (dentista).
```

O L0 total de todos os módulos fica dentro do limite de 2.000 chars (~500 tokens), garantindo que o overhead de contexto seja baixo.

## L1 — Detalhes do Módulo

L1 é carregado apenas para módulos detectados como relevantes na mensagem. Inclui dados mais detalhados: lista de transações recentes, hábitos com streaks, tarefas abertas, etc.

Exemplos de L1:

```
[finances L1]
Contas: Nubank (R$8.200), Inter (R$4.140)
Últimas transações: Supermercado R$340 (ontem), Posto R$150 (sex)
Categorias mais gastas este mês: Alimentação 35%, Transporte 18%

[routine L1]
Hábitos: meditação ✅ (12d streak), academia ❌ (3d sem fazer), leitura ✅ (5d)
Hábitos em risco: academia (threshold: 3 dias)
```

## L2 — Dados Granulares

L2 só é carregado quando o sistema detecta que a mensagem pede dados específicos — relatórios, histórico, valores exatos. É a camada mais cara e só é usada quando necessário.

### Quando L2 é ativado (`requiresSpecificData()`)

A função verifica padrões na mensagem:

```typescript
const L2_PATTERNS = [
  /quanto gastei/,
  /quanto tenho/,
  /qual.*saldo/,
  /últimas.*transações/,
  /histórico/,
  /relatório/,
  /\d{1,2}\/\d{1,2}/,    // datas específicas como "15/03"
  // nomes de meses: janeiro, fevereiro, etc.
];
```

Exemplos que ativam L2:
- "quanto gastei em março?" → ativa L2 de finances
- "histórico de treinos" → ativa L2 de health
- "me mostra as transações do dia 15/03" → ativa L2 de finances

Exemplos que NÃO ativam L2:
- "registra que fui na academia" → L0+L1 suficiente
- "como tá meu saldo?" → L0 já tem o resumo

## Detecção de Módulos (Keyword Matching)

O sistema usa correspondência de palavras-chave para detectar quais módulos são relevantes para cada mensagem:

```typescript
const moduleKeywords = {
  finances:      ['gasto', 'receita', 'dinheiro', 'saldo', 'dívida', 'pagar', 'comprar', 'custo', 'r$'],
  health:        ['saúde', 'treino', 'academia', 'humor', 'sono', 'remédio', 'peso', 'cannabis', 'cigarro'],
  people:        ['pessoa', 'contato', 'ligou', 'mensagem', 'encontrei', 'aniversário'],
  career:        ['trabalho', 'empresa', 'emprego', 'projeto', 'horas', 'freelance'],
  objectives:    ['objetivo', 'meta', 'tarefa', 'progresso'],
  routine:       ['hábito', 'streak', 'rotina'],
  assets:        ['bem', 'documento', 'patrimônio'],
  entertainment: ['filme', 'série', 'música', 'skate', 'lazer'],
  legal:         ['imposto', 'cnpj', 'das', 'irpf', 'contrato', 'prazo'],
  housing:       ['aluguel', 'casa', 'conta de'],
  calendar:      ['agenda', 'evento', 'amanhã', 'semana', 'compromisso', 'consulta'],
  demands:       ['demanda', 'projeto', 'tarefa complexa', 'executar'],
};
```

A detecção é case-insensitive e verifica substrings. Uma mensagem pode ativar múltiplos módulos:

```
"gastei R$200 comprando suplementos para a academia"
→ detecta: finances (r$, gastei), health (academia)
→ carrega L0 de todos + L1 de finances + L1 de health
```

## Como Módulos Implementam Contexto

Cada módulo em `packages/modules/<nome>/context.ts` implementa três funções:

```typescript
// packages/modules/finances/context.ts

export async function loadL0(userId: string): Promise<string> {
  const summary = await getFinancialSummary(userId);
  return `[finances] Saldo: R$${summary.totalBalance}. Gasto mensal: R$${summary.monthSpend}/R$${summary.monthBudget}.`;
}

export async function loadL1(userId: string): Promise<string> {
  const [accounts, recentTx] = await Promise.all([
    getAccounts(userId),
    getRecentTransactions(userId, 5),
  ]);
  return formatL1(accounts, recentTx);
}

export async function loadL2(userId: string, query: string): Promise<string> {
  // L2 recebe a query para ser mais específico
  const period = extractPeriod(query); // extrai "março", "15/03", etc.
  const transactions = await getTransactionsByPeriod(userId, period);
  return formatL2(transactions);
}
```

O assembler em `packages/context-engine/src/assembler.ts` chama estas funções com **fault isolation** — cada módulo pode falhar independentemente:

```typescript
// Para cada módulo detectado (fault-isolated)
const l1Results = await Promise.allSettled(
  detectedModules.map(mod => modules[mod].loadL1(userId))
);
const l1Sections = l1Results
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value);

// L2 apenas se necessário (wrapped em try/catch)
const l2Sections = requiresSpecificData(message)
  ? await Promise.allSettled(detectedModules.map(mod => modules[mod].loadL2(userId, message)))
  : [];
```

> 💡 **Dica:** `Promise.allSettled` em vez de `Promise.all` garante que se um módulo falhar (ex: módulo de finanças com erro de DB), os outros continuam normalmente. O agente responde com menos contexto, mas não crasha.

## Exemplo de Contexto Completo Montado

Para a mensagem: "quanto gastei em restaurantes essa semana?"

```
[CONTEXT]

## Resumo Geral (L0)
[finances] Saldo total: R$12.340. Gasto este mês: R$3.200/R$4.000 orçado.
[health] Última semana: 3 treinos, sono médio 7.2h.
[objectives] 2 objetivos ativos. 5 tarefas pendentes.
[routine] 4 hábitos ativos. Meditação: 12 dias streak.
[calendar] Próximo: amanhã 14h (dentista).

## Memórias Relevantes
- preference: Prefere relatórios com breakdown por categoria (acessada 8x)
- pattern: Gasta mais em restaurantes às sextas (padrão observado)
- profile: Orçamento mensal para alimentação: R$800

## Detalhes — Finanças (L1)
Contas: Nubank (R$8.200), Inter (R$4.140)
Categorias este mês: Alimentação 35%, Transporte 18%, Lazer 12%

## Dados Específicos — Finanças (L2)
Transações em Restaurantes (últimos 7 dias):
- Qua 19/03: Sushi House R$85
- Sex 21/03: Bar do João R$120
- Sáb 22/03: Pizza Hut R$67
Total: R$272

[/CONTEXT]
```

## Caching

> 💡 **Dica:** O cache de L0 existe porque em conversas rápidas (várias mensagens em 5 minutos), seria desperdício recalcular o resumo de finanças/saúde/hábitos a cada mensagem. L1 e L2 não são cacheados porque o usuário pode ter acabado de registrar algo que precisa aparecer imediatamente.

L0 é cacheado por 5 minutos por usuário para evitar queries repetidas em conversas rápidas. L1 e L2 não são cacheados — são sempre frescos porque o usuário pode ter acabado de registrar algo que precisa aparecer.

```typescript
const L0_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const l0Cache = new Map<string, { data: string; expiresAt: number }>();
```

## Orçamento Total

O contexto total enviado ao LLM em uma chamada típica:

| Seção | Tokens |
|-------|--------|
| System prompt (template do agente) | ~800 |
| L0 todos os módulos | ~500 |
| Memórias (top 5) | ~400 |
| Sessão anterior (resumo) | ~300 |
| L1 dos módulos detectados (2-3) | ~1.500 |
| L2 se necessário | ~3.000 |
| Histórico (últimas 20 msgs) | ~2.000 |
| **Total típico** | **~5.000-9.000** |
| **Máximo com L2 completo** | **~12.000** |

O aviso de compactação é emitido quando o total ultrapassa 80.000 tokens, o que raramente acontece em uso normal.

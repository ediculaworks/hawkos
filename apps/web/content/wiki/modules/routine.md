# Módulo: Rotina

## O que Rastreia

O módulo de rotina gerencia hábitos diários — o que você quer fazer todos os dias (ou em dias específicos), quão consistente está sendo (streak), e quais hábitos estão em risco de quebrar. É a camada de comportamento do Hawk OS.

> 🧩 **Para leigos:** Streak é a sequência de dias consecutivos em que você completou um hábito. Se você medita há 12 dias seguidos, seu streak é 12. Se pular um dia, o streak vai a zero. O sistema rastreia isso automaticamente e te avisa quando algum streak importante está prestes a quebrar.

## Tabelas no Banco

| Tabela | O que armazena |
|--------|---------------|
| `habits` | Hábitos (nome, frequência, meta, ativo) |
| `habit_logs` | Registros diários de cada hábito (data, feito, notas) |

### Estrutura

```typescript
type Habit = {
  id: string;
  user_id: string;
  name: string;             // "Meditar", "Academia", "Ler 20min"
  description?: string;
  frequency: 'daily' | 'weekdays' | 'weekends' | 'custom';
  target_days?: number[];   // [1,2,3,4,5] = seg a sex
  icon?: string;
  color?: string;
  active: boolean;
  created_at: string;
};

type HabitLog = {
  id: string;
  habit_id: string;
  date: string;             // ISO date
  completed: boolean;
  notes?: string;
  completed_at?: string;
};
```

### Streaks

Streaks são calculados dinamicamente das `habit_logs`:
```typescript
// Streak atual = dias consecutivos completados até hoje
// Streak mais longo = maior sequência histórica
```

## Keywords que Ativam o Módulo

```
hábito, streak, rotina
```

Exemplos:
- "meditei hoje"
- "academia feita"
- "li 30 minutos"
- "como tá minha rotina?"

## Tools do Agente

| Tool | Parâmetros principais | Quando usar |
|------|----------------------|-------------|
| `create_habit` | name, frequency, description? | Criar novo hábito |
| `find_habit_by_name` | name | Buscar hábito por nome (fuzzy) |
| `log_habit` | habit_id ou name, date?, notes? | Marcar hábito como feito |
| `get_habits_at_risk` | — | Listar hábitos perto de quebrar streak |

## Comandos Comuns no Chat

```
"meditei hoje"
→ find_habit_by_name("meditação") → log_habit({ habit: meditação, date: hoje })

"academia feita, fiz peito"
→ find_habit_by_name("academia") → log_habit({ habit: academia, notes: "fiz peito" })

"li 30 min, Atomic Habits capítulo 5"
→ log_habit({ habit: "leitura", notes: "Atomic Habits cap. 5, 30min" })

"cria hábito: beber 2L de água por dia"
→ create_habit({ name: "Beber 2L de água", frequency: "daily" })

"quais hábitos estão em risco?"
→ get_habits_at_risk() → lista hábitos com streak quase quebrando

"como tá minha rotina hoje?"
→ Consulta habit_logs de hoje para todos os hábitos ativos
```

## Contexto L0/L1/L2

### L0 (~40 tokens)
```
[routine] 4 hábitos ativos. Meditação: 12d streak. Academia: 3d. Hoje: 2/4 feitos.
```

### L1 (~350 tokens)
```
Hábitos de hoje:
  ✅ Meditação (12d streak) — feito às 07:30
  ✅ Leitura (5d streak) — feito
  ❌ Academia (3d streak) — não feito
  ❌ Beber 2L água — não feito
Hábitos em risco: Academia (threshold: 3 dias — vai quebrar amanhã se não fizer)
Streaks mais longos: Meditação 12d, Leitura 5d
Semana: 18/28 hábitos completados (64%)
```

### L2 (~500 tokens)
Ativado por: "histórico de hábitos", "como foi minha rotina no mês"
```
Heatmap de conclusão por hábito nos últimos 30 dias
Taxa de conclusão por hábito e dia da semana
Tendências (melhorando/piorando)
```

## Dashboard

A página `/dashboard/routine` inclui:
- Toggle de hábitos do dia (interface principal — exceção ao "agent first")
- Widgets de streaks com visualização de sequências
- Widget "Habits Today" para o grid principal
- Histórico de hábitos em formato heatmap (similar ao GitHub contributions)

## Hábitos em Risco

> ⚠️ **Atenção:** O sistema só detecta "em risco" quando é tarde o suficiente no dia para que o hábito normalmente já teria sido feito. Se você normalmente medita às 7h, o alerta começa a aparecer se for às 10h e ainda não tiver meditado.

A tool `get_habits_at_risk` identifica hábitos onde:

```typescript
// Hábito está "em risco" quando:
// - streak > 0 (existe uma sequência)
// - hoje o hábito ainda não foi feito
// - já é tarde o suficiente que normalmente seria feito

const atRisk = habits.filter(h =>
  h.streak > 0 &&
  !todayLog?.completed &&
  isLateEnough(h.typical_completion_time)
);
```

O alerta matinal (08:00) inclui os hábitos em risco para que você não esqueça.

## Integração com Outros Módulos

- **Health**: o hábito "academia" é monitorado em conjunto com `workout_sessions`
- **Objectives**: hábitos podem ser vinculados a objetivos (ex: "meditar" → objetivo "paz mental")
- **Alerts**: automação diária notifica sobre hábitos em risco

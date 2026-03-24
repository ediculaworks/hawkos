# Módulo: Saúde

## O que Rastreia

O módulo de saúde é o mais multidimensional do Hawk OS. Rastreia treinos (com séries, pesos e progressão), sono, peso corporal, humor, observações de saúde gerais e uso de substâncias. O objetivo é ter correlações entre esses fatores — como sono afeta humor, como humor afeta treino, como substâncias afetam sono.

> 🧩 **Para leigos:** É como ter um personal trainer e um diário de saúde combinados. Você manda mensagens informais ("dormi mal, academia hoje, supino 80kg×10") e o sistema registra tudo de forma estruturada. Depois, o agente consegue fazer análises que você não faria na mão — como "você treina 20% pior nos dias depois de dormir menos de 6h".

## Tabelas no Banco

| Tabela | O que armazena |
|--------|---------------|
| `workout_sessions` | Sessões de treino (tipo, duração, notas, data) |
| `workout_sets` | Séries individuais (exercício, peso, reps, RIR) |
| `sleep_sessions` | Registros de sono (início, fim, qualidade percebida) |
| `body_measurements` | Peso, % gordura, circunferências, data |
| `health_observations` | Observações livres (humor, energia, sintomas, substâncias) |

### Estrutura de uma Sessão de Treino

```typescript
type WorkoutSession = {
  id: string;
  user_id: string;
  type: 'musculação' | 'cardio' | 'yoga' | 'outro';
  started_at: string;
  ended_at?: string;
  duration_minutes?: number;
  notes?: string;
  sets: WorkoutSet[];
};

type WorkoutSet = {
  exercise_name: string;
  weight_kg?: number;
  reps?: number;
  duration_seconds?: number;  // para exercícios isométricos
  rir?: number;               // Reps In Reserve
  notes?: string;
};
```

## Keywords que Ativam o Módulo

```
saúde, treino, academia, humor, sono, remédio, peso, cannabis, cigarro
```

Exemplos de mensagens que ativam saúde:
- "fui na academia hoje"
- "dormi mal, acordei às 3h"
- "hoje meu humor está 7/10"
- "pesando 78.5kg"
- "fumei hoje"

## Tools do Agente

| Tool | Parâmetros principais | Quando usar |
|------|----------------------|-------------|
| `log_workout` | type, duration?, notes? | Iniciar ou registrar sessão de treino |
| `add_workout_set` | session_id, exercise, weight?, reps?, rir? | Adicionar série ao treino |
| `log_sleep` | started_at, ended_at, quality? | Registrar noite de sono |
| `log_weight` | weight_kg, date? | Registrar peso corporal |
| `get_exercise_progress` | exercise_name, weeks? | Ver progressão de exercício |
| `estimate_1rm` | exercise, weight, reps | Calcular 1RM estimado (fórmula Epley) |

## Comandos Comuns no Chat

```
"fui na academia, fiz peito e tríceps, 1h"
→ log_workout({ type: "musculação", duration: 60, notes: "peito e tríceps" })

"supino reto: 80kg × 10, 80kg × 8, 75kg × 8"
→ add_workout_set(×3) com exercício, peso e reps

"dormi 6h, qualidade ruim"
→ log_sleep({ started_at: "23:00", ended_at: "05:00", quality: 3 })

"pesando 79kg"
→ log_weight({ weight_kg: 79 })

"qual meu progresso no supino?"
→ get_exercise_progress({ exercise_name: "supino reto", weeks: 12 })

"se fiz 80kg × 10 no supino, qual meu 1rm?"
→ estimate_1rm({ exercise: "supino reto", weight: 80, reps: 10 })
→ Resultado: ~107kg (fórmula Epley: w × (1 + r/30))

"humor hoje: 6/10, energia baixa"
→ health_observation com mood e energy_level

"fumei um baseado à noite"
→ health_observation com substance: cannabis
```

## Contexto L0/L1/L2

### L0 (~50 tokens)
```
[health] Última semana: 3 treinos, sono médio 7.2h. Peso: 78kg (↓0.3 semana).
```

### L1 (~400 tokens)
```
Treinos recentes:
  - Sex 21/03: Musculação - Peito/Tríceps (1h15)
  - Qua 19/03: Musculação - Costas/Bíceps (55min)
  - Seg 17/03: Musculação - Pernas (1h30)
Sono: Seg 7h (boa), Ter 5.5h (ruim), Qua 8h (ótima)
Humor médio semana: 6.8/10
Peso esta semana: 78.0 → 77.7 → 78.0kg
Exercícios destacados: Supino 80kg×10 (PR recente)
```

### L2 (~600 tokens)
Ativado por: "meu progresso em", "histórico de treinos", "relatório de saúde"
```
Progressão detalhada dos exercícios principais:
Supino Reto: Jan 70kg → Fev 75kg → Mar 80kg (+14%)
Agachamento: Jan 90kg → Fev 100kg → Mar 110kg (+22%)
...
Correlações observadas: sono <7h → treino -15% volume
```

## Dashboard

A página `/dashboard/health` inclui:

- **Header**: resumo da semana (treinos, sono médio, peso atual)
- **Workout Templates**: templates de treino pré-configurados para iniciar sessão rápida
- **Workout History**: histórico de treinos com detalhes de séries expandíveis
- **Gráficos**: progressão de peso corporal, qualidade do sono, volume de treino semanal

## Funcionalidades Especiais

### Estimativa de 1RM

Usa a fórmula de Epley: `1RM = peso × (1 + reps / 30)`

```
"se fiz 80kg × 10, qual meu 1rm?"
→ 80 × (1 + 10/30) = 80 × 1.333 = ~107kg
```

### Hábitos em Risco

Integração com o módulo de rotina — se "academia" é um hábito cadastrado, o sistema detecta quando você está em risco de quebrar o streak.

> 💡 **Dica:** Registre humor e energia como observações de saúde regularmente ("humor 7/10, energia alta"). Com algumas semanas de dados, o agente consegue encontrar correlações — como quais hábitos ou situações afetam mais seu bem-estar.

### Automação de Health Insights

A automação `health-insights.ts` roda periodicamente e envia mensagens como:
- "Você treinou 3x essa semana — acima da sua média de 2.5x"
- "Seus últimos 3 dias de sono foram ruins (<6h) — atenção"
- "Correlação detectada: nos dias que você acorda antes das 7h, humor médio é 7.8 vs 6.1"

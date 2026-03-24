# Módulo: Agenda (Calendar)

## O que Rastreia

O módulo de agenda gerencia eventos, compromissos, lembretes e slots de tempo. Integra com Google Calendar para sincronização bidirecional. O agente pode criar eventos, buscar horários livres e lembrar você de compromissos próximos.

> 🧩 **Para leigos:** É a sua agenda inteligente. Você fala "reunião com o João amanhã às 14h, 1 hora" e o evento é criado — no sistema e no Google Calendar se configurado. O diferencial é poder perguntar "tenho horário livre de 2h essa semana?" e receber slots disponíveis automaticamente.

> 💡 **Dica:** Use bloqueios de calendário (`type: "bloqueio"`) para reservar tempo para trabalho focado (deep work). O agente considera bloqueios ao buscar slots livres, então ele nunca vai sugerir um horário que você bloqueou para foco.

## Tabelas no Banco

| Tabela | O que armazena |
|--------|---------------|
| `events` | Eventos e compromissos (título, data/hora, duração, local, notas) |
| `attendees` | Participantes de eventos (person_id + role) |
| `reminders` | Lembretes configurados para eventos |

### Estrutura

```typescript
type CalendarEvent = {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_at: string;          // ISO datetime
  end_at: string;
  location?: string;
  type: 'compromisso' | 'reunião' | 'lembrete' | 'bloqueio' | 'pessoal';
  status: 'confirmado' | 'tentativo' | 'cancelado';
  google_event_id?: string;  // para sync com Google Calendar
  recurrence?: string;       // RRULE format
  attendees?: string[];      // person IDs
  notes?: string;
};
```

## Keywords que Ativam o Módulo

```
agenda, evento, amanhã, semana, compromisso, consulta
```

Exemplos:
- "tenho reunião amanhã às 14h"
- "agenda uma consulta médica"
- "o que tenho essa semana?"
- "bloqueia sexta tarde para foco"

## Tools do Agente

| Tool | Parâmetros principais | Quando usar |
|------|----------------------|-------------|
| `create_event` | title, start_at, end_at?, location?, type? | Criar evento ou compromisso |
| `find_free_slots` | date, duration_minutes | Encontrar horários livres |

## Comandos Comuns no Chat

```
"reunião com o João amanhã às 14h, 1h de duração"
→ create_event({ title: "Reunião - João", start_at: "amanhã 14:00", duration: 60 })

"consulta dentista quarta 10h"
→ create_event({ title: "Consulta dentista", start_at: "quarta 10:00", type: "compromisso" })

"bloqueia manhã de sexta para trabalho focado"
→ create_event({ title: "🎯 Deep Work", start_at: "sexta 09:00", end_at: "sexta 12:00", type: "bloqueio" })

"o que tenho essa semana?"
→ Consulta events da semana atual em ordem cronológica

"quando tenho um horário livre de 2h essa semana?"
→ find_free_slots({ week: "atual", duration: 120 })

"amanhã tem alguma coisa?"
→ Consulta events de amanhã
```

## Contexto L0/L1/L2

### L0 (~40 tokens)
```
[calendar] Hoje: 2 compromissos (14h dentista, 18h call). Amanhã: reunião 10h.
```

### L1 (~350 tokens)
```
Próximos 7 dias:
  Hoje (Sáb 22/03):
    14:00 Consulta dentista (1h)
    18:00 Call EdiculaWorks (30min)
  Dom 23/03: livre
  Seg 24/03:
    09:00 Reunião com João - Projeto Atlas (1h30)
    14:00 🎯 Deep Work (3h, bloqueado)
  Ter 25/03:
    11:00 Consulta dermatologista (confirmado)
Lembretes:
  - Renovar contrato locação (25/03)
  - DAS vencimento (28/03)
```

### L2 (~500 tokens)
Ativado por: "minha agenda de março", "eventos do mês"
```
Todos os eventos do período
Análise de tempo: reuniões vs trabalho focado vs compromissos pessoais
Conflitos de horário identificados
```

## Google Calendar Sync

A integração com Google Calendar usa OAuth 2.0:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

Eventos criados pelo agente são sincronizados para o Google Calendar via `google_event_id`. Eventos criados no Google Calendar são importados periodicamente.

## Dashboard

A página `/dashboard/calendar` inclui:
- Visualização mensal/semanal/diária
- Criação rápida de eventos com drag & drop
- Integração visual com Google Calendar
- Marcação de slots de deep work / bloqueios

## Integração com Outros Módulos

- **People**: participantes de eventos são linkados ao CRM de pessoas
- **Legal**: vencimentos de obrigações viram eventos
- **Housing**: vencimentos de contas viram lembretes
- **Objectives**: deadlines de tarefas aparecem no calendário
- **Health**: consultas médicas são eventos do tipo "compromisso"

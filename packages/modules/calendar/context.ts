import { getDayEvents, getUpcomingEvents, listEvents } from './queries';

/**
 * L0 Context: Próximos 3 eventos
 * ~30 tokens. Carregado em contexto de agenda/tempo.
 */
export async function loadL0(): Promise<string> {
  try {
    const events = await getUpcomingEvents(7);

    if (events.length === 0) {
      return '## Agenda\nNenhum evento próximo.';
    }

    const lines = [
      '## Agenda (Próximos Eventos)',
      ...events.slice(0, 3).map((e) => {
        const start = new Date(e.start_at).toLocaleString('pt-BR');
        return `- **${e.title}** (${start})`;
      }),
    ];

    return lines.join('\n');
  } catch (_error) {
    return '## Agenda (indisponível)';
  }
}

/**
 * L1 Context: Próximos 7 dias com detalhes
 * ~150 tokens. Carregado quando agenda é mencionada.
 */
export async function loadL1(): Promise<string> {
  try {
    const events = await getUpcomingEvents(7);

    if (events.length === 0) {
      return '## Agenda Detalhada\nNenhum evento próximo nos próximos 7 dias.';
    }

    const groupedByDay: Record<string, (typeof events)[0][]> = {};
    for (const event of events) {
      const date = new Date(event.start_at).toLocaleDateString('pt-BR');
      if (!groupedByDay[date]) groupedByDay[date] = [];
      groupedByDay[date].push(event);
    }

    const lines = ['## Agenda Detalhada (7 dias)'];

    for (const [date, dayEvents] of Object.entries(groupedByDay)) {
      lines.push(`\n### ${date}`);
      const sortedEvents = dayEvents.sort(
        (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      );
      for (const e of sortedEvents) {
        const time = new Date(e.start_at).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        lines.push(
          `- **${time}** - ${e.title}${e.location ? ` (📍 ${e.location})` : ''}${e.description ? `\n  ${e.description}` : ''}`,
        );
      }
    }

    return lines.join('\n');
  } catch (_error) {
    return '## Agenda (indisponível)';
  }
}

/**
 * L2 Context: Dados específicos (histórico completo, análises)
 * ~300 tokens. Carregado para queries específicas (calendário completo do mês, etc).
 */
export async function loadL2(query?: string): Promise<string> {
  try {
    const today = new Date();
    let events: Awaited<ReturnType<typeof getUpcomingEvents>> = [];

    if (query?.toLowerCase().includes('mês') || query?.toLowerCase().includes('mes')) {
      // Próximos 30 dias
      const endDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      events = await listEvents({
        startDate: today.toISOString(),
        endDate: endDate.toISOString(),
        limit: 100,
      });
    } else if (query?.toLowerCase().includes('semana') || query?.toLowerCase().includes('week')) {
      // Próximos 7 dias
      events = await getUpcomingEvents(7);
    } else if (query?.toLowerCase().includes('dia') && query?.match(/\d{4}-\d{2}-\d{2}/)) {
      // Data específica
      const match = query.match(/\d{4}-\d{2}-\d{2}/);
      if (match) {
        events = await getDayEvents(match[0]);
      }
    } else {
      // Padrão: próximos 30 dias
      events = await getUpcomingEvents(30);
    }

    if (events.length === 0) {
      return '## Calendário Completo\nNenhum evento encontrado neste período.';
    }

    const lines = [
      `## Calendário Detalhado (${events.length} evento${events.length > 1 ? 's' : ''})`,
      ...events
        .map((e) => {
          const start = new Date(e.start_at);
          const end = new Date(e.end_at);
          const date = start.toLocaleDateString('pt-BR');
          const time = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const duration = Math.round((end.getTime() - start.getTime()) / 60000);

          return (
            `**${date}** às ${time} (${duration}min)\n` +
            `- ${e.title}${e.location ? ` 📍 ${e.location}` : ''}${e.description ? `\n- ${e.description}` : ''}`
          );
        })
        .join('\n\n'),
    ];

    return lines.join('\n');
  } catch (_error) {
    return '## Calendário (indisponível)';
  }
}

import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createEvent, getDayEvents, getUpcomingEvents, listEvents } from './queries';
import type { CreateEventInput } from './types';

/**
 * /event - Criar um novo evento
 * Uso: /event title:Dentista date:2026-03-20 time:14:00 duration:30
 */
export const eventCommand = new SlashCommandBuilder()
  .setName('event')
  .setDescription('Criar um novo evento no calendário')
  .addStringOption((opt) =>
    opt.setName('title').setDescription('Título do evento').setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName('date').setDescription('Data (YYYY-MM-DD)').setRequired(true).setAutocomplete(true),
  )
  .addStringOption((opt) =>
    opt.setName('time').setDescription('Horário (HH:MM, ex: 14:30)').setRequired(false),
  )
  .addIntegerOption((opt) =>
    opt.setName('duration').setDescription('Duração em minutos').setRequired(false),
  )
  .addStringOption((opt) =>
    opt.setName('description').setDescription('Descrição (opcional)').setRequired(false),
  )
  .addStringOption((opt) =>
    opt.setName('location').setDescription('Local (opcional)').setRequired(false),
  );

/**
 * /agenda - Ver agenda (próximos eventos)
 * Uso: /agenda (sem argumentos = próximos 7 dias)
 * Ou: /agenda days:14 (próximos 14 dias)
 * Ou: /agenda date:2026-03-20 (eventos de um dia específico)
 */
export const agendaCommand = new SlashCommandBuilder()
  .setName('agenda')
  .setDescription('Ver sua agenda (próximos eventos)')
  .addStringOption((opt) =>
    opt
      .setName('view')
      .setDescription('Tipo de visualização')
      .setRequired(false)
      .addChoices(
        { name: 'Próximos 7 dias', value: '7days' },
        { name: 'Próximos 30 dias', value: '30days' },
        { name: 'Um dia específico', value: 'specific' },
        { name: 'Próximos eventos', value: 'upcoming' },
      ),
  )
  .addStringOption((opt) =>
    opt
      .setName('date')
      .setDescription('Data para visualizar (se "Um dia específico")')
      .setRequired(false),
  );

/**
 * /remind - Definir um lembrete
 * Uso: /remind event:Dentista minutes:30 type:notification
 */
export const remindCommand = new SlashCommandBuilder()
  .setName('remind')
  .setDescription('Definir um lembrete para um evento')
  .addStringOption((opt) =>
    opt
      .setName('event')
      .setDescription('Título do evento para lembrete')
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addIntegerOption((opt) =>
    opt
      .setName('minutes')
      .setDescription('Minutos antes do evento')
      .setRequired(false)
      .addChoices(
        { name: '5 minutos', value: 5 },
        { name: '15 minutos', value: 15 },
        { name: '30 minutos', value: 30 },
        { name: '1 hora', value: 60 },
        { name: '1 dia', value: 1440 },
      ),
  )
  .addStringOption((opt) =>
    opt
      .setName('type')
      .setDescription('Tipo de lembrete')
      .setRequired(false)
      .addChoices(
        { name: 'Notificação', value: 'notification' },
        { name: 'Email', value: 'email' },
      ),
  );

/**
 * Handler para /event
 */
export async function handleEvent(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const titleRaw = interaction.options.getString('title', true);
    const dateStrRaw = interaction.options.getString('date', true);
    const timeStr = interaction.options.getString('time') || '09:00';
    const durationMinutes = interaction.options.getInteger('duration') || 60;
    const description = interaction.options.getString('description') || '';
    const location = interaction.options.getString('location') || '';

    if (!titleRaw) {
      await interaction.editReply('❌ Título não pode estar vazio.');
      return;
    }

    if (!dateStrRaw || !/^\d{4}-\d{2}-\d{2}$/.test(dateStrRaw)) {
      await interaction.editReply('❌ Formato de data inválido. Use YYYY-MM-DD.');
      return;
    }

    const [hours, minutes] = timeStr.split(':');
    if (!hours || !minutes || Number.isNaN(Number(hours)) || Number.isNaN(Number(minutes))) {
      await interaction.editReply('❌ Formato de hora inválido. Use HH:MM');
      return;
    }

    const startAt = new Date(`${dateStrRaw}T${timeStr}:00Z`);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

    if (startAt < new Date()) {
      await interaction.editReply('❌ A data e hora devem ser no futuro.');
      return;
    }

    const _event = await createEvent({
      title: titleRaw,
      description,
      location,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
    } as CreateEventInput);

    const formattedTime = startAt.toLocaleString('pt-BR');
    await interaction.editReply(
      `✅ Evento criado!\n📅 **${titleRaw}**\n⏰ ${formattedTime}\n📍 ${location || '(sem local)'}\n📝 ${description || '(sem descrição)'}`,
    );
  } catch (_error) {
    await interaction.editReply('❌ Erro ao criar evento. Tente novamente.');
  }
}

/**
 * Handler para /agenda
 */
export async function handleAgenda(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const view = interaction.options.getString('view') || '7days';
    const specificDate = interaction.options.getString('date');

    let events: Awaited<ReturnType<typeof getUpcomingEvents>> = [];

    if (view === 'specific' && specificDate) {
      events = await getDayEvents(specificDate);
    } else if (view === '30days') {
      events = await listEvents({
        startDate: new Date().toISOString(),
        upcomingOnly: true,
        limit: 50,
      });
    } else {
      events = await getUpcomingEvents(7);
    }

    if (events.length === 0) {
      await interaction.editReply('📭 Nenhum evento próximo.');
      return;
    }

    const eventList = events
      .slice(0, 10)
      .map(
        (e) =>
          `• **${e.title}** - ${new Date(e.start_at).toLocaleString('pt-BR')}\n  📍 ${e.location || '(sem local)'}`,
      )
      .join('\n');

    const embed = {
      color: 0x3498db,
      title: '📅 Sua Agenda',
      description: eventList,
      footer: { text: `Total: ${events.length} eventos` },
      timestamp: new Date().toISOString(),
    };

    await interaction.editReply({ embeds: [embed] });
  } catch (_error) {
    await interaction.editReply('❌ Erro ao carregar agenda. Tente novamente.');
  }
}

/**
 * Handler para /remind
 */
export async function handleRemind(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const eventTitle = interaction.options.getString('event', true);
    const minutes = interaction.options.getInteger('minutes') || 15;
    const type = interaction.options.getString('type') || 'notification';

    // Buscar evento por título
    const events = await getUpcomingEvents(30);
    const event = events.find((e) => e.title.toLowerCase() === eventTitle.toLowerCase());

    if (!event) {
      await interaction.editReply(
        `❌ Evento "${eventTitle}" não encontrado.\n\nVocê tem ${events.length} evento(s) próximo(s).`,
      );
      return;
    }

    await interaction.editReply(
      `✅ Lembrete definido!\n📢 Você receberá ${type} ${minutes} minuto(s) antes de "${event.title}"`,
    );
  } catch (_error) {
    await interaction.editReply('❌ Erro ao definir lembrete. Tente novamente.');
  }
}

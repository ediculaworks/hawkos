import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
  createContactReminder,
  findPersonByName,
  getDormantContacts,
  getPersonWithInteractions,
  listOverdueContacts,
  listUpcomingBirthdays,
  logInteraction,
  updateHowWeMet,
} from './queries';
import type { InteractionType, Person, ReminderFrequencyType } from './types';

export const pessoaCommand = new SlashCommandBuilder()
  .setName('pessoa')
  .setDescription('Consultar perfil e histórico de um contato')
  .addStringOption((opt) =>
    opt.setName('nome').setDescription('Nome do contato').setRequired(true).setAutocomplete(true),
  );

export const interacaoCommand = new SlashCommandBuilder()
  .setName('interacao')
  .setDescription('Registrar interação com um contato')
  .addStringOption((opt) =>
    opt.setName('nome').setDescription('Nome do contato').setRequired(true).setAutocomplete(true),
  )
  .addStringOption((opt) =>
    opt
      .setName('tipo')
      .setDescription('Tipo de interação')
      .setRequired(true)
      .addChoices(
        { name: 'Ligação', value: 'call' },
        { name: 'Reunião', value: 'meeting' },
        { name: 'Mensagem', value: 'message' },
        { name: 'Visita', value: 'visit' },
        { name: 'Email', value: 'email' },
      ),
  )
  .addStringOption((opt) =>
    opt.setName('resumo').setDescription('Resumo da interação').setRequired(false),
  )
  .addStringOption((opt) =>
    opt
      .setName('sentimento')
      .setDescription('Como foi a interação?')
      .setRequired(false)
      .addChoices(
        { name: 'Positiva', value: 'positive' },
        { name: 'Neutra', value: 'neutral' },
        { name: 'Negativa', value: 'negative' },
      ),
  )
  .addIntegerOption((opt) =>
    opt.setName('duracao').setDescription('Duração em minutos').setRequired(false),
  );

export const aniversariosCommand = new SlashCommandBuilder()
  .setName('aniversarios')
  .setDescription('Próximos aniversários (30 dias)');

export const contatosCommand = new SlashCommandBuilder()
  .setName('contatos')
  .setDescription('Contatos que precisam de atenção (overdue)');

export const comoNosConhecemosCommand = new SlashCommandBuilder()
  .setName('como-nos-conhecemos')
  .setDescription('Registrar como você conheceu uma pessoa')
  .addStringOption((opt) =>
    opt.setName('nome').setDescription('Nome do contato').setRequired(true).setAutocomplete(true),
  )
  .addStringOption((opt) =>
    opt.setName('descricao').setDescription('Como vocês se conheceram').setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName('local').setDescription('Onde se conheceram').setRequired(false),
  )
  .addStringOption((opt) =>
    opt.setName('data').setDescription('Quando se conheceram (YYYY-MM-DD)').setRequired(false),
  );

export const lembrarCommand = new SlashCommandBuilder()
  .setName('lembrar')
  .setDescription('Criar lembrete de contato com frequência')
  .addStringOption((opt) =>
    opt.setName('nome').setDescription('Nome do contato').setRequired(true).setAutocomplete(true),
  )
  .addStringOption((opt) =>
    opt
      .setName('frequencia')
      .setDescription('Com que frequência entrar em contato')
      .setRequired(true)
      .addChoices(
        { name: 'Uma vez', value: 'once' },
        { name: 'Semanal', value: 'week' },
        { name: 'Mensal', value: 'month' },
        { name: 'Anual', value: 'year' },
      ),
  )
  .addIntegerOption((opt) =>
    opt.setName('intervalo').setDescription('A cada quantas semanas/meses/anos').setRequired(false),
  )
  .addStringOption((opt) =>
    opt.setName('descricao').setDescription('Nota sobre o lembrete').setRequired(false),
  );

export const dormentesCommand = new SlashCommandBuilder()
  .setName('dormentes')
  .setDescription('Contatos que você não fala há 30+ dias');

// ─── Handlers ────────────────────────────────────────────────────────────────

export async function handlePessoa(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const nome = interaction.options.getString('nome', true);
  const person = await findPersonByName(nome);

  if (!person) {
    await interaction.editReply(`❌ Contato **"${nome}"** não encontrado.`);
    return;
  }

  const full = await getPersonWithInteractions(person.id);

  const relationLabel: Record<string, string> = {
    family: 'Família',
    friend: 'Amigo',
    colleague: 'Colega',
    romantic: 'Romântico',
    professional: 'Profissional',
    medical: 'Médico',
  };

  const parts: string[] = [`👤 **${full.name}**${full.role ? ` · ${full.role}` : ''}`];

  if (full.relationship)
    parts.push(`Relação: ${relationLabel[full.relationship] ?? full.relationship}`);
  if (full.city) parts.push(`📍 ${full.city}`);
  if (full.phone) parts.push(`📱 ${full.phone}`);
  if (full.birthday) {
    const bday = new Date(full.birthday).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    parts.push(`🎂 ${bday}`);
  }

  if (full.days_since_contact !== null) {
    const overdueMark = full.overdue_contact ? ' ⚠️ CONTATO NECESSÁRIO' : '';
    parts.push(`\nÚltimo contato: ${full.days_since_contact} dias atrás${overdueMark}`);
  } else {
    parts.push('\nNenhuma interação registrada ainda.');
  }

  if (full.notes) parts.push(`\n📝 ${full.notes}`);

  if (full.interactions.length > 0) {
    const lastInteractions = full.interactions.slice(0, 3).map((i) => {
      const date = new Date(i.date).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      });
      const summary = i.summary ? `: ${i.summary.slice(0, 60)}` : '';
      return `• ${date} ${i.type}${summary}`;
    });
    parts.push(`\n**Interações recentes:**\n${lastInteractions.join('\n')}`);
  }

  await interaction.editReply(parts.join('\n'));
}

export async function handleInteracao(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const nome = interaction.options.getString('nome', true);
  const tipo = interaction.options.getString('tipo', true) as InteractionType;
  const resumo = interaction.options.getString('resumo') ?? undefined;
  const sentimento = (interaction.options.getString('sentimento') ?? undefined) as Parameters<
    typeof logInteraction
  >[0]['sentiment'];
  const duracao = interaction.options.getInteger('duracao') ?? undefined;

  const person = await findPersonByName(nome);
  if (!person) {
    await interaction.editReply(`❌ Contato **"${nome}"** não encontrado.`);
    return;
  }

  await logInteraction({
    person_id: person.id,
    type: tipo,
    summary: resumo,
    sentiment: sentimento,
    duration_minutes: duracao,
  });

  const typeLabel: Record<InteractionType, string> = {
    call: 'Ligação',
    meeting: 'Reunião',
    message: 'Mensagem',
    visit: 'Visita',
    email: 'Email',
  };

  const sentLabel: Record<string, string> = {
    positive: '😊',
    neutral: '😐',
    negative: '😟',
  };

  const sentStr = sentimento ? ` ${sentLabel[sentimento] ?? ''}` : '';
  const duraStr = duracao ? ` · ${duracao}min` : '';
  const resumoStr = resumo ? `\n> ${resumo}` : '';

  await interaction.editReply(
    `✅ **${typeLabel[tipo]}** com ${person.name}${sentStr}${duraStr} registrada!${resumoStr}`,
  );
}

export async function handleAniversarios(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const birthdays = await listUpcomingBirthdays(30);

  if (birthdays.length === 0) {
    await interaction.editReply('🎂 Nenhum aniversário nos próximos 30 dias.');
    return;
  }

  const lines = birthdays.map((p) => {
    const date = new Date(p.birthday as string);
    const formatted = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
    const daysStr =
      p.days_until === 0
        ? ' 🎉 HOJE!'
        : p.days_until === 1
          ? ' (amanhã)'
          : ` (em ${p.days_until} dias)`;
    return `🎂 **${p.name}** · ${formatted}${daysStr}`;
  });

  await interaction.editReply(`**Próximos aniversários:**\n\n${lines.join('\n')}`);
}

export async function handleContatos(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const overdue = await listOverdueContacts();

  if (overdue.length === 0) {
    await interaction.editReply('✅ Nenhum contato pendente. Você está em dia!');
    return;
  }

  const lines = overdue.map((p) => {
    const reminder = new Date(p.next_contact_reminder as string);
    const daysLate = Math.floor((Date.now() - reminder.getTime()) / (1000 * 60 * 60 * 24));
    const lateStr = daysLate > 0 ? ` · ${daysLate}d de atraso` : '';
    return `⚠️ **${p.name}** (${p.contact_frequency ?? 'sem freq'})${lateStr}`;
  });

  await interaction.editReply(
    `📋 **Contatos que precisam de atenção (${overdue.length}):**\n\n${lines.join('\n')}`,
  );
}

export async function handleComoNosConhecemos(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const nome = interaction.options.getString('nome', true);
  const descricao = interaction.options.getString('descricao', true);
  const local = interaction.options.getString('local') ?? undefined;
  const data = interaction.options.getString('data') ?? undefined;

  const person = await findPersonByName(nome);
  if (!person) {
    await interaction.editReply(`❌ Contato **"${nome}"** não encontrado.`);
    return;
  }

  await updateHowWeMet({
    person_id: person.id,
    how_we_met: descricao,
    first_met_at: data ?? undefined,
    first_met_location: local ?? undefined,
  });

  const parts = [`✅ Registrado como nos conhecemos com **${person.name}**: ${descricao}`];
  if (local) parts.push(`📍 Local: ${local}`);
  if (data) parts.push(`📅 Data: ${data}`);

  await interaction.editReply(parts.join('\n'));
}

export async function handleLembrar(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const nome = interaction.options.getString('nome', true);
  const frequencia = interaction.options.getString('frequencia', true) as ReminderFrequencyType;
  const intervalo = interaction.options.getInteger('intervalo') ?? 1;
  const descricao = interaction.options.getString('descricao') ?? undefined;

  const person = await findPersonByName(nome);
  if (!person) {
    await interaction.editReply(`❌ Contato **"${nome}"** não encontrado.`);
    return;
  }

  await createContactReminder({
    person_id: person.id,
    frequency_type: frequencia,
    frequency_value: intervalo,
    initial_date: new Date().toISOString().split('T')[0] ?? '',
    description: descricao,
  });

  const freqLabel: Record<ReminderFrequencyType, string> = {
    once: 'uma vez',
    week: `a cada ${intervalo} semana${intervalo > 1 ? 's' : ''}`,
    month: `a cada ${intervalo} mês${intervalo > 1 ? 'es' : ''}`,
    year: `a cada ${intervalo} ano${intervalo > 1 ? 's' : ''}`,
  };

  await interaction.editReply(
    `✅ Lembrete criado: contatar **${person.name}** ${freqLabel[frequencia]}.`,
  );
}

export async function handleDormentes(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const dormant = await getDormantContacts(30);

  if (dormant.length === 0) {
    await interaction.editReply('✅ Nenhum contato dormente. Você está mantendo sua rede ativa!');
    return;
  }

  const lines = dormant.map((p: Person) => {
    const days = p.last_interaction
      ? Math.floor((Date.now() - new Date(p.last_interaction).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const daysStr = days !== null ? ` · ${days}d sem contato` : ' · sem registro';
    return `😴 **${p.name}**${daysStr}`;
  });

  await interaction.editReply(
    `😴 **Contatos dormentes (${dormant.length}):**\n\n${lines.join('\n')}`,
  );
}

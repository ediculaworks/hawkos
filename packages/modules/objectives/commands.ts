import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
  createObjective,
  createTask,
  findObjectiveByTitle,
  findTaskByTitle,
  listActiveTasks,
  listObjectivesByTimeframe,
  listOverdueTasks,
  updateObjective,
  updateTask,
} from './queries';
import type { ObjectiveTimeframe, TaskPriority } from './types';

/**
 * /meta - Gerenciar objetivos
 *
 * /meta list              → listar objetivos por timeframe
 * /meta novo <título>     → criar objetivo
 * /meta progresso <n>     → atualizar progresso de um objetivo
 */
export const metaCommand = new SlashCommandBuilder()
  .setName('meta')
  .setDescription('Gerenciar objetivos de vida')
  .addSubcommand((sub) => sub.setName('list').setDescription('Listar objetivos ativos por prazo'))
  .addSubcommand((sub) =>
    sub
      .setName('novo')
      .setDescription('Criar novo objetivo')
      .addStringOption((opt) =>
        opt.setName('titulo').setDescription('Título do objetivo').setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('prazo')
          .setDescription('Prazo do objetivo')
          .setRequired(true)
          .addChoices(
            { name: 'Curto (até 1 ano)', value: 'short' },
            { name: 'Médio (1-3 anos)', value: 'medium' },
            { name: 'Longo (3+ anos)', value: 'long' },
          ),
      )
      .addStringOption((opt) =>
        opt.setName('descricao').setDescription('Descrição opcional').setRequired(false),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('prioridade')
          .setDescription('Prioridade (1-10, padrão 5)')
          .setMinValue(1)
          .setMaxValue(10)
          .setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('progresso')
      .setDescription('Atualizar progresso de um objetivo')
      .addStringOption((opt) =>
        opt
          .setName('titulo')
          .setDescription('Título do objetivo (parcial aceito)')
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('valor')
          .setDescription('Progresso (0-100%)')
          .setMinValue(0)
          .setMaxValue(100)
          .setRequired(true),
      ),
  );

/**
 * /tarefa - Gerenciar tarefas
 *
 * /tarefa <título>        → criar tarefa (inbox rápida)
 * /tarefa list            → listar tarefas ativas
 * /tarefa done <título>   → marcar como concluída
 * /tarefa bloquear        → marcar como bloqueada
 */
export const tarefaCommand = new SlashCommandBuilder()
  .setName('tarefa')
  .setDescription('Gerenciar tarefas')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Criar nova tarefa')
      .addStringOption((opt) =>
        opt.setName('titulo').setDescription('Título da tarefa').setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('prioridade')
          .setDescription('Prioridade (padrão: medium)')
          .setRequired(false)
          .addChoices(
            { name: 'Baixa', value: 'low' },
            { name: 'Média', value: 'medium' },
            { name: 'Alta', value: 'high' },
            { name: 'Urgente', value: 'urgent' },
          ),
      )
      .addStringOption((opt) =>
        opt.setName('data').setDescription('Data limite (YYYY-MM-DD)').setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('Listar tarefas pendentes'))
  .addSubcommand((sub) =>
    sub
      .setName('done')
      .setDescription('Marcar tarefa como concluída')
      .addStringOption((opt) =>
        opt
          .setName('titulo')
          .setDescription('Título da tarefa (parcial aceito)')
          .setRequired(true)
          .setAutocomplete(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('bloquear')
      .setDescription('Marcar tarefa como bloqueada')
      .addStringOption((opt) =>
        opt
          .setName('titulo')
          .setDescription('Título da tarefa')
          .setRequired(true)
          .setAutocomplete(true),
      ),
  );

// ─── Handlers /meta ──────────────────────────────────────────────────────────

export async function handleMeta(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'list') return handleMetaList(interaction);
  if (sub === 'novo') return handleMetaNovo(interaction);
  if (sub === 'progresso') return handleMetaProgresso(interaction);
}

async function handleMetaList(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const byTimeframe = await listObjectivesByTimeframe();

  const labels: Record<ObjectiveTimeframe, string> = {
    short: '📅 Curto prazo (até 1 ano)',
    medium: '📆 Médio prazo (1-3 anos)',
    long: '🌟 Longo prazo (3+ anos)',
  };

  const sections: string[] = [];

  for (const tf of ['short', 'medium', 'long'] as ObjectiveTimeframe[]) {
    const objs = byTimeframe[tf];
    if (objs.length === 0) continue;

    const lines = objs.map((o) => {
      const bar = buildProgressBar(o.progress);
      const priority = o.priority >= 9 ? ' 🔴' : o.priority >= 7 ? ' 🟡' : '';
      return `**${o.title}**${priority}\n${bar} ${o.progress}%`;
    });

    sections.push(`${labels[tf]}\n${lines.join('\n')}`);
  }

  if (sections.length === 0) {
    await interaction.editReply('Nenhum objetivo ativo. Use `/meta novo` para criar.');
    return;
  }

  await interaction.editReply(`🎯 **Objetivos ativos:**\n\n${sections.join('\n\n')}`);
}

async function handleMetaNovo(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const titulo = interaction.options.getString('titulo', true);
  const prazo = interaction.options.getString('prazo', true) as ObjectiveTimeframe;
  const descricao = interaction.options.getString('descricao') ?? undefined;
  const prioridade = interaction.options.getInteger('prioridade') ?? 5;

  const obj = await createObjective({
    title: titulo,
    description: descricao,
    timeframe: prazo,
    priority: prioridade,
  });

  const prazoLabel: Record<ObjectiveTimeframe, string> = {
    short: 'curto prazo',
    medium: 'médio prazo',
    long: 'longo prazo',
  };

  await interaction.editReply(
    `✅ Objetivo criado!\n🎯 **${obj.title}** · ${prazoLabel[prazo]} · Prioridade ${prioridade}/10`,
  );
}

async function handleMetaProgresso(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const titulo = interaction.options.getString('titulo', true);
  const valor = interaction.options.getInteger('valor', true);

  const obj = await findObjectiveByTitle(titulo);
  if (!obj) {
    await interaction.editReply(`❌ Objetivo **"${titulo}"** não encontrado.`);
    return;
  }

  const updated = await updateObjective(obj.id, { progress: valor });

  const bar = buildProgressBar(valor);
  const completed = valor === 100 ? '\n🎉 Objetivo concluído!' : '';

  await interaction.editReply(`✅ **${updated.title}**\n${bar} ${valor}%${completed}`);
}

// ─── Handlers /tarefa ─────────────────────────────────────────────────────────

export async function handleTarefa(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') return handleTarefaAdd(interaction);
  if (sub === 'list') return handleTarefaList(interaction);
  if (sub === 'done') return handleTarefaDone(interaction);
  if (sub === 'bloquear') return handleTarefaBloquear(interaction);
}

async function handleTarefaAdd(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const titulo = interaction.options.getString('titulo', true);
  const prioridade = (interaction.options.getString('prioridade') ?? 'medium') as TaskPriority;
  const data = interaction.options.getString('data') ?? undefined;

  const task = await createTask({ title: titulo, priority: prioridade, due_date: data });

  const priorityEmoji: Record<TaskPriority, string> = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    urgent: '🔴',
  };

  const dateStr = data ? ` · Prazo: ${data}` : '';
  await interaction.editReply(
    `✅ Tarefa criada!\n${priorityEmoji[prioridade]} **${task.title}**${dateStr}`,
  );
}

async function handleTarefaList(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const [active, overdue] = await Promise.all([listActiveTasks(15), listOverdueTasks()]);

  if (active.length === 0) {
    await interaction.editReply('📋 Nenhuma tarefa pendente. Use `/tarefa add` para criar.');
    return;
  }

  const overdueIds = new Set(overdue.map((t) => t.id));
  const priorityEmoji: Record<string, string> = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    urgent: '🔴',
  };
  const statusEmoji: Record<string, string> = {
    todo: '⬜',
    in_progress: '🔄',
    blocked: '🚫',
  };

  const lines = active.map((t) => {
    const overdueMark = overdueIds.has(t.id) ? ' ⚠️' : '';
    const prio = priorityEmoji[t.priority] ?? '🟡';
    const status = statusEmoji[t.status] ?? '⬜';
    return `${status}${prio} **${t.title}**${overdueMark}`;
  });

  await interaction.editReply(`📋 **Tarefas (${active.length}):**\n\n${lines.join('\n')}`);
}

async function handleTarefaDone(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const titulo = interaction.options.getString('titulo', true);
  const task = await findTaskByTitle(titulo);

  if (!task) {
    await interaction.editReply(`❌ Tarefa **"${titulo}"** não encontrada.`);
    return;
  }

  await updateTask(task.id, { status: 'done' });
  await interaction.editReply(`✅ **${task.title}** concluída!`);
}

async function handleTarefaBloquear(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const titulo = interaction.options.getString('titulo', true);
  const task = await findTaskByTitle(titulo);

  if (!task) {
    await interaction.editReply(`❌ Tarefa **"${titulo}"** não encontrada.`);
    return;
  }

  await updateTask(task.id, { status: 'blocked' });
  await interaction.editReply(`🚫 **${task.title}** marcada como bloqueada.`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildProgressBar(progress: number): string {
  const filled = Math.round(progress / 10);
  const empty = 10 - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

import { searchDocuments } from '@hawk/module-assets/queries';
import { createEvent, findFreeSlots } from '@hawk/module-calendar/queries';
import { findWorkspaceByName, logWork } from '@hawk/module-career/queries';
import { createMedia } from '@hawk/module-entertainment/queries';
import {
  createTransaction,
  getAccounts,
  getBudgetVsActual,
  getCategories,
  getFinanceSummary,
  getPortfolioPositions,
} from '@hawk/module-finances/queries';
import {
  addWorkoutSet,
  estimate1RM,
  getExerciseProgress,
  logSleep,
  logWeight,
  logWorkout,
} from '@hawk/module-health/queries';
import { upsertJournalEntry } from '@hawk/module-journal/queries';
import { createNote, searchKnowledge } from '@hawk/module-knowledge/queries';
import { getNextQuestion, markQuestionAnswered, markQuestionAsked } from '@hawk/module-memory';
import { createObjective, createTask } from '@hawk/module-objectives/queries';
import { createPerson, findPersonByName, logInteraction } from '@hawk/module-people/queries';
import {
  createHabit,
  findHabitByName,
  getHabitsAtRisk,
  logHabit,
} from '@hawk/module-routine/queries';
import { createReflection } from '@hawk/module-spirituality/queries';
import type OpenAI from 'openai';

import type { Relationship } from '@hawk/module-people/types';
import type { ModuleId } from '@hawk/shared';

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  modules: ModuleId[];
  // biome-ignore lint/suspicious/noExplicitAny: tool handlers have specific typed args
  handler: (args: any) => Promise<string>;
};

export const TOOLS: Record<string, ToolDefinition> = {
  // ==== FINANCES ====
  create_transaction: {
    name: 'create_transaction',
    modules: ['finances'],
    description: 'Registra uma transação financeira (gasto ou receita)',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Valor da transação' },
        type: {
          type: 'string',
          enum: ['expense', 'income'],
          description: 'Tipo: despesa ou receita',
        },
        category: { type: 'string', description: 'Nome da categoria (ex: Alimentação, Salário)' },
        description: { type: 'string', description: 'Descrição opcional' },
        account: { type: 'string', description: 'Nome da conta (opcional)' },
      },
      required: ['amount', 'type', 'category'],
    },
    handler: async (args: {
      amount: number;
      type: 'expense' | 'income';
      category: string;
      description?: string;
      account?: string;
    }) => {
      const accounts = await getAccounts();
      const account = args.account
        ? accounts.find((a) => a.name.toLowerCase().includes(args.account?.toLowerCase() ?? ''))
        : accounts[0];

      if (!account) return 'Erro: Nenhuma conta encontrada.';

      const categories = await getCategories();
      const category = categories.find(
        (c) => c.name.toLowerCase().includes(args.category.toLowerCase()) && c.type === args.type,
      );

      if (!category) return `Erro: Categoria "${args.category}" não encontrada para ${args.type}.`;

      await createTransaction({
        account_id: account.id,
        category_id: category.id,
        amount: args.amount,
        type: args.type,
        description: args.description,
      });

      return `Transação registrada: ${args.type === 'expense' ? 'Gasto' : 'Receita'} de R$ ${args.amount} em ${category.name}.`;
    },
  },

  get_financial_summary: {
    name: 'get_financial_summary',
    modules: ['finances'],
    description: 'Obtém resumo financeiro do mês atual',
    parameters: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const summary = await getFinanceSummary();
      return `Receitas: R$ ${summary.income.toFixed(2)}\nDespesas: R$ ${summary.expenses.toFixed(2)}\nSaldo: R$ ${summary.net.toFixed(2)}`;
    },
  },

  // ==== ROUTINE ====
  log_habit: {
    name: 'log_habit',
    modules: ['routine'],
    description: 'Registra a conclusão de um hábito',
    parameters: {
      type: 'object',
      properties: {
        habit_name: { type: 'string', description: 'Nome do hábito' },
        completed: { type: 'boolean', description: 'Se foi completado (default true)' },
      },
      required: ['habit_name'],
    },
    handler: async (args: { habit_name: string; completed?: boolean }) => {
      const habit = await findHabitByName(args.habit_name);
      if (!habit) return `Erro: Hábito "${args.habit_name}" não encontrado.`;

      await logHabit({
        habit_id: habit.id,
        completed: args.completed ?? true,
      });

      return `${habit.name}: ${args.completed === false ? 'não completado' : 'marcado como feito'}!`;
    },
  },

  create_habit: {
    name: 'create_habit',
    modules: ['routine'],
    description: 'Cria um novo hábito',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome do hábito' },
        frequency: {
          type: 'string',
          enum: ['daily', 'weekly_2x', 'weekly_3x', 'weekdays'],
          description: 'Frequência',
        },
      },
      required: ['name', 'frequency'],
    },
    handler: async (args: {
      name: string;
      frequency: 'daily' | 'weekly_2x' | 'weekly_3x' | 'weekdays';
    }) => {
      const habit = await createHabit({
        name: args.name,
        frequency: args.frequency,
      });
      return `Hábito criado: ${habit.name} (${habit.frequency})`;
    },
  },

  // ==== OBJECTIVES ====
  create_objective: {
    name: 'create_objective',
    modules: ['objectives'],
    description: 'Cria um novo objetivo',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título do objetivo' },
        description: { type: 'string', description: 'Descrição opcional' },
        timeframe: {
          type: 'string',
          enum: ['short', 'medium', 'long'],
          description: 'Prazo: curto/médio/longo',
        },
        target_date: { type: 'string', description: 'Data alvo (YYYY-MM-DD)' },
      },
      required: ['title', 'timeframe'],
    },
    handler: async (args: {
      title: string;
      description?: string;
      timeframe: 'short' | 'medium' | 'long';
      target_date?: string;
    }) => {
      const objective = await createObjective({
        title: args.title,
        description: args.description,
        timeframe: args.timeframe,
        target_date: args.target_date,
      });
      return `Objetivo criado: ${objective.title} (${objective.timeframe})`;
    },
  },

  create_task: {
    name: 'create_task',
    modules: ['objectives'],
    description: 'Cria uma nova tarefa',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título da tarefa' },
        objective_title: {
          type: 'string',
          description: 'Título do objetivo relacionado (opcional)',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Prioridade',
        },
        due_date: { type: 'string', description: 'Data de vencimento (YYYY-MM-DD)' },
      },
      required: ['title'],
    },
    handler: async (args: {
      title: string;
      objective_title?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      due_date?: string;
    }) => {
      let objective_id: string | undefined;

      if (args.objective_title) {
        // We need to find objective by title - simplified for now
        objective_id = undefined;
      }

      const task = await createTask({
        title: args.title,
        objective_id,
        priority: args.priority,
        due_date: args.due_date,
      });

      return `Tarefa criada: ${task.title}`;
    },
  },

  // ==== PEOPLE ====
  create_person: {
    name: 'create_person',
    modules: ['people'],
    description: 'Adiciona uma nova pessoa ao CRM',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome da pessoa' },
        relationship: {
          type: 'string',
          enum: ['family', 'friend', 'colleague', 'romantic', 'professional', 'medical'],
          description: 'Tipo de relacionamento',
        },
        phone: { type: 'string', description: 'Telefone opcional' },
        birthday: { type: 'string', description: 'Aniversário (YYYY-MM-DD)' },
        notes: { type: 'string', description: 'Notas sobre a pessoa' },
      },
      required: ['name'],
    },
    handler: async (args: {
      name: string;
      relationship?: string;
      phone?: string;
      birthday?: string;
      notes?: string;
    }) => {
      const person = await createPerson({
        name: args.name,
        relationship: args.relationship as Relationship | undefined,
        phone: args.phone,
        birthday: args.birthday,
        notes: args.notes,
      });
      return `Pessoa adicionada: ${person.name}`;
    },
  },

  log_interaction: {
    name: 'log_interaction',
    modules: ['people'],
    description: 'Registra uma interação com uma pessoa',
    parameters: {
      type: 'object',
      properties: {
        person_name: { type: 'string', description: 'Nome da pessoa' },
        type: {
          type: 'string',
          enum: ['call', 'meeting', 'message', 'visit', 'email'],
          description: 'Tipo de interação',
        },
        summary: { type: 'string', description: 'Resumo do que aconteceu' },
        sentiment: {
          type: 'string',
          enum: ['positive', 'neutral', 'negative'],
          description: 'Sentimento',
        },
      },
      required: ['person_name', 'type'],
    },
    handler: async (args: {
      person_name: string;
      type: 'call' | 'meeting' | 'message' | 'visit' | 'email';
      summary?: string;
      sentiment?: 'positive' | 'neutral' | 'negative';
    }) => {
      const person = await findPersonByName(args.person_name);
      if (!person) return `Erro: Pessoa "${args.person_name}" não encontrada.`;

      await logInteraction({
        person_id: person.id,
        type: args.type,
        summary: args.summary,
        sentiment: args.sentiment,
      });

      return `Interação registrada com ${person.name}: ${args.type}`;
    },
  },

  // ==== CAREER ====
  log_work: {
    name: 'log_work',
    modules: ['career'],
    description: 'Registra horas trabalhadas',
    parameters: {
      type: 'object',
      properties: {
        workspace_name: { type: 'string', description: 'Nome do workspace (empresa/trabalho)' },
        duration_minutes: { type: 'number', description: 'Duração em minutos' },
        description: { type: 'string', description: 'Descrição do trabalho' },
        date: { type: 'string', description: 'Data (YYYY-MM-DD, opcional)' },
      },
      required: ['workspace_name', 'duration_minutes'],
    },
    handler: async (args: {
      workspace_name: string;
      duration_minutes: number;
      description?: string;
      date?: string;
    }) => {
      const workspace = await findWorkspaceByName(args.workspace_name);
      if (!workspace) return `Erro: Workspace "${args.workspace_name}" não encontrado.`;

      await logWork({
        workspace_name: workspace.name,
        duration_minutes: args.duration_minutes,
        description: args.description,
        date: args.date,
      });

      const hours = args.duration_minutes / 60;
      return `Registrado ${hours.toFixed(1)}h de trabalho em ${workspace.name}`;
    },
  },

  // ==== JOURNAL ====
  write_journal: {
    name: 'write_journal',
    modules: ['journal'],
    description: 'Escreve uma entrada no diário',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Conteúdo do diário' },
        mood: { type: 'number', description: 'Humor de 1-10' },
        energy: { type: 'number', description: 'Energia de 1-10' },
      },
      required: ['content'],
    },
    handler: async (args: { content: string; mood?: number; energy?: number }) => {
      await upsertJournalEntry({
        content: args.content,
        mood: args.mood,
        energy: args.energy,
      });
      return `Entrada registrada no diário${args.mood ? ` (humor: ${args.mood}/10)` : ''}`;
    },
  },

  // ==== SPIRITUALITY ====
  create_reflection: {
    name: 'create_reflection',
    modules: ['spirituality'],
    description: 'Cria uma reflexão espiritual',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Conteúdo da reflexão' },
        type: {
          type: 'string',
          enum: ['reflection', 'gratitude', 'intention', 'values', 'mantra'],
          description: 'Tipo de reflexão',
        },
        mood: { type: 'number', description: 'Humor de 1-5' },
      },
      required: ['content'],
    },
    handler: async (args: { content: string; type?: string; mood?: number }) => {
      const reflection = await createReflection({
        content: args.content,
        type: (args.type ?? 'reflection') as
          | 'reflection'
          | 'gratitude'
          | 'intention'
          | 'values'
          | 'mantra',
        mood: args.mood,
      });
      return `Reflexão criada: ${reflection.type}`;
    },
  },

  // ==== CALENDAR ====
  create_event: {
    name: 'create_event',
    modules: ['calendar'],
    description: 'Cria um evento no calendário',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título do evento' },
        start_at: { type: 'string', description: 'Data/hora de início (YYYY-MM-DD ou ISO)' },
        end_at: { type: 'string', description: 'Data/hora de fim (opcional)' },
        description: { type: 'string', description: 'Descrição opcional' },
        location: { type: 'string', description: 'Local opcional' },
      },
      required: ['title', 'start_at'],
    },
    handler: async (args: {
      title: string;
      start_at: string;
      end_at?: string;
      description?: string;
      location?: string;
    }) => {
      const startDate = new Date(args.start_at);
      const endDate = args.end_at
        ? new Date(args.end_at)
        : new Date(startDate.getTime() + 60 * 60 * 1000);

      const event = await createEvent({
        title: args.title,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        description: args.description,
        location: args.location,
      });

      return `Evento criado: ${event.title}`;
    },
  },

  // ==== HEALTH ====
  log_sleep: {
    name: 'log_sleep',
    modules: ['health'],
    description: 'Registra horas de sono',
    parameters: {
      type: 'object',
      properties: {
        duration_h: { type: 'number', description: 'Duração em horas' },
        quality: { type: 'number', description: 'Qualidade de 1-10 (opcional)' },
        date: { type: 'string', description: 'Data (YYYY-MM-DD, opcional)' },
      },
      required: ['duration_h'],
    },
    handler: async (args: { duration_h: number; quality?: number; date?: string }) => {
      const sleep = await logSleep({
        duration_h: args.duration_h,
        quality: args.quality,
        date: args.date,
      });
      return `Sono registrado: ${sleep.duration_h}h`;
    },
  },

  log_workout: {
    name: 'log_workout',
    modules: ['health'],
    description: 'Registra um treino',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Tipo: musculacao, corrida, caminhada, etc' },
        duration_minutes: { type: 'number', description: 'Duração em minutos' },
        notes: { type: 'string', description: 'Notas sobre o treino' },
        date: { type: 'string', description: 'Data (YYYY-MM-DD, opcional)' },
      },
      required: ['type'],
    },
    handler: async (args: {
      type: string;
      duration_minutes?: number;
      notes?: string;
      date?: string;
    }) => {
      const workout = await logWorkout({
        type: args.type as
          | 'musculacao'
          | 'corrida'
          | 'ciclismo'
          | 'natacao'
          | 'caminhada'
          | 'skate'
          | 'futebol'
          | 'outro',
        duration_m: args.duration_minutes,
        notes: args.notes,
        date: args.date,
      });
      return `Treino registrado: ${workout.type}`;
    },
  },

  log_weight: {
    name: 'log_weight',
    modules: ['health'],
    description: 'Registra peso corporal',
    parameters: {
      type: 'object',
      properties: {
        weight_kg: { type: 'number', description: 'Peso em kg' },
        date: { type: 'string', description: 'Data (YYYY-MM-DD, opcional)' },
      },
      required: ['weight_kg'],
    },
    handler: async (args: { weight_kg: number; date?: string }) => {
      const weight = await logWeight({
        weight_kg: args.weight_kg,
        measured_at: args.date,
      });
      return `Peso registrado: ${weight.weight_kg}kg`;
    },
  },

  // ==== KNOWLEDGE ====
  create_note: {
    name: 'create_note',
    modules: ['knowledge'],
    description: 'Cria uma nota/insight',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Conteúdo da nota' },
        title: { type: 'string', description: 'Título opcional' },
        type: {
          type: 'string',
          enum: ['note', 'insight', 'reference', 'book_note', 'quote'],
          description: 'Tipo de nota',
        },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags' },
      },
      required: ['content'],
    },
    handler: async (args: { content: string; title?: string; type?: string; tags?: string[] }) => {
      const note = await createNote({
        content: args.content,
        title: args.title,
        type: (args.type ?? 'note') as 'note' | 'insight' | 'reference' | 'book_note' | 'quote',
        tags: args.tags,
      });
      return `Nota criada: ${note.title || note.content.slice(0, 30)}...`;
    },
  },

  // ==== ENTERTAINMENT ====
  add_media: {
    name: 'add_media',
    modules: ['entertainment'],
    description: 'Adiciona um filme/livro/série à lista',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título' },
        type: {
          type: 'string',
          enum: ['movie', 'series', 'book_fiction', 'game', 'podcast', 'music_album'],
          description: 'Tipo de mídia',
        },
        status: {
          type: 'string',
          enum: ['want', 'watching', 'completed', 'abandoned'],
          description: 'Status',
        },
        platform: { type: 'string', description: 'Plataforma (Netflix, Spotify, etc)' },
      },
      required: ['title', 'type'],
    },
    handler: async (args: { title: string; type: string; status?: string; platform?: string }) => {
      const media = await createMedia({
        title: args.title,
        type: args.type as 'movie' | 'series' | 'book_fiction' | 'game' | 'podcast' | 'music_album',
        status: (args.status ?? 'want') as 'want' | 'watching' | 'completed' | 'abandoned',
        platform: args.platform,
      });
      return `Mídia adicionada: ${media.title} (${media.status})`;
    },
  },
  // ==== UNIVERSAL (always included) ====
  save_memory: {
    name: 'save_memory',
    modules: [], // empty = universal, always included
    description: 'Salva uma memória de longo prazo sobre o usuário',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Conteúdo da memória' },
        memory_type: {
          type: 'string',
          enum: ['profile', 'preference', 'entity', 'event', 'case', 'pattern'],
          description:
            'Tipo: profile (identidade), preference, entity (pessoas/projetos), event (marco), case (correção), pattern (processo)',
        },
        module: { type: 'string', description: 'Módulo relacionado (optional)' },
        importance: { type: 'number', description: 'Importância 1-10 (default 5)' },
      },
      required: ['content', 'memory_type'],
    },
    handler: async () => '', // handled directly in handler.ts
  },

  ask_deepening_question: {
    name: 'ask_deepening_question',
    modules: [], // universal
    description:
      'Busca a próxima pergunta de aprofundamento para conhecer melhor o usuário. Pode filtrar por tópico.',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description:
            'Tópico para focar a pergunta (health, finances, relationships, career, lifestyle, psychology)',
        },
      },
    },
    handler: async (args: { topic?: string }) => {
      const question = await getNextQuestion(args.topic);
      if (!question) return 'Todas as perguntas de aprofundamento foram respondidas!';
      await markQuestionAsked(question.id);
      return JSON.stringify({
        question: question.question,
        reason: question.reason,
        block: question.block,
        question_id: question.id,
      });
    },
  },

  mark_question_answered: {
    name: 'mark_question_answered',
    modules: [], // universal
    description: 'Marca uma pergunta de aprofundamento como respondida com resumo da resposta',
    parameters: {
      type: 'object',
      properties: {
        question_id: { type: 'string', description: 'ID da pergunta respondida' },
        answer_summary: { type: 'string', description: 'Resumo da resposta do usuário' },
      },
      required: ['question_id', 'answer_summary'],
    },
    handler: async (args: { question_id: string; answer_summary: string }) => {
      await markQuestionAnswered(args.question_id, args.answer_summary);
      return 'Pergunta marcada como respondida.';
    },
  },

  // ==== AGENT COMMUNICATION ====
  call_agent: {
    name: 'call_agent',
    modules: [],
    description:
      'Consulta outro agente especialista. Retorna a resposta real do agente consultado.',
    parameters: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'UUID do agente destino' },
        query: { type: 'string', description: 'Pergunta ou tarefa para o agente' },
        session_context: { type: 'string', description: 'Contexto adicional da sessão atual' },
      },
      required: ['agent_id', 'query'],
    },
    handler: async (args: { agent_id: string; query: string; session_context?: string }) => {
      try {
        const { runSubAgent } = await import('./sub-agent.js');
        const result = await runSubAgent({
          agentId: args.agent_id,
          query: args.query,
          context: args.session_context,
        });
        return result || 'Agente não retornou resposta.';
      } catch (err) {
        return `Erro ao consultar agente: ${err}`;
      }
    },
  },

  handoff_to_agent: {
    name: 'handoff_to_agent',
    modules: [],
    description:
      'Transfere a conversa para outro agente. A próxima mensagem do usuário será respondida pelo agente destino.',
    parameters: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'UUID do agente destino' },
        reason: { type: 'string', description: 'Motivo da transferência' },
        summary: { type: 'string', description: 'Resumo do contexto atual' },
      },
      required: ['agent_id', 'reason'],
    },
    handler: async (args: { agent_id: string; reason: string; summary?: string }) => {
      try {
        const { db } = await import('@hawk/db');

        // Record the handoff message
        // biome-ignore lint/suspicious/noExplicitAny: agent_messages table added via migration
        await (db as any).from('agent_messages').insert({
          from_agent_id: '00000000-0000-0000-0000-000000000001',
          to_agent_id: args.agent_id,
          message_type: 'handoff',
          content: args.reason,
          status: 'delivered',
          context: {
            summary: args.summary,
            source: 'handoff_to_agent',
            handed_off_at: new Date().toISOString(),
          },
        });

        // Get the agent name for user feedback
        const { data: agent } = await db
          .from('agent_templates')
          .select('name')
          .eq('id', args.agent_id)
          .single();

        const agentName = agent?.name ?? args.agent_id;
        return `Conversa transferida para ${agentName}. Motivo: ${args.reason}. A próxima mensagem será respondida por ${agentName}.`;
      } catch (err) {
        return `Erro ao transferir para agente: ${err}`;
      }
    },
  },

  // ==== BRASILAPI ====
  lookup_cep: {
    name: 'lookup_cep',
    modules: ['housing', 'people'],
    description: 'Buscar endereço completo por CEP brasileiro',
    parameters: {
      type: 'object',
      properties: {
        cep: { type: 'string', description: 'CEP (8 dígitos, com ou sem hífen)' },
      },
      required: ['cep'],
    },
    handler: async (args: { cep: string }) => {
      const { fetchCep } = await import('@hawk/shared');
      const data = await fetchCep(args.cep.replace(/\D/g, ''));
      return `📍 ${data.street}, ${data.neighborhood} — ${data.city}/${data.state} (CEP: ${data.cep})`;
    },
  },

  lookup_cnpj: {
    name: 'lookup_cnpj',
    modules: ['legal', 'career'],
    description: 'Buscar dados de empresa por CNPJ na Receita Federal',
    parameters: {
      type: 'object',
      properties: {
        cnpj: { type: 'string', description: 'CNPJ (14 dígitos, com ou sem pontuação)' },
      },
      required: ['cnpj'],
    },
    handler: async (args: { cnpj: string }) => {
      const { fetchCnpj } = await import('@hawk/shared');
      const data = await fetchCnpj(args.cnpj.replace(/\D/g, ''));
      return [
        `🏢 **${data.razao_social}**`,
        data.nome_fantasia ? `Nome Fantasia: ${data.nome_fantasia}` : null,
        `Situação: ${data.descricao_situacao_cadastral}`,
        `Atividade: ${data.cnae_fiscal_descricao}`,
        `Porte: ${data.porte}`,
        `Capital Social: R$ ${data.capital_social.toLocaleString('pt-BR')}`,
        data.telefone ? `Tel: ${data.telefone}` : null,
        data.email ? `Email: ${data.email}` : null,
      ]
        .filter(Boolean)
        .join('\n');
    },
  },

  // ==== KNOWLEDGE SEARCH ====
  search_knowledge: {
    name: 'search_knowledge',
    modules: ['knowledge'],
    description: 'Busca full-text nas notas de conhecimento (bookmarks, notas, livros)',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Termo de busca' },
        type: {
          type: 'string',
          enum: ['note', 'insight', 'reference', 'book_note', 'quote', 'bookmark'],
          description: 'Filtrar por tipo (opcional)',
        },
        limit: { type: 'number', description: 'Número máximo de resultados (default 5)' },
      },
      required: ['query'],
    },
    handler: async (args: { query: string; type?: string; limit?: number }) => {
      const results = await searchKnowledge(args.query, args.limit ?? 5, {
        type: args.type as
          | 'note'
          | 'insight'
          | 'reference'
          | 'book_note'
          | 'quote'
          | 'bookmark'
          | undefined,
      });
      if (results.length === 0) return 'Nenhuma nota encontrada.';
      return results
        .map(
          (n) =>
            `• [${n.type}] ${n.title || n.content.slice(0, 60)} (tags: ${(n.tags ?? []).join(', ')})`,
        )
        .join('\n');
    },
  },

  // ==== HEALTH ANALYTICS ====
  log_workout_set: {
    name: 'log_workout_set',
    modules: ['health'],
    description: 'Registra uma série de exercício em um treino ativo',
    parameters: {
      type: 'object',
      properties: {
        workout_id: { type: 'string', description: 'ID da sessão de treino' },
        exercise_name: { type: 'string', description: 'Nome do exercício' },
        set_number: { type: 'number', description: 'Número da série' },
        reps: { type: 'number', description: 'Repetições' },
        weight_kg: { type: 'number', description: 'Peso em kg' },
        rpe: { type: 'number', description: 'RPE (percepção de esforço 1-10)' },
      },
      required: ['workout_id', 'exercise_name', 'set_number'],
    },
    handler: async (args: {
      workout_id: string;
      exercise_name: string;
      set_number: number;
      reps?: number;
      weight_kg?: number;
      rpe?: number;
    }) => {
      const set = await addWorkoutSet(args);
      const e1rm =
        args.weight_kg && args.reps
          ? ` | 1RM estimado: ${estimate1RM(args.weight_kg, args.reps)}kg`
          : '';
      return `Série ${set.set_number} registrada: ${args.exercise_name} — ${args.reps ?? '?'} reps × ${args.weight_kg ?? '?'}kg${e1rm}`;
    },
  },

  get_exercise_history: {
    name: 'get_exercise_history',
    modules: ['health'],
    description: 'Histórico de progresso de um exercício com 1RM estimado ao longo do tempo',
    parameters: {
      type: 'object',
      properties: {
        exercise_name: { type: 'string', description: 'Nome do exercício' },
        weeks: { type: 'number', description: 'Semanas a considerar (default 12)' },
      },
      required: ['exercise_name'],
    },
    handler: async (args: { exercise_name: string; weeks?: number }) => {
      const history = await getExerciseProgress(args.exercise_name, args.weeks ?? 12);
      if (history.length === 0) return `Sem histórico para "${args.exercise_name}".`;
      const latest = history[history.length - 1];
      const first = history[0];
      const delta =
        latest && first
          ? (((latest.estimated_1rm - first.estimated_1rm) / first.estimated_1rm) * 100).toFixed(1)
          : '0';
      return [
        `**${args.exercise_name}** — ${history.length} sessões em ${args.weeks ?? 12} semanas`,
        `1RM: ${first?.estimated_1rm}kg → ${latest?.estimated_1rm}kg (${delta}%↑)`,
        ...history
          .slice(-5)
          .map(
            (h) => `  ${h.date}: ${h.best_weight_kg}kg × ${h.best_reps} = ${h.estimated_1rm}kg 1RM`,
          ),
      ].join('\n');
    },
  },

  // ==== FINANCES ====
  get_portfolio_summary: {
    name: 'get_portfolio_summary',
    modules: ['finances'],
    description: 'Resumo do portfólio de investimentos com posições e alocação',
    parameters: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const positions = await getPortfolioPositions();
      if (positions.length === 0) return 'Nenhum ativo no portfólio.';
      // biome-ignore lint/suspicious/noExplicitAny: view returns untyped JSON
      const total = positions.reduce((s, p) => s + ((p as any).current_value ?? 0), 0);
      return [
        `**Portfólio** — Total: R$ ${total.toFixed(2)}`,
        ...positions.map(
          // biome-ignore lint/suspicious/noExplicitAny: view returns untyped JSON
          (p: any) =>
            `• ${p.ticker} (${p.asset_class}): ${p.quantity} × R$ ${p.current_price?.toFixed(2) ?? '?'} = R$ ${p.current_value?.toFixed(2) ?? '?'}`,
        ),
      ].join('\n');
    },
  },

  get_budget_status: {
    name: 'get_budget_status',
    modules: ['finances'],
    description: 'Status do orçamento do mês atual vs gasto real por categoria',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'Mês no formato YYYY-MM (default: mês atual)' },
      },
    },
    handler: async (args: { month?: string }) => {
      const month = args.month ?? new Date().toISOString().slice(0, 7);
      const budget = await getBudgetVsActual(month);
      if (budget.length === 0) return `Nenhum orçamento configurado para ${month}.`;
      // biome-ignore lint/suspicious/noExplicitAny: view returns untyped JSON
      const overBudget = budget.filter((b: any) => b.remaining_amount < 0);
      const lines = budget.map(
        // biome-ignore lint/suspicious/noExplicitAny: view returns untyped JSON
        (b: any) =>
          `${b.remaining_amount < 0 ? '🔴' : '🟢'} ${b.category_name}: R$ ${b.spent_amount?.toFixed(2) ?? 0} / R$ ${b.budget_amount?.toFixed(2)} (${b.remaining_amount < 0 ? 'excedido' : `R$ ${b.remaining_amount?.toFixed(2)} restante`})`,
      );
      return [`**Orçamento ${month}** — ${overBudget.length} categorias excedidas`, ...lines].join(
        '\n',
      );
    },
  },

  // ==== CALENDAR ====
  find_free_slots: {
    name: 'find_free_slots',
    modules: ['calendar'],
    description: 'Encontra horários livres na agenda para uma duração específica',
    parameters: {
      type: 'object',
      properties: {
        duration_minutes: { type: 'number', description: 'Duração da reunião/evento em minutos' },
        days_ahead: { type: 'number', description: 'Quantos dias a frente buscar (default 7)' },
      },
      required: ['duration_minutes'],
    },
    handler: async (args: { duration_minutes: number; days_ahead?: number }) => {
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + (args.days_ahead ?? 7));
      const slots = await findFreeSlots(args.duration_minutes, from, to);
      if (slots.length === 0) return 'Nenhum horário livre encontrado no período.';
      return [
        `**Horários livres** para ${args.duration_minutes}min:`,
        ...slots
          .slice(0, 5)
          .map(
            (s) =>
              `• ${s.start.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} ${s.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}–${s.end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          ),
        slots.length > 5 ? `... e mais ${slots.length - 5} horários` : '',
      ]
        .filter(Boolean)
        .join('\n');
    },
  },

  // ==== ROUTINE ====
  get_habit_scores: {
    name: 'get_habit_scores',
    modules: ['routine'],
    description: 'Scores de consistência e hábitos com streak em risco hoje',
    parameters: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const atRisk = await getHabitsAtRisk();
      const lines: string[] = [];
      if (atRisk.length > 0) {
        lines.push(`**⚠️ Hábitos em risco (${atRisk.length}):**`);
        for (const h of atRisk) {
          lines.push(
            `• ${h.habit_name} — streak ${h.current_streak}d (último: ${h.last_completed_date})`,
          );
        }
      } else {
        lines.push('✅ Nenhum hábito em risco de quebrar hoje.');
      }
      return lines.join('\n');
    },
  },

  // ==== ASSETS / DOCUMENTS ====
  search_documents: {
    name: 'search_documents',
    modules: ['assets'],
    description: 'Busca documentos por nome ou conteúdo OCR',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Termo de busca (nome ou conteúdo do documento)' },
      },
      required: ['query'],
    },
    handler: async (args: { query: string }) => {
      const docs = await searchDocuments(args.query);
      if (docs.length === 0) return `Nenhum documento encontrado para "${args.query}".`;
      return docs
        .map(
          (d) =>
            // biome-ignore lint/suspicious/noExplicitAny: expires_at added via migration
            `• ${d.name} [${d.type}]${(d as any).expires_at ? ` — vence ${(d as any).expires_at}` : ''}`,
        )
        .join('\n');
    },
  },
};

export type ToolName = keyof typeof TOOLS;

/**
 * Get tools filtered by detected modules.
 * Universal tools (modules: []) are always included.
 * Returns both the OpenAI tool definitions and the handler map.
 */
export function getToolsForModules(detectedModules: string[]): {
  tools: OpenAI.ChatCompletionTool[];
  toolMap: Map<string, ToolDefinition>;
} {
  const detected = new Set(detectedModules);

  const filtered = Object.values(TOOLS).filter((tool) => {
    // Universal tools: always included
    if (tool.modules.length === 0) return true;
    // Module-specific: include if any module matches
    return tool.modules.some((m) => detected.has(m));
  });

  const tools: OpenAI.ChatCompletionTool[] = filtered.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));

  const toolMap = new Map(filtered.map((tool) => [tool.name, tool]));

  return { tools, toolMap };
}

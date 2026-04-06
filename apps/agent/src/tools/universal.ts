import { db } from '@hawk/db';
import { getNextQuestion, markQuestionAnswered, markQuestionAsked } from '@hawk/module-memory';
import { getLinkedMemories } from '@hawk/module-memory/queries';
import { z } from 'zod';

import type { ToolDefinition } from './types.js';

export const universalTools: Record<string, ToolDefinition> = {
  save_memory: {
    name: 'save_memory',
    modules: [],
    description: 'Salva uma memória de longo prazo sobre o usuário',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Conteúdo da memória' },
        memory_type: {
          type: 'string',
          enum: ['profile', 'preference', 'entity', 'event', 'case', 'pattern', 'procedure'],
          description:
            'Tipo: profile (identidade), preference, entity (pessoas/projetos), event (marco), case (correção), pattern (processo), procedure (regra aprendida/comportamento corrigido)',
        },
        module: { type: 'string', description: 'Módulo relacionado (optional)' },
        importance: { type: 'number', description: 'Importância 1-10 (default 5)' },
        confidence: {
          type: 'number',
          description:
            'Confiança 0.0-1.0: 1.0=afirmado diretamente, 0.5=implícito, 0.3=incerto (default 0.8)',
        },
      },
      required: ['content', 'memory_type'],
    },
    schema: z.object({
      content: z.string().min(1).max(4000),
      memory_type: z.enum([
        'profile',
        'preference',
        'entity',
        'event',
        'case',
        'pattern',
        'procedure',
      ]),
      module: z.string().optional(),
      importance: z.number().int().min(1).max(10).optional(),
      confidence: z.number().min(0).max(1).optional(),
    }),
    handler: async () => '', // handled directly in handler.ts
  },

  ask_deepening_question: {
    name: 'ask_deepening_question',
    modules: [],
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
    schema: z.object({
      topic: z.string().optional(),
    }),
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
    modules: [],
    description: 'Marca uma pergunta de aprofundamento como respondida com resumo da resposta',
    parameters: {
      type: 'object',
      properties: {
        question_id: { type: 'string', description: 'ID da pergunta respondida' },
        answer_summary: { type: 'string', description: 'Resumo da resposta do usuário' },
      },
      required: ['question_id', 'answer_summary'],
    },
    schema: z.object({
      question_id: z.string().uuid(),
      answer_summary: z.string().min(1),
    }),
    handler: async (args: { question_id: string; answer_summary: string }) => {
      await markQuestionAnswered(args.question_id, args.answer_summary);
      return 'Pergunta marcada como respondida.';
    },
  },

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
    schema: z.object({
      agent_id: z.string().uuid(),
      query: z.string().min(1),
      session_context: z.string().optional(),
    }),
    handler: async (args: { agent_id: string; query: string; session_context?: string }) => {
      try {
        const { runSubAgent } = await import('../sub-agent.js');
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
    schema: z.object({
      agent_id: z.string().uuid(),
      reason: z.string().min(1),
      summary: z.string().optional(),
    }),
    handler: async (args: { agent_id: string; reason: string; summary?: string }) => {
      try {
        const { db } = await import('@hawk/db');

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

  explore_memory_graph: {
    name: 'explore_memory_graph',
    modules: [],
    description:
      'Explora o grafo de conhecimento a partir de uma memória, retornando memórias conectadas por até N saltos. Útil para encontrar conexões não óbvias entre informações.',
    parameters: {
      type: 'object',
      properties: {
        memory_id: { type: 'string', description: 'UUID da memória raiz' },
        max_hops: { type: 'number', description: 'Número máximo de saltos (1-3, default 2)' },
      },
      required: ['memory_id'],
    },
    schema: z.object({
      memory_id: z.string().uuid(),
      max_hops: z.number().int().min(1).max(3).optional(),
    }),
    handler: async (args: { memory_id: string; max_hops?: number }) => {
      const hops = Math.min(args.max_hops ?? 2, 3);
      const linked = await getLinkedMemories(args.memory_id, hops);
      if (linked.length === 0) return 'Nenhuma memória conectada encontrada.';
      const lines = linked.map(
        ({ memory, relation, strength, hop }) =>
          `[hop ${hop}, ${relation}, força ${(strength * 100).toFixed(0)}%] ${memory.content.slice(0, 120)}`,
      );
      return `**Memórias conectadas (${linked.length}):**\n${lines.join('\n')}`;
    },
  },

  // ── S1.2 — Diagnóstico Self-Service ────────────────────────────────────────
  system_status: {
    name: 'system_status',
    modules: [],
    description:
      'Mostra o status do sistema: módulos configurados, dados em falta, próximas automações e acções pendentes',
    parameters: {
      type: 'object',
      properties: {},
    },
    schema: z.object({}),
    handler: async () => {
      const icon = (ok: boolean) => (ok ? '✅' : '⚠️');

      // ── Module data checks ────────────────────────────────────────────────
      const checks = await Promise.allSettled([
        db.from('finance_transactions').select('id', { count: 'exact', head: true }),
        db.from('finance_accounts').select('id', { count: 'exact', head: true }),
        db.from('sleep_sessions').select('id', { count: 'exact', head: true }),
        db.from('workout_sessions').select('id', { count: 'exact', head: true }),
        db.from('people').select('id', { count: 'exact', head: true }),
        db.from('objectives').select('id', { count: 'exact', head: true }),
        db.from('events').select('id', { count: 'exact', head: true }),
        db
          .from('pending_intents')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        db
          .from('activity_log')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const get = (i: number): number => {
        const r = checks[i];
        if (!r || r.status !== 'fulfilled') return 0;
        return ((r.value as { count?: number | null }).count ?? 0);
      };

      const txCount = get(0);
      const accountCount = get(1);
      const sleepCount = get(2);
      const workoutCount = get(3);
      const peopleCount = get(4);
      const objectivesCount = get(5);
      const eventsCount = get(6);
      const pendingCount = get(7);

      const lastActivityRaw = checks[8];
      let lastActivity = 'Sem dados';
      if (lastActivityRaw.status === 'fulfilled') {
        const row = (lastActivityRaw.value as { data?: { created_at?: string } | null }).data;
        if (row?.created_at) {
          const d = new Date(row.created_at);
          lastActivity = `${d.toLocaleDateString('pt-BR')} ${d.toISOString().slice(11, 16)}`;
        }
      }

      // ── API key status ────────────────────────────────────────────────────
      const hasOllamaEnv = !!process.env.OLLAMA_BASE_URL;
      const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
      const apiStatus = hasOllamaEnv
        ? '✅ Ollama local (grátis)'
        : hasOpenRouter
          ? '✅ OpenRouter'
          : '⚠️ Sem API configurada';

      // ── Scheduled automations ────────────────────────────────────────────
      const now = new Date();
      const h = now.getHours();
      const nextAuto =
        h < 8
          ? 'Alertas às 08:00'
          : h < 9
            ? 'Check-in matinal às 09:00'
            : h < 22
              ? 'Check-in noturno às 22:00'
              : 'Alertas amanhã às 08:00';

      // ── Build report ────────────────────────────────────────────────────
      const lines = [
        '**🔍 Status do Sistema Hawk OS**',
        '',
        '**Módulos:**',
        `${icon(accountCount > 0)} Finanças — ${accountCount} conta(s), ${txCount} transação(ões)`,
        `${icon(sleepCount > 0)} Saúde — ${sleepCount} noite(s) de sono, ${workoutCount} treino(s)`,
        `${icon(peopleCount > 0)} Pessoas — ${peopleCount} contato(s)`,
        `${icon(objectivesCount > 0)} Objectivos — ${objectivesCount} objectivo(s)`,
        `${icon(eventsCount > 0)} Calendário — ${eventsCount} evento(s)`,
        '',
        '**Sistema:**',
        `${apiStatus}`,
        `📅 Última actividade: ${lastActivity}`,
        `⏰ Próxima automação: ${nextAuto}`,
        '',
        pendingCount > 0
          ? `💡 **${pendingCount} acção(ões) pendente(s)** — diz "pendentes" para ver`
          : '✅ Sem acções pendentes',
      ];

      // ── Missing data nudges ─────────────────────────────────────────────
      const missing: string[] = [];
      if (accountCount === 0) missing.push('• Finanças: cria uma conta bancária');
      if (sleepCount === 0) missing.push('• Saúde: regista o teu sono');
      if (peopleCount === 0) missing.push('• Pessoas: adiciona os teus contactos importantes');
      if (objectivesCount === 0) missing.push('• Objectivos: define um objectivo');

      if (missing.length > 0) {
        lines.push('', '**Dados em falta:**', ...missing);
      }

      return lines.join('\n');
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
    schema: z.object({
      cep: z.string().min(8).max(9),
    }),
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
    schema: z.object({
      cnpj: z.string().min(14).max(18),
    }),
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
};

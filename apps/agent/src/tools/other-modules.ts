import { searchDocuments } from '@hawk/module-assets/queries';
import { deleteAsset, deleteDocument } from '@hawk/module-assets/queries';
import { findWorkspaceByName, logWork } from '@hawk/module-career/queries';
import { createMedia, updateMediaStatus } from '@hawk/module-entertainment/queries';
import { deleteBill, deleteMaintenanceLog } from '@hawk/module-housing/queries';
import {
  getMoodTrend,
  getWritingStreak,
  searchEntries,
  upsertJournalEntry,
} from '@hawk/module-journal/queries';
import { deleteContract, deleteLegalEntity, deleteObligation } from '@hawk/module-legal/queries';
import { deleteMemory } from '@hawk/module-memory/queries';
import {
  createSecurityItem,
  getComplianceStatus,
  getExpiringItems,
  markReviewComplete,
} from '@hawk/module-security/queries';
import { createReflection } from '@hawk/module-spirituality/queries';
import { z } from 'zod';

import type { ToolDefinition } from './types.js';

export const otherModuleTools: Record<string, ToolDefinition> = {
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
    schema: z.object({
      workspace_name: z.string().min(1),
      duration_minutes: z.number().int().positive().max(1440),
      description: z.string().optional(),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    }),
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
    schema: z.object({
      content: z.string().min(1).max(50000),
      mood: z.number().int().min(1).max(10).optional(),
      energy: z.number().int().min(1).max(10).optional(),
    }),
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
    schema: z.object({
      content: z.string().min(1).max(10000),
      type: z.enum(['reflection', 'gratitude', 'intention', 'values', 'mantra']).optional(),
      mood: z.number().int().min(1).max(5).optional(),
    }),
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
    schema: z.object({
      title: z.string().min(1).max(200),
      type: z.enum(['movie', 'series', 'book_fiction', 'game', 'podcast', 'music_album']),
      status: z.enum(['want', 'watching', 'completed', 'abandoned']).optional(),
      platform: z.string().optional(),
    }),
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

  update_media_status: {
    name: 'update_media_status',
    modules: ['entertainment'],
    description: 'Atualiza o status de uma mídia (assistindo, completou, abandonou)',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID da mídia' },
        status: {
          type: 'string',
          enum: ['want', 'watching', 'completed', 'abandoned'],
          description: 'Novo status',
        },
        rating: { type: 'number', description: 'Nota de 1-10 (opcional)' },
      },
      required: ['id', 'status'],
    },
    schema: z.object({
      id: z.string().uuid(),
      status: z.enum(['want', 'watching', 'completed', 'abandoned']),
      rating: z.number().min(1).max(10).optional(),
    }),
    handler: async (args: { id: string; status: string; rating?: number }) => {
      const media = await updateMediaStatus(
        args.id,
        args.status as 'want' | 'watching' | 'completed' | 'abandoned',
        args.rating,
      );
      return `Mídia atualizada: ${media.title} → ${media.status}`;
    },
  },

  // ==== ASSETS ====
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
    schema: z.object({
      query: z.string().min(1),
    }),
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

  delete_asset: {
    name: 'delete_asset',
    modules: ['assets'],
    dangerous: true,
    description: 'Deleta um item de patrimônio por ID',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID do ativo a deletar' },
      },
      required: ['id'],
    },
    schema: z.object({ id: z.string().uuid() }),
    handler: async (args: { id: string }) => {
      await deleteAsset(args.id);
      return 'Ativo deletado.';
    },
  },

  delete_document: {
    name: 'delete_document',
    modules: ['assets'],
    dangerous: true,
    description: 'Deleta um documento por ID',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID do documento a deletar' },
      },
      required: ['id'],
    },
    schema: z.object({ id: z.string().uuid() }),
    handler: async (args: { id: string }) => {
      await deleteDocument(args.id);
      return 'Documento deletado.';
    },
  },

  // ==== HOUSING ====
  delete_bill: {
    name: 'delete_bill',
    modules: ['housing'],
    dangerous: true,
    description: 'Deleta uma conta/boleto por ID',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID da conta a deletar' },
      },
      required: ['id'],
    },
    schema: z.object({ id: z.string().uuid() }),
    handler: async (args: { id: string }) => {
      await deleteBill(args.id);
      return 'Conta deletada.';
    },
  },

  delete_maintenance_log: {
    name: 'delete_maintenance_log',
    modules: ['housing'],
    dangerous: true,
    description: 'Deleta um registro de manutenção por ID',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID do registro a deletar' },
      },
      required: ['id'],
    },
    schema: z.object({ id: z.string().uuid() }),
    handler: async (args: { id: string }) => {
      await deleteMaintenanceLog(args.id);
      return 'Registro de manutenção deletado.';
    },
  },

  // ==== LEGAL ====
  delete_obligation: {
    name: 'delete_obligation',
    modules: ['legal'],
    dangerous: true,
    description: 'Deleta uma obrigação legal por ID',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID da obrigação a deletar' },
      },
      required: ['id'],
    },
    schema: z.object({ id: z.string().uuid() }),
    handler: async (args: { id: string }) => {
      await deleteObligation(args.id);
      return 'Obrigação deletada.';
    },
  },

  delete_contract: {
    name: 'delete_contract',
    modules: ['legal'],
    dangerous: true,
    description: 'Deleta um contrato por ID',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID do contrato a deletar' },
      },
      required: ['id'],
    },
    schema: z.object({ id: z.string().uuid() }),
    handler: async (args: { id: string }) => {
      await deleteContract(args.id);
      return 'Contrato deletado.';
    },
  },

  delete_legal_entity: {
    name: 'delete_legal_entity',
    modules: ['legal'],
    dangerous: true,
    description: 'Deleta uma entidade jurídica por ID',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID da entidade a deletar' },
      },
      required: ['id'],
    },
    schema: z.object({ id: z.string().uuid() }),
    handler: async (args: { id: string }) => {
      await deleteLegalEntity(args.id);
      return 'Entidade jurídica deletada.';
    },
  },

  // ==== MEMORY ====
  delete_memory: {
    name: 'delete_memory',
    modules: [],
    dangerous: true,
    description: 'Deleta uma memória do agente por ID',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID da memória a deletar' },
      },
      required: ['id'],
    },
    schema: z.object({ id: z.string().uuid() }),
    handler: async (args: { id: string }) => {
      await deleteMemory(args.id);
      return 'Memória deletada.';
    },
  },

  // ==== JOURNAL (search & analytics) ====
  search_journal: {
    name: 'search_journal',
    modules: ['journal'],
    description: 'Pesquisa entries do diário por texto no conteúdo',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto a pesquisar' },
        limit: { type: 'number', description: 'Número de resultados (máx 50)' },
      },
      required: ['query'],
    },
    schema: z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    handler: async (args: { query: string; limit?: number }) => {
      const entries = await searchEntries(args.query, args.limit ?? 10);
      if (entries.length === 0) return `Nenhuma entry encontrada para "${args.query}".`;
      const lines = entries.map(
        (e) => `• ${e.date} (mood: ${e.mood ?? '—'}): ${e.content.slice(0, 120)}...`,
      );
      return `${entries.length} entries encontradas:\n${lines.join('\n')}`;
    },
  },

  get_mood_trend: {
    name: 'get_mood_trend',
    modules: ['journal'],
    description: 'Tendência de mood e energia nas últimas N semanas',
    parameters: {
      type: 'object',
      properties: {
        weeks: { type: 'number', description: 'Número de semanas (padrão: 8)' },
      },
      required: [],
    },
    schema: z.object({ weeks: z.number().int().min(1).max(52).optional() }),
    handler: async (args: { weeks?: number }) => {
      const trend = await getMoodTrend(args.weeks ?? 8);
      if (trend.length === 0) return 'Sem dados de mood.';
      const lines = trend.map(
        (t) => `• ${t.week}: mood ${t.avg_mood ?? '—'}/10, energia ${t.avg_energy ?? '—'}/10`,
      );
      return `Tendência de mood (${trend.length} semanas):\n${lines.join('\n')}`;
    },
  },

  get_writing_streak: {
    name: 'get_writing_streak',
    modules: ['journal'],
    description: 'Streak atual de dias consecutivos escrevendo no diário',
    parameters: { type: 'object', properties: {}, required: [] },
    schema: z.object({}),
    handler: async () => {
      const result = await getWritingStreak();
      if (result.streak === 0) return 'Nenhum streak activo. Última entrada: sem dados.';
      return `Streak actual: ${result.streak} dia(s) consecutivo(s). Última entrada: ${result.last_entry_date}.`;
    },
  },

  // ==== SECURITY ====
  create_security_item: {
    name: 'create_security_item',
    modules: ['security'],
    description: 'Cria um novo item de segurança (conta, backup, 2FA, password manager, etc.)',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome do item' },
        type: {
          type: 'string',
          enum: ['account', 'backup', '2fa', 'recovery', 'password_manager', 'other'],
          description: 'Categoria',
        },
        status: {
          type: 'string',
          enum: ['ok', 'needs_attention', 'critical'],
          description: 'Status inicial',
        },
        notes: { type: 'string', description: 'Notas opcionais' },
      },
      required: ['name', 'type'],
    },
    schema: z.object({
      name: z.string().min(1).max(200),
      type: z.enum(['account', 'backup', '2fa', 'recovery', 'password_manager', 'other']),
      status: z.enum(['ok', 'needs_attention', 'critical']).optional(),
      notes: z.string().optional(),
    }),
    handler: async (args: {
      name: string;
      type: 'account' | 'backup' | '2fa' | 'recovery' | 'password_manager' | 'other';
      status?: 'ok' | 'needs_attention' | 'critical';
      notes?: string;
    }) => {
      const item = await createSecurityItem(args);
      return `Item de segurança criado: ${item.name} (${item.type}, ${item.status})`;
    },
  },

  get_security_compliance: {
    name: 'get_security_compliance',
    modules: ['security'],
    description: 'Verifica status de compliance de segurança — itens críticos e reviews vencidas',
    parameters: { type: 'object', properties: {}, required: [] },
    schema: z.object({}),
    handler: async () => {
      const status = await getComplianceStatus();
      if (status.compliant)
        return '✅ Segurança em conformidade. Nenhum item crítico ou review vencida.';
      return [
        `⚠️ Conformidade: ${status.compliant ? 'OK' : 'NÃO CONFORME'}`,
        `  Críticos: ${status.critical_count}`,
        `  Reviews vencidas: ${status.overdue_count}`,
        `  Itens que precisam atenção: ${status.items_needing_attention.length}`,
      ].join('\n');
    },
  },

  get_expiring_security_items: {
    name: 'get_expiring_security_items',
    modules: ['security'],
    description: 'Lista itens de segurança com review a vencer nos próximos N dias',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Horizonte em dias (padrão: 30)' },
      },
      required: [],
    },
    schema: z.object({ days: z.number().int().min(1).max(365).optional() }),
    handler: async (args: { days?: number }) => {
      const items = await getExpiringItems(args.days ?? 30);
      if (items.length === 0) return `Nenhum item a expirar nos próximos ${args.days ?? 30} dias.`;
      const lines = items.map((i) => `• ${i.name} (${i.type}) — review: ${i.next_review}`);
      return `${items.length} item(s) a expirar:\n${lines.join('\n')}`;
    },
  },

  mark_security_review_complete: {
    name: 'mark_security_review_complete',
    modules: ['security'],
    description: 'Marca a review de um item de segurança como feita (next_review +90 dias)',
    parameters: {
      type: 'object',
      properties: {
        item_id: { type: 'string', description: 'ID do item' },
        notes: { type: 'string', description: 'Notas sobre a review' },
      },
      required: ['item_id'],
    },
    schema: z.object({
      item_id: z.string().uuid(),
      notes: z.string().optional(),
    }),
    handler: async (args: { item_id: string; notes?: string }) => {
      const item = await markReviewComplete(args.item_id, args.notes);
      return `Review concluída para "${item.name}". Próxima review: ${item.next_review}.`;
    },
  },
};

import { searchDocuments } from '@hawk/module-assets/queries';
import { deleteAsset, deleteDocument } from '@hawk/module-assets/queries';
import { findWorkspaceByName, logWork } from '@hawk/module-career/queries';
import { createMedia, updateMediaStatus } from '@hawk/module-entertainment/queries';
import { deleteBill, deleteMaintenanceLog } from '@hawk/module-housing/queries';
import { upsertJournalEntry } from '@hawk/module-journal/queries';
import { deleteContract, deleteLegalEntity, deleteObligation } from '@hawk/module-legal/queries';
import { deleteMemory } from '@hawk/module-memory/queries';
import { createReflection } from '@hawk/module-spirituality/queries';

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
    handler: async (args: { id: string }) => {
      await deleteMemory(args.id);
      return 'Memória deletada.';
    },
  },
};

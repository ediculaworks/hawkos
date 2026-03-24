import { createNote, searchKnowledge } from '@hawk/module-knowledge/queries';

import type { ToolDefinition } from './types.js';

export const knowledgeTools: Record<string, ToolDefinition> = {
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
};

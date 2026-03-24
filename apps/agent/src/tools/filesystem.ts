import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import type { ToolDefinition } from './types.js';

const MAX_READ_BYTES = 50_000;

function isPathSafe(targetPath: string): boolean {
  const projectRoot = process.cwd();
  const resolved = resolve(targetPath);
  const rel = relative(projectRoot, resolved);
  // Must be within project root (no ../ escaping)
  return !rel.startsWith('..') && !resolved.includes('node_modules');
}

export const filesystemTools: Record<string, ToolDefinition> = {
  read_file: {
    name: 'read_file',
    modules: [],
    description: 'Lê o conteúdo de um arquivo do projeto',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Caminho do arquivo (relativo ao projeto)' },
        lines: { type: 'number', description: 'Número máximo de linhas (default: todas)' },
        offset: { type: 'number', description: 'Linha inicial (default: 0)' },
      },
      required: ['path'],
    },
    handler: async (args: { path: string; lines?: number; offset?: number }) => {
      const fullPath = resolve(process.cwd(), args.path);

      if (!isPathSafe(fullPath)) {
        return '⛔ Acesso negado: o caminho deve estar dentro do projeto.';
      }

      if (!existsSync(fullPath)) {
        return `Erro: arquivo não encontrado: ${args.path}`;
      }

      try {
        const content = readFileSync(fullPath, 'utf-8');

        if (Buffer.byteLength(content, 'utf-8') > MAX_READ_BYTES) {
          const lines = content.split('\n');
          const start = args.offset ?? 0;
          const count = args.lines ?? 200;
          const sliced = lines.slice(start, start + count);
          return `[Mostrando linhas ${start + 1}-${start + sliced.length} de ${lines.length}]\n${sliced.join('\n')}`;
        }

        if (args.offset || args.lines) {
          const lines = content.split('\n');
          const start = args.offset ?? 0;
          const count = args.lines ?? lines.length;
          return lines.slice(start, start + count).join('\n');
        }

        return content;
      } catch (err) {
        return `Erro ao ler arquivo: ${err}`;
      }
    },
  },

  write_file: {
    name: 'write_file',
    modules: [],
    dangerous: true,
    description: 'Escreve conteúdo em um arquivo do projeto (cria ou sobrescreve)',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Caminho do arquivo (relativo ao projeto)' },
        content: { type: 'string', description: 'Conteúdo a escrever' },
      },
      required: ['path', 'content'],
    },
    handler: async (args: { path: string; content: string }) => {
      const fullPath = resolve(process.cwd(), args.path);

      if (!isPathSafe(fullPath)) {
        return '⛔ Acesso negado: o caminho deve estar dentro do projeto.';
      }

      try {
        writeFileSync(fullPath, args.content, 'utf-8');
        return `Arquivo escrito: ${args.path} (${Buffer.byteLength(args.content, 'utf-8')} bytes)`;
      } catch (err) {
        return `Erro ao escrever arquivo: ${err}`;
      }
    },
  },

  list_files: {
    name: 'list_files',
    modules: [],
    description: 'Lista arquivos e diretórios no projeto',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Diretório (relativo ao projeto, default: raiz)' },
        pattern: { type: 'string', description: 'Filtro por nome (substring, case-insensitive)' },
        recursive: { type: 'boolean', description: 'Listar recursivamente (default: false)' },
      },
    },
    handler: async (args: { path?: string; pattern?: string; recursive?: boolean }) => {
      const dir = resolve(process.cwd(), args.path ?? '.');

      if (!isPathSafe(dir)) {
        return '⛔ Acesso negado: o caminho deve estar dentro do projeto.';
      }

      try {
        const entries: string[] = [];

        function listDir(dirPath: string, prefix = '') {
          const items = readdirSync(dirPath, { withFileTypes: true });
          for (const item of items) {
            // Skip hidden/node_modules/dist
            if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === 'dist')
              continue;

            const entryPath = join(prefix, item.name);
            const fullEntryPath = join(dirPath, item.name);

            if (args.pattern && !item.name.toLowerCase().includes(args.pattern.toLowerCase())) {
              // If recursive and is directory, still descend
              if (args.recursive && item.isDirectory()) {
                listDir(fullEntryPath, entryPath);
              }
              continue;
            }

            if (item.isDirectory()) {
              entries.push(`📁 ${entryPath}/`);
              if (args.recursive) {
                listDir(fullEntryPath, entryPath);
              }
            } else {
              try {
                const stat = statSync(fullEntryPath);
                const size =
                  stat.size > 1024 * 1024
                    ? `${(stat.size / 1024 / 1024).toFixed(1)}MB`
                    : stat.size > 1024
                      ? `${(stat.size / 1024).toFixed(1)}KB`
                      : `${stat.size}B`;
                entries.push(`  ${entryPath} (${size})`);
              } catch {
                entries.push(`  ${entryPath}`);
              }
            }
          }
        }

        listDir(dir);

        if (entries.length === 0) return 'Nenhum arquivo encontrado.';
        if (entries.length > 200) {
          return `${entries.slice(0, 200).join('\n')}\n\n... e mais ${entries.length - 200} itens`;
        }
        return entries.join('\n');
      } catch (err) {
        return `Erro ao listar diretório: ${err}`;
      }
    },
  },
};

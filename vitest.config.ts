import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/**/__tests__/**/*.test.ts', 'packages/**/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@hawk/db': './packages/db/src',
      '@hawk/shared': './packages/shared/src',
      '@hawk/module-memory/queries': './packages/modules/memory/queries.ts',
      '@hawk/module-memory/retrieval': './packages/modules/memory/retrieval.ts',
      '@hawk/module-memory/session-commit': './packages/modules/memory/session-commit.ts',
      '@hawk/module-memory/embeddings': './packages/modules/memory/embeddings.ts',
      '@hawk/module-memory/types': './packages/modules/memory/types.ts',
      '@hawk/module-finances/queries': './packages/modules/finances/queries.ts',
      '@hawk/module-people/queries': './packages/modules/people/queries.ts',
      '@hawk/context-engine': './packages/context-engine/src',
    },
  },
});

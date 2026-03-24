/**
 * Seed Memories — Gera embeddings para agent_memories sem embedding
 *
 * Usa backfillEmbeddings() do módulo memory que:
 * 1. Busca todas as memories com embedding = NULL
 * 2. Gera embedding via OpenRouter (text-embedding-3-small, grátis)
 * 3. Atualiza cada memory com o vetor
 *
 * Rodar: bun run scripts/seed-memories.ts
 * Pré-requisito: migration 20260401000000_seed_real_data.sql já aplicada
 */

import { backfillEmbeddings } from '@hawk/module-memory';

async function main() {
  console.log('🧠 Gerando embeddings para agent_memories...\n');

  let total = 0;
  let batch: number;

  // Process in batches of 20 until no more memories need embeddings
  do {
    batch = await backfillEmbeddings(20);
    total += batch;
    if (batch > 0) {
      console.log(`  ✅ Batch: ${batch} embeddings gerados (total: ${total})`);
    }
  } while (batch > 0);

  if (total === 0) {
    console.log('  ℹ️  Nenhuma memory sem embedding encontrada.');
  } else {
    console.log(`\n🎉 Total: ${total} embeddings gerados com sucesso.`);
  }
}

main().catch((err) => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});

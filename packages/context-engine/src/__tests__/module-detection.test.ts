import { describe, expect, it, vi } from 'vitest';

// Mock module-embeddings so centroids are never "ready" — forces keyword-only path
vi.mock('../module-embeddings.ts', () => ({
  areCentroidsReady: () => false,
  scoreByEmbedding: async () => [],
  initModuleCentroids: async () => {},
}));

// assembleContext needs registered modules; for detection tests we only care about
// which modules are detected, so we import the internal scorer via the assembler.
// Instead, we test the public assembleContext return value (modulesLoaded).

import type { ModuleId } from '@hawk/shared';
// Stub modules so assembleContext doesn't blow up when trying to call getL0/getL1/getL2
import { registerModule } from '../assembler.ts';

const ALL_MODULE_IDS: ModuleId[] = [
  'finances',
  'health',
  'people',
  'career',
  'objectives',
  'knowledge',
  'routine',
  'assets',
  'entertainment',
  'legal',
  'social',
  'spirituality',
  'housing',
  'security',
  'calendar',
  'journal',
];

for (const id of ALL_MODULE_IDS) {
  registerModule({
    id,
    getL0: () => `[${id} L0]`,
    getL1: async () => `[${id} L1]`,
    getL2: async (_msg?: string) => `[${id} L2]`,
  });
}

import { assembleContext } from '../assembler.ts';

describe('Module Detection (keyword-based)', () => {
  it('detects finances module for spending queries', async () => {
    // "gasto" is the exact keyword in moduleKeywords.finances
    const ctx = await assembleContext('qual é meu gasto esse mês?');
    expect(ctx.modulesLoaded).toContain('finances');
  });

  it('detects health module for sleep/wellness messages', async () => {
    const ctx = await assembleContext('dormi mal ontem, sono péssimo');
    expect(ctx.modulesLoaded).toContain('health');
  });

  it('detects people module for contact-related messages', async () => {
    const ctx = await assembleContext('encontrei a Maria ontem');
    expect(ctx.modulesLoaded).toContain('people');
  });

  it('detects calendar module for scheduling messages', async () => {
    const ctx = await assembleContext('tenho compromisso amanhã cedo');
    expect(ctx.modulesLoaded).toContain('calendar');
  });

  it('returns empty modulesLoaded for empty message', async () => {
    const ctx = await assembleContext('');
    expect(ctx.modulesLoaded).toHaveLength(0);
  });

  it('returns relevanceScores sorted by score descending', async () => {
    const ctx = await assembleContext('gasto com remédio');
    // Both finances and health should be detected; scores should be sorted
    const scores = ctx.relevanceScores;
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]!.score).toBeGreaterThanOrEqual(scores[i + 1]!.score);
    }
  });

  it('detects multiple modules for cross-domain messages', async () => {
    const ctx = await assembleContext('pagar academia esse mês, controlar gasto com saúde');
    expect(ctx.modulesLoaded).toContain('finances');
    expect(ctx.modulesLoaded).toContain('health');
  });

  it('assembledContext includes l0 content from detected modules', async () => {
    const ctx = await assembleContext('qual é meu gasto esse mês?');
    expect(ctx.l0).toContain('[finances L0]');
  });

  // ── Extended keyword coverage (Wave 2 expansion) ─────────────────────────

  it('detects finances for "fatura", "cartão", "pix", "boleto"', async () => {
    for (const keyword of ['fatura', 'cartão', 'pix', 'boleto']) {
      const ctx = await assembleContext(`quero ver meu ${keyword}`);
      expect(ctx.modulesLoaded).toContain('finances');
    }
  });

  it('detects health for "corrida", "musculação", "consulta"', async () => {
    for (const keyword of ['corrida', 'musculação', 'consulta médica']) {
      const ctx = await assembleContext(`tenho ${keyword} amanhã`);
      expect(ctx.modulesLoaded).toContain('health');
    }
  });

  it('detects career for "deadline", "sprint", "promoção"', async () => {
    for (const keyword of ['deadline', 'sprint', 'promoção']) {
      const ctx = await assembleContext(`meu ${keyword} é sexta`);
      expect(ctx.modulesLoaded).toContain('career');
    }
  });

  it('detects routine module for habit-related queries', async () => {
    const ctx = await assembleContext('meus hábitos estão fracos');
    expect(ctx.modulesLoaded).toContain('routine');
  });

  it('detects objectives module for goal-related queries', async () => {
    const ctx = await assembleContext('qual o progresso das minhas metas?');
    expect(ctx.modulesLoaded).toContain('objectives');
  });

  it('loads L1 for primary detected module', async () => {
    const ctx = await assembleContext('quanto gastei no cartão?');
    expect(ctx.l1).toContain('[finances L1]');
  });

  it('returns L2 content for specific data queries with month reference', async () => {
    // "gasto" is an exact keyword for finances, "janeiro" triggers requiresSpecificData
    const ctx = await assembleContext('meu gasto em janeiro foi alto');
    expect(ctx.l2).toContain('[finances L2]');
  });

  it('does not include L1 for modules not detected', async () => {
    const ctx = await assembleContext('bom dia');
    // Generic greeting — no modules detected, L1 should be empty
    expect(ctx.l1).toBe('');
  });
});

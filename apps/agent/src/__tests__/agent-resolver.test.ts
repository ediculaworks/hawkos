import { describe, expect, it, vi } from 'vitest';

// ── Mock the db client directly to avoid env var requirements ─────────────────
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock('../../../../packages/db/src/client.ts', () => ({
  db: { from: mockFrom },
  tenantStore: { getStore: () => null, run: vi.fn() },
  createTenantClient: vi.fn(),
}));

import { buildSystemPrompt, resolveAgent } from '../agent-resolver';
import type { ResolvedAgent } from '../agent-resolver';

// Helpers to build chainable Supabase mock
function makeChain(finalValue: unknown) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'limit', 'maybeSingle', 'single'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // last call resolves with the value
  (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(finalValue);
  (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(finalValue);
  return chain;
}

// ── resolveAgent tests ────────────────────────────────────────────────────────

describe('resolveAgent', () => {
  it('returns default agent when no conversation or template found', async () => {
    const nullChain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(nullChain);

    const agent = await resolveAgent('session-123', 'discord');

    expect(agent.id).toBe('default');
    expect(agent.name).toBe('Hawk');
    expect(agent.tier).toBe('orchestrator');
    expect(agent.isUserFacing).toBe(true);
    expect(agent.toolsEnabled).toEqual([]);
  });

  it('uses reactMode default of "auto" when agent_settings is null', async () => {
    const nullChain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(nullChain);

    const agent = await resolveAgent('session-abc', 'discord');

    expect(agent.reactMode).toBe('auto');
  });

  it('uses costTrackingEnabled default of true when agent_settings is null', async () => {
    const nullChain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(nullChain);

    const agent = await resolveAgent('session-abc', 'discord');

    expect(agent.costTrackingEnabled).toBe(true);
  });

  it('uses historyCompressionEnabled default of true when agent_settings is null', async () => {
    const nullChain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(nullChain);

    const agent = await resolveAgent('session-abc', 'discord');

    expect(agent.historyCompressionEnabled).toBe(true);
  });

  it('uses fallback model from env or constant when settings is null', async () => {
    const nullChain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(nullChain);

    const agent = await resolveAgent('session-xyz', 'discord');

    // model should be a non-empty string (openrouter/auto or from env)
    expect(typeof agent.model).toBe('string');
    expect(agent.model.length).toBeGreaterThan(0);
  });
});

// ── buildSystemPrompt tests ───────────────────────────────────────────────────

describe('buildSystemPrompt', () => {
  const baseAgent: ResolvedAgent = {
    id: 'test',
    name: 'Hawk',
    model: 'openrouter/auto',
    maxTokens: 4096,
    temperature: 0.7,
    tier: 'orchestrator',
    systemPromptParts: {
      identity: null,
      knowledge: null,
      philosophy: null,
      customSystemPrompt: null,
      personality: { traits: [], tone: '', phrases: [] },
    },
    toolsEnabled: [],
    isUserFacing: true,
    spriteFolder: null,
    reactMode: 'auto',
    costTrackingEnabled: true,
    historyCompressionEnabled: true,
  };

  it('includes context section in output', () => {
    const prompt = buildSystemPrompt(baseAgent, 'CONTEXT: user data here');
    expect(prompt).toContain('CONTEXT: user data here');
  });

  it('uses customSystemPrompt as full override', () => {
    const agent = {
      ...baseAgent,
      systemPromptParts: { ...baseAgent.systemPromptParts, customSystemPrompt: 'CUSTOM PROMPT' },
    };
    const prompt = buildSystemPrompt(agent, 'ctx');
    expect(prompt).toContain('CUSTOM PROMPT');
    // Should not contain identity/personality section headers
    expect(prompt).not.toContain('## Tom e personalidade');
  });

  it('includes identity block when set', () => {
    const agent = {
      ...baseAgent,
      systemPromptParts: { ...baseAgent.systemPromptParts, identity: 'I am Hawk, your assistant.' },
    };
    const prompt = buildSystemPrompt(agent, '');
    expect(prompt).toContain('I am Hawk, your assistant.');
    expect(prompt).toContain('# Hawk');
  });

  it('includes personality section when traits are set', () => {
    const agent = {
      ...baseAgent,
      systemPromptParts: {
        ...baseAgent.systemPromptParts,
        personality: { traits: ['direct', 'concise'], tone: 'professional', phrases: [] },
      },
    };
    const prompt = buildSystemPrompt(agent, '');
    expect(prompt).toContain('## Tom e personalidade');
    expect(prompt).toContain('direct, concise');
    expect(prompt).toContain('professional');
  });
});

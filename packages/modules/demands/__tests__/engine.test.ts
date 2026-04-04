import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks (available before vi.mock factories) ───────────────

const {
  mockUnsafe,
  mockFrom,
  mockGetActiveDemands,
  mockGetReadySteps,
  mockListSteps,
  mockResolveDependencies,
  mockUpdateDemand,
  mockUpdateDemandProgress,
  mockUpdateStep,
  mockCreateLog,
  dbMockFactory,
} = vi.hoisted(() => {
  const mockUnsafe = vi.fn();
  const mockFrom = vi.fn();
  const dbMockFactory = () => ({
    db: { from: mockFrom },
    getPool: vi.fn(() => ({ unsafe: mockUnsafe })),
    closePool: vi.fn(),
    getCurrentSchema: vi.fn().mockReturnValue('public'),
    withSchema: vi.fn(),
    rawQuery: vi.fn(),
    validateSchemaName: vi.fn(),
    schemaStore: { getStore: vi.fn(), run: vi.fn() },
    tenantStore: { getStore: vi.fn(), run: vi.fn() },
    createTenantClient: vi.fn(),
    withTenantSchema: vi.fn(),
    postgres: vi.fn(),
  });
  return {
    mockUnsafe,
    mockFrom,
    mockGetActiveDemands: vi.fn(),
    mockGetReadySteps: vi.fn(),
    mockListSteps: vi.fn(),
    mockResolveDependencies: vi.fn(),
    mockUpdateDemand: vi.fn(),
    mockUpdateDemandProgress: vi.fn(),
    mockUpdateStep: vi.fn(),
    mockCreateLog: vi.fn(),
    dbMockFactory,
  };
});

// ── Module mocks ─────────────────────────────────────────────────────

vi.mock('@hawk/db', dbMockFactory);
vi.mock('../../../../packages/db/src/index.ts', dbMockFactory);
vi.mock('../../../../packages/db/src/sql.ts', dbMockFactory);

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'test result' } }],
        }),
      },
    },
  })),
}));

vi.mock('../queries', () => ({
  createLog: (...args: unknown[]) => mockCreateLog(...args),
  getActiveDemands: (...args: unknown[]) => mockGetActiveDemands(...args),
  getReadySteps: (...args: unknown[]) => mockGetReadySteps(...args),
  listSteps: (...args: unknown[]) => mockListSteps(...args),
  resolveDependencies: (...args: unknown[]) => mockResolveDependencies(...args),
  updateDemand: (...args: unknown[]) => mockUpdateDemand(...args),
  updateDemandProgress: (...args: unknown[]) => mockUpdateDemandProgress(...args),
  updateStep: (...args: unknown[]) => mockUpdateStep(...args),
}));

import { processDemandQueue } from '../engine';
import type { Demand, DemandStep } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────

function makeDemand(overrides: Partial<Demand> = {}): Demand {
  return {
    id: 'demand-1',
    title: 'Test demand',
    description: null,
    status: 'running',
    priority: 'medium',
    module: null,
    tags: [],
    progress: 0,
    total_steps: 2,
    completed_steps: 0,
    orchestrator_agent_id: null,
    objective_id: null,
    origin: 'chat',
    origin_session_id: null,
    origin_message: null,
    scheduled_at: null,
    deadline: null,
    started_at: null,
    completed_at: null,
    triage_result: {},
    execution_summary: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeStep(overrides: Partial<DemandStep> = {}): DemandStep {
  return {
    id: 'step-1',
    demand_id: 'demand-1',
    title: 'Test step',
    description: null,
    step_order: 1,
    execution_type: 'sequential',
    condition_rule: null,
    status: 'ready',
    assigned_agent_id: null,
    depends_on: [],
    tool_name: null,
    tool_args: {},
    result: null,
    result_metadata: {},
    error_message: null,
    retry_count: 0,
    max_retries: 3,
    started_at: null,
    completed_at: null,
    estimated_duration_minutes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('processDemandQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: stale recovery returns 0 rows
    mockUnsafe.mockResolvedValue([{ recovered: 0 }]);
    // Default: loadAgentInfo returns null (db.from mock)
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
  });

  it('processes only running demands, ignoring others', async () => {
    const running = makeDemand({ id: 'd-run', status: 'running' });
    const paused = makeDemand({ id: 'd-pause', status: 'paused' });
    const draft = makeDemand({ id: 'd-draft', status: 'draft' });

    mockGetActiveDemands.mockResolvedValue([running, paused, draft]);
    mockGetReadySteps.mockResolvedValue([]);
    mockListSteps.mockResolvedValue([]);

    await processDemandQueue();

    expect(mockGetReadySteps).toHaveBeenCalledTimes(1);
    expect(mockGetReadySteps).toHaveBeenCalledWith('d-run');
  });

  it('skips processing when no active demands', async () => {
    mockGetActiveDemands.mockResolvedValue([]);

    await processDemandQueue();

    expect(mockGetReadySteps).not.toHaveBeenCalled();
    expect(mockResolveDependencies).not.toHaveBeenCalled();
  });

  it('calls stale recovery before processing demands', async () => {
    mockGetActiveDemands.mockResolvedValue([]);

    await processDemandQueue();

    expect(mockUnsafe).toHaveBeenCalledWith('SELECT recover_stale_demand_steps() AS recovered');
    expect(mockGetActiveDemands).toHaveBeenCalledTimes(1);
  });

  it('handles stale recovery RPC not existing gracefully', async () => {
    mockUnsafe.mockRejectedValue(new Error('function recover_stale_demand_steps() does not exist'));
    mockGetActiveDemands.mockResolvedValue([]);

    // Should not throw
    await processDemandQueue();

    expect(mockGetActiveDemands).toHaveBeenCalledTimes(1);
  });

  it('executes a step with all dependencies completed', async () => {
    const demand = makeDemand();
    const step = makeStep({ depends_on: ['dep-1'] });

    mockGetActiveDemands.mockResolvedValue([demand]);
    mockGetReadySteps.mockResolvedValue([step]);
    mockUnsafe
      .mockResolvedValueOnce([{ recovered: 0 }]) // stale recovery
      .mockResolvedValueOnce([step]); // checkout
    mockListSteps.mockResolvedValue([
      makeStep({ id: 'dep-1', status: 'completed', result: 'dep result' }),
      makeStep({ id: 'step-1', status: 'running' }),
    ]);

    await processDemandQueue();

    // stale recovery + checkout = 2 calls
    expect(mockUnsafe).toHaveBeenCalledTimes(2);
    // createLog called for step start + completion
    expect(mockCreateLog).toHaveBeenCalled();
    // updateStep called to release the step (via releaseStep -> updateStep)
    expect(mockUpdateStep).toHaveBeenCalled();
  });

  it('sets checkpoint step to waiting_human', async () => {
    const demand = makeDemand();
    const step = makeStep({ execution_type: 'checkpoint' });

    mockGetActiveDemands.mockResolvedValue([demand]);
    mockGetReadySteps.mockResolvedValue([step]);
    mockUnsafe
      .mockResolvedValueOnce([{ recovered: 0 }]) // stale recovery
      .mockResolvedValueOnce([step]); // checkout
    mockListSteps.mockResolvedValue([makeStep({ id: 'step-1', status: 'waiting_human' })]);

    await processDemandQueue();

    expect(mockUpdateStep).toHaveBeenCalledWith('step-1', { status: 'waiting_human' });
    expect(mockCreateLog).toHaveBeenCalledWith(
      'demand-1',
      'step-1',
      expect.objectContaining({
        log_type: 'checkpoint',
      }),
    );
  });

  it('re-queues a failed step when retries remain', async () => {
    const demand = makeDemand();
    const step = makeStep({ retry_count: 1, max_retries: 3 });

    mockGetActiveDemands.mockResolvedValue([demand]);
    mockGetReadySteps.mockResolvedValue([step]);
    mockUnsafe
      .mockResolvedValueOnce([{ recovered: 0 }]) // stale recovery
      .mockResolvedValueOnce([step]); // checkout
    mockListSteps.mockRejectedValueOnce(new Error('LLM timeout')).mockResolvedValue([step]); // checkDemandCompletion

    await processDemandQueue();

    expect(mockUpdateStep).toHaveBeenCalledWith(
      'step-1',
      expect.objectContaining({
        status: 'ready',
        claimed_at: null,
        claimed_by: null,
      }),
    );
    expect(mockUpdateStep).toHaveBeenCalledWith('step-1', { retry_count: 2 });
    expect(mockCreateLog).toHaveBeenCalledWith(
      'demand-1',
      'step-1',
      expect.objectContaining({
        log_type: 'retry',
      }),
    );
  });

  it('marks step as failed when max_retries exceeded', async () => {
    const demand = makeDemand();
    const step = makeStep({ retry_count: 3, max_retries: 3 });

    mockGetActiveDemands.mockResolvedValue([demand]);
    mockGetReadySteps.mockResolvedValue([step]);
    mockUnsafe
      .mockResolvedValueOnce([{ recovered: 0 }]) // stale recovery
      .mockResolvedValueOnce([step]); // checkout
    mockListSteps
      .mockRejectedValueOnce(new Error('persistent failure'))
      .mockResolvedValue([makeStep({ status: 'failed' })]); // checkDemandCompletion

    await processDemandQueue();

    expect(mockUpdateStep).toHaveBeenCalledWith(
      'step-1',
      expect.objectContaining({
        status: 'failed',
        claimed_at: null,
        claimed_by: null,
      }),
    );
    expect(mockCreateLog).toHaveBeenCalledWith(
      'demand-1',
      'step-1',
      expect.objectContaining({
        log_type: 'error',
      }),
    );
  });

  it('marks demand as completed when all steps are done', async () => {
    const demand = makeDemand();

    mockGetActiveDemands.mockResolvedValue([demand]);
    mockGetReadySteps.mockResolvedValue([]); // no ready steps
    mockListSteps.mockResolvedValue([
      makeStep({ id: 's1', status: 'completed' }),
      makeStep({ id: 's2', status: 'completed' }),
    ]);

    await processDemandQueue();

    expect(mockUpdateDemand).toHaveBeenCalledWith(
      'demand-1',
      expect.objectContaining({
        status: 'completed',
        progress: 100,
      }),
    );
    expect(mockCreateLog).toHaveBeenCalledWith(
      'demand-1',
      null,
      expect.objectContaining({
        log_type: 'status_change',
        message: 'Demanda concluída com sucesso',
      }),
    );
  });
});

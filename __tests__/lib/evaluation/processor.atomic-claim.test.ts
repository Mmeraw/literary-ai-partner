export {};

/**
 * Tests for atomic job claiming: claimQueuedJobs(), processQueuedJobs(),
 * and the updated failStaleRunningJobs() + processEvaluationJob() eligibility.
 *
 * All tests use mocked Supabase client — no real DB required.
 */

const createClientMock = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

// Mock crypto so randomUUID returns deterministic values in tests
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'test-worker-uuid'),
}));

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function makeJob(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'job-1',
    manuscript_id: 42,
    job_type: 'full_evaluation',
    status: 'queued',
    phase: 'phase_1',
    phase_status: 'queued',
    progress: { phase: 'phase_1', phase_status: 'queued' },
    created_at: new Date().toISOString(),
    claimed_by: null,
    claimed_at: null,
    lease_expires_at: null,
    ...overrides,
  };
}

function buildSupabaseStub(opts: {
  rpcResult?: { data: unknown; error: null | { message: string } };
  jobData?: Record<string, unknown> | null;
  updateError?: { message: string } | null;
  selectError?: { message: string } | null;
} = {}): unknown {
  const rpcResult = opts.rpcResult ?? { data: [], error: null };
  const updateChain = {
    eq: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    select: jest.fn().mockResolvedValue({ data: [], error: opts.updateError ?? null }),
  };

  return {
    rpc: jest.fn().mockResolvedValue(rpcResult),
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: opts.jobData !== undefined ? [opts.jobData].filter(Boolean) : [],
          error: opts.selectError ?? null,
        }),
        single: jest.fn().mockResolvedValue({
          data: opts.jobData ?? null,
          error: opts.jobData ? null : { message: 'not found' },
        }),
      }),
      update: jest.fn().mockReturnValue(updateChain),
    }),
  };
}

// ─────────────────────────────────────────────────────────────────
// claimQueuedJobs
// ─────────────────────────────────────────────────────────────────

describe('claimQueuedJobs', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.EVAL_PASS_TIMEOUT_MS = '180000';
    process.env.EVAL_OPENAI_TIMEOUT_MS = '180000';
    process.env.EVAL_EXTERNAL_ADJUDICATION_MODE = 'optional';
  });

  test('calls claim_evaluation_jobs RPC with correct parameters', async () => {
    const claimedJob = {
      id: 'job-claimed-1',
      phase: 'phase_1',
      phase_status: 'running',
      claimed_by: 'worker-abc',
      claimed_at: new Date().toISOString(),
      lease_expires_at: new Date(Date.now() + 180_000).toISOString(),
    };
    const stub = buildSupabaseStub({ rpcResult: { data: [claimedJob], error: null } }) as any;
    createClientMock.mockReturnValue(stub);

    const { claimQueuedJobs } = await import('../../../lib/evaluation/processor');
    const result = await claimQueuedJobs({ workerId: 'worker-abc' });

    expect(stub.rpc).toHaveBeenCalledWith('claim_evaluation_jobs', {
      p_batch_size: expect.any(Number),
      p_worker_id: 'worker-abc',
      p_lease_token: expect.any(String),
      p_lease_expires_at: expect.any(String),
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('job-claimed-1');
    expect(result[0].phase).toBe('phase_1');
  });

  test('returns empty array when RPC returns no rows', async () => {
    const stub = buildSupabaseStub({ rpcResult: { data: [], error: null } }) as any;
    createClientMock.mockReturnValue(stub);

    const { claimQueuedJobs } = await import('../../../lib/evaluation/processor');
    const result = await claimQueuedJobs({ workerId: 'worker-abc' });

    expect(result).toHaveLength(0);
  });

  test('returns empty array (graceful degradation) when RPC function does not exist', async () => {
    const stub = buildSupabaseStub({
      rpcResult: { data: null, error: { message: 'function claim_evaluation_jobs does not exist' } },
    }) as any;
    createClientMock.mockReturnValue(stub);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { claimQueuedJobs } = await import('../../../lib/evaluation/processor');
    const result = await claimQueuedJobs({ workerId: 'worker-abc' });

    expect(result).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('RPC unavailable'));
    warnSpy.mockRestore();
  });

  test('throws on unexpected RPC errors', async () => {
    const stub = buildSupabaseStub({
      rpcResult: { data: null, error: { message: 'connection refused' } },
    }) as any;
    createClientMock.mockReturnValue(stub);

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { claimQueuedJobs } = await import('../../../lib/evaluation/processor');

    await expect(claimQueuedJobs({ workerId: 'worker-abc' })).rejects.toMatchObject({
      message: 'connection refused',
    });
    errorSpy.mockRestore();
  });

  test('parallel claim calls can return disjoint IDs across workers', async () => {
    const rpc = jest
      .fn()
      .mockImplementation((_fn: string, params: { p_worker_id: string }) => {
        if (params.p_worker_id === 'worker-a') {
          return Promise.resolve({
            data: [{ id: 'a1', phase: 'phase_1' }, { id: 'a2', phase: 'phase_2' }],
            error: null,
          });
        }
        return Promise.resolve({
          data: [{ id: 'b1', phase: 'phase_1' }, { id: 'b2', phase: 'phase_2' }],
          error: null,
        });
      });
    createClientMock.mockReturnValue({ rpc, from: jest.fn() } as any);

    const { claimQueuedJobs } = await import('../../../lib/evaluation/processor');
    const [a, b] = await Promise.all([
      claimQueuedJobs({ workerId: 'worker-a' }),
      claimQueuedJobs({ workerId: 'worker-b' }),
    ]);

    const aIds = new Set(a.map((row) => row.id));
    const overlap = b.map((row) => row.id).filter((id) => aIds.has(id));
    expect(overlap).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// processQueuedJobs — uses claimQueuedJobs internally
// ─────────────────────────────────────────────────────────────────

describe('processQueuedJobs — atomic claim path', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.EVAL_PASS_TIMEOUT_MS = '180000';
    process.env.EVAL_OPENAI_TIMEOUT_MS = '180000';
    process.env.EVAL_EXTERNAL_ADJUDICATION_MODE = 'optional';
  });

  test('returns claimed count equal to jobs claimed by RPC', async () => {
    const claimedRows = [
      { id: 'j1', phase: 'phase_1', phase_status: 'running', claimed_by: 'w', claimed_at: '', lease_expires_at: '' },
      { id: 'j2', phase: 'phase_1', phase_status: 'running', claimed_by: 'w', claimed_at: '', lease_expires_at: '' },
    ];

    // The claimed job fetched inside processEvaluationJob (pre-claimed running job)
    const preClaimedJob = makeJob({
      id: 'j1',
      status: 'running',
      phase: 'phase_1',
      phase_status: 'running',
      claimed_by: 'w',
    });

    const stub = {
      rpc: jest.fn().mockResolvedValue({ data: claimedRows, error: null }),
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          single: jest.fn().mockResolvedValue({ data: preClaimedJob, error: null }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          select: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    };

    createClientMock.mockReturnValue(stub);

    // Mock dependencies to avoid actually running the pipeline
    jest.mock('../../../lib/evaluation/pipeline/runPipeline', () => ({
      runPipeline: jest.fn().mockResolvedValue({ ok: false, error: 'mocked pipeline' }),
      synthesisToEvaluationResult: jest.fn(),
    }), { virtual: true });

    const { processQueuedJobs } = await import('../../../lib/evaluation/processor');
    const result = await processQueuedJobs({ workerId: 'worker-xyz' });

    expect(result.claimed).toBe(2);
    expect(result.processed).toBe(2);
  });

  test('returns zero claimed when RPC returns no jobs', async () => {
    const stub = {
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          select: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    };

    createClientMock.mockReturnValue(stub);

    const { processQueuedJobs } = await import('../../../lib/evaluation/processor');
    const result = await processQueuedJobs({ workerId: 'worker-xyz' });

    expect(result.claimed).toBe(0);
    expect(result.processed).toBe(0);
  });

  test('uses auto-generated workerId when none provided', async () => {
    const stub = {
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          select: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    };

    createClientMock.mockReturnValue(stub);

    const { processQueuedJobs } = await import('../../../lib/evaluation/processor');
    // Call without workerId — should not throw
    const result = await processQueuedJobs();

    expect(result.claimed).toBe(0);
    // RPC must still have been called (with the auto-generated workerId)
    expect(stub.rpc).toHaveBeenCalledWith('claim_evaluation_jobs', expect.objectContaining({
      p_worker_id: expect.any(String),
    }));
  });

  test('enforces bounded batch size guard (1..5) at process entry', async () => {
    const stub = {
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          select: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    };

    createClientMock.mockReturnValue(stub as any);

    const { processQueuedJobs } = await import('../../../lib/evaluation/processor');
    await processQueuedJobs({ workerId: 'worker-xyz', batchSize: 999 });

    expect(stub.rpc).toHaveBeenCalledWith(
      'claim_evaluation_jobs',
      expect.objectContaining({ p_batch_size: 5 }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────
// processEvaluationJob — pre-claimed (running) job eligibility
// ─────────────────────────────────────────────────────────────────

describe('processEvaluationJob — pre-claimed running job eligibility', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.EVAL_PASS_TIMEOUT_MS = '180000';
    process.env.EVAL_OPENAI_TIMEOUT_MS = '180000';
    process.env.EVAL_EXTERNAL_ADJUDICATION_MODE = 'optional';
  });

  function makeStubForJob(job: Record<string, unknown>): unknown {
    return {
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: job, error: null }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          error: null,
        }),
      }),
    };
  }

  test('accepts pre-claimed phase_1 running job (claimed_by set)', async () => {
    const preClaimedJob = makeJob({
      status: 'running',
      phase: 'phase_1',
      phase_status: 'running',
      claimed_by: 'worker-abc',
      progress: { phase: 'phase_1', phase_status: 'running' },
    });

    const stub = {
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: preClaimedJob, error: null }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          error: null,
        }),
      }),
    };
    createClientMock.mockReturnValue(stub);

    const { processEvaluationJob } = await import('../../../lib/evaluation/processor');
    const result = await processEvaluationJob('job-1');

    // Should NOT reject as ineligible; may fail for other reasons (manuscript not found, etc.)
    expect(result.error).not.toContain('Job not eligible for processing');
  });

  test('accepts pre-claimed phase_2 running job (claimed_by set)', async () => {
    const preClaimedJob = makeJob({
      status: 'running',
      phase: 'phase_2',
      phase_status: 'running',
      claimed_by: 'worker-abc',
      progress: { phase: 'phase_2', phase_status: 'running' },
    });

    const stub = {
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: preClaimedJob, error: null }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          error: null,
        }),
      }),
    };
    createClientMock.mockReturnValue(stub);

    const { processEvaluationJob } = await import('../../../lib/evaluation/processor');
    const result = await processEvaluationJob('job-1');

    expect(result.error).not.toContain('Job not eligible for processing');
  });

  test('rejects running job without claimed_by (not atomically claimed)', async () => {
    const unclaimedRunning = makeJob({
      status: 'running',
      phase: 'phase_1',
      phase_status: 'running',
      claimed_by: null, // NOT claimed by processor — ineligible
      progress: { phase: 'phase_1', phase_status: 'running' },
    });

    createClientMock.mockReturnValue(makeStubForJob(unclaimedRunning));

    const { processEvaluationJob } = await import('../../../lib/evaluation/processor');
    const result = await processEvaluationJob('job-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Job not eligible for processing');
  });
});

// ─────────────────────────────────────────────────────────────────
// failStaleRunningJobs — expired lease recovery
// ─────────────────────────────────────────────────────────────────

describe('failStaleRunningJobs — expired lease recovery', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.EVAL_PASS_TIMEOUT_MS = '180000';
    process.env.EVAL_OPENAI_TIMEOUT_MS = '180000';
  });

  test('auto-fails jobs with expired lease_expires_at', async () => {
    const expiredLeaseJob = { id: 'expired-job' };

    // First select (by age cutoff) returns nothing; second select (by lease) returns the expired job
    let selectCallCount = 0;
    const updateSelectMock = jest.fn().mockResolvedValue({ data: [expiredLeaseJob], error: null });

    const stub = {
      rpc: jest.fn(),
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          lt: jest.fn().mockImplementation(() => ({
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockImplementation(() => {
              selectCallCount++;
              // First call: age-based (returns empty); second call: lease-based (returns expired)
              return Promise.resolve({
                data: selectCallCount === 1 ? [] : [expiredLeaseJob],
                error: null,
              });
            }),
          })),
        }),
        update: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: updateSelectMock,
        }),
      }),
    };

    createClientMock.mockReturnValue(stub);

    const { failStaleRunningJobs } = await import('../../../lib/evaluation/processor');
    const result = await failStaleRunningJobs();

    expect(result.staleFound).toBeGreaterThanOrEqual(1);
  });

  test('clears claimed_by and lease_expires_at when failing stale jobs', async () => {
    const staleJob = { id: 'stale-job' };

    const updateMock = jest.fn().mockReturnValue({
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue({ data: [staleJob], error: null }),
    });

    const stub = {
      rpc: jest.fn(),
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({ data: [staleJob], error: null }),
          }),
        }),
        update: updateMock,
      }),
    };

    createClientMock.mockReturnValue(stub);

    const { failStaleRunningJobs } = await import('../../../lib/evaluation/processor');
    await failStaleRunningJobs();

    const updatePayload = updateMock.mock.calls[0]?.[0];
    expect(updatePayload).toMatchObject({
      status: 'failed',
      claimed_by: null,
      claimed_at: null,
      lease_expires_at: null,
    });
  });
});

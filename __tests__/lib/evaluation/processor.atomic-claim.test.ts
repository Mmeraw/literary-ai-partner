export {};

/**
 * Tests for atomic job claiming: claimQueuedJobs(), processQueuedJobs(),
 * and the updated failStaleRunningJobs() + processEvaluationJob() eligibility.
 *
 * All tests use mocked Supabase client — no real DB required.
 */

const createClientMock = jest.fn();
const mockSendEvaluationFailureSupportAlert = jest.fn(async () => ({ attempted: true, sent: true }));
const mockSendEvaluationMajorIssueUserAlert = jest.fn(async () => ({ attempted: true, sent: true }));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

jest.mock('@/lib/evaluation/recoverySupportAlertMailer', () => ({
  MAJOR_TECHNICAL_ISSUE_PUBLIC_MESSAGE:
    'We hit a technical issue that needs engineering support. Our team has been alerted and is investigating. Your writing and completed analysis have been preserved; you do not need to retry. We will notify you by email when the problem has been fixed.',
  sendEvaluationFailureSupportAlert: (...args: unknown[]) => mockSendEvaluationFailureSupportAlert(...args),
  sendEvaluationMajorIssueUserAlert: (...args: unknown[]) => mockSendEvaluationMajorIssueUserAlert(...args),
  sendRecoverySupportAlert: jest.fn(async () => ({ attempted: true, sent: true })),
  shouldAlertSupportForRecoveryAction: jest.fn((action: string | null | undefined) => (
    action === 'repair_to_expected_handoff'
      || action === 'sync_progress_to_job_state'
      || action === 'halt_for_engineering_review'
  )),
  toUserSafeRecoveryMessage: jest.fn((message: string | null | undefined) => message ?? 'safe recovery message'),
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
    phase: 'phase_1a',
    phase_status: 'queued',
    progress: { phase: 'phase_1a', phase_status: 'queued' },
    created_at: new Date().toISOString(),
    claimed_by: null,
    claimed_at: null,
    lease_token: null,
    lease_expires_at: null,
    ...overrides,
  };
}

function makeClaimedRpcRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    manuscript_id: 42,
    phase: 'phase_1a',
    status: 'running',
    phase_status: 'running',
    claimed_by: 'worker-abc',
    claimed_at: new Date().toISOString(),
    lease_token: '22222222-2222-4222-8222-222222222222',
    lease_expires_at: new Date(Date.now() + 180_000).toISOString(),
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
    const claimedJob = makeClaimedRpcRow();
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
    expect(result[0].id).toBe('11111111-1111-4111-8111-111111111111');
    expect(result[0].phase).toBe('phase_1a');
  });

  test('returns empty array when RPC returns no rows', async () => {
    const stub = buildSupabaseStub({ rpcResult: { data: [], error: null } }) as any;
    createClientMock.mockReturnValue(stub);

    const { claimQueuedJobs } = await import('../../../lib/evaluation/processor');
    const result = await claimQueuedJobs({ workerId: 'worker-abc' });

    expect(result).toHaveLength(0);
  });

  test('throws when RPC function does not exist (fail-closed)', async () => {
    const stub = buildSupabaseStub({
      rpcResult: { data: null, error: { message: 'function claim_evaluation_jobs does not exist' } },
    }) as any;
    createClientMock.mockReturnValue(stub);

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { claimQueuedJobs } = await import('../../../lib/evaluation/processor');

    await expect(claimQueuedJobs({ workerId: 'worker-abc' })).rejects.toMatchObject({
      message: expect.stringContaining('function claim_evaluation_jobs does not exist'),
    });
    errorSpy.mockRestore();
  });

  test('throws on unexpected RPC errors', async () => {
    const stub = buildSupabaseStub({
      rpcResult: { data: null, error: { message: 'connection refused' } },
    }) as any;
    createClientMock.mockReturnValue(stub);

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { claimQueuedJobs } = await import('../../../lib/evaluation/processor');

    await expect(claimQueuedJobs({ workerId: 'worker-abc' })).rejects.toMatchObject({
      message: expect.stringContaining('connection refused'),
    });
    errorSpy.mockRestore();
  });

  test('parallel claim calls can return disjoint IDs across workers', async () => {
    const rpc = jest
      .fn()
      .mockImplementation((_fn: string, params: { p_worker_id: string }) => {
        if (params.p_worker_id === 'worker-a') {
          return Promise.resolve({
            data: [
              makeClaimedRpcRow({
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
                phase: 'phase_1a',
                lease_token: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
                claimed_by: 'worker-a',
              }),
              makeClaimedRpcRow({
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
                phase: 'phase_2',
                lease_token: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
                claimed_by: 'worker-a',
              }),
            ],
            error: null,
          });
        }
        return Promise.resolve({
          data: [
            makeClaimedRpcRow({
              id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
              phase: 'phase_1a',
              lease_token: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
              claimed_by: 'worker-b',
            }),
            makeClaimedRpcRow({
              id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
              phase: 'phase_2',
              lease_token: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
              claimed_by: 'worker-b',
            }),
          ],
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
      makeClaimedRpcRow({
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
        claimed_by: 'w',
        lease_token: 'ffffffff-ffff-4fff-8fff-fffffffffff1',
      }),
      makeClaimedRpcRow({
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
        claimed_by: 'w',
        lease_token: 'ffffffff-ffff-4fff-8fff-fffffffffff2',
      }),
    ];

    // The claimed job fetched inside processEvaluationJob (pre-claimed running job)
    const preClaimedJob = makeJob({
      id: 'j1',
      status: 'running',
      phase: 'phase_1a',
      phase_status: 'running',
      claimed_by: 'w',
      lease_token: 'ffffffff-ffff-4fff-8fff-fffffffffff3',
      lease_expires_at: new Date(Date.now() + 180_000).toISOString(),
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

  test('accepts pre-claimed phase_1 running job with canonical lease ownership', async () => {
    const preClaimedJob = makeJob({
      status: 'running',
      phase: 'phase_1a',
      phase_status: 'running',
      claimed_by: 'worker-abc',
      lease_token: '22222222-2222-4222-8222-222222222222',
      lease_expires_at: new Date(Date.now() + 180_000).toISOString(),
      progress: { phase: 'phase_1a', phase_status: 'running' },
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

  test('accepts pre-claimed phase_2 running job with canonical lease ownership', async () => {
    const preClaimedJob = makeJob({
      status: 'running',
      phase: 'phase_2',
      phase_status: 'running',
      claimed_by: 'worker-abc',
      lease_token: '33333333-3333-4333-8333-333333333333',
      lease_expires_at: new Date(Date.now() + 180_000).toISOString(),
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

  test('rejects running job without canonical ownership (not atomically claimed)', async () => {
    const unclaimedRunning = makeJob({
      status: 'running',
      phase: 'phase_1a',
      phase_status: 'running',
      claimed_by: null, // NOT claimed by processor — ineligible
      progress: { phase: 'phase_1a', phase_status: 'running' },
    });

    createClientMock.mockReturnValue(makeStubForJob(unclaimedRunning));

    const { processEvaluationJob } = await import('../../../lib/evaluation/processor');
    const result = await processEvaluationJob('job-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Job not eligible for processing');
  });

  test('rejects running job with expired lease despite ownership fields', async () => {
    const expiredLeaseJob = makeJob({
      status: 'running',
      phase: 'phase_1a',
      phase_status: 'running',
      claimed_by: 'worker-abc',
      lease_token: '44444444-4444-4444-8444-444444444444',
      lease_expires_at: new Date(Date.now() - 60_000).toISOString(),
      progress: { phase: 'phase_1a', phase_status: 'running' },
    });

    createClientMock.mockReturnValue(makeStubForJob(expiredLeaseJob));

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

  test('clears claimant fields and sets phase_status=failed when failing stale jobs', async () => {
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
      phase_status: 'failed',
      claimed_by: null,
      claimed_at: null,
      lease_token: null,
    });
    // Production path (lease_until exists): payload must clear lease_until
    expect(updatePayload).toHaveProperty('lease_until', null);
  });

  test('clears lease_until (not lease_expires_at) when lease_until column exists (production path)', async () => {
    const staleJob = { id: 'stale-lease-job' };

    const updateChain: Record<string, jest.Mock> = {};
    Object.assign(updateChain, {
      in: jest.fn(() => updateChain),
      eq: jest.fn(() => updateChain),
      neq: jest.fn(() => updateChain),
      select: jest.fn().mockResolvedValue({ data: [staleJob], error: null }),
    });
    const updateMock = jest.fn().mockReturnValue(updateChain);

    // Both selects succeed (age returns empty, lease_until returns expired job)
    // — this means lease_until column exists (leaseScanUsedLegacyColumn = false)
    let limitCallCount = 0;
    const queryChain: Record<string, jest.Mock> = {};
    Object.assign(queryChain, {
      eq: jest.fn(() => queryChain),
      neq: jest.fn(() => queryChain),
      not: jest.fn(() => queryChain),
      in: jest.fn(() => queryChain),
      lt: jest.fn(() => queryChain),
      order: jest.fn(() => queryChain),
      limit: jest.fn(() => {
        limitCallCount++;
        // 1: frozen watchdog (empty), 2: age-based (empty), 3: lease_until scan (found stale)
        return Promise.resolve({
          data: limitCallCount <= 2 ? [] : [staleJob],
          error: null,
        });
      }),
    });

    const stub = {
      rpc: jest.fn(),
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue(queryChain),
        update: updateMock,
      }),
    };

    createClientMock.mockReturnValue(stub);

    const { failStaleRunningJobs } = await import('../../../lib/evaluation/processor');
    await failStaleRunningJobs();

    const updatePayload = updateMock.mock.calls[0]?.[0];
    // Production path: lease_until exists and must be cleared
    expect(updatePayload).toHaveProperty('lease_until', null);
    expect(updatePayload).toHaveProperty('lease_token', null);
    // lease_expires_at should NOT be in the payload (it's either generated or handled separately)
    expect(updatePayload).not.toHaveProperty('lease_expires_at');
  });

  test('clears lease_expires_at (not lease_until) when falling back to legacy schema', async () => {
    const staleJob = { id: 'legacy-stale-job' };

    const updateChain: Record<string, jest.Mock> = {};
    Object.assign(updateChain, {
      in: jest.fn(() => updateChain),
      eq: jest.fn(() => updateChain),
      neq: jest.fn(() => updateChain),
      select: jest.fn().mockResolvedValue({ data: [staleJob], error: null }),
    });
    const updateMock = jest.fn().mockReturnValue(updateChain);

    // Frozen watchdog → empty, age-based → empty, lease_until scan → missing column,
    // lease_expires_at fallback → found stale job
    let limitCallCount = 0;
    const queryChain: Record<string, jest.Mock> = {};
    Object.assign(queryChain, {
      eq: jest.fn(() => queryChain),
      neq: jest.fn(() => queryChain),
      not: jest.fn(() => queryChain),
      in: jest.fn(() => queryChain),
      lt: jest.fn(() => queryChain),
      order: jest.fn(() => queryChain),
      limit: jest.fn(() => {
        limitCallCount++;
        if (limitCallCount <= 2) {
          // 1: frozen watchdog (empty), 2: age-based (empty)
          return Promise.resolve({ data: [], error: null });
        }
        if (limitCallCount === 3) {
          // 3: lease_until scan → column missing
          return Promise.resolve({
            data: null,
            error: { message: 'column evaluation_jobs.lease_until does not exist', code: '42703' },
          });
        }
        // 4: lease_expires_at fallback → found stale job
        return Promise.resolve({ data: [staleJob], error: null });
      }),
    });

    const stub = {
      rpc: jest.fn(),
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue(queryChain),
        update: updateMock,
      }),
    };

    createClientMock.mockReturnValue(stub);

    const { failStaleRunningJobs } = await import('../../../lib/evaluation/processor');
    await failStaleRunningJobs();

    const updatePayload = updateMock.mock.calls[0]?.[0];
    // Legacy path: lease_expires_at must be cleared
    expect(updatePayload).toHaveProperty('lease_expires_at', null);
    expect(updatePayload).toHaveProperty('lease_token', null);
    // lease_until should NOT be in the payload (column doesn't exist)
    expect(updatePayload).not.toHaveProperty('lease_until');
  });
});

describe('processEvaluationJob — started_at sanitization', () => {
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

  test('does not persist out-of-range historical started_at values', async () => {
    const createdAt = new Date().toISOString();
    const jobRow = makeJob({
      status: 'running',
      phase: 'phase_1a',
      phase_status: 'running',
      created_at: createdAt,
      started_at: '1970-01-01T00:00:00.000Z',
      claimed_by: 'worker-abc',
      lease_token: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      lease_expires_at: new Date(Date.now() + 180_000).toISOString(),
      progress: { phase: 'phase_1a', phase_status: 'running' },
    });

    const updateMock = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    });

    createClientMock.mockReturnValue({
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'evaluation_jobs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: jobRow, error: null }),
            }),
            update: updateMock,
          };
        }

        if (table === 'manuscripts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
            }),
          };
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
            order: jest.fn().mockReturnThis(),
          }),
          update: updateMock,
        };
      }),
    } as any);

    const { processEvaluationJob } = await import('../../../lib/evaluation/processor');
    await processEvaluationJob('job-1');

    const runningPayload = updateMock.mock.calls[0]?.[0];
    expect(runningPayload?.started_at).not.toBe('1970-01-01T00:00:00.000Z');
    const runningUpdateEq = updateMock.mock.results[0]?.value?.eq as jest.Mock;
    expect(runningUpdateEq).toHaveBeenCalledWith('id', 'job-1');
    expect(runningUpdateEq).toHaveBeenCalledWith('status', 'running');
    expect(runningUpdateEq).toHaveBeenCalledWith('claimed_by', 'worker-abc');
    expect(runningUpdateEq).toHaveBeenCalledWith('lease_token', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });

  test('treats terminal-state running update rejection as lease loss, not uncaught processor failure', async () => {
    const createdAt = new Date().toISOString();
    const jobRow = makeJob({
      status: 'running',
      phase: 'phase_3',
      phase_status: 'running',
      created_at: createdAt,
      started_at: createdAt,
      claimed_by: 'worker-abc',
      lease_token: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      lease_expires_at: new Date(Date.now() + 180_000).toISOString(),
      progress: { phase: 'phase_3', phase_status: 'running' },
    });

    const updateMock = jest.fn().mockReturnValue({
      error: {
        message: 'CRITICAL_QUEUE_ERROR: Terminal phase_status failed can only be reset to queued by an explicit operator retry, not running.',
      },
      eq: jest.fn().mockReturnThis(),
    });

    createClientMock.mockReturnValue({
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'evaluation_jobs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: jobRow, error: null }),
            }),
            update: updateMock,
          };
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
            order: jest.fn().mockReturnThis(),
          }),
          update: updateMock,
        };
      }),
    } as any);

    const { processEvaluationJob } = await import('../../../lib/evaluation/processor');
    const result = await processEvaluationJob('job-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Processor lease ownership changed');
    expect(result.error).not.toContain('PROCESSOR_UNCAUGHT_ERROR');
  });
});

describe('selfRecoverRetryableFailedJobs', () => {
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

  function buildSelfRecoveryStub(
    rows: Array<Record<string, unknown>>,
    artifacts: Array<Record<string, unknown>> = [],
  ) {
    const updateMock = jest.fn(() => ({
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(async () => ({ data: { id: 'updated-row' }, error: null })),
    }));

    const jobsSelectChain = {
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn(async () => ({ data: rows, error: null })),
    };

    const artifactsSelectChain = {
      eq: jest.fn().mockReturnThis(),
      order: jest.fn(async () => ({ data: artifacts, error: null })),
    };

    const stub = {
      updateMock,
      jobsSelectChain,
      artifactsSelectChain,
      auth: {
        admin: {
          getUserById: jest.fn(async () => ({ data: { user: { email: 'writer@example.com' } }, error: null })),
        },
      },
      from: jest.fn((table: string) => {
        if (table === 'evaluation_jobs') {
          return {
            select: jest.fn(() => jobsSelectChain),
            update: updateMock,
          };
        }

        if (table === 'evaluation_artifacts') {
          return {
            select: jest.fn(() => artifactsSelectChain),
          };
        }

        if (table === 'manuscripts') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn(async () => ({ data: { user_id: 'user-1' }, error: null })),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    return stub;
  }

  test('requeues recoverable failed jobs from last verified checkpoint without author action', async () => {
    const stub = buildSelfRecoveryStub(
      [
        makeJob({
          id: 'recoverable-job',
          status: 'failed',
          phase: 'phase_3',
          phase_status: 'failed',
          failure_code: 'PROCESSOR_UNCAUGHT_ERROR',
          progress: { phase: 'phase_3', phase_status: 'failed', self_recovery_count: 1 },
        }),
      ],
      [
        {
          id: 'handoff-1',
          artifact_type: 'pass12_handoff_v1',
          content: { schema_valid: true, semantic_status: 'valid', is_resume_safe: true },
          source_hash: 'hash-1',
          created_at: '2026-06-07T01:00:00.000Z',
        },
      ],
    );
    createClientMock.mockReturnValue(stub as never);

    const { selfRecoverRetryableFailedJobs, maxSelfRecoveryAttemptsForFailureCode } = await import('../../../lib/evaluation/processor');
    const result = await selfRecoverRetryableFailedJobs({ targetJobId: 'recoverable-job' });

    expect(maxSelfRecoveryAttemptsForFailureCode('PROCESSOR_UNCAUGHT_ERROR')).toBe(2);
    expect(result.recovered).toBe(1);
    expect(result.ids).toEqual(['recoverable-job']);
    const updatePayload = stub.updateMock.mock.calls[0]?.[0];
    expect(updatePayload).toEqual(expect.objectContaining({
      status: 'queued',
      phase: 'phase_3',
      phase_status: 'queued',
      last_error: null,
      failure_code: null,
      failure_envelope: null,
      claimed_by: null,
      lease_token: null,
    }));
    expect(updatePayload.progress).toEqual(expect.objectContaining({
      phase: 'phase_3',
      phase_status: 'queued',
      self_recovery_count: 2,
      self_recovery_source: 'worker_auto_recovery',
      self_recovery_failure_code: 'PROCESSOR_UNCAUGHT_ERROR',
      self_recovery_max_attempts: 2,
      self_recovery_resume_mode: 'checklist_resume_safe',
      self_recovery_checkpoint_artifact_type: 'pass12_handoff_v1',
      dashboard_status: 'recovery_in_progress',
    }));
  });

  test('stops self-recovery after failure-specific cap and marks technical review required', async () => {
    const stub = buildSelfRecoveryStub([
      makeJob({
        id: 'exhausted-job',
        status: 'failed',
        manuscript_id: 123,
        phase: 'phase_3',
        phase_status: 'failed',
        failure_code: 'PROCESSOR_UNCAUGHT_ERROR',
        progress: { phase: 'phase_3', phase_status: 'failed', self_recovery_count: 2 },
      }),
    ]);
    createClientMock.mockReturnValue(stub as never);

    const { selfRecoverRetryableFailedJobs } = await import('../../../lib/evaluation/processor');
    const result = await selfRecoverRetryableFailedJobs({ targetJobId: 'exhausted-job' });

    expect(result.recovered).toBe(0);
    expect(result.exhausted).toBe(1);
    const updatePayload = stub.updateMock.mock.calls[0]?.[0];
    expect(updatePayload).toEqual(expect.objectContaining({
      failure_code: 'TECHNICAL_FAILURE_REQUIRES_REVIEW',
      last_error: 'Self-recovery exhausted for PROCESSOR_UNCAUGHT_ERROR',
    }));
    expect(updatePayload.progress).toEqual(expect.objectContaining({
      self_recovery_exhausted_reason: 'PROCESSOR_UNCAUGHT_ERROR',
      dashboard_status: 'technical_review_required',
      recovery_message: expect.stringContaining('engineering support'),
    }));
    expect(mockSendEvaluationFailureSupportAlert).toHaveBeenCalledWith(expect.objectContaining({
      job_id: 'exhausted-job',
      failure_code: 'TECHNICAL_FAILURE_REQUIRES_REVIEW',
      failure_message: 'Self-recovery exhausted for PROCESSOR_UNCAUGHT_ERROR',
      source: 'worker_auto_recovery_exhausted',
      retry_eligible: false,
    }));
    expect(mockSendEvaluationMajorIssueUserAlert).toHaveBeenCalledWith({
      job_id: 'exhausted-job',
      manuscript_id: 123,
      user_email: 'writer@example.com',
    });
  });

  test('does not self-recover user-cancelled jobs', async () => {
    const stub = buildSelfRecoveryStub([
      makeJob({
        id: 'cancelled-job',
        status: 'failed',
        phase: 'phase_3',
        phase_status: 'failed',
        failure_code: 'USER_CANCELLED',
        progress: { cancelled_by_user: true },
      }),
    ]);
    createClientMock.mockReturnValue(stub as never);

    const { selfRecoverRetryableFailedJobs, isTerminalFailureCode } = await import('../../../lib/evaluation/processor');
    const result = await selfRecoverRetryableFailedJobs({ targetJobId: 'cancelled-job' });

    expect(isTerminalFailureCode('USER_CANCELLED')).toBe(true);
    expect(result.recovered).toBe(0);
    expect(result.skippedTerminal).toBe(1);
    expect(stub.updateMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────
// regression: lease ceiling must be 800_000, not 600_000
// ─────────────────────────────────────────────────────────────────

describe('regression: lease clamp ceiling', () => {
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

  test('claimQueuedJobs passes lease_expires_at >= 13 minutes from now when leaseMs=800000', async () => {
    // Regression: previous code had Math.min(600_000, ...) which silently clamped
    // the lease to 10 minutes regardless of the configured value.  This caused the
    // stale-running reaper to fire at 10 minutes and kill legitimate large-manuscript
    // evaluations that were still running under Vercel's 800s function ceiling.
    const stub = buildSupabaseStub({
      rpcResult: { data: [makeClaimedRpcRow()], error: null },
    }) as any;
    createClientMock.mockReturnValue(stub);

    const before = Date.now();
    const { claimQueuedJobs } = await import('../../../lib/evaluation/processor');
    await claimQueuedJobs({ workerId: 'worker-lease-test', leaseMs: 800_000 });

    const rpcCall = stub.rpc.mock.calls[0];
    expect(rpcCall[0]).toBe('claim_evaluation_jobs');

    const leaseExpiresAt: string = rpcCall[1].p_lease_expires_at;
    const leaseExpiresMs = new Date(leaseExpiresAt).getTime();

    // Must be at least 13 minutes (780s) from now — not clamped to 600s/10min.
    const minExpectedMs = before + 780_000;
    expect(leaseExpiresMs).toBeGreaterThanOrEqual(minExpectedMs);
  });

  test('claimQueuedJobs default leaseMs is 800_000 (not 600_000)', async () => {
    // When called without explicit leaseMs, the default must be 800_000.
    const stub = buildSupabaseStub({
      rpcResult: { data: [makeClaimedRpcRow()], error: null },
    }) as any;
    createClientMock.mockReturnValue(stub);

    const before = Date.now();
    const { claimQueuedJobs } = await import('../../../lib/evaluation/processor');
    await claimQueuedJobs({ workerId: 'worker-default-lease' }); // no leaseMs passed

    const rpcCall = stub.rpc.mock.calls[0];
    const leaseExpiresAt: string = rpcCall[1].p_lease_expires_at;
    const leaseExpiresMs = new Date(leaseExpiresAt).getTime();

    // Default should give ~800s lease — at least 780s to account for test execution time.
    const minExpectedMs = before + 780_000;
    expect(leaseExpiresMs).toBeGreaterThanOrEqual(minExpectedMs);
  });
});

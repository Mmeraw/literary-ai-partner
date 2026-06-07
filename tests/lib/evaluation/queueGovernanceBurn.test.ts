export {};

const createClientMock = jest.fn();
const mockSendEvaluationFailureSupportAlert = jest.fn(async () => ({ attempted: true, sent: true }));
const mockSendEvaluationMajorIssueUserAlert = jest.fn(async () => ({ attempted: true, sent: true }));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

jest.mock('@/lib/evaluation/recoverySupportAlertMailer', () => ({
  MAJOR_TECHNICAL_ISSUE_PUBLIC_MESSAGE:
    'We hit a technical issue that needs engineering support. Our team has been alerted and is investigating. Your manuscript and completed analysis have been preserved; you do not need to retry. We will notify you by email when the problem has been fixed.',
  sendEvaluationFailureSupportAlert: (...args: unknown[]) => mockSendEvaluationFailureSupportAlert(...args),
  sendEvaluationMajorIssueUserAlert: (...args: unknown[]) => mockSendEvaluationMajorIssueUserAlert(...args),
  sendRecoverySupportAlert: jest.fn(async () => ({ attempted: true, sent: true })),
  shouldAlertSupportForRecoveryAction: jest.fn(() => true),
  toUserSafeRecoveryMessage: jest.fn((message: string | null | undefined) => message ?? 'safe recovery message'),
}));

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => '11111111-1111-4111-8111-111111111111'),
}));

function deterministicJobId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

function makeClaimableJob(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: deterministicJobId(index),
    manuscript_id: 10_000 + index,
    status: 'queued',
    phase: 'phase_1a',
    phase_status: 'queued',
    claimed_by: null,
    lease_token: null,
    lease_expires_at: null,
    ...overrides,
  };
}

function buildAtomicClaimStub(seedRows: Array<Record<string, unknown>>) {
  const pending = [...seedRows];
  const claimedIds = new Set<string>();
  const claimedRows: Array<Record<string, unknown>> = [];

  const rpc = jest.fn(async (_fn: string, params: { p_batch_size: number; p_worker_id: string; p_lease_token: string; p_lease_expires_at: string }) => {
    const batch = pending.splice(0, params.p_batch_size).map((row) => {
      if (claimedIds.has(String(row.id))) {
        throw new Error(`split brain: duplicate claim for ${String(row.id)}`);
      }
      claimedIds.add(String(row.id));
      return {
        ...row,
        status: 'running',
        phase_status: 'running',
        claimed_by: params.p_worker_id,
        lease_token: params.p_lease_token,
        lease_expires_at: params.p_lease_expires_at,
      };
    });
    claimedRows.push(...batch);

    return { data: batch, error: null };
  });

  return {
    rpc,
    claimedIds,
    claimedRows,
    from: jest.fn(),
  };
}

describe('evaluation queue governance deterministic burn harness', () => {
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

  test('100 short-form jobs claim exactly once across concurrent workers', async () => {
    const stub = buildAtomicClaimStub(
      Array.from({ length: 100 }, (_unused, index) => makeClaimableJob(index, {
        job_type: 'evaluate_quick',
        manuscript_word_count: 8_000,
      })),
    );
    createClientMock.mockReturnValue(stub as never);

    const { claimQueuedJobs } = await import('@/lib/evaluation/processor');
    const results = await Promise.all(
      Array.from({ length: 20 }, (_unused, workerIndex) => claimQueuedJobs({
        workerId: `short-worker-${workerIndex}`,
        batchSize: 5,
        leaseMs: 800_000,
      })),
    );

    const rows = results.flat();
    const ids = rows.map((row) => row.id);
    expect(rows).toHaveLength(100);
    expect(new Set(ids).size).toBe(100);
    expect(stub.claimedIds.size).toBe(100);
    expect(stub.claimedRows).toHaveLength(100);
    expect(stub.claimedRows.every((row) => row.status === 'running')).toBe(true);
    expect(stub.claimedRows.every((row) => row.phase_status === 'running')).toBe(true);
    expect(stub.claimedRows.every((row) => Boolean(row.claimed_by))).toBe(true);
    expect(stub.claimedRows.every((row) => Boolean(row.lease_token))).toBe(true);
  });

  test('25 long-form jobs claim exactly once with long leases and no watchdog-style duplicate ownership', async () => {
    const stub = buildAtomicClaimStub(
      Array.from({ length: 25 }, (_unused, index) => makeClaimableJob(index, {
        job_type: 'evaluate_full',
        manuscript_word_count: 120_000,
        phase: 'phase_2',
      })),
    );
    createClientMock.mockReturnValue(stub as never);

    const { claimQueuedJobs } = await import('@/lib/evaluation/processor');
    const before = Date.now();
    const results = await Promise.all(
      Array.from({ length: 5 }, (_unused, workerIndex) => claimQueuedJobs({
        workerId: `long-worker-${workerIndex}`,
        batchSize: 5,
        leaseMs: 800_000,
      })),
    );

    const rows = results.flat();
    expect(rows).toHaveLength(25);
    expect(new Set(rows.map((row) => row.id)).size).toBe(25);
    expect(stub.claimedRows).toHaveLength(25);
    expect(stub.claimedRows.every((row) => row.status === 'running')).toBe(true);
    expect(stub.claimedRows.every((row) => row.phase_status === 'running')).toBe(true);
    expect(stub.claimedRows.every((row) => new Date(String(row.lease_expires_at ?? '')).getTime() >= before + 780_000)).toBe(true);
  });

  test('concurrent recovery exhaustion is guarded so only one worker escalates and emails the user', async () => {
    const exhaustedJobId = deterministicJobId(999_999);
    const failedRow = {
      id: exhaustedJobId,
      manuscript_id: 4321,
      status: 'failed',
      phase: 'phase_3',
      phase_status: 'failed',
      failure_code: 'PROCESSOR_UNCAUGHT_ERROR',
      progress: { phase: 'phase_3', phase_status: 'failed', self_recovery_count: 2 },
      created_at: '2026-06-07T01:00:00.000Z',
      updated_at: '2026-06-07T01:10:00.000Z',
    };

    let guardedUpdateWinsRemaining = 1;
    const updateMock = jest.fn(() => ({
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(async () => {
        if (guardedUpdateWinsRemaining > 0) {
          guardedUpdateWinsRemaining -= 1;
          return { data: { id: exhaustedJobId }, error: null };
        }
        return { data: null, error: null };
      }),
    }));

    const jobsSelectChain = {
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn(async () => ({ data: [failedRow], error: null })),
    };

    const stub = {
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
        if (table === 'manuscripts') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn(async () => ({ data: { user_id: 'user-1' }, error: null })),
            })),
          };
        }
        if (table === 'evaluation_artifacts') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn().mockReturnThis(),
              order: jest.fn(async () => ({ data: [], error: null })),
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    createClientMock.mockReturnValue(stub as never);

    const { selfRecoverRetryableFailedJobs } = await import('@/lib/evaluation/processor');
    const [first, second] = await Promise.all([
      selfRecoverRetryableFailedJobs({ targetJobId: exhaustedJobId }),
      selfRecoverRetryableFailedJobs({ targetJobId: exhaustedJobId }),
    ]);

    expect(first.exhausted + second.exhausted).toBe(1);
    expect(first.recovered + second.recovered).toBe(0);
    expect(mockSendEvaluationFailureSupportAlert).toHaveBeenCalledTimes(1);
    expect(mockSendEvaluationMajorIssueUserAlert).toHaveBeenCalledTimes(1);
    expect(mockSendEvaluationMajorIssueUserAlert).toHaveBeenCalledWith({
      job_id: exhaustedJobId,
      manuscript_id: 4321,
      user_email: 'writer@example.com',
    });
  });
});

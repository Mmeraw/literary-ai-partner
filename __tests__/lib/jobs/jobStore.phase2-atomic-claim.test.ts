export {};

const createAdminClientMock = jest.fn();

jest.mock("../../../lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => createAdminClientMock(...args),
}));

type DbRow = Record<string, any>;

function makeDbJobRow(overrides: Partial<DbRow> = {}): DbRow {
  return {
    id: "job-1",
    manuscript_id: 42,
    user_id: "user-1",
    job_type: "full_evaluation",
    status: "running",
    progress: {
      phase: "phase_1",
      phase_status: "complete",
      total_units: 10,
      completed_units: 10,
      lease_id: null,
      lease_expires_at: null,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_heartbeat: null,
    last_error: null,
    failure_envelope: null,
    manuscripts: { user_id: "user-1" },
    ...overrides,
  };
}

function buildSupabaseStub(opts: {
  getJobRows?: DbRow[];
  rpcImpl?: (fn: string, params: Record<string, unknown>) => Promise<{ data: DbRow[] | null; error: { message: string } | null }>;
}) {
  const getJobRows = opts.getJobRows ?? [makeDbJobRow()];
  const getJobMaybeSingle = jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: getJobRows.shift() ?? null, error: null }));

  const rpc = jest.fn().mockImplementation((fn: string, params: Record<string, unknown>) => {
    if (opts.rpcImpl) {
      return opts.rpcImpl(fn, params);
    }
    return Promise.resolve({ data: [], error: null });
  });

  return {
    rpc,
    from: jest.fn().mockImplementation((table: string) => {
      if (table !== "evaluation_jobs") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: getJobMaybeSingle,
          }),
        }),
        update: jest.fn(() => ({
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
    }),
  };
}

describe("acquireLeaseForPhase2 atomic claim", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.JOB_PHASE_LEASE_TIMEOUT_SECONDS;
    delete process.env.JOB_LEASE_TIMEOUT_SECONDS;
  });

  test("uses claim_evaluation_job_phase2 RPC for successful claim ownership", async () => {
    const claimedRow = makeDbJobRow({
      progress: {
        phase: "phase_2",
        phase_status: "running",
        lease_id: "lease-new",
        lease_expires_at: new Date(Date.now() + 300_000).toISOString(),
      },
    });

    const supabase = buildSupabaseStub({
      rpcImpl: async () => ({ data: [claimedRow], error: null }),
    });
    createAdminClientMock.mockReturnValue(supabase as any);

    const { acquireLeaseForPhase2 } = await import("../../../lib/jobs/jobStore.supabase");
    const result = await acquireLeaseForPhase2("job-1", "lease-new", 300);

    expect(result).not.toBeNull();
    expect(supabase.rpc).toHaveBeenCalledWith("claim_evaluation_job_phase2", {
      p_job_id: "job-1",
      p_lease_id: "lease-new",
      p_ttl_seconds: 300,
    });
  });

  test("concurrent claim attempts cannot both win", async () => {
    const claimedRow = makeDbJobRow({
      progress: {
        phase: "phase_2",
        phase_status: "running",
        lease_id: "lease-a",
        lease_expires_at: new Date(Date.now() + 300_000).toISOString(),
      },
    });

    let callCount = 0;
    const supabase = buildSupabaseStub({
      getJobRows: [makeDbJobRow(), makeDbJobRow()],
      rpcImpl: async () => {
        callCount += 1;
        return callCount === 1
          ? { data: [claimedRow], error: null }
          : { data: [], error: null };
      },
    });
    createAdminClientMock.mockReturnValue(supabase as any);

    const { acquireLeaseForPhase2 } = await import("../../../lib/jobs/jobStore.supabase");
    const [first, second] = await Promise.all([
      acquireLeaseForPhase2("job-1", "lease-a", 300),
      acquireLeaseForPhase2("job-1", "lease-b", 300),
    ]);

    const wins = [first, second].filter(Boolean);
    expect(wins).toHaveLength(1);
  });

  test("returns null when RPC reports no claim for non-eligible or lost-race case", async () => {
    const supabase = buildSupabaseStub({
      rpcImpl: async () => ({ data: [], error: null }),
    });
    createAdminClientMock.mockReturnValue(supabase as any);

    const { acquireLeaseForPhase2 } = await import("../../../lib/jobs/jobStore.supabase");
    const result = await acquireLeaseForPhase2("job-1", "lease-new", 300);

    expect(result).toBeNull();
  });
});

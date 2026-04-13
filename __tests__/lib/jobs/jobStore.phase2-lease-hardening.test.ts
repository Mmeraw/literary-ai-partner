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
  getJobRow: DbRow;
  updateResultRow?: DbRow | null;
}) {
  const updatePayloads: Array<Record<string, unknown>> = [];

  const maybeSingle = jest
    .fn()
    .mockResolvedValueOnce({ data: opts.getJobRow, error: null })
    .mockResolvedValue({ data: opts.updateResultRow ?? opts.getJobRow, error: null });

  const updateBuilder: any = {
    eq: jest.fn(function () {
      return this;
    }),
    or: jest.fn(function () {
      return this;
    }),
    select: jest.fn(function () {
      this._hasSelect = true;
      return this;
    }),
    maybeSingle,
    _hasSelect: false,
  };

  const supabase = {
    from: jest.fn().mockImplementation((table: string) => {
      if (table !== "evaluation_jobs") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle,
          }),
        }),
        update: jest.fn((payload: Record<string, unknown>) => {
          updatePayloads.push(payload);
          return updateBuilder;
        }),
      };
    }),
  };

  return { supabase, updatePayloads };
}

describe("acquireLeaseForPhase2 lease timeout hardening", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.JOB_PHASE_LEASE_TIMEOUT_SECONDS;
    delete process.env.JOB_LEASE_TIMEOUT_SECONDS;
  });

  test("uses default 300-second lease timeout when ttl is omitted", async () => {
    const row = makeDbJobRow({
      progress: {
        phase: "phase_1",
        phase_status: "complete",
        lease_id: null,
        lease_expires_at: null,
      },
    });

    const updateRow = makeDbJobRow({
      progress: {
        phase: "phase_2",
        phase_status: "running",
        lease_id: "lease-new",
        lease_expires_at: new Date(Date.now() + 300_000).toISOString(),
      },
    });

    const { supabase, updatePayloads } = buildSupabaseStub({
      getJobRow: row,
      updateResultRow: updateRow,
    });
    createAdminClientMock.mockReturnValue(supabase as any);

    const { acquireLeaseForPhase2 } = await import("../../../lib/jobs/jobStore.supabase");

    const before = Date.now();
    const result = await acquireLeaseForPhase2("job-1", "lease-new");
    const after = Date.now();

    expect(result).not.toBeNull();
    expect(updatePayloads.length).toBeGreaterThan(0);

    const progress = updatePayloads[0].progress as Record<string, unknown>;
    const expires = new Date(String(progress.lease_expires_at)).getTime();
    const minExpected = before + 295_000;
    const maxExpected = after + 305_000;
    expect(expires).toBeGreaterThanOrEqual(minExpected);
    expect(expires).toBeLessThanOrEqual(maxExpected);
  });

  test("marks dead expired lease as failed with LEASE_EXPIRED classification", async () => {
    const expiredAt = new Date(Date.now() - 60_000).toISOString();
    const row = makeDbJobRow({
      progress: {
        phase: "phase_1",
        phase_status: "complete",
        total_units: 10,
        completed_units: 10,
        lease_id: "lease-old",
        lease_expires_at: expiredAt,
      },
      last_heartbeat: null,
    });

    const { supabase, updatePayloads } = buildSupabaseStub({
      getJobRow: row,
      updateResultRow: null,
    });
    createAdminClientMock.mockReturnValue(supabase as any);

    const { acquireLeaseForPhase2 } = await import("../../../lib/jobs/jobStore.supabase");
    const result = await acquireLeaseForPhase2("job-1", "lease-new", 300);

    expect(result).toBeNull();
    expect(updatePayloads.length).toBe(1);
    expect(updatePayloads[0]).toMatchObject({
      status: "failed",
      failure_envelope: expect.objectContaining({
        error_code: "LEASE_EXPIRED",
      }),
      progress: expect.objectContaining({
        phase_status: "failed",
        lease_id: null,
        lease_expires_at: null,
        error_code: "LEASE_EXPIRED",
      }),
    });
  });

  test("allows reacquire when lease is expired but heartbeat is newer than lease expiry", async () => {
    const expiredAt = new Date(Date.now() - 60_000).toISOString();
    const heartbeat = new Date(Date.now() - 10_000).toISOString();

    const row = makeDbJobRow({
      progress: {
        phase: "phase_1",
        phase_status: "complete",
        total_units: 10,
        completed_units: 10,
        lease_id: "lease-old",
        lease_expires_at: expiredAt,
      },
      last_heartbeat: heartbeat,
    });

    const updateRow = makeDbJobRow({
      progress: {
        phase: "phase_2",
        phase_status: "running",
        lease_id: "lease-new",
        lease_expires_at: new Date(Date.now() + 300_000).toISOString(),
      },
      last_heartbeat: heartbeat,
    });

    const { supabase, updatePayloads } = buildSupabaseStub({
      getJobRow: row,
      updateResultRow: updateRow,
    });
    createAdminClientMock.mockReturnValue(supabase as any);

    const { acquireLeaseForPhase2 } = await import("../../../lib/jobs/jobStore.supabase");
    const result = await acquireLeaseForPhase2("job-1", "lease-new", 300);

    expect(result).not.toBeNull();
    expect(updatePayloads.length).toBe(1);
    expect(updatePayloads[0]).not.toHaveProperty("status", "failed");
    expect((updatePayloads[0].progress as Record<string, unknown>).lease_id).toBe("lease-new");
  });
});

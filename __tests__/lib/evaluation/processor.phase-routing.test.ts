export {};

const createClientMock = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: any[]) => createClientMock(...args),
}));

describe("processEvaluationJob phase routing guard", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.OPENAI_API_KEY = "sk-test-key";
    process.env.EVAL_PASS_TIMEOUT_MS = "180000";
    process.env.EVAL_OPENAI_TIMEOUT_MS = "180000";
    process.env.EVAL_EXTERNAL_ADJUDICATION_MODE = "optional";
  });

  test("routes queued phase_2 jobs through phase_2 execution path (no phase_1 rejection)", async () => {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + 5 * 60_000).toISOString();
    const queuedPhase2Job = {
      id: "job-phase2-queued",
      manuscript_id: 42,
      job_type: "evaluate_full",
      status: "running",
      phase: "phase_2",
      phase_status: "running",
      claimed_by: "test-worker",
      worker_id: "test-worker",
      lease_token: "test-lease-token",
      lease_until: leaseUntil,
      lease_expires_at: leaseUntil,
      heartbeat_at: now.toISOString(),
      started_at: now.toISOString(),
      progress: {
        phase: "phase_2",
        phase_status: "running",
      },
      created_at: new Date().toISOString(),
    };

    const updateMock = jest.fn(() => ({
      eq: () => ({ error: null }),
    }));

    const supabaseStub = {
      from(table: string) {
        if (table === "evaluation_jobs") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: queuedPhase2Job, error: null }),
              }),
            }),
            update: updateMock,
          };
        }

        if (table === "manuscripts") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: { message: "not found" } }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table access: ${table}`);
      },
    };

    createClientMock.mockReturnValue(supabaseStub);

    const { processEvaluationJob } = await import("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-phase2-queued");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Manuscript not found");
    expect(result.error).not.toContain("Job not eligible for processing");

    const firstUpdatePayload = updateMock.mock.calls[0]?.[0];
    expect(firstUpdatePayload?.phase).toBe("phase_2");
    expect(firstUpdatePayload?.phase_status).toBe("running");
  });

  test("allows queued phase_1a jobs to continue into processor flow", async () => {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + 5 * 60_000).toISOString();
    const queuedPhase1aJob = {
      id: "job-phase1a-queued",
      manuscript_id: 84,
      job_type: "evaluate_full",
      status: "running",
      phase: "phase_1a",
      phase_status: "running",
      claimed_by: "test-worker",
      worker_id: "test-worker",
      lease_token: "test-lease-token",
      lease_until: leaseUntil,
      lease_expires_at: leaseUntil,
      heartbeat_at: now.toISOString(),
      started_at: now.toISOString(),
      progress: {
        phase: "phase_1a",
        phase_status: "running",
      },
      created_at: new Date().toISOString(),
    };

    const supabaseStub = {
      from(table: string) {
        if (table === "evaluation_jobs") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: queuedPhase1aJob, error: null }),
              }),
            }),
            update: () => ({
              eq: () => ({ error: null }),
            }),
          };
        }

        if (table === "manuscripts") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: { message: "not found" } }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table access: ${table}`);
      },
    };

    createClientMock.mockReturnValue(supabaseStub);

    const { processEvaluationJob } = await import("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-phase1a-queued");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Manuscript not found");
    expect(result.error).not.toContain("Job not eligible for processing");
  });

  test("fails closed when phase_1a cannot ensure SEED artifacts", async () => {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + 5 * 60_000).toISOString();
    const queuedPhase1aJob = {
      id: "job-phase1a-seed-guard",
      manuscript_id: 85,
      job_type: "evaluate_full",
      status: "running",
      phase: "phase_1a",
      phase_status: "running",
      claimed_by: "test-worker",
      worker_id: "test-worker",
      lease_token: "test-lease-token",
      lease_until: leaseUntil,
      lease_expires_at: leaseUntil,
      heartbeat_at: now.toISOString(),
      started_at: now.toISOString(),
      progress: {
        phase: "phase_1a",
        phase_status: "running",
        phase0_total_duration_ms: 12_100,
        phase0_measured_duration_ms: 12_050,
      },
      created_at: new Date().toISOString(),
    };

    const manuscriptText = "This manuscript text is long enough for evaluation runtime checks. ".repeat(240);

    const updateMock = jest.fn(() => {
      const query: any = {
        eq: () => query,
        select: () => ({ single: async () => ({ data: queuedPhase1aJob, error: null }) }),
      };
      return query;
    });

    const supabaseStub = {
      from(table: string) {
        if (table === "evaluation_jobs") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: queuedPhase1aJob, error: null }),
                maybeSingle: async () => ({ data: { status: queuedPhase1aJob.status }, error: null }),
              }),
            }),
            update: updateMock,
          };
        }

        if (table === "manuscripts") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 85,
                    title: "Seed Guard Manuscript",
                    content: manuscriptText,
                    work_type: "novel",
                    user_id: "00000000-0000-0000-0000-000000000085",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "evaluation_artifacts") {
          return {
            select: () => {
              const query: any = {
                eq: () => query,
                in: async () => ({ data: null, error: { message: "seed read failed" } }),
                order: () => query,
                maybeSingle: async () => ({ data: null, error: null }),
              };
              return query;
            },
          };
        }

        throw new Error(`Unexpected table access: ${table}`);
      },
    };

    createClientMock.mockReturnValue(supabaseStub);

    const { processEvaluationJob } = await import("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-phase1a-seed-guard");

    expect(result.success).toBe(false);
    expect(result.error).toContain("SEED_ARTIFACTS_MISSING");

    const failedWrite = updateMock.mock.calls.find(
      ([payload]: Array<Record<string, unknown>>) => payload?.failure_code === "SEED_ARTIFACTS_MISSING",
    );
    expect(failedWrite).toBeDefined();
  });
});

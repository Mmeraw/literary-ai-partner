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
    process.env.EVAL_EXTERNAL_ADJUDICATION_MODE = "optional";
  });

  test("routes queued phase_2 jobs through phase_2 execution path (no phase_1 rejection)", async () => {
    const queuedPhase2Job = {
      id: "job-phase2-queued",
      manuscript_id: 42,
      job_type: "evaluate_full",
      status: "queued",
      phase: "phase_2",
      phase_status: "queued",
      progress: {
        phase: "phase_2",
        phase_status: "queued",
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

  test("allows queued phase_1 jobs to continue into processor flow", async () => {
    const queuedPhase1Job = {
      id: "job-phase1-queued",
      manuscript_id: 84,
      job_type: "evaluate_full",
      status: "queued",
      phase: "phase_1",
      phase_status: "queued",
      progress: {
        phase: "phase_1",
        phase_status: "queued",
      },
      created_at: new Date().toISOString(),
    };

    const supabaseStub = {
      from(table: string) {
        if (table === "evaluation_jobs") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: queuedPhase1Job, error: null }),
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
    const result = await processEvaluationJob("job-phase1-queued");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Manuscript not found");
    expect(result.error).not.toContain("Job not eligible for processing");
  });
});

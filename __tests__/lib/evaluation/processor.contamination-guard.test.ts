/**
 * Processor-level contamination guard integration test.
 *
 * Proves the enforcement path end-to-end:
 *   guard enabled → contaminated result detected → job marked failed
 *   → last_error contains structured detail → artifact persistence not called
 */

export {};

// ── Mock pipeline and synthesis ──────────────────────────────────────────────
const runPipelineMock = jest.fn();
const synthesisToEvaluationResultMock = jest.fn();

jest.mock("@/lib/evaluation/pipeline/runPipeline", () => ({
  runPipeline: (...args: any[]) => runPipelineMock(...args),
  synthesisToEvaluationResult: (...args: any[]) => synthesisToEvaluationResultMock(...args),
}));

// ── Mock artifact persistence ─────────────────────────────────────────────────
const upsertEvaluationArtifactMock = jest.fn();

jest.mock("../../../lib/evaluation/artifactPersistence", () => ({
  stableSourceHash: () => "sha256:test-hash",
  upsertEvaluationArtifact: (...args: any[]) => upsertEvaluationArtifactMock(...args),
}));

// ── Mock contamination guard ──────────────────────────────────────────────────
const detectContextContaminationMock = jest.fn();

jest.mock("@/lib/evaluation/governance/contextContaminationGuard", () => ({
  detectContextContamination: (...args: any[]) => detectContextContaminationMock(...args),
  buildEvaluationOutputText: jest.fn(() => "mocked output text"),
}));

// ── Mock OpenAI (not used in this path, but required to avoid import errors) ──
jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    chat: { completions: { create: jest.fn() } },
  })),
}));

// ── Mock Supabase ─────────────────────────────────────────────────────────────
const createClientMock = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: any[]) => createClientMock(...args),
}));

// ─────────────────────────────────────────────────────────────────────────────

function makeSupabaseStub() {
  const jobUpdates: Array<Record<string, unknown>> = [];

  const queuedJob = {
    id: "job-contamination-test",
    manuscript_id: 789,
    job_type: "evaluate_full",
    status: "queued",
    phase: "phase_1",
    phase_status: "queued",
    created_at: new Date().toISOString(),
    progress: { phase: "phase_1", phase_status: "queued" },
  };

  const manuscript = {
    id: 789,
    title: "River Chapter",
    content: "Cliff piloted the skiff across Carpenter Lake. The water moved cold and clear under the hull.".repeat(20),
    work_type: "narrative_nonfiction",
    user_id: "00000000-0000-0000-0000-000000000002",
  };

  return {
    jobUpdates,
    from(table: string) {
      if (table === "evaluation_jobs") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: queuedJob, error: null }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            jobUpdates.push(payload);
            return { eq: () => ({ error: null }) };
          },
        };
      }

      if (table === "manuscripts") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: manuscript, error: null }),
            }),
          }),
        };
      }

      // Absorb any other table writes (audit rows, etc.) silently.
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
        update: () => ({ eq: () => ({ error: null }) }),
        insert: () => ({ error: null }),
        upsert: () => ({ error: null }),
      };
    },
  };
}

function makeEvaluationResult() {
  return {
    schema_version: "evaluation_result_v1",
    ids: {
      evaluation_run_id: "run-contamination",
      manuscript_id: 789,
      user_id: "00000000-0000-0000-0000-000000000002",
    },
    generated_at: new Date().toISOString(),
    engine: { model: "o3", provider: "openai", prompt_version: "test" },
    overview: {
      verdict: "revise",
      overall_score_0_100: 58,
      one_paragraph_summary:
        "Maria receives a letter from her missing father deep in cartel territory.",
      top_3_strengths: ["Atmosphere"],
      top_3_risks: ["Cross-manuscript bleed"],
    },
    criteria: [],
    recommendations: { quick_wins: [], strategic_revisions: [] },
    metrics: { manuscript: {}, processing: {} },
    artifacts: [],
    governance: { confidence: 0.8, warnings: [], limitations: [], policy_family: "standard" },
  };
}

describe("processEvaluationJob contamination guard enforcement", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.OPENAI_API_KEY = "sk-test-key";
    process.env.EVAL_PASS_TIMEOUT_MS = "180000";
    process.env.EVAL_OPENAI_TIMEOUT_MS = "180000";
    process.env.EVAL_CONTEXT_CONTAMINATION_GUARD = "true";
    process.env.EVAL_EXTERNAL_ADJUDICATION_MODE = "optional";
  });

  test("marks job failed and skips artifact persistence when contamination is detected", async () => {
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);

    runPipelineMock.mockResolvedValue({
      ok: true,
      synthesis: {
        criteria: [],
        overall: {
          overall_score_0_100: 58,
          verdict: "revise",
          one_paragraph_summary: "Maria and cartel context bleeds in.",
          top_3_strengths: [],
          top_3_risks: [],
        },
        metadata: {
          pass1_model: "o3",
          pass2_model: "o3",
          pass3_model: "o3",
          generated_at: new Date().toISOString(),
        },
      },
      quality_gate: { pass: true, checks: [], warnings: [] },
      pass4_governance: { ok: true },
    });

    synthesisToEvaluationResultMock.mockReturnValue(makeEvaluationResult());

    // Guard returns contaminated
    detectContextContaminationMock.mockReturnValue({
      contaminated: true,
      offendingEntities: ["maria", "cartel"],
      reasons: [
        'Hard contamination token detected: maria',
        'Hard contamination token detected: cartel',
      ],
    });

    const { processEvaluationJob } = await import(
      "../../../lib/evaluation/processor"
    );

    const result = await processEvaluationJob("job-contamination-test");

    // 1. Job should fail
    expect(result.success).toBe(false);
    expect(result.error).toBe("CONTEXT_CONTAMINATION_DETECTED");

    // 2. last_error in DB update must contain structured contamination detail
    const failedUpdate = supabaseStub.jobUpdates.find(
      (u) => u.status === "failed",
    );
    expect(failedUpdate).toBeDefined();
    expect(failedUpdate!.last_error).toBeDefined();

    const parsedError = JSON.parse(failedUpdate!.last_error as string);
    expect(parsedError.code).toBe("CONTEXT_CONTAMINATION_DETECTED");
    expect(parsedError.offending_entities).toEqual(
      expect.arrayContaining(["maria", "cartel"]),
    );

    // 3. Artifact persistence must NOT have been called
    expect(upsertEvaluationArtifactMock).not.toHaveBeenCalled();
  });

  test("completes normally and persists artifact when output is clean", async () => {
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);

    runPipelineMock.mockResolvedValue({
      ok: true,
      synthesis: {
        criteria: [],
        overall: {
          overall_score_0_100: 75,
          verdict: "pass",
          one_paragraph_summary: "Cliff navigates Carpenter Lake with confidence.",
          top_3_strengths: ["Voice"],
          top_3_risks: [],
        },
        metadata: {
          pass1_model: "o3",
          pass2_model: "o3",
          pass3_model: "o3",
          generated_at: new Date().toISOString(),
        },
      },
      quality_gate: { pass: true, checks: [], warnings: [] },
      pass4_governance: { ok: true },
    });

    const cleanResult = makeEvaluationResult();
    cleanResult.overview.one_paragraph_summary =
      "Cliff navigates Carpenter Lake with confidence.";
    synthesisToEvaluationResultMock.mockReturnValue(cleanResult);

    // Guard returns clean
    detectContextContaminationMock.mockReturnValue({
      contaminated: false,
      offendingEntities: [],
      reasons: [],
    });

    upsertEvaluationArtifactMock.mockResolvedValue({ ok: true });

    const { processEvaluationJob } = await import(
      "../../../lib/evaluation/processor"
    );

    const result = await processEvaluationJob("job-contamination-test");

    // Guard was invoked
    expect(detectContextContaminationMock).toHaveBeenCalledTimes(1);

    // Job should not have been failed due to contamination
    const failedUpdate = supabaseStub.jobUpdates.find(
      (u) =>
        u.status === "failed" &&
        typeof u.last_error === "string" &&
        (u.last_error as string).includes("CONTEXT_CONTAMINATION_DETECTED"),
    );
    expect(failedUpdate).toBeUndefined();

    // Artifact persistence was attempted
    expect(upsertEvaluationArtifactMock).toHaveBeenCalled();
  });
});

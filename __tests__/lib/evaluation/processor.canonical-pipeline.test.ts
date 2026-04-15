export {};

const runPipelineMock = jest.fn();
const synthesisToEvaluationResultMock = jest.fn();

jest.mock("@/lib/evaluation/pipeline/runPipeline", () => ({
  runPipeline: (...args: any[]) => runPipelineMock(...args),
  synthesisToEvaluationResult: (...args: any[]) => synthesisToEvaluationResultMock(...args),
}));

const upsertEvaluationArtifactMock = jest.fn();

jest.mock("../../../lib/evaluation/artifactPersistence", () => ({
  stableSourceHash: () => "sha256:test-hash",
  upsertEvaluationArtifact: (...args: any[]) => upsertEvaluationArtifactMock(...args),
}));

const OpenAIMock = jest.fn(() => ({
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
}));

jest.mock("openai", () => ({
  __esModule: true,
  default: OpenAIMock,
}));

const createClientMock = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: any[]) => createClientMock(...args),
}));

function makeSupabaseStub() {
  const evaluationJobUpdates: Array<Record<string, unknown>> = [];

  const queuedJob = {
    id: "job-canonical-pipeline",
    manuscript_id: 456,
    job_type: "evaluate_full",
    status: "queued",
    phase: "phase_1",
    phase_status: "queued",
    created_at: new Date().toISOString(),
    progress: { phase: "phase_1", phase_status: "queued" },
  };

  const manuscript = {
    id: 456,
    title: "Canonical Manuscript",
    content: "This manuscript is long enough to pass threshold validation. ".repeat(220),
    work_type: "novel",
    user_id: "00000000-0000-0000-0000-000000000001",
  };

  return {
    evaluationJobUpdates,
    from(table: string) {
      if (table === "evaluation_jobs") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: queuedJob, error: null }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            evaluationJobUpdates.push(payload);
            return {
              eq: async () => ({ error: null }),
            };
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

      throw new Error(`Unexpected table in canonical pipeline test stub: ${table}`);
    },
  };
}

describe("processEvaluationJob canonical pipeline integration", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.OPENAI_API_KEY = "sk-test-key";
    process.env.EVAL_PASS_TIMEOUT_MS = "180000";
    process.env.EVAL_OPENAI_TIMEOUT_MS = "180000";
    process.env.EVAL_EXTERNAL_ADJUDICATION_MODE = "optional";
    // Ensure timeout config passes the invariant check (openAi >= pass)
    process.env.EVAL_PASS_TIMEOUT_MS = "180000";
    process.env.EVAL_OPENAI_TIMEOUT_MS = "180000";
  });

  test("uses runPipeline as the evaluation engine and does not directly invoke OpenAI", async () => {
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);

    runPipelineMock.mockResolvedValue({
      ok: true,
      synthesis: {
        criteria: [],
        overall: {
          overall_score_0_100: 82,
          verdict: "pass",
          one_paragraph_summary: "Summary",
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
      quality_gate: {
        pass: true,
        checks: [],
        warnings: [],
      },
      pass4_governance: { ok: true },
    });

    synthesisToEvaluationResultMock.mockReturnValue({
      schema_version: "evaluation_result_v1",
      ids: {
        evaluation_run_id: "run-1",
        manuscript_id: 456,
        user_id: "00000000-0000-0000-0000-000000000001",
      },
      generated_at: new Date().toISOString(),
      engine: {
        model: "o3",
        provider: "openai",
        prompt_version: "test",
      },
      overview: {
        verdict: "pass",
        overall_score_0_100: 82,
        one_paragraph_summary: "Summary",
        top_3_strengths: [],
        top_3_risks: [],
      },
      criteria: [],
      recommendations: {
        quick_wins: [],
        strategic_revisions: [],
      },
      metrics: {
        manuscript: {},
        processing: {},
      },
      artifacts: [],
      governance: {
        confidence: 0.9,
        warnings: [],
        limitations: [],
        policy_family: "multi-pass-dual-axis",
      },
    });

    upsertEvaluationArtifactMock.mockResolvedValue("artifact-1");

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");

    const result = await processEvaluationJob("job-canonical-pipeline");

    expect(result.success).toBe(true);
    expect(runPipelineMock).toHaveBeenCalledTimes(1);
    expect(OpenAIMock).not.toHaveBeenCalled();
    expect(upsertEvaluationArtifactMock).toHaveBeenCalledTimes(1);
  });
});

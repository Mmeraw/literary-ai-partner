export {};

const runPipelineMock = jest.fn();
const synthesisToEvaluationResultV2Mock = jest.fn();
const runQualityGateV2Mock = jest.fn();
const mapEvaluationResultV2ToGovernanceEnvelopeMock = jest.fn();
const ensureChunksMock = jest.fn();

jest.mock("@/lib/evaluation/pipeline/runPipeline", () => ({
  runPipeline: (...args: any[]) => runPipelineMock(...args),
  synthesisToEvaluationResultV2: (...args: any[]) => synthesisToEvaluationResultV2Mock(...args),
}));

jest.mock("@/lib/evaluation/pipeline/qualityGate", () => ({
  runQualityGateV2: (...args: any[]) => runQualityGateV2Mock(...args),
}));

jest.mock("@/lib/governance/evaluationBridge", () => ({
  mapEvaluationResultV2ToGovernanceEnvelope: (...args: any[]) =>
    mapEvaluationResultV2ToGovernanceEnvelopeMock(...args),
}));

jest.mock("@/lib/manuscripts/chunks", () => ({
  ensureChunks: (...args: any[]) => ensureChunksMock(...args),
}));

const createClientMock = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: any[]) => createClientMock(...args),
}));

function buildEvaluationResult() {
  return {
    schema_version: "evaluation_result_v2",
    ids: {
      evaluation_run_id: "run-long-form-1",
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
      scored_criteria_count: 13,
      one_paragraph_summary: "Summary",
      top_3_strengths: [],
      top_3_risks: [],
    },
    criteria: new Array(13).fill(null).map((_, idx) => ({
      key: [
        "concept",
        "narrativeDrive",
        "character",
        "voice",
        "sceneConstruction",
        "dialogue",
        "theme",
        "worldbuilding",
        "pacing",
        "proseControl",
        "tone",
        "narrativeClosure",
        "marketability",
      ][idx],
      scorable: true,
      status: "SCORABLE",
      signal_present: true,
      signal_strength: "SUFFICIENT",
      confidence_band: "MEDIUM",
      score_0_10: 7,
      rationale: "Criterion rationale backed by manuscript evidence.",
      evidence: [{ snippet: "Evidence snippet with sufficient detail for quality gate checks." }],
      recommendations: [],
    })),
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
  };
}

function makeSupabaseStub(manuscriptContent: string) {
  const evaluationJobUpdates: Array<Record<string, unknown>> = [];
  const rpcCalls: Array<{ fn: string; args?: Record<string, unknown> }> = [];

  const now = new Date();
  const leaseUntil = new Date(now.getTime() + 5 * 60_000).toISOString();

  const queuedJob = {
    id: "job-long-form-routing",
    manuscript_id: 456,
    job_type: "evaluate_full",
    status: "running",
    phase: "phase_1",
    phase_status: "running",
    claimed_by: "test-worker",
    worker_id: "test-worker",
    lease_token: "test-lease-token",
    lease_until: leaseUntil,
    lease_expires_at: leaseUntil,
    heartbeat_at: now.toISOString(),
    started_at: now.toISOString(),
    created_at: now.toISOString(),
    progress: { phase: "phase_1", phase_status: "running" },
  };

  const manuscript = {
    id: 456,
    title: "Long Form Manuscript",
    content: manuscriptContent,
    work_type: "novel",
    user_id: "00000000-0000-0000-0000-000000000001",
  };

  return {
    evaluationJobUpdates,
    rpcCalls,
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });

      if (fn === "persist_evaluation_v2_atomic") {
        return {
          data: [{ artifact_id: "artifact-long-form-routing" }],
          error: null,
        };
      }

      if (fn === "finalize_job_failure_atomic") {
        return {
          data: [{ attempt_count: 1, max_attempts: 3, notified_at: null }],
          error: null,
        };
      }

      return { data: null, error: null };
    },
    from(table: string) {
      if (table === "evaluation_jobs") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: queuedJob, error: null }),
              maybeSingle: async () => ({ data: { status: queuedJob.status }, error: null }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            evaluationJobUpdates.push(payload);
            const query = {
              eq: () => query,
              then: (resolve: (value: { error: null }) => void) => resolve({ error: null }),
            };
            return {
              eq: () => query,
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

      if (table === "evaluation_artifacts") {
        return {
          select: () => {
            const query = {
              eq: () => query,
              maybeSingle: async () => ({ data: { id: "artifact-long-form-routing" }, error: null }),
            };
            return query;
          },
        };
      }

      throw new Error(`Unexpected table in chunk routing test stub: ${table}`);
    },
  };
}

describe("processEvaluationJob long-form chunk routing", () => {
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

  test("ensures chunks before pipeline for long-form manuscripts and persists chunk routing telemetry", async () => {
    const manuscriptContent = "alpha beta gamma delta epsilon zeta eta theta iota kappa ".repeat(2600);
    const supabaseStub = makeSupabaseStub(manuscriptContent);
    createClientMock.mockReturnValue(supabaseStub);

    ensureChunksMock.mockResolvedValue(4);

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
          pass1_model: "gpt-4o",
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

    synthesisToEvaluationResultV2Mock.mockReturnValue(buildEvaluationResult());
    runQualityGateV2Mock.mockReturnValue({
      pass: true,
      checks: [],
      warnings: [],
    });
    mapEvaluationResultV2ToGovernanceEnvelopeMock.mockReturnValue({
      evaluation_run_id: "run-long-form-1",
      criteria: [],
    });

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-long-form-routing");

    expect(result.success).toBe(true);
    expect(ensureChunksMock).toHaveBeenCalledWith(456, "job-long-form-routing");
    expect(runPipelineMock).toHaveBeenCalledTimes(1);

    const ensureChunksCallOrder = ensureChunksMock.mock.invocationCallOrder[0];
    const runPipelineCallOrder = runPipelineMock.mock.invocationCallOrder[0];
    expect(ensureChunksCallOrder).toBeLessThan(runPipelineCallOrder);

    const persistCall = supabaseStub.rpcCalls.find(
      (call: { fn: string }) => call.fn === "persist_evaluation_v2_atomic",
    );
    expect(persistCall).toBeDefined();
    expect(persistCall?.args?.p_progress).toEqual(
      expect.objectContaining({
        chunk_routing: expect.objectContaining({
          enabled: true,
          route: "long_form",
          threshold_words: 25000,
          manuscript_words: 26000,
          chunk_count: 4,
        }),
      }),
    );
  });

  test("does not call ensureChunks for short-form manuscripts and persists short_form telemetry", async () => {
    const manuscriptContent = "alpha beta gamma delta epsilon zeta eta theta iota kappa ".repeat(300);
    const supabaseStub = makeSupabaseStub(manuscriptContent);
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
          pass1_model: "gpt-4o",
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

    synthesisToEvaluationResultV2Mock.mockReturnValue(buildEvaluationResult());
    runQualityGateV2Mock.mockReturnValue({
      pass: true,
      checks: [],
      warnings: [],
    });
    mapEvaluationResultV2ToGovernanceEnvelopeMock.mockReturnValue({
      evaluation_run_id: "run-long-form-1",
      criteria: [],
    });

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-long-form-routing");

    expect(result.success).toBe(true);
    expect(ensureChunksMock).not.toHaveBeenCalled();
    expect(runPipelineMock).toHaveBeenCalledTimes(1);

    const persistCall = supabaseStub.rpcCalls.find(
      (call: { fn: string }) => call.fn === "persist_evaluation_v2_atomic",
    );
    expect(persistCall).toBeDefined();
    expect(persistCall?.args?.p_progress).toEqual(
      expect.objectContaining({
        chunk_routing: expect.objectContaining({
          enabled: true,
          route: "short_form",
          threshold_words: 25000,
          manuscript_words: 3000,
          chunk_count: 0,
        }),
      }),
    );
  });

  test("does not run pipeline when ensureChunks throws for long-form manuscripts", async () => {
    const manuscriptContent = "alpha beta gamma delta epsilon zeta eta theta iota kappa ".repeat(2600);
    const supabaseStub = makeSupabaseStub(manuscriptContent);
    createClientMock.mockReturnValue(supabaseStub);

    ensureChunksMock.mockRejectedValueOnce(new Error("chunking failed"));

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-long-form-routing");

    expect(result.success).toBe(false);
    expect(ensureChunksMock).toHaveBeenCalledTimes(1);
    expect(runPipelineMock).not.toHaveBeenCalled();
  });
});
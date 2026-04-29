export {};

const runPipelineMock = jest.fn();
const synthesisToEvaluationResultV2Mock = jest.fn();
const runQualityGateV2Mock = jest.fn();
const mapEvaluationResultV2ToGovernanceEnvelopeMock = jest.fn();

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
  const rpcCalls: Array<{ fn: string; args?: Record<string, unknown> }> = [];

  const now = new Date();
  const leaseUntil = new Date(now.getTime() + 5 * 60_000).toISOString();

  const queuedJob = {
    id: "job-canonical-pipeline",
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
    title: "Canonical Manuscript",
    content: "This manuscript is long enough to pass threshold validation. ".repeat(220),
    work_type: "novel",
    user_id: "00000000-0000-0000-0000-000000000001",
  };

  return {
    evaluationJobUpdates,
    rpcCalls,
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });

      if (fn === "finalize_job_failure_atomic") {
        return {
          data: [{ attempt_count: 1, max_attempts: 3, notified_at: null }],
          error: null,
        };
      }

      if (fn === "persist_evaluation_v2_atomic") {
        return {
          data: [{ artifact_id: "artifact-canonical-pass" }],
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
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            evaluationJobUpdates.push(payload);
            const query = {
              eq: () => query,
              then: (resolve: (value: { error: null }) => void) =>
                resolve({ error: null }),
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
              maybeSingle: async () => ({ data: { id: "artifact-canonical-pass" }, error: null }),
            };
            return query;
          },
        };
      }

      throw new Error(`Unexpected table in canonical pipeline test stub: ${table}`);
    },
  };
}

describe("processEvaluationJob canonical pipeline integration", () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

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

  afterEach(() => {
    consoleLogSpy.mockRestore();
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

    synthesisToEvaluationResultV2Mock.mockReturnValue({
      schema_version: "evaluation_result_v2",
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
        rationale: "Criterion is supported by manuscript evidence and synthesis.",
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
    });

    runQualityGateV2Mock.mockReturnValue({
      pass: true,
      checks: [],
      warnings: [],
    });

    mapEvaluationResultV2ToGovernanceEnvelopeMock.mockReturnValue({
      evaluation_run_id: "run-1",
      criteria: [],
    });

    upsertEvaluationArtifactMock.mockResolvedValue("artifact-1");

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");

    const result = await processEvaluationJob("job-canonical-pipeline");

    expect(result.success).toBe(true);
    expect(runPipelineMock).toHaveBeenCalledTimes(1);
    expect(runQualityGateV2Mock).toHaveBeenCalledTimes(1);
    expect(OpenAIMock).not.toHaveBeenCalled();
    expect(upsertEvaluationArtifactMock).not.toHaveBeenCalled();
    expect(
      supabaseStub.rpcCalls.some((call: { fn: string }) => call.fn === "persist_evaluation_v2_atomic"),
    ).toBe(true);

    expect(
      supabaseStub.evaluationJobUpdates.some(
        (payload: Record<string, unknown>) => payload.status === "failed",
      ),
    ).toBe(false);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "ProcessorStageBoundary",
      expect.objectContaining({
        job_id: "job-canonical-pipeline",
        stage: "pass3",
        state: "start",
      }),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "ProcessorStageBoundary",
      expect.objectContaining({
        job_id: "job-canonical-pipeline",
        stage: "pass3",
        state: "complete",
      }),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "ProcessorStageBoundary",
      expect.objectContaining({
        job_id: "job-canonical-pipeline",
        stage: "finalized",
        state: "complete",
      }),
    );
  });

  test("persists success via atomic RPC without direct completion updates", async () => {
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

    synthesisToEvaluationResultV2Mock.mockReturnValue({
      schema_version: "evaluation_result_v2",
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
        rationale: "Criterion is supported by manuscript evidence and synthesis.",
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
    });

    runQualityGateV2Mock.mockReturnValue({
      pass: true,
      checks: [],
      warnings: [],
    });

    mapEvaluationResultV2ToGovernanceEnvelopeMock.mockReturnValue({
      evaluation_run_id: "run-1",
      criteria: [],
    });

    upsertEvaluationArtifactMock.mockResolvedValue("artifact-1");

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-canonical-pipeline");

    expect(result.success).toBe(true);
    expect(
      supabaseStub.rpcCalls.filter((call: { fn: string }) => call.fn === "persist_evaluation_v2_atomic"),
    ).toHaveLength(1);
    expect(
      supabaseStub.evaluationJobUpdates.some(
        (payload: Record<string, unknown>) => payload.status === "complete",
      ),
    ).toBe(false);
  });

  test("fails closed before persistence when v2 quality gate fails", async () => {
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);

    runPipelineMock.mockResolvedValue({
      ok: true,
      synthesis: {
        criteria: [],
        overall: {
          overall_score_0_100: 50,
          verdict: "revise",
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

    synthesisToEvaluationResultV2Mock.mockReturnValue({
      schema_version: "evaluation_result_v2",
      ids: {
        evaluation_run_id: "run-2",
        manuscript_id: 456,
        user_id: "00000000-0000-0000-0000-000000000001",
      },
      generated_at: new Date().toISOString(),
      engine: { model: "o3", provider: "openai", prompt_version: "test" },
      overview: {
        verdict: "revise",
        overall_score_0_100: 50,
        scored_criteria_count: 0,
        one_paragraph_summary: "Summary",
        top_3_strengths: [],
        top_3_risks: [],
      },
      criteria: [],
      recommendations: { quick_wins: [], strategic_revisions: [] },
      metrics: { manuscript: {}, processing: {} },
      artifacts: [],
      governance: {
        confidence: 0.7,
        warnings: [],
        limitations: [],
        policy_family: "multi-pass-dual-axis",
      },
    });

    runQualityGateV2Mock.mockReturnValue({
      pass: false,
      checks: [
        {
          check_id: "v2_score_without_signal",
          passed: false,
          error_code: "QG_SCORE_RANGE",
          details: "Non-scorable criteria carrying numeric scores",
        },
      ],
      warnings: [],
    });

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-canonical-pipeline");

    expect(result.success).toBe(false);
    expect(result.error).toContain("[QualityGateV2]");
    expect(upsertEvaluationArtifactMock).not.toHaveBeenCalled();
    expect(
      supabaseStub.evaluationJobUpdates.some(
        (payload: Record<string, unknown>) => payload.status === "complete",
      ),
    ).toBe(false);
  });

  test("persists diagnostic pass3 snapshot artifact when pipeline is blocked pre-artifact", async () => {
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);

    upsertEvaluationArtifactMock.mockResolvedValue("artifact-diagnostic-pass3");

    runPipelineMock.mockResolvedValue({
      ok: false,
      failed_at: "pass4",
      error_code: "LLR_PRE_ARTIFACT_GENERATION_BLOCK",
      error: "Lessons-learned enforcement blocked at pre_artifact_generation",
      failure_details: {
        llr_diagnostic_snapshot: {
          stage: "pre_artifact_generation",
          blocked_rule_ids: ["LLR-003"],
          convergence_result: {
            criteria: [],
            overall: {
              overall_score_0_100: 74,
              verdict: "revise",
              one_paragraph_summary: "Summary",
              top_3_strengths: [],
              top_3_risks: [],
              submission_readiness: "close",
            },
            metadata: {
              pass1_model: "o3",
              pass2_model: "o3",
              pass3_model: "o3",
              generated_at: new Date().toISOString(),
            },
            partial_evaluation: false,
          },
        },
      },
    });

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-canonical-pipeline");

    expect(result.success).toBe(false);
    expect(upsertEvaluationArtifactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactType: "diagnostic_pass3_snapshot_v1",
        artifactVersion: "diagnostic_pass3_snapshot_v1",
      }),
    );
    expect(
      supabaseStub.evaluationJobUpdates.some(
        (payload: Record<string, unknown>) => payload.status === "complete",
      ),
    ).toBe(false);
  });

  test("persists canonical pipeline failure envelope for PASS1_FAILED with optional diagnostics", async () => {
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);

    runPipelineMock.mockResolvedValue({
      ok: false,
      failed_at: "pass1",
      error_code: "PASS1_FAILED",
      error: "Pass 1 failed to produce valid JSON",
      failure_details: {
        json_boundary: {
          code: "NO_JSON_BLOCK",
          candidate_tail: "...truncated tail...",
        },
      },
    });

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-canonical-pipeline");

    expect(result.success).toBe(false);

    const envelopePatch = supabaseStub.evaluationJobUpdates.find(
      (payload: Record<string, any>) =>
        payload?.progress?.pipeline_failure_envelope?.error_code === "PASS1_FAILED",
    ) as Record<string, any> | undefined;

    expect(envelopePatch).toBeDefined();
    expect(envelopePatch?.progress?.pipeline_failure_envelope).toEqual(
      expect.objectContaining({
        failure_origin: "processor",
        error_code: "PASS1_FAILED",
        pipeline_stage: "pass1",
        failed_at: "pass1",
        reason_codes: ["PASS1_FAILED"],
      }),
    );
    expect(envelopePatch?.progress?.pipeline_failure_diagnostics).toEqual(
      expect.objectContaining({
        json_boundary: expect.objectContaining({
          code: "NO_JSON_BLOCK",
        }),
      }),
    );
  });

  test("logs artifact validation result in governance transparency (logging mode only)", async () => {
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);

    runPipelineMock.mockResolvedValue({
      ok: true,
      synthesis: {
        criteria: [],
        overall: {
          overall_score_0_100: 50,
          verdict: "revise",
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

    synthesisToEvaluationResultV2Mock.mockReturnValue({
      schema_version: "evaluation_result_v2",
      ids: {
        evaluation_run_id: "run-log-mode-1",
        manuscript_id: 456,
        user_id: "00000000-0000-0000-0000-000000000001",
      },
      generated_at: new Date().toISOString(),
      engine: { model: "o3", provider: "openai", prompt_version: "test" },
      overview: {
        verdict: "revise",
        overall_score_0_100: 50,
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
        rationale: "Criterion rationale",
        evidence: [{ snippet: "Evidence snippet with sufficient detail for quality gate checks." }],
        recommendations: [],
      })),
      recommendations: { quick_wins: [], strategic_revisions: [] },
      metrics: { manuscript: {}, processing: {} },
      artifacts: [],
      governance: {
        confidence: 0.9,
        warnings: [],
        limitations: [],
        policy_family: "multi-pass-dual-axis",
        transparency: {},
      },
    });

    runQualityGateV2Mock.mockReturnValue({
      pass: true,
      checks: [],
      warnings: [],
    });

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-canonical-pipeline");

    // In logging mode, processor succeeds and persists the artifact with validation metadata
    expect(result.success).toBe(true);

    // Success path persists via atomic RPC (diagnostic artifact upsert is not expected)
    expect(upsertEvaluationArtifactMock).not.toHaveBeenCalled();
    expect(
      supabaseStub.rpcCalls.some((call: { fn: string }) => call.fn === "persist_evaluation_v2_atomic"),
    ).toBe(true);

    // No explicit "complete" update should be issued from processor in atomic mode
    expect(
      supabaseStub.evaluationJobUpdates.some(
        (payload: Record<string, unknown>) => payload.status === "complete",
      ),
    ).toBe(false);
  });
});

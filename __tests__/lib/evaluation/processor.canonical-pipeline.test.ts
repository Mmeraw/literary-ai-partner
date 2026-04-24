export {};

const runPipelineMock = jest.fn();
const synthesisToEvaluationResultV2Mock = jest.fn();
const runQualityGateV2Mock = jest.fn();
const mapEvaluationResultV2ToGovernanceEnvelopeMock = jest.fn();
const finalizeJobFailureMock = jest.fn();

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

jest.mock("@/lib/jobs/jobStore.supabase", () => ({
  finalizeJobFailure: (...args: any[]) => finalizeJobFailureMock(...args),
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

function makeUpdateEqChain(
  firstResult: { error: unknown },
  secondResult?: { error: unknown } | (() => Promise<{ error: unknown }> | { error: unknown }),
) {
  return {
    eq: () => ({
      ...firstResult,
      eq: async () => {
        if (typeof secondResult === "function") {
          return await secondResult();
        }
        return secondResult ?? firstResult;
      },
    }),
  };
}

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
    started_at: new Date().toISOString(),
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
              maybeSingle: async () => ({ data: { status: queuedJob.status }, error: null }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            evaluationJobUpdates.push(payload);
            return makeUpdateEqChain({ error: null });
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
    finalizeJobFailureMock.mockResolvedValue({
      status: "failed",
      retryEligible: false,
      retryExhausted: false,
      attemptCount: 1,
      maxAttempts: 3,
      shouldNotify: true,
      failureCode: "PIPELINE_SLA_EXCEEDED",
    });
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
    expect(runPipelineMock).toHaveBeenCalledWith(
      expect.objectContaining({
        onHeartbeat: expect.any(Function),
      }),
    );
    expect(runQualityGateV2Mock).toHaveBeenCalledTimes(1);
    expect(OpenAIMock).not.toHaveBeenCalled();
    expect(upsertEvaluationArtifactMock).toHaveBeenCalledTimes(1);
    expect(upsertEvaluationArtifactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactType: "evaluation_result_v2",
        artifactVersion: "evaluation_result_v2",
      }),
    );

    const completionUpdate = supabaseStub.evaluationJobUpdates.find(
      (payload: Record<string, unknown>) => payload.status === "complete",
    ) as Record<string, any> | undefined;
    expect(completionUpdate).toBeDefined();
    expect(completionUpdate?.progress?.pass3_started_at).toBeDefined();
    expect(completionUpdate?.progress?.pass3_completed_at).toBeDefined();
    expect(completionUpdate?.progress?.finalized_at).toBeDefined();

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

  test("retries completion update without phase2_completed_at when schema cache is stale", async () => {
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

    const supabaseStub = {
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
              const firstResult =
                payload.status === "complete" &&
                Object.prototype.hasOwnProperty.call(payload, "phase2_completed_at")
                  ? {
                      error: {
                        code: "PGRST204",
                        message:
                          "Could not find the 'phase2_completed_at' column of 'evaluation_jobs' in the schema cache",
                      },
                    }
                  : { error: null };
              return makeUpdateEqChain(firstResult);
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
    const completionUpdates = evaluationJobUpdates.filter(
      (payload) => payload.status === "complete",
    );
    expect(completionUpdates).toHaveLength(2);
    expect(completionUpdates[0]).toHaveProperty("phase2_completed_at");
    expect(completionUpdates[1]).not.toHaveProperty("phase2_completed_at");
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

  test("finalizes as PIPELINE_SLA_EXCEEDED and aborts before runPipeline when SLA already exceeded", async () => {
    const supabaseStub = makeSupabaseStub();
    const jobSelectSingle = jest.fn().mockResolvedValue({
      data: {
        id: "job-canonical-pipeline",
        manuscript_id: 456,
        job_type: "evaluate_full",
        status: "queued",
        phase: "phase_1",
        phase_status: "queued",
        created_at: "2026-04-24T19:00:00.000Z",
        started_at: "2026-04-24T19:00:00.000Z",
        progress: { phase: "phase_1", phase_status: "queued" },
      },
      error: null,
    });

    const statusMaybeSingle = jest.fn().mockResolvedValue({
      data: { status: "running" },
      error: null,
    });

    const manuscriptSingle = jest.fn().mockResolvedValue({
      data: {
        id: 456,
        title: "Canonical Manuscript",
        content: "This manuscript is long enough to pass threshold validation. ".repeat(220),
        work_type: "novel",
        user_id: "00000000-0000-0000-0000-000000000001",
      },
      error: null,
    });

    createClientMock.mockReturnValue({
      evaluationJobUpdates: supabaseStub.evaluationJobUpdates,
      from(table: string) {
        if (table === "evaluation_jobs") {
          return {
            select: () => ({
              eq: () => ({
                single: jobSelectSingle,
                maybeSingle: statusMaybeSingle,
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              supabaseStub.evaluationJobUpdates.push(payload);
              return makeUpdateEqChain({ error: null }, { error: null });
            },
          };
        }

        if (table === "manuscripts") {
          return {
            select: () => ({
              eq: () => ({
                single: manuscriptSingle,
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

        throw new Error(`Unexpected table in SLA test stub: ${table}`);
      },
    });

    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-04-24T19:10:00.000Z"));

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-canonical-pipeline");

    expect(result.success).toBe(false);
    expect(runPipelineMock).not.toHaveBeenCalled();
    expect(upsertEvaluationArtifactMock).not.toHaveBeenCalled();
    expect(finalizeJobFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-canonical-pipeline",
        errorEnvelope: expect.objectContaining({
          code: "PIPELINE_SLA_EXCEEDED",
        }),
      }),
    );

    nowSpy.mockRestore();
  });

  test("does not re-finalize if job is already terminal when SLA guard runs", async () => {
    const supabaseStub = makeSupabaseStub();
    const jobSelectSingle = jest.fn().mockResolvedValue({
      data: {
        id: "job-canonical-pipeline",
        manuscript_id: 456,
        job_type: "evaluate_full",
        status: "queued",
        phase: "phase_1",
        phase_status: "queued",
        created_at: "2026-04-24T19:00:00.000Z",
        started_at: "2026-04-24T19:00:00.000Z",
        progress: { phase: "phase_1", phase_status: "queued" },
      },
      error: null,
    });

    const statusMaybeSingle = jest.fn().mockResolvedValue({
      data: { status: "failed" },
      error: null,
    });

    const manuscriptSingle = jest.fn().mockResolvedValue({
      data: {
        id: 456,
        title: "Canonical Manuscript",
        content: "This manuscript is long enough to pass threshold validation. ".repeat(220),
        work_type: "novel",
        user_id: "00000000-0000-0000-0000-000000000001",
      },
      error: null,
    });

    createClientMock.mockReturnValue({
      evaluationJobUpdates: supabaseStub.evaluationJobUpdates,
      from(table: string) {
        if (table === "evaluation_jobs") {
          return {
            select: () => ({
              eq: () => ({
                single: jobSelectSingle,
                maybeSingle: statusMaybeSingle,
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              supabaseStub.evaluationJobUpdates.push(payload);
              return makeUpdateEqChain({ error: null }, { error: null });
            },
          };
        }

        if (table === "manuscripts") {
          return {
            select: () => ({
              eq: () => ({
                single: manuscriptSingle,
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

        throw new Error(`Unexpected table in SLA terminal-state test stub: ${table}`);
      },
    });

    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-04-24T19:10:00.000Z"));

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-canonical-pipeline");

    expect(result.success).toBe(false);
    expect(runPipelineMock).not.toHaveBeenCalled();
    expect(finalizeJobFailureMock).not.toHaveBeenCalled();

    nowSpy.mockRestore();
  });
});

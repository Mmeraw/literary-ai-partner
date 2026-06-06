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
  QG_MAX_HIGH_SCORE_WHEN_LOW_CONFIDENCE: 5,
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

/**
 * Helper: builds a gate-compliant EvaluationResultV2 mock.
 *
 * Every field satisfies the Template Completeness Gate:
 *  - 13 canonical criteria with confidence_level
 *  - score 9 (no density floor → no recommendations required)
 *  - meaningful rationale, evidence, summary, strengths, risks
 *  - enrichment with diagnosed_genre + target_audience + premise
 */
function makeGateCompliantEvaluationResult(overrides?: Record<string, unknown>) {
  const CRITERION_KEYS = [
    "concept", "narrativeDrive", "character", "voice",
    "sceneConstruction", "dialogue", "theme", "worldbuilding",
    "pacing", "proseControl", "tone", "narrativeClosure", "marketability",
  ];

  return {
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
      one_paragraph_summary:
        "The manuscript demonstrates strong prose control and thematic integration, with a distinctive voice that carries the narrative forward effectively.",
      top_3_strengths: [
        "Exceptional prose control with precise, intentional sentence-level craft throughout the submission.",
        "Strong thematic integration where themes emerge through action and consequence rather than exposition.",
        "Distinctive narrative voice that maintains tonal authority and consistency across all sections.",
      ],
      top_3_risks: [
        "Pacing occasionally stalls in mid-section transitions, reducing narrative momentum between key scenes.",
        "Character psychological coherence wavers when secondary figures appear without sufficient motivation.",
        "World-building environmental details are sparse in interior scenes, weakening spatial grounding.",
      ],
    },
    one_paragraph_summary:
      "The manuscript demonstrates strong prose control and thematic integration, with a distinctive voice that carries the narrative forward effectively.",
    one_sentence_summary:
      "A tonally assured piece with strong craft whose pacing and secondary characterization need tightening.",
    top_3_strengths: [
      "Exceptional prose control with precise, intentional sentence-level craft throughout the submission.",
      "Strong thematic integration where themes emerge through action and consequence rather than exposition.",
      "Distinctive narrative voice that maintains tonal authority and consistency across all sections.",
    ],
    top_3_risks: [
      "Pacing occasionally stalls in mid-section transitions, reducing narrative momentum between key scenes.",
      "Character psychological coherence wavers when secondary figures appear without sufficient motivation.",
      "World-building environmental details are sparse in interior scenes, weakening spatial grounding.",
    ],
    criteria: CRITERION_KEYS.map((key) => ({
      key,
      scorable: true,
      status: "SCORABLE",
      signal_present: true,
      signal_strength: "SUFFICIENT",
      confidence_band: "MEDIUM",
      confidence_level: "Moderate",
      score_0_10: 9,
      rationale:
        "Criterion is well-supported by manuscript evidence and multi-pass synthesis confirms consistent quality.",
      evidence: [
        { snippet: "Evidence anchor from the submitted manuscript demonstrating this criterion in context." },
      ],
      recommendations: [],
    })),
    recommendations: {
      quick_wins: [],
      strategic_revisions: [],
    },
    metrics: {
      manuscript: {
        genre: "literary fiction",
        target_audience: "Adult readers of contemporary literary fiction",
        word_count: 12000,
      },
      processing: {},
    },
    enrichment: {
      premise:
        "A deeply personal narrative exploring identity and transformation through unflinching confessional prose.",
      diagnosed_genre: "Contemporary Literary Fiction",
      target_audience: "Adult readers of contemporary literary fiction",
    },
    artifacts: [],
    governance: {
      confidence: 0.9,
      warnings: [],
      limitations: [],
      policy_family: "multi-pass-dual-axis",
    },
    ...overrides,
  };
}

function makeSupabaseStub() {
  const evaluationJobUpdates: Array<Record<string, unknown>> = [];
  const rpcCalls: Array<{ fn: string; args?: Record<string, unknown> }> = [];
  const providerCallUpserts: Array<Record<string, unknown>> = [];

  const now = new Date();
  const leaseUntil = new Date(now.getTime() + 5 * 60_000).toISOString();

  const queuedJob = {
    id: "job-canonical-pipeline",
    manuscript_id: 456,
    job_type: "evaluate_full",
    status: "running",
    phase: "phase_3",
    phase_status: "running",
    claimed_by: "test-worker",
    worker_id: "test-worker",
    lease_token: "test-lease-token",
    lease_until: leaseUntil,
    lease_expires_at: leaseUntil,
    heartbeat_at: now.toISOString(),
    started_at: now.toISOString(),
    created_at: now.toISOString(),
    progress: { phase: "phase_3", phase_status: "running" },
  };

  const pass12HandoffContent = {
    schema_version: "pass12_handoff_v1",
    pass1Output: { criteria: [], overall: {}, metadata: {} },
    pass2Output: { criteria: [], overall: {}, metadata: {} },
    chunk_count: 1,
    partial_capture: false,
  };

  const acceptedStoryLedgerContent = {
    schema_version: "accepted_story_ledger_v1",
    governance_rail: {
      mode: "accepted",
      accepted_at: new Date().toISOString(),
      source: "canonical-pipeline-test",
      layer_decisions: {
        identity: { decision: "accept" },
        structure: { decision: "accept" },
        character: { decision: "accept" },
        pressure: { decision: "accept" },
        scene: { decision: "accept" },
        voice: { decision: "accept" },
        theme: { decision: "accept" },
        continuity: { decision: "accept" },
        source_integrity: { decision: "accept" },
      },
    },
    corrections: [],
    story_layer: {},
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
    providerCallUpserts,
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
            eq: () => {
              const query: any = {
                eq: () => query,
                single: async () => ({ data: queuedJob, error: null }),
                maybeSingle: async () => ({ data: { status: queuedJob.status }, error: null }),
              };
              return query;
            },
          }),
          update: (payload: Record<string, unknown>) => {
            evaluationJobUpdates.push(payload);
            const query: any = {
              eq: () => query,
              select: () => ({
                single: async () => ({ data: queuedJob, error: null }),
                maybeSingle: async () => ({ data: queuedJob, error: null }),
                eq: () => query,
              }),
              then: (resolve: (value: { error: null }) => void) =>
                resolve({ error: null }),
            };
            return query;
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
      if (table === "evaluation_provider_calls") {
        const providerCallQuery: any = {
          eq: () => providerCallQuery,
          maybeSingle: async () => ({ data: null, error: null }),
          single: async () => ({ data: null, error: null }),
        };
        return {
          select: () => providerCallQuery,
          upsert: async (
            payload: Record<string, unknown> | Array<Record<string, unknown>>,
          ) => {
            if (Array.isArray(payload)) {
              providerCallUpserts.push(...payload);
            } else {
              providerCallUpserts.push(payload);
            }
            return { data: null, error: null };
          },
        };
      }

      if (table === "evaluation_artifacts") {
        return {
          select: () => {
            let artifactType = "";
            const query: any = {
              eq: (col?: string, val?: any) => {
                if (col === "artifact_type" && typeof val === "string") artifactType = val;
                return query;
              },
              maybeSingle: async () => {
                if (artifactType === "pass12_handoff_v1") {
                  return {
                    data: {
                      id: "artifact-pass12-handoff",
                      job_id: "job-canonical-pipeline",
                      manuscript_id: 456,
                      artifact_type: "pass12_handoff_v1",
                      source_hash: "sha256:pass12-handoff",
                      content: pass12HandoffContent,
                    },
                    error: null,
                  };
                }
                if (artifactType === "accepted_story_ledger_v1") {
                  return {
                    data: {
                      id: "artifact-accepted-ledger",
                      job_id: "job-canonical-pipeline",
                      manuscript_id: 456,
                      artifact_type: "accepted_story_ledger_v1",
                      source_hash: "sha256:accepted-ledger",
                      content: acceptedStoryLedgerContent,
                    },
                    error: null,
                  };
                }
                if (artifactType === "evaluation_result_v2") {
                  return { data: null, error: null };
                }
                return { data: { id: "artifact-canonical-pass" }, error: null };
              },
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
  jest.setTimeout(30000);

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
          one_paragraph_summary: "The manuscript demonstrates strong prose control and thematic integration.",
          top_3_strengths: [
            "Exceptional prose control throughout the submission.",
            "Strong thematic integration through action and consequence.",
            "Distinctive narrative voice with tonal authority.",
          ],
          top_3_risks: [
            "Pacing occasionally stalls in mid-section transitions.",
            "Character coherence wavers for secondary figures.",
            "World-building details are sparse in interior scenes.",
          ],
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
      provider_telemetry: [
        {
          job_id: "job-canonical-pipeline",
          pass: 1,
          provider: "openai",
          model: "gpt-5.1",
          request_id: "req-pass1",
          finish_reason: "stop",
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
          started_at: "2026-05-17T10:00:00.000Z",
          completed_at: "2026-05-17T10:00:01.000Z",
          duration_ms: 1000,
          success: true,
        },
        {
          job_id: "job-canonical-pipeline",
          pass: 2,
          provider: "openai",
          model: "gpt-5.1",
          request_id: "req-pass2",
          finish_reason: "stop",
          usage: { prompt_tokens: 120, completion_tokens: 60, total_tokens: 180 },
          started_at: "2026-05-17T10:00:02.000Z",
          completed_at: "2026-05-17T10:00:03.000Z",
          duration_ms: 1000,
          success: true,
        },
        {
          job_id: "job-canonical-pipeline",
          pass: 3,
          provider: "openai",
          model: "gpt-5.1",
          request_id: "req-pass3",
          finish_reason: "stop",
          usage: { prompt_tokens: 140, completion_tokens: 70, total_tokens: 210 },
          started_at: "2026-05-17T10:00:04.000Z",
          completed_at: "2026-05-17T10:00:05.000Z",
          duration_ms: 1000,
          success: true,
        },
      ],
    });

    synthesisToEvaluationResultV2Mock.mockReturnValue(makeGateCompliantEvaluationResult());

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
    expect(upsertEvaluationArtifactMock).not.toHaveBeenCalled();
    expect(
      supabaseStub.rpcCalls.some((call: { fn: string }) => call.fn === "persist_evaluation_v2_atomic"),
    ).toBe(true);

    expect(
      supabaseStub.evaluationJobUpdates.some(
        (payload: Record<string, unknown>) => payload.status === "failed",
      ),
    ).toBe(false);
    expect(supabaseStub.providerCallUpserts).toHaveLength(3);
    expect(supabaseStub.providerCallUpserts[0]).toEqual(
      expect.objectContaining({
        job_id: "job-canonical-pipeline",
        phase: "phase_1a",
        provider: "openai",
      }),
    );

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
          one_paragraph_summary: "The manuscript demonstrates strong prose control and thematic integration.",
          top_3_strengths: [
            "Exceptional prose control throughout the submission.",
            "Strong thematic integration through action and consequence.",
            "Distinctive narrative voice with tonal authority.",
          ],
          top_3_risks: [
            "Pacing occasionally stalls in mid-section transitions.",
            "Character coherence wavers for secondary figures.",
            "World-building details are sparse in interior scenes.",
          ],
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

    synthesisToEvaluationResultV2Mock.mockReturnValue(makeGateCompliantEvaluationResult());

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

  test("persists downgradedResult when quality gate provides explicit non-mutating downgrade", async () => {
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);

    runPipelineMock.mockResolvedValue({
      ok: true,
      synthesis: {
        criteria: [],
        overall: {
          overall_score_0_100: 82,
          verdict: "pass",
          one_paragraph_summary: "The manuscript demonstrates strong prose control and thematic integration.",
          top_3_strengths: [
            "Exceptional prose control throughout the submission.",
            "Strong thematic integration through action and consequence.",
            "Distinctive narrative voice with tonal authority.",
          ],
          top_3_risks: [
            "Pacing occasionally stalls in mid-section transitions.",
            "Character coherence wavers for secondary figures.",
            "World-building details are sparse in interior scenes.",
          ],
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

    const baseEvaluationResult = makeGateCompliantEvaluationResult();

    synthesisToEvaluationResultV2Mock.mockReturnValue(baseEvaluationResult);

    const downgradedResult = {
      ...baseEvaluationResult,
      criteria: baseEvaluationResult.criteria.map((criterion: any) =>
        criterion.key !== "concept"
          ? criterion
          : {
              ...criterion,
              scorable: false,
              status: "INSUFFICIENT_SIGNAL",
              signal_strength: "WEAK",
              score_0_10: null,
              scorability_status: "non_scorable",
              model_emitted_score_unverified: 7,
              insufficient_signal_reason: {
                looked_for: ["CERTIFIED_ANCHORS_FOR_HIGH_CONFIDENCE_SCORING"],
                not_found: ["LOW_CONFIDENCE_HIGH_SCORE_WITHOUT_CERTIFIED_ANCHORS"],
              },
            },
      ),
    };

    runQualityGateV2Mock.mockReturnValue({
      pass: true,
      checks: [],
      warnings: [],
      downgradedResult,
    });

    mapEvaluationResultV2ToGovernanceEnvelopeMock.mockReturnValue({
      evaluation_run_id: "run-1",
      criteria: [],
    });

    upsertEvaluationArtifactMock.mockResolvedValue("artifact-1");

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");

    const result = await processEvaluationJob("job-canonical-pipeline");
    expect(result.success).toBe(true);

    const persistCall = supabaseStub.rpcCalls.find(
      (call: { fn: string }) => call.fn === "persist_evaluation_v2_atomic",
    ) as { fn: string; args?: Record<string, unknown> } | undefined;
    expect(persistCall).toBeDefined();

    const persistedEvaluationResult = persistCall?.args?.p_evaluation_result as
      | Record<string, unknown>
      | undefined;
    expect(persistedEvaluationResult).toBeDefined();

    const persistedCriteria = persistedEvaluationResult?.criteria as
      | Array<Record<string, unknown>>
      | undefined;
    const persistedConcept = persistedCriteria?.find((criterion) => criterion.key === "concept");
    expect(persistedConcept).toEqual(
      expect.objectContaining({
        status: "INSUFFICIENT_SIGNAL",
        score_0_10: null,
        model_emitted_score_unverified: 7,
      }),
    );

    expect((baseEvaluationResult.criteria[0] as Record<string, unknown>).status).toBe("SCORABLE");
    expect((baseEvaluationResult.criteria[0] as Record<string, unknown>).score_0_10).toBe(7);
  });

  test("uncaught processor fallback persists failure metadata when atomic finalization fails", async () => {
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);

    supabaseStub.rpc = async (fn: string) => {
      if (fn === "finalize_job_failure_atomic") {
        return {
          data: null,
          error: { message: "rpc unavailable" },
        };
      }

      if (fn === "persist_evaluation_v2_atomic") {
        return {
          data: [{ artifact_id: "artifact-canonical-pass" }],
          error: null,
        };
      }

      return { data: null, error: null };
    };

    runPipelineMock.mockRejectedValue(new Error("boom during pipeline"));

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-canonical-pipeline");

    expect(result.success).toBe(false);
    expect(result.error).toContain("boom during pipeline");

    const fallbackWrite = supabaseStub.evaluationJobUpdates.find(
      (payload: Record<string, any>) => payload?.failure_code === "PROCESSOR_UNCAUGHT_ERROR",
    ) as Record<string, any> | undefined;

    expect(fallbackWrite).toBeDefined();
    expect(fallbackWrite).toEqual(
      expect.objectContaining({
        status: "failed",
        phase: "phase_3",
        phase_status: "failed",
        failure_code: "PROCESSOR_UNCAUGHT_ERROR",
        claimed_by: null,
        claimed_at: null,
        lease_token: null,
      }),
    );
    expect(fallbackWrite?.progress).toEqual(
      expect.objectContaining({
        phase_status: "failed",
        error_code: "PROCESSOR_UNCAUGHT_ERROR",
        failed_at: expect.any(String),
      }),
    );
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

    // Diagnostic artifacts ARE persisted on V2 gate failure (for reconstructability).
    // No evaluation_result_v2 user-facing artifact must be written.
    const artifactTypes = (upsertEvaluationArtifactMock.mock.calls as any[]).map(
      (call: any[]) => call[0]?.artifactType,
    );
    expect(artifactTypes.includes("evaluation_result_v2")).toBe(false);
    expect(
      supabaseStub.rpcCalls.some((call: { fn: string }) => call.fn === "persist_evaluation_v2_atomic"),
    ).toBe(false);

    expect(
      supabaseStub.evaluationJobUpdates.some(
        (payload: Record<string, unknown>) => payload.status === "complete",
      ),
    ).toBe(false);
  });

  test("fails closed with PIPELINE_SLA_EXCEEDED before runPipeline when hard SLA is already exceeded", async () => {
    const supabaseStub = makeSupabaseStub();
    const expiredStartedAt = "2026-01-01T00:00:00.000Z";

    createClientMock.mockReturnValue({
      ...supabaseStub,
      from(table: string) {
        if (table === "evaluation_jobs") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: "job-canonical-pipeline",
                    manuscript_id: 456,
                    job_type: "evaluate_full",
                    status: "running",
                    phase: "phase_3",
                    phase_status: "running",
                    claimed_by: "test-worker",
                    lease_token: "test-lease-token",
                    lease_expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
                    created_at: expiredStartedAt,
                    started_at: expiredStartedAt,
                    progress: { phase: "phase_3", phase_status: "running" },
                  },
                  error: null,
                }),
                maybeSingle: async () => ({ data: { status: "running" }, error: null }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              supabaseStub.evaluationJobUpdates.push(payload);
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
                single: async () => ({
                  data: {
                    id: 456,
                    title: "Canonical Manuscript",
                    content: "This manuscript is long enough to pass threshold validation. ".repeat(220),
                    work_type: "novel",
                    user_id: "00000000-0000-0000-0000-000000000001",
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
              let artifactType = "";
              const query: any = {
                eq: (col?: string, val?: any) => {
                  if (col === "artifact_type" && typeof val === "string") artifactType = val;
                  return query;
                },
                maybeSingle: async () => {
                  if (artifactType === "pass12_handoff_v1") {
                    return {
                      data: {
                        id: "artifact-pass12-handoff",
                        job_id: "job-canonical-pipeline",
                        manuscript_id: 456,
                        artifact_type: "pass12_handoff_v1",
                        source_hash: "sha256:pass12-handoff",
                        content: pass12HandoffContent,
                      },
                      error: null,
                    };
                  }
                  if (artifactType === "accepted_story_ledger_v1") {
                    return {
                      data: {
                        id: "artifact-accepted-ledger",
                        job_id: "job-canonical-pipeline",
                        manuscript_id: 456,
                        artifact_type: "accepted_story_ledger_v1",
                        source_hash: "sha256:accepted-ledger",
                        content: acceptedStoryLedgerContent,
                      },
                      error: null,
                    };
                  }
                  if (artifactType === "evaluation_result_v2") {
                    return { data: null, error: null };
                  }
                  return { data: { id: "artifact-canonical-pass" }, error: null };
                },
              };
              return query;
            },
          };
        }

        throw new Error(`Unexpected table in SLA exceeded test stub: ${table}`);
      },
    });

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-canonical-pipeline");

    expect(result.success).toBe(false);
    expect(runPipelineMock).not.toHaveBeenCalled();
    expect(
      supabaseStub.rpcCalls.some((call: { fn: string }) => call.fn === "finalize_job_failure_atomic"),
    ).toBe(true);
  });

  test("does not re-finalize when SLA guard sees an already-terminal job", async () => {
    const supabaseStub = makeSupabaseStub();
    const expiredStartedAt = "2026-01-01T00:00:00.000Z";

    createClientMock.mockReturnValue({
      ...supabaseStub,
      from(table: string) {
        if (table === "evaluation_jobs") {
          return {
            select: () => ({
              eq: () => {
                const query: any = {
                  eq: () => query,
                  single: async () => ({
                    data: {
                      id: "job-canonical-pipeline",
                      manuscript_id: 456,
                      job_type: "evaluate_full",
                      status: "failed",
                      phase: "phase_3",
                      phase_status: "failed",
                      claimed_by: "test-worker",
                      lease_token: "test-lease-token",
                      lease_expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
                      created_at: expiredStartedAt,
                      started_at: expiredStartedAt,
                      progress: { phase: "phase_3", phase_status: "failed" },
                    },
                    error: null,
                  }),
                  maybeSingle: async () => ({ data: { status: "failed" }, error: null }),
                };
                return query;
              },
            }),
            update: (payload: Record<string, unknown>) => {
              supabaseStub.evaluationJobUpdates.push(payload);
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
                single: async () => ({
                  data: {
                    id: 456,
                    title: "Canonical Manuscript",
                    content: "This manuscript is long enough to pass threshold validation. ".repeat(220),
                    work_type: "novel",
                    user_id: "00000000-0000-0000-0000-000000000001",
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
                maybeSingle: async () => ({ data: null, error: null }),
              };
              return query;
            },
          };
        }

        // Other tables (provider_calls, etc.) — absorb writes silently.
        return {
          upsert: async () => ({ data: null, error: null }),
          insert: async () => ({ data: null, error: null }),
          select: () => ({
            eq: () => ({ single: async () => ({ data: null, error: null }) }),
          }),
        };
      },
    });

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-canonical-pipeline");

    expect(result.success).toBe(false);
    expect(runPipelineMock).not.toHaveBeenCalled();
    expect(
      supabaseStub.rpcCalls.some((call: { fn: string }) => call.fn === "finalize_job_failure_atomic"),
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
              submission_readiness: "nearly_ready",
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

  test("Phase 3 failure re-queues for retry instead of immediately failing", async () => {
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);

    runPipelineMock.mockResolvedValue({
      ok: false,
      failed_at: "pass3",
      error_code: "PASS3_FAILED",
      error: "Pass 3 arbitration failed",
      failure_details: {
        arbitration: {
          reason: "insufficient consensus",
        },
      },
    });

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-canonical-pipeline");

    expect(result.success).toBe(false);

    // Phase 3 crash recovery: first failure re-queues instead of marking failed.
    const requeuePatch = supabaseStub.evaluationJobUpdates.find(
      (payload: Record<string, any>) =>
        payload?.status === "queued" && payload?.phase === "phase_3",
    ) as Record<string, any> | undefined;

    expect(requeuePatch).toBeDefined();
    expect(requeuePatch?.phase_status).toBe("queued");
    expect(requeuePatch?.progress?.phase_3_retry_count).toBe(1);
    expect(requeuePatch?.last_error).toMatch(/Phase 3 retry 1\/2/);
  });

  test("logs artifact validation result in governance transparency (logging mode only)", async () => {
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);

    runPipelineMock.mockResolvedValue({
      ok: true,
      synthesis: {
        criteria: [],
        overall: {
          overall_score_0_100: 82,
          verdict: "pass",
          one_paragraph_summary: "The manuscript demonstrates strong prose control and thematic integration.",
          top_3_strengths: [
            "Exceptional prose control throughout the submission.",
            "Strong thematic integration through action and consequence.",
            "Distinctive narrative voice with tonal authority.",
          ],
          top_3_risks: [
            "Pacing occasionally stalls in mid-section transitions.",
            "Character coherence wavers for secondary figures.",
            "World-building details are sparse in interior scenes.",
          ],
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

    synthesisToEvaluationResultV2Mock.mockReturnValue(
      makeGateCompliantEvaluationResult({
        ids: {
          evaluation_run_id: "run-log-mode-1",
          manuscript_id: 456,
          user_id: "00000000-0000-0000-0000-000000000001",
        },
        governance: {
          confidence: 0.9,
          warnings: [],
          limitations: [],
          policy_family: "multi-pass-dual-axis",
          transparency: {},
        },
      }),
    );

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

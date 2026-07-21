export {};

import {
  makeCurrentProcessorEvaluationResult,
  type ProcessorEvaluationResultFixtureOverrides,
} from "./test-fixtures/currentProcessorEvaluationResult";

const runPipelineMock = jest.fn();
const synthesisToEvaluationResultV2Mock = jest.fn();
const runQualityGateV2Mock = jest.fn();
const mapEvaluationResultV2ToGovernanceEnvelopeMock = jest.fn();
const evaluateArtifactConsistencyGateV1Mock = jest.fn();
const validateTemplateCompletenessMock = jest.fn();
const mockCurrentProcessorEvaluationResult = (
  value: ProcessorEvaluationResultFixtureOverrides,
) => makeCurrentProcessorEvaluationResult(value);

jest.mock("@/lib/evaluation/pipeline/runPipeline", () => ({
  runPipeline: (...args: any[]) => runPipelineMock(...args),
  synthesisToEvaluationResultV2: (...args: any[]) =>
    mockCurrentProcessorEvaluationResult(synthesisToEvaluationResultV2Mock(...args)),
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

jest.mock("@/lib/evaluation/artifactPersistence", () => ({
  stableSourceHash: () => "sha256:test-hash",
  upsertEvaluationArtifact: (...args: any[]) => upsertEvaluationArtifactMock(...args),
}));

const repairSynthesisIntegrityMock = jest.fn();

const OpenAIMock = jest.fn(() => ({
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/evaluation/pipeline/repairSynthesisIntegrity", () => ({
  repairSynthesisIntegrity: (...args: unknown[]) => repairSynthesisIntegrityMock(...args),
}));

jest.mock("openai", () => ({
  __esModule: true,
  default: OpenAIMock,
}));

jest.mock("@/lib/evaluation/pipeline/templateCompletenessGate", () => ({
  validateTemplateCompleteness: (...args: any[]) => validateTemplateCompletenessMock(...args),
  selectTemplateCompletenessFailureCode: (result: {
    violations: Array<{ code: string; severity: string }>;
  }) => {
    const opportunityCoverageCodes = new Set([
      "RECOMMENDATION_STATUS_INVALID",
      "RECOMMENDATION_STATUS_CARDINALITY_MISMATCH",
      "OPPORTUNITY_COVERAGE_MISSING",
      "RECOMMENDATION_STATUS_RATIONALE_MISSING",
    ]);
    const critical = result.violations.filter((violation) => violation.severity === "critical");
    return critical.length > 0 && critical.every((violation) => opportunityCoverageCodes.has(violation.code))
      ? "CRITERION_OPPORTUNITY_COVERAGE_INVALID"
      : "TEMPLATE_COMPLETENESS_GATE_FAILED";
  },
  TEMPLATE_COMPLETENESS_USER_MESSAGE: "quality issue",
}));

jest.mock("@/lib/evaluation/artifactConsistencyGate", () => ({
  evaluateArtifactConsistencyGateV1: (...args: any[]) => evaluateArtifactConsistencyGateV1Mock(...args),
}));

// Contract-compliant UED fixture: proves one canonical ledger → one report → all renderers.
// Every opportunity has all 9 required fields per revision_opportunity_ledger_v1.
// No legacy strategic_revisions or quick_wins as independent inventories.
// Top Recommendations summarize/paraphrase — they do not duplicate opportunity text verbatim.
jest.mock("@/lib/evaluation/reportRenderParity", () => ({
  inferCanonicalEvaluationModeFromWordCount: () => "short_form_evaluation",
  buildUnifiedDocumentForParityFromEvaluationResult: () => ({
    schema_version: "unified_evaluation_document_v1",
    templateMode: "short_form_evaluation",
    sections: [],
    criterionDetails: [
      {
        label: "Narrative Drive & Momentum",
        score: 7,
        confidence: "MEDIUM",
        rationaleText: "The manuscript maintains consistent forward momentum through the first two acts, with scene transitions that reliably escalate tension.",
        recommendations: [
          {
            opportunity_id: "opp-001",
            criterion: "Narrative Drive & Momentum",
            severity: "high",
            evidence: "Chapters 12–14 contain three consecutive scenes without rising tension or new information.",
            symptom: "Reader momentum stalls in the mid-manuscript transition between acts.",
            cause: "Scene transitions rely on geographic movement rather than escalating stakes.",
            fix_direction: "Introduce a micro-complication or unanswered question at each scene boundary.",
            reader_effect: "Reader will feel continuous forward pull rather than a mid-book plateau.",
            mistake_proofing: "Each scene exit must raise a question the next scene partially answers.",
            action: "Sharpen scene transitions in chapters 12–14 to escalate tension at each boundary.",
          },
        ],
      },
      {
        label: "Character Depth & Psychological Coherence",
        score: 6,
        confidence: "MEDIUM",
        rationaleText: "Primary character arc is well-developed; secondary arcs lack continuity in the final third.",
        recommendations: [
          {
            opportunity_id: "opp-002",
            criterion: "Character Depth & Psychological Coherence",
            severity: "medium",
            evidence: "Marcus's subplot disappears between chapters 18–22 with no narrative acknowledgment.",
            symptom: "Secondary character arc feels abandoned rather than resolved.",
            cause: "Subplot threads were not tracked across the final act outline.",
            fix_direction: "Add at least one beat per secondary character in the final act that closes or transforms their arc.",
            reader_effect: "Reader will perceive a complete ensemble rather than a protagonist-only story.",
            mistake_proofing: "Character continuity checklist: every named subplot must have a final-act resolution or explicit deferral.",
            action: "Strengthen secondary character arc continuity in the final third.",
          },
        ],
      },
    ],
    revisionOpportunitySummary: { total: 2, high: 1, medium: 1, low: 0 },
    canonicalOpportunityLedger: {
      opportunities: [
        { opportunity_id: "opp-001" },
        { opportunity_id: "opp-002" },
      ],
      rendered_opportunities: [
        { opportunity_id: "opp-001" },
        { opportunity_id: "opp-002" },
      ],
    },
    topRecommendations: [
      "Prioritize scene-boundary tension to maintain mid-manuscript momentum.",
      "Ensure secondary character arcs receive final-act closure.",
    ],
  }),
  buildReportRenderManifestV1: () => ({
    schema_version: "report_render_manifest_v1",
    parity_status: "pass",
    blocking_reasons: [],
    consumed_field_paths: [],
  }),
  buildAuthorExposureCertificationV1FromManifest: () => ({
    schema_version: "author_exposure_certification_v1",
    decision: "certified",
    blocking_reasons: [],
    dcip_compliance: {
      status: "pass",
      canonical_path: "docs/governance/DREAM-COGNITIVE-INITIALIZATION-PROTOCOL-V1.md",
      evidence: ["mocked_canonical_pipeline"],
      reasons: [],
    },
  }),
}));

const createClientMock = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: any[]) => createClientMock(...args),
}));

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

function makeSupabaseStub(options?: {
  progress?: Record<string, unknown>;
  existingEvaluationResultContent?: Record<string, unknown>;
}) {
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
    progress: options?.progress ?? { phase: "phase_3", phase_status: "running" },
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
          select: (selectedColumns?: string) => {
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
                  if (options?.existingEvaluationResultContent) {
                    return selectedColumns === "job_id"
                      ? { data: { job_id: queuedJob.id }, error: null }
                      : {
                          data: { content: options.existingEvaluationResultContent },
                          error: null,
                        };
                  }
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

    evaluateArtifactConsistencyGateV1Mock.mockReturnValue({
      schema_version: "artifact_consistency_gate_v1",
      created_at: new Date().toISOString(),
      generated_at: new Date().toISOString(),
      source_artifact: "evaluation_result_v2",
      status: "pass",
      blocking_reasons: [],
      checked_invariants: [
        "summary_criteria_bottom_weakness_alignment",
        "recommendation_criterion_traceability",
      ],
      checks: [],
      source_result_hash: "sha256:source",
      effective_qg_result_hash: "sha256:effective",
      qg_normalized: true,
    });

    validateTemplateCompletenessMock.mockReturnValue({
      pass: true,
      violations: [],
      warnings: [],
      summary: "ok",
    });

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.OPENAI_API_KEY = "sk-test-key";
    process.env.EVAL_PASS_TIMEOUT_MS = "180000";
    process.env.EVAL_OPENAI_TIMEOUT_MS = "180000";
    process.env.EVAL_EXTERNAL_ADJUDICATION_MODE = "optional";
    // Ensure timeout config passes the invariant check (openAi >= pass)
    process.env.EVAL_PASS_TIMEOUT_MS = "180000";
    process.env.EVAL_OPENAI_TIMEOUT_MS = "180000";

    // Canonical pipeline tests exercise the gate and persistence contracts, not
    // the repair implementation. Keep repair as a transparent pass-through so an
    // unconfigured OpenAI mock cannot leak a raw TypeError into these tests.
    repairSynthesisIntegrityMock.mockImplementation(async (synthesis: unknown) => ({
      ok: true,
      synthesis,
      requiredAttempts: 0,
      candidateAttempts: 0,
      regeneratedFields: [],
      quarantinedFields: [],
      remainingViolations: [],
      telemetry: {
        requiredAttempts: 0,
        candidateAttempts: 0,
        regeneratedFields: [],
        quarantinedFields: [],
      },
    }));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  function configureOpportunityCoverageViolationPath(options?: { includeUnrelatedTemplateDefect?: boolean }) {
    runPipelineMock.mockResolvedValue({
      ok: true,
      synthesis: {
        criteria: [],
        overall: {
          overall_score_0_100: 72,
          verdict: "revise",
          one_paragraph_summary: "Summary.",
          top_3_strengths: ["Clear premise"],
          top_3_risks: ["Scene progression needs revision"],
        },
        metadata: {
          pass1_model: "gpt-4o",
          pass2_model: "o3",
          pass3_model: "o3",
          generated_at: new Date().toISOString(),
        },
      },
      quality_gate: { pass: true, checks: [], warnings: [] },
      pass4_governance: { ok: true },
    });

    synthesisToEvaluationResultV2Mock.mockReturnValue({
      schema_version: "evaluation_result_v2",
      ids: {
        evaluation_run_id: "run-opportunity-coverage",
        manuscript_id: 456,
        user_id: "00000000-0000-0000-0000-000000000001",
      },
      generated_at: new Date().toISOString(),
      engine: { model: "o3", provider: "openai", prompt_version: "test" },
      overview: {
        verdict: "revise",
        overall_score_0_100: 72,
        one_paragraph_summary: "Summary.",
        top_3_strengths: ["Clear premise"],
        top_3_risks: ["Scene progression needs revision"],
      },
      criteria: [],
      recommendations: { quick_wins: [], strategic_revisions: [] },
      metrics: { manuscript: {}, processing: {} },
      artifacts: [],
      governance: {
        confidence: 0.8,
        warnings: [],
        limitations: [],
        policy_family: "multi-pass-dual-axis",
      },
    });

    runQualityGateV2Mock.mockReturnValue({ pass: true, checks: [], warnings: [] });
    mapEvaluationResultV2ToGovernanceEnvelopeMock.mockReturnValue({
      evaluation_run_id: "run-opportunity-coverage",
      criteria: [],
    });
    upsertEvaluationArtifactMock.mockResolvedValue("artifact-observability-only");
    const violations = [
      {
        code: "RECOMMENDATION_STATUS_CARDINALITY_MISMATCH",
        criterion: "sceneConstruction",
        field_path: "criteria.sceneConstruction.recommendation_status",
        invariant_id: "OPPORTUNITY_COVERAGE_STATUS_CARDINALITY",
        severity: "critical",
        message: "recommendation_provided cannot accompany zero recommendations",
      },
    ];
    if (options?.includeUnrelatedTemplateDefect) {
      violations.push({
        code: "MISSING_ONE_SENTENCE_PITCH",
        criterion: "",
        field_path: "enrichment.premise",
        invariant_id: "required_template_field_present",
        severity: "critical",
        message: "Template requires a substantive one-sentence pitch.",
      });
    }

    validateTemplateCompletenessMock.mockReturnValue({
      pass: false,
      violations,
      warnings: [],
      summary: "One criterion has contradictory recommendation status and cardinality.",
    });
  }

  test("opportunity coverage contradiction kicks Pass 3 once, then fails closed without canonical persistence", async () => {
    configureOpportunityCoverageViolationPath();

    const firstAttempt = makeSupabaseStub();
    createClientMock.mockReturnValue(firstAttempt);

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const kicked = await processEvaluationJob("job-canonical-pipeline");

    expect(kicked).toEqual(expect.objectContaining({ success: false }));
    expect(kicked.error).toContain("[FIPOC-KICK]");
    expect(firstAttempt.evaluationJobUpdates).toContainEqual(
      expect.objectContaining({
        status: "queued",
        phase: "phase_3",
        phase_status: "queued",
        progress: expect.objectContaining({
          kick_attempts: {
            CRITERION_OPPORTUNITY_COVERAGE_INVALID: 1,
          },
          last_kick_failure_code: "CRITERION_OPPORTUNITY_COVERAGE_INVALID",
        }),
      }),
    );
    expect(
      firstAttempt.rpcCalls.some((call) => call.fn === "persist_evaluation_v2_atomic"),
    ).toBe(false);
    expect(
      firstAttempt.rpcCalls.some((call) => call.fn === "finalize_job_failure_atomic"),
    ).toBe(false);

    configureOpportunityCoverageViolationPath();
    const exhaustedAttempt = makeSupabaseStub({
      progress: {
        phase: "phase_3",
        phase_status: "running",
        kick_attempts: { CRITERION_OPPORTUNITY_COVERAGE_INVALID: 1 },
      },
    });
    createClientMock.mockReturnValue(exhaustedAttempt);

    const exhausted = await processEvaluationJob("job-canonical-pipeline");

    expect(exhausted).toEqual(expect.objectContaining({ success: false }));
    expect(
      exhaustedAttempt.rpcCalls.some((call) => call.fn === "persist_evaluation_v2_atomic"),
    ).toBe(false);
    expect(exhaustedAttempt.rpcCalls).toContainEqual(
      expect.objectContaining({
        fn: "finalize_job_failure_atomic",
        args: expect.objectContaining({
          p_failure_code: "CRITERION_OPPORTUNITY_COVERAGE_INVALID",
        }),
      }),
    );
  });

  test("mixed opportunity coverage and unrelated template defects remain terminal and never requeue or persist", async () => {
    configureOpportunityCoverageViolationPath({ includeUnrelatedTemplateDefect: true });
    const mixedFailure = makeSupabaseStub();
    createClientMock.mockReturnValue(mixedFailure);

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-canonical-pipeline");

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(mixedFailure.evaluationJobUpdates).not.toContainEqual(
      expect.objectContaining({ status: "queued", phase: "phase_3" }),
    );
    expect(mixedFailure.rpcCalls).toContainEqual(
      expect.objectContaining({
        fn: "finalize_job_failure_atomic",
        args: expect.objectContaining({
          p_failure_code: "TEMPLATE_COMPLETENESS_GATE_FAILED",
        }),
      }),
    );
    expect(
      mixedFailure.rpcCalls.some((call) => call.fn === "persist_evaluation_v2_atomic"),
    ).toBe(false);
  });

  test("clears the WAVE lease-renewal interval when an existing evaluation artifact has no synthesis", async () => {
    const supabaseStub = makeSupabaseStub({
      existingEvaluationResultContent: {
        schema_version: "evaluation_result_v2",
        criteria: [],
      },
    });
    createClientMock.mockReturnValue(supabaseStub);

    const setIntervalSpy = jest.spyOn(global, "setInterval");
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");

    try {
      const { processEvaluationJob } = require("../../../lib/evaluation/processor");
      const result = await processEvaluationJob("job-canonical-pipeline");

      expect(result).toEqual({ success: true });
      expect(upsertEvaluationArtifactMock).toHaveBeenCalledWith(
        expect.objectContaining({
          artifactType: "wave_revision_plan_v1",
          content: expect.objectContaining({
            status: "failed",
            reason_code: "PHASE3_SYNTHESIS_MISSING",
          }),
        }),
      );

      const waveLeaseCallIndex = setIntervalSpy.mock.calls.findIndex(
        ([, intervalMs]) => intervalMs === 30_000,
      );
      expect(waveLeaseCallIndex).toBeGreaterThanOrEqual(0);
      const waveLeaseHandle = setIntervalSpy.mock.results[waveLeaseCallIndex]?.value;
      expect(waveLeaseHandle).toBeDefined();
      expect(clearIntervalSpy).toHaveBeenCalledWith(waveLeaseHandle);
    } finally {
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    }
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
          one_paragraph_summary: "Summary.",
          top_3_strengths: ["Clear narrative throughline"],
          top_3_risks: ["Secondary character arc needs deepening"],
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
        one_paragraph_summary: "Summary.",
        top_3_strengths: ["Clear narrative throughline"],
        top_3_risks: ["Secondary character arc needs deepening"],
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
        quick_wins: [
          {
            action: "Sharpen scene transitions for momentum.",
            why: "Smoother transitions preserve narrative drive between beats.",
          },
        ],
        strategic_revisions: [
          {
            action: "Strengthen secondary character arc continuity.",
            why: "Consistent subplot escalation reinforces emotional payoff.",
          },
        ],
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

    upsertEvaluationArtifactMock.mockImplementation(async (args: { artifactType?: string }) => {
      if (args.artifactType === "post_qg_effective_snapshot_v1") {
        throw new Error("snapshot write unavailable");
      }
      return "artifact-1";
    });

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
    const persistedArtifactTypes = (upsertEvaluationArtifactMock.mock.calls as any[]).map(
      (call: any[]) => call[0]?.artifactType,
    );
    expect(persistedArtifactTypes).toEqual(
      expect.arrayContaining([
        "post_qg_effective_snapshot_v1",
        "unified_evaluation_document_v1",
        "report_render_manifest_v1",
        "author_exposure_certification_v1",
      ]),
    );
    expect(persistedArtifactTypes).not.toContain("evaluation_result_v2");
    expect(persistedArtifactTypes).not.toContain("failure_diagnosis_v1");
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
          one_paragraph_summary: "Summary.",
          top_3_strengths: ["Clear narrative throughline"],
          top_3_risks: ["Secondary character arc needs deepening"],
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
        one_paragraph_summary: "Summary.",
        top_3_strengths: ["Clear narrative throughline"],
        top_3_risks: ["Secondary character arc needs deepening"],
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
        quick_wins: [
          {
            action: "Sharpen scene transitions for momentum.",
            why: "Smoother transitions preserve narrative drive between beats.",
          },
        ],
        strategic_revisions: [
          {
            action: "Strengthen secondary character arc continuity.",
            why: "Consistent subplot escalation reinforces emotional payoff.",
          },
        ],
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
      upsertEvaluationArtifactMock.mock.calls.some(
        (call: any[]) => call[0]?.artifactType === "post_qg_effective_snapshot_v1",
      ),
    ).toBe(true);
    expect(
      supabaseStub.rpcCalls.filter((call: { fn: string }) => call.fn === "persist_evaluation_v2_atomic"),
    ).toHaveLength(1);
    expect(
      supabaseStub.evaluationJobUpdates.some(
        (payload: Record<string, unknown>) => payload.status === "complete",
      ),
    ).toBe(false);
  });

  test("continues persistence and finalization when QualityGateV2 reports only log-only dirty diagnostics", async () => {
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);

    runPipelineMock.mockResolvedValue({
      ok: true,
      synthesis: {
        criteria: [],
        overall: {
          overall_score_0_100: 82,
          verdict: "pass",
          one_paragraph_summary: "Summary.",
          top_3_strengths: ["Clear narrative throughline"],
          top_3_risks: ["Secondary character arc needs deepening"],
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
        one_paragraph_summary: "Summary.",
        top_3_strengths: ["Clear narrative throughline"],
        top_3_risks: ["Secondary character arc needs deepening"],
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
        quick_wins: [
          {
            action: "Sharpen scene transitions for momentum.",
            why: "Smoother transitions preserve narrative drive between beats.",
          },
        ],
        strategic_revisions: [
          {
            action: "Strengthen secondary character arc continuity.",
            why: "Consistent subplot escalation reinforces emotional payoff.",
          },
        ],
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
      pass: false,
      checks: [
        {
          check_id: "v2_passive_duplicate_recommendation_diagnostic",
          passed: false,
          error_code: "QG_DUPLICATE_REC",
          details: "Duplicate recommendation diagnostic retained for audit only",
        },
        {
          check_id: "v2_passive_generic_recommendation_diagnostic",
          passed: false,
          error_code: "QG_GENERIC_REC",
          details: "Generic recommendation diagnostic retained for audit only",
        },
      ],
      warnings: ["Passive recommendation diagnostics retained"],
      artifactGate: {
        verdict: "PASS",
        reasonCodes: [],
        validatedAt: new Date().toISOString(),
        enforcementMode: "enforce",
      },
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
      supabaseStub.rpcCalls.some((call: { fn: string }) => call.fn === "persist_evaluation_v2_atomic"),
    ).toBe(true);
    expect(
      supabaseStub.rpcCalls.some((call: { fn: string }) => call.fn === "finalize_job_failure_atomic"),
    ).toBe(false);
    expect(
      supabaseStub.evaluationJobUpdates.some(
        (payload: Record<string, unknown>) => payload.status === "failed",
      ),
    ).toBe(false);

    const persistedArtifactTypes = (upsertEvaluationArtifactMock.mock.calls as any[]).map(
      (call: any[]) => call[0]?.artifactType,
    );
    expect(persistedArtifactTypes).toEqual(
      expect.arrayContaining([
        "post_qg_effective_snapshot_v1",
        "unified_evaluation_document_v1",
        "report_render_manifest_v1",
        "author_exposure_certification_v1",
      ]),
    );

    const postQgSnapshotCall = (upsertEvaluationArtifactMock.mock.calls as any[]).find(
      (call: any[]) => call[0]?.artifactType === "post_qg_effective_snapshot_v1",
    );
    expect(postQgSnapshotCall?.[0]?.content?.quality_gate?.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ error_code: "QG_DUPLICATE_REC", passed: false }),
        expect.objectContaining({ error_code: "QG_GENERIC_REC", passed: false }),
      ]),
    );

    const persistCall = supabaseStub.rpcCalls.find(
      (call: { fn: string }) => call.fn === "persist_evaluation_v2_atomic",
    ) as { fn: string; args?: Record<string, unknown> } | undefined;
    const persistedEvaluationResult = persistCall?.args?.p_evaluation_result as
      | Record<string, unknown>
      | undefined;
    const governance = persistedEvaluationResult?.governance as
      | { warnings?: string[] }
      | undefined;
    expect(governance?.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Passive recommendation diagnostics retained"),
        expect.stringContaining("QG_DUPLICATE_REC"),
        expect.stringContaining("QG_GENERIC_REC"),
      ]),
    );
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
          one_paragraph_summary: "Summary.",
          top_3_strengths: ["Clear narrative throughline"],
          top_3_risks: ["Secondary character arc needs deepening"],
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

    const baseEvaluationResult = makeCurrentProcessorEvaluationResult({
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
        verdict: "conditional",
        overall_score_0_100: 82,
        one_paragraph_summary: "Summary.",
        top_3_strengths: ["Clear narrative throughline"],
        top_3_risks: ["Secondary character arc needs deepening"],
      },
      recommendations: {
        quick_wins: [
          {
            action: "Sharpen scene transitions for momentum.",
            why: "Smoother transitions preserve narrative drive between beats.",
            effort: "low",
            impact: "medium",
          },
        ],
        strategic_revisions: [
          {
            action: "Strengthen secondary character arc continuity.",
            why: "Consistent subplot escalation reinforces emotional payoff.",
            effort: "medium",
            impact: "high",
          },
        ],
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
      evaluation_run_id: "run-cartel-babies-fail",
      criteria: [],
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

  test("Cartel Babies fail regression: theme 10→5 + summary omits theme fails consistency gate and blocks evaluation_result_v2 persistence", async () => {
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);

    runPipelineMock.mockResolvedValue({
      ok: true,
      synthesis: {
        criteria: [],
        overall: {
          overall_score_0_100: 82,
          verdict: "pass",
          one_paragraph_summary: "Summary.",
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

    const criterionKeys = [
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
    ] as const;

    const baseEvaluationResult = makeCurrentProcessorEvaluationResult({
      schema_version: "evaluation_result_v2",
      ids: {
        evaluation_run_id: "run-cartel-babies-fail",
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
        verdict: "conditional",
        overall_score_0_100: 70,
        one_paragraph_summary: "The manuscript has strong voice and scene momentum.",
        top_3_strengths: ["voice"],
        top_3_risks: ["theme"],
      },
      criteria: criterionKeys.map((key) => ({
        key,
        scorable: true,
        status: "SCORABLE",
        signal_present: true,
        signal_strength: "SUFFICIENT",
        confidence_band: "MEDIUM",
        score_0_10: key === "theme" ? 10 : 8,
        rationale: `Criterion ${key} is supported by manuscript evidence and synthesis.`,
        evidence: [{ snippet: `Evidence snippet with sufficient detail for ${key}.` }],
        recommendations: [
          {
            priority: "high",
            action: `Strengthen ${key} with scene-grounded revision.`,
            expected_impact: `Improves ${key} clarity and cohesion.`,
          },
        ],
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

    synthesisToEvaluationResultV2Mock.mockReturnValue(baseEvaluationResult);

    const downgradedResult = {
      ...baseEvaluationResult,
      overview: {
        ...baseEvaluationResult.overview,
        one_paragraph_summary: "The manuscript has strong voice and scene momentum.",
      },
      criteria: baseEvaluationResult.criteria.map((criterion: any) =>
        criterion.key === "theme"
          ? {
              ...criterion,
              score_0_10: 5,
              confidence_level: "low",
              confidence_score_0_100: 50,
            }
          : criterion,
      ),
    };

    runQualityGateV2Mock.mockReturnValue({
      pass: true,
      checks: [],
      warnings: [],
      downgradedResult,
    });

    mapEvaluationResultV2ToGovernanceEnvelopeMock.mockReturnValue({
      evaluation_run_id: "run-cartel-babies-pass",
      criteria: [],
    });

    const actualGate = jest.requireActual<typeof import("@/lib/evaluation/artifactConsistencyGate")>(
      "@/lib/evaluation/artifactConsistencyGate",
    );
    evaluateArtifactConsistencyGateV1Mock.mockImplementation((params: any) =>
      actualGate.evaluateArtifactConsistencyGateV1(params),
    );

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-canonical-pipeline");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Artifact consistency gate failed");

    const artifactConsistencyCall = upsertEvaluationArtifactMock.mock.calls.find(
      (call: any[]) => call[0]?.artifactType === "artifact_consistency_gate_v1",
    );
    const postQgSnapshotCall = upsertEvaluationArtifactMock.mock.calls.find(
      (call: any[]) => call[0]?.artifactType === "post_qg_effective_snapshot_v1",
    );
    expect(postQgSnapshotCall).toBeDefined();
    expect(postQgSnapshotCall?.[0]?.content).toEqual(
      expect.objectContaining({
        schema_version: "post_qg_effective_snapshot_v1",
        qg_status: "pass",
        effective_evaluation_result: expect.objectContaining({
          overview: expect.objectContaining({
            one_paragraph_summary: "The manuscript has strong voice and scene momentum.",
          }),
        }),
      }),
    );
    expect(artifactConsistencyCall).toBeDefined();
    expect(artifactConsistencyCall?.[0]?.content).toEqual(
      expect.objectContaining({
        status: "fail",
        blocking_reasons: expect.arrayContaining(["summary_criteria_bottom_weakness_alignment"]),
      }),
    );

    const failureDiagnosisCall = upsertEvaluationArtifactMock.mock.calls.find(
      (call: any[]) => call[0]?.artifactType === "failure_diagnosis_v1",
    );
    expect(failureDiagnosisCall).toBeDefined();
    expect(failureDiagnosisCall?.[0]?.content).toEqual(
      expect.objectContaining({
        artifact_type: "failure_diagnosis_v1",
        failure_code: "ARTIFACT_CONSISTENCY_GATE_FAILED",
        failure_point: expect.objectContaining({
          gate: "ArtifactConsistencyGateV1",
          artifact_type: "artifact_consistency_gate_v1",
        }),
        blocking_reasons: expect.arrayContaining(["summary_criteria_bottom_weakness_alignment"]),
      }),
    );

    expect(
      upsertEvaluationArtifactMock.mock.calls.some((call: any[]) =>
        ["unified_evaluation_document_v1", "report_render_manifest_v1", "author_exposure_certification_v1"].includes(
          call[0]?.artifactType,
        ),
      ),
    ).toBe(false);

    expect(
      supabaseStub.rpcCalls.some((call: { fn: string }) => call.fn === "persist_evaluation_v2_atomic"),
    ).toBe(false);
  });

  test("Cartel Babies pass regression: theme 10→5 with summary mentioning theme passes consistency gate and persists", async () => {
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);

    runPipelineMock.mockResolvedValue({
      ok: true,
      synthesis: {
        criteria: [],
        overall: {
          overall_score_0_100: 82,
          verdict: "pass",
          one_paragraph_summary: "Summary.",
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

    const criterionKeys = [
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
    ] as const;

    const baseEvaluationResult = makeCurrentProcessorEvaluationResult({
      schema_version: "evaluation_result_v2",
      ids: {
        evaluation_run_id: "run-cartel-babies-pass",
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
        verdict: "conditional",
        overall_score_0_100: 70,
        one_paragraph_summary: "Theme remains the primary weakness and needs revision.",
        top_3_strengths: ["voice"],
        top_3_risks: ["theme"],
      },
      criteria: criterionKeys.map((key) => ({
        key,
        scorable: true,
        status: "SCORABLE",
        signal_present: true,
        signal_strength: "SUFFICIENT",
        confidence_band: "MEDIUM",
        score_0_10: key === "theme" ? 10 : 8,
        rationale: `Criterion ${key} is supported by manuscript evidence and synthesis.`,
        evidence: [{ snippet: `Evidence snippet with sufficient detail for ${key}.` }],
        recommendations: [
          {
            priority: "high",
            action: `Strengthen ${key} with scene-grounded revision.`,
            expected_impact: `Improves ${key} clarity and cohesion.`,
          },
        ],
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

    synthesisToEvaluationResultV2Mock.mockReturnValue(baseEvaluationResult);

    const downgradedResult = {
      ...baseEvaluationResult,
      criteria: baseEvaluationResult.criteria.map((criterion: any) =>
        criterion.key === "theme"
          ? {
              ...criterion,
              score_0_10: 5,
              confidence_level: "low",
              confidence_score_0_100: 50,
            }
          : criterion,
      ),
    };

    runQualityGateV2Mock.mockReturnValue({
      pass: true,
      checks: [],
      warnings: [],
      downgradedResult,
    });

    const actualGate = jest.requireActual<typeof import("@/lib/evaluation/artifactConsistencyGate")>(
      "@/lib/evaluation/artifactConsistencyGate",
    );
    evaluateArtifactConsistencyGateV1Mock.mockImplementation((params: any) =>
      actualGate.evaluateArtifactConsistencyGateV1(params),
    );

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-canonical-pipeline");

    expect(result.success).toBe(true);
    const postQgSnapshotCall = upsertEvaluationArtifactMock.mock.calls.find(
      (call: any[]) => call[0]?.artifactType === "post_qg_effective_snapshot_v1",
    );
    expect(postQgSnapshotCall).toBeDefined();
    expect(postQgSnapshotCall?.[0]?.content).toEqual(
      expect.objectContaining({
        schema_version: "post_qg_effective_snapshot_v1",
        qg_status: "pass",
      }),
    );
    expect(
      supabaseStub.rpcCalls.some((call: { fn: string }) => call.fn === "persist_evaluation_v2_atomic"),
    ).toBe(true);
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
          one_paragraph_summary: "Summary.",
          top_3_strengths: ["Strong premise signal"],
          top_3_risks: ["Pacing inconsistency in middle"],
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
        one_paragraph_summary: "Summary.",
        top_3_strengths: ["Strong premise signal"],
        top_3_risks: ["Pacing inconsistency in middle"],
      },
      criteria: [],
      recommendations: {
        quick_wins: [
          {
            action: "Clarify scene-level stakes in opening beats.",
            why: "Earlier stakes improve reader orientation and urgency.",
          },
        ],
        strategic_revisions: [
          {
            action: "Rebuild midpoint escalation with clearer causality.",
            why: "Cleaner causal chain supports structural coherence.",
          },
        ],
      },
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
              one_paragraph_summary: "Summary.",
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
    expect(envelopePatch).toEqual(
      expect.objectContaining({
        phase: "phase_3",
        phase_status: "failed",
        claimed_by: null,
        claimed_at: null,
        lease_token: null,
        lease_until: null,
        last_heartbeat_at: null,
        last_heartbeat: null,
        worker_pulse_at: null,
        next_attempt_at: null,
        failure_envelope: expect.objectContaining({
          code: "PASS1_FAILED",
          retryable: false,
          phase: "phase_3",
        }),
      }),
    );
    expect(envelopePatch?.progress).toEqual(
      expect.objectContaining({
        dashboard_status: "technical_review_required",
        recovery_message: expect.stringContaining("quality issue"),
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
          overall_score_0_100: 50,
          verdict: "revise",
          one_paragraph_summary: "Summary.",
          top_3_strengths: ["Strong premise signal"],
          top_3_risks: ["Pacing inconsistency in middle"],
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
        one_paragraph_summary: "Summary.",
        top_3_strengths: ["Strong premise signal"],
        top_3_risks: ["Pacing inconsistency in middle"],
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
        rationale: "Criterion rationale.",
        evidence: [{ snippet: "Evidence snippet with sufficient detail for quality gate checks." }],
        recommendations: [],
      })),
      recommendations: {
        quick_wins: [
          {
            action: "Clarify scene-level stakes in opening beats.",
            why: "Earlier stakes improve reader orientation and urgency.",
          },
        ],
        strategic_revisions: [
          {
            action: "Rebuild midpoint escalation with clearer causality.",
            why: "Cleaner causal chain supports structural coherence.",
          },
        ],
      },
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

    // Success path persists via atomic RPC and non-canonical proof/observability artifacts.
    const persistedArtifactTypes = (upsertEvaluationArtifactMock.mock.calls as any[]).map(
      (call: any[]) => call[0]?.artifactType,
    );
    expect(persistedArtifactTypes).toEqual(
      expect.arrayContaining([
        "post_qg_effective_snapshot_v1",
        "unified_evaluation_document_v1",
        "report_render_manifest_v1",
        "author_exposure_certification_v1",
      ]),
    );
    expect(persistedArtifactTypes).not.toContain("evaluation_result_v2");
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

  test("wraps missing repair completion in the QualityGateV2 contract", async () => {
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);

    repairSynthesisIntegrityMock.mockRejectedValueOnce(
      new Error(
        "Repair model returned no completion content for evaluation_result_v2.criteria[0].rationale",
      ),
    );

    runPipelineMock.mockResolvedValue({
      ok: true,
      synthesis: {
        criteria: [],
        overall: {
          overall_score_0_100: 50,
          verdict: "revise",
          one_paragraph_summary: "Summary.",
          top_3_strengths: ["Strong premise signal"],
          top_3_risks: ["Pacing inconsistency in middle"],
        },
        metadata: {
          pass1_model: "gpt-4o",
          pass2_model: "o3",
          pass3_model: "o3",
          generated_at: new Date().toISOString(),
        },
      },
      quality_gate: { pass: true, checks: [], warnings: [] },
      pass4_governance: { ok: true },
    });

    runQualityGateV2Mock.mockReturnValue({
      pass: true,
      checks: [],
      warnings: [],
    });

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-repair-llm-missing");

    expect(result.success).toBe(false);
    expect(result.error).toContain("[QualityGateV2]");
    expect(result.error).toContain("Author-facing integrity repair failed");
    expect(result.error).not.toContain("Cannot read properties of undefined");
    expect(result.error).not.toContain("reading 'choices'");
    expect(
      supabaseStub.rpcCalls.some((call: { fn: string }) => call.fn === "persist_evaluation_v2_atomic"),
    ).toBe(false);
  });
});

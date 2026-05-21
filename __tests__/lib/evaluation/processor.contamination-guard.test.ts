/**
 * Processor-level contamination guard integration test.
 *
 * Proves the enforcement path end-to-end:
 *   guard enabled → contaminated result detected → job marked failed
 *   → last_error contains structured detail → artifact persistence not called
 */

export {};

import { CRITERIA_KEYS } from "@/schemas/criteria-keys";

// ── Mock pipeline and synthesis ──────────────────────────────────────────────
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

jest.mock("@/lib/jobs/jobStore.supabase", () => ({
  finalizeJobFailure: jest.fn(async () => ({
    status: "failed",
    retryEligible: false,
    retryExhausted: false,
    attemptCount: 1,
    maxAttempts: 3,
    shouldNotify: true,
    failureCode: "CONTEXT_CONTAMINATION_DETECTED",
  })),
}));

// ─────────────────────────────────────────────────────────────────────────────

function makeSupabaseStub() {
  const jobUpdates: Array<Record<string, unknown>> = [];
  const rpcCalls: Array<{ name: string; payload: Record<string, unknown> }> = [];

  const now = new Date();
  const leaseUntil = new Date(now.getTime() + 5 * 60_000).toISOString();

  const queuedJob = {
    id: "job-contamination-test",
    manuscript_id: 789,
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

  const manuscript = {
    id: 789,
    title: "River Chapter",
    // Sub-threshold (< 3,000 words) so the processor takes the short_form path
    // and does not invoke ensureChunksFromText (which would need additional mocking).
    content: "Cliff piloted the skiff across Carpenter Lake. The water moved cold and clear under the hull.".repeat(120),
    work_type: "narrative_nonfiction",
    user_id: "00000000-0000-0000-0000-000000000002",
  };

  return {
    jobUpdates,
    rpcCalls,
    rpc(name: string, payload: Record<string, unknown>) {
      rpcCalls.push({ name, payload });
      return Promise.resolve({
        data: [{ artifact_id: "artifact-rpc-contamination-1" }],
        error: null,
      });
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
            jobUpdates.push(payload);
            const chain: any = {
              eq: () => chain,
              select: () => ({
                single: async () => ({ data: queuedJob, error: null }),
                maybeSingle: async () => ({ data: queuedJob, error: null }),
                eq: () => chain,
              }),
              then: (resolve: any) => resolve({ error: null }),
              error: null,
            };
            return chain;
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
            let artifactType = "";
            const query: any = {
              eq: (col: string, val: any) => {
                if (col === "artifact_type") artifactType = val;
                return query;
              },
              maybeSingle: async () => {
                if (artifactType === "pass12_handoff_v1") {
                  return { data: { content: pass12HandoffContent }, error: null };
                }
                if (artifactType === "evaluation_result_v2") {
                  return { data: null, error: null };
                }
                return { data: null, error: null };
              },
              single: async () => ({ data: null, error: null }),
            };
            return query;
          },
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
    schema_version: "evaluation_result_v2",
    ids: {
      evaluation_run_id: "run-contamination",
      manuscript_id: 789,
      user_id: "00000000-0000-0000-0000-000000000002",
    },
    generated_at: new Date().toISOString(),
    engine: { model: "o3", provider: "openai", prompt_version: "test" },
    overview: {
      verdict: "revise",
      overall_score_0_100: 70,
      scored_criteria_count: CRITERIA_KEYS.length,
      one_paragraph_summary:
        "Maria receives a letter from her missing father deep in cartel territory.",
      top_3_strengths: ["Atmosphere"],
      top_3_risks: ["Cross-manuscript bleed"],
    },
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      scorable: true,
      status: "SCORABLE",
      signal_present: true,
      signal_strength: "SUFFICIENT",
      confidence_band: "MEDIUM",
      score_0_10: 7,
      rationale: `Criterion ${key} is supported by manuscript evidence and coherent analysis.`,
      evidence: [
        { snippet: `Primary textual evidence for ${key}.` },
        { snippet: `Secondary textual evidence for ${key}.` },
      ],
      recommendations: [],
    })),
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
    process.env.EVAL_PASS_TIMEOUT_MS = "180000";
    process.env.EVAL_OPENAI_TIMEOUT_MS = "180000";
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
          pass1_model: "gpt-4o",
          pass2_model: "o3",
          pass3_model: "o3",
          generated_at: new Date().toISOString(),
        },
      },
      quality_gate: { pass: true, checks: [], warnings: [] },
      pass4_governance: { ok: true },
    });

    synthesisToEvaluationResultV2Mock.mockReturnValue(makeEvaluationResult());
    runQualityGateV2Mock.mockReturnValue({ pass: true, checks: [], warnings: [] });
    mapEvaluationResultV2ToGovernanceEnvelopeMock.mockReturnValue({
      evaluation_run_id: "run-contamination",
      criteria: [],
    });

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

    // 2. Canonical failure envelope patch must contain structured contamination detail
    const envelopePatch = supabaseStub.jobUpdates.find(
      (u) =>
        typeof u?.progress === "object" &&
        (u as Record<string, any>).progress?.pipeline_failure_envelope?.error_code ===
          "CONTEXT_CONTAMINATION_DETECTED",
    ) as Record<string, any> | undefined;
    expect(envelopePatch).toBeDefined();

    const envelopeErrorMessage = envelopePatch?.progress?.pipeline_failure_envelope?.error_message;
    expect(typeof envelopeErrorMessage).toBe("string");
    const parsedError = JSON.parse(envelopeErrorMessage as string);
    expect(parsedError.code).toBe("CONTEXT_CONTAMINATION_DETECTED");
    expect(parsedError.offending_entities).toEqual(
      expect.arrayContaining(["maria", "cartel"]),
    );

    // 3. Artifact persistence must NOT have been called
    expect(supabaseStub.rpcCalls).toHaveLength(0);
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
          pass1_model: "gpt-4o",
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
    synthesisToEvaluationResultV2Mock.mockReturnValue(cleanResult);
    runQualityGateV2Mock.mockReturnValue({ pass: true, checks: [], warnings: [] });
    mapEvaluationResultV2ToGovernanceEnvelopeMock.mockReturnValue({
      evaluation_run_id: "run-contamination",
      criteria: [],
    });

    // Guard returns clean
    detectContextContaminationMock.mockReturnValue({
      contaminated: false,
      offendingEntities: [],
      reasons: [],
    });

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

    // Artifact persistence was attempted via atomic RPC
    expect(supabaseStub.rpcCalls).toHaveLength(1);
    expect(supabaseStub.rpcCalls[0].name).toBe("persist_evaluation_v2_atomic");
  });
});

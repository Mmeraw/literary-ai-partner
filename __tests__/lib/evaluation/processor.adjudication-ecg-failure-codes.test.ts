/**
 * processor.adjudication-ecg-failure-codes.test.ts
 *
 * Regression coverage for the Phase 3 external-adjudication gate and ECG
 * certification failure classification.
 *
 * Context (Criminality V2, job e7d88308-…): the Phase 3 gate checked the
 * retired `pipelineResult.cross_check` field to decide whether required-mode
 * external adjudication succeeded. runPipeline retired Pass 4 in favor of
 * dual-model parallel scoring and now always returns `cross_check: undefined`;
 * the real outcome lives on `pipelineResult.external_adjudication`. The stale
 * gate therefore failed EVERY required-mode run with "requires cross-check
 * output" even when adjudication actually completed. Separately, an ENFORCE-mode
 * ECG certification failure threw a plain Error that collapsed into the generic
 * PROCESSOR_UNCAUGHT_ERROR failure_code instead of surfacing its typed code.
 *
 * These tests prove the corrected contract:
 *   (a) required-mode run PROCEEDS when external_adjudication.status ===
 *       "cross_check_completed" even though cross_check is undefined;
 *   (b) a presence-missing adjudication (status "skipped") surfaces
 *       EXTERNAL_ADJUDICATION_REQUIRED_MISSING (not PROCESSOR_UNCAUGHT_ERROR);
 *   (c) a returned-but-failed adjudication (status "failed_blocking") surfaces
 *       EXTERNAL_ADJUDICATION_REQUIRED_FAILED;
 *   (d) an ENFORCE-mode ECG certification failure surfaces
 *       ECG_CERTIFICATION_FAILED with its fatal sub-codes preserved.
 */

export {};

import { EvaluationCertificationFailedError } from "@/lib/evaluation/pipeline/evaluationCertificationGate";
import type { ECGResult } from "@/lib/evaluation/pipeline/evaluationCertificationGate";
import {
  buildProcessorSynthesisManuscriptContent,
  buildProcessorSynthesisRecommendations,
  makeCurrentProcessorSynthesisOutput,
} from "./test-fixtures/currentProcessorSynthesisOutput";

// ── Mock ONLY external I/O ────────────────────────────────────────────────────

const runPipelineMock = jest.fn();
const synthesisToEvaluationResultV2Mock = jest.fn();

jest.mock("@/lib/evaluation/pipeline/runPipeline", () => {
  const actual = jest.requireActual<typeof import("@/lib/evaluation/pipeline/runPipeline")>(
    "@/lib/evaluation/pipeline/runPipeline",
  );
  return {
    ...actual,
    runPipeline: (...args: any[]) => runPipelineMock(...args),
    // synthesisToEvaluationResultV2 defaults to the real implementation; the ECG
    // test overrides it per-case to throw the typed certification error.
    synthesisToEvaluationResultV2: (...args: any[]) =>
      synthesisToEvaluationResultV2Mock(...args),
  };
});

const upsertEvaluationArtifactMock = jest.fn();

jest.mock("../../../lib/evaluation/artifactPersistence", () => ({
  stableSourceHash: () => "sha256:adjudication-ecg-test-hash",
  sha256Hex: (input: string) => `sha256:${input.slice(0, 16)}`,
  upsertEvaluationArtifact: (...args: any[]) => upsertEvaluationArtifactMock(...args),
}));

const openAIChatCreateMock = jest.fn();
const OpenAIMock = jest.fn(() => ({
  chat: { completions: { create: openAIChatCreateMock } },
}));

jest.mock("openai", () => ({ __esModule: true, default: OpenAIMock }));

const createClientMock = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: any[]) => createClientMock(...args),
}));

// ── Fixture helpers ─────────────────────────────────────────────────────────

function makeDirtySynthesisOutput() {
  const s = makeCurrentProcessorSynthesisOutput({
    criteria: (["narrativeDrive", "voice", "worldbuilding"] as const).map((key) => ({
      key,
      recommendations: buildProcessorSynthesisRecommendations(key),
    })),
  });
  // Required-prose integrity failures
  s.criteria[2].fit_summary = 'The voice works because the concrete details…';
  s.criteria[4].gap_summary = 'The middle stalls during the step-by-step sequence…';
  s.criteria[5].final_rationale = 'The dialogue is purposeful. then the subtext sharpens.';
  s.criteria[7].recommendations[0].specific_fix = 'Trim the redundant beat. then clarify the next action.';
  // Candidate-prose integrity failures
  s.criteria[1].recommendations[0].candidate_text_a = 'add a clearer stake in the first beat. make the want explicit.';
  s.criteria[3].recommendations[0].candidate_text_b = 'combine the two mirror-check beats. sharpen the objective.';
  return s;
}

function makeSupabaseStub() {
  const evaluationJobUpdates: Array<Record<string, unknown>> = [];
  const rpcCalls: Array<{ fn: string; args?: Record<string, unknown> }> = [];

  const now = new Date();
  const leaseUntil = new Date(now.getTime() + 5 * 60_000).toISOString();

  const queuedJob = {
    id: "job-adjudication-ecg-test",
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

  const acceptedStoryLedgerContent = {
    schema_version: "accepted_story_ledger_v1",
    governance_rail: {
      mode: "accepted",
      accepted_at: new Date().toISOString(),
      source: "adjudication-ecg-test",
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
    id: 789,
    title: "Adjudication + ECG Test Manuscript",
    content: buildProcessorSynthesisManuscriptContent(),
    work_type: "novel",
    user_id: "00000000-0000-0000-0000-000000000002",
  };

  const artifactReadBack = { id: "artifact-adjudication-ecg-pass" };

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
        return { data: [{ artifact_id: "artifact-adjudication-ecg-pass" }], error: null };
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
            const query: any = {
              eq: () => query,
              select: () => ({
                maybeSingle: async () => ({ data: queuedJob, error: null }),
                single: async () => ({ data: queuedJob, error: null }),
                eq: () => query,
              }),
              then: (resolve: (value: { error: null }) => void) => resolve({ error: null }),
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
          upsert: async () => ({ data: null, error: null }),
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
                      job_id: "job-adjudication-ecg-test",
                      manuscript_id: 789,
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
                      job_id: "job-adjudication-ecg-test",
                      manuscript_id: 789,
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
                return { data: artifactReadBack, error: null };
              },
            };
            return query;
          },
        };
      }
      throw new Error(`Unexpected table in adjudication+ecg test stub: ${table}`);
    },
  };
}

function findFailureCode(stub: ReturnType<typeof makeSupabaseStub>): string | undefined {
  const finalize = stub.rpcCalls.find((c) => c.fn === "finalize_job_failure_atomic");
  return finalize?.args?.p_failure_code as string | undefined;
}

function persistedV2Called(stub: ReturnType<typeof makeSupabaseStub>): boolean {
  return stub.rpcCalls.some((c) => c.fn === "persist_evaluation_v2_atomic");
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("processEvaluationJob — external adjudication gate + ECG typed failure codes", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.OPENAI_API_KEY = "sk-test-key";
    // Required/veto adjudication mode demands a Perplexity key at config resolution.
    process.env.PERPLEXITY_API_KEY = "pplx-test-key";
    process.env.EVAL_PASS_TIMEOUT_MS = "180000";
    process.env.EVAL_OPENAI_TIMEOUT_MS = "180000";

    // Default: real V2 mapper unless a test overrides it (ECG case).
    const actual = jest.requireActual<typeof import("@/lib/evaluation/pipeline/runPipeline")>(
      "@/lib/evaluation/pipeline/runPipeline",
    );
    synthesisToEvaluationResultV2Mock.mockImplementation(actual.synthesisToEvaluationResultV2);

    // Default OpenAI chat completion: parse the requested field path from the
    // prompt payload and return a valid JSON replacement. This lets the real
    // regenerateRequiredProse repair required prose in integration tests without
    // network calls.
    openAIChatCreateMock.mockImplementation(async (params: { messages?: { role?: string; content?: string }[] }) => {
      const userContent = params?.messages?.reverse().find((m) => m.role === 'user' && typeof m.content === 'string')?.content ?? '';
      const payloadMatch = /PAYLOAD:\n([\s\S]+?)\n\nOUTPUT RULES:/u.exec(userContent);
      let path = 'unknown.field';
      if (payloadMatch) {
        try {
          const parsed = JSON.parse(payloadMatch[1]!);
          if (typeof parsed?.path === 'string') {
            path = parsed.path;
          }
        } catch {
          // fallback
        }
      }
      const field = path.replace(/.*\.(?=[^.]+$)/u, '');
      const replacement =
        field === 'fit_summary'
          ? 'The voice carries the scene through concrete details and self-aware cost accounting.'
          : field === 'gap_summary'
          ? 'The middle sequence slows because the clock checks repeat without escalating tension.'
          : field === 'final_rationale'
          ? 'The narrator shows clear wants and the supporting characters each carry distinct values.'
          : 'Revise the targeted passage so the craft signal lands clearly for the reader.';
      return {
        choices: [{ message: { content: JSON.stringify({ [path]: replacement }) } }],
      };
    });
  });

  test("(a) required mode PROCEEDS when external_adjudication completed and cross_check is undefined", async () => {
    process.env.EVAL_EXTERNAL_ADJUDICATION_MODE = "required";
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);
    upsertEvaluationArtifactMock.mockResolvedValue("artifact-adjudication-ecg-pass");

    runPipelineMock.mockResolvedValue({
      ok: true,
      synthesis: makeCurrentProcessorSynthesisOutput(),
      quality_gate: { pass: true, checks: [], warnings: [] },
      pass4_governance: { ok: true },
      // Retired field is undefined — the gate must NOT depend on it.
      cross_check: undefined,
      external_adjudication: {
        status: "cross_check_completed",
        mode: "required",
        cross_check_returned: true,
        packet_chars: 29_568,
        packet_compression_ratio: 0.0479,
      },
    });

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-adjudication-ecg-test");

    expect(result.success).toBe(true);
    // No stale "requires cross-check output" failure was written.
    expect(findFailureCode(supabaseStub)).toBeUndefined();
    // Job actually completed and persisted the canonical V2 artifact.
    expect(persistedV2Called(supabaseStub)).toBe(true);
  });

  test("(b) required mode with SKIPPED adjudication fails as EXTERNAL_ADJUDICATION_REQUIRED_MISSING", async () => {
    process.env.EVAL_EXTERNAL_ADJUDICATION_MODE = "required";
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);

    runPipelineMock.mockResolvedValue({
      ok: true,
      synthesis: makeCurrentProcessorSynthesisOutput(),
      quality_gate: { pass: true, checks: [], warnings: [] },
      pass4_governance: { ok: true },
      cross_check: undefined,
      external_adjudication: {
        status: "skipped",
        mode: "required",
        cross_check_returned: false,
        reason: "pass4_retired_dual_model_parallel_scoring",
      },
    });

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-adjudication-ecg-test");

    expect(result.success).toBe(false);
    expect(findFailureCode(supabaseStub)).toBe("EXTERNAL_ADJUDICATION_REQUIRED_MISSING");
    expect(findFailureCode(supabaseStub)).not.toBe("PROCESSOR_UNCAUGHT_ERROR");
    // No canonical V2 artifact should be persisted for a blocked run.
    expect(persistedV2Called(supabaseStub)).toBe(false);
  });

  test("(c) required mode with FAILED_BLOCKING adjudication fails as EXTERNAL_ADJUDICATION_REQUIRED_FAILED", async () => {
    process.env.EVAL_EXTERNAL_ADJUDICATION_MODE = "required";
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);

    runPipelineMock.mockResolvedValue({
      ok: true,
      synthesis: makeCurrentProcessorSynthesisOutput(),
      quality_gate: { pass: true, checks: [], warnings: [] },
      pass4_governance: { ok: true },
      cross_check: undefined,
      external_adjudication: {
        status: "failed_blocking",
        mode: "required",
        cross_check_returned: false,
        reason: "perplexity_request_timeout",
      },
    });

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-adjudication-ecg-test");

    expect(result.success).toBe(false);
    expect(findFailureCode(supabaseStub)).toBe("EXTERNAL_ADJUDICATION_REQUIRED_FAILED");
    expect(findFailureCode(supabaseStub)).not.toBe("PROCESSOR_UNCAUGHT_ERROR");
    expect(persistedV2Called(supabaseStub)).toBe(false);
  });

  test("(a2) optional mode with SKIPPED adjudication still PROCEEDS (gate is required/veto only)", async () => {
    process.env.EVAL_EXTERNAL_ADJUDICATION_MODE = "optional";
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);
    upsertEvaluationArtifactMock.mockResolvedValue("artifact-adjudication-ecg-pass");

    runPipelineMock.mockResolvedValue({
      ok: true,
      synthesis: makeCurrentProcessorSynthesisOutput(),
      quality_gate: { pass: true, checks: [], warnings: [] },
      pass4_governance: { ok: true },
      cross_check: undefined,
      external_adjudication: {
        status: "skipped",
        mode: "optional",
        cross_check_returned: false,
        reason: "no_api_key",
      },
    });

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-adjudication-ecg-test");

    expect(result.success).toBe(true);
    expect(findFailureCode(supabaseStub)).toBeUndefined();
    expect(persistedV2Called(supabaseStub)).toBe(true);
  });

  test("(d) ENFORCE-mode ECG certification failure surfaces ECG_CERTIFICATION_FAILED with sub-codes preserved", async () => {
    process.env.EVAL_EXTERNAL_ADJUDICATION_MODE = "optional";
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);

    runPipelineMock.mockResolvedValue({
      ok: true,
      synthesis: makeCurrentProcessorSynthesisOutput(),
      quality_gate: { pass: true, checks: [], warnings: [] },
      pass4_governance: { ok: true },
      cross_check: undefined,
      external_adjudication: {
        status: "cross_check_completed",
        mode: "optional",
        cross_check_returned: true,
      },
    });

    // Simulate the real ENFORCE-mode certification block: synthesisToEvaluationResultV2
    // throws the typed error carrying the exact fatal sub-codes from the incident.
    const fatalCodes = [
      "ECG_AUTH_EXEC_SUMMARY_SCORE_MISMATCH",
      "ECG_TEXT_MIDSENTENCE_TERMINATION",
      "ECG_RENDERER_VERDICT_UNKNOWN",
    ];
    const ecgResult: ECGResult = {
      status: "CERTIFICATION_FAILED",
      mode: "ENFORCE",
      violations: fatalCodes.map((code) => ({
        code,
        domain: "AUTH",
        severity: "FATAL",
        message: `${code} triggered`,
        section: "overview",
        authority: "score_authority",
      })),
      fatal: fatalCodes.map((code) => ({
        code,
        domain: "AUTH",
        severity: "FATAL",
        message: `${code} triggered`,
        section: "overview",
        authority: "score_authority",
      })),
      advisory: [],
      certified_at: new Date().toISOString(),
      summary: "ECG CERTIFICATION_FAILED",
    };
    synthesisToEvaluationResultV2Mock.mockImplementation(() => {
      throw new EvaluationCertificationFailedError(ecgResult);
    });

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-adjudication-ecg-test");

    expect(result.success).toBe(false);

    const finalize = supabaseStub.rpcCalls.find((c) => c.fn === "finalize_job_failure_atomic");
    expect(finalize?.args?.p_failure_code).toBe("ECG_CERTIFICATION_FAILED");
    expect(finalize?.args?.p_failure_code).not.toBe("PROCESSOR_UNCAUGHT_ERROR");

    // Sub-codes must be preserved in the persisted failure envelope / progress.
    const progressUpdate = supabaseStub.evaluationJobUpdates.find(
      (u) =>
        u.progress !== undefined &&
        typeof u.progress === "object" &&
        (u.progress as Record<string, unknown>).error_code === "ECG_CERTIFICATION_FAILED",
    );
    expect(progressUpdate).toBeDefined();
    const envelope = (progressUpdate!.progress as Record<string, unknown>)
      .pipeline_failure_envelope as { reason_codes?: string[] } | undefined;
    expect(envelope?.reason_codes).toEqual(expect.arrayContaining(fatalCodes));
    expect(envelope?.reason_codes).toContain("ECG_CERTIFICATION_FAILED");

    expect(persistedV2Called(supabaseStub)).toBe(false);
  });

  test("(e) mixed candidate and required author-facing integrity violations are repaired in the same recovery cycle and the job completes", async () => {
    process.env.EVAL_EXTERNAL_ADJUDICATION_MODE = "optional";
    const supabaseStub = makeSupabaseStub();
    createClientMock.mockReturnValue(supabaseStub);
    upsertEvaluationArtifactMock.mockResolvedValue("artifact-adjudication-ecg-pass");

    runPipelineMock.mockResolvedValue({
      ok: true,
      synthesis: makeDirtySynthesisOutput(),
      quality_gate: { pass: true, checks: [], warnings: [] },
      pass4_governance: { ok: true },
      cross_check: undefined,
      external_adjudication: {
        status: "cross_check_completed",
        mode: "optional",
        cross_check_returned: true,
      },
    });

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-adjudication-ecg-test");

    expect(result.success).toBe(true);
    expect(findFailureCode(supabaseStub)).toBeUndefined();
    expect(persistedV2Called(supabaseStub)).toBe(true);

    const progressUpdate = supabaseStub.evaluationJobUpdates.find(
      (u) =>
        u.progress !== undefined &&
        typeof u.progress === "object" &&
        (u.progress as Record<string, unknown>).error_code === undefined,
    );
    expect(progressUpdate).toBeDefined();
  });
});

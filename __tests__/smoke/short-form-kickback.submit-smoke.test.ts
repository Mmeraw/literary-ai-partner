export {};

import { describe, expect, test, beforeEach } from "@jest/globals";
import type { SupabaseClient } from "@supabase/supabase-js";
import { POST } from "@/app/api/jobs/route";
import { createJob } from "@/lib/jobs/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createInitialVersion } from "@/lib/manuscripts/versions";
import { triggerEvaluationWorker } from "@/lib/jobs/triggerWorker";
import { persistEvaluationResultV2 } from "@/lib/evaluation/persistEvaluationResultV2";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import { makeCurrentProcessorEvaluationResult } from "@/__tests__/lib/evaluation/test-fixtures/currentProcessorEvaluationResult";

jest.mock("@/lib/jobs/store", () => ({
  createJob: jest.fn(),
  getAllJobs: jest.fn(),
}));

jest.mock("@/lib/jobs/metrics", () => ({
  onJobCreated: jest.fn(),
}));

jest.mock("@/lib/jobs/rateLimiter", () => ({
  checkJobCreationRateLimit: jest.fn(async () => ({ allowed: true })),
  checkFeatureAccess: jest.fn(async () => ({ allowed: true })),
  validateManuscriptSize: jest.fn(() => ({ allowed: true })),
}));

jest.mock("@/lib/observability/logger", () => ({
  generateTraceId: jest.fn(() => "trace-smoke"),
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  jobLogger: {
    created: jest.fn(),
  },
}));

jest.mock("@/lib/supabase/server", () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(),
}));

jest.mock("@/lib/manuscripts/versions", () => ({
  createInitialVersion: jest.fn(),
}));

jest.mock("@/lib/freeDiagnostic/claims", () => ({
  claimFreeDiagnostic: jest.fn(async () => ({ ok: true, claimId: "claim-smoke", ipHash: "hash-smoke" })),
  attachFreeDiagnosticJob: jest.fn(async () => undefined),
}));

jest.mock("@/lib/jobs/backpressure", () => ({
  backpressureGuard: jest.fn(async () => null),
}));

jest.mock("@/lib/jobs/triggerWorker", () => ({
  isTriggerWorkerFailure: jest.fn(() => false),
  triggerEvaluationWorker: jest.fn(async () => ({
    ok: true,
    claimed: 1,
    processed: 1,
    targetClaimed: true,
    body: { ok: true },
  })),
}));

const mockCreateJob = createJob as jest.MockedFunction<typeof createJob>;
const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockCreateInitialVersion = createInitialVersion as jest.MockedFunction<typeof createInitialVersion>;
const mockTriggerEvaluationWorker = triggerEvaluationWorker as jest.MockedFunction<typeof triggerEvaluationWorker>;

function makeSubmittedManuscriptText(): string {
  return [
    "The witness stood in the hallway and listened to the rain against the glass.",
    "She knew the accusation would change the room before anyone spoke.",
    "When the detective asked for the notebook, she handed it over without looking down.",
    "The first page held a name, a time, and a sentence nobody wanted to read aloud.",
  ].join(" ");
}

function makeAdminClientForSubmissionSmoke() {
  const evaluationJobUpdates: Array<Record<string, unknown>> = [];

  return {
    evaluationJobUpdates,
    from: jest.fn((table: string) => {
      if (table === "manuscripts") {
        return {
          insert: jest.fn(() => ({
            select: () => ({
              single: async () => ({ data: { id: 9090 }, error: null }),
            }),
          })),
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: async () => ({
                  data: {
                    word_count: 62,
                    file_url: `data:text/plain;charset=utf-8,${encodeURIComponent(makeSubmittedManuscriptText())}`,
                  },
                  error: null,
                }),
              })),
            })),
          })),
        };
      }

      if (table === "evaluation_jobs") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              in: jest.fn(() => ({
                limit: jest.fn(async () => ({ data: [], error: null })),
              })),
            })),
          })),
          update: jest.fn((payload: Record<string, unknown>) => {
            evaluationJobUpdates.push(payload);
            return {
              eq: async () => ({ error: null }),
            };
          }),
        };
      }

      throw new Error(`Unexpected admin table in short-form smoke: ${table}`);
    }),
  };
}

function makeLeakedShortFormEvaluationResult(jobId: string): EvaluationResultV2 {
  return makeCurrentProcessorEvaluationResult({
    ids: {
      evaluation_run_id: "run-short-form-submit-smoke",
      job_id: jobId,
      manuscript_id: 9090,
      user_id: "user-smoke",
    },
    engine: {
      model: "smoke-injected-pass3",
      provider: "test",
      prompt_version: "short-form-submit-smoke",
    },
    overview: {
      verdict: "revise",
      overall_score_0_100: 66,
      scored_criteria_count: CRITERIA_KEYS.length,
      one_paragraph_summary:
        "This submitted short-form evaluation accidentally mentions WAVE certification in author-facing prose.",
      top_3_strengths: ["voice", "dialogue", "pacing"],
      top_3_risks: ["theme", "closure", "worldbuilding"],
    },
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 6,
      rationale: `Criterion ${key}: supported by concrete evidence from the submitted short-form text.`,
      evidence: [
        { snippet: '"The witness stood in the hallway"' },
        { snippet: '"The first page held a name"' },
      ],
      recommendations: [
        {
          priority: "medium" as const,
          action: `Refine ${key} with one concrete manuscript-specific adjustment.`,
          expected_impact: `Improves ${key} clarity and execution consistency.`,
        },
      ],
    })),
    governance: {
      confidence: 0.75,
      confidence_label: "medium",
      confidence_reasons: [],
      warnings: [],
      limitations: [],
      policy_family: "multi-pass-dual-axis",
      observability_warnings: [],
      transparency: {},
    },
  });
}

function makePersistenceSupabaseStub() {
  const evaluationJobUpdates: Array<Record<string, unknown>> = [];
  const artifactInserts: Array<Record<string, unknown>> = [];

  return {
    evaluationJobUpdates,
    artifactInserts,
    from(table: string) {
      if (table === "evaluation_artifacts") {
        return {
          insert: (payload: Record<string, unknown>) => {
            artifactInserts.push(payload);
            return {
              then: (cb: (result: { error: null }) => unknown) => Promise.resolve().then(() => cb({ error: null })),
            };
          },
        };
      }

      if (table === "evaluation_jobs") {
        return {
          update: (payload: Record<string, unknown>) => {
            evaluationJobUpdates.push(payload);
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }

      throw new Error(`Unexpected persistence table in short-form smoke: ${table}`);
    },
    rpc() {
      throw new Error("Smoke kickback must not reach atomic persistence RPC.");
    },
  };
}

describe("short-form kickback smoke — submission to persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ id: "user-smoke", email: "smoke@example.com" } as never);
    mockCreateInitialVersion.mockResolvedValue({ id: "version-smoke" } as never);
    mockCreateJob.mockResolvedValue({
      id: "job-submit-smoke",
      status: "queued",
      progress: {},
      manuscript_id: 9090,
      job_type: "evaluate_full",
    } as never);
    mockCreateAdminClient.mockReturnValue(makeAdminClientForSubmissionSmoke() as never);
  });

  test("submits a real short-form job payload and confirms leaked output kicks back at persistence", async () => {
    const request = new Request("https://localhost:3000/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manuscript_text: makeSubmittedManuscriptText(),
        manuscript_title: "Short Form Kickback Smoke",
        job_type: "evaluate_full",
        processing_terms_accepted: true,
        english_variant: "US",
      }),
    });

    const response = await POST(request);
    const json = (await response.json()) as { ok: boolean; job_id?: string; manuscript_word_count?: number };

    expect(response.status).toBe(201);
    expect(json).toMatchObject({
      ok: true,
      job_id: "job-submit-smoke",
    });
    expect(json.manuscript_word_count).toBeLessThan(25_000);
    expect(mockCreateJob).toHaveBeenCalledWith(expect.objectContaining({
      manuscript_id: 9090,
      user_id: "user-smoke",
      job_type: "evaluate_full",
    }));
    expect(mockTriggerEvaluationWorker).toHaveBeenCalledWith(expect.objectContaining({
      jobId: "job-submit-smoke",
      source: "api.jobs.create",
    }));

    const persistenceSupabase = makePersistenceSupabaseStub();
    const persistResult = await persistEvaluationResultV2({
      supabase: persistenceSupabase as unknown as SupabaseClient,
      jobId: "job-submit-smoke",
      manuscriptId: 9090,
      evaluationResult: makeLeakedShortFormEvaluationResult("job-submit-smoke"),
      sourceHash: "sha256:submit-smoke",
      progressSnapshot: {
        phase: "phase_3",
        phase_status: "running",
        manuscript_word_count: json.manuscript_word_count ?? 62,
      },
      totalUnits: 100,
      completedUnits: 100,
    });

    expect(persistResult.persisted).toBe(false);
    expect(persistResult.reason).toContain("SHORT_FORM_LONGFORM_ARTIFACT_LEAK");
    expect(persistenceSupabase.artifactInserts).toHaveLength(1);

    const requeueWrite = persistenceSupabase.evaluationJobUpdates.find((payload) => payload.status === "queued");
    expect(requeueWrite).toMatchObject({
      status: "queued",
      phase: "phase_3",
      phase_status: "queued",
      failure_code: null,
      last_error: null,
    });

    const progress = requeueWrite?.progress as Record<string, unknown> | undefined;
    expect(progress?.last_kick_failure_code).toBe("SHORT_FORM_LONGFORM_ARTIFACT_LEAK");
    expect(typeof progress?.short_form_retry_instruction).toBe("string");

    const terminalFailureWrite = persistenceSupabase.evaluationJobUpdates.find((payload) => payload.status === "failed");
    expect(terminalFailureWrite).toBeUndefined();
  });
});

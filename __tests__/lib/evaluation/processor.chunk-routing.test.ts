export {};

const runPipelineMock = jest.fn();
const synthesisToEvaluationResultV2Mock = jest.fn();
const runQualityGateV2Mock = jest.fn();
const mapEvaluationResultV2ToGovernanceEnvelopeMock = jest.fn();
const ensureChunksMock = jest.fn();
const ensureChunksFromTextMock = jest.fn();

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
  ensureChunksFromText: (...args: any[]) => ensureChunksFromTextMock(...args),
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

function makeSupabaseStub(
  manuscriptContent: string,
  options?: {
    manuscriptChunks?: Array<{ chunk_index: number; content: string }>;
  },
) {
  const evaluationJobUpdates: Array<Record<string, unknown>> = [];
  const rpcCalls: Array<{ fn: string; args?: Record<string, unknown> }> = [];
  const manuscriptChunks = options?.manuscriptChunks ?? [];

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

      if (table === "manuscript_chunks") {
        const query = {
          order: async () => ({ data: manuscriptChunks, error: null }),
        };

        return {
          select: () => ({
            eq: () => query,
          }),
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

  test("long_form uses ensureChunksFromText (not ensureChunks), runs before pipeline, and persists proof telemetry", async () => {
    const manuscriptContent = "alpha beta gamma delta epsilon zeta eta theta iota kappa ".repeat(2600);
    const supabaseStub = makeSupabaseStub(manuscriptContent, {
      manuscriptChunks: [
        { chunk_index: 0, content: "Chunk 0 text" },
        { chunk_index: 1, content: "Chunk 1 text" },
        { chunk_index: 2, content: "Chunk 2 text" },
        { chunk_index: 3, content: "Chunk 3 text" },
      ],
    });
    createClientMock.mockReturnValue(supabaseStub);

    ensureChunksFromTextMock.mockResolvedValue({
      ensured_count: 4,
      persisted_count: 4,
      chunk_source: "processor_resolved_text",
      verified_at: new Date().toISOString(),
      source_manuscript_words: 26000,
      source_manuscript_chars: 145000,
      chunk_storage_words: 31500,
      chunk_storage_chars: 182000,
      overlap_words: 5500,
      overlap_chars: 37000,
    });

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
    expect(ensureChunksFromTextMock).toHaveBeenCalledTimes(1);
    expect(ensureChunksFromTextMock.mock.calls[0]?.[0]).toBe(456);
    expect(ensureChunksFromTextMock.mock.calls[0]?.[1]).toBe("job-long-form-routing");
    expect(typeof ensureChunksFromTextMock.mock.calls[0]?.[2]).toBe("string");
    expect(ensureChunksFromTextMock.mock.calls[0]?.[2]).toContain("alpha beta gamma delta epsilon");
    expect(ensureChunksMock).not.toHaveBeenCalled();
    expect(runPipelineMock).toHaveBeenCalledTimes(1);

    const ensureChunksCallOrder = ensureChunksFromTextMock.mock.invocationCallOrder[0];
    const runPipelineCallOrder = runPipelineMock.mock.invocationCallOrder[0];
    expect(ensureChunksCallOrder).toBeLessThan(runPipelineCallOrder);

    const runPipelineArgs = runPipelineMock.mock.calls[0]?.[0];
    const expectedCanonicalPostChunkText = [
      "Chunk 0 text",
      "Chunk 1 text",
      "Chunk 2 text",
      "Chunk 3 text",
    ].join("\n");
    expect(runPipelineArgs).toEqual(
      expect.objectContaining({
        manuscriptChunks: [
          { chunk_index: 0, content: "Chunk 0 text" },
          { chunk_index: 1, content: "Chunk 1 text" },
          { chunk_index: 2, content: "Chunk 2 text" },
          { chunk_index: 3, content: "Chunk 3 text" },
        ],
      }),
    );
    expect(runPipelineArgs.manuscriptText).toBe(expectedCanonicalPostChunkText);
    expect(runPipelineArgs.manuscriptText).not.toBe(manuscriptContent);

    const persistCall = supabaseStub.rpcCalls.find(
      (call: { fn: string }) => call.fn === "persist_evaluation_v2_atomic",
    );
    expect(persistCall).toBeDefined();
    expect(persistCall?.args?.p_progress).toEqual(
      expect.objectContaining({
        final_text_source: "long_form_post_chunk_canonical",
        post_chunk_reresolved: true,
        canonical_path_used: "resolveManuscriptText.post_chunk_reconstruct",
        timeout_resolution: expect.objectContaining({
          input_scale: "full_manuscript",
          floor_applied: expect.any(Boolean),
          floor_ms: 720000,
          resolved_pass_timeout_ms: 720000,
          resolved_openai_timeout_ms: 720000,
        }),
        chunk_routing: expect.objectContaining({
          enabled: true,
          route: "long_form",
          threshold_words: 25000,
          manuscript_words: 26000,
          source_manuscript_words: 26000,
          source_manuscript_chars: 145000,
          chunk_storage_words: 31500,
          chunk_storage_chars: 182000,
          overlap_words: 5500,
          overlap_chars: 37000,
          chunk_count: 4,
          ensure_chunks_returned_count: 4,
          persisted_chunk_count: 4,
          chunk_source: "processor_resolved_text",
          verified_at: expect.any(String),
        }),
      }),
    );

    expect(persistCall?.args?.p_progress?.timeout_resolution).toEqual(
      expect.objectContaining({
        timeout_word_basis: expect.any(Number),
        timeout_source_word_count: 26000,
        timeout_chunk_storage_word_count: expect.any(Number),
      }),
    );
  });

  test("short_form behavior is unchanged (no ensureChunksFromText, no fail-closed)", async () => {
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
    expect(ensureChunksFromTextMock).not.toHaveBeenCalled();
    expect(ensureChunksMock).not.toHaveBeenCalled();
    expect(runPipelineMock).toHaveBeenCalledTimes(1);

    const persistCall = supabaseStub.rpcCalls.find(
      (call: { fn: string }) => call.fn === "persist_evaluation_v2_atomic",
    );
    expect(persistCall).toBeDefined();
    expect(persistCall?.args?.p_progress).toMatchObject({
      final_text_source: "short_form_initial_text",
      post_chunk_reresolved: false,
      canonical_path_used: "resolveManuscriptText.initial",
      timeout_resolution: {
        input_scale: "standard_chapter",
        floor_applied: false,
      },
      chunk_routing: {
        enabled: true,
        route: "short_form",
        threshold_words: 25000,
        manuscript_words: 3000,
        chunk_count: 0,
      },
    });
    expect(persistCall?.args?.p_progress?.chunk_routing).not.toHaveProperty(
      "ensure_chunks_returned_count",
    );
    expect(persistCall?.args?.p_progress?.chunk_routing).not.toHaveProperty(
      "persisted_chunk_count",
    );
    expect(persistCall?.args?.p_progress?.chunk_routing).not.toHaveProperty("chunk_source");
    expect(persistCall?.args?.p_progress?.chunk_routing).not.toHaveProperty("verified_at");

    const timeoutResolution = persistCall?.args?.p_progress?.timeout_resolution as
      | {
          base_pass_timeout_ms?: number;
          resolved_pass_timeout_ms?: number;
          base_openai_timeout_ms?: number;
          resolved_openai_timeout_ms?: number;
        }
      | undefined;

    expect(timeoutResolution?.resolved_pass_timeout_ms).toBe(timeoutResolution?.base_pass_timeout_ms);
    expect(timeoutResolution?.resolved_openai_timeout_ms).toBe(timeoutResolution?.base_openai_timeout_ms);
  });

  test("mid-length manuscript exceeding prompt budget routes to long_form chunking", async () => {
    const manuscriptContent = "alpha beta gamma delta epsilon ".repeat(3200); // ~16k words
    const supabaseStub = makeSupabaseStub(manuscriptContent, {
      manuscriptChunks: [
        { chunk_index: 0, content: "Chunk A text" },
        { chunk_index: 1, content: "Chunk B text" },
        { chunk_index: 2, content: "Chunk C text" },
      ],
    });
    createClientMock.mockReturnValue(supabaseStub);

    ensureChunksFromTextMock.mockResolvedValueOnce({
      ensured_count: 3,
      persisted_count: 3,
      chunk_source: "processor_resolved_text",
      verified_at: new Date().toISOString(),
    });

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
    expect(ensureChunksFromTextMock).toHaveBeenCalledTimes(1);

    const persistCall = supabaseStub.rpcCalls.find(
      (call: { fn: string }) => call.fn === "persist_evaluation_v2_atomic",
    );
    expect(persistCall).toBeDefined();
    expect(persistCall?.args?.p_progress?.chunk_routing).toEqual(
      expect.objectContaining({
        route: "long_form",
        trigger_reason: "prompt_budget_exceeded",
        threshold_words: 25000,
        chunk_count: 3,
        ensure_chunks_returned_count: 3,
        persisted_chunk_count: 3,
      }),
    );
  });

  test("long_form + persisted_chunk_count = 0 fails with LONG_FORM_CHUNK_MATERIALIZATION_FAILED and does not run pipeline", async () => {
    const manuscriptContent = "alpha beta gamma delta epsilon zeta eta theta iota kappa ".repeat(2600);
    const supabaseStub = makeSupabaseStub(manuscriptContent);
    createClientMock.mockReturnValue(supabaseStub);

    ensureChunksFromTextMock.mockResolvedValueOnce({
      ensured_count: 0,
      persisted_count: 0,
      chunk_source: "processor_resolved_text",
      verified_at: new Date().toISOString(),
    });

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-long-form-routing");

    expect(result.success).toBe(false);
    expect(result.error).toContain("persisted_chunk_count=0");
    expect(ensureChunksFromTextMock).toHaveBeenCalledTimes(1);
    expect(ensureChunksMock).not.toHaveBeenCalled();
    expect(runPipelineMock).not.toHaveBeenCalled();

    const failureUpdate = supabaseStub.evaluationJobUpdates.find((payload) => {
      const progress = payload.progress as
        | {
            error_code?: string;
            pipeline_failure_envelope?: { error_code?: string };
          }
        | undefined;
      return (
        progress?.error_code === "LONG_FORM_CHUNK_MATERIALIZATION_FAILED" ||
        progress?.pipeline_failure_envelope?.error_code ===
          "LONG_FORM_CHUNK_MATERIALIZATION_FAILED"
      );
    });
    expect(failureUpdate).toBeDefined();
  });

  test("long_form fails closed when ensured count and persisted count mismatch", async () => {
    const manuscriptContent = "alpha beta gamma delta epsilon zeta eta theta iota kappa ".repeat(2600);
    const supabaseStub = makeSupabaseStub(manuscriptContent);
    createClientMock.mockReturnValue(supabaseStub);

    ensureChunksFromTextMock.mockResolvedValueOnce({
      ensured_count: 4,
      persisted_count: 3,
      chunk_source: "processor_resolved_text",
      verified_at: new Date().toISOString(),
    });

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");
    const result = await processEvaluationJob("job-long-form-routing");

    expect(result.success).toBe(false);
    expect(result.error).toContain("ensure_chunks_returned_count=4");
    expect(result.error).toContain("persisted_chunk_count=3");
    expect(ensureChunksFromTextMock).toHaveBeenCalledTimes(1);
    expect(runPipelineMock).not.toHaveBeenCalled();
  });
});
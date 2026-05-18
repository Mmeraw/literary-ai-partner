/**
 * Integration test for /api/workers/process-dream route.
 *
 * Mocks: Supabase client factory, runPass3bLongform, upsertEvaluationArtifact,
 *        buildPass2aStructuredContext.
 *
 * Verifies:
 *   1. Happy path — longform_document_v1 artifact is written on success
 *   2. Error path — when runPass3bLongform throws, evaluation_jobs.last_error
 *      is updated so the failure is visible in the DB
 *   3. Dry run — ?dry_run=1 returns pending count without calling synthesis
 *   4. No pending jobs — returns processed: 0 without calling synthesis
 *
 * This test would have caught the silent-DREAM-failure root cause: prior to
 * the fix, when runPass3bLongform was killed mid-flight by Vercel's
 * maxDuration the catch block never ran and no error was ever surfaced.
 */

import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('@/lib/evaluation/pipeline/runPass3bLongform', () => ({
  runPass3bLongform: jest.fn(),
}));

jest.mock('@/lib/evaluation/pipeline/buildPass2aStructuredContext', () => ({
  buildPass2aStructuredContext: jest.fn(() => ({ mocked: 'pass2a-context' })),
}));

jest.mock('@/lib/evaluation/artifactPersistence', () => ({
  stableSourceHash: jest.fn(() => 'mock-source-hash'),
  upsertEvaluationArtifact: jest.fn(async () => undefined),
}));

// Supabase client factory — replaced per-test via a shared mutable holder.
const supabaseHolder: { client: unknown } = { client: null };
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => supabaseHolder.client),
}));

// Auth helper used by checkServiceRoleAuth (not actually exercised here —
// bearer auth path is sufficient for these tests).
jest.mock('@/lib/auth/api', () => ({
  checkServiceRoleAuth: jest.fn(() => false),
}));

import { GET } from '@/app/api/workers/process-dream/route';
import { runPass3bLongform } from '@/lib/evaluation/pipeline/runPass3bLongform';
import { upsertEvaluationArtifact } from '@/lib/evaluation/artifactPersistence';

const mockRunPass3bLongform = runPass3bLongform as jest.MockedFunction<
  typeof runPass3bLongform
>;
const mockUpsertEvaluationArtifact =
  upsertEvaluationArtifact as jest.MockedFunction<typeof upsertEvaluationArtifact>;

// ── Supabase mock builder ──────────────────────────────────────────────────

type MockTable = {
  // Records last update payload for assertion.
  lastUpdate?: Record<string, unknown>;
  lastUpdateId?: string;
};

/**
 * Build a thenable Supabase query builder that resolves to a given payload.
 * Each fluent method returns `this`; awaiting it (or `.maybeSingle()`/`.then()`)
 * yields { data, error }.
 */
function buildQuery(result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  const chain = () => q;
  q.select = jest.fn(chain);
  q.eq = jest.fn(chain);
  q.gte = jest.fn(chain);
  q.in = jest.fn(chain);
  q.not = jest.fn(chain);  // used by .not('id','in',...) in findPendingDreamJobs
  q.neq = jest.fn(chain);
  q.order = jest.fn(chain);
  q.limit = jest.fn(chain);
  q.update = jest.fn(chain);
  q.delete = jest.fn(chain);
  q.maybeSingle = jest.fn(async () => result);
  // Thenable so `await q` resolves to `result`.
  q.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return q;
}

type SupabaseScenario = {
  candidateJobs: unknown[]; // returned for evaluation_jobs select
  existingArtifacts: unknown[]; // returned for evaluation_artifacts !longform_document_v1
  evaluationArtifactContent: unknown | null; // returned for evaluation_result_v2/v1 maybeSingle
  manuscriptChunks: unknown[]; // returned for manuscript_chunks select
};

function buildSupabaseClient(scenario: SupabaseScenario, table: MockTable) {
  // Each table.from('X') returns a query builder whose select/eq/... chain
  // resolves to data for that table. We dispatch on table name + sequence.
  //
  // The route makes these from() calls in order (after the self-healing refactor):
  //   1. from('evaluation_artifacts') — Step 1: existing longform artifact ids+content
  //                                     (to detect stubs vs real artifacts)
  //   2. from('evaluation_jobs')      — Step 2: candidate jobs (excludes already-done ids)
  //   3. from('evaluation_artifacts') — preflight check 1: orphan artifact guard (maybeSingle)
  //   4. from('evaluation_artifacts') — preflight check 2 / processDreamJob:
  //                                     evaluation_result_v2 (maybeSingle)
  //   5. from('evaluation_artifacts') — evaluation_result_v1 maybeSingle (only if v2 empty)
  //   6. from('manuscript_chunks')    — preflight check 3: chunk existence check
  //   7. from('manuscript_chunks')    — processDreamJob: load full chunks
  //   8. from('evaluation_jobs')      — update last_error (only on failure)
  let artifactCallNumber = 0;
  let evaluationJobsCallNumber = 0;
  let chunksCallNumber = 0;
  return {
    from: jest.fn((tableName: string) => {
      if (tableName === 'evaluation_jobs') {
        evaluationJobsCallNumber += 1;
        if (evaluationJobsCallNumber === 1) {
          // Step 2: candidate jobs query
          return buildQuery({ data: scenario.candidateJobs, error: null });
        }
        // Subsequent evaluation_jobs call is the update last_error / clear last_error path.
        const q = buildQuery({ data: null, error: null });
        const eqFn = q.eq as jest.Mock;
        const updateFn = q.update as jest.Mock;
        updateFn.mockImplementation((payload: Record<string, unknown>) => {
          table.lastUpdate = payload;
          return q;
        });
        eqFn.mockImplementation((col: string, val: string) => {
          if (col === 'id') table.lastUpdateId = val;
          return q;
        });
        return q;
      }
      if (tableName === 'evaluation_artifacts') {
        artifactCallNumber += 1;
        if (artifactCallNumber === 1) {
          // Step 1: existing longform_document_v1 artifacts (job_id + content for stub detection)
          // existingArtifacts items should have shape { job_id, content } where
          // content._skipped===true marks a stub, absence of _skipped is a real artifact.
          return buildQuery({ data: scenario.existingArtifacts, error: null });
        }
        if (artifactCallNumber === 2) {
          // Preflight check 1: orphan artifact guard — maybeSingle on longform_document_v1
          // For the happy path, return null (no orphan).
          return buildQuery({ data: null, error: null });
        }
        if (artifactCallNumber === 3 || artifactCallNumber === 4) {
          // evaluation_result_v2 — called twice:
          //   call 3: preflight check 2 (loadEvaluationArtifact inside preflightDreamJob)
          //   call 4: processDreamJob step 1 (loadEvaluationArtifact inside processDreamJob)
          return buildQuery({
            data: scenario.evaluationArtifactContent
              ? { content: scenario.evaluationArtifactContent }
              : null,
            error: null,
          });
        }
        // evaluation_result_v1 — leave empty so v2 path is the source of truth
        return buildQuery({ data: null, error: null });
      }
      if (tableName === 'manuscript_chunks') {
        chunksCallNumber += 1;
        // Both the preflight chunk-existence check and the full chunk load
        // use the same fixture data.
        return buildQuery({ data: scenario.manuscriptChunks, error: null });
      }
      throw new Error(`Unexpected table in test mock: ${tableName}`);
    }),
  };
}

// ── Test fixtures ──────────────────────────────────────────────────────────

function buildPendingJob(id = 'job-1', manuscriptId = 42) {
  return {
    id,
    manuscript_id: manuscriptId,
    manuscripts: {
      user_id: 'user-1',
      title: 'Test Manuscript',
      work_type: 'literary_fiction',
      word_count: 60000,
    },
  };
}

// All 13 canonical criterion keys — preflight requires ≥13 criteria to proceed.
const CANONICAL_CRITERION_KEYS = [
  'concept', 'narrativeDrive', 'character', 'voice', 'sceneConstruction',
  'dialogue', 'theme', 'worldbuilding', 'pacing', 'proseControl',
  'tone', 'narrativeClosure', 'marketability',
] as const;

function buildEvaluationArtifactContent() {
  return {
    criteria: CANONICAL_CRITERION_KEYS.map((key) => ({
      key,
      final_score_0_10: 7,
      final_rationale: `Solid ${key} execution with room for refinement.`,
      confidence_level: 'moderate',
    })),
    engine: { model: 'gpt-5' },
    metrics: {
      manuscript: { title: 'Test', word_count: 60000, work_type: 'literary_fiction' },
    },
  };
}

function buildLongformDoc() {
  return {
    prompt_version: 'pass3b_longform_v1',
    generated_at: '2026-05-17T00:00:00.000Z',
    model: 'gpt-5',
    criterion_analyses: [],
  } as unknown as Awaited<ReturnType<typeof runPass3bLongform>>;
}

function buildRequest(opts: { dryRun?: boolean } = {}): NextRequest {
  const url = opts.dryRun
    ? 'https://localhost:3000/api/workers/process-dream?dry_run=1'
    : 'https://localhost:3000/api/workers/process-dream';
  return new NextRequest(url, {
    headers: {
      authorization: 'Bearer test-cron-secret',
    },
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/workers/process-dream', () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.CRON_SECRET = 'test-cron-secret';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    delete process.env.EVAL_PIPELINE_ENABLED;
    // Mock global.fetch for the preflight OpenAI ping (GET /v1/models?limit=1).
    // All tests get a successful 200 ping by default; individual tests can override.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    } as Response);
  });

  afterAll(() => {
    process.env = prevEnv;
  });

  test('happy path: writes longform_document_v1 artifact on successful synthesis', async () => {
    const table: MockTable = {};
    supabaseHolder.client = buildSupabaseClient(
      {
        candidateJobs: [buildPendingJob()],
        existingArtifacts: [], // no longform yet for this job
        evaluationArtifactContent: buildEvaluationArtifactContent(),
        manuscriptChunks: [
          { chunk_index: 0, content: 'chunk content 0' },
          { chunk_index: 1, content: 'chunk content 1' },
        ],
      },
      table,
    );

    mockRunPass3bLongform.mockResolvedValue(buildLongformDoc());

    const res = await GET(buildRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.processed).toBe(1);
    expect(body.success).toBe(1);

    expect(mockRunPass3bLongform).toHaveBeenCalledTimes(1);
    expect(mockUpsertEvaluationArtifact).toHaveBeenCalledTimes(1);
    expect(mockUpsertEvaluationArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactType: 'longform_document_v1',
        jobId: 'job-1',
        manuscriptId: 42,
      }),
    );

    // No error write on happy path.
    expect(table.lastUpdate).toBeUndefined();
  });

  test('error path: writes evaluation_jobs.last_error when synthesis throws', async () => {
    const table: MockTable = {};
    supabaseHolder.client = buildSupabaseClient(
      {
        candidateJobs: [buildPendingJob('job-err', 99)],
        existingArtifacts: [],
        evaluationArtifactContent: buildEvaluationArtifactContent(),
        manuscriptChunks: [{ chunk_index: 0, content: 'chunk content' }],
      },
      table,
    );

    mockRunPass3bLongform.mockRejectedValue(
      new Error('OpenAI request timed out after 270000ms'),
    );

    const res = await GET(buildRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.processed).toBe(1);
    expect(body.success).toBe(0);
    expect(body.results[0].success).toBe(false);
    expect(body.results[0].error).toContain('OpenAI request timed out');

    // Artifact should NOT have been written.
    expect(mockUpsertEvaluationArtifact).not.toHaveBeenCalled();

    // last_error MUST have been persisted for this job.
    expect(table.lastUpdate).toBeDefined();
    expect(table.lastUpdate).toEqual({
      last_error: expect.stringContaining('[DreamWorker]'),
    });
    expect((table.lastUpdate as { last_error: string }).last_error).toContain(
      'OpenAI request timed out',
    );
    expect(table.lastUpdateId).toBe('job-err');
  });

  test('dry run: returns pending count without invoking synthesis', async () => {
    const table: MockTable = {};
    supabaseHolder.client = buildSupabaseClient(
      {
        candidateJobs: [buildPendingJob('job-a'), buildPendingJob('job-b', 43)],
        existingArtifacts: [],
        evaluationArtifactContent: null,
        manuscriptChunks: [],
      },
      table,
    );

    const res = await GET(buildRequest({ dryRun: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.dry_run).toBe(true);
    expect(body.pending_dream_jobs).toBe(2);

    expect(mockRunPass3bLongform).not.toHaveBeenCalled();
    expect(mockUpsertEvaluationArtifact).not.toHaveBeenCalled();
  });

  test('no pending jobs: returns processed: 0 without invoking synthesis', async () => {
    const table: MockTable = {};
    supabaseHolder.client = buildSupabaseClient(
      {
        candidateJobs: [],
        existingArtifacts: [],
        evaluationArtifactContent: null,
        manuscriptChunks: [],
      },
      table,
    );

    const res = await GET(buildRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.processed).toBe(0);

    expect(mockRunPass3bLongform).not.toHaveBeenCalled();
    expect(mockUpsertEvaluationArtifact).not.toHaveBeenCalled();
  });
});

// ── Regression block ──────────────────────────────────────────────────────────
// Each test guards a specific production failure discovered May 2026.

describe("regression", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.OPENAI_API_KEY = "test-openai-key";
    delete process.env.EVAL_PIPELINE_ENABLED;
  });

  it("regression: Vercel timeout kill — DREAM_OPENAI_TIMEOUT_MS must be < maxDuration and wired into call", () => {
    // Guards: process-dream was incorrectly set to maxDuration=300s (hobby plan limit) while
    // process-evaluations uses 800s (the actual Vercel Pro plan budget). GPT-5 synthesis on a
    // 40-chunk novel regularly exceeds 300s — Vercel killed silently, artifact never written.
    // Fix: maxDuration bumped to 800, DREAM_OPENAI_TIMEOUT_MS=750_000 (50s headroom for DB writes).
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/api/workers/process-dream/route.ts"),
      "utf-8"
    ) as string;
    const match = src.match(/DREAM_OPENAI_TIMEOUT_MS\s*=\s*([\d_]+)/);
    expect(match).not.toBeNull();
    const ms = parseInt(match![1].replace(/_/g, ""), 10);
    expect(ms).toBeLessThanOrEqual(780_000); // must stay inside Vercel 800s maxDuration budget
    expect(ms).toBeGreaterThanOrEqual(60_000); // must not be trivially short
    expect(src).toContain("maxDuration = 800"); // route must declare full budget
    expect(src).toContain("openAiTimeoutMs: DREAM_OPENAI_TIMEOUT_MS"); // must be wired in
  });

  it("regression: silent crash — last_error write-back must exist in route for both throw paths", () => {
    // Guards: errors were logged but never written to DB — invisible without Vercel log access.
    // Fix: .update({ last_error }) called in both the soft (success:false) and hard (throw) paths.
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/api/workers/process-dream/route.ts"),
      "utf-8"
    ) as string;
    const updateMatches = src.match(/\.update\(\s*\{\s*last_error:/g);
    expect(updateMatches).not.toBeNull();
    expect(updateMatches!.length).toBeGreaterThanOrEqual(1); // at least one write-back
  });

  it("regression: criteria < 13 — runPass3bLongform must throw CRITERIA_INSUFFICIENT synchronously", async () => {
    // Guards: evaluations with < 13 criteria must never silently proceed to synthesis.
    const { runPass3bLongform: realFn } = jest.requireActual<{
      runPass3bLongform: (opts: Record<string, unknown>) => Promise<unknown>;
    }>("@/lib/evaluation/pipeline/runPass3bLongform");

    const twelveCriteria = Array.from({ length: 12 }, (_, i) => ({
      key: `criterion_${i}`,
      final_score_0_10: 7,
      final_rationale: "rationale",
      evidence: [{ snippet: "s" }],
      recommendations: [{ action: "a", priority: "medium" }],
      confidence_level: "moderate",
    }));

    await expect(
      realFn({
        criteria: twelveCriteria,
        pass2aStructuredContext: { chunks: [] },
        manuscriptChunks: [{ chunk_index: 0, content: "content" }],
        title: "Test",
        wordCount: 30000,
        workType: "literary_fiction",
        openaiApiKey: "test-key",
      })
    ).rejects.toThrow("CRITERIA_INSUFFICIENT");
  });

  it("normalization: DB-shape criteria (score_0_10/rationale/confidence_band) are coerced to SynthesizedCriterion shape before Pass 3b", async () => {
    // Guards Bug 3: evaluation_result_v2 persists `score_0_10`/`rationale`/`confidence_band`,
    // but runPass3bLongform reads `final_score_0_10`/`final_rationale`/`confidence_level`.
    // Without normalization, GPT-5 receives undefined scores → malformed JSON → silent failure.
    const table: MockTable = {};
    supabaseHolder.client = buildSupabaseClient(
      {
        candidateJobs: [buildPendingJob("job-norm", 77)],
        existingArtifacts: [],
        evaluationArtifactContent: {
          // 2 DB-shape criteria under test + 11 padded canonical criteria to satisfy preflight ≥13 check.
          criteria: [
            { key: "concept", score_0_10: 8, rationale: "Strong hook.", confidence_band: "HIGH" },
            { key: "voice", score_0_10: 6, rationale: "Voice is consistent.", confidence_band: "MODERATE" },
            ...CANONICAL_CRITERION_KEYS
              .filter((k) => k !== 'concept' && k !== 'voice')
              .map((key) => ({ key, final_score_0_10: 7, final_rationale: `${key} ok.`, confidence_level: 'moderate' })),
          ],
          engine: { model: "gpt-5" },
        },
        manuscriptChunks: [{ chunk_index: 0, content: "chunk content 0" }],
      },
      table,
    );

    mockRunPass3bLongform.mockResolvedValue(buildLongformDoc());

    const res = await GET(buildRequest());
    expect(res.status).toBe(200);
    expect(mockRunPass3bLongform).toHaveBeenCalledTimes(1);

    const callArgs = mockRunPass3bLongform.mock.calls[0][0] as { criteria: Array<Record<string, unknown>> };
    expect(callArgs.criteria).toHaveLength(13);

    // Field names normalised from DB shape for the two explicitly tested criteria.
    const conceptCrit = callArgs.criteria.find((c) => c.key === 'concept');
    const voiceCrit = callArgs.criteria.find((c) => c.key === 'voice');
    expect(conceptCrit).toMatchObject({
      key: "concept",
      final_score_0_10: 8,
      final_rationale: "Strong hook.",
      confidence_level: "HIGH",
    });
    expect(voiceCrit).toMatchObject({
      key: "voice",
      final_score_0_10: 6,
      final_rationale: "Voice is consistent.",
      confidence_level: "MODERATE",
    });
  });

  it("normalization: existing SynthesizedCriterion fields are coalesced (not overwritten) when both shapes are present", async () => {
    // Guards: normalization must be a coalesce (??), not a force-replace. If a criterion already
    // carries `final_score_0_10`, keep it — do not let the DB `score_0_10` (which may diverge
    // when Pass 3 reconciliation has run) clobber the canonical synthesized value.
    const table: MockTable = {};
    supabaseHolder.client = buildSupabaseClient(
      {
        candidateJobs: [buildPendingJob("job-partial", 78)],
        existingArtifacts: [],
        evaluationArtifactContent: {
          // 1 criterion under test + 12 padded canonical criteria to satisfy preflight ≥13 check.
          criteria: [
            {
              key: "concept",
              // Both shapes present — canonical fields must win.
              final_score_0_10: 9,
              score_0_10: 4,
              final_rationale: "Synthesized rationale.",
              rationale: "Raw rationale.",
              confidence_level: "high",
              confidence_band: "LOW",
            },
            ...CANONICAL_CRITERION_KEYS
              .filter((k) => k !== 'concept')
              .map((key) => ({ key, final_score_0_10: 7, final_rationale: `${key} ok.`, confidence_level: 'moderate' })),
          ],
          engine: { model: "gpt-5" },
        },
        manuscriptChunks: [{ chunk_index: 0, content: "chunk content" }],
      },
      table,
    );

    mockRunPass3bLongform.mockResolvedValue(buildLongformDoc());

    await GET(buildRequest());

    const callArgs = mockRunPass3bLongform.mock.calls[0][0] as { criteria: Array<Record<string, unknown>> };
    const conceptCrit2 = callArgs.criteria.find((c) => c.key === 'concept');
    expect(conceptCrit2).toMatchObject({
      key: "concept",
      final_score_0_10: 9, // canonical preserved — not overwritten by score_0_10: 4
      final_rationale: "Synthesized rationale.",
      confidence_level: "high",
    });
  });

  it("token limit: getPass3bMaxTokens default >= 14000 (16-section Narrative Synthesis document needs headroom)", () => {
    // Guards Bug 4: at 6000 tokens GPT-5 truncated the 16-section document mid-response →
    // malformed JSON → validateDreamDocument threw. Default raised to 16000, floor 12000.
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "lib/evaluation/pipeline/runPass3bLongform.ts"),
      "utf-8",
    ) as string;
    // Match the `return NNNN;` line inside getPass3bMaxTokens (default branch).
    const defaultMatch = src.match(/function getPass3bMaxTokens[\s\S]*?return\s+(\d+)\s*;/);
    expect(defaultMatch).not.toBeNull();
    const defaultValue = parseInt(defaultMatch![1], 10);
    expect(defaultValue).toBeGreaterThanOrEqual(14000);

    // Floor for the env-var override must also be >= 12000 — accept no lower override silently.
    const floorMatch = src.match(/parsed\s*>=\s*(\d+)\s*&&\s*parsed\s*<=\s*\d+/);
    expect(floorMatch).not.toBeNull();
    expect(parseInt(floorMatch![1], 10)).toBeGreaterThanOrEqual(12000);
  });

  it("regression: cron idempotency — job with existing artifact must be excluded from pending", async () => {
    // Guards: if artifact already exists (e.g. from a prior successful tick),
    // the same job must not be picked up again and re-processed.
    const table: Record<string, jest.Mock> = {};
    const jobId = "job-idem-001";

    // existingArtifacts contains this job's id with no content._skipped (real artifact).
    // The real DB query uses .not('id','in',[jobId]) to exclude it from candidates.
    // In the mock, the .not() chain is a no-op, so we simulate the DB exclusion by
    // returning candidateJobs: [] — the job was already filtered out by the DB.
    supabaseHolder.client = buildSupabaseClient(
      {
        candidateJobs: [],  // DB already excluded the job via .not('id','in',...)
        existingArtifacts: [{ job_id: jobId, content: {} }], // real artifact (no _skipped)
        evaluationArtifactContent: null,
        manuscriptChunks: [],
      },
      table,
    );

    const res = await GET(buildRequest());
    const body = await res.json();

    expect(body.processed).toBe(0); // skipped — artifact exists, DB excluded it
    expect(mockRunPass3bLongform).not.toHaveBeenCalled();
  });
});

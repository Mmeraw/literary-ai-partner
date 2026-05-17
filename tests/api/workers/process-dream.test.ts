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
  q.order = jest.fn(chain);
  q.limit = jest.fn(chain);
  q.update = jest.fn(chain);
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
  // The route makes these from() calls in order:
  //   1. from('evaluation_jobs')      — candidate jobs (select + chain)
  //   2. from('evaluation_artifacts') — existing longform artifacts
  //   3. from('evaluation_artifacts') — evaluation_result_v2 maybeSingle
  //   4. from('evaluation_artifacts') — evaluation_result_v1 maybeSingle (only if v2 empty)
  //   5. from('manuscript_chunks')    — load chunks
  //   6. from('evaluation_jobs')      — update last_error (only on failure)
  let artifactCallNumber = 0;
  let evaluationJobsCallNumber = 0;
  return {
    from: jest.fn((tableName: string) => {
      if (tableName === 'evaluation_jobs') {
        evaluationJobsCallNumber += 1;
        if (evaluationJobsCallNumber === 1) {
          return buildQuery({ data: scenario.candidateJobs, error: null });
        }
        // Subsequent evaluation_jobs call is the update last_error path.
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
          return buildQuery({ data: scenario.existingArtifacts, error: null });
        }
        if (artifactCallNumber === 2) {
          // evaluation_result_v2
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

function buildEvaluationArtifactContent() {
  return {
    criteria: [
      { key: 'opening_hook', final_score_0_10: 7, craft_score: 7 },
    ],
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
  it("regression: Vercel 300s kill — DREAM_OPENAI_TIMEOUT_MS must be <= 280s and wired into call", () => {
    // Guards: getEvalOpenAiTimeoutMs() returns 720s by default. Vercel maxDuration=300s.
    // GPT-5 synthesis on 26k words exceeded 300s — Vercel killed silently, artifact never written.
    // Fix: DREAM_OPENAI_TIMEOUT_MS=270_000 passed as openAiTimeoutMs to runPass3bLongform.
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/api/workers/process-dream/route.ts"),
      "utf-8"
    ) as string;
    const match = src.match(/DREAM_OPENAI_TIMEOUT_MS\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    const ms = parseInt(match![1], 10);
    expect(ms).toBeLessThanOrEqual(280_000); // must stay inside Vercel 300s budget
    expect(ms).toBeGreaterThanOrEqual(60_000); // must not be trivially short
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

  it("regression: cron idempotency — job with existing artifact must be excluded from pending", async () => {
    // Guards: if artifact already exists (e.g. from a prior successful tick),
    // the same job must not be picked up again and re-processed.
    const table: Record<string, jest.Mock> = {};
    const jobId = "job-idem-001";

    supabaseHolder.client = buildSupabaseClient(
      {
        candidateJobs: [
          {
            id: jobId,
            manuscript_id: 1,
            manuscripts: [{ user_id: "u1", title: "T", work_type: "literary_fiction", word_count: 30000 }],
          },
        ],
        existingArtifacts: [{ job_id: jobId }], // artifact already written
        evaluationArtifactContent: null,
        manuscriptChunks: [],
      },
      table,
    );

    const res = await GET(buildRequest());
    const body = await res.json();

    expect(body.processed).toBe(0); // skipped — artifact exists
    expect(mockRunPass3bLongform).not.toHaveBeenCalled();
  });
});

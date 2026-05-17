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

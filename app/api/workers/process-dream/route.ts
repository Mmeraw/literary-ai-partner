/**
 * DREAM Worker API Route
 *
 * Async Pass 3b — Long-Form DREAM Document Synthesis Worker
 *
 * Decoupled from the main evaluation worker to prevent 800s Vercel timeout
 * on full-novel evaluations (issue #543, fix/pass3b-async-dream-worker).
 *
 * Lifecycle:
 *   1. Cron fires every 2 minutes (every-2-min cron: "*\/2 * * * *")
 *   2. Query: evaluation_jobs WHERE status='complete' AND word_count >= 25000
 *      AND no longform_document_v1 artifact exists yet
 *   3. Load manuscript_chunks for the job
 *   4. Load evaluation_result artifact to recover criteria + pass2a context
 *   5. Call runPass3bLongform(...)
 *   6. Persist result as evaluation_artifacts (longform_document_v1)
 *
 * Authentication: same multi-layer pattern as /api/workers/process-evaluations
 *   1. Vercel Cron: x-vercel-cron=1 + x-vercel-id
 *   2. Manual: Authorization: Bearer <CRON_SECRET>
 *   3. Dev only: ?secret=<CRON_SECRET>
 *   4. Dev proof mode: Bearer <SUPABASE_SERVICE_ROLE_KEY> + WORKER_ALLOW_SERVICE_ROLE_DEV=1
 *
 * GET /api/workers/process-dream
 * GET /api/workers/process-dream?dry_run=1  (counts pending jobs, no synthesis)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkServiceRoleAuth } from '@/lib/auth/api';
import crypto from 'crypto';
import { getEvaluationRuntimeConfig } from '@/lib/config/evaluationRuntimeConfig';
import { isPipelineEnabled, pipelineDisabledResponse } from '@/lib/config/pipelineGuard';
import { runPass3bLongform } from '@/lib/evaluation/pipeline/runPass3bLongform';
import { buildPass2aStructuredContext } from '@/lib/evaluation/pipeline/buildPass2aStructuredContext';
import {
  stableSourceHash,
  upsertEvaluationArtifact,
} from '@/lib/evaluation/artifactPersistence';
import type { ManuscriptChunkEvidence } from '@/lib/evaluation/pipeline/types';

// Force Node.js runtime (required for crypto module)
export const runtime = 'nodejs';
// DREAM synthesis only — independent budget from main worker.
// Matches process-evaluations maxDuration=800 (Vercel Pro/Enterprise plan).
// GPT-5 synthesis on a 40-chunk novel can take 3-8 min; 800s gives full headroom.
export const maxDuration = 800;

// ── Constants ─────────────────────────────────────────────────────────────────

const DREAM_WORD_COUNT_THRESHOLD = 25000;
// Process at most 1 job per tick to stay well within maxDuration.
const DREAM_BATCH_SIZE = 1;
// Cap OpenAI timeout below Vercel maxDuration (800s) so the SDK errors out
// before Vercel kills the function — otherwise the catch block never runs
// and failures are silent. 750s leaves 50s headroom for DB writes + response overhead.
const DREAM_OPENAI_TIMEOUT_MS = 750_000;

// ── Types ─────────────────────────────────────────────────────────────────────

type DreamJobRow = {
  id: string;
  manuscript_id: number;
  // word_count comes from manuscripts join, not evaluation_jobs (evaluation_jobs has no word_count column)
  word_count: number | null;
  manuscripts: {
    user_id: string;
    title: string | null;
    work_type: string | null;
    word_count: number | null;
  } | null;
};

// ── Auth utilities (mirrors process-evaluations/route.ts) ─────────────────────

const MAX_SECRET_LENGTH = 512;

function timingSafeEqual(
  a?: string | null,
  b?: string | null,
): { equal: boolean; secretTooLong: boolean } {
  if (!a || !b) return { equal: false, secretTooLong: false };
  if (a.length > MAX_SECRET_LENGTH || b.length > MAX_SECRET_LENGTH) {
    return { equal: false, secretTooLong: true };
  }
  const aHash = crypto.createHash('sha256').update(a, 'utf8').digest();
  const bHash = crypto.createHash('sha256').update(b, 'utf8').digest();
  return { equal: crypto.timingSafeEqual(aHash, bHash), secretTooLong: false };
}

function extractBearer(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function isOnVercelPlatform(): boolean {
  return process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;
}

function isVercelCronInvocation(req: NextRequest): boolean {
  const cronHeader = req.headers.get('x-vercel-cron') === '1';
  const vercelId = req.headers.get('x-vercel-id');
  return cronHeader && !!vercelId && isOnVercelPlatform();
}

function checkAuthorization(
  req: NextRequest,
): { authorized: boolean; method: string; secretTooLong: boolean } {
  const runtimeConfig = getEvaluationRuntimeConfig();
  const expectedSecret = process.env.CRON_SECRET || '';
  const bearer = extractBearer(req.headers.get('authorization'));
  const allowDevServiceRole =
    runtimeConfig.platform.nodeEnv === 'development' &&
    runtimeConfig.worker.allowDevServiceRole;

  if (isVercelCronInvocation(req)) {
    return { authorized: true, method: 'vercel_cron', secretTooLong: false };
  }

  if (expectedSecret && bearer) {
    const result = timingSafeEqual(bearer, expectedSecret);
    if (result.secretTooLong) {
      return { authorized: false, method: 'bearer_rejected', secretTooLong: true };
    }
    if (result.equal) {
      return { authorized: true, method: 'bearer', secretTooLong: false };
    }
  }

  if (runtimeConfig.platform.nodeEnv === 'development') {
    const querySecret = req.nextUrl.searchParams.get('secret');
    if (expectedSecret && querySecret) {
      const result = timingSafeEqual(querySecret, expectedSecret);
      if (result.secretTooLong) {
        return { authorized: false, method: 'dev_query_rejected', secretTooLong: true };
      }
      if (result.equal) {
        return { authorized: true, method: 'dev_query', secretTooLong: false };
      }
    }
  }

  if (allowDevServiceRole && checkServiceRoleAuth(req)) {
    return { authorized: true, method: 'dev_service_role', secretTooLong: false };
  }

  return { authorized: false, method: 'none', secretTooLong: false };
}

// ── Supabase client factory ───────────────────────────────────────────────────

function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('[DreamWorker] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // 30s fetch timeout per Supabase query — prevents indefinite hangs on
      // chunk loads or artifact writes from consuming the Vercel 800s budget.
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(30_000) }),
    },
  });
}

// ── Core: find jobs that need DREAM synthesis ─────────────────────────────────

/**
 * Query for complete long-form jobs that have no longform_document_v1 artifact yet.
 *
 * Strategy: LEFT JOIN evaluation_artifacts on (job_id, artifact_type='longform_document_v1'),
 * filter where artifact IS NULL.
 *
 * Supabase JS client does not support LEFT JOIN natively, so we do two queries:
 *  1. Fetch complete long-form job IDs (word_count >= threshold)
 *  2. Fetch existing longform_document_v1 artifact job_ids
 *  3. Return the difference
 */
async function findPendingDreamJobs(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  limit: number,
): Promise<DreamJobRow[]> {
  // Step 1: candidate complete long-form jobs
  // Push word_count threshold to the DB — filtering post-join in JS on a capped result
  // set caused the worker to silently skip all long-form jobs when short-manuscript jobs
  // occupied the entire fetch window (fix for: cron finds 0 pending DREAM jobs).
  // PostgREST supports filter on !inner join columns directly.
  const { data: candidateJobs, error: jobsError } = await supabase
    .from('evaluation_jobs')
    .select(
      `
      id,
      manuscript_id,
      manuscripts!inner(user_id, title, work_type, word_count)
    `,
    )
    .eq('status', 'complete')
    .gte('manuscripts.word_count', DREAM_WORD_COUNT_THRESHOLD)
    .order('updated_at', { ascending: true }) // oldest completed first
    .limit(limit * 10); // smaller multiplier sufficient — DB pre-filters by word_count

  if (jobsError) {
    throw new Error(`[DreamWorker] Failed to query candidate jobs: ${jobsError.message}`);
  }

  if (!candidateJobs || candidateJobs.length === 0) {
    return [];
  }

  const candidateIds = candidateJobs.map((j: { id: string }) => j.id);

  // Step 2: which of those already have a longform_document_v1 artifact?
  const { data: existingArtifacts, error: artifactsError } = await supabase
    .from('evaluation_artifacts')
    .select('job_id')
    .eq('artifact_type', 'longform_document_v1')
    .in('job_id', candidateIds);

  if (artifactsError) {
    throw new Error(
      `[DreamWorker] Failed to query existing artifacts: ${artifactsError.message}`,
    );
  }

  const alreadyDoneIds = new Set((existingArtifacts ?? []).map((a: { job_id: string }) => a.job_id));

  // Step 3: filter to jobs that still need DREAM synthesis.
  // Supabase returns manuscripts as an array from the !inner join; normalise to DreamJobRow.
  const pending = ((candidateJobs as unknown) as Array<{
    id: string;
    manuscript_id: number;
    manuscripts: Array<{ user_id: string; title: string | null; work_type: string | null; word_count: number | null }> | { user_id: string; title: string | null; work_type: string | null; word_count: number | null } | null;
  }>)
    .map((j): DreamJobRow => {
      const ms = Array.isArray(j.manuscripts) ? (j.manuscripts[0] ?? null) : j.manuscripts;
      return {
        id: j.id,
        manuscript_id: j.manuscript_id,
        word_count: ms?.word_count ?? null, // sourced from manuscripts.word_count
        manuscripts: ms,
      };
    })
    // DB already filtered by word_count threshold; JS filter is a belt-and-suspenders guard.
    .filter((j) => (j.word_count ?? 0) >= DREAM_WORD_COUNT_THRESHOLD)
    .filter((j) => !alreadyDoneIds.has(j.id));
  return pending.slice(0, limit);
}

// ── Core: load evaluation artifact to recover criteria + synthesis context ────

// evaluation_result_v2 stores criteria/engine/metrics at the TOP LEVEL of content.
// evaluation_result_v1 (legacy) wraps them under content.evaluation_result.
// Both shapes are handled in processDreamJob via extractFromArtifact().
type EvaluationArtifactContent = {
  // v2 shape — top-level fields
  criteria?: unknown[];
  engine?: { model?: string };
  metrics?: {
    manuscript?: { title?: string; word_count?: number; work_type?: string };
  };
  // v1 shape — nested under evaluation_result
  evaluation_result?: {
    criteria?: unknown[];
    engine?: { model?: string };
    metrics?: {
      manuscript?: { title?: string; word_count?: number; work_type?: string };
    };
  };
  [key: string]: unknown;
};

/** Extract criteria/engine from either v2 (top-level) or v1 (nested) artifact shape. */
function extractFromArtifact(content: EvaluationArtifactContent) {
  // v2: criteria at top level
  if (Array.isArray(content.criteria) && content.criteria.length > 0) {
    return {
      criteria: content.criteria,
      model: (content.engine as { model?: string } | undefined)?.model,
    };
  }
  // v1: criteria nested under evaluation_result
  if (Array.isArray(content.evaluation_result?.criteria) && (content.evaluation_result?.criteria?.length ?? 0) > 0) {
    return {
      criteria: content.evaluation_result!.criteria!,
      model: content.evaluation_result?.engine?.model,
    };
  }
  return null;
}

async function loadEvaluationArtifact(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  jobId: string,
): Promise<EvaluationArtifactContent | null> {
  // Try evaluation_result_v2 first, fall back to evaluation_result_v1
  for (const artifactType of ['evaluation_result_v2', 'evaluation_result_v1'] as const) {
    const { data, error } = await supabase
      .from('evaluation_artifacts')
      .select('content')
      .eq('job_id', jobId)
      .eq('artifact_type', artifactType)
      .maybeSingle();

    if (error) {
      console.warn(`[DreamWorker] ${jobId}: error fetching ${artifactType}: ${error.message}`);
      continue;
    }
    if (data?.content) {
      return data.content as EvaluationArtifactContent;
    }
  }
  return null;
}

// ── Core: load manuscript chunks ──────────────────────────────────────────────

async function loadManuscriptChunks(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  manuscriptId: number,
): Promise<ManuscriptChunkEvidence[]> {
  const { data: chunkRows, error } = await supabase
    .from('manuscript_chunks')
    .select('chunk_index, content')
    .eq('manuscript_id', manuscriptId)
    .order('chunk_index', { ascending: true });

  if (error) {
    throw new Error(
      `[DreamWorker] Failed to load chunks for manuscript ${manuscriptId}: ${error.message}`,
    );
  }

  return ((chunkRows ?? []) as { chunk_index: number; content: string }[])
    .filter((row) => typeof row.chunk_index === 'number' && typeof row.content === 'string' && row.content.trim().length > 0)
    .map((row) => ({ chunk_index: row.chunk_index, content: row.content }));
}

// ── Core: synthesise and persist one DREAM document ──────────────────────────

async function processDreamJob(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  job: DreamJobRow,
): Promise<{ success: boolean; error?: string }> {
  const { id: jobId, manuscript_id: manuscriptId } = job;
  const manuscript = Array.isArray(job.manuscripts) ? job.manuscripts[0] : job.manuscripts;
  const userId = manuscript?.user_id ?? '';
  const title = manuscript?.title ?? 'Untitled';
  const wordCount = typeof job.word_count === 'number' ? job.word_count : DREAM_WORD_COUNT_THRESHOLD;

  console.log(`[DreamWorker] ${jobId}: starting DREAM synthesis — words=${wordCount}`);

  // 1. Load evaluation artifact (need criteria array)
  const artifactContent = await loadEvaluationArtifact(supabase, jobId);
  if (!artifactContent) {
    return { success: false, error: 'No evaluation artifact found — job may not have persisted correctly' };
  }

  const extracted = extractFromArtifact(artifactContent);
  if (!extracted) {
    return { success: false, error: 'criteria missing from artifact (tried v2 top-level and v1 evaluation_result path)' };
  }
  const { criteria: rawCriteria, model: artifactModel } = extracted;

  // Normalize DB-shape criteria → SynthesizedCriterion shape expected by Pass 3b.
  // evaluation_result_v2 persists fields as `score_0_10`, `rationale`, `confidence_band`,
  // but runPass3bLongform / buildPass3bUserPrompt / applyTruthfulLongformCriteriaFallback
  // all read `final_score_0_10`, `final_rationale`, `confidence_level`. Without coalescing,
  // GPT-5 received undefined scores → returned malformed JSON → validateDreamDocument threw
  // → artifact was never persisted (silent failure path closed by this PR).
  // Coalesce, do not force-replace: in-memory criteria that already carry the canonical
  // SynthesizedCriterion field names must pass through untouched.
  const normalizedCriteria = (rawCriteria as Array<Record<string, unknown>>).map((c) => ({
    ...c,
    final_score_0_10: c.final_score_0_10 ?? c.score_0_10,
    final_rationale: c.final_rationale ?? c.rationale,
    confidence_level: c.confidence_level ?? c.confidence_band,
  }));

  // 2. Load manuscript chunks
  const manuscriptChunks = await loadManuscriptChunks(supabase, manuscriptId);
  if (manuscriptChunks.length === 0) {
    return { success: false, error: `No manuscript chunks found for manuscript_id=${manuscriptId}` };
  }

  console.log(`[DreamWorker] ${jobId}: loaded ${manuscriptChunks.length} chunks`);

  // 3. Rebuild pass2aStructuredContext from chunks (mirrors runPipeline.ts)
  const pass2aStructuredContext = buildPass2aStructuredContext({
    manuscriptText: '', // chunks are the primary source; manuscriptText is fallback
    manuscriptChunks,
  });

  // 4. Recover model from artifact, fall back to env default
  const model = artifactModel ?? undefined;

  // 5. Run Pass 3b — DREAM synthesis
  const openaiApiKey = process.env.OPENAI_API_KEY ?? '';
  if (!openaiApiKey) {
    return { success: false, error: 'OPENAI_API_KEY not configured' };
  }

  const longformDoc = await runPass3bLongform({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    criteria: normalizedCriteria as any,
    pass2aStructuredContext,
    manuscriptChunks,
    title,
    wordCount,
    workType: manuscript?.work_type ?? 'literary_fiction',
    model,
    openaiApiKey,
    openAiTimeoutMs: DREAM_OPENAI_TIMEOUT_MS,
  });

  console.log(`[DreamWorker] ${jobId}: DREAM synthesis complete — persisting artifact`);

  // 6. Persist longform_document_v1 artifact
  // Source hash uses job+manuscript identity + prompt_version + model for idempotency.
  // We do NOT include manuscriptText here (too large); chunk count proxies content identity.
  const sourceHash = stableSourceHash({
    manuscriptId,
    jobId,
    userId,
    manuscriptText: `chunks:${manuscriptChunks.length}`,
    promptVersion: `longform_document_v1:${longformDoc.prompt_version}`,
    model: longformDoc.model,
  });

  await upsertEvaluationArtifact({
    supabase,
    jobId,
    manuscriptId,
    artifactType: 'longform_document_v1',
    artifactVersion: longformDoc.prompt_version,
    sourceHash,
    content: {
      schema_version: 'longform_document_v1',
      created_at: longformDoc.generated_at,
      job_id: jobId,
      manuscript_id: manuscriptId,
      longform_document: longformDoc,
    },
  });

  console.log(`[DreamWorker] ${jobId}: persisted longform_document_v1 artifact ✓`);
  return { success: true };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const traceId = crypto.randomUUID().slice(0, 8);
  const startMs = Date.now();

  // ── Pipeline guard ─────────────────────────────────────────────────────────
  if (!isPipelineEnabled()) {
    console.warn('[DreamWorker] EVAL_PIPELINE_ENABLED=false — skipping DREAM synthesis');
    return NextResponse.json(pipelineDisabledResponse(), { status: 200 });
  }

  // ── Authorization ──────────────────────────────────────────────────────────
  const { authorized, method, secretTooLong } = checkAuthorization(req);
  if (secretTooLong) {
    return NextResponse.json({ error: 'Secret too long' }, { status: 400 });
  }
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isDryRun = req.nextUrl.searchParams.get('dry_run') === '1';

  console.log(`[DreamWorker] ${traceId}: invoked auth=${method} dry_run=${isDryRun}`);

  try {
    const supabase = createSupabaseAdmin();

    // ── Dry run: just count pending jobs ──────────────────────────────────
    if (isDryRun) {
      const pending = await findPendingDreamJobs(supabase, 50);
      return NextResponse.json({
        ok: true,
        dry_run: true,
        pending_dream_jobs: pending.length,
        trace_id: traceId,
        elapsed_ms: Date.now() - startMs,
      });
    }

    // ── Find pending jobs ─────────────────────────────────────────────────
    const pendingJobs = await findPendingDreamJobs(supabase, DREAM_BATCH_SIZE);

    if (pendingJobs.length === 0) {
      console.log(`[DreamWorker] ${traceId}: no pending DREAM jobs`);
      return NextResponse.json({
        ok: true,
        processed: 0,
        trace_id: traceId,
        elapsed_ms: Date.now() - startMs,
      });
    }

    // ── Process jobs (1 per tick) ─────────────────────────────────────────
    const results: Array<{ jobId: string; success: boolean; error?: string }> = [];

    for (const job of pendingJobs) {
      try {
        const result = await processDreamJob(supabase, job);
        results.push({ jobId: job.id, ...result });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[DreamWorker] ${traceId}: job ${job.id} threw unexpectedly: ${errMsg}`);

        // Write error back to evaluation_jobs.last_error so the failure is
        // visible in the DB. Without this, Vercel-killed runs (timeout) and
        // unhandled throws disappear silently from the operator's view.
        try {
          await supabase
            .from('evaluation_jobs')
            .update({ last_error: `[DreamWorker] ${errMsg.slice(0, 500)}` })
            .eq('id', job.id);
        } catch {
          // best-effort — don't let error reporting crash the worker
        }

        results.push({ jobId: job.id, success: false, error: errMsg });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const elapsed = Date.now() - startMs;

    console.log(
      `[DreamWorker] ${traceId}: done — processed=${results.length} success=${successCount} elapsed=${elapsed}ms`,
    );

    return NextResponse.json({
      ok: true,
      processed: results.length,
      success: successCount,
      results,
      trace_id: traceId,
      elapsed_ms: elapsed,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[DreamWorker] ${traceId}: fatal error: ${errMsg}`);
    return NextResponse.json(
      { ok: false, error: errMsg, trace_id: traceId, elapsed_ms: Date.now() - startMs },
      { status: 500 },
    );
  }
}

/**
 * Character Arc Audit Worker API Route
 *
 * Silent report QA layer — runs automatically after every completed eval.
 * NEVER user-visible. Zero impact on 13-criterion story score.
 *
 * Mirrors the DREAM worker pattern (process-dream/route.ts).
 *
 * Lifecycle:
 *   1. Cron fires every 3 minutes
 *   2. Query: evaluation_jobs WHERE status='complete'
 *      AND no character_arc_ledger_v1 artifact exists yet
 *   3. Load manuscript chunks
 *   4. Run runCharacterArcExtraction (single focused LLM pass)
 *   5. Persist result as evaluation_artifacts (character_arc_ledger_v1)
 *   6. Gate enforcement (hard/soft fail + re-render trigger) → PR-581
 *
 * Authentication: same multi-layer pattern as process-evaluations/route.ts
 *   1. Vercel Cron: x-vercel-cron=1 + x-vercel-id
 *   2. Manual: Authorization: Bearer <CRON_SECRET>
 *   3. Dev only: ?secret=<CRON_SECRET>
 *   4. Dev proof mode: Bearer <SUPABASE_SERVICE_ROLE_KEY> + WORKER_ALLOW_SERVICE_ROLE_DEV=1
 *
 * GET /api/workers/process-character-arc
 * GET /api/workers/process-character-arc?dry_run=1
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkServiceRoleAuth } from '@/lib/auth/api';
import crypto from 'crypto';
import { getEvaluationRuntimeConfig } from '@/lib/config/evaluationRuntimeConfig';
import { isPipelineEnabled, pipelineDisabledResponse } from '@/lib/config/pipelineGuard';
import { runCharacterArcExtraction, type ArcExtractionFailure } from '@/lib/evaluation/characterArc/runCharacterArcExtraction';
import {
  stableSourceHash,
  upsertEvaluationArtifact,
} from '@/lib/evaluation/artifactPersistence';
import { checkJobCancellation } from '@/lib/jobs/cancellationCheck';
import type { ManuscriptChunkEvidence } from '@/lib/evaluation/pipeline/types';
import type { CharacterArcLedgerArtifactContent } from '@/lib/evaluation/characterArc/types';

// Force Node.js runtime
export const runtime = 'nodejs';
// Character arc extraction is a single focused LLM pass — 120s is sufficient.
// 300s gives headroom for DB operations + multiple jobs per tick if needed.
export const maxDuration = 300;

// ── Constants ─────────────────────────────────────────────────────────────────

// Process at most 2 jobs per tick (extraction is fast — 1-2 min each)
const ARC_BATCH_SIZE = 2;

// ── Types ─────────────────────────────────────────────────────────────────────

type ArcJobRow = {
  id: string;
  manuscript_id: number;
  manuscripts: {
    user_id: string;
    title: string | null;
    word_count: number | null;
    work_type: string | null;
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
    throw new Error('[ArcWorker] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(30_000) }),
    },
  });
}

// ── Find pending jobs ─────────────────────────────────────────────────────────

/**
 * Find complete jobs that need character arc extraction.
 * Excludes jobs that already have a character_arc_ledger_v1 artifact.
 */
async function findPendingArcJobs(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  limit: number,
): Promise<ArcJobRow[]> {
  // Step 1: Find all jobs that already have an arc ledger
  const { data: existingArtifacts, error: artifactsError } = await supabase
    .from('evaluation_artifacts')
    .select('job_id')
    .eq('artifact_type', 'character_arc_ledger_v1');

  if (artifactsError) {
    throw new Error(`[ArcWorker] Failed to query existing artifacts: ${artifactsError.message}`);
  }

  const doneIds = new Set<string>((existingArtifacts ?? []).map((a) => a.job_id as string));
  const excludeIds = [...doneIds];

  // Step 2: Find complete jobs with no arc ledger yet
  const { data: candidateJobs, error: jobsError } = await supabase
    .from('evaluation_jobs')
    .select(`
      id,
      manuscript_id,
      manuscripts!inner(user_id, title, word_count, work_type)
    `)
    .eq('status', 'complete')
    .not('id', 'in', `(${excludeIds.length > 0 ? excludeIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
    .order('created_at', { ascending: true })
    .limit(limit * 5);

  if (jobsError) {
    throw new Error(`[ArcWorker] Failed to query candidate jobs: ${jobsError.message}`);
  }

  if (!candidateJobs || candidateJobs.length === 0) return [];

  // Normalize join shape
  const pending = ((candidateJobs as unknown) as Array<{
    id: string;
    manuscript_id: number;
    manuscripts: Array<{ user_id: string; title: string | null; word_count: number | null; work_type: string | null }> | { user_id: string; title: string | null; word_count: number | null; work_type: string | null } | null;
  }>)
    .map((j): ArcJobRow => {
      const ms = Array.isArray(j.manuscripts) ? (j.manuscripts[0] ?? null) : j.manuscripts;
      return {
        id: j.id,
        manuscript_id: j.manuscript_id,
        manuscripts: ms,
      };
    });

  return pending.slice(0, limit);
}

// ── Load manuscript chunks ────────────────────────────────────────────────────

async function loadManuscriptChunks(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  manuscriptId: number,
): Promise<ManuscriptChunkEvidence[]> {
  const { data, error } = await supabase
    .from('manuscript_chunks')
    .select('chunk_index, content')
    .eq('manuscript_id', manuscriptId)
    .order('chunk_index', { ascending: true });

  if (error) {
    throw new Error(`[ArcWorker] Failed to load chunks for manuscript ${manuscriptId}: ${error.message}`);
  }

  return ((data ?? []) as { chunk_index: number; content: string }[])
    .filter((r) => typeof r.chunk_index === 'number' && typeof r.content === 'string' && r.content.trim().length > 0)
    .map((r) => ({ chunk_index: r.chunk_index, content: r.content }));
}

// ── Process one job ───────────────────────────────────────────────────────────

async function processArcJob(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  job: ArcJobRow,
): Promise<{ success: boolean; error?: string }> {
  const { id: jobId, manuscript_id: manuscriptId } = job;
  const ms = job.manuscripts;
  const userId = ms?.user_id ?? '';
  const title = ms?.title ?? 'Untitled';
  const wordCount = ms?.word_count ?? 0;

  // Cooperative cancellation check
  const cancellation = await checkJobCancellation(jobId);
  if (cancellation.cancelled) {
    console.log(`[ArcWorker] ${jobId}: job cancelled — skipping arc extraction`);
    return { success: false, error: `Job is cancelled: ${cancellation.reason}` };
  }

  console.log(`[ArcWorker] ${jobId}: starting arc extraction — words=${wordCount}`);

  // Load chunks
  const chunks = await loadManuscriptChunks(supabase, manuscriptId);
  if (chunks.length === 0) {
    return { success: false, error: `No chunks found for manuscript_id=${manuscriptId}` };
  }

  // Run extraction
  const result = await runCharacterArcExtraction({
    jobId,
    manuscriptId,
    title,
    wordCount,
    chunks,
  });

  if (!result.ok) {
    const failure = result as ArcExtractionFailure;
    return { success: false, error: failure.error };
  }

  const { ledger } = result;

  console.log(
    `[ArcWorker] ${jobId}: extraction complete — characters=${ledger.characters.length} gate=${ledger.gate_result}`,
  );

  // Persist artifact
  const artifactContent: CharacterArcLedgerArtifactContent = {
    schema_version: 'character_arc_ledger_v1',
    created_at: ledger.captured_at,
    job_id: jobId,
    manuscript_id: manuscriptId,
    character_arc_ledger: ledger,
  };

  const sourceHash = stableSourceHash({
    manuscriptId,
    jobId,
    userId,
    manuscriptText: `arc_extraction:chunks=${chunks.length}`,
    promptVersion: 'character_arc_extraction_v1',
    model: 'arc_worker',
  });

  await upsertEvaluationArtifact({
    supabase,
    jobId,
    manuscriptId,
    artifactType: 'character_arc_ledger_v1',
    artifactVersion: 'character_arc_extraction_v1',
    sourceHash,
    content: artifactContent,
  });

  console.log(`[ArcWorker] ${jobId}: persisted character_arc_ledger_v1 ✓ gate=${ledger.gate_result}`);

  // Gate enforcement (hard/soft fail → re-render trigger) implemented in PR-581.
  // For now: log gate result so it is observable in Vercel logs.
  if (ledger.gate_result === 'hard_fail') {
    console.warn(
      `[ArcWorker] ${jobId}: HARD FAIL — reasons=${ledger.hard_fail_reasons.join(',')} — re-render pending PR-581`,
    );
  } else if (ledger.gate_result === 'soft_fail') {
    console.warn(
      `[ArcWorker] ${jobId}: soft_fail — reasons=${ledger.soft_fail_reasons.join(',')}`,
    );
  }

  return { success: true };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const traceId = crypto.randomUUID().slice(0, 8);
  const startMs = Date.now();

  if (!isPipelineEnabled()) {
    console.warn('[ArcWorker] EVAL_PIPELINE_ENABLED=false — skipping arc extraction');
    return NextResponse.json(pipelineDisabledResponse(), { status: 200 });
  }

  const { authorized, method, secretTooLong } = checkAuthorization(req);
  if (secretTooLong) {
    return NextResponse.json({ error: 'Secret too long' }, { status: 400 });
  }
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isDryRun = req.nextUrl.searchParams.get('dry_run') === '1';

  console.log(`[ArcWorker] ${traceId}: invoked auth=${method} dry_run=${isDryRun}`);

  try {
    const supabase = createSupabaseAdmin();

    if (isDryRun) {
      const pending = await findPendingArcJobs(supabase, 50);
      return NextResponse.json({
        ok: true,
        dry_run: true,
        pending_arc_jobs: pending.length,
        trace_id: traceId,
        elapsed_ms: Date.now() - startMs,
      });
    }

    const pendingJobs = await findPendingArcJobs(supabase, ARC_BATCH_SIZE);

    if (pendingJobs.length === 0) {
      return NextResponse.json({
        ok: true,
        processed: 0,
        trace_id: traceId,
        elapsed_ms: Date.now() - startMs,
      });
    }

    const results: Array<{ jobId: string; success: boolean; error?: string }> = [];

    for (const job of pendingJobs) {
      try {
        const result = await processArcJob(supabase, job);
        results.push({ jobId: job.id, ...result });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[ArcWorker] ${traceId}: job ${job.id} threw: ${errMsg}`);
        try {
          await supabase
            .from('evaluation_jobs')
            .update({ last_error: `[ArcWorker] ${errMsg.slice(0, 500)}` })
            .eq('id', job.id);
        } catch {
          // best-effort
        }
        results.push({ jobId: job.id, success: false, error: errMsg });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const elapsed = Date.now() - startMs;

    console.log(
      `[ArcWorker] ${traceId}: done — processed=${results.length} success=${successCount} elapsed=${elapsed}ms`,
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
    console.error(`[ArcWorker] ${traceId}: fatal: ${errMsg}`);
    return NextResponse.json(
      { ok: false, error: errMsg, trace_id: traceId, elapsed_ms: Date.now() - startMs },
      { status: 500 },
    );
  }
}

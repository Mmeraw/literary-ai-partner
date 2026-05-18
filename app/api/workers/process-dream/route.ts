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
import { checkJobCancellation } from '@/lib/jobs/cancellationCheck';
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
 * Find complete long-form jobs that need Narrative Synthesis.
 *
 * Self-healing: any job whose existing longform_document_v1 artifact is a _skipped stub
 * (content._skipped===true, written by operator tooling) has its stub deleted and pathway
 * cleared so it re-enters the synthesis queue. The worker only created real artifacts —
 * stubs are foreign input and must be evicted before synthesis can proceed.
 *
 * Jobs with real artifacts (content.longform_document present) are permanently skipped.
 */
/**
 * Self-heal: delete a _skipped stub artifact so the job re-enters the synthesis queue.
 * Called when the worker encounters a longform_document_v1 row it did not create
 * (identified by the presence of `content._skipped === true`).
 *
 * Steps:
 *   1. Delete the stub artifact row
 *   2. Clear last_error on the job so the failure pathway is clean
 *   3. Return — the job now has no longform artifact and will be picked up
 *      by findPendingDreamJobs on the next cron tick (or this tick if capacity allows)
 */
async function clearSkippedStubAndRequeue(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  jobId: string,
): Promise<void> {
  console.log(`[DreamWorker] ${jobId}: _skipped stub detected — clearing pathway and re-queuing`);

  // Delete the stub artifact — after this the job has no longform_document_v1 row
  // and will be treated as pending by findPendingDreamJobs.
  const { error: deleteErr } = await supabase
    .from('evaluation_artifacts')
    .delete()
    .eq('job_id', jobId)
    .eq('artifact_type', 'longform_document_v1');

  if (deleteErr) {
    // Non-fatal: log and continue. The stub remains but the job is not synthesised
    // this tick. Next tick will retry the stub check.
    console.error(`[DreamWorker] ${jobId}: failed to delete stub artifact: ${deleteErr.message}`);
    return;
  }

  // Clear last_error so the clean pathway is visible in the DB.
  await supabase
    .from('evaluation_jobs')
    .update({ last_error: null })
    .eq('id', jobId);

  console.log(`[DreamWorker] ${jobId}: stub cleared — job will be synthesised on next available tick`);
}

async function findPendingDreamJobs(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  limit: number,
): Promise<DreamJobRow[]> {
  // Step 1: All existing longform_document_v1 artifact rows — fetch content to detect stubs.
  // A real artifact has content.longform_document; a _skipped stub has content._skipped===true.
  // Stubs are self-healed: we delete them and re-queue the job so it gets synthesised
  // by the current pipeline version. Real artifacts mean the job is done — skip it.
  const { data: existingArtifacts, error: artifactsError } = await supabase
    .from('evaluation_artifacts')
    .select('job_id, content')
    .eq('artifact_type', 'longform_document_v1');

  if (artifactsError) {
    throw new Error(
      `[DreamWorker] Failed to query existing artifacts: ${artifactsError.message}`,
    );
  }

  // Partition into real artifacts (skip) vs stubs (self-heal).
  const realDoneIds = new Set<string>();
  const stubIds: string[] = [];

  for (const row of existingArtifacts ?? []) {
    const content = row.content as Record<string, unknown> | null;
    if (content?._skipped === true) {
      stubIds.push(row.job_id as string);
    } else {
      realDoneIds.add(row.job_id as string);
    }
  }

  // Self-heal stubs in parallel (best-effort — failures are logged, not thrown).
  if (stubIds.length > 0) {
    console.log(`[DreamWorker] found ${stubIds.length} _skipped stub(s) — self-healing: ${stubIds.join(', ')}`);
    await Promise.all(stubIds.map((id) => clearSkippedStubAndRequeue(supabase, id)));
  }

  // Exclude only jobs with REAL artifacts (stubs just got cleared above).
  const excludeIds = [...realDoneIds];

  // Step 2: candidate complete long-form jobs with no real artifact.
  // After stub clearance above, formerly-stubbed jobs are now eligible candidates.
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
    .not('id', 'in', `(${excludeIds.length > 0 ? excludeIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
    .order('created_at', { ascending: true }) // oldest pending first
    .limit(limit * 10);

  if (jobsError) {
    throw new Error(`[DreamWorker] Failed to query candidate jobs: ${jobsError.message}`);
  }

  if (!candidateJobs || candidateJobs.length === 0) {
    return [];
  }

  // Step 3: normalise Supabase !inner join shape → DreamJobRow.
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
        word_count: ms?.word_count ?? null,
        manuscripts: ms,
      };
    })
    .filter((j) => (j.word_count ?? 0) >= DREAM_WORD_COUNT_THRESHOLD);
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

// ── Pre-flight: validate all dependencies before committing to synthesis ─────

type PreflightOk = { ok: true };
type PreflightFail = { ok: false; reason: string; retryable: boolean };
type PreflightResult = PreflightOk | PreflightFail;

/**
 * Pre-flight check for a single DREAM job.
 *
 * Validates every dependency before any OpenAI call is made:
 *   1. No orphan longform_document_v1 artifact exists (double-stub guard)
 *   2. evaluation_result_v2 (or v1) artifact is present and has criteria
 *   3. Manuscript chunks exist and are non-empty
 *   4. OPENAI_API_KEY is configured
 *   5. OpenAI ping — fire a minimal /models list call to confirm the API is reachable
 *      and the key is valid before spending Vercel budget on the full synthesis
 *
 * On any failure: writes a structured error to evaluation_jobs.last_error so the
 * failure is visible in the DB (not silent). Returns { ok: false } so processDreamJob
 * is never called for a job that would fail immediately.
 */
async function preflightDreamJob(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  job: DreamJobRow,
  openaiApiKey: string,
): Promise<PreflightResult> {
  const jobId = job.id;
  const manuscriptId = job.manuscript_id;

  const fail = async (reason: string, retryable: boolean): Promise<PreflightResult> => {
    console.error(`[DreamWorker] ${jobId}: preflight FAILED — ${reason}`);
    // Write back to DB so the failure is visible, not silent.
    await supabase
      .from('evaluation_jobs')
      .update({ last_error: `[DreamWorker:preflight] ${reason.slice(0, 500)}` })
      .eq('id', jobId);
    return { ok: false, reason, retryable };
  };

  // ── Check 1: no orphan artifact (double-stub guard) ───────────────────────
  // The stub-clearance in findPendingDreamJobs should have deleted any stubs before
  // we reach here, but a race (two cron ticks overlapping) could re-introduce one.
  const { data: orphanArtifact } = await supabase
    .from('evaluation_artifacts')
    .select('content')
    .eq('job_id', jobId)
    .eq('artifact_type', 'longform_document_v1')
    .maybeSingle();

  if (orphanArtifact) {
    const content = orphanArtifact.content as Record<string, unknown> | null;
    if (content?._skipped === true) {
      // Stale stub survived — clear it now and abort this tick (next tick will synthesise).
      console.warn(`[DreamWorker] ${jobId}: stale _skipped stub found at preflight — clearing and skipping this tick`);
      await supabase
        .from('evaluation_artifacts')
        .delete()
        .eq('job_id', jobId)
        .eq('artifact_type', 'longform_document_v1');
      return { ok: false, reason: 'stale _skipped stub cleared at preflight — will synthesise next tick', retryable: true };
    }
    // Real artifact already exists — job is already done.
    return { ok: false, reason: 'real longform_document_v1 artifact already exists — job already synthesised', retryable: false };
  }

  // ── Check 2: evaluation_result artifact present with criteria ─────────────
  const artifactContent = await loadEvaluationArtifact(supabase, jobId);
  if (!artifactContent) {
    return fail('No evaluation_result_v2/v1 artifact found — upstream evaluation may not have persisted correctly', true);
  }
  const extracted = extractFromArtifact(artifactContent);
  if (!extracted || extracted.criteria.length < 13) {
    return fail(
      `criteria missing or incomplete in artifact (found ${extracted?.criteria?.length ?? 0}/13 required)`,
      true,
    );
  }

  // ── Check 3: manuscript chunks exist ──────────────────────────────────────
  const { data: chunkCheck, error: chunkErr } = await supabase
    .from('manuscript_chunks')
    .select('chunk_index')
    .eq('manuscript_id', manuscriptId)
    .limit(1);

  if (chunkErr) {
    return fail(`manuscript_chunks query failed: ${chunkErr.message}`, true);
  }
  if (!chunkCheck || chunkCheck.length === 0) {
    return fail(`No manuscript chunks found for manuscript_id=${manuscriptId}`, false);
  }

  // ── Check 4: OPENAI_API_KEY present ───────────────────────────────────────
  if (!openaiApiKey) {
    return fail('OPENAI_API_KEY is not configured', false);
  }

  // ── Check 5: OpenAI ping ───────────────────────────────────────────────────
  // Fire a lightweight /models request to confirm the API key is valid and the
  // OpenAI API is reachable before spending the Vercel 800s budget on synthesis.
  try {
    const pingRes = await fetch('https://api.openai.com/v1/models?limit=1', {
      method: 'GET',
      headers: { Authorization: `Bearer ${openaiApiKey}` },
      signal: AbortSignal.timeout(10_000), // 10s ping timeout
    });
    if (!pingRes.ok) {
      const body = await pingRes.text().catch(() => '');
      return fail(
        `OpenAI API ping failed: HTTP ${pingRes.status} — ${body.slice(0, 200)}`,
        pingRes.status >= 500 || pingRes.status === 429, // 5xx / rate-limit are retryable
      );
    }
    console.log(`[DreamWorker] ${jobId}: preflight OK — OpenAI reachable (HTTP ${pingRes.status})`);
  } catch (pingErr) {
    const msg = pingErr instanceof Error ? pingErr.message : String(pingErr);
    return fail(`OpenAI API ping threw: ${msg}`, true);
  }

  return { ok: true };
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

  // GOVERNANCE: Check if job is cancelled before starting DREAM synthesis
  const cancellation = await checkJobCancellation(jobId);
  if (cancellation.cancelled) {
    console.log(`[DreamWorker] ${jobId}: job is cancelled, skipping DREAM synthesis`, {
      cancelled_at: cancellation.cancelled_at,
      reason: cancellation.reason,
    });
    return { success: false, error: `Job is cancelled: ${cancellation.reason}` };
  }

  console.log(`[DreamWorker] ${jobId}: starting DREAM synthesis — words=${wordCount}`);

  // 0. Pre-flight — validate all dependencies and ping OpenAI before doing any work.
  const openaiApiKey = process.env.OPENAI_API_KEY ?? '';
  const preflight = await preflightDreamJob(supabase, job, openaiApiKey);
  if (preflight.ok === false) {
    return {
      success: false,
      error: `preflight: ${preflight.reason}`,
      ...(preflight.retryable ? { retryable: true } : {}),
    };
  }

  // 1. Load evaluation artifact (need criteria array)
  // Safe to call again — preflight already verified these exist; these are the full payloads.
  const artifactContent = await loadEvaluationArtifact(supabase, jobId);
  if (!artifactContent) {
    return { success: false, error: 'No evaluation artifact found — disappeared between preflight and load (race)' };
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
  // openaiApiKey already resolved and validated by preflight (Check 4 + Check 5 ping).
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

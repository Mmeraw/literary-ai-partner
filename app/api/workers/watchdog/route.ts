/**
 * Frozen-Job Watchdog — /api/workers/watchdog
 *
 * Runs every 60 seconds via Vercel Cron. Detects jobs whose heartbeat
 * has gone silent (worker frozen mid-LLM-call) and rescues or fails them
 * before the user sees a permanently stuck progress bar.
 *
 * This is DISTINCT from /api/workers/process-evaluations which claims and
 * runs new jobs. This endpoint only runs the stale/frozen sweep — it is
 * cheap, fast, and safe to run frequently.
 *
 * After rescue the re-queued job will be picked up by the next
 * process-evaluations run (every 5 min) OR immediately by a direct
 * trigger call. The watchdog also fires a direct trigger to
 * process-evaluations so rescued jobs are not left waiting 5 minutes.
 *
 * Auth: Vercel Cron header OR Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { failStaleRunningJobs } from '@/lib/evaluation/processor';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Watchdog only does DB queries — 30s is more than enough.
export const maxDuration = 30;

const MAX_SECRET_LENGTH = 512;

// ─── Auth ────────────────────────────────────────────────────────────────────

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length > MAX_SECRET_LENGTH || b.length > MAX_SECRET_LENGTH) return false;
  const aHash = crypto.createHash('sha256').update(a, 'utf8').digest();
  const bHash = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? '';

  // Vercel platform cron invocation
  if (req.headers.get('x-vercel-cron') === '1' && req.headers.get('x-vercel-id')) {
    return true;
  }

  // Bearer token (manual trigger)
  const auth = req.headers.get('authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (match?.[1] && secret) {
    return timingSafeCompare(match[1].trim(), secret);
  }

  return false;
}

// ─── Kick process-evaluations after a rescue so the re-queued job doesn't
//     wait up to 5 minutes for the next scheduled cron run. ─────────────────

async function kickWorker(): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;

  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_URL ??
    'https://www.revisiongrade.com';

  const url = `${base.startsWith('http') ? base : `https://${base}`}/api/workers/process-evaluations`;

  try {
    // Fire-and-forget — don't await the full 800s processing window.
    void fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
      // Short signal so the watchdog response is not held open.
      signal: AbortSignal.timeout(5_000),
    }).catch(() => {
      // Intentionally swallowed — kick is best-effort.
    });
  } catch {
    // AbortError or network failure — not fatal for the watchdog.
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

// ─── Idle-pulse check: find running jobs whose worker_pulse_at is stale ────
// worker_pulse_at is written at every real chunk completion. If it hasn't
// moved in IDLE_PULSE_THRESHOLD_SECS but the lease heartbeat is still
// alive, the worker is frozen mid-LLM-call and must be rescued immediately.
const IDLE_PULSE_THRESHOLD_SECS = 20;

async function rescueIdleJobs(): Promise<{ idleFound: number; idleRescued: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!supabaseUrl || !supabaseKey) return { idleFound: 0, idleRescued: 0 };

  const supabase = createClient(supabaseUrl, supabaseKey);
  const pulseCutoff = new Date(Date.now() - IDLE_PULSE_THRESHOLD_SECS * 1_000).toISOString();
  const now = new Date().toISOString();

  // Jobs that are running AND have a stale worker_pulse_at (real work has stopped)
  // but whose last_heartbeat_at is still fresh (lease is held — not already dead).
  // NULL worker_pulse_at means the column was never written (pre-migration job) — skip those.
  // CRITICAL: never rescue awaiting_approval — that is the Review Gate hard stop,
  // not a frozen worker. The gate is waiting for author input, not a pulse.
  const { data: idleCandidates, error } = await supabase
    .from('evaluation_jobs')
    .select('id, phase, phase_status, attempt_count, max_attempts')
    .eq('status', 'running')
    .neq('phase_status', 'awaiting_approval')
    .not('worker_pulse_at', 'is', null)
    .lt('worker_pulse_at', pulseCutoff)
    .limit(10);

  if (error || !idleCandidates?.length) return { idleFound: 0, idleRescued: 0 };

  let idleRescued = 0;
  for (const job of idleCandidates) {
    // Skip terminal-attempt jobs — let failStaleRunningJobs handle those.
    if (typeof job.attempt_count === 'number' && typeof job.max_attempts === 'number'
        && job.attempt_count >= job.max_attempts) continue;

    // Re-queue: release lease so next process-evaluations pick-up resumes.
    const { error: rescueErr } = await supabase
      .from('evaluation_jobs')
      .update({
        status: 'queued',
        phase_status: 'queued',
        claimed_by: null,
        last_heartbeat_at: null,
        last_heartbeat: null,
        worker_pulse_at: null,
        updated_at: now,
      })
      .eq('id', job.id)
      .eq('status', 'running');

    if (!rescueErr) {
      idleRescued++;
      console.log(`[Watchdog/idle] Rescued idle job ${job.id} (pulse stale >${IDLE_PULSE_THRESHOLD_SECS}s)`);
    } else {
      console.warn(`[Watchdog/idle] Failed to rescue ${job.id}:`, rescueErr.message);
    }
  }

  return { idleFound: idleCandidates.length, idleRescued };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const traceId = crypto.randomUUID();
  const startMs = Date.now();

  try {
    // Run both sweeps in parallel: frozen-heartbeat (60s) + idle-pulse (30s)
    const [result, idleResult] = await Promise.all([
      failStaleRunningJobs(),
      rescueIdleJobs(),
    ]);

    const rescued = (result.rescued ?? 0) + idleResult.idleRescued;
    const failed  = result.failed  ?? 0;
    const found   = result.staleFound ?? 0;

    // Kick the worker if anything was rescued so re-queued jobs don't wait 5 min.
    if (rescued > 0) {
      await kickWorker();
    }

    const durationMs = Date.now() - startMs;

    console.log(
      `[Watchdog] traceId=${traceId} staleFound=${found} rescued=${rescued} failed=${failed} idleFound=${idleResult.idleFound} idleRescued=${idleResult.idleRescued} durationMs=${durationMs}`,
    );

    return NextResponse.json({
      ok: true,
      traceId,
      durationMs,
      staleFound: found,
      rescued,
      failed,
      idleFound: idleResult.idleFound,
      idleRescued: idleResult.idleRescued,
      ids: result.ids ?? [],
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Watchdog] traceId=${traceId} error: ${message}`);

    return NextResponse.json(
      { ok: false, traceId, error: message, durationMs, timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}

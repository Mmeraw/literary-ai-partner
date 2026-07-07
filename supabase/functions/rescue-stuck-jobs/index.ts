/**
 * Supabase Edge Function: rescue-stuck-jobs
 *
 * Independent out-of-band rescue for stuck evaluation jobs.
 * Runs entirely on Supabase infrastructure — not tied to the Vercel
 * deployment, so it can rescue jobs even during a full app outage.
 *
 * Auth: Bearer token matching RESCUE_SECRET env var.
 * Trigger: Supabase cron schedule, external uptime monitor, or manual curl.
 *
 * Calls the rescue_stuck_evaluation_jobs() Postgres RPC which:
 *   1. Finds running jobs with expired leases + stale/null worker pulses
 *   2. Delegates each to admin_rescue_orphaned_evaluation_job() (canonical rescue)
 *   3. Returns rescued job IDs
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  // ── Auth: Bearer token must match RESCUE_SECRET ──────────────────────
  const rescueSecret = Deno.env.get('RESCUE_SECRET');
  if (!rescueSecret) {
    return jsonResponse({ ok: false, error: 'RESCUE_SECRET not configured' }, 500);
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!bearer || bearer !== rescueSecret) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  }

  // ── Parse optional body ──────────────────────────────────────────────
  let maxJobs = 20;
  let reason = 'independent_rescue:edge_function';
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body === 'object' && body !== null) {
      if (typeof (body as Record<string, unknown>).max_jobs === 'number') {
        maxJobs = (body as Record<string, unknown>).max_jobs as number;
      }
      if (typeof (body as Record<string, unknown>).reason === 'string') {
        reason = (body as Record<string, unknown>).reason as string;
      }
    }
  } catch {
    // Ignore parse errors — use defaults
  }

  // ── Call the batch rescue RPC ────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Missing Supabase credentials' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc('rescue_stuck_evaluation_jobs', {
    p_max_jobs: maxJobs,
    p_reason: reason,
  });

  if (error) {
    console.error('[rescue-stuck-jobs] RPC error:', error.message);
    return jsonResponse(
      { ok: false, error: 'RPC failed', detail: error.message },
      500,
    );
  }

  const rescued = Array.isArray(data) ? data : [];

  console.log(`[rescue-stuck-jobs] Rescued ${rescued.length} job(s)`, {
    rescued_ids: rescued.map((r: { rescued_id: string }) => r.rescued_id),
    reason,
    max_jobs: maxJobs,
  });

  return jsonResponse({
    ok: true,
    rescued_count: rescued.length,
    rescued: rescued.map((r: { rescued_id: string; phase: string; phase_status: string; rescued_at: string }) => ({
      job_id: r.rescued_id,
      phase: r.phase,
      phase_status: r.phase_status,
      rescued_at: r.rescued_at,
    })),
    invoked_at: new Date().toISOString(),
  });
});

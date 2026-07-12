/**
 * C2 Dry-Run Readiness Probes — VERIFIER-ONLY, READ-ONLY
 * ========================================================================
 * Truthful readiness validation for the C2 live-proof harness dry-run.
 *
 * These probes make a green dry-run MEAN something: instead of only checking
 * that env vars are present, they actually resolve the base URL, perform a
 * BOUNDED health check against the target environment, confirm the target
 * manuscript can be READ (without creating a job), and confirm the TypeScript
 * server authority (getWorkbenchQueue) resolves under the runtime.
 *
 * HARD SAFETY CONTRACT — every probe here is strictly READ-ONLY:
 *   - NO OpenAI / model call.
 *   - NO job creation (never POST /api/jobs).
 *   - NO queue mutation.
 *   - NO Supabase write (SELECT-only existence read, bounded).
 * A readiness probe that cannot honor read-only safety returns FAIL, never a
 * side-effecting fallback.
 *
 * Each probe returns { status, detail, data } where status is one of
 * PASS | FAIL | NOT_EXECUTED (imported from the contract). A probe is
 * NOT_EXECUTED only when a genuine precondition is absent (e.g. no secrets to
 * even attempt a Supabase read) — never as a disguise for failure.
 *
 * RUNTIME NOTE: The manuscript-read and authority-import probes touch
 * TypeScript modules (lib/supabase/admin.ts, lib/revision/workbenchQueue.ts),
 * so the harness must run under a TS-capable runtime (e.g. `npx tsx`) for these
 * probes to resolve. Under plain `node` they will honestly report FAIL with the
 * exact resolution error rather than a false PASS.
 */

import { STATUS } from './c2LiveProofContract.mjs';

/** Ordered readiness probe keys (for stable artifact + summary rendering). */
export const READINESS_PROBES = Object.freeze([
  { key: 'secrets_present', description: 'Required live secrets present and USE_SUPABASE_JOBS=true.' },
  { key: 'base_url_health', description: 'Base URL resolves and /api/health returns ok within a bounded timeout.' },
  { key: 'manuscript_readable', description: 'Target manuscript exists and is readable (SELECT-only, no job created).' },
  { key: 'authority_resolves', description: 'Server authority getWorkbenchQueue imports/resolves under the runtime.' },
]);

export const REQUIRED_LIVE_SECRETS = Object.freeze([
  'CRON_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
]);

/** Bounded fetch: aborts after `timeoutMs` so an unreachable env can't hang. */
async function boundedFetch(url, { timeoutMs = 8000, fetchImpl = fetch, headers } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal, headers });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** Probe 1: secrets + USE_SUPABASE_JOBS. Pure env inspection, no I/O. */
export function probeSecrets(env = process.env) {
  const missing = REQUIRED_LIVE_SECRETS.filter((k) => !env[k] || String(env[k]).trim() === '');
  const hasSupabaseUrl = Boolean(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL);
  if (!hasSupabaseUrl) missing.push('SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL');
  const useSupabaseJobs = env.USE_SUPABASE_JOBS === 'true';
  const ok = missing.length === 0 && useSupabaseJobs;
  return {
    status: ok ? STATUS.PASS : STATUS.FAIL,
    detail: ok
      ? 'all required secrets present; USE_SUPABASE_JOBS=true'
      : `missing: ${missing.join(', ') || 'none'}; USE_SUPABASE_JOBS=${useSupabaseJobs}`,
    data: { missing, useSupabaseJobs },
  };
}

/**
 * Probe 2: base URL health. Resolves getBaseUrl() then does ONE bounded GET
 * against the public /api/health tier (no auth, no state leak). Network failure
 * or non-ok status -> FAIL (not fabricated).
 */
export async function probeBaseUrlHealth({ getBaseUrl, env = process.env, envName = null, fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  // Mistake-proofing: for a live/remote proof (env=codespace or any non-local
  // envName) we MUST target an explicit deployed BASE_URL. We refuse to fall
  // back to getBaseUrl()'s local port scan (3002/3001/3000), because a local
  // dev server here points at PRODUCTION Supabase and its dev->prod guard will
  // (correctly) refuse to boot. Probing localhost would either fail confusingly
  // or, worse, tempt an unsafe ALLOW_DEV_PROD bypass. Fail closed instead.
  const isRemoteEnv = envName != null && envName !== 'local' && envName !== 'localhost';
  const explicitBase = env.BASE_URL && String(env.BASE_URL).trim() !== '' ? String(env.BASE_URL).trim() : null;
  if (isRemoteEnv && !explicitBase) {
    return {
      status: STATUS.FAIL,
      detail:
        `env=${envName} requires an explicit deployed BASE_URL (e.g. your Vercel prod/preview URL). ` +
        'Refusing to health-check a local dev server, which would run against PRODUCTION Supabase. ' +
        'Set BASE_URL=https://<deployed-url> and re-run.',
      data: { envName, explicit_base_url: false },
    };
  }
  let base;
  try {
    base = isRemoteEnv ? explicitBase : await getBaseUrl();
  } catch (err) {
    return { status: STATUS.FAIL, detail: `getBaseUrl() threw: ${err?.message ?? err}`, data: {} };
  }
  if (!base) return { status: STATUS.FAIL, detail: 'getBaseUrl() returned empty', data: {} };
  try {
    const res = await boundedFetch(`${base}/api/health`, { timeoutMs, fetchImpl });
    let body = null;
    try { body = await res.json(); } catch { /* health may be text; ignore */ }
    const ok = res.ok && (body == null || body.ok !== false);
    return {
      status: ok ? STATUS.PASS : STATUS.FAIL,
      detail: `${base}/api/health -> HTTP ${res.status}${body?.env ? ` env=${body.env}` : ''}`,
      data: { base, http_status: res.status, env: body?.env ?? null, git_sha: body?.git_sha ?? null },
    };
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    return {
      status: STATUS.FAIL,
      detail: aborted
        ? `health check timed out after ${timeoutMs}ms against ${base} (env unreachable)`
        : `health check failed against ${base}: ${err?.message ?? err}`,
      data: { base, aborted },
    };
  }
}

/**
 * Probe 3: manuscript readable. READ-ONLY existence check via a bounded
 * SELECT on the manuscripts table using the admin client. Creates NO job and
 * writes nothing. If secrets are absent the admin client is null -> the probe
 * is NOT_EXECUTED (precondition genuinely missing), never a false PASS.
 *
 * `importAdmin` is injected for testability; defaults to the real TS module.
 */
export async function probeManuscriptReadable({
  manuscriptId,
  importAdmin = () => import('../../lib/supabase/admin.ts'),
  timeoutMs = 8000,
} = {}) {
  if (!manuscriptId || !/^\d+$/.test(String(manuscriptId))) {
    return { status: STATUS.FAIL, detail: `invalid manuscript id: ${manuscriptId}`, data: {} };
  }
  let createAdminClient;
  try {
    ({ createAdminClient } = await importAdmin());
  } catch (err) {
    return {
      status: STATUS.FAIL,
      detail:
        `could not import admin client (${err?.message ?? err}). ` +
        'Run under a TS runtime (npx tsx) so lib/supabase/admin.ts resolves.',
      data: {},
    };
  }
  let admin;
  try {
    admin = createAdminClient({ nullable: true });
  } catch (err) {
    return { status: STATUS.FAIL, detail: `createAdminClient threw: ${err?.message ?? err}`, data: {} };
  }
  if (!admin) {
    return {
      status: STATUS.NOT_EXECUTED,
      detail: 'admin client unavailable (Supabase secrets absent); cannot attempt read without credentials',
      data: {},
    };
  }
  try {
    // SELECT-only, single-row, bounded. No write, no job, no mutation.
    const query = admin.from('manuscripts').select('id').eq('id', Number(manuscriptId)).maybeSingle();
    const withTimeout = Promise.race([
      query,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`manuscript read timed out after ${timeoutMs}ms`)), timeoutMs)),
    ]);
    const { data, error } = await withTimeout;
    if (error) {
      return { status: STATUS.FAIL, detail: `manuscript read error: ${error.message ?? error}`, data: {} };
    }
    if (!data) {
      return { status: STATUS.FAIL, detail: `manuscript ${manuscriptId} not found (SELECT returned no row)`, data: { found: false } };
    }
    return {
      status: STATUS.PASS,
      detail: `manuscript ${manuscriptId} exists and is readable (read-only, no job created)`,
      data: { found: true, id: data.id },
    };
  } catch (err) {
    return { status: STATUS.FAIL, detail: `manuscript read failed: ${err?.message ?? err}`, data: {} };
  }
}

/**
 * Probe 4: authority resolves. Attempts to import the TypeScript server
 * authority getWorkbenchQueue. This is a RESOLUTION check only — it confirms the
 * runtime can load the authority the live run will invoke. It does NOT call the
 * authority (which would require a real evaluation job). Import failure -> FAIL
 * with the exact error, never fabricated.
 *
 * `importAuthority` is injected for testability.
 */
export async function probeAuthorityResolves({
  importAuthority = () => import('../../lib/revision/workbenchQueue.ts'),
} = {}) {
  try {
    const mod = await importAuthority();
    if (typeof mod.getWorkbenchQueue !== 'function') {
      return {
        status: STATUS.FAIL,
        detail: 'module imported but getWorkbenchQueue export is missing or not a function',
        data: { exports: Object.keys(mod ?? {}) },
      };
    }
    return {
      status: STATUS.PASS,
      detail: 'getWorkbenchQueue authority imports and resolves under the runtime',
      data: {},
    };
  } catch (err) {
    return {
      status: STATUS.FAIL,
      detail:
        `could not import getWorkbenchQueue authority (${err?.message ?? err}). ` +
        'Run under a TS runtime (npx tsx) so lib/revision/workbenchQueue.ts resolves.',
      data: {},
    };
  }
}

/**
 * Run all readiness probes and fold into a readiness section.
 * `ready` (overall) is true ONLY when every probe is PASS. A single FAIL or
 * NOT_EXECUTED makes readiness not-ready — fail-closed.
 */
export async function runReadiness({ manuscriptId, envName = null, getBaseUrl, env = process.env, deps = {} } = {}) {
  const results = {};
  results.secrets_present = probeSecrets(env);
  results.base_url_health = await probeBaseUrlHealth({ getBaseUrl, env, envName, fetchImpl: deps.fetchImpl });
  results.manuscript_readable = await probeManuscriptReadable({
    manuscriptId,
    importAdmin: deps.importAdmin,
  });
  results.authority_resolves = await probeAuthorityResolves({ importAuthority: deps.importAuthority });

  const allPass = READINESS_PROBES.every((p) => results[p.key]?.status === STATUS.PASS);
  const anyFail = READINESS_PROBES.some((p) => results[p.key]?.status === STATUS.FAIL);
  const status = allPass ? STATUS.PASS : anyFail ? STATUS.FAIL : STATUS.NOT_EXECUTED;
  const notReady = READINESS_PROBES.filter((p) => results[p.key]?.status !== STATUS.PASS).map((p) => p.key);

  return {
    status,
    ready: allPass,
    not_ready: notReady,
    probes: results,
  };
}

/** Human-readable readiness summary. */
export function renderReadiness(readiness) {
  const lines = ['C2 Dry-Run Readiness Probes'];
  for (const p of READINESS_PROBES) {
    const r = readiness.probes[p.key] ?? { status: STATUS.NOT_EXECUTED, detail: 'not run' };
    lines.push(`  [${String(r.status).padEnd(12)}] ${p.key}${r.detail ? ' — ' + r.detail : ''}`);
  }
  lines.push(`READINESS: ${readiness.status}${readiness.ready ? ' (ready)' : ` (not ready: ${readiness.not_ready.join(', ') || 'n/a'})`}`);
  return lines.join('\n');
}

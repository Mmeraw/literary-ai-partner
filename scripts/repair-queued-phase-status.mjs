/**
 * One-shot repair script: find all evaluation_jobs where status='queued' but
 * phase_status!='queued' and patch them to phase_status='queued'.
 *
 * These rows were created by admin_retry_job which sets status='queued' but
 * omits phase_status='queued', making them invisible to the claim predicate.
 *
 * Safe to run multiple times (idempotent).
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from .env.local
function loadEnv(filePath) {
  const env = {};
  try {
    const lines = readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  } catch {}
  return env;
}

const envLocal = loadEnv(resolve(__dirname, '../.env.local'));
const envBase = loadEnv(resolve(__dirname, '../.env'));

const SUPABASE_URL = envLocal.SUPABASE_URL || envBase.SUPABASE_URL || envLocal.NEXT_PUBLIC_SUPABASE_URL || envBase.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = envLocal.SUPABASE_SERVICE_ROLE_KEY || envBase.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...HEADERS, ...(opts.headers || {}) } });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body}`);
  return body ? JSON.parse(body) : null;
}

async function main() {
  console.log('=== Repair: evaluation_jobs phase_status drift ===');
  console.log(`Target: ${SUPABASE_URL}`);

  // 1. Find affected rows
  const affected = await fetchJson(
    `${SUPABASE_URL}/rest/v1/evaluation_jobs?status=eq.queued&phase_status=neq.queued&select=id,status,phase,phase_status,failed_at,last_error`
  );

  console.log(`\nRows with status='queued' AND phase_status!='queued': ${affected.length}`);

  if (affected.length === 0) {
    console.log('Nothing to repair. All queued jobs already have phase_status=\'queued\'.');
    return;
  }

  for (const row of affected) {
    console.log(`  id=${row.id}  phase=${row.phase}  phase_status=${row.phase_status}  failed_at=${row.failed_at}`);
  }

  const ids = affected.map(r => r.id);

  // 2. Batch patch: set phase_status='queued', clear stale failure fields
  // PostgREST supports IN via `id=in.(uuid1,uuid2,...)`
  const idList = ids.map(id => `"${id}"`).join(',');
  const patchUrl = `${SUPABASE_URL}/rest/v1/evaluation_jobs?id=in.(${idList})`;

  const patched = await fetchJson(patchUrl, {
    method: 'PATCH',
    body: JSON.stringify({
      phase_status: 'queued',
      claimed_by: null,
      lease_token: null,
      last_error: null,
      failed_at: null,
      updated_at: new Date().toISOString(),
    }),
    headers: { 'Prefer': 'return=representation' },
  });

  console.log(`\nPatched ${patched?.length ?? 0} row(s) to phase_status='queued'.`);

  // 3. Verify — re-read those rows
  const verified = await fetchJson(
    `${SUPABASE_URL}/rest/v1/evaluation_jobs?id=in.(${idList})&select=id,status,phase_status,claimed_by,lease_token,failed_at`
  );

  console.log('\nVerification read-back:');
  let allGood = true;
  for (const row of verified) {
    const ok = row.status === 'queued' && row.phase_status === 'queued';
    if (!ok) allGood = false;
    console.log(`  id=${row.id}  status=${row.status}  phase_status=${row.phase_status}  ${ok ? '✓' : '✗ MISMATCH'}`);
  }

  if (allGood) {
    console.log('\nAll rows verified. These jobs are now claimable by the worker.');
  } else {
    console.error('\nSome rows did not update correctly — check for RLS or constraints.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

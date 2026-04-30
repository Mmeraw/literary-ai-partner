#!/usr/bin/env node
/**
 * scripts/monitor-job.mjs
 * Usage: node scripts/monitor-job.mjs <jobId> [intervalSeconds]
 * Polls a single evaluation_jobs row and prints a clean status snapshot.
 * Exits automatically when status reaches 'complete' or 'failed'.
 */
import { createClient } from '@supabase/supabase-js';

const jobId = process.argv[2];
const intervalSec = parseInt(process.argv[3] ?? '10', 10);

if (!jobId) {
  console.error('Usage: node scripts/monitor-job.mjs <jobId> [intervalSeconds]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

function minsAgo(ts) {
  if (!ts) return 'N/A';
  const d = new Date(ts).getTime();
  if (isNaN(d)) return 'N/A';
  return ((Date.now() - d) / 60000).toFixed(2) + 'm ago';
}

function classify(row) {
  if (!row) return 'NOT_FOUND';
  if (row.status === 'complete') return '✅ COMPLETE';
  if (row.status === 'failed') {
    const e = row.last_error ?? '';
    if (e.includes('stale running') || e.includes('timed out or crashed')) return '❌ STALE_WORKER_KILL';
    if (e.includes('LLR_PRE_ARTIFACT')) return '⚠️  LLR_GOVERNANCE_BLOCK';
    if (e.includes('PIPELINE_SLA_EXCEEDED')) return '⚠️  SLA_EXCEEDED';
    if (e.includes('QG_')) return '⚠️  QUALITY_GATE_FAIL';
    return '❌ FAILED_OTHER';
  }
  if (row.status === 'running') {
    if (!row.worker_id && !row.heartbeat_at) return '⚠️  RUNNING_NO_WORKER';
    const leaseExpired = row.lease_until && new Date(row.lease_until) < new Date();
    if (leaseExpired) return '🔴 LEASE_EXPIRED_RUNNING';
    return '🔄 RUNNING_OK';
  }
  return '⏳ ' + row.status.toUpperCase();
}

async function poll() {
  const { data, error } = await supabase
    .from('evaluation_jobs')
    .select('id,status,phase,phase_status,progress,worker_id,heartbeat_at,lease_until,started_at,updated_at,failed_at,completed_at,last_error')
    .eq('id', jobId)
    .maybeSingle();

  if (error) { console.error('[monitor] query error:', error.message); return false; }
  if (!data) { console.log('[monitor] NOT_FOUND:', jobId); return true; }

  const cls = classify(data);
  const leaseExpired = data.lease_until ? new Date(data.lease_until) < new Date() : null;
  const progress = data.progress?.completed_units != null
    ? `${data.progress.completed_units}/${data.progress.total_units}`
    : 'N/A';

  console.log('─'.repeat(60));
  console.log(`[${new Date().toISOString()}] ${cls}`);
  console.log(`  job_id      : ${data.id}`);
  console.log(`  status      : ${data.status}`);
  console.log(`  phase       : ${data.phase ?? 'N/A'} / ${data.phase_status ?? 'N/A'}`);
  console.log(`  progress    : ${progress}`);
  console.log(`  worker_id   : ${data.worker_id ?? 'null'}`);
  console.log(`  heartbeat   : ${data.heartbeat_at ?? 'null'} (${minsAgo(data.heartbeat_at)})`);
  console.log(`  lease_until : ${data.lease_until ?? 'null'} | expired=${leaseExpired}`);
  console.log(`  started_at  : ${data.started_at ?? 'null'}`);
  console.log(`  updated_at  : ${data.updated_at ?? 'null'} (${minsAgo(data.updated_at)})`);
  if (data.failed_at)    console.log(`  failed_at   : ${data.failed_at}`);
  if (data.completed_at) console.log(`  completed_at: ${data.completed_at}`);
  if (data.last_error)   console.log(`  last_error  : ${data.last_error}`);

  const terminal = data.status === 'complete' || data.status === 'failed';
  if (terminal) {
    console.log('─'.repeat(60));
    console.log('[monitor] Terminal state reached. Exiting.');
  }
  return terminal;
}

console.log(`[monitor] Watching job ${jobId} every ${intervalSec}s ...`);
(async () => {
  const done = await poll();
  if (done) process.exit(0);
  const iv = setInterval(async () => {
    const done = await poll();
    if (done) { clearInterval(iv); process.exit(0); }
  }, intervalSec * 1000);
})();

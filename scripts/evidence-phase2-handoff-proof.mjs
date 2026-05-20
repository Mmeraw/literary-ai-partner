#!/usr/bin/env node
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const OWNER_ID = process.env.FLOW1_OWNER_ID || '00000000-0000-0000-0000-000000000001';
const BASE_URL = process.env.PHASE2_PROOF_BASE_URL || 'http://localhost:3002';

function readEnv(path) {
  const out = {};
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const value = line.slice(i + 1).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    out[line.slice(0, i).trim()] = value;
  }
  return out;
}

const env = {
  ...readEnv('.env'),
  ...(function () {
    try {
      return readEnv('.env.local');
    } catch {
      return {};
    }
  })(),
  ...process.env,
};
const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SRK = env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = env.CRON_SECRET || '';
const WORKER_ALLOW_SERVICE_ROLE_DEV = env.WORKER_ALLOW_SERVICE_ROLE_DEV === '1';
const PHASE1_MAX_POLLS = Number.parseInt(env.PHASE2_PROOF_PHASE1_MAX_POLLS || '60', 10);
const PHASE2_MAX_POLLS = Number.parseInt(env.PHASE2_PROOF_PHASE2_MAX_POLLS || '80', 10);
const POLL_MS = Number.parseInt(env.PHASE2_PROOF_POLL_MS || '2000', 10);

if (!SUPABASE_URL || !SRK) {
  throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

const sb = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

const proof = {
  job_id: null,
  manuscript_id: null,
  starting_state: null,
  phase1_trigger: null,
  phase1_handoff: null,
  phase2_trigger: null,
  transition_trace: [],
  artifact_rows: [],
  terminal_outcome: null,
  proven_now: null,
  blocker: null,
};

async function health() {
  const res = await fetch(`${BASE_URL}/api/health`).catch(() => null);
  const code = res?.status ?? 0;
  console.log('[health]', code);
  if (code !== 200) throw new Error(`Health failed: ${code}`);
}

async function ensureOwner() {
  const check = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${OWNER_ID}`, {
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
  });
  if (check.status === 200) return;

  const create = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: OWNER_ID, email: 'phase2-proof-owner@test.local', email_confirm: true }),
  });

  if (create.status !== 200 && create.status !== 201) {
    throw new Error(`Owner create failed: ${create.status} ${await create.text()}`);
  }
}

async function createSeedManuscript() {
  const content = [
    'Chapter One. The river moved under the bridge as the narrator tracked the wake of a stolen skiff at dusk.',
    'Cliff argued for restraint while the town council pressed for action, exposing pressure lines in voice and motive.',
    'By midnight the scene shifted to Minto where conflicting testimonies clarified stakes, transitions, and boundaries.',
  ].join(' ');

  const payloads = [
    { title: 'Phase2 Handoff Proof Seed', created_by: OWNER_ID, user_id: OWNER_ID, work_type: 'novel', word_count: 450, content },
    { title: 'Phase2 Handoff Proof Seed', user_id: OWNER_ID, work_type: 'novel', word_count: 450, content },
    { title: 'Phase2 Handoff Proof Seed', user_id: OWNER_ID, work_type: 'novel', word_count: 450, file_url: `data:text/plain,${encodeURIComponent(content)}` },
  ];

  let lastErr;
  for (const payload of payloads) {
    const { data, error } = await sb.from('manuscripts').insert(payload).select('id').single();
    if (!error && data?.id) return data.id;
    lastErr = error;
  }

  throw new Error(`manuscript insert failed: ${lastErr?.message || 'unknown'}`);
}

async function createJob(manuscriptId) {
  const res = await fetch(`${BASE_URL}/api/jobs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-user-id': OWNER_ID },
    body: JSON.stringify({ manuscript_id: manuscriptId, job_type: 'evaluate_quick' }),
  });

  const body = await res.text();
  console.log('[create_job]', res.status, body.slice(0, 300));

  if (res.status !== 201) throw new Error(`create job failed: ${res.status} ${body}`);
  return JSON.parse(body).job_id;
}

async function readJob(jobId, label) {
  const { data, error } = await sb
    .from('evaluation_jobs')
    .select('id,status,phase,phase_status,progress,last_error,updated_at,last_heartbeat,worker_id')
    .eq('id', jobId)
    .single();

  if (error) throw new Error(`${label}: ${error.message}`);

  const snap = {
    status: data.status,
    phase: data.phase,
    phase_status: data.phase_status,
    progress_phase: data.progress?.phase ?? null,
    progress_phase_status: data.progress?.phase_status ?? null,
    completed_units: data.progress?.completed_units ?? null,
    total_units: data.progress?.total_units ?? null,
    message: data.progress?.message ?? null,
    last_error: data.last_error,
    last_heartbeat: data.last_heartbeat ?? null,
    worker_id: data.worker_id ?? null,
    updated_at: data.updated_at,
  };

  console.log(`[${label}]`, snap);
  return snap;
}

async function postService(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SRK}` },
  });
  const body = await res.text();
  return { status: res.status, body };
}

async function tickWorker() {
  const url = CRON_SECRET
    ? `${BASE_URL}/api/workers/process-evaluations?secret=${encodeURIComponent(CRON_SECRET)}`
    : `${BASE_URL}/api/workers/process-evaluations`;

  const bearer = WORKER_ALLOW_SERVICE_ROLE_DEV ? SRK : CRON_SECRET;
  const headers = bearer ? { Authorization: `Bearer ${bearer}` } : {};

  const res = await fetch(url, { method: 'POST', headers });
  const body = await res.text();
  return { status: res.status, body: body.slice(0, 220) };
}

async function readArtifacts(jobId) {
  const { data, error } = await sb
    .from('evaluation_artifacts')
    .select('id,artifact_type,created_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return [];
  return data || [];
}

await health();
await ensureOwner();
proof.manuscript_id = await createSeedManuscript();
proof.job_id = await createJob(proof.manuscript_id);
proof.starting_state = await readJob(proof.job_id, 'start');

proof.phase1_trigger = await postService(`/api/jobs/${proof.job_id}/run-phase1`);
console.log('[phase1_trigger]', proof.phase1_trigger.status, proof.phase1_trigger.body.slice(0, 200));

let handoff = null;
for (let i = 0; i < PHASE1_MAX_POLLS; i++) {
  const snap = await readJob(proof.job_id, `phase1_poll_${i}`);
  if (snap.status === 'running' && snap.progress_phase === 'phase_1' && snap.progress_phase_status === 'complete') {
    handoff = { poll: i, snapshot: snap };
    break;
  }
  if (snap.status === 'failed') {
    proof.blocker = `Phase1 failed before handoff: ${snap.last_error || 'unknown'}`;
    break;
  }
  await new Promise((r) => setTimeout(r, POLL_MS));
}

proof.phase1_handoff = handoff;

if (!handoff) {
  proof.terminal_outcome = await readJob(proof.job_id, 'phase1_terminal');
  proof.artifact_rows = await readArtifacts(proof.job_id);
  proof.proven_now = 'Unable to reach Phase 1-complete handoff state';
  console.log('\n[PROOF_SUMMARY]');
  console.log(JSON.stringify(proof, null, 2));
  process.exit(0);
}

proof.phase2_trigger = await postService(`/api/jobs/${proof.job_id}/run-phase2`);
console.log('[phase2_trigger]', proof.phase2_trigger.status, proof.phase2_trigger.body.slice(0, 200));

console.log('[DEBUG] NOTE: worker dev-service-role auth depends on the server process env, not just this script env.');
let terminal = null;
console.log("[DEBUG] BASE_URL:", BASE_URL);
console.log("[DEBUG] hasServiceRoleKey:", !!SRK);
console.log("[DEBUG] allowDevServiceRole:", WORKER_ALLOW_SERVICE_ROLE_DEV);
for (let i = 0; i < PHASE2_MAX_POLLS; i++) {
  const tick = await tickWorker();
  console.log('[worker_tick]', i, tick.status, tick.body);

  if (tick.status === 401) {
    proof.blocker =
      'Worker tick returned 401 Unauthorized. Server was likely not started with WORKER_ALLOW_SERVICE_ROLE_DEV=1. ' +
      'Proof is invalid for Phase 2 execution: pipeline was never exercised.';
    proof.proven_now =
      'Proof invalid: worker auth failed before Phase 2 could be exercised. ' +
      'PASS1_TIMEOUT behavior is untested. Restart server with WORKER_ALLOW_SERVICE_ROLE_DEV=1 and rerun.';
    console.log('\n[PROOF_SUMMARY]');
    console.log(JSON.stringify(proof, null, 2));
    process.exit(1);
  }

  const snap = await readJob(proof.job_id, `phase2_poll_${i}`);
  proof.transition_trace.push({
    poll: i,
    status: snap.status,
    phase: snap.phase,
    phase_status: snap.phase_status,
    progress_phase: snap.progress_phase,
    progress_phase_status: snap.progress_phase_status,
    message: snap.message,
    last_error: snap.last_error,
  });

  if (snap.status === 'complete' || snap.status === 'failed') {
    terminal = snap;
    break;
  }

  await new Promise((r) => setTimeout(r, POLL_MS));
}

proof.terminal_outcome = terminal;
proof.artifact_rows = await readArtifacts(proof.job_id);

if (!terminal) {
  proof.blocker = 'No terminal state reached in polling window';
  proof.proven_now = 'Phase 2 queued state observed; terminal closure not reached';
} else if (terminal.status === 'complete') {
  proof.proven_now = 'Phase 1->Phase 2 handoff closes successfully';
} else {
  const regressedToPhase1 = proof.transition_trace.some((t) => t.phase === 'phase_1' || t.progress_phase === 'phase_1');
  proof.proven_now = regressedToPhase1
    ? 'Regression persists: queued phase_2 job re-entered phase_1 execution'
    : 'Phase handoff respected; failed at a different boundary';
}

console.log('\n[PROOF_SUMMARY]');
console.log(JSON.stringify(proof, null, 2));

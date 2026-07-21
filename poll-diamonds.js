const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const JOB_ID = process.env.JOB_ID || '25d4192b-f1c4-4356-bddc-2cef98120ef7';
const INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 10000);
const LOG_FILE = process.env.LOG_FILE || '/home/ubuntu/diamonds-poll.jsonl';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function snapshot() {
  const now = new Date().toISOString();
  const { data: job, error: jobError } = await supabase
    .from('evaluation_jobs')
    .select('*')
    .eq('id', JOB_ID)
    .maybeSingle();

  if (jobError) {
    console.error('job query error', jobError);
    return;
  }

  const { data: artifacts, error: artError } = await supabase
    .from('evaluation_artifacts')
    .select('id,artifact_type,created_at,updated_at,job_id,artifact_version,source_phase,source_hash,freshness_status')
    .eq('job_id', JOB_ID);

  if (artError) {
    console.error('artifact query error', artError);
  }

  const snapshot = { ts: now, job, artifacts: artifacts || [] };
  fs.appendFileSync(LOG_FILE, JSON.stringify(snapshot) + '\n');
  const progress = job?.progress || {};
  const overall = progress.overall || {};
  const part1 = progress.part1 || {};
  const part2 = progress.part2 || {};
  console.log(`${now} status=${job?.status} phase=${job?.phase} phase_status=${job?.phase_status} overall=${overall.completed_units}/${overall.total_units} part1=${part1.completed_units}/${part1.total_units} part2=${part2.completed_units}/${part2.total_units} highWater=${progress.progress_high_water} artifacts=${snapshot.artifacts.length}`);
}

async function main() {
  console.log(`Polling job ${JOB_ID} every ${INTERVAL_MS}ms to ${LOG_FILE}`);
  while (true) {
    try {
      await snapshot();
      const { data: job } = await supabase.from('evaluation_jobs').select('status').eq('id', JOB_ID).maybeSingle();
      if (job && (job.status === 'complete' || job.status === 'failed')) {
        console.log(`Terminal status ${job.status} reached. Final snapshot.`);
        await snapshot();
        break;
      }
    } catch (err) {
      console.error('poll error', err.message);
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

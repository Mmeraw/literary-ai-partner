#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { buildEvaluationSeedE2EProof } from '@/lib/evaluation/seed/evaluationSeedE2EProof';
import { readEvaluationSeedBenchmarkRun } from '@/lib/evaluation/seed/evaluationSeedBenchmarkPersistence';
import { sha256Hex, upsertEvaluationArtifact } from '@/lib/evaluation/artifactPersistence';

function readEnv(path: string): Record<string, string> {
  try {
    const env: Record<string, string> = {};
    for (const raw of readFileSync(path, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const index = line.indexOf('=');
      env[line.slice(0, index).trim()] = line
        .slice(index + 1)
        .trim()
        .replace(/^"(.*)"$/, '$1')
        .replace(/^'(.*)'$/, '$1');
    }
    return env;
  } catch {
    return {};
  }
}

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim() ?? null;
}

const env = { ...readEnv('.env'), ...readEnv('.env.local'), ...process.env };
const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const seedJobId = argValue('seed-job-id') || env.SEED_JOB_ID;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
}

if (!seedJobId) {
  throw new Error('Missing required argument --seed-job-id=...');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const seedRun = await readEvaluationSeedBenchmarkRun(supabase, seedJobId, 'seed');
const artifact = buildEvaluationSeedE2EProof({ seed: seedRun });
const sourceHash = sha256Hex(JSON.stringify({
  artifact_type: artifact.artifact_type,
  artifact_version: artifact.artifact_version,
  seed_run_id: artifact.seed_run_id,
  seed_total_ms: artifact.seed_total_ms,
  story_ledger_score: artifact.story_ledger_score,
  evidence_coverage_score: artifact.evidence_coverage_score,
  hallucination_risk_score: artifact.hallucination_risk_score,
  path_issues: artifact.path_issues,
  recommendation: artifact.recommendation,
}));

const artifactId = await upsertEvaluationArtifact({
  supabase,
  jobId: seedRun.job_id,
  manuscriptId: seedRun.manuscript_id,
  artifactType: 'evaluation_seed_e2e_proof_v1',
  artifactVersion: 'v1',
  sourceHash,
  content: artifact,
});

console.log(JSON.stringify({ artifact_id: artifactId, artifact }, null, 2));

if (artifact.recommendation === 'seed_path_blocked_missing_artifacts' || artifact.recommendation === 'seed_path_disable') {
  process.exitCode = 2;
}

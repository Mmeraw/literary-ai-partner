#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { buildAndPersistEvaluationSeedBenchmark } from '@/lib/evaluation/seed/evaluationSeedBenchmarkPersistence';

function readEnv(path: string): Record<string, string> {
  try {
    const env: Record<string, string> = {};
    for (const raw of readFileSync(path, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const index = line.indexOf('=');
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : null;
}

function requireValue(name: string): string {
  const value = argValue(name) ?? process.env[name.toUpperCase().replace(/-/g, '_')];
  if (!value) {
    throw new Error(`Missing required argument --${name}=...`);
  }
  return value;
}

const env = {
  ...readEnv('.env'),
  ...readEnv('.env.local'),
  ...process.env,
};

const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
}

const baselineJobId = requireValue('baseline-job-id');
const seedJobId = requireValue('seed-job-id');
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const { artifactId, artifact } = await buildAndPersistEvaluationSeedBenchmark({
  supabase,
  baselineJobId,
  seedJobId,
});

console.log(JSON.stringify({ artifact_id: artifactId, artifact }, null, 2));

if (artifact.path_issues.length > 0 || artifact.recommendation === 'seed_harmful_disable') {
  process.exitCode = 2;
}

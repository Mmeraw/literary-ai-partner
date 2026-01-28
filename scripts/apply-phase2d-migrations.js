#!/usr/bin/env node
/**
 * Apply Phase 2D migrations directly via Supabase service role
 * Usage: node scripts/apply-phase2d-migrations.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Phase 2D migrations in order
const PHASE_2D_MIGRATIONS = [
  '20260128000001_add_eval_job_lease_fields.sql',
  '20260128000002_fix_claim_job_atomic_eval_jobs.sql',
  '20260128000003_add_evaluation_provider_calls.sql',
  '20260128000004_add_provider_calls_idempotency.sql',
  '20260128000005_grant_claim_job.sql',
  '20260128000006_add_renew_lease_rpc.sql',
];

async function applyMigration(filename) {
  const filepath = path.join(__dirname, '../supabase/migrations', filename);
  
  if (!fs.existsSync(filepath)) {
    console.log(`  ⚠️  File not found: ${filename}`);
    return false;
  }

  const sql = fs.readFileSync(filepath, 'utf8');

  try {
    console.log(`  Applying: ${filename}`);
    const { error } = await supabase.rpc('execute_query', { query: sql });
    
    if (error) {
      console.error(`    ❌ Failed: ${error.message}`);
      return false;
    }
    
    console.log(`  ✅ Applied: ${filename}`);
    return true;
  } catch (err) {
    console.error(`    ❌ Exception: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('🔧 Applying Phase 2D migrations...\n');

  let passed = 0;
  let failed = 0;

  for (const migration of PHASE_2D_MIGRATIONS) {
    const success = await applyMigration(migration);
    if (success) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

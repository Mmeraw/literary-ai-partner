#!/usr/bin/env node
// Run from repo root: node scripts/apply-lease-token-fix.js

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load env
const root = path.resolve(__dirname, '..');
['.env.local', '.env'].forEach(f => {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) return;
  fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
});

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const DB_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.DIRECT_URL || '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: Missing SUPABASE_URL or SERVICE_ROLE_KEY');
  process.exit(1);
}

const migrationFile = path.join(root, 'supabase/migrations/20260422000001_fix_claim_evaluation_jobs_lease_token_type.sql');
const sql = fs.readFileSync(migrationFile, 'utf8');

const projectRef = SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
console.log('Project ref:', projectRef);
console.log('Applying migration via Supabase Management API...');

// Use the management API SQL endpoint
const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_KEY}`,
  },
  body: JSON.stringify({ query: sql }),
})
  .then(async (res) => {
    const body = await res.text();
    if (res.ok) {
      console.log('✅ Migration applied successfully');
      console.log(body.slice(0, 200));
    } else {
      console.log(`HTTP ${res.status}: ${body.slice(0, 400)}`);
      console.log('');
      console.log('--- Manual fallback ---');
      console.log('Apply this SQL in the Supabase SQL Editor:');
      console.log('https://supabase.com/dashboard/project/' + projectRef + '/editor');
      console.log('File: supabase/migrations/20260422000001_fix_claim_evaluation_jobs_lease_token_type.sql');
    }
  })
  .catch((e) => {
    console.error('Fetch error:', e.message);
  });

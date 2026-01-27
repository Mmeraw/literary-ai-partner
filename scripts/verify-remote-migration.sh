#!/usr/bin/env bash
# Verify remote migration was applied successfully

set -euo pipefail

source .env.local

echo "====================================="
echo "REMOTE MIGRATION VERIFICATION"
echo "====================================="
echo ""

node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('Checking if job_id column exists on remote Supabase...');
  console.log('');
  
  // Try to select job_id column
  const { data, error } = await supabase
    .from('manuscript_chunks')
    .select('id, manuscript_id, job_id, chunk_index')
    .limit(5);
  
  if (error) {
    if (error.code === '42703' || (error.message && error.message.includes('job_id') && error.message.includes('does not exist'))) {
      console.error('✗ MIGRATION NOT APPLIED');
      console.error('');
      console.error('The job_id column does not exist on remote Supabase.');
      console.error('');
      console.error('ACTION REQUIRED: Follow instructions in scripts/apply-remote-migration.md');
      process.exit(1);
    }
    
    console.error('Unexpected error:', error);
    process.exit(1);
  }
  
  console.log('✓ job_id column EXISTS on remote Supabase');
  console.log('');
  
  // Show sample data
  if (data && data.length > 0) {
    console.log('Sample rows:');
    data.forEach(row => {
      console.log(\`  - chunk #\${row.chunk_index} (manuscript \${row.manuscript_id}): job_id=\${row.job_id || 'NULL'}\`);
    });
    
    const withJobId = data.filter(r => r.job_id).length;
    const withoutJobId = data.filter(r => !r.job_id).length;
    
    console.log('');
    console.log(\`Found \${withJobId} chunks WITH job_id, \${withoutJobId} chunks WITHOUT job_id\`);
    
    if (withoutJobId > 0) {
      console.log('');
      console.log('⚠️  Some chunks have NULL job_id (legacy data or migration pending)');
      console.log('   For clean testing, delete old chunks: DELETE FROM manuscript_chunks WHERE manuscript_id = 1;');
    }
  } else {
    console.log('No chunks found in database (clean slate for testing)');
  }
  
  console.log('');
  console.log('✓✓✓ MIGRATION VERIFIED - Phase 2 can now use job_id filtering');
  process.exit(0);
})();
"

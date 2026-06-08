/**
 * Live backfill: calls ensureRevisionOpportunityLedgerArtifact directly for
 * any ledger that is not yet ai_hydrated_complete or longform_enriched.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-hydration.ts
 *
 *   # Single job:
 *   BACKFILL_JOB_ID=85cbfca8-ad58-4297-8a76-cb98636e123b \
 *     npx tsx --env-file=.env.local scripts/backfill-hydration.ts
 */

import { createClient } from '@supabase/supabase-js';
import { ensureRevisionOpportunityLedgerArtifact } from '../lib/revision/opportunityLedger';

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v.trim();
}

async function main() {
  const supabaseUrl = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');

  // Ensure OPENAI_API_KEY is set — hydration requires it
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openaiKey) throw new Error('Missing OPENAI_API_KEY — hydration cannot run');

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const targetJobId = process.env.BACKFILL_JOB_ID?.trim() ?? null;

  // 1. Find ledger artifacts needing hydration
  let query = supabase
    .from('evaluation_artifacts')
    .select('id, job_id, content')
    .eq('artifact_type', 'revision_opportunity_ledger_v1');

  if (targetJobId) {
    query = query.eq('job_id', targetJobId);
  }

  const { data: artifacts, error } = await query;
  if (error) throw new Error(`Supabase query failed: ${error.message}`);

  const needsHydration = (artifacts ?? []).filter((row) => {
    const status = typeof row.content?.candidate_generation_status === 'string'
      ? row.content.candidate_generation_status
      : '';
    return !status.includes('ai_hydrated_complete') && !status.includes('longform_enriched');
  });

  console.log(`\nFound ${needsHydration.length} ledger(s) needing hydration.`);
  if (needsHydration.length === 0) {
    console.log('Nothing to do — all ledgers are already stable.');
    return;
  }

  // 2. Delete each stale ledger artifact so ensureRevisionOpportunityLedgerArtifact
  //    rebuilds from scratch (with hydration) rather than re-using cached content
  for (const row of needsHydration) {
    const { job_id } = row;
    const beforeStatus = row.content?.candidate_generation_status ?? '(none)';
    const beforeOpps: unknown[] = Array.isArray(row.content?.opportunities) ? row.content.opportunities : [];
    const beforeBlocked = beforeOpps.filter((o: any) => !o.candidate_text_a || o.grounding_status === 'unsupported_blocked').length;
    console.log(`\n[${job_id}]`);
    console.log(`  Before: ${beforeStatus} | opps=${beforeOpps.length} blocked=${beforeBlocked}`);

    // Do NOT delete the artifact — the partial guard causes ensureRevisionOpportunityLedgerArtifact
    // to rebuild with carry-forward: previously hydrated candidates are preserved and only
    // still-blocked ones are retried. Deleting would discard progress and restart from all-blocked.

    // 3. Rebuild — this runs the full pipeline including AI hydration
    try {
      const result = await ensureRevisionOpportunityLedgerArtifact(supabase, job_id);
      const afterSupported = result.opportunities.filter((o: any) => o.grounding_status === 'supported').length;
      const afterBlocked = result.opportunities.filter((o: any) => !o.candidate_text_a || o.grounding_status === 'unsupported_blocked').length;

      // Re-fetch to get persisted status
      const { data: after } = await supabase
        .from('evaluation_artifacts')
        .select('content')
        .eq('job_id', job_id)
        .eq('artifact_type', 'revision_opportunity_ledger_v1')
        .maybeSingle();

      const afterStatus = (after?.content as any)?.candidate_generation_status ?? '(not persisted)';
      console.log(`  After:  ${afterStatus} | opps=${result.opportunities.length} supported=${afterSupported} blocked=${afterBlocked}`);
    } catch (rebuildErr) {
      const msg = rebuildErr instanceof Error ? rebuildErr.message : String(rebuildErr);
      console.error(`  ERROR rebuilding: ${msg}`);
    }
  }

  console.log('\nBackfill complete.');
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});

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
 *
 *   # Force-rebuild a single already-stable job (admin only):
 *   FORCE_REBUILD=1 BACKFILL_JOB_ID=85cbfca8-ad58-4297-8a76-cb98636e123b \
 *     npx tsx --env-file=.env.local scripts/backfill-hydration.ts
 *
 *   FORCE_REBUILD=1 requires BACKFILL_JOB_ID. Bulk force is not permitted.
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

  const forceRebuild = process.env.FORCE_REBUILD?.trim() === '1';
  const targetJobId = process.env.BACKFILL_JOB_ID?.trim() ?? null;

  if (forceRebuild && !targetJobId) {
    throw new Error('FORCE_REBUILD=1 requires BACKFILL_JOB_ID. Bulk force is not permitted.');
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // 1. Find ledger artifacts to process
  let query = supabase
    .from('evaluation_artifacts')
    .select('id, job_id, content')
    .eq('artifact_type', 'revision_opportunity_ledger_v1');

  if (targetJobId) {
    query = query.eq('job_id', targetJobId);
  }

  const { data: artifacts, error } = await query;
  if (error) throw new Error(`Supabase query failed: ${error.message}`);

  let toProcess = (artifacts ?? []).filter((row) => {
    const status = typeof row.content?.candidate_generation_status === 'string'
      ? row.content.candidate_generation_status
      : '';
    return !status.includes('ai_hydrated_complete') && !status.includes('longform_enriched');
  });

  // In force mode, include the already-stable job (bypasses stable-guard by deleting first)
  if (forceRebuild && targetJobId) {
    const all = artifacts ?? [];
    toProcess = all.filter((row) => row.job_id === targetJobId);
    if (toProcess.length === 0) {
      console.log(`\nNo ledger found for job ${targetJobId}.`);
      return;
    }
    console.log(`\n[FORCE_REBUILD] Targeting job ${targetJobId} — stable-guard will be bypassed.`);
  }

  const mode = forceRebuild ? 'force-rebuild' : 'hydration';
  console.log(`\nFound ${toProcess.length} ledger(s) for ${mode}.`);
  if (toProcess.length === 0) {
    console.log('Nothing to do — all ledgers are already stable.');
    return;
  }

  for (const row of toProcess) {
    const { job_id } = row;
    const beforeStatus = row.content?.candidate_generation_status ?? '(none)';
    const beforeOpps: unknown[] = Array.isArray(row.content?.opportunities) ? row.content.opportunities : [];
    const beforeSupported = beforeOpps.filter((o: any) => o.grounding_status === 'supported').length;
    const beforeBlocked = beforeOpps.filter((o: any) => !o.candidate_text_a || o.grounding_status === 'unsupported_blocked').length;
    console.log(`\n[${job_id}]`);
    console.log(`  Before: ${beforeStatus} | opps=${beforeOpps.length} supported=${beforeSupported} blocked=${beforeBlocked}`);

    if (forceRebuild) {
      console.log('  FORCE_REBUILD enabled: preserving existing stable supported candidates while retrying unstable cards.');
    }

    // Rebuild — runs full pipeline including dedup, criterion_id, and AI hydration
    try {
      const result = await ensureRevisionOpportunityLedgerArtifact(supabase, job_id, {
        forceRebuild,
      });
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
      const afterOpps: any[] = (after?.content as any)?.opportunities ?? [];
      const uniqueAnchors = new Set(afterOpps.map((o: any) => (o.evidence_anchor ?? '').trim().toLowerCase().slice(0, 80))).size;
      console.log(`  After:  ${afterStatus} | opps=${result.opportunities.length} unique-anchors=${uniqueAnchors} supported=${afterSupported} blocked=${afterBlocked}`);
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

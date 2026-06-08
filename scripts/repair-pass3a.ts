/**
 * repair-pass3a.ts — Admin script: re-run Pass 3A for a job where all MAP chunks failed.
 *
 * Pass 3A fails when the MAP phase (per-chunk LLM reads) all error out, typically due to
 * transient OpenAI API failures. The artifact is persisted as "unavailable", which cascades
 * into all 9 story-ledger layers being marked "degraded" in ledger_quality_report_v1.
 *
 * This script:
 *   1. Loads manuscript chunks from the `manuscript_chunks` table
 *   2. Re-runs runPass3Preflight() — overwrites pass3_preflight_draft_v1 artifact
 *   3. Loads the existing character ledger and story layer artifacts
 *   4. Rebuilds ledger_quality_report_v1 with the new preflight authority
 *   5. Updates pass3a_status / phase1a_batch_state.preflight_status in evaluation_jobs.progress
 *
 * Usage:
 *   REPAIR_JOB_ID=<uuid> npx tsx --env-file=.env.local scripts/repair-pass3a.ts
 *
 * Dry-run (reads only, does not write):
 *   DRY_RUN=1 REPAIR_JOB_ID=<uuid> npx tsx --env-file=.env.local scripts/repair-pass3a.ts
 *
 * After this script completes successfully, run:
 *   FORCE_REBUILD=1 BACKFILL_JOB_ID=<uuid> npx tsx --env-file=.env.local scripts/backfill-hydration.ts
 */

import { createClient } from '@supabase/supabase-js';
import { runPass3Preflight } from '../lib/evaluation/pipeline/runPass3Preflight';
import { buildLedgerQualityReport } from '../lib/evaluation/phase1a/buildLedgerQualityReport';
import { upsertEvaluationArtifact, sha256Hex } from '../lib/evaluation/artifactPersistence';
import type { ManuscriptChunkEvidence } from '../lib/evaluation/pipeline/types';
import type { Pass1aCharacterLedger, CharacterLedgerV2 } from '../lib/evaluation/pipeline/types';

// ─── Env ────────────────────────────────────────────────────────────────────

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v.trim();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const jobId = process.env.REPAIR_JOB_ID?.trim();
  if (!jobId) throw new Error('REPAIR_JOB_ID is required');

  const dryRun = process.env.DRY_RUN?.trim() === '1';
  const supabaseUrl = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openaiKey) throw new Error('OPENAI_API_KEY is required — Pass 3A chunk readers need it');

  console.log(`[repair-pass3a] Job: ${jobId} | dryRun: ${dryRun}`);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // ── 1. Load job ───────────────────────────────────────────────────────────

  const { data: jobRow, error: jobErr } = await supabase
    .from('evaluation_jobs')
    .select('id, manuscript_id, progress, work_type, evaluation_project_id')
    .eq('id', jobId)
    .single();

  if (jobErr || !jobRow) {
    throw new Error(`Job not found: ${jobId} — ${jobErr?.message ?? 'no data'}`);
  }

  const manuscriptId = Number(jobRow.manuscript_id);
  const workType = String((jobRow as Record<string, unknown>).work_type ?? 'prose');
  const evaluationProjectId = ((jobRow as Record<string, unknown>).evaluation_project_id as string | null) ?? null;
  const progressState = ((jobRow as Record<string, unknown>).progress ?? {}) as Record<string, unknown>;

  // Load title from manuscripts table (evaluation_jobs has no title column)
  const { data: msRow } = await supabase
    .from('manuscripts')
    .select('title')
    .eq('id', manuscriptId)
    .maybeSingle();
  const title = String((msRow as Record<string, unknown> | null)?.title ?? 'Unknown');

  console.log(`[repair-pass3a] Manuscript: ${manuscriptId} | Title: ${title} | WorkType: ${workType}`);
  console.log(`[repair-pass3a] Current pass3a_status: ${progressState.pass3a_status ?? 'n/a'}`);

  // ── 2. Load existing Pass 3A artifact to show current state ──────────────

  const { data: currentPass3aRow } = await supabase
    .from('evaluation_artifacts')
    .select('content')
    .eq('job_id', jobId)
    .eq('artifact_type', 'pass3_preflight_draft_v1')
    .maybeSingle();

  if (currentPass3aRow?.content) {
    const existing = currentPass3aRow.content as Record<string, unknown>;
    console.log(`[repair-pass3a] Existing pass3_preflight_draft_v1:`, {
      preflight_authority: existing.preflight_authority,
      reducer_status: existing.reducer_status,
      chunks_expected: (existing.manuscript_read_status as Record<string, unknown> | undefined)?.chunks_expected,
      chunks_received: (existing.manuscript_read_status as Record<string, unknown> | undefined)?.chunks_received,
    });
  }

  // ── 3. Load manuscript chunks ─────────────────────────────────────────────

  const { data: chunkRows, error: chunkErr } = await supabase
    .from('manuscript_chunks')
    .select('chunk_index, content')
    .eq('manuscript_id', manuscriptId)
    .order('chunk_index', { ascending: true });

  if (chunkErr) throw new Error(`Failed to load manuscript chunks: ${chunkErr.message}`);
  if (!chunkRows || chunkRows.length === 0) {
    throw new Error(`No manuscript chunks found for manuscript_id=${manuscriptId}`);
  }

  const manuscriptChunks: ManuscriptChunkEvidence[] = chunkRows
    .filter((r) => typeof r.content === 'string' && r.content.length > 0)
    .map((r) => ({ chunk_index: Number(r.chunk_index), content: r.content as string }));

  console.log(`[repair-pass3a] Loaded ${manuscriptChunks.length} manuscript chunks`);

  if (dryRun) {
    console.log('[repair-pass3a] DRY_RUN=1 — stopping before LLM calls. Chunks verified.');
    return;
  }

  // ── 4. Re-run Pass 3A ─────────────────────────────────────────────────────

  // Use a generous timeout for the repair: 3 min per chunk.
  // .env.local often sets EVAL_OPENAI_TIMEOUT_MS=30000 for development,
  // which is far too short for gpt-5.1 chunk reads. Override explicitly.
  const repairTimeoutMs = 180_000;

  // Default concurrency=1 for repair runs so chunk order and failures are obvious.
  // Override via PASS3A_REPAIR_CONCURRENCY env var if needed.
  const repairConcurrency = Number(process.env.PASS3A_REPAIR_CONCURRENCY ?? '1');

  // Map-phase token cap — must be set explicitly here so the repair script
  // overrides whatever constant the compiled module has cached.
  // Default 2048: enough for 13 criterion signals without hitting the 4096 wall
  // on large (3000+ word) chunks.
  const repairMapMaxTokens = Number(process.env.PASS3A_MAP_MAX_OUTPUT_TOKENS ?? '2048');
  const repairReducerMaxTokens = Number(process.env.PASS3A_REDUCER_MAX_OUTPUT_TOKENS ?? '8192');

  console.log(`[repair-pass3a] Running Pass 3A (timeout=${repairTimeoutMs}ms, concurrency=${repairConcurrency}, mapMaxTokens=${repairMapMaxTokens}, reducerMaxTokens=${repairReducerMaxTokens})...`);
  const pass3aResult = await runPass3Preflight({
    manuscriptChunks,
    title,
    workType,
    jobId,
    manuscriptId,
    openaiApiKey: openaiKey,
    openAiTimeoutMs: repairTimeoutMs,
    _chunkConcurrency: repairConcurrency,
    _mapMaxOutputTokens: repairMapMaxTokens,
    _reducerMaxOutputTokens: repairReducerMaxTokens,
    supabase,
  });

  console.log('[repair-pass3a] Pass 3A complete:', {
    preflight_authority: pass3aResult.preflight.preflight_authority,
    reducer_status: pass3aResult.preflight.reducer_status,
    chunks_received: pass3aResult.preflight.manuscript_read_status.chunks_received,
    chunks_expected: pass3aResult.preflight.manuscript_read_status.chunks_expected,
    chunksFailed: pass3aResult.chunksFailed,
    durationMs: pass3aResult.durationMs,
  });

  const reducerSucceeded =
    pass3aResult.preflight.reducer_status !== 'failed' &&
    pass3aResult.preflight.preflight_authority !== 'unavailable';

  if (!reducerSucceeded) {
    console.error('[repair-pass3a] Pass 3A reducer still failed after re-run. Cannot repair quality report.');
    console.error('[repair-pass3a] reducer_failure_reason:', pass3aResult.preflight.reducer_failure_reason);
    process.exit(1);
  }

  // ── 5. Load character ledger and story layer artifacts ────────────────────

  const [{ data: charLedgerRow }, { data: storyLayerRow }] = await Promise.all([
    supabase
      .from('evaluation_artifacts')
      .select('content')
      .eq('job_id', jobId)
      .eq('artifact_type', 'pass1a_character_ledger_v1')
      .maybeSingle(),
    supabase
      .from('evaluation_artifacts')
      .select('content')
      .eq('job_id', jobId)
      .eq('artifact_type', 'pass1a_story_layer_v1')
      .maybeSingle(),
  ]);

  if (!charLedgerRow?.content) {
    throw new Error('pass1a_character_ledger_v1 artifact not found — cannot rebuild quality report');
  }

  const charLedgerContent = charLedgerRow.content as Record<string, unknown>;

  // buildLedgerQualityReport expects the full Pass1aCharacterLedger object,
  // not just the .entries array. Pass the whole content object.
  const characterLedger = charLedgerContent as unknown as Pass1aCharacterLedger;
  const characterLedgerV2 = (charLedgerContent.ledger_v2 ?? {}) as CharacterLedgerV2;
  const totalChunksProcessed = Number(charLedgerContent.total_chunks_processed ?? manuscriptChunks.length);

  const storyLayerLayers = (storyLayerRow?.content as Record<string, unknown> | null)?.layers as
    | Partial<Record<string, Record<string, unknown>>>
    | null
    | undefined;

  const entryCount = Array.isArray(charLedgerContent.entries) ? (charLedgerContent.entries as unknown[]).length : 0;
  console.log(`[repair-pass3a] Character ledger loaded: ${entryCount} entries`);

  // ── 6. Rebuild ledger_quality_report_v1 ───────────────────────────────────

  const qualityReport = buildLedgerQualityReport(
    characterLedger,
    characterLedgerV2,
    storyLayerLayers ?? null,
    {
      chunkCoverage: {
        chunks_expected: manuscriptChunks.length,
        chunks_completed: totalChunksProcessed,
      },
      preflightReducer: {
        reducer_status: 'ok',
        preflight_authority: pass3aResult.preflight.preflight_authority,
      },
    },
  );

  console.log('[repair-pass3a] New quality report:', {
    gate_ready_status: qualityReport.gate_ready_status,
    hard_fail_present: qualityReport.hard_fail_present,
    blocking_reasons: qualityReport.blocking_reasons,
  });

  // ── 7. Persist the new ledger_quality_report_v1 ───────────────────────────

  const now = new Date().toISOString();
  const qualityReportContent = {
    schema_version: 'ledger_quality_report_v1',
    artifact_type: 'ledger_quality_report_v1',
    job_id: jobId,
    manuscript_id: manuscriptId,
    generated_at: now,
    repaired_at: now,
    repair_source: 'repair-pass3a-script',
    quality_report: qualityReport,
  };

  const sourceHash = sha256Hex(JSON.stringify(qualityReportContent));
  const newArtifactId = await upsertEvaluationArtifact({
    supabase,
    jobId,
    manuscriptId,
    evaluationProjectId,
    artifactType: 'ledger_quality_report_v1',
    content: qualityReportContent,
    sourceHash,
    artifactVersion: 'ledger_quality_report_v1',
  });

  console.log(`[repair-pass3a] ledger_quality_report_v1 upserted: ${newArtifactId}`);

  // ── 8. Update job progress: pass3a_status → 'done' ────────────────────────

  const updatedProgress = {
    ...progressState,
    pass3a_status: 'done',
    pass3a_completed_at: now,
    pass3a_artifact_id: pass3aResult.artifactId,
    quality_report_artifact_id: newArtifactId,
    phase1a_batch_state: {
      ...((progressState.phase1a_batch_state as Record<string, unknown>) ?? {}),
      preflight_status: 'DONE',
      preflight_degraded: false,
    },
    phase_log: [
      ...((Array.isArray(progressState.phase_log) ? progressState.phase_log : []) as unknown[]),
      {
        at: now,
        event: 'pass3a_repaired',
        stage: 'repair',
        reason: 'repair-pass3a-script: all chunks re-read, reducer succeeded',
        pass3a_authority: pass3aResult.preflight.preflight_authority,
        new_gate_ready_status: qualityReport.gate_ready_status,
      },
    ],
  };

  const { error: updateErr } = await supabase
    .from('evaluation_jobs')
    .update({ progress: updatedProgress, worker_pulse_at: now })
    .eq('id', jobId);

  if (updateErr) {
    throw new Error(`Failed to update job progress: ${updateErr.message}`);
  }

  console.log('[repair-pass3a] Job progress updated successfully.');
  console.log('');
  console.log('=== REPAIR COMPLETE ===');
  console.log(`  Job:                   ${jobId}`);
  console.log(`  Pass 3A authority:     ${pass3aResult.preflight.preflight_authority}`);
  console.log(`  gate_ready_status:     ${qualityReport.gate_ready_status}`);
  console.log(`  hard_fail_present:     ${qualityReport.hard_fail_present}`);
  console.log(`  blocking_reasons:      ${qualityReport.blocking_reasons.length > 0 ? qualityReport.blocking_reasons.join('; ') : 'none'}`);
  console.log('');
  console.log('Next step: rebuild Revise Queue');
  console.log(`  FORCE_REBUILD=1 BACKFILL_JOB_ID=${jobId} npx tsx --env-file=.env.local scripts/backfill-hydration.ts`);
}

main().catch((err) => {
  console.error('[repair-pass3a] FATAL:', err);
  process.exit(1);
});

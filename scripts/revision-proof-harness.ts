/**
 * PR C proof harness (read-only):
 * Produces a deterministic stage-by-stage and attrition report for one evaluation job.
 *
 * Usage:
 *   PROOF_JOB_ID=<evaluation_job_id> npx tsx -r tsconfig-paths/register scripts/revision-proof-harness.ts
 *   PROOF_JOB_ID=<evaluation_job_id> npx tsx --env-file=.env.local -r tsconfig-paths/register scripts/revision-proof-harness.ts
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { canonicalJsonSha256 } from '../lib/evaluation/canonicalJsonHash';
import { extractGenreExpectationMetadataFromEvaluationPayload } from '../lib/evaluation/genreExpectationProfiles';
import { deriveReviseEligibilityLabel } from '../lib/evaluation/modeGate';
import {
  reconstructRevisionLedgerWithCurrentCode,
  type HydrationAnchorLookupDiagnostic,
} from '../lib/revision/opportunityLedger';
import {
  modeContractToConfirmedMode,
  resolveRevisionModeContract,
} from '../lib/revision/modeContract';
import { resolveReviseContextQuality } from '../lib/revision/opportunityLedger';

type AnyRecord = Record<string, unknown>;

type ArtifactRow = {
  id?: string | null;
  artifact_type: string;
  content: AnyRecord | null;
  source_hash?: string | null;
  created_at?: string | null;
};

type DecisionRow = {
  id: string;
  opportunity_id: string;
  decision: string;
  is_undo: boolean;
  metadata: AnyRecord | null;
  created_at: string;
};

type FinalReviewRunRow = {
  id: string;
  status: string;
  revised_version_id: string | null;
  applied_decision_ids: string[] | null;
  metadata: AnyRecord | null;
  created_at: string;
};

type HydrationLookupSummary = {
  total: number;
  matched: number;
  no_match: number;
  wrapper_stripped: number;
  dash_normalized: number;
  by_strategy: Record<HydrationAnchorLookupDiagnostic['strategy'], number>;
};

function env(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function requireEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = env(key);
    if (value) return value;
  }
  throw new Error(`Missing required env var. Tried: ${keys.join(', ')}`);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function gitValue(command: string): string | null {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

function currentGitState() {
  const head = gitValue('git rev-parse HEAD');
  const branch = gitValue('git branch --show-current');
  const diffPorcelain = gitValue('git status --short');
  return {
    branch,
    head,
    dirty: Boolean(diffPorcelain),
    dirty_paths: diffPorcelain ? diffPorcelain.split('\n') : [],
  };
}

function latestArtifactsByType(rows: ArtifactRow[]): Map<string, ArtifactRow> {
  const sorted = [...rows].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
  const out = new Map<string, ArtifactRow>();
  for (const row of sorted) {
    if (!out.has(row.artifact_type)) out.set(row.artifact_type, row);
  }
  return out;
}

function wordCountFromEvaluationPayload(payload: unknown): number | null {
  const record = asRecord(payload);
  const overview = asRecord(record.overview);
  const fromOverview = overview.word_count;
  if (typeof fromOverview === 'number' && Number.isFinite(fromOverview)) return fromOverview;
  const fromRoot = record.word_count;
  if (typeof fromRoot === 'number' && Number.isFinite(fromRoot)) return fromRoot;
  return null;
}

function summarizeReasons(opportunities: AnyRecord[], filter?: (o: AnyRecord) => boolean): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of opportunities) {
    if (filter && !filter(o)) continue;
    const reasons = asArray(o.preflight_reasons).filter((r): r is string => typeof r === 'string');
    for (const reason of reasons) out[reason] = (out[reason] ?? 0) + 1;
  }
  return out;
}

function latestDecisionByOpportunity(rows: DecisionRow[]): Map<string, DecisionRow> {
  const sorted = [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latest = new Map<string, DecisionRow>();
  for (const row of sorted) {
    if (!latest.has(row.opportunity_id)) latest.set(row.opportunity_id, row);
  }
  return latest;
}

function emptyHydrationSummary(): HydrationLookupSummary {
  return {
    total: 0,
    matched: 0,
    no_match: 0,
    wrapper_stripped: 0,
    dash_normalized: 0,
    by_strategy: {
      exact_match: 0,
      prefix_match: 0,
      fuzzy_match: 0,
      no_match: 0,
    },
  };
}

function summarizeHistoricalHydrationDiagnostics(raw: unknown): HydrationLookupSummary {
  const diagnostics = asRecord(raw);
  const summary = emptyHydrationSummary();
  for (const value of Object.values(diagnostics)) {
    const diagnostic = asRecord(value);
    const strategy = optionalString(diagnostic.strategy) as HydrationAnchorLookupDiagnostic['strategy'] | null;
    if (!strategy || !(strategy in summary.by_strategy)) continue;
    summary.total++;
    summary.by_strategy[strategy]++;
    if (strategy === 'no_match') summary.no_match++;
    else summary.matched++;
    if (diagnostic.wrapper_stripped === true) summary.wrapper_stripped++;
    if (diagnostic.dash_normalized === true) summary.dash_normalized++;
  }
  return summary;
}

function sha256Of(value: unknown): string {
  return canonicalJsonSha256(value);
}

function reasonCount(summary: Record<string, unknown>, reason: string): number {
  const reasons = asRecord(summary.reasons);
  const value = reasons[reason];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

async function main() {
  const jobId = requireEnv('PROOF_JOB_ID', 'JOB_ID', 'BACKFILL_JOB_ID');
  const supabaseUrl = requireEnv('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: jobRow, error: jobError } = await supabase
    .from('evaluation_jobs')
    .select('id, status, manuscript_id, manuscript_version_id, created_at, evaluation_project_id, evaluation_result, policy_family, voice_preservation_level, english_variant')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) throw new Error(`evaluation_jobs lookup failed: ${jobError.message}`);
  if (!jobRow) throw new Error(`Job not found: ${jobId}`);

  const manuscriptId = Number(jobRow.manuscript_id);

  const { data: manuscriptRow } = await supabase
    .from('manuscripts')
    .select('id, title')
    .eq('id', manuscriptId)
    .maybeSingle();

  const { data: artifactRows, error: artifactError } = await supabase
    .from('evaluation_artifacts')
    .select('id, artifact_type, content, source_hash, created_at')
    .eq('job_id', jobId)
    .in('artifact_type', [
      'unified_evaluation_document_v1',
      'revision_opportunity_ledger_v1',
      'trustedpath_result_v1',
      'revision_completion_record_v1',
      'evaluation_result_v2',
      'evaluation_result_v1',
      'author_exposure_certification_v1',
      'ledger_quality_report_v1',
    ]);
  if (artifactError) throw new Error(`evaluation_artifacts lookup failed: ${artifactError.message}`);

  const artifactsByType = latestArtifactsByType((artifactRows ?? []) as ArtifactRow[]);

  const uedArtifact = artifactsByType.get('unified_evaluation_document_v1') ?? null;
  const revisionLedgerArtifactRow = artifactsByType.get('revision_opportunity_ledger_v1') ?? null;
  const evaluationArtifact = artifactsByType.get('evaluation_result_v2') ?? artifactsByType.get('evaluation_result_v1') ?? null;
  const certificationArtifact = artifactsByType.get('author_exposure_certification_v1') ?? null;
  const ledgerQualityArtifact = artifactsByType.get('ledger_quality_report_v1') ?? null;
  const ued = asRecord(uedArtifact?.content);
  const canonicalLedger = asRecord(ued.canonicalOpportunityLedger);
  const canonicalOpportunities = asArray(canonicalLedger.opportunities);

  const revisionLedgerArtifact = asRecord(revisionLedgerArtifactRow?.content);
  const ledgerOpportunities = asArray(revisionLedgerArtifact.opportunities).map(asRecord);
  const preflight = asRecord(revisionLedgerArtifact.revise_queue_preflight);
  const preflightSummary = asRecord(preflight.summary);
  const historicalHydrationSummary = summarizeHistoricalHydrationDiagnostics(preflight.hydration_anchor_lookup_diagnostics);

  const preflightPassed = ledgerOpportunities.filter((o) => o.preflight_status === 'passed').length;
  const preflightBlocked = ledgerOpportunities.filter((o) => o.preflight_status === 'blocked').length;
  const preflightLimited = ledgerOpportunities.filter((o) => o.preflight_status === 'limited_context').length;
  const readyForRevise = ledgerOpportunities.filter((o) => o.preflight_status === 'passed' && o.grounding_status === 'supported').length;

  const { data: decisionRows, error: decisionsError } = await supabase
    .from('revision_ledger_decisions')
    .select('id, opportunity_id, decision, is_undo, metadata, created_at')
    .eq('evaluation_job_id', jobId)
    .eq('manuscript_id', manuscriptId)
    .eq('is_undo', false);
  if (decisionsError) throw new Error(`revision_ledger_decisions lookup failed: ${decisionsError.message}`);

  const latestDecisions = latestDecisionByOpportunity((decisionRows ?? []) as DecisionRow[]);
  const latestDecisionRows = [...latestDecisions.values()];
  const executableDecisions = latestDecisionRows.filter((row) => ['accepted_a', 'accepted_b', 'accepted_c', 'custom'].includes(row.decision));

  const { data: applyRuns, error: applyRunsError } = await supabase
    .from('final_review_apply_runs')
    .select('id, status, revised_version_id, applied_decision_ids, metadata, created_at')
    .eq('evaluation_job_id', jobId)
    .eq('manuscript_id', manuscriptId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (applyRunsError) throw new Error(`final_review_apply_runs lookup failed: ${applyRunsError.message}`);

  const latestAppliedRun = ((applyRuns ?? []) as FinalReviewRunRow[]).find((r) => r.status === 'applied') ?? null;
  const revisedVersionId = latestAppliedRun?.revised_version_id ?? null;

  let revisedVersionExists = false;
  if (revisedVersionId) {
    const { data: mv } = await supabase
      .from('manuscript_versions')
      .select('id')
      .eq('id', revisedVersionId)
      .maybeSingle();
    revisedVersionExists = Boolean(mv?.id);
  }

  const trustedPathArtifact = artifactsByType.get('trustedpath_result_v1');
  const trustedPathAutoApplied = latestDecisionRows.filter((d) => {
    const source = typeof d.metadata?.source === 'string' ? d.metadata.source : '';
    return source === 'trustedpath-auto-apply';
  }).length;

  const modeContract = resolveRevisionModeContract({
    evaluationPayload: evaluationArtifact?.content ?? jobRow.evaluation_result,
    job: jobRow,
  });
  const genreExpectationContext = extractGenreExpectationMetadataFromEvaluationPayload(evaluationArtifact?.content ?? jobRow.evaluation_result);
  const trustedPathEligibility = deriveReviseEligibilityLabel({
    confirmedMode: modeContractToConfirmedMode(modeContract),
  });

  const { data: chunkRows, error: chunkError } = await supabase
    .from('manuscript_chunks')
    .select('content')
    .eq('manuscript_id', manuscriptId)
    .order('chunk_index', { ascending: true });
  if (chunkError) throw new Error(`manuscript_chunks lookup failed: ${chunkError.message}`);
  const manuscriptChunksByContent = (chunkRows ?? [])
    .map((row: { content?: unknown }) => ({ content: typeof row.content === 'string' ? row.content : '' }))
    .filter((row) => row.content.trim().length > 0);

  const gitState = currentGitState();
  const sourceUedHash = Object.keys(ued).length > 0 ? canonicalJsonSha256(ued) : null;
  const certification = asRecord(certificationArtifact?.content);
  const certifiedUedHash = optionalString(certification.unified_document_hash);
  const certificationDecision = optionalString(certification.decision);
  const contextQualityDecision = resolveReviseContextQuality(
    ledgerQualityArtifact?.content ?? null,
    modeContract.evaluation_mode,
  );
  const wordCount = wordCountFromEvaluationPayload(evaluationArtifact?.content ?? jobRow.evaluation_result);
  const currentCodeReconstruction = sourceUedHash
    ? reconstructRevisionLedgerWithCurrentCode({
        unifiedDocument: ued,
        sourceUedHash,
        wordCount,
        contextQuality: contextQualityDecision.status,
        evaluationMode: modeContract.evaluation_mode,
        manuscriptChunksByContent,
      })
    : null;
  const reconstructionInputHash = currentCodeReconstruction
    ? sha256Of({
        source_ued_hash: sourceUedHash,
        word_count: wordCount,
        context_quality: contextQualityDecision.status,
        evaluation_mode: modeContract.evaluation_mode,
        manuscript_chunks_sha256: sha256Of(manuscriptChunksByContent),
      })
    : null;

  const report = {
    provenance: {
      proof_schema: 'revision_proof_report_v1',
      proof_mode: 'current_code_reconstruction_with_historical_baseline',
      proof_modes_included: [
        'historical_persisted_artifact',
        'current_code_reconstruction',
      ],
      generated_at: new Date().toISOString(),
      evaluation_job_id: jobId,
      evaluation_created_at: jobRow.created_at,
      evaluation_code_commit_if_available: null,
      proof_harness_commit: gitState.head,
      proof_harness_dirty: gitState.dirty,
      main_commit_tested: gitState.head,
      git_branch: gitState.branch,
      dirty_paths: gitState.dirty_paths,
      historical_artifact_created_at: revisionLedgerArtifactRow?.created_at ?? null,
      historical_artifact_source_authority: optionalString(revisionLedgerArtifact.opportunity_source_authority),
      reconstruction_input_hash: reconstructionInputHash,
      historical_persisted_artifact: {
        proof_mode: 'historical_persisted_artifact',
        current_code_reexecution: false,
        expected_to_reflect_current_main: false,
        note: 'This section reports persisted rows/artifact metadata and may reflect old code paths. It is a before/baseline fixture, not proof that current main still behaves this way.',
      },
      current_code_reconstruction: {
        proof_mode: 'current_code_reconstruction',
        current_code_reexecution: Boolean(currentCodeReconstruction),
        mutates_production: false,
        calls_openai: false,
        production_writes_performed: false,
        workbench_runtime_executed: false,
        revised_manuscript_execution_proven: false,
        expected_to_reflect_current_main: Boolean(currentCodeReconstruction),
        uses_real_projection_preflight_hydration_helpers: Boolean(currentCodeReconstruction),
        workbench_runtime_status: 'out_of_scope_for_read_only_reconstruction',
        workbench_queue_count: 'not_executed',
        workbench_scope_reason: 'Real workbench path may authenticate, bind, or persist rows; C1 stops at queue eligibility.',
        note: 'This section replays current projection, preflight, and hydration lookup helpers against the certified UED and manuscript chunks without persisting a ledger, hydrating candidate prose, or executing the workbench runtime.',
      },
      certification: {
        artifact_created_at: certificationArtifact?.created_at ?? null,
        decision: certificationDecision,
        unified_document_hash: certifiedUedHash,
        current_ued_hash: sourceUedHash,
        hash_matches: Boolean(sourceUedHash && certifiedUedHash && sourceUedHash === certifiedUedHash),
      },
    },
    job: {
      id: jobId,
      status: jobRow.status,
      manuscript_id: manuscriptId,
      manuscript_title: manuscriptRow?.title ?? null,
      manuscript_version_id: jobRow.manuscript_version_id,
    },
    historical_persisted_stage_proof: {
      evaluation_completed: jobRow.status === 'complete',
      canonical_opportunities: canonicalOpportunities.length,
      revision_ledger: ledgerOpportunities.length,
      preflight: {
        passed: preflightPassed,
        blocked: preflightBlocked,
        limited_context: preflightLimited,
        summary_from_artifact: preflightSummary,
        hydration_lookup_summary_from_artifact: historicalHydrationSummary,
      },
      revise_queue: readyForRevise,
      workbench_runtime: {
        workbench_runtime_status: 'out_of_scope_for_read_only_reconstruction',
        workbench_queue_count: 'not_executed',
        reason: 'Historical persisted proof does not execute the workbench runtime; C1 reports only persisted baseline and current queue eligibility.',
      },
      revision_execution: {
        latest_decisions_total: latestDecisionRows.length,
        executable_decisions: executableDecisions.length,
      },
      revised_manuscript: {
        persisted: Boolean(revisedVersionId && revisedVersionExists),
        revised_version_id: revisedVersionId,
      },
      revision_history: {
        persisted: latestDecisionRows.length > 0,
        total_decisions: (decisionRows ?? []).length,
        latest_by_opportunity: latestDecisionRows.length,
      },
      trusted_path: {
        trusted_path_status: 'undetermined',
        status_reason: 'C1 reconstruction does not verify a complete TrustedPath execution-mode/certification/provenance chain and does not infer failure from absence of a standalone artifact.',
        standalone_artifact_present: Boolean(trustedPathArtifact),
        standalone_artifact_is_required_contract: false,
        auto_applied_decisions: trustedPathAutoApplied,
        mode_contract: modeContract,
        eligibility_label: trustedPathEligibility,
        genre_expectation_context_present: Boolean(genreExpectationContext),
      },
    },
    historical_persisted_attrition_report: {
      generated_canonical: canonicalOpportunities.length,
      projected_to_ledger: ledgerOpportunities.length,
      dropped_before_ledger: Math.max(canonicalOpportunities.length - ledgerOpportunities.length, 0),
      preflight_passed: preflightPassed,
      preflight_blocked: preflightBlocked,
      preflight_limited_context: preflightLimited,
      queue_ready_for_revise: readyForRevise,
      executed_latest_decisions: latestDecisionRows.length,
      executed_actionable_decisions: executableDecisions.length,
      persisted_apply_runs: (applyRuns ?? []).length,
      persisted_revised_manuscript: Boolean(revisedVersionId && revisedVersionExists),
      blockers_by_reason: summarizeReasons(ledgerOpportunities, (o) => o.preflight_status === 'blocked'),
      all_preflight_reasons: summarizeReasons(ledgerOpportunities),
    },
    current_code_reconstruction: currentCodeReconstruction
      ? {
          source_mode: currentCodeReconstruction.sourceMode,
          canonical_opportunities: currentCodeReconstruction.canonicalCount,
          rendered_opportunities_observability_only: currentCodeReconstruction.renderedCount,
          revision_ledger: currentCodeReconstruction.opportunities.length,
          preflight: currentCodeReconstruction.preflightSummary,
          revise_queue: currentCodeReconstruction.readyForRevise,
          queue_eligibility_result: {
            ready_for_revise: currentCodeReconstruction.readyForRevise,
            definition: 'preflight_status === passed && grounding_status === supported',
          },
          workbench_runtime: {
            workbench_runtime_status: 'out_of_scope_for_read_only_reconstruction',
            workbench_queue_count: 'not_executed',
            reason: 'Real workbench path may authenticate, bind, or persist rows; C1 intentionally stops at queue eligibility.',
          },
          hydration_lookup_all_projected: currentCodeReconstruction.hydrationAnchorLookupSummary,
          hydration_lookup_runtime_candidate_subset: currentCodeReconstruction.runtimeHydrationSubsetSummary,
          attrition_report: {
            generated_canonical: currentCodeReconstruction.canonicalCount,
            projected_to_ledger: currentCodeReconstruction.opportunities.length,
            dropped_before_ledger: Math.max(currentCodeReconstruction.canonicalCount - currentCodeReconstruction.opportunities.length, 0),
            preflight_passed: Number(asRecord(currentCodeReconstruction.preflightSummary).passed ?? 0),
            preflight_blocked: Number(asRecord(currentCodeReconstruction.preflightSummary).blocked ?? 0),
            preflight_limited_context: Number(asRecord(currentCodeReconstruction.preflightSummary).limited_context ?? 0),
            queue_ready_for_revise: currentCodeReconstruction.readyForRevise,
            workbench_runtime_status: 'out_of_scope_for_read_only_reconstruction',
            workbench_queue_count: 'not_executed',
            hydration_lookup_no_match_all_projected: currentCodeReconstruction.hydrationAnchorLookupSummary.no_match,
            hydration_lookup_no_match_runtime_candidate_subset: currentCodeReconstruction.runtimeHydrationSubsetSummary.no_match,
            revision_execution: 'not_proven_by_reconstruction_mode',
            revised_manuscript_persistence: 'not_proven_by_reconstruction_mode',
          },
          limitations: [
            'Does not regenerate a fresh evaluation.',
            'Does not call OpenAI candidate hydration.',
            'Does not create revision decisions.',
            'Does not apply decisions or persist a revised manuscript.',
          ],
        }
      : null,
    comparison: currentCodeReconstruction
      ? {
          historical_persisted_ledger: ledgerOpportunities.length,
          current_code_reconstructed_ledger: currentCodeReconstruction.opportunities.length,
          historical_dropped_before_ledger: Math.max(canonicalOpportunities.length - ledgerOpportunities.length, 0),
          current_code_dropped_before_ledger: Math.max(currentCodeReconstruction.canonicalCount - currentCodeReconstruction.opportunities.length, 0),
          historical_anchor_mismatch: summarizeReasons(ledgerOpportunities).anchor_mismatch ?? 0,
          current_code_insufficient_anchor_grounding: reasonCount(currentCodeReconstruction.preflightSummary, 'insufficient_anchor_grounding'),
          historical_hydration_context_not_found: summarizeReasons(ledgerOpportunities).hydration_context_not_found ?? 0,
          current_code_hydration_lookup_no_match_all_projected: currentCodeReconstruction.hydrationAnchorLookupSummary.no_match,
          current_code_hydration_lookup_no_match_runtime_candidate_subset: currentCodeReconstruction.runtimeHydrationSubsetSummary.no_match,
          historical_queue_ready: readyForRevise,
          current_code_queue_ready: currentCodeReconstruction.readyForRevise,
          current_code_workbench_runtime_status: 'out_of_scope_for_read_only_reconstruction',
          current_code_workbench_queue_count: 'not_executed',
          delta_by_stage: {
            canonical_opportunities: {
              historical: canonicalOpportunities.length,
              current_code: currentCodeReconstruction.canonicalCount,
              delta: currentCodeReconstruction.canonicalCount - canonicalOpportunities.length,
            },
            revision_ledger: {
              historical: ledgerOpportunities.length,
              current_code: currentCodeReconstruction.opportunities.length,
              delta: currentCodeReconstruction.opportunities.length - ledgerOpportunities.length,
            },
            anchor_grounding_failure_reason: {
              historical_anchor_mismatch: summarizeReasons(ledgerOpportunities).anchor_mismatch ?? 0,
              current_code_insufficient_anchor_grounding: reasonCount(currentCodeReconstruction.preflightSummary, 'insufficient_anchor_grounding'),
            },
            hydration_lookup_failures: {
              historical_hydration_context_not_found: summarizeReasons(ledgerOpportunities).hydration_context_not_found ?? 0,
              current_code_no_match_all_projected: currentCodeReconstruction.hydrationAnchorLookupSummary.no_match,
              current_code_no_match_runtime_candidate_subset: currentCodeReconstruction.runtimeHydrationSubsetSummary.no_match,
            },
            workbench: {
              historical_runtime_status: 'out_of_scope_for_read_only_reconstruction',
              current_code_runtime_status: 'out_of_scope_for_read_only_reconstruction',
              workbench_queue_count: 'not_executed',
              reason: 'C1 intentionally does not execute workbench runtime paths because they may authenticate, bind, or persist rows.',
            },
          },
        }
      : null,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error('[revision-proof-harness] FATAL:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});

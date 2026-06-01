/**
 * buildLedgerQualityReport.ts
 *
 * Derives the gate-verdict artifact (ledger_quality_report_v1) from a
 * completed Pass1aCharacterLedger + CharacterLedgerV2.
 *
 * Gate verdicts:
 *   reviewable     — no hard fails; send to Review Gate immediately
 *   blocked        — hard fails present; operator must review before forwarding
 *   repair_required — fragmented identity or zero antagonist coverage; ledger
 *                     may be incomplete but not critically broken
 *
 * This function is deterministic — same inputs always produce same verdict.
 * It NEVER calls LLM. It only reads what Phase 1A already produced.
 */

import type { Pass1aCharacterLedger, CharacterLedgerV2 } from '@/lib/evaluation/pipeline/types';
import type { LedgerQualityReportPayload } from './storyLayerArtifactWriters';
import type { StoryLayerCoreLayerKey } from '@/lib/evaluation/artifacts/artifactTypes';
import { assessStoryLayerIdentityDependencies } from './storyLayerDependencyHealth';

type GateReadyStatus = LedgerQualityReportPayload['gate_ready_status'];
type RecommendedReviewAction = LedgerQualityReportPayload['recommended_review_action'];

interface QualityCheckResult {
  key: string;
  severity: 'hard_fail' | 'warning' | 'info';
  message: string;
  layer: StoryLayerCoreLayerKey | 'general';
  evidenceReference?: string;
}

type LedgerQualityTechnicalSignals = {
  chunkCoverage?: {
    chunks_expected: number;
    chunks_completed: number;
  };
  preflightReducer?: {
    reducer_status: 'ok' | 'failed' | 'unknown';
    preflight_authority?: 'full' | 'reduced' | 'advisory' | 'unavailable' | null;
  };
};

function runQualityChecks(
  ledger: Pass1aCharacterLedger,
  ledgerV2: CharacterLedgerV2,
): QualityCheckResult[] {
  const results: QualityCheckResult[] = [];

  const v1CharacterCount = ledger.entries.length;
  const v2IdentityCount = ledgerV2.identityLedger.length;

  // ── Hard Fail Checks ──────────────────────────────────────────────────────

  // Hard fail triggers from Pass 1A sweep
  for (const trigger of ledger.coverage_summary.hard_fail_triggers ?? []) {
    results.push({
      key: 'pass1a_hard_fail_trigger',
      severity: 'hard_fail',
      message: trigger,
      layer: 'source_integrity_layer',
      evidenceReference: 'pass1a_character_ledger_v1.coverage_summary.hard_fail_triggers',
    });
  }

  if (v1CharacterCount === 0) {
    results.push({
      key: 'character_ledger_empty',
      severity: 'hard_fail',
      message: 'HARD_FAIL: pass1a_character_ledger_v1 has zero verified characters; Story Layer must be blocked fail-closed.',
      layer: 'source_integrity_layer',
      evidenceReference: 'pass1a_character_ledger_v1.entries',
    });
  }

  if (v1CharacterCount === 0 && v2IdentityCount > 0) {
    results.push({
      key: 'character_ledger_internal_inconsistency',
      severity: 'hard_fail',
      message: `HARD_FAIL: internal consistency violation — v1 character ledger is empty while CharacterLedgerV2 has ${v2IdentityCount} identity candidate(s).`,
      layer: 'canonical_identity_layer',
      evidenceReference: 'pass1a_character_ledger_v1.entries + character_ledger_v2.identityLedger',
    });
  }

  // Unresolved state conflicts (flagged for human review)
  const unresolvedConflicts = (ledgerV2.stateConflicts ?? []).filter(
    (c) => c.resolution === 'unresolved' && c.flagForHumanReview,
  );
  for (const conflict of unresolvedConflicts) {
    results.push({
      key: `unresolved_state_conflict:${conflict.conflictId}`,
      severity: 'hard_fail',
      message: `Unresolved state conflict: ${conflict.field} for character ${conflict.characterId} — ${conflict.claimA} vs ${conflict.claimB}`,
      layer: 'canonical_identity_layer',
      evidenceReference: `state_conflict.${conflict.conflictId}`,
    });
  }

  // ── Warning Checks ────────────────────────────────────────────────────────

  // No POV characters detected
  const protagonists = ledger.coverage_summary.protagonists ?? [];
  const coProtagonists = ledger.coverage_summary.co_protagonists ?? [];
  if (protagonists.length === 0 && coProtagonists.length === 0) {
    results.push({
      key: 'no_pov_detected',
      severity: 'warning',
      message: 'No POV characters detected. Manuscript may require a second sweep or the narrator is unnamed.',
      layer: 'pov_structure_layer',
      evidenceReference: 'pass1a_character_ledger_v1.coverage_summary.protagonists',
    });
  }

  // No pressure-bearing systems detected in V2
  const pressureBearingRoles = new Set([
    'antagonist',
    'pressure_agent',
    'romantic_catalyst',
    'sexual_destabilizer',
    'domestic_foil',
    'artistic_countermodel',
    'social_observer',
    'social_catalyst',
    'patriarchal_pressure',
    'symbolic_force',
    'collective_force',
  ]);

  const pressureSystemCount = (ledgerV2.identityLedger ?? []).filter(
    (e) => pressureBearingRoles.has(String(e.narrativeRole ?? 'unknown')),
  ).length;

  if (pressureSystemCount === 0) {
    results.push({
      key: 'no_pressure_system_detected',
      severity: 'warning',
      message: 'No narrative pressure systems detected. Pressure / stakes / consequence mapping may be incomplete.',
      layer: 'threat_antagonist_ending_layer',
    });
  }

  // Ending accountability warnings from Pass 1A
  for (const warn of ledger.coverage_summary.ending_accountability_warnings ?? []) {
    results.push({
      key: 'ending_accountability',
      severity: 'warning',
      message: warn,
      layer: 'threat_antagonist_ending_layer',
      evidenceReference: 'pass1a_character_ledger_v1.coverage_summary.ending_accountability_warnings',
    });
  }

  // Missing or underweighted characters
  const missing = ledger.coverage_summary.missing_or_underweighted ?? [];
  if (missing.length > 0) {
    results.push({
      key: 'missing_or_underweighted_characters',
      severity: 'warning',
      message: `${missing.length} character(s) may be missing or underweighted: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`,
      layer: 'cast_role_tier_layer',
      evidenceReference: 'pass1a_character_ledger_v1.coverage_summary.missing_or_underweighted',
    });
  }

  // Zero relationships detected when multiple characters present
  const characterCount = ledgerV2.identityLedger.length;
  const relationshipCount = ledgerV2.relationshipLedger.length;
  if (characterCount >= 3 && relationshipCount === 0) {
    results.push({
      key: 'no_relationships_detected',
      severity: 'warning',
      message: 'Multiple characters detected but no relationship arcs mapped. Relationship sweep may have been incomplete.',
      layer: 'relationship_network_layer',
    });
  }

  // Zero objects tracked when symbol_payoff_items from v1 are present
  const symbolPayoffItems = ledger.coverage_summary.symbol_payoff_items ?? [];
  const objectCount = ledgerV2.objectLedger.length;
  if (symbolPayoffItems.length > 0 && objectCount === 0) {
    results.push({
      key: 'object_ledger_empty_with_symbol_items',
      severity: 'warning',
      message: `${symbolPayoffItems.length} symbol/payoff item(s) flagged in v1 but object ledger is empty. Object tracking may need repair.`,
      layer: 'object_symbol_layer',
      evidenceReference: 'pass1a_character_ledger_v1.coverage_summary.symbol_payoff_items',
    });
  }

  // Suppress-severity blockers
  const suppressBlockers = (ledgerV2.activeBlockers ?? []).filter(
    (b) => b.severity === 'suppress',
  );
  for (const blocker of suppressBlockers) {
    results.push({
      key: `suppress_blocker:${blocker.blockerId}`,
      severity: 'warning',
      message: `SUPPRESS blocker active: ${blocker.rule}`,
      layer: 'threat_antagonist_ending_layer',
      evidenceReference: `blocker.${blocker.blockerId}`,
    });
  }

  return results;
}

export function buildLedgerQualityReport(
  ledger: Pass1aCharacterLedger,
  ledgerV2: CharacterLedgerV2,
  layers?: Partial<Record<StoryLayerCoreLayerKey, Record<string, unknown>>> | null,
  technicalSignals?: LedgerQualityTechnicalSignals,
): LedgerQualityReportPayload {
  const dependencyAssessment = assessStoryLayerIdentityDependencies({
    ledger,
    ledgerV2,
    layers,
  });
  const checks = [...runQualityChecks(ledger, ledgerV2), ...dependencyAssessment.qualityChecks];

  const hardFails = checks.filter((c) => c.severity === 'hard_fail');
  const warnings = checks.filter((c) => c.severity === 'warning');
  const technicalBlockingReasons: string[] = [];

  const chunkCoverage = technicalSignals?.chunkCoverage;
  if (
    chunkCoverage &&
    Number.isFinite(chunkCoverage.chunks_expected) &&
    Number.isFinite(chunkCoverage.chunks_completed) &&
    chunkCoverage.chunks_completed < chunkCoverage.chunks_expected
  ) {
    technicalBlockingReasons.push(
      `TECHNICAL_BLOCK: Phase 1A chunk coverage incomplete (${chunkCoverage.chunks_completed}/${chunkCoverage.chunks_expected}). Retry chunk extraction before content-quality judgment.`,
    );
  }

  const preflightReducer = technicalSignals?.preflightReducer;
  if (preflightReducer?.reducer_status === 'failed') {
    technicalBlockingReasons.push(
      'TECHNICAL_BLOCK: Pass 3A reducer failed. Retry technical recovery before content-quality judgment.',
    );
  }
  if (preflightReducer?.preflight_authority === 'unavailable') {
    technicalBlockingReasons.push(
      'TECHNICAL_BLOCK: Pass 3A authority is unavailable. Retry technical recovery before content-quality judgment.',
    );
  }

  if (technicalBlockingReasons.length > 0) {
    return {
      gate_ready_status: 'blocked_retryable_technical',
      hard_fail_present: false,
      grouped_warning_summary: {
        general: technicalBlockingReasons,
      },
      layer_truth_status: {
        canonical_identity_layer: dependencyAssessment.canonicalIdentityHealth.truth_status,
        ...Object.fromEntries(
          dependencyAssessment.dependencyWarnings.map((warning) => [warning.layer, warning.inherited_status]),
        ),
      },
      layer_dependency_warnings: dependencyAssessment.dependencyWarnings,
      evidence_location_references: [],
      blocking_reasons: technicalBlockingReasons,
      recommended_review_action: 'retry_phase1a_technical_recovery',
    };
  }

  const hardFailPresent = hardFails.length > 0;

  // Gate-ready status
  let gate_ready_status: GateReadyStatus;
  if (hardFailPresent) {
    gate_ready_status = 'blocked';
  } else if (warnings.length > 3) {
    gate_ready_status = 'repair_required';
  } else {
    gate_ready_status = 'reviewable';
  }

  // Recommended review action
  let recommended_review_action: RecommendedReviewAction;
  if (hardFailPresent) {
    recommended_review_action = 'operator_review_required';
  } else if (gate_ready_status === 'repair_required') {
    recommended_review_action = 'repair_story_layer';
  } else {
    recommended_review_action = 'send_to_review_gate';
  }

  // Group non-clean conditions by layer so the server-side visibility gate can
  // block author payloads without guessing.
  const grouped_warning_summary: Record<string, string[]> = {};
  for (const check of [...warnings, ...hardFails]) {
    const layerKey = check.layer;
    if (!grouped_warning_summary[layerKey]) {
      grouped_warning_summary[layerKey] = [];
    }
    grouped_warning_summary[layerKey].push(check.message);
  }

  // Evidence location references for all checks with references
  const evidence_location_references: LedgerQualityReportPayload['evidence_location_references'] =
    checks
      .filter((c) => c.evidenceReference)
      .map((c) => ({
        layer: c.layer,
        reference: c.evidenceReference!,
      }));

  // Blocking reasons (hard fails + critical warnings)
  const blocking_reasons: string[] = [
    ...hardFails.map((c) => c.message),
    ...warnings
      .filter((c) => c.key === 'no_pov_detected')
      .map((c) => c.message),
  ];

  return {
    gate_ready_status,
    hard_fail_present: hardFailPresent,
    grouped_warning_summary,
    layer_truth_status: {
      canonical_identity_layer: dependencyAssessment.canonicalIdentityHealth.truth_status,
      ...Object.fromEntries(
        dependencyAssessment.dependencyWarnings.map((warning) => [warning.layer, warning.inherited_status]),
      ),
    },
    layer_dependency_warnings: dependencyAssessment.dependencyWarnings,
    evidence_location_references,
    blocking_reasons,
    recommended_review_action,
  };
}

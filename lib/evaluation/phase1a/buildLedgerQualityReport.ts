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
    degraded_chunks?: number;
    degraded_ratio?: number;
  };
  storyLayerCoverage?: {
    populated_substantive_layers: number;
    minimum_required_substantive_layers: number;
    populated_layer_keys?: string[];
  };
  preflightReducer?: {
    reducer_status: 'ok' | 'failed' | 'unknown';
    preflight_authority?: 'full' | 'reduced' | 'advisory' | 'unavailable' | null;
  };
};

export const PHASE1A_DEGRADED_CHUNK_RATIO_TECHNICAL_BLOCK_THRESHOLD = 0.1;
export const PHASE1A_DEGRADED_CHUNK_COUNT_TECHNICAL_BLOCK_THRESHOLD = 2;

/** Primary/major role tiers that can trigger ending-accountability hard-fails. */
const PRIMARY_ROLE_TIERS = new Set<string>([
  'protagonist', 'co_protagonist', 'antagonist',
]);

/** Context passed to the hard-fail triage so it can distinguish actionable
 *  pipeline blocks from advisory/insufficient-evidence findings. */
interface TriageContext {
  /** Role lookup: canonical_name → Pass1aRoleSignal from ledger entries. */
  roleLookup: Map<string, string>;
  /** Preflight/reducer authority level (null/undefined = not available). */
  preflightAuthority?: 'full' | 'reduced' | 'advisory' | 'unavailable' | null;
}

export type LedgerQualityModeContext = {
  allowSparseShortForm?: boolean;
  wordCount?: number;
  evaluationMode?: string;
};

const SHORT_FORM_SPARSE_HARD_FAIL_KEYS = new Set([
  'character_ledger_empty',
]);

/**
 * Detect entity-typing contamination: pronoun/descriptor fragments that the
 * LLM mistakenly treated as character identities.
 *
 * Per doctrine: "A river cannot become a Character unless personified.
 * If contamination occurs: suppress internally."
 */
export function isEntityTypingContaminated(name: string): boolean {
  const n = name.trim();
  if (/\bUnknown\b/i.test(n)) return true;
  if (/^Primary\s+(He|She|They|It|Him|Her)\b/i.test(n)) return true;
  if (/^(he|she|they|it|him|her|his|hers|their)[_\s]/i.test(n)) return true;
  if (/^(central|main|primary|secondary|minor|background)[_\s]/i.test(n)) return true;
  // "Unnamed" is only contamination when it's a bare placeholder (e.g. "unnamed_1").
  // "Unnamed first-person narrator" or "Unnamed protagonist" are valid character
  // designations in first-person nonfiction/memoir — not contamination.
  if (/\bunnamed\b/i.test(n) && !/\b(narrator|protagonist|character|speaker|voice)\b/i.test(n)) return true;
  return false;
}

function triageHardFailTrigger(
  trigger: string,
  ctx: TriageContext,
): { severity: QualityCheckResult['severity']; message: string } {
  const trimmed = trigger.trim();

  // ── Rule 1: WARN-prefixed items are never hard-fails ──────────────────
  if (/^WARN:/i.test(trimmed)) {
    return { severity: 'warning', message: trimmed };
  }

  // ── Entity-typing contamination check (runs before accountability) ────
  const nameMatch = trimmed.match(/"([^"]+)"/);
  if (nameMatch && isEntityTypingContaminated(nameMatch[1])) {
    return {
      severity: 'info',
      message: `SUPPRESSED (entity-typing contamination): ${trimmed}`,
    };
  }

  // ── Rule 2: Degraded/unavailable authority blocks content certainty ───
  // "Content certainty requires evidence authority." If Track C / Pass 3A
  // authority is degraded, the system cannot confidently issue content
  // hard-fails — route to insufficient_evidence (warning).
  const authority = ctx.preflightAuthority;
  if (authority && authority !== 'full') {
    return {
      severity: 'warning',
      message: `INSUFFICIENT_EVIDENCE (authority=${authority}): ${trimmed}`,
    };
  }

  // ── Rule 3: Ending accountability — NEVER a pipeline block ─────────────
  // Characters with unresolved endings may be intentional craft choices
  // (ambiguity, sequel setup, literary open-endedness). Flag for author
  // confirmation rather than blocking the entire evaluation.
  if (/ending accountability/i.test(trimmed)) {
    const characterName = nameMatch?.[1];
    const role = characterName ? ctx.roleLookup.get(characterName) : undefined;
    const isPrimary = role != null && PRIMARY_ROLE_TIERS.has(role);

    if (!isPrimary) {
      return {
        severity: 'warning',
        message: trimmed.replace(/^HARD_FAIL:\s*/i, 'ENDING_NOTE: '),
      };
    }
    // Primary character — flag for author confirmation, but NEVER block.
    // The eval report will surface this as "Is this intentional?" in the
    // character criterion. Downstream scoring adjusts confidence, not gates.
    return {
      severity: 'warning',
      message: trimmed.replace(/^HARD_FAIL:\s*/i, 'AUTHOR_QUERY: ') + ' — is this intentional (ambiguity, sequel, open ending)?',
    };
  }

  // ── Default: preserve as hard-fail ────────────────────────────────────
  return { severity: 'hard_fail', message: trimmed };
}
function runQualityChecks(
  ledger: Pass1aCharacterLedger,
  ledgerV2: CharacterLedgerV2,
  technicalSignals?: LedgerQualityTechnicalSignals,
  modeContext?: LedgerQualityModeContext,
): QualityCheckResult[] {
  const results: QualityCheckResult[] = [];
  const allowSparseShortForm = modeContext?.allowSparseShortForm === true;

  const v1CharacterCount = ledger.entries.length;
  const v2IdentityCount = ledgerV2.identityLedger.length;

  // Build role lookup from ledger entries for triage context.
  const roleLookup = new Map<string, string>();
  for (const entry of ledger.entries) {
    roleLookup.set(entry.canonical_name, entry.role);
  }
  const triageCtx: TriageContext = {
    roleLookup,
    preflightAuthority: technicalSignals?.preflightReducer?.preflight_authority ?? undefined,
  };

  // ── Hard Fail Checks ──────────────────────────────────────────────────────

  // Hard fail triggers from Pass 1A sweep.
  // The LLM may place warnings and non-blocking findings in this array.
  // Triage rules (deterministic — LLM text is advisory input only):
  //  1. "WARN:" prefix → warning (LLM labeled it non-blocking)
  //  2. entity-typing contamination → suppressed (info)
  //  3. authority degraded/unavailable → insufficient_evidence (warning)
  //  4. ending accountability for supporting/minor → warning (craft finding)
  //  5. ending accountability for verified primary with clean authority → hard_fail
  //  6. everything else → hard_fail (unchanged)
  for (const trigger of ledger.coverage_summary.hard_fail_triggers ?? []) {
    const triaged = triageHardFailTrigger(trigger, triageCtx);
    results.push({
      key: 'pass1a_hard_fail_trigger',
      severity: triaged.severity,
      message: triaged.message,
      layer: 'source_integrity_layer',
      evidenceReference: 'pass1a_character_ledger_v1.coverage_summary.hard_fail_triggers',
    });
  }

  if (v1CharacterCount === 0) {
    results.push({
      key: 'character_ledger_empty',
      severity: allowSparseShortForm ? 'warning' : 'hard_fail',
      message: allowSparseShortForm
        ? 'SPARSE_SHORT_FORM: pass1a_character_ledger_v1 has zero verified characters because the submitted text does not provide enough character evidence. Treat as insufficient evidence, not pipeline failure.'
        : 'HARD_FAIL: pass1a_character_ledger_v1 has zero verified characters; Story Layer must be blocked fail-closed.',
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

  const contaminatedCoverageCoreNames = [
    ...(ledger.coverage_summary.protagonists ?? []),
    ...(ledger.coverage_summary.co_protagonists ?? []),
  ].filter(isEntityTypingContaminated);
  for (const name of contaminatedCoverageCoreNames) {
    results.push({
      key: `contaminated_core_coverage_identity:${name}`,
      severity: 'hard_fail',
      message: `HARD_FAIL: contaminated placeholder identity "${name}" was promoted into protagonist/co-protagonist coverage. Repair character ledger before story-layer handoff.`,
      layer: 'canonical_identity_layer',
      evidenceReference: 'pass1a_character_ledger_v1.coverage_summary.protagonists',
    });
  }

  const contaminatedV1CoreEntries = ledger.entries.filter(
    (entry) => PRIMARY_ROLE_TIERS.has(entry.role) && isEntityTypingContaminated(entry.canonical_name),
  );
  for (const entry of contaminatedV1CoreEntries) {
    results.push({
      key: `contaminated_core_v1_entry:${entry.canonical_name}`,
      severity: 'hard_fail',
      message: `HARD_FAIL: contaminated placeholder identity "${entry.canonical_name}" was promoted to ${entry.role}. Repair character extraction before story-layer handoff.`,
      layer: 'canonical_identity_layer',
      evidenceReference: 'pass1a_character_ledger_v1.entries',
    });
  }

  const contaminatedV2CoreEntries = ledgerV2.identityLedger.filter((entry) => {
    const role = String(entry.narrativeRole ?? '').toLowerCase();
    const importance = String(entry.importanceLevel ?? '').toLowerCase();
    const isCore = PRIMARY_ROLE_TIERS.has(role) || importance === 'primary' || importance === 'major';
    return isCore && isEntityTypingContaminated(entry.canonicalName);
  });
  for (const entry of contaminatedV2CoreEntries) {
    results.push({
      key: `contaminated_core_v2_identity:${entry.characterId}`,
      severity: 'hard_fail',
      message: `HARD_FAIL: contaminated placeholder identity "${entry.canonicalName}" was promoted into CharacterLedgerV2 core identity set. Repair identity reduction before story-layer handoff.`,
      layer: 'canonical_identity_layer',
      evidenceReference: 'character_ledger_v2.identityLedger',
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
      message: allowSparseShortForm
        ? 'No POV characters detected. For sparse short-form submissions, this is an insufficient-evidence condition rather than a ledger failure.'
        : 'No POV characters detected. Manuscript may require a second sweep or the narrator is unnamed.',
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
      message: allowSparseShortForm
        ? 'No narrative pressure systems detected. For sparse short-form submissions, mark pressure/antagonist evidence as insufficient or N/A.'
        : 'No narrative pressure systems detected. Pressure / stakes / consequence mapping may be incomplete.',
      layer: 'threat_antagonist_ending_layer',
    });
  }

  // Ending accountability warnings from Pass 1A
  for (const warn of ledger.coverage_summary.ending_accountability_warnings ?? []) {
    results.push({
      key: 'ending_accountability',
      severity: 'warning',
      message: allowSparseShortForm
        ? `Sparse short-form ending evidence unavailable: ${warn}`
        : warn,
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

  // Suppress-severity blockers are negative-knowledge recommendation guardrails,
  // not story-ledger repair findings by default. Keep them passively observable
  // without counting them toward repair_required / clean-canon degradation.
  const suppressBlockers = (ledgerV2.activeBlockers ?? []).filter(
    (b) => b.severity === 'suppress',
  );
  for (const blocker of suppressBlockers) {
    results.push({
      key: `suppress_blocker:${blocker.blockerId}`,
      severity: 'info',
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
  modeContext?: LedgerQualityModeContext,
): LedgerQualityReportPayload {
  const allowSparseShortForm = modeContext?.allowSparseShortForm === true;
  const dependencyAssessment = assessStoryLayerIdentityDependencies({
    ledger,
    ledgerV2,
    layers,
    allowSparseMissingIdentity: allowSparseShortForm,
  });
  const checks = [...runQualityChecks(ledger, ledgerV2, technicalSignals, modeContext), ...dependencyAssessment.qualityChecks];

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

  if (chunkCoverage) {
    const degradedChunks = Number.isFinite(chunkCoverage.degraded_chunks)
      ? Number(chunkCoverage.degraded_chunks)
      : 0;
    const degradedRatio = Number.isFinite(chunkCoverage.degraded_ratio)
      ? Number(chunkCoverage.degraded_ratio)
      : (
          Number.isFinite(chunkCoverage.chunks_expected) && chunkCoverage.chunks_expected > 0
            ? degradedChunks / chunkCoverage.chunks_expected
            : 0
        );

    if (
      degradedChunks >= PHASE1A_DEGRADED_CHUNK_COUNT_TECHNICAL_BLOCK_THRESHOLD ||
      degradedRatio >= PHASE1A_DEGRADED_CHUNK_RATIO_TECHNICAL_BLOCK_THRESHOLD
    ) {
      technicalBlockingReasons.push(
        `TECHNICAL_BLOCK: Phase 1A degraded chunk ratio too high (${degradedChunks}/${chunkCoverage.chunks_expected}, ratio=${degradedRatio.toFixed(3)}). Retry exhausted chunk extraction before content-quality judgment.`,
      );
    }
  }

  const storyLayerCoverage = technicalSignals?.storyLayerCoverage;
  if (
    storyLayerCoverage &&
    Number.isFinite(storyLayerCoverage.populated_substantive_layers) &&
    Number.isFinite(storyLayerCoverage.minimum_required_substantive_layers) &&
    storyLayerCoverage.populated_substantive_layers < storyLayerCoverage.minimum_required_substantive_layers
  ) {
    technicalBlockingReasons.push(
      `TECHNICAL_BLOCK: Story Layer substantive coverage below minimum (${storyLayerCoverage.populated_substantive_layers}/${storyLayerCoverage.minimum_required_substantive_layers}). Populated layers: ${(storyLayerCoverage.populated_layer_keys ?? []).join(', ') || 'none'}. Retry or repair extraction before release to the next step.`,
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
    gate_ready_status = 'blocked_content_hard_fail';
  } else if (warnings.length > 3) {
    gate_ready_status = 'repair_required';
  } else {
    gate_ready_status = 'reviewable';
  }

  // Recommended review action
  let recommended_review_action: RecommendedReviewAction;
  if (hardFailPresent) {
    recommended_review_action = 'operator_review_required';
  } else if (allowSparseShortForm) {
    recommended_review_action = 'repair_story_layer';
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

  if (allowSparseShortForm) {
    grouped_warning_summary.general = [
      ...(grouped_warning_summary.general ?? []),
      'Sparse short-form ledger diagnostics are advisory only. Missing long-form structures should render as insufficient evidence / N/A, not as Review Gate failure.',
    ];
  }

  // Evidence location references for all checks with references
  const evidence_location_references: LedgerQualityReportPayload['evidence_location_references'] =
    checks
      .filter((c) => c.evidenceReference)
      .map((c) => ({
        layer: c.layer,
        reference: c.evidenceReference!,
      }));

  // Blocking reasons (hard fails only; short-form warnings must not become trap-door blockers)
  const blocking_reasons: string[] = [
    ...hardFails.map((c) => c.message),
    ...(!allowSparseShortForm
      ? warnings
        .filter((c) => c.key === 'no_pov_detected')
        .map((c) => c.message)
      : []),
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

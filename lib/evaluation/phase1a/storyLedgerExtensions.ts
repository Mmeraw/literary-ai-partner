/**
 * Story Layer / Story Ledger extensions (canon_correction_playbook_v1 v1.3.1).
 *
 * Human-facing product language may call this the Story Ledger, but the
 * canonical code artifact is pass1a_story_layer_v1.
 *
 * pass1a_story_layer_v1 is ONE artifact with eight required layers. The
 * existing canonical layers in storyLayerArtifactWriters.ts are validated by
 * validateStoryLayerPayload().
 *
 * This module defines additive governance payloads described by the corrected
 * playbook. They are intentionally optional in the first runtime wiring pass:
 *   Layer 1   — Structural Lane Map        (story_ledger_lane_map)
 *   Layer 8a  — Coverage Risk Register     (coverage_risk_register)
 *   Layer 8b  — Source Vocabulary Notes    (vocabulary_extraction_note)
 *
 * Empty / missing fields are valid in v1 — runtime emits a warning flag but
 * does not block Phase 2.
 */

// ── Layer 1 — Structural Lane Map ────────────────────────────────────────────

export type StoryLedgerLaneType =
  | 'narrative_drive'
  | 'emotional'
  | 'doctrinal'
  | 'medicine_object'
  | 'relationship'
  | 'environmental';

export type StoryLedgerLaneEvidenceStrength = 'strong' | 'moderate' | 'low';

export interface StoryLedgerLane {
  lane_type: StoryLedgerLaneType;
  name: string;
  key_entities: string[];
  evidence_strength: StoryLedgerLaneEvidenceStrength;
  included: boolean;
  /** Required when included === false. */
  exclusion_reason?: string;
}

// ── Layer 8a — Coverage Risk Register ────────────────────────────────────────

export type StoryLedgerCoverageRiskEntityType =
  | 'character'
  | 'relationship'
  | 'object'
  | 'doctrine'
  | 'system';

export interface StoryLedgerCoverageRisk {
  entity: string;
  entity_type: StoryLedgerCoverageRiskEntityType;
  risk: string;
  evidence_note: string;
}

// ── Layer 8b — Source Vocabulary Notes ───────────────────────────────────────

export interface StoryLedgerVocabNote {
  candidate_label: string;
  source_supported: boolean;
  source_evidence?: string;
  recommended_replacement?: string;
}

// ── Story Layer / Story Ledger extension payload ─────────────────────────────

/**
 * Optional governance fields associated with pass1a_story_layer_v1. All fields
 * are optional; Phase 1A is not hard-blocked when they are missing. A warning
 * flag is set on the job when the lane map is empty (see processor.ts
 * story_ledger_lane_map_warning).
 */
export interface StoryLedgerExtensions {
  story_ledger_lane_map?: StoryLedgerLane[];
  coverage_risk_register?: StoryLedgerCoverageRisk[];
  vocabulary_extraction_note?: StoryLedgerVocabNote[];
}

// ── Recommendation validity (Change 5) ───────────────────────────────────────

export type RecommendationValidity =
  | 'VALID'
  | 'PARTIALLY_VALID'
  | 'ALREADY_PRESENT'
  | 'CANON_FALSE'
  | 'SOURCE_UNSUPPORTED'
  | 'VOICE_RISK';

export const RECOMMENDATION_VALIDITY_VALUES: readonly RecommendationValidity[] = [
  'VALID',
  'PARTIALLY_VALID',
  'ALREADY_PRESENT',
  'CANON_FALSE',
  'SOURCE_UNSUPPORTED',
  'VOICE_RISK',
] as const;

/**
 * Additive recommendation extension — wherever a recommendation type is
 * defined in the codebase it can intersect with this shape to opt into the
 * validity tag without breaking existing recommendation consumers.
 */
export interface RecommendationValidityFields {
  validity?: RecommendationValidity;
}

// ── Narrative Closure invalidation guard (Change 4) ──────────────────────────

export interface ClosureValidationResult {
  score: number;
  invalidated: boolean;
  reason?: string;
}

/**
 * Closure guard: Narrative Closure MUST NOT be treated as a final score if the
 * Relationship Spine Layer is missing or empty. The numeric score is NOT
 * modified — the caller attaches invalidated/reason to the criterion output so
 * downstream UI can surface a warning badge.
 */
export function validateClosureScore(
  closureScore: number,
  relationshipSpineLayer: Array<{ name: string }> | undefined | null,
): ClosureValidationResult {
  if (!relationshipSpineLayer || relationshipSpineLayer.length === 0) {
    return {
      score: closureScore,
      invalidated: true,
      reason:
        'closure_score_unvalidated: relationship_spine_layer missing or empty — score may be deflated due to arc blindness (canon_correction_playbook_v1)',
    };
  }
  return { score: closureScore, invalidated: false };
}

// ── Lane map coverage warning helper (Change 3) ──────────────────────────────

/**
 * True when the lane map is missing or empty. Callers stamp
 * job.metadata.story_ledger_lane_map_warning = true based on this result.
 * Flag only — does not block Phase 2 in v1.
 */
export function shouldFlagStoryLedgerLaneMapWarning(
  extensions: StoryLedgerExtensions | undefined | null,
): boolean {
  if (!extensions) return true;
  const lanes = extensions.story_ledger_lane_map;
  return !lanes || lanes.length === 0;
}

import { CRITERIA_KEYS, type CriterionKey } from '@/schemas/criteria-keys';
import type { EvaluationCriterionV2 } from '@/schemas/evaluation-result-v2';
import { scopePolicy, type ConfidenceCap, type InputScale } from '@/lib/evaluation/signal/scopePolicy';

export type ShortFormEvidenceMode = 'very_sparse' | 'sparse' | 'short_form_standard';
export type ShortFormCriterionStatus = 'scorable' | 'scorable_low_confidence' | 'non_scorable';

export type ShortFormEvidenceGateResult = {
  schema_version: 'short_form_evidence_gate_v1';
  word_count: number;
  mode: ShortFormEvidenceMode;
  criteria: Array<{
    criterion_key: string;
    status: ShortFormCriterionStatus;
    reason_codes: string[];
    anchor_count: number;
    confidence_cap: ConfidenceCap;
    public_note: string;
  }>;
};

const GLOBAL_CLAIM_CRITERIA = new Set<CriterionKey>(['narrativeClosure', 'marketability', 'pacing', 'theme']);

function inputScaleForWordCount(wordCount: number): InputScale {
  if (wordCount < 750) return 'micro_excerpt';
  if (wordCount < 1500) return 'light_chapter';
  if (wordCount < 6000) return 'standard_chapter';
  if (wordCount < 7500) return 'multi_chapter';
  if (wordCount < 20000) return 'novelette';
  return 'novella';
}

export function getShortFormEvidenceMode(wordCount: number): ShortFormEvidenceMode {
  if (wordCount < 750) return 'very_sparse';
  if (wordCount < 1500) return 'sparse';
  return 'short_form_standard';
}

function confidenceCapForShortForm(wordCount: number, base: ConfidenceCap): ConfidenceCap {
  if (wordCount < 750) return 'LOW';
  if (wordCount < 1500 && base === 'HIGH') return 'MODERATE';
  return base;
}

function anchorCount(criterion: Pick<EvaluationCriterionV2, 'evidence'> | undefined): number {
  return Array.isArray(criterion?.evidence)
    ? criterion.evidence.filter((anchor) => typeof anchor.snippet === 'string' && anchor.snippet.trim().length >= 12).length
    : 0;
}

export function runShortFormEvidenceGate(input: {
  wordCount: number;
  criteria?: EvaluationCriterionV2[] | Array<Partial<EvaluationCriterionV2> & { key: string }>;
}): ShortFormEvidenceGateResult {
  const mode = getShortFormEvidenceMode(input.wordCount);
  const scale = inputScaleForWordCount(input.wordCount);
  const byKey = new Map((input.criteria ?? []).map((criterion) => [criterion.key, criterion]));

  return {
    schema_version: 'short_form_evidence_gate_v1',
    word_count: input.wordCount,
    mode,
    criteria: CRITERIA_KEYS.map((criterionKey) => {
      const criterion = byKey.get(criterionKey) as EvaluationCriterionV2 | undefined;
      const policy = scopePolicy(scale, criterionKey);
      const anchors = anchorCount(criterion);
      const reasonCodes: string[] = [];
      const confidenceCap = confidenceCapForShortForm(input.wordCount, policy.confidenceCap);

      if (input.wordCount < 750) reasonCodes.push('SHORT_FORM_TEXT_TOO_SPARSE');
      if (anchors === 0) reasonCodes.push('NO_DIRECT_TEXTUAL_ANCHOR');
      if (policy.plan === 'NA') reasonCodes.push('GLOBAL_MANUSCRIPT_CLAIM_NOT_SUPPORTED');
      if (criterionKey === 'narrativeClosure' && input.wordCount < 1500) reasonCodes.push('ENDING_NOT_PRESENT');
      if (criterionKey === 'character' && input.wordCount < 750) reasonCodes.push('ARC_NOT_OBSERVABLE');
      if (criterionKey === 'marketability' && input.wordCount < 1500) reasonCodes.push('MARKETABILITY_SCOPE_TOO_NARROW');
      if (GLOBAL_CLAIM_CRITERIA.has(criterionKey) && input.wordCount < 25000) reasonCodes.push('CLAIM_SCOPE_LIMITED_TO_EXCERPT');

      const status: ShortFormCriterionStatus =
        policy.plan === 'NA' || anchors === 0 || (input.wordCount < 750 && GLOBAL_CLAIM_CRITERIA.has(criterionKey))
          ? 'non_scorable'
          : confidenceCap === 'LOW'
            ? 'scorable_low_confidence'
            : 'scorable';

      return {
        criterion_key: criterionKey,
        status,
        reason_codes: Array.from(new Set(reasonCodes)),
        anchor_count: anchors,
        confidence_cap: confidenceCap,
        public_note: status === 'non_scorable'
          ? 'Insufficient evidence in the submitted text.'
          : confidenceCap === 'LOW'
            ? 'Confidence is limited because the submitted passage does not include the relevant structural span.'
            : 'Scored from direct submitted-text evidence.',
      };
    }),
  };
}

export function applyShortFormEvidenceGate<T extends EvaluationCriterionV2>(criteria: T[], gate: ShortFormEvidenceGateResult): T[] {
  const byKey = new Map(gate.criteria.map((criterion) => [criterion.criterion_key, criterion]));
  return criteria.map((criterion) => {
    const gated = byKey.get(criterion.key);
    if (!gated) return criterion;
    if (gated.status === 'non_scorable') {
      return {
        ...criterion,
        scorable: false,
        status: criterion.status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'INSUFFICIENT_SIGNAL',
        score_0_10: null,
        confidence_level: 'low',
        confidence_band: 'LOW',
        confidence_score_0_100: Math.min(criterion.confidence_score_0_100 ?? 25, 45),
        scorability_status: 'non_scorable',
        confidence_reasons: Array.from(new Set([...(criterion.confidence_reasons ?? []), ...gated.reason_codes])),
        insufficient_signal_reason: {
          looked_for: ['direct submitted-text evidence'],
          not_found: gated.reason_codes,
        },
      } as T;
    }
    if (gated.confidence_cap === 'LOW' || gated.status === 'scorable_low_confidence') {
      return {
        ...criterion,
        confidence_level: 'low',
        confidence_band: 'LOW',
        confidence_score_0_100: Math.min(criterion.confidence_score_0_100 ?? 59, 59),
        scorability_status: criterion.scorability_status === 'non_scorable' ? 'non_scorable' : 'scorable_low_confidence',
        confidence_reasons: Array.from(new Set([...(criterion.confidence_reasons ?? []), ...gated.reason_codes])),
      } as T;
    }
    return criterion;
  });
}

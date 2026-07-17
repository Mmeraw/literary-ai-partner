import { describe, it, expect } from '@jest/globals';
import {
  BASE_DECISION_LOCAL_REASON_CODES,
  BASE_DECISION_REASON,
  evaluateRecommendationExecutability,
  type RecommendationExecutabilityInput,
} from '../recommendationExecutability';
import {
  COPY_PASTE_ADMISSION_REASON_CODES,
  STRATEGY_ADMISSION_REASON_CODES,
} from '../reviseAdmissionGate';

const safeInput: RecommendationExecutabilityInput = {
  evidencePresent: true,
  contextPresent: true,
  canonClear: true,
  diagnosisSupported: true,
  anchorPrecise: true,
  passageLength: 'moderate',
  beforeAfterContextSufficient: true,
  ledgerConflictPossible: false,
  canonConflict: false,
  affectsSceneArchitecture: false,
  affectsPOVVoiceCanonMetaphor: false,
  downstreamContinuityRisk: false,
  voiceFingerprintStable: true,
  localOperation: true,
  passingCandidateCount: 2,
  candidateProseNarrativeSafe: true,
};

const observed = (input: RecommendationExecutabilityInput) =>
  new Set(evaluateRecommendationExecutability(input).reasons);

describe('recommendationExecutability parity', () => {
  it('emits every base-decision local reason code from at least one fixture', () => {
    const cases: { diff: Partial<RecommendationExecutabilityInput>; expected: string }[] = [
      { diff: { evidencePresent: false }, expected: BASE_DECISION_REASON.EVIDENCE_MISSING },
      { diff: { contextPresent: false }, expected: BASE_DECISION_REASON.CONTEXT_MISSING },
      { diff: { canonClear: false }, expected: BASE_DECISION_REASON.CANON_UNCLEAR },
      { diff: { diagnosisSupported: false }, expected: BASE_DECISION_REASON.DIAGNOSIS_UNSUPPORTED },
      { diff: { anchorPrecise: false }, expected: BASE_DECISION_REASON.ANCHOR_NOT_PRECISE },
      { diff: { passageLength: 'long' }, expected: BASE_DECISION_REASON.PASSAGE_TOO_LONG },
      { diff: { beforeAfterContextSufficient: false }, expected: BASE_DECISION_REASON.INSUFFICIENT_BEFORE_AFTER_CONTEXT },
      { diff: { ledgerConflictPossible: true }, expected: BASE_DECISION_REASON.LEDGER_CONFLICT_POSSIBLE },
      { diff: { canonConflict: true }, expected: BASE_DECISION_REASON.CANON_CONFLICT },
      { diff: { affectsSceneArchitecture: true }, expected: BASE_DECISION_REASON.SCENE_ARCHITECTURE_CHANGE },
      { diff: { affectsPOVVoiceCanonMetaphor: true }, expected: BASE_DECISION_REASON.POV_VOICE_CANON_OR_METAPHOR_RISK },
      { diff: { downstreamContinuityRisk: true }, expected: BASE_DECISION_REASON.DOWNSTREAM_CONTINUITY_RISK },
      { diff: { voiceFingerprintStable: false }, expected: BASE_DECISION_REASON.VOICE_FINGERPRINT_UNSTABLE },
      { diff: { localOperation: false }, expected: BASE_DECISION_REASON.NOT_LOCAL_OPERATION },
      { diff: { copyPasteAdmissionPassed: false }, expected: BASE_DECISION_REASON.COPY_PASTE_ADMISSION_FAILED },
      { diff: { passingCandidateCount: 1 }, expected: BASE_DECISION_REASON.FEWER_THAN_TWO_CANDIDATES_PASSED_QUALITY },
      { diff: { candidateProseNarrativeSafe: false }, expected: BASE_DECISION_REASON.CANDIDATE_PROSE_NOT_NARRATIVELY_SAFE },
      { diff: { passingCandidateCount: 1, strategyAdmissionPassed: false }, expected: BASE_DECISION_REASON.STRATEGY_ADMISSION_FAILED },
    ];

    for (const { diff, expected } of cases) {
      const result = evaluateRecommendationExecutability({ ...safeInput, ...diff });
      expect(result.reasons).toContain(expected);
    }
  });

  it('returns the safe-local copy-paste rewrite reason when no reason is active', () => {
    const result = evaluateRecommendationExecutability(safeInput);
    expect(result.reasons).toEqual([BASE_DECISION_REASON.SAFE_LOCAL_COPY_PASTE_REWRITE]);
  });

  it('carries copy-paste admission passthrough reasons into base decision reasons', () => {
    const passthrough = COPY_PASTE_ADMISSION_REASON_CODES.slice(0, 3);
    const result = evaluateRecommendationExecutability({
      ...safeInput,
      copyPasteAdmissionPassed: false,
      copyPasteAdmissionReasons: passthrough,
    });
    for (const reason of passthrough) {
      expect(result.reasons).toContain(reason);
    }
  });

  it('carries strategy admission passthrough reasons into base decision reasons', () => {
    const passthrough = STRATEGY_ADMISSION_REASON_CODES.slice(0, 3);
    const result = evaluateRecommendationExecutability({
      ...safeInput,
      passingCandidateCount: 1,
      strategyAdmissionPassed: false,
      strategyAdmissionReasons: passthrough,
    });
    for (const reason of [BASE_DECISION_REASON.STRATEGY_ADMISSION_FAILED, ...passthrough]) {
      expect(result.reasons).toContain(reason);
    }
  });

  it('only emits reason codes that are either local base-decision codes or admission passthroughs', () => {
    const allowed = new Set<string>([
      ...BASE_DECISION_LOCAL_REASON_CODES,
      ...COPY_PASTE_ADMISSION_REASON_CODES,
      ...STRATEGY_ADMISSION_REASON_CODES,
    ]);

    const exhaustive = [
      { copyPasteAdmissionPassed: false, copyPasteAdmissionReasons: COPY_PASTE_ADMISSION_REASON_CODES },
      { strategyAdmissionPassed: false, strategyAdmissionReasons: STRATEGY_ADMISSION_REASON_CODES },
      { evidencePresent: false, contextPresent: false, canonClear: false, diagnosisSupported: false },
      {
        anchorPrecise: false,
        passageLength: 'long',
        beforeAfterContextSufficient: false,
        ledgerConflictPossible: true,
        canonConflict: true,
        affectsSceneArchitecture: true,
        affectsPOVVoiceCanonMetaphor: true,
        downstreamContinuityRisk: true,
        voiceFingerprintStable: false,
        localOperation: false,
      },
    ];

    for (const diff of exhaustive) {
      const result = evaluateRecommendationExecutability({ ...safeInput, ...diff });
      for (const reason of result.reasons) {
        expect(allowed.has(reason)).toBe(true);
      }
    }
  });
});

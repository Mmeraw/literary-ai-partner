import {
  getFailureRecoveryDefinition,
  getFailureRecoveryPolicy,
} from '../../../lib/governance/failureRecoveryPolicy';
import {
  isKickEligibleFailureCode,
  isKickEligibleV2CheckId,
  isTerminalFailureCode,
  maxSelfRecoveryAttemptsForFailureCode,
} from '../../../lib/evaluation/processor';

describe('processor runtime governance flow', () => {
  const logOnlyCodes = ['QG_GENERIC_REC', 'QG_DUPLICATE_REC'] as const;

  test.each(logOnlyCodes)('%s remains passive at runtime: no terminal block, no kick, no retry', (failureCode) => {
    const policy = getFailureRecoveryPolicy({ failureCode, hasKick: false });

    expect(policy.mode).toBe('log_only');
    expect(policy.retryLimit).toBe(0);
    expect(policy.checkpointArtifact).toBeNull();
    expect(isTerminalFailureCode(failureCode)).toBe(false);
    expect(isKickEligibleFailureCode(failureCode)).toBe(false);
    expect(maxSelfRecoveryAttemptsForFailureCode(failureCode)).toBe(0);
  });

  test('QualityGateV2 emitted failure codes have explicit recovery definitions', () => {
    const v2FailureCodes = [
      'QG_ARTIFACT_GATE_FAIL',
      'QG_CONSEQUENCE_CONTRACT',
      'QG_CRITERIA_MISSING',
      'QG_CRITERIA_SCOPE_SHAPE_MISMATCH',
      'QG_FIDELITY_SCORE_CONFIDENCE_MISMATCH',
      'QG_MISSING_REQUIRED_EVIDENCE',
      'QG_PROPAGATION_INTEGRITY',
      'QG_SCORE_RANGE',
      'QG_SUMMARY_OMITS_WEAKNESS',
    ];

    for (const failureCode of v2FailureCodes) {
      expect(getFailureRecoveryDefinition(failureCode)).toBeDefined();
    }
  });

  test('processor kick eligibility follows rollback policy, not legacy QG prefix rules', () => {
    const expectations: Array<[string, boolean]> = [
      ['QG_ARTIFACT_GATE_FAIL', true],
      ['QG_CONSEQUENCE_CONTRACT', true],
      ['QG_MISSING_REQUIRED_EVIDENCE', true],
      ['QG_SUMMARY_OMITS_WEAKNESS', true],
      ['QG_CRITERIA_MISSING', false],
      ['QG_CRITERIA_SCOPE_SHAPE_MISMATCH', false],
      ['QG_FIDELITY_SCORE_CONFIDENCE_MISMATCH', false],
      ['QG_PROPAGATION_INTEGRITY', false],
      ['QG_SCORE_RANGE', false],
    ];

    for (const [failureCode, kickEligible] of expectations) {
      expect(isKickEligibleFailureCode(failureCode)).toBe(kickEligible);
      expect(isTerminalFailureCode(failureCode)).toBe(!kickEligible);
    }
  });

  test('soft downgrade fidelity alignment never triggers a backward kick by check id', () => {
    expect(isKickEligibleV2CheckId('v2_fidelity_score_confidence_alignment')).toBe(false);
  });

  test('V2 repairable check ids remain bounded to one rollback attempt', () => {
    for (const checkId of [
      'v2_summary_weakness_presence',
      'v2_scored_anchor_threshold',
      'v2_completeness_bridge',
    ]) {
      expect(isKickEligibleV2CheckId(checkId)).toBe(true);
    }

    expect(maxSelfRecoveryAttemptsForFailureCode('QG_SUMMARY_OMITS_WEAKNESS')).toBe(1);
    expect(maxSelfRecoveryAttemptsForFailureCode('QG_MISSING_REQUIRED_EVIDENCE')).toBe(1);
    expect(maxSelfRecoveryAttemptsForFailureCode('QG_CONSEQUENCE_CONTRACT')).toBe(1);
  });
});
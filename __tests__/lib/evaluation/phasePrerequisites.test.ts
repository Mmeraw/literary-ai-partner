import {
  classifyEvidenceCoveragePrerequisite,
  classifyPhase0Prerequisite,
  evaluatePhase1aPrerequisites,
  evaluatePhase2Prerequisites,
  evaluatePhase3Prerequisites,
  resolveEvaluationRoute,
} from '../../../lib/evaluation/phasePrerequisites';

const completePhase0 = {
  phase0_completed_at: '2026-06-05T01:00:00.000Z',
  phase0_total_duration_ms: 12_500,
  phase0_calibration_word_count: 650,
};

const validSeedArtifacts = [
  { artifact_type: 'story_map_seed_v1', content: { schema_valid: true, semantic_status: 'valid' } },
  { artifact_type: 'evaluation_seed_v1', content: { schema_valid: true, semantic_status: 'valid' } },
];

const healthyLongFormCoverage = {
  coveragePercent: 99.8,
  criticalGapPresent: false,
};

describe('phase prerequisite contract', () => {
  test('blocks when Phase 0 did not complete', () => {
    const check = classifyPhase0Prerequisite({});
    expect(check.status).toBe('missing');
    expect(check.code).toBe('PHASE_0_MISSING');
  });

  test('blocks when Phase 0 calibration dwell is too short', () => {
    const check = classifyPhase0Prerequisite({
      phase0_completed_at: '2026-06-05T01:00:00.000Z',
      phase0_total_duration_ms: 1_000,
      phase0_calibration_word_count: 650,
    });
    expect(check.status).toBe('blocked');
    expect(check.code).toBe('PHASE_0_DWELL_INCOMPLETE');
  });

  test('allows short-form Phase 1A when Phase 0 and both 0.5A seeds are valid', () => {
    const decision = evaluatePhase1aPrerequisites({
      progress: completePhase0,
      artifacts: validSeedArtifacts,
      route: 'short_form',
    });

    expect(decision.ok).toBe(true);
    expect(decision.checks.find((check) => check.name === 'seed_0_5b_dream')?.status).toBe('skipped');
  });

  test('blocks short-form Phase 1A when either 0.5A seed is missing', () => {
    const decision = evaluatePhase1aPrerequisites({
      progress: completePhase0,
      artifacts: [{ artifact_type: 'story_map_seed_v1', content: { schema_valid: true, semantic_status: 'valid' } }],
      route: 'short_form',
    });

    expect(decision.ok).toBe(false);
    expect(decision.blockingCodes).toContain('SEED_0_5A_EVALUATION_MISSING');
  });

  test('blocks long-form Phase 1A when DREAM 0.5B is missing', () => {
    const decision = evaluatePhase1aPrerequisites({
      progress: completePhase0,
      artifacts: validSeedArtifacts,
      route: 'long_form',
      coverage: healthyLongFormCoverage,
    });

    expect(decision.ok).toBe(false);
    expect(decision.blockingCodes).toContain('SEED_0_5B_DREAM_MISSING');
  });

  test('blocks long-form Phase 1A when DREAM 0.5B is degraded', () => {
    const decision = evaluatePhase1aPrerequisites({
      progress: completePhase0,
      artifacts: [
        ...validSeedArtifacts,
        { artifact_type: 'editorial_dream_seed_v1', content: { schema_valid: true, semantic_status: 'degraded_with_reasons' } },
      ],
      route: 'long_form',
      coverage: healthyLongFormCoverage,
      allowDegradedSeeds: true,
    });

    expect(decision.ok).toBe(false);
    expect(decision.blockingCodes).toContain('SEED_0_5B_DREAM_DEGRADED_BLOCKED');
  });

  test('allows explicitly permitted degraded 0.5A seeds', () => {
    const decision = evaluatePhase1aPrerequisites({
      progress: completePhase0,
      artifacts: [
        { artifact_type: 'story_map_seed_v1', content: { schema_valid: true, semantic_status: 'degraded_with_reasons' } },
        { artifact_type: 'evaluation_seed_v1', content: { schema_valid: true, semantic_status: 'degraded_with_reasons' } },
      ],
      route: 'short_form',
      allowDegradedSeeds: true,
    });

    expect(decision.ok).toBe(true);
    expect(decision.checks.filter((check) => check.status === 'degraded_allowed')).toHaveLength(2);
  });

  test('requires long-form evidence coverage before Phase 1A', () => {
    const decision = evaluatePhase1aPrerequisites({
      progress: completePhase0,
      artifacts: [
        ...validSeedArtifacts,
        { artifact_type: 'editorial_dream_seed_v1', content: { schema_valid: true, semantic_status: 'valid' } },
      ],
      route: 'long_form',
    });

    expect(decision.ok).toBe(false);
    expect(decision.blockingCodes).toContain('MANUSCRIPT_COVERAGE_MISSING');
  });

  test('blocks long-form coverage below 98 percent', () => {
    const check = classifyEvidenceCoveragePrerequisite({
      route: 'long_form',
      coverage: { coveragePercent: 97.9, criticalGapPresent: false },
    });

    expect(check.status).toBe('blocked');
    expect(check.code).toBe('MANUSCRIPT_COVERAGE_BELOW_MINIMUM');
  });

  test('blocks long-form coverage below 99.5 percent until deterministic review says safe', () => {
    const check = classifyEvidenceCoveragePrerequisite({
      route: 'long_form',
      coverage: { coveragePercent: 99, criticalGapPresent: false },
    });

    expect(check.status).toBe('blocked');
    expect(check.code).toBe('MANUSCRIPT_COVERAGE_REVIEW_REQUIRED');
  });

  test('allows degraded-safe long-form coverage after deterministic review', () => {
    const check = classifyEvidenceCoveragePrerequisite({
      route: 'long_form',
      coverage: { coveragePercent: 99, criticalGapPresent: false, deterministicReviewSafe: true },
    });

    expect(check.status).toBe('degraded_allowed');
    expect(check.code).toBe('MANUSCRIPT_COVERAGE_DEGRADED_ALLOWED');
  });

  test('blocks any critical long-form coverage gap', () => {
    const check = classifyEvidenceCoveragePrerequisite({
      route: 'long_form',
      coverage: {
        coveragePercent: 99.9,
        criticalGapPresent: true,
        missingSpanLabels: ['ending', 'protagonist arc turn'],
      },
    });

    expect(check.status).toBe('blocked');
    expect(check.code).toBe('MANUSCRIPT_COVERAGE_CRITICAL_GAP');
  });

  test('blocks Phase 2 when Phase 1A story layer is missing', () => {
    const decision = evaluatePhase2Prerequisites({
      artifacts: [{ artifact_type: 'ledger_quality_report_v1', content: { schema_valid: true, semantic_status: 'valid' } }],
      route: 'long_form',
    });

    expect(decision.ok).toBe(false);
    expect(decision.blockingCodes).toContain('PHASE_1A_STORY_LAYER_MISSING');
  });

  test('blocks Phase 3 when Phase 2 handoff is missing', () => {
    const decision = evaluatePhase3Prerequisites({ artifacts: [] });
    expect(decision.ok).toBe(false);
    expect(decision.blockingCodes).toContain('PHASE_2_HANDOFF_MISSING');
  });

  test('resolves route from report type and manuscript length', () => {
    expect(resolveEvaluationRoute({ reportType: 'Short-Form Evaluation Report' })).toBe('short_form');
    expect(resolveEvaluationRoute({ manuscriptWordCount: 200_000 })).toBe('long_form');
    expect(resolveEvaluationRoute({ reportType: 'Long-Form Multi-Layer Evaluation Report' })).toBe('long_form_multi_layer');
  });
});

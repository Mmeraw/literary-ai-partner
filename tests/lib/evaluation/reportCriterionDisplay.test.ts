import {
  getCertifiedCriteriaSummary,
  getCriterionPrimaryBadge,
  getCriterionSupportLabel,
  isCertifiedCriterion,
  sanitizeRenderData,
  type RenderableCriterion,
} from '@/lib/evaluation/reportCriterionDisplay';

describe('reportCriterionDisplay helpers', () => {
  test('non-certified criterion renders Score not certified without numeric badge', () => {
    const criterion: RenderableCriterion = {
      status: 'INSUFFICIENT_SIGNAL',
      score_0_10: null,
      scorable: false,
      insufficient_signal_reason: {
        looked_for: ['CERTIFIED_ANCHORS_FOR_HIGH_CONFIDENCE_SCORING'],
        not_found: ['LOW_CONFIDENCE_HIGH_SCORE_WITHOUT_CERTIFIED_ANCHORS'],
      },
    };

    expect(isCertifiedCriterion(criterion)).toBe(false);
    expect(getCriterionPrimaryBadge(criterion)).toEqual(
      expect.objectContaining({
        label: 'Score not certified',
        numeric: false,
      }),
    );
    expect(getCriterionPrimaryBadge(criterion).label).not.toContain('/ 10');
    expect(getCriterionSupportLabel(criterion)).toBe(
      'Score not certified — insufficient evidence anchoring',
    );
  });

  test('certified-count summary is correct', () => {
    const criteria: RenderableCriterion[] = [
      { status: 'SCORABLE', score_0_10: 7, scorable: true },
      { status: 'SCORABLE', score_0_10: 8, scorable: true },
      { status: 'INSUFFICIENT_SIGNAL', score_0_10: null, scorable: false },
    ];

    expect(getCertifiedCriteriaSummary(criteria)).toBe('2 of 3 criteria certified');
  });

  test('scorable criteria still render numeric score normally', () => {
    const criterion: RenderableCriterion = {
      status: 'SCORABLE',
      score_0_10: 7,
      scorable: true,
    };

    expect(getCriterionPrimaryBadge(criterion)).toEqual(
      expect.objectContaining({
        label: '7 / 10',
        numeric: true,
      }),
    );
    expect(getCriterionSupportLabel(criterion)).toBeNull();
  });

  test('audit-only score is suppressed from rendered/debug data', () => {
    const sanitized = sanitizeRenderData({
      criteria: [
        {
          key: 'proseControl',
          status: 'INSUFFICIENT_SIGNAL',
          score_0_10: null,
          model_emitted_score_unverified: 7,
          nested: {
            model_emitted_score_unverified: 9,
          },
        },
      ],
    });

    expect(JSON.stringify(sanitized)).not.toContain('model_emitted_score_unverified');
    expect(JSON.stringify(sanitized)).not.toContain('9');
  });

  test('NO_SIGNAL criteria surface explicit non-certified support label', () => {
    const criterion: RenderableCriterion = {
      status: 'NO_SIGNAL',
      score_0_10: null,
      scorable: false,
    };

    expect(getCriterionSupportLabel(criterion)).toBe(
      'Score not certified — no observable evidence',
    );
  });
});

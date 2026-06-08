import {
  getCertifiedCriteriaSummary,
  getCriterionPrimaryBadge,
  getCriterionSupportLabel,
  isCertifiedCriterion,
} from '@/lib/evaluation/reportCriterionDisplay';

describe('reportCriterionDisplay', () => {
  test('does not count scorable criteria as scored when the numeric score is missing', () => {
    const criteria = [
      { scorable: true, score_0_10: 7 },
      { scorable: true, score_0_10: null },
    ];

    expect(isCertifiedCriterion(criteria[0])).toBe(true);
    expect(isCertifiedCriterion(criteria[1])).toBe(false);
    expect(getCertifiedCriteriaSummary(criteria)).toBe(
      '1 of 2 criteria scored — 1 marked Not scorable; confidence varies per criterion (see badges below)',
    );
    expect(getCriterionPrimaryBadge(criteria[1])).toMatchObject({
      label: 'Not scorable',
      numeric: false,
    });
    expect(getCriterionSupportLabel(criteria[1])).toBe(
      'Score omitted — insufficient confidence in what the submitted text presented for this criterion',
    );
  });
});

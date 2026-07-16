import {
  OPPORTUNITY_DISCOVERY_POLICY,
  buildOpportunityDiscoveryPromptBlock,
  getOpportunityScoreGuidance,
  getProductOpportunityCeiling,
  getShortFormPerCriterionCeiling,
  hasGovernedOpportunityCoverage,
  isOpportunitySourceAllowed,
} from '@/lib/evaluation/policy/opportunityDiscoveryPolicy';

describe('opportunityDiscoveryPolicy', () => {
  it('treats product counts as ceilings with Short Form below Long Form', () => {
    expect(getProductOpportunityCeiling('short_form')).toBe(50);
    expect(getProductOpportunityCeiling('long_form_multi_layer')).toBe(100);
  });

  it('allows editorial-only discovery in Short Form and WAVE discovery only in Long Form', () => {
    expect(isOpportunitySourceAllowed('short_form', 'editorial')).toBe(true);
    expect(isOpportunitySourceAllowed('short_form', 'wave')).toBe(false);
    expect(isOpportunitySourceAllowed('short_form', 'cross_wave')).toBe(false);
    expect(isOpportunitySourceAllowed('long_form_multi_layer', 'wave')).toBe(true);
    expect(isOpportunitySourceAllowed('long_form_multi_layer', 'cross_wave')).toBe(true);
  });

  it('does not require two recommendations for a 9/10 criterion', () => {
    expect(getOpportunityScoreGuidance('short_form', 9)).toMatchObject({
      expectedMin: 0,
      expectedMax: 1,
      hardMinimum: 0,
    });
    expect(getOpportunityScoreGuidance('long_form_multi_layer', 9)).toMatchObject({
      expectedMin: 0,
      expectedMax: 2,
      hardMinimum: 0,
    });
  });

  it('does not require a recommendation for a 10/10 criterion', () => {
    expect(getOpportunityScoreGuidance('short_form', 10).hardMinimum).toBe(0);
    expect(getOpportunityScoreGuidance('long_form_multi_layer', 10).hardMinimum).toBe(0);
  });

  it('caps very short Short-Form criteria at one opportunity', () => {
    expect(getShortFormPerCriterionCeiling(200)).toBe(1);
    expect(getShortFormPerCriterionCeiling(499)).toBe(1);
    expect(getShortFormPerCriterionCeiling(1_500)).toBe(2);
    expect(getShortFormPerCriterionCeiling(4_999)).toBe(3);
    expect(getShortFormPerCriterionCeiling(5_000)).toBe(4);
  });

  it('accepts governed zero-opportunity coverage for a high-scoring criterion', () => {
    expect(hasGovernedOpportunityCoverage({
      score: 9,
      meaningfulOpportunityCount: 0,
      recommendationStatus: 'no_recommendation_warranted',
      recommendationStatusRationale: 'The criterion is already publication-ready and no distinct evidence-backed revision is warranted.',
    })).toBe(true);
  });

  it('rejects silent empty coverage for a weak criterion', () => {
    expect(hasGovernedOpportunityCoverage({
      score: 6,
      meaningfulOpportunityCount: 0,
    })).toBe(false);
  });

  it('accepts explicit insufficient-evidence coverage without fabricated advice', () => {
    expect(hasGovernedOpportunityCoverage({
      score: 6,
      meaningfulOpportunityCount: 0,
      recommendationStatus: 'insufficient_evidence',
      recommendationStatusRationale: 'The submitted passage is too brief to support a distinct and safe mechanism-level recommendation.',
    })).toBe(true);
  });

  it('emits prompt text that forbids quota filling', () => {
    const prompt = buildOpportunityDiscoveryPromptBlock('short_form');
    expect(prompt).toContain('discoveries, not quotas');
    expect(prompt).toContain('Product ceiling: 50');
    expect(prompt).toContain('Short Form must never receive WAVE');
    expect(prompt).not.toContain('25–50');
  });

  it('keeps the authority path stable for agents and governance tooling', () => {
    expect(OPPORTUNITY_DISCOVERY_POLICY.authorityDocument)
      .toBe('docs/governance/OPPORTUNITY_DISCOVERY_POLICY.md');
  });
});

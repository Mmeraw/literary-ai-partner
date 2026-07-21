import {
  OPPORTUNITY_DISCOVERY_POLICY,
  RECOMMENDATION_STATUS_CONTRACT,
  analyzeGovernedOpportunityCoverage,
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

  it('keeps legacy outputs readable when their pre-contract shape is unambiguous', () => {
    expect(hasGovernedOpportunityCoverage({
      score: 6,
      meaningfulOpportunityCount: 1,
    })).toBe(true);
    expect(hasGovernedOpportunityCoverage({
      score: 9,
      meaningfulOpportunityCount: 0,
    })).toBe(true);
  });

  it('accepts explicit insufficient-evidence coverage without fabricated advice', () => {
    expect(hasGovernedOpportunityCoverage({
      score: 6,
      meaningfulOpportunityCount: 0,
      recommendationStatus: 'insufficient_evidence',
      recommendationStatusRationale: 'The submitted passage is too brief to support a distinct and safe mechanism-level recommendation.',
    })).toBe(true);
  });

  it('keeps diagnostic confidence and evidence outside disposition authority', () => {
    const base = {
      score: 6,
      meaningfulOpportunityCount: 0,
      recommendationStatus: 'insufficient_evidence',
      recommendationStatusRationale: 'The diagnosis is supported, but a safe and specific intervention is not supported.',
    } as const;
    const highDiagnosticConfidence = { ...base, confidenceLevel: 'high', evidenceCount: 3 };
    const lowDiagnosticConfidence = { ...base, confidenceLevel: 'low', evidenceCount: 0 };

    expect(analyzeGovernedOpportunityCoverage(highDiagnosticConfidence))
      .toEqual(analyzeGovernedOpportunityCoverage(lowDiagnosticConfidence));
    expect(hasGovernedOpportunityCoverage(base)).toBe(true);
  });

  it.each([
    'insufficient_evidence',
    'gate_suppressed_no_safe_recommendation',
    'no_recommendation_warranted',
  ] as const)('rejects recommendation/status cardinality mismatch for %s', (recommendationStatus) => {
    const analysis = analyzeGovernedOpportunityCoverage({
      score: 6,
      meaningfulOpportunityCount: 1,
      recommendationStatus,
      recommendationStatusRationale: 'This explicit zero-opportunity status contradicts the emitted recommendation.',
    });

    expect(analysis.covered).toBe(false);
    expect(analysis.issues).toContain('recommendation_status_cardinality_mismatch');
  });

  it('rejects recommendation_provided when no recommendation exists', () => {
    expect(analyzeGovernedOpportunityCoverage({
      score: 6,
      meaningfulOpportunityCount: 0,
      recommendationStatus: 'recommendation_provided',
    })).toMatchObject({
      covered: false,
      issues: expect.arrayContaining(['recommendation_status_cardinality_mismatch']),
    });
  });

  it('fails closed on unknown explicit status', () => {
    expect(analyzeGovernedOpportunityCoverage({
      score: 9,
      meaningfulOpportunityCount: 0,
      recommendationStatus: 'future_status',
      recommendationStatusRationale: 'An unknown explicit status cannot be treated as legacy authority.',
    })).toMatchObject({
      covered: false,
      issues: expect.arrayContaining(['invalid_recommendation_status']),
    });
  });

  it('defines status cardinality in one authoritative table', () => {
    expect(RECOMMENDATION_STATUS_CONTRACT.recommendation_provided).toEqual({
      recommendationsAllowed: true,
      zeroRecommendationsAllowed: false,
      rationaleRequired: false,
      invalidCombinationRecovery: 'pass3_once',
    });
    expect(RECOMMENDATION_STATUS_CONTRACT.insufficient_evidence).toEqual({
      recommendationsAllowed: false,
      zeroRecommendationsAllowed: true,
      rationaleRequired: true,
      invalidCombinationRecovery: 'pass3_once',
    });
    expect(Object.keys(RECOMMENDATION_STATUS_CONTRACT).sort())
      .toEqual([...OPPORTUNITY_DISCOVERY_POLICY.governedStatuses].sort());
    expect(Object.values(RECOMMENDATION_STATUS_CONTRACT).every(
      (contract) => contract.invalidCombinationRecovery === 'pass3_once',
    )).toBe(true);
  });

  it('emits prompt text that forbids quota filling', () => {
    const prompt = buildOpportunityDiscoveryPromptBlock('short_form');
    expect(prompt).toContain('discoveries, not quotas');
    expect(prompt).toContain('Product ceiling: 50');
    expect(prompt).toContain('Short Form must never receive WAVE');
    expect(prompt).toContain('diagnostic support, not confidence that a safe intervention can be prescribed');
    expect(prompt).toContain('do not emit contradictory status/cardinality metadata');
    expect(prompt).not.toContain('25–50');
  });

  it('keeps the authority path stable for agents and governance tooling', () => {
    expect(OPPORTUNITY_DISCOVERY_POLICY.authorityDocument)
      .toBe('docs/governance/OPPORTUNITY_DISCOVERY_POLICY.md');
  });
});

import {
  buildCanonicalOpportunityLedger,
  formatOpportunityForTopRecommendation,
  opportunityToCriterionRecommendation,
} from '@/lib/evaluation/canonicalOpportunityLedger';
import { normalizeEvaluationReportViewModel } from '@/lib/evaluation/evaluationReportViewModel';
import { buildUnifiedEvaluationDocument } from '@/lib/evaluation/unifiedEvaluationDocument';
import type { ShortFormResultLike } from '@/lib/evaluation/shortFormReportDocument';
import { isUnifiedEvaluationDocument } from '@/lib/evaluation/persistedUnifiedEvaluationDocument';

function buildResultWithDuplicateOpportunities(): ShortFormResultLike {
  return {
    generated_at: '2026-07-06T00:00:00.000Z',
    overview: {
      overall_score_0_100: 82,
      verdict: 'Near Market Ready',
      one_paragraph_summary: 'The sample has a strong premise but repeats one stakes problem.',
      top_3_strengths: ['Clear central conflict.'],
      top_3_risks: ['The midpoint stakes remain abstract.'],
    },
    metrics: {
      manuscript: {
        title: 'Duplicate Test',
        word_count: 12_000,
        genre: 'Suspense',
        target_audience: 'Adult suspense readers',
      },
    },
    enrichment: {
      premise: 'A protagonist faces a narrowing deadline.',
      trigger_warnings: [],
      diagnosed_genre: 'Suspense',
    },
    criteria: [
      {
        key: 'narrativeDrive',
        score_0_10: 7,
        confidence_level: 'high',
        rationale: 'The scene has momentum but the danger remains broad.',
        recommendations: [
          {
            priority: 'high',
            action: 'Make the midpoint deadline concrete.',
            expected_impact: 'Readers understand what is lost if the protagonist waits.',
            anchor_snippet: 'Mara watched the road until the last truck vanished beyond the bridge.',
            symptom: 'The midpoint scene has energy but no concrete deadline.',
            mechanism: 'The scene stakes are abstract rather than time-bound.',
            specific_fix: 'Insert a concrete deadline and visible consequence into the midpoint scene.',
            reader_effect: 'Readers understand what is lost if the protagonist waits.',
            manuscript_coordinates: 'Chapter 4 midpoint scene',
          },
        ],
      },
      {
        key: 'stakesPressure',
        score_0_10: 7,
        confidence_level: 'high',
        rationale: 'The same midpoint pressure is diagnosed through stakes.',
        recommendations: [
          {
            priority: 'medium',
            action: 'Clarify the midpoint deadline for the reader.',
            expected_impact: 'Readers understand what is lost if the protagonist waits.',
            anchor_snippet: 'The bridge lights flickered while Mara waited for the signal.',
            symptom: 'The midpoint scene repeats pressure without a deadline.',
            mechanism: 'The scene stakes are abstract rather than time-bound.',
            specific_fix: 'Insert a concrete deadline and visible consequence into the midpoint scene.',
            reader_effect: 'Readers understand what is lost if the protagonist waits.',
            manuscript_coordinates: 'Chapter 4 midpoint scene',
          },
        ],
      },
    ],
  } as ShortFormResultLike;
}

describe('canonical opportunity duplicate collapse', () => {
  it('records one governed disposition for every source recommendation, including held and informational advice', () => {
    const result = buildResultWithDuplicateOpportunities();
    result.criteria![0]!.recommendations!.push(
      { action: 'Clarify the transition.', anchor_snippet: 'Premise remains abstract.' },
      { expected_impact: 'Background observation only.' },
    );

    const ledger = buildCanonicalOpportunityLedger(result);

    expect(ledger.disposition_contract_version).toBe('recommendation_disposition_v1');
    expect(ledger.recommendation_dispositions).toHaveLength(4);
    expect(ledger.metrics.source_recommendation_count).toBe(4);
    expect(ledger.metrics.disposition_count).toBe(4);
    expect(ledger.metrics.disposition_coverage_ratio).toBe(1);
    expect(ledger.metrics.disposition_counts).toEqual({
      admitted: 2,
      held_recoverable: 0,
      suppressed_governed: 1,
      informational_non_actionable: 1,
    });
    expect(ledger.metrics.validation_counts).toEqual({
      accepted: 2,
      missing_revision_directive: 1,
      missing_verifiable_anchor: 1,
    });
    expect(ledger.metrics.governing_rule_counts).toEqual({
      canonical_opportunity_admission: 2,
      no_revision_directive: 1,
      verifiable_manuscript_anchor_required: 1,
    });
    expect(ledger.metrics.admitted_authority_count).toBe(2);
    expect(ledger.metrics.admitted_authority_coverage_ratio).toBe(1);
    expect(ledger.metrics.post_canonicalization_suppression_count).toBe(0);
    expect(ledger.metrics.criterion_disposition_counts).toEqual({
      narrativeDrive: {
        source_count: 3,
        admitted: 1,
        held_recoverable: 0,
        suppressed_governed: 1,
        informational_non_actionable: 1,
      },
      stakesPressure: {
        source_count: 1,
        admitted: 1,
        held_recoverable: 0,
        suppressed_governed: 0,
        informational_non_actionable: 0,
      },
    });
    expect(ledger.recommendation_dispositions.map((item) => item.disposition)).toEqual(
      expect.arrayContaining(['admitted', 'suppressed_governed', 'informational_non_actionable']),
    );
    expect(ledger.recommendation_dispositions.filter((item) => item.disposition === 'admitted'))
      .toEqual(expect.arrayContaining([expect.objectContaining({ canonical_opportunity_id: expect.stringMatching(/^OPP-/) })]));
    const suppressed = ledger.recommendation_dispositions.find((item) => item.disposition === 'suppressed_governed');
    expect(suppressed?.canonical_opportunity_id).toBeUndefined();
    expect(ledger.opportunities.some((item) => item.deduped_from.includes(suppressed?.source_id ?? ''))).toBe(false);
  });

  it('reports zero-source and all-suppressed outcomes without inventing queue authority', () => {
    const empty = buildCanonicalOpportunityLedger({ criteria: [] });
    expect(empty.metrics.disposition_counts).toEqual({
      admitted: 0,
      held_recoverable: 0,
      suppressed_governed: 0,
      informational_non_actionable: 0,
    });
    expect(empty.metrics.admitted_authority_coverage_ratio).toBe(1);

    const suppressedResult = buildResultWithDuplicateOpportunities();
    for (const criterion of suppressedResult.criteria ?? []) {
      for (const recommendation of criterion.recommendations ?? []) {
        recommendation.anchor_snippet = '';
      }
    }
    const suppressed = buildCanonicalOpportunityLedger(suppressedResult);
    expect(suppressed.opportunities).toEqual([]);
    expect(suppressed.metrics.disposition_counts.suppressed_governed).toBe(2);
    expect(suppressed.metrics.admitted_authority_count).toBe(0);
    expect(suppressed.metrics.admitted_authority_coverage_ratio).toBe(1);
    expect(suppressed.metrics.governing_rule_counts).toEqual({
      verifiable_manuscript_anchor_required: 2,
    });
  });

  it('derives stable content identities independent of recommendation ordering', () => {
    const first = buildResultWithDuplicateOpportunities();
    first.criteria![0]!.recommendations!.push({
      action: 'Compress the setup before the bridge scene.',
      anchor_snippet: 'Mara folded the map and returned it to the drawer.',
      specific_fix: 'Remove the repeated setup beat before the bridge scene.',
    });
    const reordered = JSON.parse(JSON.stringify(first)) as ShortFormResultLike;
    reordered.criteria![0]!.recommendations!.reverse();

    const originalIds = buildCanonicalOpportunityLedger(first).source_recommendation_ids.slice().sort();
    const reorderedIds = buildCanonicalOpportunityLedger(reordered).source_recommendation_ids.slice().sort();

    expect(reorderedIds).toEqual(originalIds);
    expect(originalIds.every((id) => /^[^:]+:[a-f0-9]{20}:[1-9]\d*$/.test(id))).toBe(true);
  });

  it('formats top recommendation criterion citations without raw internal keys', () => {
    const baseOpportunity = {
      id: 'OPP-001',
      related_criteria: [],
      severity: 'medium' as const,
      evidence: 'Mara watched the road until the last truck vanished beyond the bridge.',
      location: 'Chapter 4 midpoint scene',
      symptom: 'The scene pressure remains abstract.',
      cause: 'The stakes are named without a concrete consequence.',
      fix_direction: 'Make the midpoint deadline concrete.',
      reader_effect: 'Readers understand what is lost if the protagonist waits.',
      deduped_from: [],
      is_action_item_candidate: true,
      issue_type: 'scene_stakes',
      action: 'Make the midpoint deadline concrete.',
      expected_impact: 'Readers understand what is lost if the protagonist waits.',
    };

    expect(formatOpportunityForTopRecommendation({
      ...baseOpportunity,
      primary_criterion: 'narrativeDrive',
    })).toContain('(Narrative Drive & Momentum).');
    expect(formatOpportunityForTopRecommendation({
      ...baseOpportunity,
      primary_criterion: 'characterization',
    })).toContain('(Characterization).');
    expect(formatOpportunityForTopRecommendation({
      ...baseOpportunity,
      primary_criterion: 'character_depth',
    })).toContain('(Character Depth).');

    const fallbackCamelCase = formatOpportunityForTopRecommendation({
      ...baseOpportunity,
      primary_criterion: 'stakesPressure',
    });

    expect(fallbackCamelCase).toContain('(Stakes Pressure).');
    expect(fallbackCamelCase).not.toContain('(stakesPressure).');
  });

  it('collapses same cause + fix/effect + region before UED/ViewModel normalization', () => {
    const result = buildResultWithDuplicateOpportunities();
    const ledger = buildCanonicalOpportunityLedger(result);

    expect(ledger.metrics.raw_opportunity_count).toBe(2);
    expect(ledger.metrics.canonical_opportunity_count).toBe(1);
    expect(ledger.metrics.duplicate_clusters).toBe(1);
    expect(ledger.opportunities[0].related_criteria).toEqual(expect.arrayContaining([
      'narrativeDrive',
      'stakesPressure',
    ]));

    const ued = buildUnifiedEvaluationDocument({
      mode: 'short_form_evaluation',
      result,
      displayTitle: 'Duplicate Test',
      dream: null,
    });
    const vm = normalizeEvaluationReportViewModel({ ued });
    const renderedRecommendations = vm.criterionDetails.flatMap((detail) => detail.recommendations);
    const renderedOpportunityIds = new Set(renderedRecommendations.map((rec) => rec.opportunity_id));

    expect(vm.revisionOpportunitySummary.total).toBe(1);
    expect(renderedOpportunityIds).toEqual(new Set(['OPP-001']));
    expect(isUnifiedEvaluationDocument(ued)).toBe(true);

    const unknownVersion = JSON.parse(JSON.stringify(ued));
    unknownVersion.canonicalOpportunityLedger.disposition_contract_version = 'recommendation_disposition_v2';
    expect(isUnifiedEvaluationDocument(unknownVersion)).toBe(false);

    const unknownForensicsVersion = JSON.parse(JSON.stringify(ued));
    unknownForensicsVersion.canonicalOpportunityLedger.forensics_contract_version = 'recommendation_suppression_forensics_v2';
    expect(isUnifiedEvaluationDocument(unknownForensicsVersion)).toBe(false);

    const malformedSourceIds = JSON.parse(JSON.stringify(ued));
    malformedSourceIds.canonicalOpportunityLedger.source_recommendation_ids = [42];
    expect(isUnifiedEvaluationDocument(malformedSourceIds)).toBe(false);

    const legacy = JSON.parse(JSON.stringify(ued));
    delete legacy.canonicalOpportunityLedger.disposition_contract_version;
    delete legacy.canonicalOpportunityLedger.source_identity_version;
    delete legacy.canonicalOpportunityLedger.source_recommendation_ids;
    delete legacy.canonicalOpportunityLedger.recommendation_dispositions;
    delete legacy.canonicalOpportunityLedger.forensics_contract_version;
    expect(isUnifiedEvaluationDocument(legacy)).toBe(true);
  });
});

describe('canonical opportunity anchor_type propagation', () => {
  function resultWithEvidence(evidence: string, anchorType?: string): ShortFormResultLike {
    return {
      generated_at: '2026-07-16T00:00:00.000Z',
      overview: {
        overall_score_0_100: 80,
        verdict: 'revise',
        one_paragraph_summary: 'Anchor type propagation test.',
        top_3_strengths: ['Voice'],
        top_3_risks: ['Pacing'],
      },
      metrics: {
        manuscript: {
          title: 'Anchor Test',
          word_count: 5000,
          genre: 'literary fiction',
          target_audience: 'Adult readers',
        },
      },
      enrichment: {
        premise: 'A premise.',
        trigger_warnings: [],
      },
      criteria: [
        {
          key: 'narrativeDrive',
          score_0_10: 7,
          confidence_level: 'high',
          rationale: 'Rationale.',
          recommendations: [
            {
              priority: 'medium',
              action: 'Act.',
              expected_impact: 'Impact.',
              anchor_snippet: evidence,
              anchor_type: anchorType,
              symptom: 'Symptom.',
              mechanism: 'Mechanism.',
              specific_fix: 'Fix.',
            },
          ],
        },
      ],
    } as ShortFormResultLike;
  }

  it('preserves explicit verbatim_quote anchor_type', () => {
    const result = resultWithEvidence(
      'The protagonist lacks a clear external goal in the opening chapter.',
      'verbatim_quote',
    );
    const ledger = buildCanonicalOpportunityLedger(result);
    const rec = opportunityToCriterionRecommendation(ledger.opportunities[0]);
    expect(rec.anchor_type).toBe('verbatim_quote');
  });

  it('infers verbatim_quote from well-formed balanced legacy quotes', () => {
    const result = resultWithEvidence('"The river remembers blood."', undefined);
    const ledger = buildCanonicalOpportunityLedger(result);
    const rec = opportunityToCriterionRecommendation(ledger.opportunities[0]);
    expect(rec.anchor_type).toBe('verbatim_quote');
  });

  it('leaves unquoted editorial prose as editorial_diagnosis', () => {
    const result = resultWithEvidence(
      'The protagonist lacks a clear external goal in the opening chapter because no stakes are named.',
      undefined,
    );
    const ledger = buildCanonicalOpportunityLedger(result);
    const rec = opportunityToCriterionRecommendation(ledger.opportunities[0]);
    expect(rec.anchor_type).toBe('editorial_diagnosis');
  });

  it('does not certify malformed evidence with stray unmatched quotes as verbatim', () => {
    const result = resultWithEvidence('"The river doesn\'t take by accident," Robert said.', undefined);
    const ledger = buildCanonicalOpportunityLedger(result);
    const rec = opportunityToCriterionRecommendation(ledger.opportunities[0]);
    expect(rec.anchor_type).toBe('editorial_diagnosis');
  });
});

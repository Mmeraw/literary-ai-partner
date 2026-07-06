import { buildCanonicalOpportunityLedger } from '@/lib/evaluation/canonicalOpportunityLedger';
import { normalizeEvaluationReportViewModel } from '@/lib/evaluation/evaluationReportViewModel';
import { buildUnifiedEvaluationDocument } from '@/lib/evaluation/unifiedEvaluationDocument';
import type { ShortFormResultLike } from '@/lib/evaluation/shortFormReportDocument';

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
  });
});

import {
  buildCanonicalOpportunityLedger,
  formatOpportunityForTopRecommendation,
  opportunityToCriterionRecommendation,
} from '@/lib/evaluation/canonicalOpportunityLedger';
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

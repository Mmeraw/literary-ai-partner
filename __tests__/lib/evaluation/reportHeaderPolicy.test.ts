import { CRITERIA_KEYS } from '@/schemas/criteria-keys';
import { getReportHeaderContract } from '@/lib/evaluation/reportHeaderPolicy';
import { EVALUATION_TEMPLATE_CONTRACTS, buildUnifiedEvaluationDocument } from '@/lib/evaluation/unifiedEvaluationDocument';
import { buildPass3bUserPrompt } from '@/lib/evaluation/pipeline/prompts/pass3b-longform';
import type { GenreExpectationMetadata } from '@/lib/evaluation/genreExpectationProfiles';
import type { SynthesizedCriterion } from '@/lib/evaluation/pipeline/types';

const genreExpectationContext: GenreExpectationMetadata = {
  diagnosed_genre: 'epic fantasy',
  shelf_target_audience: 'adult epic fantasy readers',
  dominant_craft_engine: 'world_concept',
  expectation_profiles: ['world_concept_forward', 'slow_burn'],
  genre_expectation_ids: ['epic_fantasy'],
  genre_expectation_labels: ['Epic fantasy'],
  resolution_notes: ['genre_expectation:epic_fantasy'],
};

function makeCriteria(): SynthesizedCriterion[] {
  return CRITERIA_KEYS.map((key) => ({
    key,
    craft_score: 7,
    editorial_score: 7,
    final_score_0_10: 7,
    score_delta: 0,
    final_rationale: `Rationale for ${key}.`,
    fit_summary: `Fit for ${key}.`,
    gap_summary: `Gap for ${key}.`,
    pressure_points: [],
    decision_points: [],
    consequence_status: 'landed',
    evidence: [{ snippet: `Evidence for ${key}.` }],
    recommendations: [],
  }));
}

describe('canonical report header policy', () => {
  test('names the three authoritative evaluation templates explicitly', () => {
    expect(EVALUATION_TEMPLATE_CONTRACTS).toEqual({
      short_form_evaluation: {
        templateName: 'Short-Form Evaluation Template',
        reportType: 'Short-Form Evaluation',
        templatePath: 'docs/templates/evaluation/short-form-evaluation-template.md',
      },
      long_form_evaluation: {
        templateName: 'Long-Form Evaluation Template',
        reportType: 'Long-Form Evaluation',
        templatePath: 'docs/templates/evaluation/long-form-evaluation-template.md',
      },
      long_form_multi_layer_evaluation: {
        templateName: 'Long-Form Multi-Layer Evaluation Template',
        reportType: 'Long-Form Multi-Layer Evaluation',
        templatePath: 'docs/templates/evaluation/long-form-multi-layer-evaluation-template.md',
      },
    });
  });

  test('declares different header requirements for short, long, and multi-layer modes', () => {
    const short = getReportHeaderContract('short_form_evaluation');
    const long = getReportHeaderContract('long_form_evaluation');
    const multi = getReportHeaderContract('long_form_multi_layer_evaluation');

    expect(short.requirements.map((r) => r.id)).toEqual(expect.arrayContaining(['genre', 'genre_expectation_contract']));
    expect(short.requirements.map((r) => r.id)).not.toContain('shelf');

    expect(long.requirements.map((r) => r.id)).toEqual(expect.arrayContaining(['shelf', 'manuscript_scale_continuity']));
    expect(long.requirements.map((r) => r.id)).not.toContain('cross_layer_synthesis');

    expect(multi.requirements.map((r) => r.id)).toEqual(
      expect.arrayContaining(['story_ledger_architecture', 'review_gate_readiness', 'cross_layer_synthesis']),
    );
  });

  test('buildUnifiedEvaluationDocument exposes genre expectation and shelf confidence in title block', () => {
    const doc = buildUnifiedEvaluationDocument({
      mode: 'long_form_multi_layer_evaluation',
      displayTitle: 'The Nine Houses',
      dream: {
        market_shelf: { best_shelf: 'Adult epic fantasy', shelf_neighbors: [], comparison_space: [], marketable_hook: '', market_danger: '' },
      } as any,
      result: {
        generated_at: '2026-06-07T00:00:00.000Z',
        overview: {
          overall_score_0_100: 82,
          verdict: 'revise',
          one_paragraph_summary: 'Summary.',
          top_3_strengths: [],
          top_3_risks: [],
        },
        metrics: {
          manuscript: {
            title: 'The Nine Houses',
            word_count: 120000,
            genre: 'epic fantasy',
            target_audience: 'adult epic fantasy readers',
          },
        },
        governance: {
          transparency: {
            genre_expectation_context: genreExpectationContext,
          },
        },
        criteria: [],
      },
    });

    expect(doc.titleBlock.headerContract.mode).toBe('long_form_multi_layer_evaluation');
    expect(doc.titleBlock.shelf).toBe('Adult epic fantasy');
    expect(doc.titleBlock.shelfConfidenceLabel).toBe('Very High Confidence');
    expect(doc.titleBlock.genreExpectationContract).toMatchObject({
      diagnosedGenre: 'epic fantasy',
      contractSummary: 'Epic fantasy · World concept focus',
      genreExpectationIds: ['epic_fantasy'],
      expectationProfileLabels: ['World concept', 'Slow burn'],
    });
    expect(doc.titleBlock.genreExpectationContract?.contractSummary).not.toContain('world_concept');
    expect(doc.titleBlock.genreExpectationContract?.expectationProfileLabels.join(', ')).not.toContain('world_concept_forward');
  });

  test('Pass 3B prompt includes genre expectation contract', () => {
    const prompt = buildPass3bUserPrompt({
      title: 'The Nine Houses',
      wordCount: 120000,
      chapterCount: 42,
      workType: 'novel',
      criteria: makeCriteria(),
      pass2aStructuredContext: {
        character_ledger: [],
        scene_index: [],
        timeline_anchors: [],
      },
      chunkSample: [{ chunk_index: 0, content: 'The nine houses recited the old oaths beside the vanished map.' }],
      genreExpectationContext,
    });

    expect(prompt).toContain('GENRE EXPECTATION CONTRACT');
    expect(prompt).toContain('Diagnosed genre: epic fantasy');
    expect(prompt).toContain('Expectation profiles: world_concept_forward, slow_burn');
    expect(prompt).toContain('protect it; critique it only when manuscript evidence shows malfunction');
  });
});

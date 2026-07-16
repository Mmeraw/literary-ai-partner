import { buildShortFormEvaluationDocument } from '../../../lib/evaluation/shortFormReportDocument';

describe('score-10 recommendation suppression', () => {
  const CRITERION_KEYS = [
    'concept', 'narrativeDrive', 'character', 'voice', 'sceneConstruction',
    'dialogue', 'theme', 'worldbuilding', 'pacing', 'proseControl',
    'tone', 'narrativeClosure', 'marketability',
  ] as const;

  function buildPerfectResult(overallScore: number, criterionScore: number) {
    return {
      generated_at: '2026-06-10T00:00:00.000Z',
      overview: {
        overall_score_0_100: overallScore,
        verdict: 'publish',
        one_paragraph_summary: 'An exceptional manuscript demonstrating mastery across all craft dimensions.',
        top_3_strengths: ['Voice', 'Character', 'Pacing'],
        top_3_risks: ['Minor line-level polish'],
      },
      metrics: {
        manuscript: {
          title: 'Perfect Score Test',
          word_count: 8500,
          genre: 'Literary Fiction',
          target_audience: 'Adult readers',
        },
      },
      enrichment: {
        premise: 'A flawless story.',
        trigger_warnings: [],
        reading_grade_level: 10.5,
        dialogue_percentage: 30,
        narrative_percentage: 70,
      },
      criteria: CRITERION_KEYS.map((key) => ({
        key,
        score_0_10: criterionScore,
        scorability_status: 'scorable' as const,
        confidence_level: 'high',
        confidence_score_0_100: 95,
        analysis: { fit: ['Excellent'], gap: [], recommendation_action: '' },
      })),
    };
  }

  test('perfect score (95+) suppresses topRecommendations shopping list', () => {
    const doc = buildShortFormEvaluationDocument({
      displayTitle: 'Perfect Score Test',
      result: buildPerfectResult(98, 10),
    });

    expect(doc.topRecommendations).toHaveLength(0);
  });

  test('perfect score (95+) suppresses topRisks', () => {
    const doc = buildShortFormEvaluationDocument({
      displayTitle: 'Perfect Score Test',
      result: buildPerfectResult(96, 9),
    });

    expect(doc.topRisks).toHaveLength(0);
  });

  test('perfect score (95+) suppresses actionItems', () => {
    const doc = buildShortFormEvaluationDocument({
      displayTitle: 'Perfect Score Test',
      result: buildPerfectResult(100, 10),
    });

    expect(doc.actionItems.quickWins).toHaveLength(0);
    expect(doc.actionItems.strategicRevisions).toHaveLength(0);
  });

  test('all criteria >= 9 triggers suppression even if overall < 95', () => {
    const doc = buildShortFormEvaluationDocument({
      displayTitle: 'All Nines Test',
      result: buildPerfectResult(92, 9),
    });

    expect(doc.topRecommendations).toHaveLength(0);
    expect(doc.topRisks).toHaveLength(0);
  });

  test('score 85 with mixed criteria does NOT suppress recommendations', () => {
    const result = buildPerfectResult(85, 8);
    // Override a few criteria to be lower
    result.criteria[0] = { ...result.criteria[0], score_0_10: 6 };
    result.criteria[1] = { ...result.criteria[1], score_0_10: 7 };
    result.recommendations = {
      quick_wins: [{ action: 'Strengthen the opening hook.', why: 'First pages are decisive.', effort: 'low', impact: 'high' }],
      strategic_revisions: [],
    };

    const doc = buildShortFormEvaluationDocument({
      displayTitle: 'Not Perfect Test',
      result,
    });

    // Should NOT get the suppression message
    expect(doc.topRecommendations.length).toBeGreaterThan(0);
    expect(doc.topRecommendations[0]).not.toContain('exceptional quality');
  });
});

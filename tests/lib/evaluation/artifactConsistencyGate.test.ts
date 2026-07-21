import { evaluateArtifactConsistencyGateV1 } from '@/lib/evaluation/artifactConsistencyGate';
import { canonicalJsonSha256 } from '@/lib/evaluation/canonicalJsonHash';
import type { EvaluationResultV2, EvaluationCriterionV2 } from '@/schemas/evaluation-result-v2';

function criterion(
  key: EvaluationCriterionV2['key'],
  score: number,
  recommendations: EvaluationCriterionV2['recommendations'] = [],
): EvaluationCriterionV2 {
  const hasMeaningfulRecommendation = recommendations.some(
    (recommendation) => recommendation.action.trim().length > 0,
  );
  return {
    key,
    scorable: true,
    status: 'SCORABLE',
    signal_present: true,
    signal_strength: 'SUFFICIENT',
    confidence_band: 'HIGH',
    confidence_level: 'high',
    confidence_score_0_100: 90,
    score_0_10: score,
    rationale: `${key} rationale`,
    evidence: [{ snippet: `${key} evidence` }],
    recommendations,
    recommendation_status: hasMeaningfulRecommendation
      ? 'recommendation_provided'
      : 'no_recommendation_warranted',
    recommendation_status_rationale: hasMeaningfulRecommendation
      ? undefined
      : `The ${key} criterion has no distinct evidence-backed revision beyond the governed evaluation.`,
  };
}

function resultWith(overrides: Partial<EvaluationResultV2>): EvaluationResultV2 {
  return {
    schema_version: 'evaluation_result_v2',
    ids: {
      evaluation_run_id: 'run-1',
      manuscript_id: 1,
      user_id: 'user-1',
    },
    generated_at: '2026-01-01T00:00:00.000Z',
    engine: {
      model: 'test-model',
      provider: 'openai',
      prompt_version: 'test-prompt',
    },
    overview: {
      verdict: 'conditional',
      overall_score_0_100: 60,
      scored_criteria_count: 2,
      one_paragraph_summary: 'The manuscript has strong voice but needs revision.',
      top_3_strengths: ['Voice is engaging'],
      top_3_risks: ['Theme is underdeveloped'],
    },
    criteria: [
      criterion('theme', 4, [
        {
          priority: 'high',
          action: 'Clarify the thematic argument in repeated turning points.',
          expected_impact: 'Readers can track the meaning pressure across the arc.',
        },
      ]),
      criterion('voice', 8),
    ],
    recommendations: {
      quick_wins: [],
      strategic_revisions: [],
    },
    metrics: {
      manuscript: {},
      processing: {},
    },
    artifacts: [],
    governance: {
      confidence: 0.9,
      policy_family: 'test_policy',
      warnings: [],
      limitations: [],
    },
    ...overrides,
  };
}

describe('artifactConsistencyGateV1', () => {
  test('blocks when post-QG bottom weakness criteria are omitted from the summary', () => {
    const effective = resultWith({});
    const gate = evaluateArtifactConsistencyGateV1({
      sourceResult: effective,
      effectiveQGResult: effective,
    });

    expect(gate.schema_version).toBe('artifact_consistency_gate_v1');
    expect(typeof gate.created_at).toBe('string');
    expect(Number.isNaN(Date.parse(gate.created_at))).toBe(false);
    expect(gate.status).toBe('fail');
    expect(gate.checked_invariants).toEqual([
      'summary_criteria_bottom_weakness_alignment',
      'recommendation_criterion_traceability',
    ]);
    expect(gate.source_result_hash).toBe(canonicalJsonSha256(effective));
    expect(gate.effective_qg_result_hash).toBe(canonicalJsonSha256(effective));
    expect(gate.blocking_reasons).toContain('summary_criteria_bottom_weakness_alignment');
    expect(gate.checks).toContainEqual(expect.objectContaining({
      check_id: 'summary_criteria_bottom_weakness_alignment',
      status: 'fail',
      affected_criteria: ['theme'],
    }));
  });

  test('passes when summary and action trace reference bottom weakness criteria', () => {
    const effective = resultWith({
      overview: {
        verdict: 'conditional',
        overall_score_0_100: 60,
        scored_criteria_count: 2,
        one_paragraph_summary: 'The manuscript has strong voice, but the main weakness is theme clarity.',
        top_3_strengths: ['Voice is engaging'],
        top_3_risks: ['Theme is underdeveloped'],
      },
    });
    const gate = evaluateArtifactConsistencyGateV1({
      sourceResult: effective,
      effectiveQGResult: effective,
    });

    expect(gate.status).toBe('pass');
    expect(gate.blocking_reasons).toEqual([]);
    expect(gate.checks.every((check) => check.status === 'pass')).toBe(true);
  });

  test('blocks when a bottom weakness has neither a recommendation nor a governed disposition', () => {
    const effective = resultWith({
      overview: {
        verdict: 'conditional',
        overall_score_0_100: 60,
        scored_criteria_count: 2,
        one_paragraph_summary: 'The manuscript has strong voice, but the main weakness is theme clarity.',
        top_3_strengths: ['Voice is engaging'],
        top_3_risks: ['Theme is underdeveloped'],
      },
      criteria: [
        {
          ...criterion('theme', 4, []),
          recommendation_status: undefined,
          recommendation_status_rationale: undefined,
        },
        criterion('voice', 8),
      ],
    });
    const gate = evaluateArtifactConsistencyGateV1({
      sourceResult: effective,
      effectiveQGResult: effective,
    });

    expect(gate.status).toBe('fail');
    expect(gate.blocking_reasons).toContain('recommendation_criterion_traceability');
    expect(gate.checks).toContainEqual(expect.objectContaining({
      check_id: 'recommendation_criterion_traceability',
      status: 'fail',
      affected_criteria: ['theme'],
    }));
  });

  test('accepts a bottom weakness with an explicit governed zero-recommendation disposition', () => {
    const effective = resultWith({
      overview: {
        verdict: 'conditional',
        overall_score_0_100: 60,
        scored_criteria_count: 2,
        one_paragraph_summary: 'The manuscript has strong voice, but the main weakness is theme clarity.',
        top_3_strengths: ['Voice is engaging'],
        top_3_risks: ['Theme is underdeveloped'],
      },
      criteria: [
        criterion('theme', 4, []),
        criterion('voice', 8),
      ],
    });

    const gate = evaluateArtifactConsistencyGateV1({
      sourceResult: effective,
      effectiveQGResult: effective,
    });

    expect(gate.status).toBe('pass');
    expect(gate.blocking_reasons).not.toContain('recommendation_criterion_traceability');
  });

  test('blocks a recommendation paired with an explicit zero-recommendation disposition', () => {
    const contradictory = {
      ...criterion('theme', 4, [{
        priority: 'high' as const,
        action: 'Clarify the thematic turn at the scene pivot.',
        expected_impact: 'Readers can follow how the event changes the governing idea.',
      }]),
      recommendation_status: 'insufficient_evidence' as const,
      recommendation_status_rationale:
        'This explicit zero-recommendation disposition contradicts the emitted recommendation.',
    };
    const effective = resultWith({
      overview: {
        verdict: 'conditional',
        overall_score_0_100: 60,
        scored_criteria_count: 2,
        one_paragraph_summary: 'Theme is the principal weakness while voice remains controlled.',
        top_3_strengths: ['Voice is engaging'],
        top_3_risks: ['Theme is underdeveloped'],
      },
      criteria: [contradictory, criterion('voice', 8)],
    });

    const gate = evaluateArtifactConsistencyGateV1({
      sourceResult: effective,
      effectiveQGResult: effective,
    });

    expect(gate.status).toBe('fail');
    expect(gate.checks).toContainEqual(expect.objectContaining({
      check_id: 'recommendation_criterion_traceability',
      status: 'fail',
      affected_criteria: ['theme'],
    }));
  });

  test('records different source/effective hashes when QG normalization changes criteria', () => {
    const source = resultWith({
      criteria: [
        criterion('theme', 10),
        criterion('voice', 8),
      ],
    });
    const effective = resultWith({
      criteria: [
        criterion('theme', 5),
        criterion('voice', 8),
      ],
      overview: {
        verdict: 'conditional',
        overall_score_0_100: 60,
        scored_criteria_count: 2,
        one_paragraph_summary: 'Theme remains the primary weakness and needs revision.',
        top_3_strengths: ['Voice is engaging'],
        top_3_risks: ['Theme is underdeveloped'],
      },
    });

    const gate = evaluateArtifactConsistencyGateV1({
      sourceResult: source,
      effectiveQGResult: effective,
    });

    expect(gate.source_result_hash).toBe(canonicalJsonSha256(source));
    expect(gate.effective_qg_result_hash).toBe(canonicalJsonSha256(effective));
    expect(gate.source_result_hash).not.toBe(gate.effective_qg_result_hash);
  });

  test('Cartel Babies regression: source theme=10 and effective theme=5 with summary omission fails gate', () => {
    const source = resultWith({
      criteria: [
        criterion('theme', 10, [
          {
            priority: 'high',
            action: 'Clarify the thematic argument in repeated turning points.',
            expected_impact: 'Readers can track the meaning pressure across the arc.',
          },
        ]),
        criterion('voice', 8),
      ],
      overview: {
        verdict: 'conditional',
        overall_score_0_100: 70,
        scored_criteria_count: 2,
        one_paragraph_summary: 'The manuscript has strong voice and momentum.',
        top_3_strengths: ['Voice is engaging'],
        top_3_risks: ['Theme is underdeveloped'],
      },
    });

    const effective = resultWith({
      criteria: [
        criterion('theme', 5, [
          {
            priority: 'high',
            action: 'Clarify the thematic argument in repeated turning points.',
            expected_impact: 'Readers can track the meaning pressure across the arc.',
          },
        ]),
        criterion('voice', 8),
      ],
      overview: {
        verdict: 'conditional',
        overall_score_0_100: 60,
        scored_criteria_count: 2,
        one_paragraph_summary: 'The manuscript has strong voice and momentum.',
        top_3_strengths: ['Voice is engaging'],
        top_3_risks: ['Theme is underdeveloped'],
      },
    });

    const gate = evaluateArtifactConsistencyGateV1({
      sourceResult: source,
      effectiveQGResult: effective,
    });

    expect(gate.status).toBe('fail');
    expect(gate.blocking_reasons).toContain('summary_criteria_bottom_weakness_alignment');
    expect(gate.source_result_hash).toBe(canonicalJsonSha256(source));
    expect(gate.effective_qg_result_hash).toBe(canonicalJsonSha256(effective));
    expect(gate.source_result_hash).not.toBe(gate.effective_qg_result_hash);
  });

  test('Cartel Babies regression: same capped criteria with summary mentioning theme passes gate', () => {
    const source = resultWith({
      criteria: [
        criterion('theme', 10, [
          {
            priority: 'high',
            action: 'Clarify the thematic argument in repeated turning points.',
            expected_impact: 'Readers can track the meaning pressure across the arc.',
          },
        ]),
        criterion('voice', 8),
      ],
    });

    const effective = resultWith({
      criteria: [
        criterion('theme', 5, [
          {
            priority: 'high',
            action: 'Clarify the thematic argument in repeated turning points.',
            expected_impact: 'Readers can track the meaning pressure across the arc.',
          },
        ]),
        criterion('voice', 8),
      ],
      overview: {
        verdict: 'conditional',
        overall_score_0_100: 60,
        scored_criteria_count: 2,
        one_paragraph_summary: 'Theme remains the primary weakness and needs revision.',
        top_3_strengths: ['Voice is engaging'],
        top_3_risks: ['Theme is underdeveloped'],
      },
    });

    const gate = evaluateArtifactConsistencyGateV1({
      sourceResult: source,
      effectiveQGResult: effective,
    });

    expect(gate.status).toBe('pass');
    expect(gate.blocking_reasons).toEqual([]);
    expect(gate.source_result_hash).toBe(canonicalJsonSha256(source));
    expect(gate.effective_qg_result_hash).toBe(canonicalJsonSha256(effective));
  });
});

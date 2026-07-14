import { buildPostQgEffectiveSnapshotV1 } from '@/lib/evaluation/postQgEffectiveSnapshot';
import { canonicalJsonSha256 } from '@/lib/evaluation/canonicalJsonHash';
import type { EvaluationResultV2, EvaluationCriterionV2 } from '@/schemas/evaluation-result-v2';
import type { QualityGateV2Result } from '@/lib/evaluation/pipeline/qualityGate';

function criterion(key: EvaluationCriterionV2['key'], score: number): EvaluationCriterionV2 {
  return {
    key,
    scorable: true,
    status: 'SCORABLE',
    signal_present: true,
    signal_strength: 'SUFFICIENT',
    confidence_band: 'MEDIUM',
    confidence_level: 'moderate',
    confidence_score_0_100: 75,
    confidence_reasons: ['sufficient anchors'],
    score_0_10: score,
    rationale: `${key} rationale with manuscript-grounded support.`,
    evidence: [{ snippet: `${key} evidence anchor` }],
    recommendations: [
      {
        priority: 'high',
        action: `Revise ${key} with a concrete manuscript-grounded action.`,
        expected_impact: `Improves ${key} clarity.`,
      },
    ],
  };
}

function resultWith(overrides: Partial<EvaluationResultV2> = {}): EvaluationResultV2 {
  return {
    schema_version: 'evaluation_result_v2',
    ids: {
      evaluation_run_id: 'run-snapshot',
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
      one_paragraph_summary: 'Theme needs revision while voice remains strong.',
      top_3_strengths: ['Voice'],
      top_3_risks: ['Theme'],
    },
    criteria: [criterion('theme', 5), criterion('voice', 8)],
    recommendations: {
      quick_wins: [
        {
          criterion_key: 'theme',
          action: 'Clarify theme in the midpoint turn.',
          why: 'The core meaning pressure is currently diffuse.',
          effort: 'medium',
          impact: 'high',
        },
      ],
      strategic_revisions: [],
    },
    metrics: {
      manuscript: {},
      processing: {},
    },
    artifacts: [],
    governance: {
      confidence: 0.8,
      warnings: [],
      limitations: [],
      policy_family: 'test-policy',
    },
    ...overrides,
  };
}

function qualityGate(overrides: Partial<QualityGateV2Result> = {}): QualityGateV2Result {
  return {
    pass: true,
    checks: [
      {
        check_id: 'v2_summary_weakness_presence',
        passed: true,
        details: 'Summary names bottom weaknesses.',
      },
    ],
    warnings: ['test warning'],
    artifactGate: {
      verdict: 'PASS',
      reasonCodes: [],
      validatedAt: '2026-01-01T00:00:00.000Z',
      enforcementMode: 'enforce',
    },
    ...overrides,
  };
}

describe('postQgEffectiveSnapshotV1', () => {
  test('captures exact effective result plus scores confidence rationales evidence recommendations opportunities and hashes', () => {
    const source = resultWith({
      criteria: [criterion('theme', 10), criterion('voice', 8)],
    });
    const effective = resultWith({
      criteria: [criterion('theme', 5), criterion('voice', 8)],
    }) as EvaluationResultV2 & { opportunities: Array<{ criterion_key: string; action: string }> };
    effective.opportunities = [{ criterion_key: 'theme', action: 'Clarify thematic escalation.' }];

    const snapshot = buildPostQgEffectiveSnapshotV1({
      sourceResult: source,
      effectiveResult: effective,
      qualityGate: qualityGate(),
      createdAt: '2026-01-02T00:00:00.000Z',
    });

    expect(snapshot.schema_version).toBe('post_qg_effective_snapshot_v1');
    expect(snapshot.created_at).toBe('2026-01-02T00:00:00.000Z');
    expect(snapshot.qg_status).toBe('pass');
    expect(snapshot.source_result_hash).toBe(canonicalJsonSha256(source));
    expect(snapshot.effective_result_hash).toBe(canonicalJsonSha256(effective));
    expect(snapshot.summary.one_paragraph_summary).toContain('Theme');
    expect(snapshot.criteria).toContainEqual(expect.objectContaining({
      key: 'theme',
      score_0_10: 5,
      confidence_level: 'moderate',
      rationale: expect.stringContaining('theme rationale'),
      evidence: expect.arrayContaining([expect.objectContaining({ snippet: 'theme evidence anchor' })]),
      recommendations: expect.arrayContaining([expect.objectContaining({ action: expect.stringContaining('theme') })]),
    }));
    expect(snapshot.recommendations.quick_wins[0].criterion_key).toBe('theme');
    expect(snapshot.opportunities).toEqual([{ criterion_key: 'theme', action: 'Clarify thematic escalation.' }]);
    expect(snapshot.quality_gate.warnings).toEqual(['test warning']);
    expect(snapshot.effective_evaluation_result).toBe(effective);
  });

  test('records rejected QG status and failed check ids', () => {
    const result = resultWith();
    const snapshot = buildPostQgEffectiveSnapshotV1({
      sourceResult: result,
      effectiveResult: result,
      qualityGate: qualityGate({
        pass: false,
        checks: [
          {
            check_id: 'v2_summary_weakness_presence',
            passed: false,
            error_code: 'QG_SUMMARY_OMITS_WEAKNESS',
            details: 'Summary omits theme.',
          },
        ],
      }),
    });

    expect(snapshot.qg_status).toBe('fail');
    expect(snapshot.quality_gate.failed_checks).toEqual(['v2_summary_weakness_presence']);
  });
});

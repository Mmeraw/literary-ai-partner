import {
  runSummaryCriterionConsistencyGate,
  SUMMARY_CRITERION_CONTRADICTION_SCORE_THRESHOLD,
} from '@/lib/evaluation/pipeline/summaryCriterionConsistencyGate';
import type { EvaluationResultV2, EvaluationCriterionV2 } from '@/schemas/evaluation-result-v2';

// ── Fixture helpers ────────────────────────────────────────────────────────────

function makeCriterion(
  key: EvaluationCriterionV2['key'],
  score: number,
  rationale: string,
): EvaluationCriterionV2 {
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
    rationale,
    evidence: [{ snippet: `${key} evidence` }],
    recommendations: [],
  };
}

function makeResult(
  summary: string,
  criteria: EvaluationCriterionV2[],
): EvaluationResultV2 {
  return {
    schema_version: 'evaluation_result_v2',
    ids: { evaluation_run_id: 'run-1', manuscript_id: 1, user_id: 'user-1' },
    generated_at: '2026-01-01T00:00:00.000Z',
    engine: { model: 'test-model', provider: 'openai', prompt_version: 'test-prompt' },
    overview: {
      verdict: 'conditional',
      overall_score_0_100: 60,
      scored_criteria_count: criteria.length,
      one_paragraph_summary: summary,
      top_3_strengths: [],
      top_3_risks: [],
    },
    criteria,
    recommendations: { quick_wins: [], strategic_revisions: [] },
    metrics: { manuscript: {}, processing: {} },
    artifacts: [],
    governance: { confidence: 0.9, policy_family: 'test', warnings: [], limitations: [] },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('runSummaryCriterionConsistencyGate', () => {

  // ── PASS cases ─────────────────────────────────────────────────────────────

  test('PASS — no weak criteria (all scores above threshold)', () => {
    const result = makeResult(
      'The manuscript demonstrates strong theme and compelling voice throughout.',
      [
        makeCriterion('theme', 7, 'Well developed.'),
        makeCriterion('voice', 8, 'Confident and controlled.'),
      ],
    );
    const gate = runSummaryCriterionConsistencyGate({ effectiveQGResult: result });

    expect(gate.verdict).toBe('PASS');
    expect(gate.contradiction_count).toBe(0);
    expect(gate.blocking).toBe(false);
    expect(gate.contradictions).toHaveLength(0);
  });

  test('PASS — weak criterion mentioned in summary but not praised', () => {
    // "theme needs revision" — anchor present but no positive polarity in same sentence
    const result = makeResult(
      'The manuscript has a strong voice. Theme needs revision and feels underdeveloped.',
      [
        makeCriterion('theme', 4, 'Thematic development is underdeveloped and lacks integration.'),
        makeCriterion('voice', 8, 'Confident and controlled.'),
      ],
    );
    const gate = runSummaryCriterionConsistencyGate({ effectiveQGResult: result });

    expect(gate.verdict).toBe('PASS');
    expect(gate.contradiction_count).toBe(0);
  });

  test('PASS — polarity term in a different sentence from anchor (locality requirement)', () => {
    // "strong" is in the voice sentence; "theme" is in its own negative sentence.
    // They should NOT match because they are not co-located.
    const result = makeResult(
      'The voice is strong and assured. Theme remains thin and underdeveloped.',
      [
        makeCriterion('theme', 4, 'Thematic integration is weak and lacking throughout.'),
        makeCriterion('voice', 8, 'Voice is confident.'),
      ],
    );
    const gate = runSummaryCriterionConsistencyGate({ effectiveQGResult: result });

    expect(gate.verdict).toBe('PASS');
    expect(gate.contradiction_count).toBe(0);
  });

  test('PASS — weak criterion with positive summary but no negative rationale', () => {
    // Score is low but rationale is neutral — no contradiction.
    const result = makeResult(
      'The dialogue is authentic and compelling throughout.',
      [
        makeCriterion('dialogue', 4, 'Dialogue functions as intended in context.'),
      ],
    );
    const gate = runSummaryCriterionConsistencyGate({ effectiveQGResult: result });

    expect(gate.verdict).toBe('PASS');
    expect(gate.contradiction_count).toBe(0);
  });

  test('PASS — score exactly at threshold + 1 is excluded from check', () => {
    // score = THRESHOLD + 1 should not be checked regardless of summary/rationale
    const score = SUMMARY_CRITERION_CONTRADICTION_SCORE_THRESHOLD + 1;
    const result = makeResult(
      'The theme is compelling and well-developed.',
      [
        makeCriterion('theme', score, 'Theme is thin and underdeveloped.'),
      ],
    );
    const gate = runSummaryCriterionConsistencyGate({ effectiveQGResult: result });

    expect(gate.verdict).toBe('PASS');
    expect(gate.contradiction_count).toBe(0);
  });

  test('PASS — non-SCORABLE criterion with positive summary and negative rationale', () => {
    const criterion: EvaluationCriterionV2 = {
      key: 'theme',
      scorable: false,
      status: 'NO_SIGNAL',
      signal_present: false,
      signal_strength: 'NONE',
      confidence_band: 'LOW',
      score_0_10: null,
      insufficient_signal_reason: { looked_for: ['theme'], not_found: ['theme'] },
      rationale: 'Theme is absent and lacking from this excerpt.',
      evidence: [],
      recommendations: [],
    };
    const result = makeResult(
      'The thematic development is compelling and rich.',
      [criterion],
    );
    const gate = runSummaryCriterionConsistencyGate({ effectiveQGResult: result });

    expect(gate.verdict).toBe('PASS');
    expect(gate.contradiction_count).toBe(0);
  });

  // ── WARN cases ─────────────────────────────────────────────────────────────

  test('WARN — exactly 1 criterion contradicted', () => {
    const result = makeResult(
      'The thematic development is compelling and adds real depth to the work.',
      [
        makeCriterion('theme', 4, 'Theme is underdeveloped and fails to integrate with the narrative.'),
        makeCriterion('voice', 8, 'Voice is strong and controlled.'),
      ],
    );
    const gate = runSummaryCriterionConsistencyGate({ effectiveQGResult: result });

    expect(gate.verdict).toBe('WARN');
    expect(gate.contradiction_count).toBe(1);
    expect(gate.blocking).toBe(false);
    expect(gate.contradictions[0]?.criterion_key).toBe('theme');
    expect(gate.contradictions[0]?.score_0_10).toBe(4);
    expect(gate.contradictions[0]?.matched_positive_tokens).toContain('thematic');
    expect(gate.contradictions[0]?.matched_negative_tokens).toContain('underdeveloped');
  });

  test('WARN — contradiction detail includes excerpts', () => {
    const result = makeResult(
      'The thematic development is rich and compelling.',
      [
        makeCriterion('theme', 3, 'Theme is thin, lacking integration, and underdeveloped.'),
      ],
    );
    const gate = runSummaryCriterionConsistencyGate({ effectiveQGResult: result });

    expect(gate.verdict).toBe('WARN');
    const c = gate.contradictions[0]!;
    expect(typeof c.summary_excerpt).toBe('string');
    expect(c.summary_excerpt.length).toBeGreaterThan(0);
    expect(typeof c.rationale_excerpt).toBe('string');
    expect(c.rationale_excerpt.length).toBeGreaterThan(0);
  });

  test('WARN — criterion at exactly the score threshold is checked', () => {
    const score = SUMMARY_CRITERION_CONTRADICTION_SCORE_THRESHOLD; // = 5
    const result = makeResult(
      'The pacing is excellent and well-controlled throughout.',
      [
        makeCriterion('pacing', score, 'Pacing is inconsistent and lacks structural balance.'),
      ],
    );
    const gate = runSummaryCriterionConsistencyGate({ effectiveQGResult: result });

    expect(gate.verdict).toBe('WARN');
    expect(gate.contradiction_count).toBe(1);
    expect(gate.contradictions[0]?.criterion_key).toBe('pacing');
  });

  // ── BLOCK cases ────────────────────────────────────────────────────────────

  test('BLOCK — 2 criteria contradicted', () => {
    const result = makeResult(
      'The thematic integration is rich and compelling. The dialogue is authentic and assured.',
      [
        makeCriterion('theme', 3, 'Theme is shallow and underdeveloped.'),
        makeCriterion('dialogue', 4, 'Dialogue is flat and unconvincing.'),
        makeCriterion('voice', 8, 'Voice is controlled.'),
      ],
    );
    const gate = runSummaryCriterionConsistencyGate({ effectiveQGResult: result });

    expect(gate.verdict).toBe('BLOCK');
    expect(gate.contradiction_count).toBe(2);
    expect(gate.blocking).toBe(true);
    expect(gate.contradictions.map((c) => c.criterion_key)).toContain('theme');
    expect(gate.contradictions.map((c) => c.criterion_key)).toContain('dialogue');
  });

  test('BLOCK — 3 criteria contradicted', () => {
    const result = makeResult(
      'The premise is compelling and well-developed. The character work is rich and authentic. The pacing is excellent and controlled.',
      [
        makeCriterion('concept', 4, 'Premise is unclear and lacks focus.'),
        makeCriterion('character', 3, 'Character is thin and underdeveloped.'),
        makeCriterion('pacing', 5, 'Pacing is inconsistent and insufficient.'),
      ],
    );
    const gate = runSummaryCriterionConsistencyGate({ effectiveQGResult: result });

    expect(gate.verdict).toBe('BLOCK');
    expect(gate.contradiction_count).toBe(3);
    expect(gate.blocking).toBe(true);
  });

  // ── Graduation boundary ────────────────────────────────────────────────────

  test('graduation boundary — 1 contradiction is WARN not BLOCK', () => {
    const result = makeResult(
      'The voice is distinctive and confident throughout.',
      [
        makeCriterion('voice', 5, 'Voice is inconsistent and lacks control.'),
      ],
    );
    const gate = runSummaryCriterionConsistencyGate({ effectiveQGResult: result });

    expect(gate.verdict).toBe('WARN');
    expect(gate.blocking).toBe(false);
  });

  // ── Artifact shape ─────────────────────────────────────────────────────────

  test('artifact schema_version is always present on PASS', () => {
    const result = makeResult(
      'A quiet, controlled manuscript.',
      [makeCriterion('voice', 8, 'Voice is strong.')],
    );
    const gate = runSummaryCriterionConsistencyGate({ effectiveQGResult: result });

    expect(gate.schema_version).toBe('summary_criterion_consistency_v1');
    expect(gate.check_id).toBe('summary_criterion_positive_contradiction');
    expect(typeof gate.generated_at).toBe('string');
    expect(Number.isNaN(Date.parse(gate.generated_at))).toBe(false);
  });

  test('criterion_label is populated from CRITERIA_METADATA', () => {
    const result = makeResult(
      'The thematic development is rich and compelling.',
      [makeCriterion('theme', 4, 'Theme is underdeveloped.')],
    );
    const gate = runSummaryCriterionConsistencyGate({ effectiveQGResult: result });

    expect(gate.contradictions[0]?.criterion_label).toBe('Thematic Integration');
  });

});

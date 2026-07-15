import { attemptCandidateIntegrityRepair } from '@/lib/evaluation/pipeline/candidateIntegrityRepair';
import { AuthorFacingIntegrityError } from '@/lib/text/authorFacingIntegrity';

function makeSynthesis(overrides?: {
  candidateText?: string;
  specific_fix?: string;
  action?: string;
  mechanism?: string;
  reader_effect?: string;
  symptom?: string;
}) {
  const candidateText = overrides?.candidateText ?? 'MJ reached toward the pack and';
  return {
    criteria: [
      {
        key: 'sceneConstruction' as const,
        final_score_0_10: 6,
        final_rationale: 'The scene construction is summary-heavy.',
        evidence: [{ snippet: 'The desert sun was a respite.', char_start: 0, char_end: 30 }],
        recommendations: [
          {
            priority: 'medium' as const,
            action: overrides?.action ?? 'Dramatize the bus-station beat by showing MJ checking his pack and noticing the customs officer.',
            expected_impact: 'Reader feels the momentary clench of risk before MJ boards.',
            anchor_snippet: 'MJ waited at the bus station.',
            issue_family: 'scene_construction' as const,
            strategic_lever: 'concrete_rendering' as const,
            revision_granularity: 'paragraph' as const,
            mechanism: overrides?.mechanism ?? 'Because the scene is told rather than shown, the reader cannot yet occupy MJ’s body.',
            specific_fix: overrides?.specific_fix ?? 'Show MJ adjusting the pack, his hand brushing the seam where the drugs are hidden.',
            reader_effect: overrides?.reader_effect ?? 'Reader shares MJ’s bodily awareness of the risk.',
            symptom: overrides?.symptom ?? 'The bus-station moment reads as summary, so the smuggling stakes feel abstract.',
            candidate_text_a: candidateText,
            candidate_text_b: candidateText,
            candidate_text_c: candidateText,
          },
        ],
      },
    ],
    overall: {
      overall_score_0_100: 70,
      verdict: 'revise' as const,
      one_paragraph_summary:
        'The manuscript demonstrates craft with scene-level revision opportunities, especially in dramatizing summary-heavy beats.',
      one_sentence_pitch: 'A would-be smuggler waits at a bus station, his hidden cargo turning every glance into risk.',
      one_paragraph_pitch:
        'MJ has hidden the drugs in the seam of his pack. At the bus station he notices the customs officer and feels the first cold edge of consequence.',
      top_3_strengths: ['Voice', 'Theme', 'Character'],
      top_3_risks: ['Pacing', 'Scene construction', 'Closure'],
      submission_readiness: 'nearly_ready' as const,
    },
    metadata: {
      pass1_model: 'test',
      pass2_model: 'test',
      pass3_model: 'test',
      generated_at: new Date().toISOString(),
    },
    partial_evaluation: false,
  };
}

describe('candidateIntegrityRepair', () => {
  it('repairs candidate fields that contain ellipses by rebuilding from grounded recommendation data', () => {
    const synthesis = makeSynthesis({ candidateText: 'MJ reached toward the pack and...' });

    const error = new AuthorFacingIntegrityError([
      {
        code: 'AUTHOR_TEXT_TRUNCATION_ELLIPSIS',
        path: 'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a',
        value: 'MJ reached toward the pack and...',
        message: 'contains an ellipsis',
      },
      {
        code: 'AUTHOR_TEXT_TRUNCATION_ELLIPSIS',
        path: 'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_b',
        value: 'MJ reached toward the pack and...',
        message: 'contains an ellipsis',
      },
      {
        code: 'AUTHOR_TEXT_TRUNCATION_ELLIPSIS',
        path: 'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_c',
        value: 'MJ reached toward the pack and...',
        message: 'contains an ellipsis',
      },
    ]);

    const result = attemptCandidateIntegrityRepair(synthesis, error);

    expect(result.status).toBe('repaired');
    expect(result.remainingViolations).toHaveLength(0);

    const rec = synthesis.criteria[0].recommendations[0];
    for (const field of ['candidate_text_a', 'candidate_text_b', 'candidate_text_c'] as const) {
      const fixed = rec[field] ?? '';
      expect(fixed).not.toMatch(/\.{3}|…/);
      expect(fixed).toMatch(/[.!?]$/);
      expect(fixed.split(/\s+/).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('repairs an incomplete candidate ending with a dangling conjunction', () => {
    const synthesis = makeSynthesis({ candidateText: 'MJ reached toward the pack and' });

    const error = new AuthorFacingIntegrityError([
      {
        code: 'AUTHOR_TEXT_MIDSENTENCE_TERMINATION',
        path: 'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a',
        value: 'MJ reached toward the pack and',
        message: 'ends mid-sentence',
      },
    ]);

    const result = attemptCandidateIntegrityRepair(synthesis, error);

    expect(result.status).toBe('repaired');
    const fixed = synthesis.criteria[0].recommendations[0].candidate_text_a ?? '';
    expect(fixed).not.toMatch(/\.{3}|…/);
    expect(fixed).toMatch(/[.!?]$/);
    expect(fixed.split(/\s+/).length).toBeGreaterThanOrEqual(5);
    expect(result.remainingViolations).toHaveLength(0);
  });

  it('quarantines candidate fields when the grounded recommendation data is still unsafe', () => {
    const synthesis = makeSynthesis({
      candidateText: 'MJ reached toward the pack and...',
      // specific_fix has an unbalanced delimiter that will survive naive rebuilding,
      // so repair should exhaust and fall back to quarantine.
      specific_fix: 'Show MJ adjusting the pack (and stopping.',
      action: 'Dramatize the bus-station beat (incomplete',
      mechanism: 'Because the scene is told (rather than shown.',
      reader_effect: 'Reader shares MJ’s bodily awareness (incomplete',
      symptom: 'The bus-station moment reads as summary (incomplete',
    });

    const error = new AuthorFacingIntegrityError([
      {
        code: 'AUTHOR_TEXT_TRUNCATION_ELLIPSIS',
        path: 'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a',
        value: 'MJ reached toward the pack and...',
        message: 'contains an ellipsis',
      },
    ]);

    const result = attemptCandidateIntegrityRepair(synthesis, error);

    expect(result.status).toBe('quarantined');
    expect(synthesis.criteria[0].recommendations[0].candidate_text_a).toBeUndefined();
    expect(synthesis.criteria[0].recommendations[0].candidate_text_b).toBeUndefined();
    expect(synthesis.criteria[0].recommendations[0].candidate_text_c).toBeUndefined();
    expect(result.remainingViolations).toHaveLength(0);
  });

  it('fails closed when a non-candidate author-facing field fails integrity', () => {
    const synthesis = makeSynthesis({ candidateText: 'MJ reached toward the pack.' });

    const error = new AuthorFacingIntegrityError([
      {
        code: 'AUTHOR_TEXT_TRUNCATION_ELLIPSIS',
        path: 'evaluation_result_v2.overview.one_paragraph_summary',
        value: 'The manuscript...',
        message: 'contains an ellipsis',
      },
    ]);

    const result = attemptCandidateIntegrityRepair(synthesis, error);

    expect(result.status).toBe('unrepairable');
    expect(result.remainingViolations).toHaveLength(1);
  });
});
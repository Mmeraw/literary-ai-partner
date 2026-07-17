import { isCandidateTextViolationPath } from '@/lib/evaluation/pipeline/candidateIntegrityRepair';
import { quarantineCandidateFields } from '@/lib/evaluation/pipeline/requiredProseRegeneration';

function makeSynthesis() {
  return {
    criteria: [
      {
        key: 'sceneConstruction',
        final_score_0_10: 6,
        fit_summary: 'The scene construction earns the score through concrete action.',
        gap_summary: 'The scene sometimes summarizes instead of dramatizing.',
        final_rationale: 'The scene construction is summary-heavy.',
        evidence: [{ snippet: 'The desert sun was a respite.', char_start: 0, char_end: 30 }],
        recommendations: [
          {
            priority: 'medium',
            action: 'Dramatize the bus-station beat.',
            expected_impact: 'Reader feels risk.',
            anchor_snippet: 'MJ waited at the bus station.',
            issue_family: 'scene_construction',
            strategic_lever: 'concrete_rendering',
            revision_granularity: 'paragraph',
            mechanism: 'The scene is told rather than shown.',
            specific_fix: 'Show MJ adjusting the pack.',
            reader_effect: 'Reader shares MJ’s bodily awareness.',
            symptom: 'The bus-station moment reads as summary.',
            candidate_text_a: 'MJ reached toward the pack and...',
            candidate_text_b: 'MJ reached toward the pack and...',
            candidate_text_c: 'MJ reached toward the pack and...',
          },
        ],
      },
    ],
    overall: {
      overall_score_0_100: 70,
      verdict: 'revise',
      one_paragraph_summary: 'The manuscript demonstrates craft.',
      one_sentence_pitch: 'A would-be smuggler waits at a bus station.',
      one_paragraph_pitch: 'MJ has hidden the drugs in the seam of his pack.',
      top_3_strengths: ['Voice', 'Theme', 'Character'],
      top_3_risks: ['Pacing', 'Scene construction', 'Closure'],
      submission_readiness: 'nearly_ready',
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

describe('isCandidateTextViolationPath', () => {
  it('recognizes canonical criteria recommendation candidate paths', () => {
    expect(
      isCandidateTextViolationPath('evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a'),
    ).toBe(true);
  });

  it('recognizes derived quick_wins candidate paths', () => {
    expect(
      isCandidateTextViolationPath('evaluation_result_v2.recommendations.quick_wins[0].candidate_text_b'),
    ).toBe(true);
  });

  it('rejects non-candidate recommendation paths', () => {
    expect(
      isCandidateTextViolationPath('evaluation_result_v2.criteria[0].recommendations[0].action'),
    ).toBe(false);
  });

  it('rejects required prose paths', () => {
    expect(isCandidateTextViolationPath('evaluation_result_v2.criteria[0].fit_summary')).toBe(false);
  });
});

describe('quarantineCandidateFields', () => {
  it('removes only the specified candidate fields and leaves required prose untouched', () => {
    const synthesis = makeSynthesis() as any;
    const originalRationale = synthesis.criteria[0].final_rationale;
    const originalAction = synthesis.criteria[0].recommendations[0].action;

    const quarantined = quarantineCandidateFields(synthesis, [
      'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a',
      'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_c',
    ]);

    expect(quarantined).toContain('evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a');
    expect(quarantined).toContain('evaluation_result_v2.criteria[0].recommendations[0].candidate_text_c');
    expect(synthesis.criteria[0].recommendations[0].candidate_text_a).toBeUndefined();
    expect(synthesis.criteria[0].recommendations[0].candidate_text_c).toBeUndefined();
    expect(synthesis.criteria[0].recommendations[0].candidate_text_b).toBeDefined();
    expect(synthesis.criteria[0].final_rationale).toBe(originalRationale);
    expect(synthesis.criteria[0].recommendations[0].action).toBe(originalAction);
  });

  it('ignores paths that are not candidate fields', () => {
    const synthesis = makeSynthesis() as any;
    const quarantined = quarantineCandidateFields(synthesis, [
      'evaluation_result_v2.criteria[0].fit_summary',
      'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a',
    ]);

    expect(quarantined).toEqual(['evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a']);
    expect(synthesis.criteria[0].fit_summary).toBeDefined();
  });
});

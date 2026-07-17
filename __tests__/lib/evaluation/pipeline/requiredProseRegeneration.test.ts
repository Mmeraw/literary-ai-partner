import type { AuthorFacingIntegrityViolation } from '@/lib/text/authorFacingIntegrity';
import {
  assertOnlyRequestedPathsChanged,
  assertRequestedPathsChangedOrWereValid,
  quarantineCandidateFields,
  regenerateCandidateProse,
  regenerateRequiredProse,
} from '@/lib/evaluation/pipeline/requiredProseRegeneration';
import type { Pass3PreflightDraft, SinglePassOutput, SynthesisOutput } from '@/lib/evaluation/pipeline/types';

const createMock = jest.fn();

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    chat: {
      completions: {
        create: createMock,
      },
    },
  })),
}));

beforeEach(() => {
  createMock.mockReset();
  process.env.EVAL_OPENAI_MODEL = 'gpt-4o-mini';
});

function baseSynthesis(): SynthesisOutput {
  return {
    overall: {
      overall_score_0_100: 70,
      verdict: 'revise',
      one_paragraph_summary: 'Summary is complete.',
      top_3_strengths: ['Voice'],
      top_3_risks: ['Pacing'],
    },
    criteria: [
      {
        key: 'concept',
        final_score_0_10: 6,
        confidence_level: 'moderate',
        fit_summary: 'This fits because of strong concept execution.',
        gap_summary: 'The gap is limited thematic depth.',
        rationale: 'The rationale is sound.',
        final_rationale: 'The final rationale is sound.',
        evidence: [{ snippet: 'Evidence.', char_start: 0, char_end: 10 }],
        recommendations: [],
      },
    ],
    metadata: {},
  } as unknown as SynthesisOutput;
}

function synthesisWithRecommendation(): SynthesisOutput {
  return {
    overall: {
      overall_score_0_100: 70,
      verdict: 'revise',
      one_paragraph_summary: 'Summary is complete.',
      top_3_strengths: ['Voice'],
      top_3_risks: ['Pacing'],
    },
    criteria: [
      {
        key: 'concept',
        final_score_0_10: 6,
        confidence_level: 'moderate',
        fit_summary: 'This fits because of strong concept execution.',
        gap_summary: 'The gap is limited thematic depth.',
        rationale: 'The rationale is sound.',
        final_rationale: 'The final rationale is sound.',
        evidence: [{ snippet: 'Evidence.', char_start: 0, char_end: 10 }],
        recommendations: [
          {
            priority: 'medium',
            action: 'Clarify the protagonist’s goal.',
            expected_impact: 'Reader understands the stakes.',
            mechanism: 'The motivation is abstract.',
            specific_fix: 'Show the want explicitly.',
            reader_effect: 'Reader roots for the protagonist.',
            symptom: 'The goal feels assumed.',
            cause: 'The want is stated as backstory.',
            fix_direction: 'Move the want into the present scene.',
            candidate_text_a: 'She wanted the letter before he did.',
            candidate_text_b: 'She reached for the letter first.',
            candidate_text_c: 'The letter was already hers by need.',
            anchor_snippet: 'The letter lay on the desk.',
          },
        ],
      },
    ],
    metadata: {},
  } as unknown as SynthesisOutput;
}

describe('requiredProseRegeneration', () => {
  test('regenerates a required fit_summary field and applies only that path', async () => {
    const synthesis = baseSynthesis();
    synthesis.criteria[0].fit_summary = 'Incomplete';

    const violation: AuthorFacingIntegrityViolation = {
      path: 'evaluation_result_v2.criteria[0].fit_summary',
      code: 'AUTHOR_TEXT_TRUNCATED_WORD',
      value: 'Incomplete',
      message: 'truncated',
    };

    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              'evaluation_result_v2.criteria[0].fit_summary':
                'This is now a complete fit summary.',
            }),
          },
        },
      ],
    });

    const result = await regenerateRequiredProse(synthesis, [violation], {
      openaiApiKey: 'sk-test',
    });

    expect(result.ok).toBe(true);
    expect(result.regeneratedFields).toContain(
      'evaluation_result_v2.criteria[0].fit_summary',
    );
    expect(synthesis.criteria[0].fit_summary).toBe(
      'This is now a complete fit summary.',
    );
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  test('assertOnlyRequestedPathsChanged allows exact path and descendant changes', () => {
    const before = { a: 'old', b: { c: 'old' } };
    const after = { a: 'new', b: { c: 'old' } };
    expect(assertOnlyRequestedPathsChanged(before, after, ['synthesis.a'])).toEqual([]);

    const after2 = { a: 'old', b: { c: 'new' } };
    expect(
      assertOnlyRequestedPathsChanged(before, after2, ['synthesis.b']),
    ).toEqual([]);
  });

  test('assertOnlyRequestedPathsChanged rejects unrelated mutations', () => {
    const before = { a: 'old', b: 'old' };
    const after = { a: 'new', b: 'new' };
    expect(
      assertOnlyRequestedPathsChanged(before, after, ['synthesis.a']),
    ).toEqual(['synthesis.b']);
  });

  test('assertRequestedPathsChangedOrWereValid reports unchanged invalid paths', () => {
    const before = { a: 'incomplete' };
    const after = { a: 'incomplete' };
    expect(
      assertRequestedPathsChangedOrWereValid(before, after, ['synthesis.a']),
    ).toEqual(['synthesis.a']);
  });

  test('throws RepairRegenerationError when OpenAI returns no completion (undefined response)', async () => {
    const synthesis = baseSynthesis();
    synthesis.criteria[0].fit_summary = 'Incomplete';

    const violation: AuthorFacingIntegrityViolation = {
      path: 'evaluation_result_v2.criteria[0].fit_summary',
      code: 'AUTHOR_TEXT_TRUNCATED_WORD',
      value: 'Incomplete',
      message: 'truncated',
    };

    createMock.mockResolvedValueOnce(undefined);

    await expect(
      regenerateRequiredProse(synthesis, [violation], { openaiApiKey: 'sk-test' }),
    ).rejects.toMatchObject({
      name: 'RepairRegenerationError',
      code: 'REPAIR_REGENERATION_ERROR',
    });
  });

  test('throws RepairRegenerationError when OpenAI returns an empty choices array', async () => {
    const synthesis = baseSynthesis();
    synthesis.criteria[0].fit_summary = 'Incomplete';

    const violation: AuthorFacingIntegrityViolation = {
      path: 'evaluation_result_v2.criteria[0].fit_summary',
      code: 'AUTHOR_TEXT_TRUNCATED_WORD',
      value: 'Incomplete',
      message: 'truncated',
    };

    createMock.mockResolvedValueOnce({ choices: [] });

    await expect(
      regenerateRequiredProse(synthesis, [violation], { openaiApiKey: 'sk-test' }),
    ).rejects.toMatchObject({
      name: 'RepairRegenerationError',
      code: 'REPAIR_REGENERATION_ERROR',
    });
  });

  test('assertOnlyRequestedPathsChanged normalizes bracket and dot notation identically', () => {
    const before = { criteria: [{ fit_summary: 'old' }] };
    const after = { criteria: [{ fit_summary: 'new' }] };
    expect(
      assertOnlyRequestedPathsChanged(before, after, [
        'synthesis.criteria[0].fit_summary',
      ]),
    ).toEqual([]);
    expect(
      assertOnlyRequestedPathsChanged(before, after, [
        'synthesis.criteria.0.fit_summary',
      ]),
    ).toEqual([]);
    expect(
      assertOnlyRequestedPathsChanged(before, after, [
        'evaluation_result_v2.criteria[0].fit_summary',
      ]),
    ).toEqual([]);
  });

  test('assertOnlyRequestedPathsChanged rejects parent replacement when a child is requested', () => {
    const before = { criteria: [{ fit_summary: 'old' }] };
    const after = { criteria: ['replaced'] };
    const illegal = assertOnlyRequestedPathsChanged(before, after, [
      'synthesis.criteria[0].fit_summary',
    ]);
    expect(illegal).toContain('synthesis.criteria[0]');
  });

  test('assertOnlyRequestedPathsChanged rejects sibling mutations', () => {
    const before = { criteria: [{ fit_summary: 'old', gap_summary: 'old' }] };
    const after = { criteria: [{ fit_summary: 'old', gap_summary: 'new' }] };
    const illegal = assertOnlyRequestedPathsChanged(before, after, [
      'synthesis.criteria[0].fit_summary',
    ]);
    expect(illegal).toEqual(['synthesis.criteria[0].gap_summary']);
  });

  test('assertRequestedPathsChangedOrWereValid accepts unchanged already-valid prose', () => {
    const before = { a: 'This is complete.' };
    const after = { a: 'This is complete.' };
    expect(
      assertRequestedPathsChangedOrWereValid(before, after, ['synthesis.a']),
    ).toEqual([]);
  });

  test('assertRequestedPathsChangedOrWereValid rejects unchanged invalid prose', () => {
    const before = { a: 'incomplete' };
    const after = { a: 'incomplete' };
    expect(
      assertRequestedPathsChangedOrWereValid(before, after, ['synthesis.a']),
    ).toEqual(['synthesis.a']);
  });

  test('assertRequestedPathsChangedOrWereValid rejects changed but still-invalid prose', () => {
    const before = { a: 'incomplete' };
    const after = { a: 'also incomplete' };
    expect(
      assertRequestedPathsChangedOrWereValid(before, after, ['synthesis.a']),
    ).toEqual(['synthesis.a']);
  });

  test('assertRequestedPathsChangedOrWereValid accepts changed prose that becomes valid', () => {
    const before = { a: 'incomplete' };
    const after = { a: 'This is now complete.' };
    expect(
      assertRequestedPathsChangedOrWereValid(before, after, ['synthesis.a']),
    ).toEqual([]);
  });

  test('regenerates multiple required fields in one call and leaves unaffected content byte-identical', async () => {
    const synthesis = baseSynthesis();
    const original = JSON.stringify(synthesis);
    synthesis.criteria[0].fit_summary = 'Incomplete';
    synthesis.criteria[0].gap_summary = 'Incomplete';

    const violations: AuthorFacingIntegrityViolation[] = [
      {
        path: 'evaluation_result_v2.criteria[0].fit_summary',
        code: 'AUTHOR_TEXT_TRUNCATED_WORD',
        value: 'Incomplete',
        message: 'truncated',
      },
      {
        path: 'evaluation_result_v2.criteria[0].gap_summary',
        code: 'AUTHOR_TEXT_TRUNCATED_WORD',
        value: 'Incomplete',
        message: 'truncated',
      },
    ];

    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              'evaluation_result_v2.criteria[0].fit_summary':
                'Fit is complete now.',
              'evaluation_result_v2.criteria[0].gap_summary':
                'Gap is complete now.',
            }),
          },
        },
      ],
    });

    const result = await regenerateRequiredProse(synthesis, violations, {
      openaiApiKey: 'sk-test',
    });

    expect(result.ok).toBe(true);
    expect(result.regeneratedFields).toHaveLength(2);
    expect(synthesis.criteria[0].fit_summary).toBe('Fit is complete now.');
    expect(synthesis.criteria[0].gap_summary).toBe('Gap is complete now.');

    // Revert only the regenerated fields; the rest of the artifact must match.
    const patched = JSON.parse(JSON.stringify(synthesis));
    patched.criteria[0].fit_summary = JSON.parse(original).criteria[0].fit_summary;
    patched.criteria[0].gap_summary = JSON.parse(original).criteria[0].gap_summary;
    expect(JSON.stringify(patched)).toBe(original);
  });

  test('rejects an unchanged invalid replacement', async () => {
    const synthesis = baseSynthesis();
    synthesis.criteria[0].fit_summary = 'Incomplete';

    const violation: AuthorFacingIntegrityViolation = {
      path: 'evaluation_result_v2.criteria[0].fit_summary',
      code: 'AUTHOR_TEXT_TRUNCATED_WORD',
      value: 'Incomplete',
      message: 'truncated',
    };

    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              'evaluation_result_v2.criteria[0].fit_summary': 'Incomplete',
            }),
          },
        },
      ],
    });

    const result = await regenerateRequiredProse(synthesis, [violation], {
      openaiApiKey: 'sk-test',
    });

    expect(result.ok).toBe(false);
    expect(result.failedFields).toContain(
      'evaluation_result_v2.criteria[0].fit_summary',
    );
    // The original value must be preserved unchanged.
    expect(synthesis.criteria[0].fit_summary).toBe('Incomplete');
  });

  function extractPayload(prompt: string): Record<string, unknown> {
    const start = prompt.indexOf('PAYLOAD:\n') + 'PAYLOAD:\n'.length;
    const end = prompt.indexOf('\n\nOUTPUT RULES:');
    return JSON.parse(prompt.slice(start, end));
  }

  test('uses preflight strength/weakness findings in the prompt without claiming Pass 1/2 provenance', async () => {
    const synthesis = baseSynthesis();
    synthesis.criteria[0].fit_summary = 'Incomplete';

    const violation: AuthorFacingIntegrityViolation = {
      path: 'evaluation_result_v2.criteria[0].fit_summary',
      code: 'AUTHOR_TEXT_TRUNCATED_WORD',
      value: 'Incomplete',
      message: 'truncated',
    };

    const pass3PreflightDraft = {
      schema_version: 'pass3_preflight_draft_v1',
      pass: '3A',
      visibility: 'internal_only',
      criterionDrafts: [
        {
          criterion: 'concept',
          provisionalScore: 6,
          confidence: 'moderate',
          findingStatus: 'scored',
          rationale: 'The concept is clear.',
          evidenceQuotes: ['Quoted passage.'],
          actZonesSupporting: [],
          strengthFindings: ['POV is strong.'],
          weaknessFindings: ['Pacing drags.'],
        },
      ],
    } as unknown as Pass3PreflightDraft;

    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              'evaluation_result_v2.criteria[0].fit_summary':
                'This is complete now.',
            }),
          },
        },
      ],
    });

    await regenerateRequiredProse(synthesis, [violation], {
      openaiApiKey: 'sk-test',
      pass3PreflightDraft,
    });

    const prompt = createMock.mock.calls[0][0].messages[1].content as string;
    const payload = extractPayload(prompt);
    const criterion = payload.criterion as Record<string, unknown>;
    expect(criterion.preflight_strength_findings).toEqual(['POV is strong.']);
    expect(criterion.preflight_weakness_findings).toEqual(['Pacing drags.']);
    // Pass 1/2 findings are not claimed from Pass 3A preflight strength/weakness.
    expect(criterion.pass1_findings).toEqual([]);
    expect(criterion.pass2_findings).toEqual([]);
    expect(criterion.evidence_anchors).not.toEqual(
      criterion.preflight_strength_findings,
    );
    expect(criterion.evidence_anchors).not.toEqual(
      criterion.preflight_weakness_findings,
    );
  });

  test('falls back to empty preflight and pass1/2 findings when context is missing', async () => {
    const synthesis = baseSynthesis();
    synthesis.criteria[0].fit_summary = 'Incomplete';

    const violation: AuthorFacingIntegrityViolation = {
      path: 'evaluation_result_v2.criteria[0].fit_summary',
      code: 'AUTHOR_TEXT_TRUNCATED_WORD',
      value: 'Incomplete',
      message: 'truncated',
    };

    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              'evaluation_result_v2.criteria[0].fit_summary':
                'This is complete now.',
            }),
          },
        },
      ],
    });

    await regenerateRequiredProse(synthesis, [violation], {
      openaiApiKey: 'sk-test',
    });

    const prompt = createMock.mock.calls[0][0].messages[1].content as string;
    const payload = extractPayload(prompt);
    const criterion = payload.criterion as Record<string, unknown>;
    expect(criterion.pass1_findings).toEqual([]);
    expect(criterion.pass2_findings).toEqual([]);
    expect(criterion.preflight_strength_findings).toEqual([]);
    expect(criterion.preflight_weakness_findings).toEqual([]);
  });

  test('uses provenanced Pass 1 and Pass 2 rationales as pass1_findings and pass2_findings', async () => {
    const synthesis = baseSynthesis();
    synthesis.criteria[0].fit_summary = 'Incomplete';

    const violation: AuthorFacingIntegrityViolation = {
      path: 'evaluation_result_v2.criteria[0].fit_summary',
      code: 'AUTHOR_TEXT_TRUNCATED_WORD',
      value: 'Incomplete',
      message: 'truncated',
    };

    const pass1Output = {
      pass: 1,
      axis: 'craft_execution',
      model: 'gpt-4o',
      prompt_version: 'v1',
      temperature: 0,
      generated_at: new Date().toISOString(),
      criteria: [
        {
          key: 'concept',
          score_0_10: 6,
          rationale: 'Pass 1 craft rationale.',
          evidence: [],
          recommendations: [
            {
              priority: 'high',
              action: 'Pass 1 recommended action.',
              expected_impact: 'Fixes the issue.',
              anchor_snippet: 'snippet',
              issue_family: 'characterization',
              strategic_lever: 'scene_goal_clarity',
              revision_granularity: 'scene',
            },
          ],
        },
      ],
    } as unknown as SinglePassOutput;

    const pass2Output = {
      pass: 2,
      axis: 'editorial_literary',
      model: 'o3',
      prompt_version: 'v1',
      temperature: 0,
      generated_at: new Date().toISOString(),
      criteria: [
        {
          key: 'concept',
          score_0_10: 6,
          rationale: 'Pass 2 editorial rationale.',
          evidence: [],
          recommendations: [],
        },
      ],
    } as unknown as SinglePassOutput;

    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              'evaluation_result_v2.criteria[0].fit_summary':
                'This is complete now.',
            }),
          },
        },
      ],
    });

    await regenerateRequiredProse(synthesis, [violation], {
      openaiApiKey: 'sk-test',
      pass1Output,
      pass2Output,
    });

    const prompt = createMock.mock.calls[0][0].messages[1].content as string;
    const payload = extractPayload(prompt);
    const criterion = payload.criterion as Record<string, unknown>;
    expect(criterion.pass1_findings).toEqual([
      'Pass 1 craft rationale.',
      'Pass 1 recommended action.',
    ]);
    expect(criterion.pass2_findings).toEqual([
      'Pass 2 editorial rationale.',
    ]);
    // Provenanced pass findings are distinct from preflight strength/weakness.
    expect(criterion.pass1_findings).not.toEqual(
      criterion.preflight_strength_findings,
    );
    expect(criterion.pass2_findings).not.toEqual(
      criterion.preflight_weakness_findings,
    );
  });

  describe('candidateProseRegeneration', () => {
    test('regenerates candidate_text_a and preserves required fields byte-identical', async () => {
      const synthesis = synthesisWithRecommendation();
      const original = JSON.stringify(synthesis);
      synthesis.criteria[0].recommendations[0].candidate_text_a = 'MJ reached toward the pack and';

      const violation: AuthorFacingIntegrityViolation = {
        path: 'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a',
        code: 'AUTHOR_TEXT_MIDSENTENCE_TERMINATION',
        value: 'MJ reached toward the pack and',
        message: 'ends mid-sentence',
      };

      createMock.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a':
                  'She reached for the letter first.',
              }),
            },
          },
        ],
      });

      const result = await regenerateCandidateProse(synthesis, [violation], {
        openaiApiKey: 'sk-test',
      });

      expect(result.ok).toBe(true);
      expect(result.regeneratedFields).toContain(
        'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a',
      );
      expect(synthesis.criteria[0].recommendations[0].candidate_text_a).toBe(
        'She reached for the letter first.',
      );

      const patched = JSON.parse(JSON.stringify(synthesis));
      patched.criteria[0].recommendations[0].candidate_text_a = JSON.parse(original).criteria[0].recommendations[0].candidate_text_a;
      expect(JSON.stringify(patched)).toBe(original);
    });

    test('candidate prompt includes variant identity and copy-paste instruction', async () => {
      const synthesis = synthesisWithRecommendation();
      synthesis.criteria[0].recommendations[0].candidate_text_b = 'MJ reached toward the pack and';

      const violation: AuthorFacingIntegrityViolation = {
        path: 'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_b',
        code: 'AUTHOR_TEXT_MIDSENTENCE_TERMINATION',
        value: 'MJ reached toward the pack and',
        message: 'ends mid-sentence',
      };

      createMock.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_b':
                  'She grabbed the letter first.',
              }),
            },
          },
        ],
      });

      await regenerateCandidateProse(synthesis, [violation], { openaiApiKey: 'sk-test' });

      const prompt = createMock.mock.calls[0][0].messages[1].content as string;
      expect(prompt).toContain('variant B');
      expect(prompt).toContain('copy-paste manuscript prose');
      expect(prompt).not.toContain('Revise the targeted passage so the craft signal lands more clearly');
      expect(prompt).not.toContain('This addresses the craft signal');
    });

    test('candidate regeneration cannot modify another candidate variant', async () => {
      const synthesis = synthesisWithRecommendation();

      synthesis.criteria[0].recommendations[0].candidate_text_a =
        'The protagonist reaches for the';

      const recommendation = synthesis.criteria[0].recommendations[0];

      const candidateAPath =
        'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a';
      const candidateBPath =
        'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_b';

      const originalCandidateA = recommendation.candidate_text_a;
      const originalCandidateB = recommendation.candidate_text_b;
      const originalFitSummary = synthesis.criteria[0].fit_summary;
      const beforeHadCandidateCKey = 'candidate_text_c' in recommendation;
      const before = JSON.stringify(synthesis);

      const violation: AuthorFacingIntegrityViolation = {
        path: candidateAPath,
        code: 'AUTHOR_TEXT_MIDSENTENCE_TERMINATION',
        value: originalCandidateA,
        message: 'ends mid-sentence',
      };

      createMock.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                [candidateAPath]: 'Valid replacement for A.',
                [candidateBPath]: 'Illegally rewritten adjacent candidate.',
              }),
            },
          },
        ],
      });

      const result = await regenerateCandidateProse(synthesis, [violation], {
        openaiApiKey: 'sk-test',
      });

      expect(result.ok).toBe(false);
      expect(result.failedFields).toContain(candidateAPath);
      expect(result.mutationBoundaryViolations.some((p) => p.includes('candidate_text_b'))).toBe(
        true,
      );

      // restoreFromSnapshot replaces the top-level synthesis tree, so verify
      // through the restored synthesis object rather than a stale reference.
      expect(synthesis.criteria[0].recommendations[0].candidate_text_a).toBe(originalCandidateA);
      expect(synthesis.criteria[0].recommendations[0].candidate_text_b).toBe(originalCandidateB);
      expect(synthesis.criteria[0].fit_summary).toBe(originalFitSummary);

      expect('candidate_text_c' in synthesis.criteria[0].recommendations[0]).toBe(
        beforeHadCandidateCKey,
      );

      expect(JSON.stringify(synthesis)).toBe(before);
    });

    test('two failed attempts leave the candidate unresolved', async () => {
      const synthesis = synthesisWithRecommendation();
      synthesis.criteria[0].recommendations[0].candidate_text_a = 'MJ reached toward the pack and';

      const violation: AuthorFacingIntegrityViolation = {
        path: 'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a',
        code: 'AUTHOR_TEXT_MIDSENTENCE_TERMINATION',
        value: 'MJ reached toward the pack and',
        message: 'ends mid-sentence',
      };

      createMock.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a':
                  'Still incomplete',
              }),
            },
          },
        ],
      });

      const result = await regenerateCandidateProse(synthesis, [violation], {
        openaiApiKey: 'sk-test',
        maxAttempts: 2,
      });

      expect(result.ok).toBe(false);
      expect(result.telemetry.attempts).toBe(2);
      expect(result.failedFields).toContain(
        'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a',
      );
    });

    test('quarantineCandidateFields removes only the requested candidate fields', () => {
      const synthesis = synthesisWithRecommendation();
      const quarantined = quarantineCandidateFields(synthesis, [
        'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a',
      ]);

      expect(quarantined).toEqual([
        'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a',
      ]);
      expect(synthesis.criteria[0].recommendations[0].candidate_text_a).toBeUndefined();
      expect(synthesis.criteria[0].recommendations[0].candidate_text_b).toBeDefined();
      expect(synthesis.criteria[0].recommendations[0].candidate_text_c).toBeDefined();
    });
  });
});

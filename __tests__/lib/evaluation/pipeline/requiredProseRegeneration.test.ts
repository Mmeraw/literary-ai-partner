import type { AuthorFacingIntegrityViolation } from '@/lib/text/authorFacingIntegrity';
import {
  assertOnlyRequestedPathsChanged,
  assertRequestedPathsChangedOrWereValid,
  regenerateRequiredProse,
  RepairRegenerationError,
} from '@/lib/evaluation/pipeline/requiredProseRegeneration';
import type { Pass3PreflightDraft, SynthesisOutput } from '@/lib/evaluation/pipeline/types';

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
});

import type { AuthorFacingIntegrityViolation } from '@/lib/text/authorFacingIntegrity';
import {
  assertOnlyRequestedPathsChanged,
  assertRequestedPathsChangedOrWereValid,
  regenerateRequiredProse,
} from '@/lib/evaluation/pipeline/requiredProseRegeneration';
import type { SynthesisOutput } from '@/lib/evaluation/pipeline/types';

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
});

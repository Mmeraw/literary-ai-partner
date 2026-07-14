import {
  AuthorFacingIntegrityError,
  assertAuthorFacingIntegrity,
  inspectAuthorFacingIntegrity,
} from '../authorFacingIntegrity';

describe('RG-TEXT-1 author-facing integrity authority', () => {
  it('accepts complete long-form author-facing prose without mutating it', () => {
    const artifact = {
      overview: {
        one_paragraph_summary:
          'The manuscript earns its score through a distinctive voice and emotionally specific framing. Its principal revision need is structural: the airport sequence must preserve forward motion while integrating the surveillance material more selectively. The first priority is therefore to consolidate exposition around the protagonist’s immediate choices and consequences.',
        top_3_strengths: [
          'The father-and-son frame gives the embedded crime narrative emotional consequence and thematic coherence.',
        ],
        top_3_risks: [
          'The surveillance exposition occasionally interrupts the airport sequence before the immediate dramatic question has fully developed.',
        ],
      },
      recommendations: {
        quick_wins: [
          {
            action: 'Condense the first surveillance explanation so the airport objective remains active throughout the paragraph.',
            why: 'This preserves narrative momentum without sacrificing the political context that distinguishes the manuscript.',
            reader_effect: 'The reader remains oriented toward the immediate danger while still understanding the wider system of control.',
          },
        ],
      },
    };

    const before = JSON.stringify(artifact);
    expect(inspectAuthorFacingIntegrity(artifact, { rootPath: 'evaluation_result_v2' })).toEqual([]);
    expect(() => assertAuthorFacingIntegrity(artifact)).not.toThrow();
    expect(JSON.stringify(artifact)).toBe(before);
  });

  it.each([
    ['terminal unicode ellipsis', 'The pacing weakens when the airport se…', 'AUTHOR_TEXT_TRUNCATION_ELLIPSIS'],
    ['terminal three-dot ellipsis', 'The pacing weakens when the airport se...', 'AUTHOR_TEXT_TRUNCATION_ELLIPSIS'],
    ['mid-sentence ending', 'The pacing weakens because the surveillance material', 'AUTHOR_TEXT_MIDSENTENCE_TERMINATION'],
    ['dangling connective', 'The pacing weakens in the airport sequence because', 'AUTHOR_TEXT_MIDSENTENCE_TERMINATION'],
    ['unmatched parenthesis', 'Clarify the emotional turn (especially after the airport scene.', 'AUTHOR_TEXT_UNBALANCED_DELIMITER'],
    ['placeholder', 'Revise [insert stronger ending here].', 'AUTHOR_TEXT_PLACEHOLDER'],
  ])('rejects %s', (_label, value, code) => {
    const violations = inspectAuthorFacingIntegrity(
      { overview: { top_3_risks: [value] } },
      { rootPath: 'evaluation_result_v2' },
    );
    expect(violations.map((violation) => violation.code)).toContain(code);
    expect(() => assertAuthorFacingIntegrity({ overview: { top_3_risks: [value] } })).toThrow(
      AuthorFacingIntegrityError,
    );
  });

  it('walks every generated recommendation prose field rather than only action', () => {
    const artifact = {
      recommendations: {
        quick_wins: [
          {
            action: 'Reorder the airport beats so the protagonist’s objective remains visible.',
            why: 'The current explanation loses pressure when it shifts into surveill…',
            mechanism: 'Use scene-and-sequel sequencing.',
            specific_fix: 'Move the Five Eyes explanation after the immediate customs decision.',
            reader_effect: 'The reader experiences the danger before receiving the contextual explanation.',
            candidate_text_a: 'He watched the customs officer turn the passport over once, then twice.',
          },
        ],
      },
    };

    const violations = inspectAuthorFacingIntegrity(artifact, { rootPath: 'evaluation_result_v2' });
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'evaluation_result_v2.recommendations.quick_wins[0].why',
          code: 'AUTHOR_TEXT_TRUNCATION_ELLIPSIS',
        }),
      ]),
    );
  });

  it('does not treat verbatim manuscript evidence as generated prose by default', () => {
    const artifact = {
      criteria: [
        {
          rationale: 'The criterion is supported by a recurring conflict between grief and moral instruction.',
          evidence: [{ snippet: 'I thought perhaps…' }],
        },
      ],
    };

    expect(inspectAuthorFacingIntegrity(artifact, { rootPath: 'evaluation_result_v2' })).toEqual([]);
    expect(
      inspectAuthorFacingIntegrity(artifact, {
        rootPath: 'evaluation_result_v2',
        inspectSourceQuotations: true,
      }).map((violation) => violation.code),
    ).toContain('AUTHOR_TEXT_TRUNCATION_ELLIPSIS');
  });
});

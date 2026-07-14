import {
  AuthorFacingIntegrityError,
  assertAuthorFacingIntegrity,
  inspectAuthorFacingIntegrity,
} from '../authorFacingIntegrity';

describe('RG-TEXT-1 and mandatory RG-CMOS author-facing authority', () => {
  it('accepts complete CMOS-aligned author-facing prose without mutating it', () => {
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
    ['unmatched parenthesis', 'Clarify the emotional turn (especially after the airport scene.', 'AUTHOR_TEXT_UNBALANCED_DELIMITER'],
    ['unmatched curly quotation mark', 'Clarify the “emotional turn before the airport scene.', 'AUTHOR_TEXT_UNBALANCED_DELIMITER'],
    ['placeholder', 'Revise [insert stronger ending here].', 'AUTHOR_TEXT_PLACEHOLDER'],
    ['lowercase sentence start', 'clarify the emotional turn before the airport scene.', 'AUTHOR_TEXT_LOWERCASE_START'],
    ['lowercase second sentence', 'Clarify the emotional turn. then restore the airport objective.', 'AUTHOR_TEXT_LOWERCASE_SENTENCE_START'],
    ['space before punctuation', 'Clarify the emotional turn , then restore pressure.', 'AUTHOR_TEXT_SPACE_BEFORE_PUNCTUATION'],
    ['missing space after comma', 'Clarify the emotional turn,then restore pressure.', 'AUTHOR_TEXT_MISSING_SPACE_AFTER_PUNCTUATION'],
    ['repeated punctuation', 'Clarify the emotional turn!! Then restore pressure.', 'AUTHOR_TEXT_REPEATED_PUNCTUATION'],
    ['double hyphen', 'Clarify the emotional turn--then restore pressure.', 'AUTHOR_TEXT_DOUBLE_HYPHEN'],
    ['repeated whitespace', 'Clarify the emotional turn.  Then restore pressure.', 'AUTHOR_TEXT_REPEATED_WHITESPACE'],
    ['duplicate word', 'Clarify the the emotional turn before the airport scene.', 'AUTHOR_TEXT_DUPLICATE_WORD'],
    ['bare number plus hyphen', '1- Clarify the emotional turn.', 'AUTHOR_TEXT_NUMBER_DASH_SEQUENCE'],
    ['number-period plus hyphen', '1.- Clarify the emotional turn.', 'AUTHOR_TEXT_NUMBER_DASH_SEQUENCE'],
    ['number-period plus en dash', '1.– Clarify the emotional turn.', 'AUTHOR_TEXT_NUMBER_DASH_SEQUENCE'],
    ['number-period plus em dash', '1.— Clarify the emotional turn.', 'AUTHOR_TEXT_NUMBER_DASH_SEQUENCE'],
    ['number-period plus double hyphen', '1.-- Clarify the emotional turn.', 'AUTHOR_TEXT_NUMBER_DASH_SEQUENCE'],
    ['number-parenthesis plus em dash', '1)— Clarify the emotional turn.', 'AUTHOR_TEXT_NUMBER_DASH_SEQUENCE'],
  ])('rejects %s in phrase-allowed risk bullets', (_label, value, code) => {
    const violations = inspectAuthorFacingIntegrity(
      { overview: { top_3_risks: [value] } },
      { rootPath: 'evaluation_result_v2' },
    );
    expect(violations.map((violation) => violation.code)).toContain(code);
    expect(() => assertAuthorFacingIntegrity({ overview: { top_3_risks: [value] } })).toThrow(
      AuthorFacingIntegrityError,
    );
  });

  it.each([
    ['mid-sentence ending', 'The pacing weakens because the surveillance material'],
    ['dangling connective', 'The pacing weakens in the airport sequence because'],
  ])('rejects %s in sentence-required prose', (_label, value) => {
    const artifact = { overview: { one_paragraph_summary: value } };
    const violations = inspectAuthorFacingIntegrity(artifact, { rootPath: 'evaluation_result_v2' });
    expect(violations.map((violation) => violation.code)).toContain('AUTHOR_TEXT_MIDSENTENCE_TERMINATION');
    expect(() => assertAuthorFacingIntegrity(artifact)).toThrow(AuthorFacingIntegrityError);
  });

  it.each([
    '1. Clarify the emotional turn.',
    '1) Clarify the emotional turn.',
    '10. Consolidate the surveillance exposition.',
    'The reporting period covers 2026–2027.',
    'The evaluation was generated on 2026-07-14.',
  ])('accepts valid numbered prose, dates, and ranges: %s', (value) => {
    expect(
      inspectAuthorFacingIntegrity(
        { recommendations: { quick_wins: [{ action: value }] } },
        { rootPath: 'evaluation_result_v2' },
      ),
    ).toEqual([]);
  });

  it('allows capitalized strength and risk phrases without an arbitrary length threshold', () => {
    expect(
      inspectAuthorFacingIntegrity(
        {
          overview: {
            top_3_strengths: ['Distinctive narrative voice'],
            top_3_risks: [
              'Uneven midpoint pressure caused by the repeated transition pattern across several consecutive chapters',
            ],
          },
        },
        { rootPath: 'evaluation_result_v2' },
      ),
    ).toEqual([]);
  });

  it('allows labeled recommendation fragments while preserving structural checks', () => {
    expect(
      inspectAuthorFacingIntegrity(
        {
          recommendations: {
            quick_wins: [
              {
                mechanism: 'the criterion lacks grounding in specific textual moments',
                specific_fix: 'grounding the criterion in specific textual moments',
                reader_effect: 'clearer escalation and stronger reader orientation',
              },
            ],
          },
        },
        { rootPath: 'evaluation_result_v2' },
      ),
    ).toEqual([]);
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

  it('inspects singular specific_fix fields for structural defects', () => {
    const violations = inspectAuthorFacingIntegrity(
      {
        recommendations: {
          quick_wins: [{ specific_fix: 'move the explanation after the customs decision…' }],
        },
      },
      { rootPath: 'evaluation_result_v2' },
    );
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'evaluation_result_v2.recommendations.quick_wins[0].specific_fix',
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

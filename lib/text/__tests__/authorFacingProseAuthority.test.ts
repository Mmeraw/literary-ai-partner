import {
  inspectAuthorFacingProse,
  inspectRegisteredAuthorFacingArtifact,
  resolveAuthorFacingFieldContract,
} from '../authorFacingProseAuthority';

describe('authorFacingProseAuthority', () => {
  it('resolves canonical, derived, candidate, and excluded path contracts', () => {
    expect(
      resolveAuthorFacingFieldContract(
        'evaluation_result_v2.criteria[0].recommendations[1].expected_impact',
      ),
    ).toMatchObject({ ownership: 'canonical', repairPolicy: 'regenerate' });

    expect(
      resolveAuthorFacingFieldContract(
        'evaluation_result_v2.recommendations.strategic_revisions[0].why',
      ),
    ).toMatchObject({ ownership: 'derived', repairPolicy: 'regenerate' });

    expect(
      resolveAuthorFacingFieldContract(
        'evaluation_result_v2.criteria[0].recommendations[1].candidate_text_a',
      ),
    ).toMatchObject({
      kind: 'candidate',
      required: false,
      repairPolicy: 'candidate_regenerate_or_quarantine',
    });

    expect(
      resolveAuthorFacingFieldContract(
        'evaluation_result_v2.criteria[0].evidence[0].snippet',
      ),
    ).toMatchObject({ ownership: 'excluded', repairPolicy: 'none' });
  });

  it('preserves existing violation codes through the single-field API', () => {
    const violations = inspectAuthorFacingProse({
      text: 'The recommendation ends because…',
      fieldPath:
        'evaluation_result_v2.criteria[0].recommendations[0].expected_impact',
      fieldKind: 'sentence',
    });

    expect(violations.map(({ code }) => code)).toContain(
      'AUTHOR_TEXT_TRUNCATION_ELLIPSIS',
    );
  });

  it('reports registry gaps instead of silently guessing ownership', () => {
    const artifact = {
      overview: {
        one_paragraph_summary: 'This summary is complete.',
      },
      criteria: [
        {
          market_summary: 'This unregistered author-facing summary ends',
        },
      ],
    };

    const result = inspectRegisteredAuthorFacingArtifact(artifact);

    expect(result.unregisteredPaths).toEqual([
      'evaluation_result_v2.criteria[0].market_summary',
    ]);
    expect(result.violations).toEqual([]);
  });

  it('returns no violations for a registered complete projection', () => {
    const artifact = {
      overview: {
        one_paragraph_summary: 'The report provides a complete editorial summary.',
        one_sentence_pitch: 'A protagonist confronts the cost of self-deception.',
        one_paragraph_pitch: 'A protagonist confronts the cost of self-deception and changes course.',
        top_3_strengths: ['The narrative voice remains distinctive.'],
        top_3_risks: ['The middle section loses momentum.'],
      },
      criteria: [
        {
          rationale: 'The criterion is supported by concrete evidence.',
          final_rationale: 'The criterion earns its score because the evidence is consistent.',
          fit_summary: 'The manuscript demonstrates a clear strength in this area.',
          gap_summary: 'The remaining gap is specific and repairable.',
          recommendations: [
            {
              action: 'Clarify the scene goal before the midpoint.',
              expected_impact: 'Readers will understand the immediate stakes.',
              candidate_text_a: 'State the protagonist’s objective in the opening exchange.',
            },
          ],
        },
      ],
      recommendations: {
        quick_wins: [
          {
            action: 'Clarify the scene goal before the midpoint.',
            why: 'Readers will understand the immediate stakes.',
          },
        ],
        strategic_revisions: [],
      },
    };

    const result = inspectRegisteredAuthorFacingArtifact(artifact);
    expect(result.violations).toEqual([]);
    expect(result.unregisteredPaths).toEqual([]);
  });
});

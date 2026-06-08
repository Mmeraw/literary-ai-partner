import {
  compareSisterArtifacts,
  evaluateContaminationCodes,
  evaluateSectionCheckpoints,
} from '@/lib/evaluation/qa/sisterArtifactRegressionComparator';

describe('sisterArtifactRegressionComparator', () => {
  test('evaluates section checkpoint coverage from artifact text', () => {
    const text = [
      'Overall Score: 67',
      'Market Readiness: Developing',
      'One-Paragraph Pitch',
      'Executive Summary',
      'Top Strengths',
      'Top Risks',
      'Criteria Score Grid',
    ].join('\n');

    const checkpoints = evaluateSectionCheckpoints(text);
    const present = checkpoints.filter((entry) => entry.present).map((entry) => entry.id);

    expect(present).toEqual(expect.arrayContaining([
      'title_block',
      'one_paragraph_pitch',
      'executive_summary',
      'top_strengths',
      'top_risks',
      'criteria_score_grid',
    ]));
  });

  test('detects malformed/off-topic contamination fragments', () => {
    const text = [
      'This could would tighten with better sequencing.',
      'At the scene level, studies are mixed on the success of safe injection sites.',
      'This may benefit from one because the chain is broken.',
    ].join(' ');

    const codes = evaluateContaminationCodes(text);
    expect(codes).toEqual(expect.arrayContaining([
      'MALFORMED_DOUBLE_MODAL',
      'MALFORMED_BENEFIT_FROM_ONE_BECAUSE',
      'OFF_TOPIC_STUDIES_ARE_MIXED',
      'OFF_TOPIC_SAFE_INJECTION_SITES',
    ]));
  });

  test('computes deltas against TXT baseline coverage and contamination', () => {
    const report = compareSisterArtifacts(
      [
        {
          artifactId: 'revision-grade-sister (1).txt',
          role: 'product TXT export',
          text: [
            'Overall Score',
            'Market Readiness',
            'One-Paragraph Pitch',
            'One-Sentence Pitch',
            'Premise',
            'Executive Summary',
            'Top Strengths',
            'Top Risks',
            'Top Recommendations',
            'Criteria Score Grid',
            'Criterion Rationales and Opportunities',
            'Confidence Explanation',
            'Author Disclaimer',
          ].join('\n'),
        },
        {
          artifactId: 'revision-grade-sister (1).docx',
          role: 'product Word export',
          text: ['Overall Score', 'Top Strengths', 'Top Risks', 'This could would collapse.'].join('\n'),
        },
      ],
      'revision-grade-sister (1).txt',
    );

    expect(report.artifacts).toHaveLength(2);
    const delta = report.deltasAgainstBaseline[0];
    expect(delta?.artifactId).toBe('revision-grade-sister (1).docx');
    expect(delta?.missingAgainstBaseline.length).toBeGreaterThan(0);
    expect(delta?.additionalContaminationAgainstBaseline).toContain('MALFORMED_DOUBLE_MODAL');
    expect(delta?.coverageDelta).toBeLessThan(0);
  });
});
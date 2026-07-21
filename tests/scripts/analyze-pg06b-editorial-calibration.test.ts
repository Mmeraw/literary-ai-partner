import { describe, expect, it } from '@jest/globals';
import {
  analyzePg06bDocuments,
  formatPg06bMarkdown,
} from '../../scripts/governance/analyze-pg06b-editorial-calibration';

describe('analyzePg06bDocuments', () => {
  it('classifies missing weak dispositions as propagation gaps, not editorial calibration', () => {
    const result = analyzePg06bDocuments([
      {
        sourceFile: 'missing-disposition.json',
        document: {
          overview: { overall_score_0_100: 82 },
          criteria: [
            { key: 'concept', score_0_10: 6, recommendations: [], evidence: [{}] },
            { key: 'voice', score_0_10: 8, recommendations: [{ action: 'x' }], evidence: [{}] },
            { key: 'theme', score_0_10: 9, recommendations: [], evidence: [{}] },
          ],
        },
      },
    ]);

    expect(result.candidateCaseCount).toBe(1);
    expect(result.aggregateClassificationCounts.propagation_gap_missing_disposition).toBe(1);
    expect(result.aggregateClassificationCounts.strong_criterion_empty_legacy_compatible).toBe(1);
    expect(result.aggregateClassificationCounts.valid_governed_suppression_requires_editorial_adjudication).toBe(0);
  });

  it('routes valid governed zero-recommendation weak criteria to editorial adjudication', () => {
    const result = analyzePg06bDocuments([
      {
        sourceFile: 'governed-suppression.json',
        document: {
          overview: { overall_score_0_100: 78 },
          criteria: [
            {
              key: 'pacing',
              score_0_10: 6,
              recommendations: [],
              recommendation_status: 'insufficient_evidence',
              recommendation_status_rationale: 'The diagnosis is plausible, but the available anchor is not specific enough to prescribe a safe revision.',
              evidence: [{}],
            },
            { key: 'voice', score_0_10: 8, recommendations: [{ action: 'x' }], evidence: [{}] },
            { key: 'theme', score_0_10: 9, recommendations: [], evidence: [{}] },
          ],
        },
      },
    ]);

    expect(result.aggregateClassificationCounts.valid_governed_suppression_requires_editorial_adjudication).toBe(1);
    expect(result.aggregateClassificationCounts.propagation_gap_missing_disposition).toBe(0);
  });

  it('keeps contradictory status/cardinality separate from editorial under-generation', () => {
    const result = analyzePg06bDocuments([
      {
        sourceFile: 'contradiction.json',
        document: {
          criteria: [
            {
              key: 'structure',
              score_0_10: 5,
              recommendations: [{ action: 'tighten the scene sequence' }],
              recommendation_status: 'insufficient_evidence',
              recommendation_status_rationale: 'There is not enough evidence to provide a safe recommendation.',
            },
            { key: 'voice', score_0_10: 8, recommendations: [{ action: 'x' }] },
            { key: 'theme', score_0_10: 9, recommendations: [] },
          ],
        },
      },
    ]);

    expect(result.aggregateClassificationCounts.status_cardinality_mismatch).toBe(1);
    expect(result.aggregateClassificationCounts.valid_governed_suppression_requires_editorial_adjudication).toBe(0);
  });

  it('formats markdown without manuscript prose or evidence snippets', () => {
    const result = analyzePg06bDocuments([
      {
        sourceFile: 'sample.json',
        document: {
          criteria: [
            { key: 'concept', score_0_10: 6, recommendations: [], evidence: [{ snippet: 'secret manuscript text' }] },
            { key: 'voice', score_0_10: 8, recommendations: [{ action: 'secret action text' }] },
            { key: 'theme', score_0_10: 9, recommendations: [] },
          ],
        },
      },
    ]);

    const markdown = formatPg06bMarkdown(result);
    expect(markdown).toContain('PG-06B Editorial Calibration Analysis');
    expect(markdown).not.toContain('secret manuscript text');
    expect(markdown).not.toContain('secret action text');
  });
});
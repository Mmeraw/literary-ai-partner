import fs from 'fs';
import path from 'path';

import { buildShortFormEvaluationDocument } from '../../../lib/evaluation/shortFormReportDocument';

type ContractShape = {
  sectionsInOrder: string[];
  requiredTitleBlockFields: string[];
  option: string;
  authoritativeModel: string;
  hybridPathAllowed: boolean;
};

describe('short-form section tree contract', () => {
  const contractPath = path.join(process.cwd(), 'docs/canon/SHORT_FORM_SECTION_TREE_CONTRACT_v1.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8')) as ContractShape;

  test('locks Option A and forbids hybrid path', () => {
    expect(contract.option).toBe('A');
    expect(contract.authoritativeModel).toBe('canonicalDoc');
    expect(contract.hybridPathAllowed).toBe(false);
  });

  test('document sectionOrder matches canonical section contract', () => {
    const doc = buildShortFormEvaluationDocument({
      displayTitle: 'Sister',
      result: {
        generated_at: '2026-06-08T00:00:00.000Z',
        overview: {
          overall_score_0_100: 64,
          verdict: 'revise',
          one_paragraph_summary: 'A complete summary for parity checks.',
          top_3_strengths: ['Strength one'],
          top_3_risks: ['Risk one'],
        },
        metrics: {
          manuscript: {
            title: 'Sister',
            word_count: 4903,
            genre: 'memoir',
            target_audience: 'Adult readers',
          },
        },
        enrichment: {
          premise: 'Premise paragraph',
          trigger_warnings: ['substance abuse'],
          reading_grade_level: 8.4,
          dialogue_percentage: 5.1,
          narrative_percentage: 94.9,
        },
        criteria: [
          {
            key: 'conceptAndCorePremise',
            score_0_10: 7,
            confidence_level: 'high',
            rationale: 'Concept rationale.',
            recommendations: [{ action: 'Clarify bridge.', priority: 'high' }],
          },
        ],
      },
    });

    expect([...doc.sectionOrder]).toEqual(contract.sectionsInOrder);
    for (const field of contract.requiredTitleBlockFields) {
      expect(Object.prototype.hasOwnProperty.call(doc.titleBlock, field)).toBe(true);
    }
  });

  /**
   * REGRESSION TEST: Price of Vanity — genre was rendered as "novel" (a
   * format word) because the Title Block used metrics.manuscript.genre
   * without filtering. The builder must prefer enrichment.diagnosed_genre
   * and reject bare FORMAT_WORDS.
   */
  test('genre: rejects bare format word "novel" in title block', () => {
    const doc = buildShortFormEvaluationDocument({
      displayTitle: 'The Price of Vanity',
      result: {
        generated_at: '2026-06-11T00:00:00.000Z',
        overview: {
          overall_score_0_100: 72,
          verdict: 'revise',
          one_paragraph_summary: 'A humorous account of vanity and hair disasters.',
          top_3_strengths: ['Voice', 'Humor', 'Pacing'],
          top_3_risks: ['Risk one'],
        },
        metrics: {
          manuscript: {
            title: 'The Price of Vanity',
            word_count: 1498,
            genre: 'novel', // format word — should be rejected
            target_audience: 'Adult Readers',
          },
        },
        enrichment: {
          premise: 'A man learns about vanity through a bad hair day.',
          trigger_warnings: [],
        },
        criteria: [],
      },
    });
    // "novel" is a format word — should fall back to "Not specified"
    expect(doc.titleBlock.genre).toBe('Not specified');
  });

  test('genre: prefers enrichment.diagnosed_genre over metrics.manuscript.genre', () => {
    const doc = buildShortFormEvaluationDocument({
      displayTitle: 'The Price of Vanity',
      result: {
        generated_at: '2026-06-11T00:00:00.000Z',
        overview: {
          overall_score_0_100: 72,
          verdict: 'revise',
          one_paragraph_summary: 'A humorous account of vanity and hair disasters.',
          top_3_strengths: ['Voice', 'Humor', 'Pacing'],
          top_3_risks: ['Risk one'],
        },
        metrics: {
          manuscript: {
            title: 'The Price of Vanity',
            word_count: 1498,
            genre: 'novel', // format word
            target_audience: 'Adult Readers',
          },
        },
        enrichment: {
          premise: 'A man learns about vanity through a bad hair day.',
          trigger_warnings: [],
          diagnosed_genre: 'Comedy / comic fiction + Literary / upmarket fiction',
        },
        criteria: [],
      },
    });
    // Should use enrichment.diagnosed_genre, not metrics.manuscript.genre
    expect(doc.titleBlock.genre).toBe('Comedy / comic fiction + Literary / upmarket fiction');
  });
});

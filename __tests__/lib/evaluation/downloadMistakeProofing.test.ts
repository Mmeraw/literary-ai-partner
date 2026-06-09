/**
 * Mistake-proofing tests for the download pipeline.
 *
 * These tests verify that:
 * 1. The read-time sanitizer is applied before the parity gate
 * 2. Previously-contaminated artifacts produce clean downloads
 * 3. The full download content matches the canonical template contract
 * 4. No contaminated text can ever reach the user in any format
 */

import { sanitizeResultForDownload } from '@/lib/evaluation/downloadReadTimeSanitizer';
import { validateDownloadParity } from '@/lib/evaluation/downloadParityGate';

// Real contamination patterns found in production Sister evaluation
const PRODUCTION_CONTAMINATION_SAMPLES = [
  'At the scene level, studies are mixed on the success of safe injection sites. would because the stakes signal arrives too late in the passage, diffusing narrative urgency at the turn.',
  'The manuscript would benefit from one because it needs more specificity in the opening paragraph.',
  'The author could could improve this section by adding concrete details.',
  'This scene should because demonstrate higher emotional stakes.',
  'The narrative would would benefit from a tighter structure.',
];

function buildSisterLikeResult(contaminations: { field: string; text: string }[] = []) {
  const result: Record<string, unknown> = {
    overview: {
      overall_score_0_100: 64,
      one_paragraph_summary:
        'A Canadian narrator interweaves an exploration of Vancouver\'s INSITE and the broader addiction landscape with raw stories of his sister Christine\'s struggling son Nicolas and his former partner Israel.',
      top_3_strengths: [
        'Complex, empathetic character portraits of Christine, Nicolas, and Israel.',
        'Clear thematic integration of addiction as disease and harm reduction.',
        'Specific and credible worldbuilding around INSITE in Vancouver.',
      ],
      top_3_risks: [
        'An exposition-heavy, policy-focused opening that delays emotional engagement.',
        'Reliance on summary over fully dramatized scenes and sparse dialogue.',
        'Line-level mechanical errors and density in places that may undermine professional polish.',
      ],
    },
    criteria: [
      {
        key: 'concept_core_premise',
        score_0_10: 7,
        rationale: 'The central idea has strong resonance and clear stakes in Vancouver.',
        recommendations: [
          { action: 'Clarify the conceptual bridge between INSITE and Christine.', specific_fix: 'Add a transitional paragraph.' },
        ],
      },
      {
        key: 'narrative_drive',
        score_0_10: 6,
        rationale: 'Narrative momentum emerges most strongly once the narrator leaves the INSITE overview.',
        recommendations: [
          { action: 'Insert one concrete stakes beat at the scene turn.', specific_fix: 'Add a decision moment.' },
        ],
      },
    ],
    recommendations: {
      quick_wins: [{ action: 'Fix a line-level error in paragraph 3.', why: 'Polish matters.' }],
      strategic_revisions: [{ action: 'Restructure the opening to lead with character.', why: 'Engagement.' }],
    },
  };

  // Apply contaminations
  for (const c of contaminations) {
    if (c.field === 'criteria[1].rationale') {
      (result.criteria as Array<Record<string, unknown>>)[1].rationale = c.text;
    } else if (c.field === 'criteria[1].recommendations[0].action') {
      const recs = (result.criteria as Array<Record<string, unknown>>)[1].recommendations as Array<Record<string, unknown>>;
      recs[0].action = c.text;
    } else if (c.field === 'overview.one_paragraph_summary') {
      (result.overview as Record<string, unknown>).one_paragraph_summary = c.text;
    } else if (c.field === 'overview.top_3_strengths[0]') {
      ((result.overview as Record<string, unknown>).top_3_strengths as string[])[0] = c.text;
    }
  }

  return result;
}

describe('Download Mistake-Proofing', () => {
  describe('Production contamination patterns are all caught', () => {
    for (const sample of PRODUCTION_CONTAMINATION_SAMPLES) {
      it(`catches: "${sample.slice(0, 60)}..."`, () => {
        const result = buildSisterLikeResult([
          { field: 'criteria[1].rationale', text: sample },
        ]);

        // Before sanitization: parity gate MUST fail
        const before = validateDownloadParity(result);
        expect(before.pass).toBe(false);

        // After sanitization: parity gate MUST pass
        sanitizeResultForDownload(result);
        const after = validateDownloadParity(result);
        expect(after.pass).toBe(true);

        // The contaminated text MUST be cleaned
        const rationale = (result.criteria as Array<Record<string, unknown>>)[1].rationale as string;
        expect(rationale).not.toMatch(/safe\s+injection\s+sites?/i);
        expect(rationale).not.toMatch(/\b(?:would|could|should)\s+because\b/i);
        expect(rationale).not.toMatch(/\b(?:would|could|should)\s+(?:would|could|should)\b/i);
        expect(rationale).not.toMatch(/\bbenefit\s+from\s+one\s+because\b/i);
      });
    }
  });

  describe('Multi-field contamination', () => {
    it('handles contamination in multiple fields simultaneously', () => {
      const result = buildSisterLikeResult([
        { field: 'overview.one_paragraph_summary', text: 'The manuscript would because demonstrate strong thematic coherence across chapters.' },
        { field: 'overview.top_3_strengths[0]', text: 'The narrative would benefit from one because it has strong emotional payoff in the closing pages.' },
        { field: 'criteria[1].rationale', text: 'At the scene level, studies are mixed on the success of safe injection sites. would because the stakes signal arrives too late.' },
        { field: 'criteria[1].recommendations[0].action', text: 'The author could could fix the pacing by removing one reflective sentence.' },
      ]);

      const before = validateDownloadParity(result);
      expect(before.pass).toBe(false);
      expect(before.violations.length).toBeGreaterThanOrEqual(3);

      sanitizeResultForDownload(result);
      const after = validateDownloadParity(result);
      expect(after.pass).toBe(true);
      expect(after.violations).toHaveLength(0);
    });
  });

  describe('Template content completeness', () => {
    it('clean result retains ALL required template fields after sanitization', () => {
      const result = buildSisterLikeResult();
      sanitizeResultForDownload(result);

      const overview = result.overview as Record<string, unknown>;
      expect(overview.overall_score_0_100).toBe(64);
      expect(typeof overview.one_paragraph_summary).toBe('string');
      expect((overview.one_paragraph_summary as string).length).toBeGreaterThan(50);
      expect(Array.isArray(overview.top_3_strengths)).toBe(true);
      expect((overview.top_3_strengths as string[]).length).toBe(3);
      expect(Array.isArray(overview.top_3_risks)).toBe(true);
      expect((overview.top_3_risks as string[]).length).toBe(3);

      const criteria = result.criteria as Array<Record<string, unknown>>;
      expect(criteria.length).toBeGreaterThanOrEqual(2);
      for (const c of criteria) {
        expect(typeof c.score_0_10).toBe('number');
        expect(typeof c.rationale).toBe('string');
        expect((c.rationale as string).length).toBeGreaterThan(10);
      }
    });

    it('contaminated result retains ALL required template fields after sanitization', () => {
      const result = buildSisterLikeResult([
        { field: 'criteria[1].rationale', text: PRODUCTION_CONTAMINATION_SAMPLES[0] },
      ]);

      sanitizeResultForDownload(result);

      // Score and structure must be intact
      const overview = result.overview as Record<string, unknown>;
      expect(overview.overall_score_0_100).toBe(64);
      expect((overview.top_3_strengths as string[]).length).toBe(3);
      expect((overview.top_3_risks as string[]).length).toBe(3);

      // The rationale must still exist and be non-empty
      const criteria = result.criteria as Array<Record<string, unknown>>;
      expect(typeof criteria[1].rationale).toBe('string');
      expect((criteria[1].rationale as string).length).toBeGreaterThan(10);
    });
  });

  describe('Idempotency', () => {
    it('sanitizing twice produces identical output', () => {
      const result = buildSisterLikeResult([
        { field: 'criteria[1].rationale', text: PRODUCTION_CONTAMINATION_SAMPLES[0] },
      ]);

      sanitizeResultForDownload(result);
      const afterFirst = JSON.stringify(result);

      sanitizeResultForDownload(result);
      const afterSecond = JSON.stringify(result);

      expect(afterFirst).toBe(afterSecond);
    });
  });
});

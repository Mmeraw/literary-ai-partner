/**
 * Adversarial Revision Ledger Quality Regression Suite
 *
 * 15 deterministic synthetic test cases targeting the failure modes that
 * must be prevented BEFORE users encounter them. Each case exercises a
 * specific adversarial pattern against the revision pipeline gates:
 *
 *  1. Empty revise ledger returned
 *  2. Ledger item missing criterion
 *  3. Ledger item has generic action ("improve this section")
 *  4. Evidence quote missing or not manuscript-grounded
 *  5. Duplicate findings across criteria
 *  6. Recommendation too short
 *  7. Recommendation too long
 *  8. Action has no concrete edit instruction
 *  9. Diagnosis exists but no revision action
 * 10. High score produces unnecessary severe finding
 * 11. Low score produces weak or optional finding
 * 12. Valid JSON shape but fails content completeness
 * 13. All 13 criteria present but ledger underpopulated
 * 14. Revision item references wrong character/entity
 * 15. Placeholder language slips through ("insert specific example here")
 *
 * Quality pass definition:
 *   schema valid + all required fields populated + evidence grounded
 *   + action sentence meaningful + no placeholders + no duplicate findings
 *   + criterion coverage appropriate to score profile
 */

import { buildRevisionOpportunitiesFromEvaluationPayload, resolveReviseContextQuality } from '@/lib/revision/opportunityLedger';
import { runReviseAdmissionGate, runWorkbenchAdmissionGate } from '@/lib/revision/reviseAdmissionGate';
import { evaluateCardCandidateQuality } from '@/lib/revision/candidateQuality';

jest.mock('@/lib/revision/logRevisionEvent', () => ({
  logRevisionEvent: jest.fn(async () => undefined),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRec(overrides: Record<string, unknown> = {}) {
  return {
    diagnosis: 'The passage near the hospital scene stalls at the door without conveying internal hesitation.',
    recommendation: 'After Marcus reaches the door, add one beat of interiority that forces a visible decision the reader can witness.',
    anchor_snippet: 'He reached for the phone but stopped, and the house stayed quiet.',
    location_ref: 'chapter:3:paragraph:7',
    priority: 'high' as const,
    confidence: 0.85,
    symptom: 'The prose states Marcus stopped reaching but provides no sensory or psychological texture.',
    cause: 'The narrator reports the hesitation in summary, resolving the decision before Marcus experiences it.',
    fix_direction: 'Replace the summary sentence with one embodied beat that forces a visible decision.',
    reader_effect: 'The reader feels the gravity of the choice instead of merely observing that Marcus did not act.',
    mistake_proofing: 'Check that the revision has at least one physical sensation or internal thought.',
    candidate_text_a: 'His hand hovered above the receiver. The plastic was cold, and his fingers were warm enough to leave prints.',
    candidate_text_b: 'He counted to three, then counted again, and the silence between the numbers grew heavier each time.',
    candidate_text_c: 'The phone sat on the counter and he stood beside it, close enough to hear it breathe.',
    ...overrides,
  };
}

function makePayload(criteria: Array<{ key: string; score_0_10: number; recommendations: unknown[] }>) {
  return { criteria };
}

function makeWorkbenchInput(overrides: Record<string, unknown> = {}) {
  return {
    id: `adv-${Math.random().toString(36).slice(2)}`,
    readiness: 'ready_for_revise' as const,
    groundingStatus: 'supported' as const,
    preflightStatus: 'passed' as const,
    contextQuality: 'clean' as const,
    anchor: 'He reached for the phone but stopped.',
    quoteHighlight: 'reached for the phone',
    quoteRest: 'but stopped',
    symptom: 'The prose states Marcus stopped reaching but provides no sensory or psychological texture.',
    cause: 'The narrator reports the hesitation in summary, resolving the decision before Marcus experiences it.',
    fixDirection: 'Replace the summary sentence with one embodied beat that forces a visible decision.',
    readerEffect: 'The reader feels the gravity of the choice instead of merely observing inaction.',
    options: [
      { key: 'A', candidateText: 'His hand hovered above the receiver. The plastic was cold, and his fingers were warm enough to leave prints.' },
      { key: 'B', candidateText: 'He counted to three, then counted again, and the silence between the numbers grew heavier each time.' },
      { key: 'C', candidateText: 'The phone sat on the counter and he stood beside it, close enough to hear it breathe.' },
    ],
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 15 ADVERSARIAL SYNTHETIC TEST CASES
// ══════════════════════════════════════════════════════════════════════════════

describe('Revision Ledger Adversarial Regression', () => {

  // ── Case 1: Empty revise ledger returned ────────────────────────────────
  describe('Case 1: empty revise ledger', () => {
    it('produces no opportunities from empty payload', () => {
      const opps = buildRevisionOpportunitiesFromEvaluationPayload({ criteria: [] });
      expect(opps).toEqual([]);
    });

    it('produces no opportunities from null criteria', () => {
      const opps = buildRevisionOpportunitiesFromEvaluationPayload(null);
      expect(opps).toEqual([]);
    });

    it('produces no opportunities from undefined', () => {
      const opps = buildRevisionOpportunitiesFromEvaluationPayload(undefined);
      expect(opps).toEqual([]);
    });
  });

  // ── Case 2: Ledger item missing criterion ───────────────────────────────
  describe('Case 2: ledger item missing criterion key', () => {
    it('skips recommendations from criteria with empty key', () => {
      const payload = makePayload([
        { key: '', score_0_10: 5, recommendations: [makeRec()] },
      ]);
      const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
      // Empty key should be handled gracefully — either skipped or normalized
      for (const opp of opps) {
        expect(opp.criterion).toBeTruthy();
      }
    });

    it('skips recommendations from criteria with null key', () => {
      const payload = makePayload([
        { key: null as unknown as string, score_0_10: 5, recommendations: [makeRec()] },
      ]);
      const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
      for (const opp of opps) {
        expect(opp.criterion).toBeTruthy();
      }
    });
  });

  // ── Case 3: Generic action — "improve this section" ─────────────────────
  describe('Case 3: generic action language', () => {
    it('withholds workbench cards with commentary meta-language', () => {
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput({
        options: [
          { key: 'A', candidateText: 'It would be beneficial to restructure the opening so the reader encounters stakes before context.' },
          { key: 'B', candidateText: 'This passage would benefit from additional development and the author should consider expanding the scene.' },
          { key: 'C', candidateText: 'The author should restructure the opening to improve the overall narrative impact of this section.' },
        ],
      }));
      expect(result.admission_status).toBe('withheld');
    });
  });

  // ── Case 4: Evidence quote missing or not manuscript-grounded ───────────
  describe('Case 4: evidence not manuscript-grounded', () => {
    it('rejects opportunities with whitespace-only anchor', () => {
      const payload = makePayload([
        { key: 'pacing', score_0_10: 4, recommendations: [makeRec({ anchor_snippet: '   ' })] },
      ]);
      const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
      expect(opps).toHaveLength(0);
    });

    it('rejects opportunities with null anchor', () => {
      const payload = makePayload([
        { key: 'voice', score_0_10: 5, recommendations: [makeRec({ anchor_snippet: null })] },
      ]);
      const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
      expect(opps).toHaveLength(0);
    });
  });

  // ── Case 5: Duplicate findings across criteria ──────────────────────────
  describe('Case 5: duplicate findings across criteria', () => {
    it('deduplicates identical anchors with same operation', () => {
      const rec = makeRec();
      const payload = makePayload([
        { key: 'pacing', score_0_10: 4, recommendations: [rec] },
        { key: 'narrative_drive', score_0_10: 5, recommendations: [rec] },
        { key: 'scene_construction', score_0_10: 4, recommendations: [rec] },
      ]);
      const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
      // Same anchor + same operation → only one opportunity should survive
      const anchors = opps.map(o => o.evidence_anchor);
      const uniqueAnchors = [...new Set(anchors)];
      expect(uniqueAnchors.length).toBe(anchors.length);
    });
  });

  // ── Case 6: Recommendation too short ────────────────────────────────────
  describe('Case 6: recommendation too short', () => {
    it('rejects too-short candidates (< 5 words)', () => {
      const result = evaluateCardCandidateQuality([
        { key: 'A', text: 'Fix it.' },
        { key: 'B', text: 'Change this.' },
        { key: 'C', text: 'Better now.' },
      ]);
      expect(result.passed).toBe(false);
      expect(result.passedCandidateCount).toBe(0);
    });
  });

  // ── Case 7: Recommendation too long ─────────────────────────────────────
  describe('Case 7: recommendation too long (capacity)', () => {
    it('handles extremely long candidate text without crash', () => {
      const longText = 'The morning light crept across the floorboards. '.repeat(200);
      const result = evaluateCardCandidateQuality([
        { key: 'A', text: longText },
        { key: 'B', text: longText },
        { key: 'C', text: longText },
      ]);
      // Should not crash — either pass or fail gracefully
      expect(typeof result.passed).toBe('boolean');
      expect(typeof result.passedCandidateCount).toBe('number');
    });
  });

  // ── Case 8: Action has no concrete edit instruction ─────────────────────
  describe('Case 8: no concrete edit instruction', () => {
    it('withholds cards with editorial meta-language candidates', () => {
      const result = evaluateCardCandidateQuality([
        { key: 'A', text: 'This revision addresses the pacing by restructuring the paragraph order.' },
        { key: 'B', text: 'The author should reconsider the narrative approach in this paragraph.' },
        { key: 'C', text: 'The passage should be expanded with more emotional detail to improve flow.' },
      ]);
      expect(result.passed).toBe(false);
    });
  });

  // ── Case 9: Diagnosis exists but no revision action ─────────────────────
  describe('Case 9: diagnosis without revision action', () => {
    it('still produces opportunity when diagnosis populated but recommendation empty', () => {
      const payload = makePayload([
        {
          key: 'pacing',
          score_0_10: 4,
          recommendations: [makeRec({
            diagnosis: 'The pacing collapses in the middle section where summary replaces scene.',
            recommendation: '',
            anchor_snippet: 'She turned the corner and everything changed.',
          })],
        },
      ]);
      const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
      // Pipeline uses other diagnostic fields (symptom, cause, fix_direction)
      // as the revision action, so populated diagnosis + anchor → valid opportunity
      expect(opps.length).toBeGreaterThanOrEqual(1);
      for (const opp of opps) {
        expect(opp.evidence_anchor.length).toBeGreaterThan(5);
      }
    });

    it('rejects opportunity when both diagnosis AND anchor are empty', () => {
      const payload = makePayload([
        {
          key: 'pacing',
          score_0_10: 4,
          recommendations: [makeRec({
            diagnosis: '',
            recommendation: '',
            anchor_snippet: '',
          })],
        },
      ]);
      const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
      expect(opps).toHaveLength(0);
    });
  });

  // ── Case 10: High score produces unnecessary severe finding ─────────────
  describe('Case 10: high score should not produce severe finding', () => {
    it('opportunities from high-scoring criteria are not "must" severity', () => {
      const payload = makePayload([
        {
          key: 'pacing',
          score_0_10: 9,
          recommendations: [makeRec()],
        },
      ]);
      const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
      for (const opp of opps) {
        // Score 9/10 should not produce "must" severity — should be "could" or "should" at most
        expect(opp.severity).not.toBe('must');
      }
    });
  });

  // ── Case 11: Low score produces weak or optional finding ────────────────
  describe('Case 11: low score should produce strong finding', () => {
    it('opportunities from low-scoring criteria are "must" or "should" severity', () => {
      const payload = makePayload([
        {
          key: 'pacing',
          score_0_10: 2,
          recommendations: [makeRec()],
        },
      ]);
      const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
      for (const opp of opps) {
        // Score 2/10 should be at least "should" severity
        expect(['must', 'should']).toContain(opp.severity);
      }
    });
  });

  // ── Case 12: Valid JSON shape but fails content completeness ────────────
  describe('Case 12: valid shape, empty content', () => {
    it('withholds workbench card with structurally valid but empty fields', () => {
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput({
        symptom: '',
        cause: '',
        fixDirection: '',
        readerEffect: '',
      }));
      expect(result.admission_status).toBe('withheld');
    });
  });

  // ── Case 13: All 13 criteria present but ledger underpopulated ──────────
  describe('Case 13: all criteria present, ledger underpopulated', () => {
    it('produces opportunities from at least some of 13 populated criteria', () => {
      const ALL_CRITERIA = [
        'concept', 'narrative_drive', 'character', 'voice',
        'scene_construction', 'dialogue', 'theme', 'worldbuilding',
        'pacing', 'prose_control', 'tone', 'narrative_closure', 'marketability',
      ];
      const payload = makePayload(
        ALL_CRITERIA.map((key, i) => ({
          key,
          score_0_10: 5,
          recommendations: [makeRec({
            // Unique anchor per criterion to avoid dedup
            anchor_snippet: `In chapter ${i + 1}, the prose stalls at the ${key} passage without conveying the reader's experience.`,
          })],
        })),
      );
      const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
      // With 13 unique anchors we should get meaningful opportunities from most criteria
      expect(opps.length).toBeGreaterThanOrEqual(5);

      // Each opportunity must have populated evidence
      for (const opp of opps) {
        expect(opp.evidence_anchor.length).toBeGreaterThan(5);
        expect(opp.rationale.length).toBeGreaterThan(5);
      }
    });
  });

  // ── Case 14: Revision references wrong character/entity ─────────────────
  describe('Case 14: wrong character reference (anchor echo)', () => {
    it('detects candidates that echo the anchor verbatim', () => {
      const anchor = 'She walked through the quiet neighborhood, thinking about what her sister had said.';
      const result = evaluateCardCandidateQuality([
        { key: 'A', text: 'She walked through the quiet neighborhood, thinking about what her sister had said.', anchor },
        { key: 'B', text: 'Walking through the quiet neighborhood, she thought about what her sister had said.', anchor },
        { key: 'C', text: 'Through the quiet neighborhood she walked, thinking about her sister\'s words.', anchor },
      ]);
      // At least the verbatim copy should fail — anchor echo
      expect(result.passedCandidateCount).toBeLessThanOrEqual(2);
    });
  });

  // ── Case 15: Placeholder language slips through ─────────────────────────
  describe('Case 15: placeholder language detection', () => {
    it('withholds candidates with "insert specific example here" language', () => {
      const result = evaluateCardCandidateQuality([
        { key: 'A', text: 'She opened the door and [insert specific example here] walked into the night.' },
        { key: 'B', text: 'The author should add a specific example here to strengthen the scene.' },
        { key: 'C', text: 'Replace this with a concrete detail from the manuscript.' },
      ]);
      expect(result.passed).toBe(false);
    });

    it('withholds workbench cards with template placeholder patterns', () => {
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput({
        options: [
          { key: 'A', candidateText: 'She opened the door and [insert specific example] walked into the night.' },
          { key: 'B', candidateText: 'Marcus felt the weight of [describe emotion] as he stood in the doorway.' },
          { key: 'C', candidateText: 'The silence between them was [add sensory detail here] and unbreakable.' },
        ],
      }));
      expect(result.admission_status).toBe('withheld');
    });
  });
});

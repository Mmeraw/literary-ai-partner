/**
 * Unit tests for candidateQuality.ts
 *
 * Covers each individual quality rule and the 2-of-3 pass threshold
 * for evaluateCardQuality.
 */

import {
  evaluateCandidateQuality,
  evaluateCardQuality,
} from '@/lib/revision/candidateQuality';

// ── Helpers ───────────────────────────────────────────────────────────────────

const GOOD_ANCHOR =
  'Mara held the door open a moment longer than she needed to, letting the silence make its own argument.';
const GOOD_RATIONALE =
  'The transition between paragraphs lacks a causal hinge; insert a beat that shows Mara registering the implication.';

function goodCandidate(n: number): string {
  // Distinct, concrete, context-aware prose — each shares enough anchor tokens to pass lacksContextFit.
  // All three reference 'door' or 'silence' or 'Mara' which appear in GOOD_ANCHOR.
  const options = [
    'Mara pressed her fingertips against the doorframe and waited for the silence to make its own decision.',
    'The door swung shut and Mara stood still, letting the silence settle before she answered what it meant.',
    'Mara held the silence between herself and the door until the moment told her what to do next.',
  ];
  return options[n % options.length]!;
}

// ── evaluateCandidateQuality ───────────────────────────────────────────────────

describe('evaluateCandidateQuality', () => {
  it('returns empty array for a good candidate', () => {
    const reasons = evaluateCandidateQuality(goodCandidate(0), GOOD_ANCHOR, GOOD_RATIONALE);
    expect(reasons).toEqual([]);
  });

  it('flags not_copy_ready for a blank string', () => {
    const reasons = evaluateCandidateQuality('', GOOD_ANCHOR, GOOD_RATIONALE);
    expect(reasons).toContain('candidate_quality_not_copy_ready');
  });

  it('flags not_copy_ready for a very short string without alphabetic content', () => {
    const reasons = evaluateCandidateQuality('12345', GOOD_ANCHOR, GOOD_RATIONALE);
    expect(reasons).toContain('candidate_quality_not_copy_ready');
  });

  it('flags too_short for a candidate with fewer than 8 words', () => {
    const reasons = evaluateCandidateQuality('She paused before leaving.', GOOD_ANCHOR, GOOD_RATIONALE);
    expect(reasons).toContain('candidate_quality_too_short');
  });

  it('flags generic for editorial advice prose', () => {
    const advice = 'This passage should be rewritten to clarify the character motivation.';
    const reasons = evaluateCandidateQuality(advice, GOOD_ANCHOR, GOOD_RATIONALE);
    expect(reasons).toContain('candidate_quality_generic');
  });

  it('flags summary for summary-not-prose text', () => {
    const summary = 'This shows that the character has resolved her internal conflict.';
    const reasons = evaluateCandidateQuality(summary, GOOD_ANCHOR, GOOD_RATIONALE);
    expect(reasons).toContain('candidate_quality_summary');
  });

  it('flags generic_filler for canned literary filler', () => {
    const filler = 'The moment tightened around her like a verdict no one had spoken aloud.';
    const reasons = evaluateCandidateQuality(filler, GOOD_ANCHOR, GOOD_RATIONALE);
    expect(reasons).toContain('candidate_quality_generic_filler');
  });

  it('flags anchor_overlap when candidate echoes anchor at >= 0.82 token overlap', () => {
    // Produce a candidate that is essentially the anchor with minor word swaps
    const echoCandidate =
      'Mara held the door open a moment longer than she needed to letting the silence make its own argument here.';
    const reasons = evaluateCandidateQuality(echoCandidate, GOOD_ANCHOR, GOOD_RATIONALE);
    expect(reasons).toContain('candidate_quality_anchor_overlap');
  });

  it('flags voice_mismatch for editorial meta-language', () => {
    const meta = 'The reader needs to feel the narrative arc shift at this criterion diagnostic point.';
    const reasons = evaluateCandidateQuality(meta, GOOD_ANCHOR, GOOD_RATIONALE);
    expect(reasons).toContain('candidate_quality_voice_mismatch');
  });

  it('flags unsupported_facts for invented numeric digits not in anchor', () => {
    // The detector catches numeric digits (\b\d+); written-number words are out of scope.
    const candidate =
      'Mara counted to 47 before she let herself breathe again in the hallway.';
    const reasons = evaluateCandidateQuality(candidate, GOOD_ANCHOR, GOOD_RATIONALE);
    expect(reasons).toContain('candidate_quality_unsupported_facts');
  });

  it('returns multiple codes when multiple rules fire', () => {
    const bad = 'The reader must consider revising this passage.';
    const reasons = evaluateCandidateQuality(bad, GOOD_ANCHOR, GOOD_RATIONALE);
    // Generic advice + voice mismatch both fire
    expect(reasons.length).toBeGreaterThan(1);
  });
});

// ── evaluateCardQuality ────────────────────────────────────────────────────────

describe('evaluateCardQuality', () => {
  it('passes when all 3 candidates pass', () => {
    const result = evaluateCardQuality(
      goodCandidate(0),
      goodCandidate(1),
      goodCandidate(2),
      GOOD_ANCHOR,
      GOOD_RATIONALE,
    );
    expect(result.pass).toBe(true);
    expect(result.passingCount).toBeGreaterThanOrEqual(2);
  });

  it('passes when exactly 2 of 3 candidates pass (threshold met)', () => {
    const bad = 'This passage needs to be revised for the reader narrative.';
    const result = evaluateCardQuality(
      goodCandidate(0),
      goodCandidate(1),
      bad, // 3rd candidate fails
      GOOD_ANCHOR,
      GOOD_RATIONALE,
    );
    expect(result.pass).toBe(true);
    expect(result.passingCount).toBeGreaterThanOrEqual(2);
  });

  it('fails when only 1 of 3 candidates passes', () => {
    const bad1 = 'This passage needs to be revised for the reader narrative.';
    const bad2 = 'The scene should demonstrate the arc more clearly for narrative stakes.';
    const result = evaluateCardQuality(
      goodCandidate(0),
      bad1,
      bad2,
      GOOD_ANCHOR,
      GOOD_RATIONALE,
    );
    expect(result.pass).toBe(false);
    expect(result.passingCount).toBeLessThan(2);
    if (!result.pass) {
      expect(result.reasons.length).toBeGreaterThan(0);
    }
  });

  it('fails when all 3 candidates are empty strings', () => {
    const result = evaluateCardQuality('', '', '', GOOD_ANCHOR, GOOD_RATIONALE);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.reasons).toContain('candidate_quality_not_copy_ready');
    }
  });

  it('fails when any candidate is empty (2-of-3 cannot be satisfied)', () => {
    const result = evaluateCardQuality(
      goodCandidate(0),
      goodCandidate(1),
      '', // missing
      GOOD_ANCHOR,
      GOOD_RATIONALE,
    );
    // Empty string fails quality → only 2 candidates could pass → but 3rd is missing
    // Pass requires 2 of 3 to pass, and empty fails → passingCount <= 2
    // This should still pass (2 good, 1 empty → passingCount could be 2)
    // But evaluateCardQuality explicitly checks for missing candidates first
    expect(result.pass).toBe(false); // empty string triggers not_copy_ready guard
  });

  it('merges failure codes from all failing candidates (no duplicates)', () => {
    const bad1 = 'This passage should be revised.';
    const bad2 = 'The reader narrative needs improvement for arc stakes.';
    const bad3 = 'should try to clarify the scene.';
    const result = evaluateCardQuality(bad1, bad2, bad3, GOOD_ANCHOR, GOOD_RATIONALE);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      const seen = new Set(result.reasons);
      expect(seen.size).toBe(result.reasons.length); // no duplicates
    }
  });
});

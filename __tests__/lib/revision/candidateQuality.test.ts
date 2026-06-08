import {
  evaluateCardCandidateQuality,
  evaluateCandidateQuality,
  evaluateCardQuality,
  LEDGER_MIN_CONTEXT_JACCARD,
} from '../../../lib/revision/candidateQuality';

const GOOD_ANCHOR =
  'Mara held the door open a moment longer than she needed to, letting the silence make its own argument.';
const GOOD_RATIONALE =
  'The transition between paragraphs lacks a causal hinge; insert a beat that shows Mara registering the implication.';

function goodCandidate(n: number): string {
  const options = [
    'Mara pressed her fingertips against the doorframe and waited for the silence to make its own decision.',
    'The door swung shut and Mara stood still, letting the silence settle before she answered what it meant.',
    'Mara held the silence between herself and the door until the moment told her what to do next.',
  ];
  return options[n % options.length]!;
}

describe('candidateQuality admission API', () => {
  it('blocks generic literary filler', () => {
    const result = evaluateCandidateQuality({ key: 'A', text: 'The silence stretched until the room seemed smaller.' });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('GENERIC_PROSE');
  });

  it('blocks commentary instead of manuscript prose', () => {
    const result = evaluateCandidateQuality({ key: 'A', text: 'This revision should improve the scene by adding tension.' });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('NON_EXECUTABLE_PROSE');
  });

  it('requires at least two passing candidates for a card', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'The silence stretched until the room seemed smaller.' },
      { key: 'B', text: 'He placed the cup beside the ledger and waited for her answer.' },
      { key: 'C', text: 'Here is a rewrite that makes the moment stronger.' },
    ]);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('REVISION_QUALITY_FAILED');
  });
});

describe('evaluateCandidateQuality ledger API', () => {
  it('exposes the tuned ledger context threshold as an intentional policy constant', () => {
    expect(LEDGER_MIN_CONTEXT_JACCARD).toBe(0.03);
  });

  it('returns empty array for a good candidate', () => {
    const reasons = evaluateCandidateQuality(goodCandidate(0), GOOD_ANCHOR, GOOD_RATIONALE);
    expect(reasons).toEqual([]);
  });

  it('does not context-block valid prose with minimal but real anchor overlap', () => {
    const borderline = 'Mara stepped into the hallway and let the decision settle before she moved toward the waiting room.';
    const reasons = evaluateCandidateQuality(borderline, GOOD_ANCHOR, GOOD_RATIONALE);
    expect(reasons).not.toContain('candidate_quality_context_mismatch');
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
    const candidate =
      'Mara counted to 47 before she let herself breathe again in the hallway.';
    const reasons = evaluateCandidateQuality(candidate, GOOD_ANCHOR, GOOD_RATIONALE);
    expect(reasons).toContain('candidate_quality_unsupported_facts');
  });

  it('flags unsupported_facts for invented written numbers not in anchor', () => {
    const candidate =
      'Mara counted forty-seven steps before she let herself breathe again in the hallway.';
    const reasons = evaluateCandidateQuality(candidate, GOOD_ANCHOR, GOOD_RATIONALE);
    expect(reasons).toContain('candidate_quality_unsupported_facts');
  });

  it('flags unsupported_facts for invented compound written numbers not in anchor', () => {
    const candidate =
      'Mara waited one hundred seconds before she let herself breathe again in the hallway.';
    const reasons = evaluateCandidateQuality(candidate, GOOD_ANCHOR, GOOD_RATIONALE);
    expect(reasons).toContain('candidate_quality_unsupported_facts');
  });

  it('allows written numbers already present in the anchor', () => {
    const anchor = `${GOOD_ANCHOR} She had counted forty-seven steps before.`;
    const candidate = 'Mara counted forty-seven steps again and waited for the silence to answer.';
    const reasons = evaluateCandidateQuality(candidate, anchor, GOOD_RATIONALE);
    expect(reasons).not.toContain('candidate_quality_unsupported_facts');
  });

  it('returns multiple codes when multiple rules fire', () => {
    const bad = 'The reader must consider revising this passage.';
    const reasons = evaluateCandidateQuality(bad, GOOD_ANCHOR, GOOD_RATIONALE);
    expect(reasons.length).toBeGreaterThan(1);
  });
});

describe('evaluateCardQuality ledger API', () => {
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

  it('passes when exactly 2 of 3 candidates pass', () => {
    const bad = 'This passage needs to be revised for the reader narrative.';
    const result = evaluateCardQuality(
      goodCandidate(0),
      goodCandidate(1),
      bad,
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

  it('fails when any candidate is empty', () => {
    const result = evaluateCardQuality(
      goodCandidate(0),
      goodCandidate(1),
      '',
      GOOD_ANCHOR,
      GOOD_RATIONALE,
    );
    expect(result.pass).toBe(false);
  });

  it('merges failure codes from all failing candidates without duplicates', () => {
    const bad1 = 'This passage should be revised.';
    const bad2 = 'The reader narrative needs improvement for arc stakes.';
    const bad3 = 'should try to clarify the scene.';
    const result = evaluateCardQuality(bad1, bad2, bad3, GOOD_ANCHOR, GOOD_RATIONALE);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      const seen = new Set(result.reasons);
      expect(seen.size).toBe(result.reasons.length);
    }
  });
});

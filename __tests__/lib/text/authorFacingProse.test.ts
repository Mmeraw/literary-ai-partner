import {
  canonicalizeRecommendationAction,
  hasRepeatedSentenceOpenings,
  sanitizeAuthorFacingProse,
  startsWithRepetitiveLeadIn,
  stripRecommendationLeadIn,
} from '@/lib/text/authorFacingProse';

describe('authorFacingProse', () => {
  test('strips recommendation family prefixes and anchored lead-ins', () => {
    const input = 'Strategic revision: In the anchored moment "Chapter 11 — Witness", cut one reflective sentence.';
    expect(stripRecommendationLeadIn(input)).toBe('cut one reflective sentence.');
  });

  test('canonicalizes recommendation action for dedupe comparisons', () => {
    const input = 'In the section where "Chapter 9", Replace one abstract reaction line with a concrete decision beat.';
    expect(canonicalizeRecommendationAction(input)).toBe(
      'replace one abstract reaction line with a concrete decision beat.',
    );
  });

  test('detects repetitive lead-in boilerplate at section start', () => {
    expect(startsWithRepetitiveLeadIn('In the section where the bell first tolls, he hides the letter.')).toBe(true);
    expect(startsWithRepetitiveLeadIn('He hides the letter behind the flour tin.')).toBe(false);
  });

  test('detects repeated sentence openings', () => {
    const repetitive = 'He steadied the bowl before he spoke. He steadied the bowl before he listened. He steadied the bowl before he answered.';
    expect(hasRepeatedSentenceOpenings(repetitive, 4, 1)).toBe(true);

    const varied = 'He steadied the bowl before he spoke. Then the room fell quiet and she answered from the doorway.';
    expect(hasRepeatedSentenceOpenings(varied, 4, 1)).toBe(false);
  });

  test('sanitizes consecutive duplicate sentence residue', () => {
    expect(sanitizeAuthorFacingProse('She opens with urgency. She opens with urgency. Then she names the cost.')).toBe(
      'She opens with urgency. Then she names the cost.',
    );
  });
});

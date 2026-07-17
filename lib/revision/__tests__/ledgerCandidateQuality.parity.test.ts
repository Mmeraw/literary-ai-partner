import { describe, it, expect } from '@jest/globals';
import {
  evaluateCardQuality,
  LEDGER_CANDIDATE_QUALITY_REASON,
  LEDGER_CANDIDATE_QUALITY_REASON_CODES,
  type CandidateQualityReasonCode,
} from '@/lib/revision/candidateQuality';

const anchor = 'The old oak tree stood in the clearing under the morning light.';
const rationale = 'The anchor passage shows the oak tree in the clearing and morning light.';

describe('ledger candidate quality reason-code parity', () => {
  it('emits every exported ledger candidate-quality code from at least one fixture', () => {
    const observed = new Set<CandidateQualityReasonCode>();

    const collect = (...inputs: [string, string, string, string, string][]) => {
      for (const [a, b, c, anc, rat] of inputs) {
        const result = evaluateCardQuality(a, b, c, anc, rat);
        if (result.pass === false) {
          for (const r of result.reasons) observed.add(r);
        }
      }
    };

    // empty shape
    collect(['a b c', 'd e f', 'Alice walked to the old oak tree in the morning light.', anchor, rationale]);

    // not copy ready (shaped but too short in length)
    collect(
      ['one two three four', 'one two three four', 'Alice walked to the old oak tree in the morning light.', anchor, rationale],
    );

    // too short
    collect(
      ['one two three four five six seven', 'one two three four five six seven', 'Alice walked to the old oak tree in the morning light.', anchor, rationale],
    );

    // generic advice
    collect(
      ['This scene should be rewritten to improve tension.', 'The reader needs to feel the stakes in this passage.', 'Alice walked to the old oak tree in the morning light.', anchor, rationale],
    );

    // summary not prose
    collect(
      ['In summary, this scene demonstrates that the tension is weak.', 'Overall, the passage indicates a problem with the beat.', 'Alice walked to the old oak tree in the morning light.', anchor, rationale],
    );

    // stilted
    collect(
      ['This is very very important and really really strange for the reader today.', 'The dialogue is just just awkward and very very forced in the moment.', 'Alice walked to the old oak tree in the morning light.', anchor, rationale],
    );

    // repetitive
    collect(
      ['word word word word word word word word word word', 'xyz xyz xyz xyz xyz xyz xyz xyz xyz xyz', 'Alice walked to the old oak tree in the morning light.', anchor, rationale],
    );

    // anchor overlap
    collect(
      ['one two three four five six seven eight nine ten', 'one two three four five six seven eight nine alpha beta gamma', 'Alice walked to the old oak tree in the morning light.', 'one two three four five six seven eight nine ten', rationale],
    );

    // generic filler
    collect(
      ['The moment tightened, and the air stilled around them.', 'The weight settled and the pressure of the moment kept the air still.', 'Alice walked to the old oak tree in the morning light.', anchor, rationale],
    );

    // unsupported facts
    collect(
      ['Voldemort appeared suddenly with five hundred soldiers near the castle walls.', 'Saruman arrived with one thousand orcs at the broken gates.', 'Alice walked to the old oak tree in the morning light.', 'Harry walked down the street with his friend.', rationale],
    );

    // voice mismatch
    collect(
      ['The narrative arc demands tighter craft for the manuscript.', 'The story theme should be revised for stronger reader craft.', 'Alice walked to the old oak tree in the morning light.', anchor, rationale],
    );

    // context mismatch and not evidence grounded
    collect(
      ['physics mathematics chemistry biology geology history literature art music', 'algebra geometry calculus topology statistics probability astronomy optics', 'Alice walked to the old oak tree in the morning light.', anchor, rationale],
    );

    // duplicate options
    collect(
      ['Alice walked to the old oak tree in the morning light and saw the crow.', 'Alice walked to the old oak tree in the morning light and saw the bird.', 'The old oak tree stood in the clearing under the morning light.', anchor, rationale],
    );

    expect(observed).toEqual(new Set(LEDGER_CANDIDATE_QUALITY_REASON_CODES));
  });

  it('only emits reason codes contained in the exported ledger set', () => {
    const allowed = new Set(LEDGER_CANDIDATE_QUALITY_REASON_CODES);
    const result = evaluateCardQuality(
      'word word word word word word word word word word',
      'xyz xyz xyz xyz xyz xyz xyz xyz xyz xyz',
      'Alice walked to the old oak tree in the morning light.',
      anchor,
      rationale,
    );
    expect(result.pass).toBe(false);
    if (result.pass === false) {
      for (const r of result.reasons) {
        expect(allowed.has(r)).toBe(true);
      }
    }
  });

  it('uses the exact exported constants so the set cannot drift from the emitter', () => {
    expect(LEDGER_CANDIDATE_QUALITY_REASON.NOT_COPY_READY).toBe('candidate_quality_not_copy_ready');
    expect(LEDGER_CANDIDATE_QUALITY_REASON.EMPTY_SHAPE).toBe('candidate_quality_empty_shape');
    expect(LEDGER_CANDIDATE_QUALITY_REASON.DUPLICATE_OPTIONS).toBe('candidate_quality_duplicate_options');
    expect(LEDGER_CANDIDATE_QUALITY_REASON_CODES.length).toBeGreaterThanOrEqual(14);
  });
});

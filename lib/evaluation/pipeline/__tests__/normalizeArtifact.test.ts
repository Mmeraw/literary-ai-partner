import { describe, it, expect } from '@jest/globals';
import {
  normalizeArtifact,
  ArtifactTextContractError,
} from '@/lib/evaluation/pipeline/normalizeArtifact';

function makeSynthesis(overrides: {
  one_paragraph_summary?: string;
  one_sentence_pitch?: string;
  one_paragraph_pitch?: string;
  criteriaRecs?: Array<Record<string, unknown>>;
} = {}) {
  return {
    overall: {
      one_paragraph_summary:
        overrides.one_paragraph_summary ??
        'The manuscript earns a 74/100 on its concept. The principal blocker is pacing.',
      one_sentence_pitch:
        overrides.one_sentence_pitch ??
        'A sardonic Antwerp diamond dealer confronts friendship and cobalt money.',
      one_paragraph_pitch:
        overrides.one_paragraph_pitch ??
        'Calvin joins Monty in Antwerp for a farewell evening that becomes an ultimatum.',
    },
    criteria: [
      {
        recommendations: overrides.criteriaRecs ?? [
          { action: 'Tighten the exposition for better narrative momentum.' },
        ],
      },
    ],
  };
}

describe('normalizeArtifact — canonical evaluation prose', () => {
  it('preserves a valid 4,000-character one-sentence pitch', () => {
    const words = Array.from({ length: 498 }, (_, i) => `layer${i}`).join(' ');
    const pitch = `A ${words} story.`;
    expect(pitch.length).toBeLessThan(5000);
    const synthesis = makeSynthesis({ one_sentence_pitch: pitch });
    normalizeArtifact(synthesis, [], []);
    expect(synthesis.overall.one_sentence_pitch).toBe(pitch);
  });

  it('preserves a valid 8,000-character one-paragraph pitch', () => {
    const sentence = 'The story deepens its dramatic promise through specific conflict and consequence. ';
    let pitch = '';
    while (pitch.length + sentence.length < 8000) pitch += sentence;
    const synthesis = makeSynthesis({ one_paragraph_pitch: pitch.trim() });
    const before = synthesis.overall.one_paragraph_pitch;
    normalizeArtifact(synthesis, [], []);
    expect(synthesis.overall.one_paragraph_pitch).toBe(before);
  });

  it('preserves a valid 9,000-character executive summary', () => {
    const sentence = 'The evaluation provides manuscript-specific synthesis without redundant criterion commentary. ';
    let summary = '';
    while (summary.length + sentence.length < 9000) summary += sentence;
    const synthesis = makeSynthesis({ one_paragraph_summary: summary.trim() });
    const before = synthesis.overall.one_paragraph_summary;
    normalizeArtifact(synthesis, [], []);
    expect(synthesis.overall.one_paragraph_summary).toBe(before);
  });

  it('rejects an executive summary beyond the 20,000-character safeguard without trimming it', () => {
    const summary = `${'Complete sentence. '.repeat(1100)}`;
    const synthesis = makeSynthesis({ one_paragraph_summary: summary });
    expect(() => normalizeArtifact(synthesis, [], [])).toThrow(ArtifactTextContractError);
  });

  it('rejects genuine incomplete canonical prose', () => {
    const synthesis = makeSynthesis({ one_paragraph_summary: 'The reader loses momentum because' });
    expect(() => normalizeArtifact(synthesis, [], [])).toThrow(ArtifactTextContractError);
    expect(synthesis.overall.one_paragraph_summary).toBe('The reader loses momentum because');
  });

  it('rejects multiple paragraphs in one_paragraph_pitch', () => {
    const synthesis = makeSynthesis({
      one_paragraph_pitch: 'First paragraph is complete.\n\nSecond paragraph is also complete.',
    });
    expect(() => normalizeArtifact(synthesis, [], [])).toThrow(ArtifactTextContractError);
  });

  it('rejects multiple sentences in one_sentence_pitch', () => {
    const synthesis = makeSynthesis({
      one_sentence_pitch: 'The first sentence ends. The second sentence begins.',
    });
    expect(() => normalizeArtifact(synthesis, [], [])).toThrow(ArtifactTextContractError);
  });

  it('performs harmless line-ending and outer-whitespace cleanup', () => {
    const synthesis = makeSynthesis({
      one_paragraph_summary: '  First paragraph is complete.\r\n\r\nSecond paragraph is complete.  ',
    });
    normalizeArtifact(synthesis, [], []);
    expect(synthesis.overall.one_paragraph_summary).toBe(
      'First paragraph is complete.\n\nSecond paragraph is complete.',
    );
  });
});

describe('normalizeArtifact — universal author-facing punctuation mistake-proofing', () => {
  it('repairs the DIAMONDS punctuation-only recommendation fields before integrity validation', () => {
    const synthesis = makeSynthesis({
      criteriaRecs: [
        {
          mechanism: 'The stakes signal arrives too late in the passage, diffusing narrative urgency at the turn',
          specific_fix: 'Insert one concrete stakes beat that lands the deferred decision at the current scene turn',
          reader_effect: 'Clearer motivation and emotional stakes, improving trust in character decisions',
        },
      ],
    });

    expect(() => normalizeArtifact(synthesis, [], [])).not.toThrow();
    const rec = synthesis.criteria[0].recommendations![0];
    expect(rec.mechanism).toBe(
      'The stakes signal arrives too late in the passage, diffusing narrative urgency at the turn.',
    );
    expect(rec.specific_fix).toBe(
      'Insert one concrete stakes beat that lands the deferred decision at the current scene turn.',
    );
    expect(rec.reader_effect).toBe(
      'Clearer motivation and emotional stakes, improving trust in character decisions.',
    );
  });

  it('normalizes colon spacing and preserves valid numeric constructions', () => {
    const synthesis = makeSynthesis({
      criteriaRecs: [
        {
          action: 'Revise this range:3–5 pages while preserving GPT-5.1 and Phase 0.5',
        },
      ],
    });
    normalizeArtifact(synthesis, [], []);
    expect(synthesis.criteria[0].recommendations![0].action).toBe(
      'Revise this range: 3–5 pages while preserving GPT-5.1 and Phase 0.5.',
    );
  });

  it('capitalizes lowercase sentence starts in final_rationale without mutating decimals', () => {
    const synthesis = makeSynthesis({
      criteriaRecs: [
        {
          action: 'Condense surveillance exposition. then keep the airport objective active.',
        },
      ],
    });
    (synthesis.criteria[0] as Record<string, unknown>).final_rationale =
      'The surveillance exposition interrupts momentum. maintain the airport objective throughout the paragraph. The ratio is 3.14 in the draft.';
    normalizeArtifact(synthesis, [], []);
    expect((synthesis.criteria[0] as Record<string, unknown>).final_rationale).toBe(
      'The surveillance exposition interrupts momentum. Maintain the airport objective throughout the paragraph. The ratio is 3.14 in the draft.',
    );
  });

  it('does not paper over a genuine terminal-dash truncation', () => {
    const synthesis = makeSynthesis({ criteriaRecs: [{ action: 'Strengthen the climax—' }] });
    expect(() => normalizeArtifact(synthesis, [], [])).toThrow();
    expect(synthesis.criteria[0].recommendations![0].action).toBe('Strengthen the climax—');
  });

  it('preserves evidence and anchor snippets byte-for-byte', () => {
    const synthesis = makeSynthesis({
      criteriaRecs: [
        {
          action: 'tighten the scene',
          anchor_snippet: '  original  text -- exactly ',
        },
      ],
    });
    (synthesis.criteria[0] as Record<string, unknown>).evidence = [
      { snippet: '  manuscript  evidence -- unchanged ' },
    ];

    normalizeArtifact(synthesis, [], []);
    const rec = synthesis.criteria[0].recommendations![0];
    expect(rec.anchor_snippet).toBe('  original  text -- exactly ');
    expect(((synthesis.criteria[0] as Record<string, unknown>).evidence as Array<{ snippet: string }>)[0].snippet)
      .toBe('  manuscript  evidence -- unchanged ');
  });

  it('is idempotent', () => {
    const synthesis = makeSynthesis({ criteriaRecs: [{ action: '  tighten  the exposition' }] });
    normalizeArtifact(synthesis, [], []);
    const once = JSON.stringify(synthesis);
    normalizeArtifact(synthesis, [], []);
    expect(JSON.stringify(synthesis)).toBe(once);
  });

  it('normalizes short-form and long-form routes through the same boundary', () => {
    const shortForm = makeSynthesis({ criteriaRecs: [{ action: 'tighten the short-form scene' }] });
    const longForm = makeSynthesis({ criteriaRecs: [{ action: 'tighten the multi-layer scene' }] });
    normalizeArtifact(shortForm, [], []);
    normalizeArtifact(longForm, [], []);
    expect(shortForm.criteria[0].recommendations![0].action).toBe('Tighten the short-form scene.');
    expect(longForm.criteria[0].recommendations![0].action).toBe('Tighten the multi-layer scene.');
  });
});

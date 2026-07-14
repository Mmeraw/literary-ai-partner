import { describe, it, expect } from '@jest/globals';
import {
  normalizeArtifact,
  ArtifactTextContractError,
} from '@/lib/evaluation/pipeline/normalizeArtifact';

function makeSynthesis(overrides: {
  one_paragraph_summary?: string;
  one_sentence_pitch?: string;
  one_paragraph_pitch?: string;
  criteriaRecs?: Array<{ action?: string }>;
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
    const pitch = `A ${'complex '.repeat(498)}story.`;
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
    expect(synthesis.overall.one_paragraph_summary).toBe(summary);
  });

  it('rejects incomplete canonical prose rather than deleting the trailing fragment', () => {
    const summary = 'This is a complete sentence. This final thought remains';
    const synthesis = makeSynthesis({ one_paragraph_summary: summary });
    expect(() => normalizeArtifact(synthesis, [], [])).toThrow(ArtifactTextContractError);
    expect(synthesis.overall.one_paragraph_summary).toBe(summary);
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

  it('performs harmless line-ending and outer-whitespace cleanup only', () => {
    const synthesis = makeSynthesis({
      one_paragraph_summary: '  First paragraph is complete.\r\n\r\nSecond paragraph is complete.  ',
    });
    normalizeArtifact(synthesis, [], []);
    expect(synthesis.overall.one_paragraph_summary).toBe(
      'First paragraph is complete.\n\nSecond paragraph is complete.',
    );
  });
});

describe('normalizeArtifact — recommendation normalization', () => {
  it('capitalizes, normalizes whitespace, and adds terminal punctuation', () => {
    const synthesis = makeSynthesis();
    const quickWins = [{ action: '  compress  the exposition' }];
    normalizeArtifact(synthesis, quickWins, []);
    expect(quickWins[0].action).toBe('Compress the exposition.');
  });

  it('normalizes strategic and criterion recommendations', () => {
    const synthesis = makeSynthesis({
      criteriaRecs: [{ action: 'add a concrete resolution beat at the climax' }],
    });
    const strategic = [{ action: 'introduce physical beats in the scene' }];
    normalizeArtifact(synthesis, [], strategic);
    expect(strategic[0].action).toBe('Introduce physical beats in the scene.');
    expect(synthesis.criteria[0].recommendations![0].action).toBe(
      'Add a concrete resolution beat at the climax.',
    );
  });

  it('does not change score language', () => {
    const synthesis = makeSynthesis({
      one_paragraph_summary: 'This manuscript earns 80/100. The principal blocker is pacing.',
    });
    normalizeArtifact(synthesis, [], []);
    expect(synthesis.overall.one_paragraph_summary).toContain('80/100');
  });
});

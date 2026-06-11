/**
 * P1 Pitch Identity Separation — ensures one_sentence_pitch, one_paragraph_pitch,
 * and one_paragraph_summary serve distinct editorial purposes and are not derived
 * from the same text.
 */
import { buildReportPitches } from '@/lib/evaluation/reportTemplateContract';

describe('P1: Pitch Identity Separation', () => {
  describe('buildReportPitches — dedicated fields', () => {
    it('prefers dedicated one_sentence_pitch over legacy derivation', () => {
      const pitches = buildReportPitches({
        premise: 'A diamond dealer faces mortality.',
        summary: 'The chapter delivers strong voice (9/10) but pacing falters mid-scene.',
        title: 'Diamonds Aren\'t Forever',
        one_sentence_pitch: 'A sardonic diamond dealer\'s retirement trip becomes a reckoning with mortality.',
      });
      expect(pitches.oneSentencePitch).toBe(
        'A sardonic diamond dealer\'s retirement trip becomes a reckoning with mortality.',
      );
    });

    it('prefers dedicated one_paragraph_pitch over legacy derivation', () => {
      const pitches = buildReportPitches({
        premise: 'A diamond dealer faces mortality.',
        summary: 'The chapter delivers strong voice (9/10) but pacing falters mid-scene.',
        title: 'Diamonds Aren\'t Forever',
        one_paragraph_pitch: 'Calvin watches his mentor Monty announce a reckless retirement plan. As Monty reveals the GeoCam opportunity, Calvin must decide whether loyalty or self-preservation wins.',
      });
      expect(pitches.oneParagraphPitch).toBe(
        'Calvin watches his mentor Monty announce a reckless retirement plan. As Monty reveals the GeoCam opportunity, Calvin must decide whether loyalty or self-preservation wins.',
      );
    });

    it('falls back to legacy derivation when dedicated fields are absent', () => {
      const pitches = buildReportPitches({
        premise: 'A diamond dealer faces mortality.',
        summary: 'The chapter delivers strong voice but pacing falters.',
        title: 'Diamonds Aren\'t Forever',
      });
      // Legacy: when both premise and summary exist, uses summary for paragraph pitch
      expect(pitches.oneParagraphPitch).toBe('The chapter delivers strong voice but pacing falters.');
      // Legacy: first sentence of summary for one-sentence
      expect(pitches.oneSentencePitch).toBe('The chapter delivers strong voice but pacing falters.');
    });

    it('falls back to legacy when dedicated fields are empty strings', () => {
      const pitches = buildReportPitches({
        premise: 'A diamond dealer faces mortality.',
        summary: 'Strong voice carries the narrative.',
        title: 'Test',
        one_sentence_pitch: '',
        one_paragraph_pitch: '   ',
      });
      // Empty/whitespace should trigger fallback
      expect(pitches.oneSentencePitch).toBe('Strong voice carries the narrative.');
      expect(pitches.oneParagraphPitch).toBe('Strong voice carries the narrative.');
    });

    it('dedicated pitch is independent of one_paragraph_summary', () => {
      const summary = 'The chapter demonstrates strong voice (9/10) and character depth (9/10) but pacing (6/10) and narrative drive (6/10) need work.';
      const pitches = buildReportPitches({
        premise: 'A diamond dealer faces mortality.',
        summary,
        title: 'Diamonds Aren\'t Forever',
        one_sentence_pitch: 'A sardonic diamond dealer\'s retirement trip becomes a reckoning with mortality.',
        one_paragraph_pitch: 'Calvin watches his mentor Monty announce a reckless plan to abandon diamonds for conflict-zone cameras. Stakes escalate when Calvin realizes Monty isn\'t just retiring — he\'s running toward death.',
      });
      // Pitches should NOT contain evaluation language
      expect(pitches.oneSentencePitch).not.toContain('9/10');
      expect(pitches.oneParagraphPitch).not.toContain('9/10');
      // Summary IS the diagnostic judgment
      expect(summary).toContain('9/10');
    });
  });

  describe('buildReportPitches — backward compatibility', () => {
    it('handles null/undefined gracefully', () => {
      const pitches = buildReportPitches({
        premise: null,
        summary: null,
        title: 'My Novel',
      });
      expect(pitches.oneParagraphPitch).toBe('RevisionGrade evaluated My Novel.');
      expect(pitches.oneSentencePitch).toBe('RevisionGrade evaluated My Novel.');
    });

    it('uses premise when summary is missing', () => {
      const pitches = buildReportPitches({
        premise: 'A warrior queen must choose between revenge and peace.',
        summary: null,
        title: 'The Throne',
      });
      expect(pitches.oneParagraphPitch).toBe('A warrior queen must choose between revenge and peace.');
    });
  });
});

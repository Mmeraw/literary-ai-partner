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

    it('falls back without reusing diagnostic summary as pitch copy', () => {
      const pitches = buildReportPitches({
        premise: 'A diamond dealer faces mortality.',
        summary: 'The chapter delivers strong voice but pacing falters.',
        title: 'Diamonds Aren\'t Forever',
      });
      expect(pitches.oneParagraphPitch).toBe('A diamond dealer faces mortality.');
      expect(pitches.oneSentencePitch).toBe(
        'A distinct market hook was not generated for Diamonds Aren\'t Forever.',
      );
      expect(pitches.oneParagraphPitch).not.toBe('The chapter delivers strong voice but pacing falters.');
      expect(pitches.oneSentencePitch).not.toBe(pitches.oneParagraphPitch);
    });

    it('keeps empty dedicated fields from collapsing all pitch surfaces', () => {
      const pitches = buildReportPitches({
        premise: 'A diamond dealer faces mortality.',
        summary: 'Strong voice carries the narrative.',
        title: 'Test',
        one_sentence_pitch: '',
        one_paragraph_pitch: '   ',
      });
      expect(pitches.oneParagraphPitch).toBe('A diamond dealer faces mortality.');
      expect(pitches.oneSentencePitch).toBe('A distinct market hook was not generated for Test.');
      expect(pitches.oneSentencePitch).not.toBe(pitches.oneParagraphPitch);
      expect(pitches.oneParagraphPitch).not.toBe('Strong voice carries the narrative.');
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
    it('handles null/undefined gracefully without duplicating pitch fields', () => {
      const pitches = buildReportPitches({
        premise: null,
        summary: null,
        title: 'My Novel',
      });
      expect(pitches.oneParagraphPitch).toBe('A distinct story synopsis was not generated for My Novel.');
      expect(pitches.oneSentencePitch).toBe('A distinct market hook was not generated for My Novel.');
      expect(pitches.oneSentencePitch).not.toBe(pitches.oneParagraphPitch);
    });

    it('uses premise for paragraph pitch when summary is missing but keeps hook separate', () => {
      const pitches = buildReportPitches({
        premise: 'A warrior queen must choose between revenge and peace.',
        summary: null,
        title: 'The Throne',
      });
      expect(pitches.oneParagraphPitch).toBe('A warrior queen must choose between revenge and peace.');
      expect(pitches.oneSentencePitch).toBe('A distinct market hook was not generated for The Throne.');
      expect(pitches.oneSentencePitch).not.toBe(pitches.oneParagraphPitch);
    });
  });
});

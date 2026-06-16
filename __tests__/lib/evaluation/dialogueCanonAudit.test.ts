/**
 * Dialogue Canon Audit — regression tests for smart/curly quote parsing.
 *
 * Root cause: the original DIALOGUE_LINE_PATTERN only matched straight quotes ("),
 * but manuscripts use curly/smart quotes (\u201C...\u201D) and British single quotes
 * (\u2018...\u2019). This caused the detector to find 1 dialogue line in 109K words.
 */

import { runDialogueCanonAudit } from '@/lib/evaluation/dialogueCanon/dialogueCanonAudit';

// Generate enough filler to exceed the 25,000-word gate threshold
const FILLER_WORDS = Array.from({ length: 26000 }, (_, i) => `word${i}`).join(' ');

describe('Dialogue Canon Audit — Quote Variant Parsing', () => {
  test('detects dialogue with straight double quotes', () => {
    const manuscript = `${FILLER_WORDS}
    
"I never thought it would end this way," she said.
"Neither did I," he replied.
"What are we going to do now?" asked Sarah.
"I have no idea," John whispered.
"We need to leave immediately," declared the captain.`;

    const result = runDialogueCanonAudit(manuscript, 'job-1', 'ms-1');
    expect(result.overallStatus).toBe('complete');
    expect(result.metrics.totalDialogueLines).toBeGreaterThanOrEqual(5);
    expect(result.metrics.attributedLines).toBeGreaterThanOrEqual(4);
    expect(result.metrics.uniqueSpeakers).toBeGreaterThanOrEqual(2);
  });

  test('detects dialogue with curly/smart double quotes (\u201C...\u201D)', () => {
    const manuscript = `${FILLER_WORDS}
    
\u201CI never thought it would end this way,\u201D she said.
\u201CNeither did I,\u201D he replied.
\u201CWhat are we going to do now?\u201D asked Sarah.
\u201CI have no idea,\u201D John whispered.
\u201CWe need to leave immediately,\u201D declared the captain.`;

    const result = runDialogueCanonAudit(manuscript, 'job-2', 'ms-2');
    expect(result.overallStatus).toBe('complete');
    expect(result.metrics.totalDialogueLines).toBeGreaterThanOrEqual(5);
    expect(result.metrics.attributedLines).toBeGreaterThanOrEqual(4);
    expect(result.metrics.uniqueSpeakers).toBeGreaterThanOrEqual(2);
  });

  test('detects dialogue with British single quotes (\u2018...\u2019)', () => {
    const manuscript = `${FILLER_WORDS}
    
\u2018I never thought it would end this way,\u2019 she said.
\u2018Neither did I,\u2019 he replied.
\u2018What are we going to do now?\u2019 asked Sarah.
\u2018I have no idea,\u2019 John whispered.
\u2018We need to leave immediately,\u2019 declared the captain.`;

    const result = runDialogueCanonAudit(manuscript, 'job-3', 'ms-3');
    expect(result.overallStatus).toBe('complete');
    expect(result.metrics.totalDialogueLines).toBeGreaterThanOrEqual(5);
    expect(result.metrics.attributedLines).toBeGreaterThanOrEqual(4);
    expect(result.metrics.uniqueSpeakers).toBeGreaterThanOrEqual(2);
  });

  test('detects dialogue with mixed quote styles in same manuscript', () => {
    const manuscript = `${FILLER_WORDS}
    
"Good morning," said the butler.
\u201CWhere is everyone?\u201D asked Lady Catherine.
\u2018In the garden, ma\u2019am,\u2019 he replied.
"Shall I bring tea?" the maid offered.
\u201CYes, and quickly,\u201D she demanded.`;

    const result = runDialogueCanonAudit(manuscript, 'job-4', 'ms-4');
    expect(result.overallStatus).toBe('complete');
    expect(result.metrics.totalDialogueLines).toBeGreaterThanOrEqual(4);
  });

  test('detects exposition leakage regardless of quote style', () => {
    const manuscript = `${FILLER_WORDS}
    
\u201CAs you know, the kingdom has been at war for decades,\u201D the king said.
\u201CLet me explain how this machine works,\u201D she offered.
\u201CFor your information, we have already tried that approach,\u201D he snapped.`;

    const result = runDialogueCanonAudit(manuscript, 'job-5', 'ms-5');
    expect(result.overallStatus).toBe('complete');
    expect(result.expositionLeakage.length).toBeGreaterThanOrEqual(2);
  });

  test('identifies protected speech (dialect) in curly quotes', () => {
    const manuscript = `${FILLER_WORDS}
    
\u201CI ain\u2019t gonna do that, y\u2019all,\u201D she drawled.
\u201CLemme think about it,\u201D he said.
\u201CGonna need more time, I reckon,\u201D the farmer replied.`;

    const result = runDialogueCanonAudit(manuscript, 'job-6', 'ms-6');
    expect(result.overallStatus).toBe('complete');
    expect(result.protectedSpeech.length).toBeGreaterThanOrEqual(1);
  });

  test('short-form manuscripts are skipped (< 25,000 words)', () => {
    const shortManuscript = 'Hello world. "Some dialogue," she said. This is short.';
    const result = runDialogueCanonAudit(shortManuscript, 'job-7', 'ms-7');
    expect(result.overallStatus).toBe('skipped');
    expect(result.metrics.totalDialogueLines).toBe(0);
  });

  test('regression: curly-quoted manuscript must not return near-zero dialogue', () => {
    // Simulate a manuscript with hundreds of dialogue lines using curly quotes
    const dialogueLines = Array.from({ length: 200 }, (_, i) =>
      `\u201CThis is dialogue line number ${i} with enough content to pass the minimum,\u201D said character${i % 5}.`
    ).join('\n\n');
    const manuscript = `${FILLER_WORDS}\n\n${dialogueLines}`;

    const result = runDialogueCanonAudit(manuscript, 'job-8', 'ms-8');
    expect(result.overallStatus).toBe('complete');
    // Must detect at least 100 lines (the pattern should find all 200)
    expect(result.metrics.totalDialogueLines).toBeGreaterThan(100);
    expect(result.metrics.attributedLines).toBeGreaterThan(50);
  });
});

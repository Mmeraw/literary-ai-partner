/**
 * Flesch-Kincaid Grade Level computation.
 *
 * Algorithmic — no LLM inference required.
 * Formula: 0.39 * (totalWords / totalSentences) + 11.8 * (totalSyllables / totalWords) - 15.59
 */

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 2) return 1;

  let count = 0;
  const vowels = "aeiouy";
  let prevVowel = false;

  for (let i = 0; i < w.length; i++) {
    const isVowel = vowels.includes(w[i]);
    if (isVowel && !prevVowel) {
      count++;
    }
    prevVowel = isVowel;
  }

  // Silent e at end
  if (w.endsWith("e") && count > 1) {
    count--;
  }

  // Ensure at least 1 syllable
  return Math.max(count, 1);
}

function countSentences(text: string): number {
  // Split on sentence-ending punctuation followed by space or end
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0);
  return Math.max(sentences.length, 1);
}

export interface ReadingGradeLevelResult {
  /** Flesch-Kincaid Grade Level (e.g. 5.8 means roughly 6th grade reading level) */
  gradeLevel: number;
  totalWords: number;
  totalSentences: number;
  totalSyllables: number;
}

/**
 * Compute Flesch-Kincaid Grade Level for manuscript text.
 *
 * Returns a grade level number (e.g. 5.8 = roughly 6th grade).
 * Higher values = more complex prose. Most novels range 4–12.
 *
 * IMPORTANT: This measures prose complexity only, NOT audience appropriateness.
 * A manuscript may score at a young-adult reading level while containing
 * graphic content unsuitable for younger readers.
 */
export function computeReadingGradeLevel(text: string): ReadingGradeLevelResult {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  const totalWords = words.length;

  if (totalWords === 0) {
    return { gradeLevel: 0, totalWords: 0, totalSentences: 0, totalSyllables: 0 };
  }

  const totalSentences = countSentences(text);
  const totalSyllables = words.reduce((sum, word) => sum + countSyllables(word), 0);

  const gradeLevel =
    0.39 * (totalWords / totalSentences) +
    11.8 * (totalSyllables / totalWords) -
    15.59;

  // Clamp to reasonable range (0–20)
  const clamped = Math.max(0, Math.min(20, gradeLevel));

  return {
    gradeLevel: Math.round(clamped * 10) / 10,
    totalWords,
    totalSentences,
    totalSyllables,
  };
}

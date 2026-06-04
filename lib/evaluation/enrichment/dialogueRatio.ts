/**
 * Dialogue vs. Narrative Ratio computation.
 *
 * Algorithmic — no LLM inference required.
 * Identifies quoted speech (text between quotation marks) versus narrative prose.
 */

export interface DialogueRatioResult {
  /** Percentage of text that is dialogue (0–100) */
  dialoguePercentage: number;
  /** Percentage of text that is narrative (0–100) */
  narrativePercentage: number;
  /** Total character count of dialogue segments */
  dialogueCharCount: number;
  /** Total character count of narrative segments */
  narrativeCharCount: number;
  /** Total character count analyzed */
  totalCharCount: number;
}

/**
 * Compute dialogue vs. narrative ratio for manuscript text.
 *
 * Detects quoted speech using standard quotation patterns:
 * - Double quotes: "dialogue"
 * - Smart/curly double quotes: \u201Cdialogue\u201D
 * - Single quotes used as speech markers: 'dialogue' (British style)
 *
 * Contextual guidance:
 * - Most commercially successful novels: 25–35% dialogue
 * - Literary fiction: 15–25%
 * - Thrillers and romance: 30–45%
 */
export function computeDialogueRatio(text: string): DialogueRatioResult {
  if (!text || text.trim().length === 0) {
    return {
      dialoguePercentage: 0,
      narrativePercentage: 100,
      dialogueCharCount: 0,
      narrativeCharCount: 0,
      totalCharCount: 0,
    };
  }

  let dialogueCharCount = 0;

  // Match text between double quotes (straight or curly)
  const doubleQuotePattern = /[""\u201C]([\s\S]*?)[""\u201D]/g;
  let match: RegExpExecArray | null;

  while ((match = doubleQuotePattern.exec(text)) !== null) {
    dialogueCharCount += match[1].length;
  }

  // If very little dialogue found with double quotes, also check single-quote
  // British-style dialogue (only if manuscript appears to use it as primary speech marker)
  if (dialogueCharCount < text.length * 0.02) {
    const singleQuotePattern = /['\u2018]([\s\S]*?)['\u2019]/g;
    let singleQuoteDialogue = 0;
    while ((match = singleQuotePattern.exec(text)) !== null) {
      // Only count if content looks like speech (> 5 chars, contains spaces)
      if (match[1].length > 5 && match[1].includes(" ")) {
        singleQuoteDialogue += match[1].length;
      }
    }
    // Only use single-quote counts if they suggest real dialogue usage
    if (singleQuoteDialogue > text.length * 0.05) {
      dialogueCharCount = singleQuoteDialogue;
    }
  }

  const totalCharCount = text.length;
  const narrativeCharCount = totalCharCount - dialogueCharCount;

  const dialoguePercentage =
    totalCharCount > 0
      ? Math.round((dialogueCharCount / totalCharCount) * 1000) / 10
      : 0;

  const narrativePercentage = Math.round((100 - dialoguePercentage) * 10) / 10;

  return {
    dialoguePercentage,
    narrativePercentage,
    dialogueCharCount,
    narrativeCharCount,
    totalCharCount,
  };
}

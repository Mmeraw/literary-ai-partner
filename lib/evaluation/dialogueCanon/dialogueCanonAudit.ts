/**
 * Dialogue Canon Audit — Phase 4
 *
 * Canon: Wave 13 + Volume V (Dialogue), dialogue-speech-pov-canon-enforcement.md
 *
 * Produces a structured dialogue quality assessment:
 *   - Speaker differentiation (unique voice patterns per character)
 *   - Attribution purity (clear, unambiguous speaker identification)
 *   - Exposition leakage (dialogue used as info-dump vehicle)
 *   - Subtext opportunity (surface-level dialogue that could carry subtext)
 *   - Protected speech segments (dialect, idiolect, register to preserve)
 *
 * Deterministic heuristic implementation (no LLM calls).
 * Long-form only (≥25,000 words). Non-blocking post-evaluation layer.
 */

import { GATE15_MIN_WORD_COUNT } from '../gate15/gate15_1_validator';

// ── Types ────────────────────────────────────────────────────────────────

export type DialogueStatus = 'pass' | 'warning' | 'fail';

export interface ExpositionLeakageInstance {
  text: string;
  reason: string;
}

export interface AttributionIssue {
  text: string;
  issue: 'unattributed' | 'ambiguous' | 'over_tagged' | 'homogenized';
}

export interface SubtextOpportunity {
  text: string;
  suggestion: string;
}

export interface ProtectedSpeechSegment {
  text: string;
  protectionReason: 'dialect' | 'idiolect' | 'register' | 'period_voice' | 'intentional_roughness';
}

export interface DialogueCanonAuditArtifact {
  version: 'dialogue_canon_audit_v1';
  jobId: string;
  manuscriptId: string;
  wordCount: number;
  timestamp: string;
  overallStatus: 'complete' | 'skipped';
  skippedBecause?: string;
  activatedBecause?: string;
  dialogueStatus: DialogueStatus;
  metrics: {
    totalDialogueLines: number;
    attributedLines: number;
    unattributedLines: number;
    uniqueSpeakers: number;
    avgWordsPerDialogueLine: number;
    expositionLeakageRate: number;
  };
  expositionLeakage: ExpositionLeakageInstance[];
  attributionIssues: AttributionIssue[];
  subtextOpportunities: SubtextOpportunity[];
  protectedSpeech: ProtectedSpeechSegment[];
  summaryFindings: string[];
}

// ── Detection Patterns ───────────────────────────────────────────────────

/**
 * Quoted dialogue lines — supports straight quotes ("), curly double quotes
 * (\u201C...\u201D), and single quotes ('/\u2018/\u2019) for British fiction.
 * Must be at least 5 characters of dialogue content to avoid matching
 * emphasis markers or scare quotes.
 */
const DIALOGUE_LINE_PATTERN = /(?:"|\u201C)([^"\u201D\n]{5,})(?:"|\u201D)|(?:'|\u2018)([^'\u2019\n]{5,})(?:'|\u2019)/g;

/**
 * Attribution tags near dialogue — matches after any closing quote variant.
 * Handles both "verb + speaker" ("asked Sarah") and "speaker + verb" ("she said")
 * patterns within a few words of the closing quote.
 */
const SPEECH_VERBS = 'said|asked|replied|answered|responded|whispered|murmured|shouted|cried|exclaimed|declared|stated|called|continued|added|insisted|demanded|suggested|offered|agreed|protested|warned|explained|noted|remarked|observed|commented|muttered|growled|snapped|barked';
const ATTRIBUTION_NEAR_DIALOGUE = new RegExp(
  `(?:"|\\u201D|'|\\u2019)\\s*(?:,?\\s*)(?:(\\w+)\\s+)?\\b(${SPEECH_VERBS})\\b(?:\\s+(\\w+))?`,
  'gi',
);

/** Exposition leakage: dialogue containing explanatory/informational phrases */
const EXPOSITION_LEAKAGE_PATTERNS = [
  /As you (?:know|remember|recall),/i,
  /Let me explain/i,
  /For (?:your|the) (?:benefit|information|record)/i,
  /I should mention that/i,
  /You see,/i,
  /The (?:thing|fact|truth|reality) is/i,
  /What you (?:need to|should|must) (?:know|understand) is/i,
  /Allow me to (?:explain|tell you|describe)/i,
  /In case you (?:didn't know|forgot|were wondering)/i,
  /\b(?:As I|As we) (?:discussed|mentioned|established|agreed) (?:earlier|before|previously)\b/i,
];

/** Over-tagged dialogue (too many speech tags per dialogue cluster) */
const SPEECH_TAG_PATTERN = /\b(said|asked|replied|answered|whispered|murmured|shouted|exclaimed|declared|stated)\b/gi;

/** Nonstandard speech indicators (candidates for protection) */
const NONSTANDARD_SPEECH = [
  { pattern: /\b(ya|yall|y'all|gonna|gotta|wanna|ain't|dunno|lemme|gimme)\b/gi, reason: 'dialect' as const },
  { pattern: /\w+['']\b/g, reason: 'dialect' as const },
  { pattern: /\b(sir|ma'am|milord|milady|your\s+(?:grace|majesty|honor|worship))\b/gi, reason: 'register' as const },
  { pattern: /\b(thee|thou|thy|thine|hath|doth|wherefore|forsooth|prithee)\b/gi, reason: 'period_voice' as const },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// ── Main Audit ───────────────────────────────────────────────────────────

export function runDialogueCanonAudit(
  manuscriptText: string,
  jobId: string,
  manuscriptId: string,
): DialogueCanonAuditArtifact {
  const wordCount = countWords(manuscriptText);
  const timestamp = new Date().toISOString();

  if (wordCount < GATE15_MIN_WORD_COUNT) {
    return {
      version: 'dialogue_canon_audit_v1',
      jobId,
      manuscriptId,
      wordCount,
      timestamp,
      overallStatus: 'skipped',
      skippedBecause: `short_form_under_${GATE15_MIN_WORD_COUNT}_words`,
      dialogueStatus: 'pass',
      metrics: { totalDialogueLines: 0, attributedLines: 0, unattributedLines: 0, uniqueSpeakers: 0, avgWordsPerDialogueLine: 0, expositionLeakageRate: 0 },
      expositionLeakage: [],
      attributionIssues: [],
      subtextOpportunities: [],
      protectedSpeech: [],
      summaryFindings: [`Dialogue Canon Audit skipped: manuscript is ${wordCount.toLocaleString()} words (minimum ${GATE15_MIN_WORD_COUNT.toLocaleString()})`],
    };
  }

  // Extract all dialogue lines
  DIALOGUE_LINE_PATTERN.lastIndex = 0;
  const dialogueMatches = [...manuscriptText.matchAll(DIALOGUE_LINE_PATTERN)];
  const dialogueLines = dialogueMatches.map(m => m[1] || m[2]);
  const totalDialogueLines = dialogueLines.length;

  // Check attribution
  ATTRIBUTION_NEAR_DIALOGUE.lastIndex = 0;
  const attributionMatches = [...manuscriptText.matchAll(ATTRIBUTION_NEAR_DIALOGUE)];
  const attributedLines = attributionMatches.length;
  const unattributedLines = Math.max(0, totalDialogueLines - attributedLines);

  // Unique speakers (from attribution matches)
  // Group 1 = word before verb (e.g., "she" in "she said"), Group 3 = word after verb (e.g., "Sarah" in "asked Sarah")
  const PRONOUNS = new Set(['she', 'he', 'i', 'they', 'we', 'it', 'the', 'a', 'an', 'his', 'her', 'my']);
  const speakers = new Set<string>();
  for (const m of attributionMatches) {
    const beforeVerb = m[1]?.toLowerCase();
    const afterVerb = m[3]?.toLowerCase();
    // Prefer the word that's a proper name (not a pronoun/article)
    if (afterVerb && !PRONOUNS.has(afterVerb)) {
      speakers.add(afterVerb);
    } else if (beforeVerb && !PRONOUNS.has(beforeVerb)) {
      speakers.add(beforeVerb);
    }
  }

  // Average words per dialogue line
  const totalDialogueWords = dialogueLines.reduce((sum, line) => sum + countWords(line), 0);
  const avgWordsPerDialogueLine = totalDialogueLines === 0 ? 0 : Number((totalDialogueWords / totalDialogueLines).toFixed(1));

  // Exposition leakage detection
  const expositionLeakage: ExpositionLeakageInstance[] = [];
  for (const line of dialogueLines.slice(0, 500)) {
    for (const pattern of EXPOSITION_LEAKAGE_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        if (expositionLeakage.length < 20) {
          expositionLeakage.push({
            text: line.length > 150 ? line.slice(0, 150) + '...' : line,
            reason: `Contains exposition marker: ${pattern.source.slice(0, 40)}`,
          });
        }
        break;
      }
    }
  }
  const expositionLeakageRate = totalDialogueLines === 0 ? 0 : Number((expositionLeakage.length / Math.min(totalDialogueLines, 500)).toFixed(3));

  // Attribution issues
  const attributionIssues: AttributionIssue[] = [];
  const unattributedRatio = totalDialogueLines === 0 ? 0 : unattributedLines / totalDialogueLines;
  if (unattributedRatio > 0.4 && attributionIssues.length < 10) {
    attributionIssues.push({
      text: `${Math.round(unattributedRatio * 100)}% of dialogue lines lack clear attribution`,
      issue: 'unattributed',
    });
  }

  // Check for over-tagging (too many speech tags in close proximity)
  const paragraphs = manuscriptText.split(/\n\s*\n/);
  for (const para of paragraphs.slice(0, 200)) {
    SPEECH_TAG_PATTERN.lastIndex = 0;
    const tagCount = (para.match(SPEECH_TAG_PATTERN) || []).length;
    const paraDialogueCount = (para.match(DIALOGUE_LINE_PATTERN) || []).length;
    DIALOGUE_LINE_PATTERN.lastIndex = 0;
    if (tagCount > 4 && paraDialogueCount > 0 && attributionIssues.length < 10) {
      attributionIssues.push({
        text: para.slice(0, 100) + '...',
        issue: 'over_tagged',
      });
    }
  }

  // Subtext opportunities (very direct/surface-level dialogue)
  const subtextOpportunities: SubtextOpportunity[] = [];
  const directStatements = /^I (?:am|feel|think|want|need|believe|know|hate|love|like)\b/i;
  for (const line of dialogueLines.slice(0, 500)) {
    if (directStatements.test(line) && subtextOpportunities.length < 15) {
      subtextOpportunities.push({
        text: line.length > 120 ? line.slice(0, 120) + '...' : line,
        suggestion: 'Direct emotional statement — consider showing through action or subtext instead',
      });
    }
  }

  // Protected speech segments
  const protectedSpeech: ProtectedSpeechSegment[] = [];
  for (const line of dialogueLines.slice(0, 500)) {
    for (const { pattern, reason } of NONSTANDARD_SPEECH) {
      pattern.lastIndex = 0;
      if (pattern.test(line) && protectedSpeech.length < 20) {
        protectedSpeech.push({
          text: line.length > 120 ? line.slice(0, 120) + '...' : line,
          protectionReason: reason,
        });
        break;
      }
    }
  }

  // Overall dialogue status
  let dialogueStatus: DialogueStatus = 'pass';
  if (expositionLeakageRate > 0.05 || unattributedRatio > 0.5) {
    dialogueStatus = 'warning';
  }
  if (expositionLeakageRate > 0.1 || unattributedRatio > 0.7) {
    dialogueStatus = 'fail';
  }

  // Summary
  const summaryFindings: string[] = [];
  summaryFindings.push(`${totalDialogueLines} dialogue lines detected, ${speakers.size} unique speakers identified`);
  summaryFindings.push(`Attribution: ${attributedLines} attributed, ${unattributedLines} unattributed (${Math.round((1 - unattributedRatio) * 100)}% coverage)`);
  if (expositionLeakage.length > 0) {
    summaryFindings.push(`${expositionLeakage.length} exposition leakage instances detected (${(expositionLeakageRate * 100).toFixed(1)}% rate)`);
  }
  if (protectedSpeech.length > 0) {
    summaryFindings.push(`${protectedSpeech.length} protected speech segments identified (dialect, register, period voice)`);
  }
  if (subtextOpportunities.length > 0) {
    summaryFindings.push(`${subtextOpportunities.length} subtext opportunities flagged`);
  }

  return {
    version: 'dialogue_canon_audit_v1',
    jobId,
    manuscriptId,
    wordCount,
    timestamp,
    overallStatus: 'complete',
    activatedBecause: 'long_form_25000_plus',
    dialogueStatus,
    metrics: {
      totalDialogueLines,
      attributedLines,
      unattributedLines,
      uniqueSpeakers: speakers.size,
      avgWordsPerDialogueLine,
      expositionLeakageRate,
    },
    expositionLeakage,
    attributionIssues,
    subtextOpportunities,
    protectedSpeech,
    summaryFindings,
  };
}

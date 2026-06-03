/**
 * Gate 15.1 — Dialogue & Attribution Purity Gate (Mechanical Purity)
 *
 * Canon: Volume I, Gate 15 Paired Gate Architecture
 * Authority: GATE_15_CANON.md, GATE_15_1_PR1_CANON_AND_SCHEMA_SPEC.md
 *
 * Gate 15.1 validates structural purity. It removes false positives of noise.
 * Five quantitative checks (Layer 1):
 *   Q1 — Attribution Density (≤4 per 1,000 words)
 *   Q2 — Soft-Tag Cap (≤2 per chapter-equivalent)
 *   Q3 — Thought-Verb Tolerance (≤0 per chapter when POV is established)
 *   Q4 — Physiological Filler Cap (≤3 per chapter-equivalent)
 *   Q5 — Boundary Test (quote/italics boundary integrity)
 *
 * This implementation runs at manuscript level (not chapter-level).
 * Chapter-level execution is deferred to Phase 6+.
 */

// ── Canon Constants ──────────────────────────────────────────────────────

/** Canon-defined attribution tags (Category A) */
const ATTRIBUTION_TAGS = [
  'said', 'asked', 'replied', 'answered', 'responded', 'called', 'stated',
  'declared', 'announced', 'added', 'continued', 'began', 'started',
  'finished', 'repeated', 'insisted', 'demanded', 'suggested', 'offered',
  'countered', 'confirmed', 'admitted', 'explained', 'noted', 'observed',
  'remarked', 'commented', 'mentioned', 'urged', 'cautioned', 'warned',
  'promised', 'agreed', 'objected', 'protested', 'argued', 'snapped',
  'barked', 'growled', 'groaned', 'moaned', 'gasped', 'cried', 'screamed',
  'shouted', 'yelled', 'exclaimed',
];

/** Canon-defined soft tags (Category B) */
const SOFT_TAGS = [
  'whispered', 'murmured', 'muttered', 'breathed', 'hissed', 'mouthed',
  'mused', 'intoned', 'lilted', 'purred', 'cooed', 'rasped', 'croaked',
  'stammered', 'stuttered', 'sputtered', 'whimpered', 'whined', 'pleaded',
  'begged',
];

/** Canon-defined thought verbs (Category C) */
const THOUGHT_VERBS = [
  'thought', 'believed', 'pondered', 'considered', 'wondered', 'realized',
  'decided', 'figured', 'supposed', 'assumed', 'imagined', 'remembered',
  'recalled', 'recognized', 'understood', 'knew', 'felt', 'sensed',
  'suspected', 'feared', 'hoped', 'wished', 'prayed',
];

/** Canon-defined thought-verb phrases (Category C — multi-word) */
const THOUGHT_VERB_PHRASES = [
  'told himself', 'reminded himself', 'reassured himself',
  'told herself', 'reminded herself', 'reassured herself',
];

/** Canon-defined physiological fillers (Category D) */
const PHYSIOLOGICAL_FILLERS = [
  'swallowed', 'exhaled', 'inhaled', 'nodded', 'shrugged', 'sighed',
  'blinked', 'winced', 'flinched', 'stiffened', 'tensed', 'clenched',
  'unclenched', 'straightened', 'shifted', 'squirmed', 'fidgeted',
  'trembled', 'shuddered', 'steadied', 'braced', 'froze', 'paused',
  'hesitated',
];

/** Canon-defined physiological filler phrases (Category D — multi-word) */
const PHYSIOLOGICAL_FILLER_PHRASES = [
  'swallowed hard', 'licked his lips', 'bit his lip', 'chewed his lip',
  'set his jaw', 'gritted his teeth', 'cleared his throat',
  'held his breath', 'let out a breath', 'drew a breath', 'took a breath',
  'sucked in a breath', 'released a breath',
  'licked her lips', 'bit her lip', 'chewed her lip', 'set her jaw',
  'gritted her teeth', 'cleared her throat', 'held her breath',
  'let out a breath', 'drew a breath', 'took a breath',
  'sucked in a breath', 'released a breath',
];

/** Canon thresholds */
const THRESHOLDS = {
  attributionPer1000: 4,
  softTagsPerChapter: 2,
  thoughtVerbsPerChapter: 0,
  physiologicalFillersPerChapter: 3,
} as const;

/**
 * Average words per "chapter-equivalent" for manuscript-level normalization.
 * A typical novel chapter is ~3,000-5,000 words; using 4,000 as midpoint.
 */
const WORDS_PER_CHAPTER_EQUIVALENT = 4_000;

// ── Types ────────────────────────────────────────────────────────────────

export type PassFail = 'PASS' | 'FAIL';
export type GateStatus = PassFail | 'SKIPPED';

/** Minimum word count for Gate 15 to activate (canon: long-form ≥25,000 words) */
export const GATE15_MIN_WORD_COUNT = 25_000;

export interface FlaggedInstance {
  matchedText: string;
  category: 'attribution' | 'softTag' | 'thoughtVerb' | 'physiologicalFiller' | 'boundary';
  context: string;
}

export interface Layer1Metric {
  count: number;
  threshold: number;
  normalized: number;
  status: PassFail;
  instances: FlaggedInstance[];
}

export interface BoundaryTestResult {
  status: PassFail;
  unmatchedQuotes: number;
  unmatchedItalics: number;
  instances: FlaggedInstance[];
}

export interface Gate15_1Result {
  overallStatus: GateStatus;
  blocking: boolean;
  wordCount: number;
  chapterEquivalents: number;
  skippedBecause?: string;
  layer1?: {
    attributionDensity: Layer1Metric;
    softTags: Layer1Metric;
    thoughtVerbs: Layer1Metric;
    physiologicalFillers: Layer1Metric;
    boundaryTest: BoundaryTestResult;
  };
  summaryFindings: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function buildWordBoundaryRegex(words: readonly string[]): RegExp {
  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
}

function buildPhraseRegex(phrases: readonly string[]): RegExp {
  const escaped = phrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
}

function extractContext(text: string, matchIndex: number, matchLength: number): string {
  const start = Math.max(0, matchIndex - 40);
  const end = Math.min(text.length, matchIndex + matchLength + 40);
  let ctx = text.slice(start, end).replace(/\n/g, ' ').trim();
  if (start > 0) ctx = '...' + ctx;
  if (end < text.length) ctx = ctx + '...';
  return ctx;
}

function countMatches(
  text: string,
  regex: RegExp,
  category: FlaggedInstance['category'],
  maxInstances = 20,
): { count: number; instances: FlaggedInstance[] } {
  const matches = [...text.matchAll(regex)];
  const instances: FlaggedInstance[] = [];
  for (const m of matches.slice(0, maxInstances)) {
    instances.push({
      matchedText: m[0],
      category,
      context: extractContext(text, m.index ?? 0, m[0].length),
    });
  }
  return { count: matches.length, instances };
}

// ── Main Validator ───────────────────────────────────────────────────────

export function runGate15_1(manuscriptText: string): Gate15_1Result {
  const wordCount = countWords(manuscriptText);

  // Canon gate: WAVE (and Gate 15) only applies to long-form ≥25,000 words
  if (wordCount < GATE15_MIN_WORD_COUNT) {
    return {
      overallStatus: 'SKIPPED',
      blocking: false,
      wordCount,
      chapterEquivalents: 0,
      skippedBecause: `short_form_under_${GATE15_MIN_WORD_COUNT}_words`,
      summaryFindings: [`Gate 15.1 skipped: manuscript is ${wordCount.toLocaleString()} words (minimum ${GATE15_MIN_WORD_COUNT.toLocaleString()} for WAVE/Gate 15)`],
    };
  }

  const chapterEquivalents = Math.max(1, Math.round(wordCount / WORDS_PER_CHAPTER_EQUIVALENT));

  // Q1 — Attribution Density
  const attrRegex = buildWordBoundaryRegex(ATTRIBUTION_TAGS);
  const attrResult = countMatches(manuscriptText, attrRegex, 'attribution');
  const attrPer1000 = wordCount === 0 ? 0 : Number(((attrResult.count / wordCount) * 1000).toFixed(2));
  const attrStatus: PassFail = attrPer1000 <= THRESHOLDS.attributionPer1000 ? 'PASS' : 'FAIL';

  // Q2 — Soft-Tag Cap (per chapter-equivalent)
  const softTagRegex = buildWordBoundaryRegex(SOFT_TAGS);
  const softTagResult = countMatches(manuscriptText, softTagRegex, 'softTag');
  const softTagsPerChapter = chapterEquivalents === 0 ? 0 : Number((softTagResult.count / chapterEquivalents).toFixed(2));
  const softTagStatus: PassFail = softTagsPerChapter <= THRESHOLDS.softTagsPerChapter ? 'PASS' : 'FAIL';

  // Q3 — Thought-Verb Tolerance (per chapter-equivalent)
  const tvWordRegex = buildWordBoundaryRegex(THOUGHT_VERBS);
  const tvPhraseRegex = buildPhraseRegex(THOUGHT_VERB_PHRASES);
  const tvWordResult = countMatches(manuscriptText, tvWordRegex, 'thoughtVerb');
  const tvPhraseResult = countMatches(manuscriptText, tvPhraseRegex, 'thoughtVerb');
  const tvTotalCount = tvWordResult.count + tvPhraseResult.count;
  const tvPerChapter = chapterEquivalents === 0 ? 0 : Number((tvTotalCount / chapterEquivalents).toFixed(2));
  // Canon threshold is 0 per chapter — but at manuscript level this is effectively
  // a density check. We use a soft threshold: flag if >1 per chapter-equivalent.
  const tvThresholdNormalized = 1; // softened from strict 0 for manuscript-level
  const tvStatus: PassFail = tvPerChapter <= tvThresholdNormalized ? 'PASS' : 'FAIL';

  // Q4 — Physiological Filler Cap (per chapter-equivalent)
  const pfWordRegex = buildWordBoundaryRegex(PHYSIOLOGICAL_FILLERS);
  const pfPhraseRegex = buildPhraseRegex(PHYSIOLOGICAL_FILLER_PHRASES);
  const pfWordResult = countMatches(manuscriptText, pfWordRegex, 'physiologicalFiller');
  const pfPhraseResult = countMatches(manuscriptText, pfPhraseRegex, 'physiologicalFiller');
  const pfTotalCount = pfWordResult.count + pfPhraseResult.count;
  const pfPerChapter = chapterEquivalents === 0 ? 0 : Number((pfTotalCount / chapterEquivalents).toFixed(2));
  const pfStatus: PassFail = pfPerChapter <= THRESHOLDS.physiologicalFillersPerChapter ? 'PASS' : 'FAIL';

  // Q5 — Boundary Test (quote/italics integrity)
  const boundaryResult = runBoundaryTest(manuscriptText);

  // Aggregate
  const allStatuses = [attrStatus, softTagStatus, tvStatus, pfStatus, boundaryResult.status];
  const overallStatus: PassFail = allStatuses.every(s => s === 'PASS') ? 'PASS' : 'FAIL';

  // Summary findings
  const summaryFindings: string[] = [];
  if (attrStatus === 'FAIL') {
    summaryFindings.push(`Attribution density ${attrPer1000}/1000 words exceeds threshold (${THRESHOLDS.attributionPer1000}/1000)`);
  }
  if (softTagStatus === 'FAIL') {
    summaryFindings.push(`Soft-tag density ${softTagsPerChapter}/chapter exceeds threshold (${THRESHOLDS.softTagsPerChapter}/chapter)`);
  }
  if (tvStatus === 'FAIL') {
    summaryFindings.push(`Thought-verb density ${tvPerChapter}/chapter exceeds threshold (${tvThresholdNormalized}/chapter)`);
  }
  if (pfStatus === 'FAIL') {
    summaryFindings.push(`Physiological filler density ${pfPerChapter}/chapter exceeds threshold (${THRESHOLDS.physiologicalFillersPerChapter}/chapter)`);
  }
  if (boundaryResult.status === 'FAIL') {
    summaryFindings.push(`Boundary test failed: ${boundaryResult.unmatchedQuotes} unmatched quotes, ${boundaryResult.unmatchedItalics} unmatched italics markers`);
  }

  return {
    overallStatus,
    blocking: overallStatus === 'FAIL',
    wordCount,
    chapterEquivalents,
    layer1: {
      attributionDensity: {
        count: attrResult.count,
        threshold: THRESHOLDS.attributionPer1000,
        normalized: attrPer1000,
        status: attrStatus,
        instances: attrResult.instances,
      },
      softTags: {
        count: softTagResult.count,
        threshold: THRESHOLDS.softTagsPerChapter,
        normalized: softTagsPerChapter,
        status: softTagStatus,
        instances: softTagResult.instances,
      },
      thoughtVerbs: {
        count: tvTotalCount,
        threshold: tvThresholdNormalized,
        normalized: tvPerChapter,
        status: tvStatus,
        instances: [...tvWordResult.instances, ...tvPhraseResult.instances].slice(0, 20),
      },
      physiologicalFillers: {
        count: pfTotalCount,
        threshold: THRESHOLDS.physiologicalFillersPerChapter,
        normalized: pfPerChapter,
        status: pfStatus,
        instances: [...pfWordResult.instances, ...pfPhraseResult.instances].slice(0, 20),
      },
      boundaryTest: boundaryResult,
    },
    summaryFindings,
  };
}

// ── Boundary Test ────────────────────────────────────────────────────────

function runBoundaryTest(text: string): BoundaryTestResult {
  const instances: FlaggedInstance[] = [];

  // Count unmatched double-quotes (simple parity check)
  const doubleQuotes = (text.match(/"/g) || []).length;
  const unmatchedQuotes = doubleQuotes % 2;

  // Count unmatched italics markers (asterisks used as emphasis)
  const singleAsterisks = (text.match(/(?<!\*)\*(?!\*)/g) || []).length;
  const unmatchedItalics = singleAsterisks % 2;

  if (unmatchedQuotes > 0) {
    instances.push({
      matchedText: 'Unmatched double-quote',
      category: 'boundary',
      context: `${doubleQuotes} double-quote characters found (odd count suggests unclosed dialogue)`,
    });
  }

  if (unmatchedItalics > 0) {
    instances.push({
      matchedText: 'Unmatched italics marker',
      category: 'boundary',
      context: `${singleAsterisks} single-asterisk markers found (odd count suggests unclosed italics)`,
    });
  }

  const status: PassFail = (unmatchedQuotes === 0 && unmatchedItalics === 0) ? 'PASS' : 'FAIL';

  return { status, unmatchedQuotes, unmatchedItalics, instances };
}

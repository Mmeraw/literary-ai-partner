/**
 * Golden Spine / Motif Ledger — Phase 3
 *
 * Canon: Volume I (WAVE), Volume III (Evaluation Architecture), motif mapping registry
 *
 * Extracts primary/secondary narrative spines from the manuscript text and builds
 * a motif ledger tracking first-appearance, recurrence, and payoff status.
 *
 * Deterministic heuristic implementation (no LLM calls).
 * Long-form only (≥25,000 words). Non-blocking post-evaluation layer.
 */

import { GATE15_MIN_WORD_COUNT } from '../gate15/gate15_1_validator';

// ── Types ────────────────────────────────────────────────────────────────

export type PayoffStatus = 'paid' | 'partial' | 'missing' | 'overused';
export type RevisionNeed = 'must' | 'should' | 'could' | 'none';

export interface MotifEntry {
  motif: string;
  category: 'object' | 'symbol' | 'phrase' | 'location' | 'relationship' | 'theme';
  firstAppearance: string;
  occurrences: number;
  lastAppearance: string;
  payoffStatus: PayoffStatus;
  revisionNeed: RevisionNeed;
}

export interface NarrativeSpine {
  label: string;
  type: 'primary' | 'secondary';
  evidence: string[];
}

export interface GoldenSpineArtifact {
  version: 'golden_spine_v1';
  jobId: string;
  manuscriptId: string;
  wordCount: number;
  timestamp: string;
  overallStatus: 'complete' | 'skipped';
  skippedBecause?: string;
  activatedBecause?: string;
  spines: NarrativeSpine[];
  motifLedger: MotifEntry[];
  continuityScore: 'strong' | 'moderate' | 'weak';
  summaryFindings: string[];
}

// ── Detection Patterns ───────────────────────────────────────────────────

/** Common narrative objects/symbols that function as motifs */
const MOTIF_OBJECT_PATTERNS = [
  // Physical objects
  /\b(ring|necklace|locket|pendant|bracelet|watch|clock|mirror|key|knife|sword|gun|letter|photograph|diary|journal|book|map|compass|coin|badge|medal|cross|rosary|candle|lantern|torch|flag|banner|mask|veil)\b/gi,
  // Natural elements
  /\b(river|road|bridge|mountain|valley|forest|ocean|sea|storm|rain|snow|fire|flame|wind|moon|sun|star|garden|tree|rose|thorn)\b/gi,
];

/** Named character patterns (capitalized proper nouns appearing in dialogue context) */
const CHARACTER_NAME_PATTERN = /\b([A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,})?)\b/g;

/** Common English words that match the capitalized pattern at sentence start.
 *  Includes pronouns, conjunctions, prepositions, determiners, and structural labels. */
const GOLDEN_SPINE_NAME_EXCLUSIONS = new Set([
  // Pronouns (frequently capitalized at sentence start)
  'She', 'Her', 'His', 'Him', 'They', 'Them', 'Their', 'Its',
  'You', 'Your', 'Our', 'Who', 'Whom', 'Whose',
  // Demonstratives & determiners
  'The', 'This', 'That', 'These', 'Those', 'Each', 'Every', 'Some', 'Any', 'All', 'Both',
  // Conjunctions & connectors
  'And', 'But', 'For', 'Nor', 'Yet', 'Not', 'Now', 'Then', 'Than', 'Also',
  // Prepositions
  'With', 'From', 'Into', 'Over', 'After', 'Before', 'Between', 'Through',
  'During', 'Under', 'Upon', 'About', 'Above', 'Below', 'Along', 'Among',
  'Around', 'Behind', 'Beyond', 'Within', 'Without', 'Against', 'Across',
  // Interrogatives & relatives
  'What', 'When', 'Where', 'Which', 'How', 'Why',
  // Common sentence starters
  'There', 'Here', 'Once', 'Still', 'Just', 'Even', 'Only', 'Perhaps',
  'Maybe', 'Never', 'Always', 'Often', 'Sometimes', 'Already', 'Soon',
  // Structural / document labels
  'Chapter', 'Part', 'Section', 'Act', 'Book', 'Volume', 'Prologue', 'Epilogue',
  // Verbs commonly capitalized at sentence start
  'Was', 'Were', 'Had', 'Has', 'Have', 'Did', 'Does', 'Could', 'Would',
  'Should', 'May', 'Might', 'Will', 'Shall', 'Can', 'Must',
  'Said', 'Told', 'Asked', 'Thought', 'Knew', 'Felt', 'Saw', 'Came',
  'Made', 'Took', 'Went', 'Got', 'Let', 'Began', 'Seemed', 'Stood',
  'Turned', 'Looked', 'Watched', 'Called', 'Heard',
]);

// ── Helpers ──────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function getSegmentLabel(position: number, totalSegments: number): string {
  const third = totalSegments / 3;
  if (position < third) return 'Act I (Opening)';
  if (position < third * 2) return 'Act II (Middle)';
  return 'Act III (Closing)';
}

function determinePayoff(firstSegment: number, lastSegment: number, totalSegments: number, occurrences: number): PayoffStatus {
  const spanRatio = (lastSegment - firstSegment) / Math.max(1, totalSegments);
  const isIntroducedEarly = firstSegment < totalSegments / 3;
  const appearsLate = lastSegment > totalSegments * 2 / 3;

  if (occurrences >= 8 && spanRatio > 0.3) return 'overused';
  if (isIntroducedEarly && appearsLate && occurrences >= 3) return 'paid';
  if (isIntroducedEarly && !appearsLate && occurrences >= 2) return 'partial';
  if (isIntroducedEarly && occurrences <= 1) return 'missing';
  if (!isIntroducedEarly && appearsLate) return 'partial';
  return 'partial';
}

function determineRevisionNeed(payoff: PayoffStatus, occurrences: number): RevisionNeed {
  if (payoff === 'missing' && occurrences >= 2) return 'must';
  if (payoff === 'missing') return 'should';
  if (payoff === 'partial') return 'should';
  if (payoff === 'overused') return 'could';
  return 'none';
}

// ── Main Audit ───────────────────────────────────────────────────────────

export function runGoldenSpineAudit(
  manuscriptText: string,
  jobId: string,
  manuscriptId: string,
  synthesisJson?: Record<string, unknown>,
): GoldenSpineArtifact {
  const wordCount = countWords(manuscriptText);
  const timestamp = new Date().toISOString();

  if (wordCount < GATE15_MIN_WORD_COUNT) {
    return {
      version: 'golden_spine_v1',
      jobId,
      manuscriptId,
      wordCount,
      timestamp,
      overallStatus: 'skipped',
      skippedBecause: `short_form_under_${GATE15_MIN_WORD_COUNT}_words`,
      spines: [],
      motifLedger: [],
      continuityScore: 'weak',
      summaryFindings: [`Golden Spine skipped: manuscript is ${wordCount.toLocaleString()} words (minimum ${GATE15_MIN_WORD_COUNT.toLocaleString()})`],
    };
  }

  // Split manuscript into segments for positional analysis
  const paragraphs = manuscriptText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const SEGMENT_SIZE = 50;
  const segments: string[] = [];
  for (let i = 0; i < paragraphs.length; i += SEGMENT_SIZE) {
    segments.push(paragraphs.slice(i, i + SEGMENT_SIZE).join('\n\n'));
  }
  const totalSegments = segments.length;

  // Track motif occurrences across segments
  const motifMap = new Map<string, { category: MotifEntry['category']; firstSeg: number; lastSeg: number; count: number }>();

  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const segment = segments[segIdx];

    for (const pattern of MOTIF_OBJECT_PATTERNS) {
      pattern.lastIndex = 0;
      const matches = [...segment.matchAll(pattern)];
      for (const m of matches) {
        const word = m[1].toLowerCase();
        const existing = motifMap.get(word);
        if (existing) {
          existing.count++;
          existing.lastSeg = segIdx;
        } else {
          motifMap.set(word, {
            category: MOTIF_OBJECT_PATTERNS[0] === pattern ? 'object' : 'symbol',
            firstSeg: segIdx,
            lastSeg: segIdx,
            count: 1,
          });
        }
      }
    }
  }

  // Filter to significant motifs (appear 3+ times)
  const significantMotifs: MotifEntry[] = [];
  for (const [motif, data] of motifMap.entries()) {
    if (data.count < 3) continue;
    const payoffStatus = determinePayoff(data.firstSeg, data.lastSeg, totalSegments, data.count);
    significantMotifs.push({
      motif,
      category: data.category,
      firstAppearance: getSegmentLabel(data.firstSeg, totalSegments),
      occurrences: data.count,
      lastAppearance: getSegmentLabel(data.lastSeg, totalSegments),
      payoffStatus,
      revisionNeed: determineRevisionNeed(payoffStatus, data.count),
    });
  }

  // Sort by occurrence count descending, limit to top 30
  significantMotifs.sort((a, b) => b.occurrences - a.occurrences);
  const motifLedger = significantMotifs.slice(0, 30);

  // Extract narrative spines (high-frequency character names as primary spine candidates)
  const nameFrequency = new Map<string, number>();
  CHARACTER_NAME_PATTERN.lastIndex = 0;
  const nameMatches = [...manuscriptText.matchAll(CHARACTER_NAME_PATTERN)];
  for (const m of nameMatches) {
    const name = m[1];
    // Filter out common English words that match capitalized pattern
    if (GOLDEN_SPINE_NAME_EXCLUSIONS.has(name)) continue;
    nameFrequency.set(name, (nameFrequency.get(name) || 0) + 1);
  }

  const sortedNames = [...nameFrequency.entries()].sort((a, b) => b[1] - a[1]);
  const spines: NarrativeSpine[] = [];

  if (sortedNames.length > 0) {
    spines.push({
      label: `${sortedNames[0][0]} (primary character arc)`,
      type: 'primary',
      evidence: [`${sortedNames[0][1]} mentions across manuscript`],
    });
  }
  for (let i = 1; i < Math.min(3, sortedNames.length); i++) {
    if (sortedNames[i][1] > 10) {
      spines.push({
        label: `${sortedNames[i][0]} (supporting arc)`,
        type: 'secondary',
        evidence: [`${sortedNames[i][1]} mentions`],
      });
    }
  }

  // Continuity score
  const paidCount = motifLedger.filter(m => m.payoffStatus === 'paid').length;
  const totalTracked = motifLedger.length;
  const paidRatio = totalTracked === 0 ? 0 : paidCount / totalTracked;
  const continuityScore: GoldenSpineArtifact['continuityScore'] =
    paidRatio >= 0.6 ? 'strong' :
    paidRatio >= 0.3 ? 'moderate' : 'weak';

  // Summary
  const summaryFindings: string[] = [];
  summaryFindings.push(`Tracked ${motifLedger.length} significant motifs across ${totalSegments} segments`);
  summaryFindings.push(`Continuity: ${continuityScore} (${paidCount}/${totalTracked} motifs fully paid off)`);
  const missingMotifs = motifLedger.filter(m => m.payoffStatus === 'missing');
  if (missingMotifs.length > 0) {
    summaryFindings.push(`${missingMotifs.length} motifs with missing payoff: ${missingMotifs.map(m => m.motif).join(', ')}`);
  }
  const overusedMotifs = motifLedger.filter(m => m.payoffStatus === 'overused');
  if (overusedMotifs.length > 0) {
    summaryFindings.push(`${overusedMotifs.length} overused motifs: ${overusedMotifs.map(m => m.motif).join(', ')}`);
  }

  return {
    version: 'golden_spine_v1',
    jobId,
    manuscriptId,
    wordCount,
    timestamp,
    overallStatus: 'complete',
    activatedBecause: 'long_form_25000_plus',
    spines,
    motifLedger,
    continuityScore,
    summaryFindings,
  };
}

/**
 * summaryCriterionConsistencyGate.ts
 *
 * Deterministic gate that detects summary ↔ criterion contradictions.
 *
 * A contradiction occurs when:
 *   1. A criterion is SCORABLE with score <= SUMMARY_CRITERION_CONTRADICTION_SCORE_THRESHOLD
 *   2. The overview summary contains a criterion anchor AND a positive polarity term
 *      co-located within the same sentence (locality requirement)
 *   3. The criterion's own rationale contains a negative characterisation token
 *
 * Verdict:
 *   0 contradictions → PASS  (blocking: false)
 *   1 contradiction  → WARN  (blocking: false)  — possible wording false positive
 *   2+ contradictions → BLOCK (blocking: true)   — systemic summary unreliability
 *
 * Design constraints (per U3-001 architecture, approved 2026-07-07):
 *   - Deterministic only: no LLM, no embeddings, no fuzzy semantic search
 *   - Additive: does not modify artifactConsistencyGate or any existing gate
 *   - Anchor sets are derived from CRITERIA_METADATA (canonical source of truth)
 *   - Additional aliases documented explicitly, not added as competing definitions
 *   - Locality requirement: anchor and polarity must co-occur in the same sentence
 *   - Failure code QG_SUMMARY_CRITERION_CONTRADICTION written on BLOCK only
 */

import type { EvaluationResultV2, EvaluationCriterionV2 } from '@/schemas/evaluation-result-v2';
import type { CriterionKey } from '@/schemas/criteria-keys';
import { CRITERIA_METADATA } from '@/schemas/criteria-keys';

// ── Governance constant ────────────────────────────────────────────────────────
// Named explicitly so threshold changes are visible in governance history.
export const SUMMARY_CRITERION_CONTRADICTION_SCORE_THRESHOLD = 5;

// ── Types ─────────────────────────────────────────────────────────────────────

export type SummaryCriterionConsistencyVerdict = 'PASS' | 'WARN' | 'BLOCK';

export type SummaryCriterionContradiction = {
  criterion_key: CriterionKey;
  criterion_label: string;
  score_0_10: number;
  summary_excerpt: string;
  rationale_excerpt: string;
  matched_positive_tokens: string[];
  matched_negative_tokens: string[];
};

export type SummaryCriterionConsistencyResult = {
  schema_version: 'summary_criterion_consistency_v1';
  generated_at: string;
  verdict: SummaryCriterionConsistencyVerdict;
  check_id: 'summary_criterion_positive_contradiction';
  contradictions: SummaryCriterionContradiction[];
  contradiction_count: number;
  blocking: boolean;
  reason: string;
};

// ── Anchor sets ───────────────────────────────────────────────────────────────
// Derived from CRITERIA_METADATA labels and descriptions. Each set starts with
// the most specific label words, followed by documented aliases.
// Do NOT add new criterion concepts here — extend CRITERIA_METADATA instead.

const CRITERION_ANCHORS: Record<CriterionKey, string[]> = {
  // "Concept & Core Premise" — aliases: premise, core idea
  concept: ['concept', 'premise', 'core idea'],

  // "Narrative Drive & Momentum" — aliases: forward movement, drive
  narrativeDrive: ['narrative drive', 'momentum', 'forward movement', 'drive'],

  // "Character Depth & Psychological Coherence" — aliases: protagonist, psychological
  character: ['character', 'characterization', 'protagonist', 'psychological'],

  // "Point of View & Voice Control" — aliases: pov, perspective, narrator
  voice: ['voice', 'point of view', 'pov', 'perspective', 'narrator'],

  // "Scene Construction & Function" — aliases: scene work
  sceneConstruction: ['scene construction', 'scene work', 'scene'],

  // "Dialogue Authenticity & Subtext" — aliases: dialog (US spelling)
  dialogue: ['dialogue', 'dialog'],

  // "Thematic Integration" — aliases: thematic
  theme: ['theme', 'thematic'],

  // "World-Building & Environmental Logic" — aliases: worldbuilding, setting
  worldbuilding: ['worldbuilding', 'world-building', 'world building', 'setting'],

  // "Pacing & Structural Balance" — aliases: pace, rhythm, structural balance
  pacing: ['pacing', 'pace', 'rhythm', 'structural balance'],

  // "Prose Control & Line-Level Craft" — aliases: prose control, line-level, sentences
  proseControl: ['prose control', 'line-level', 'line level', 'prose', 'sentences'],

  // "Tonal Authority & Consistency" — aliases: tonal
  tone: ['tone', 'tonal'],

  // "Narrative Closure & Promises Kept" — aliases: ending, resolution, promises kept
  narrativeClosure: ['narrative closure', 'closure', 'ending', 'resolution', 'promises kept'],

  // "Professional Readiness & Market Positioning" — aliases: market, professional readiness
  marketability: ['professional readiness', 'marketability', 'market positioning', 'market'],
};

// ── Shared positive polarity terms ────────────────────────────────────────────
// A single curated set shared across all criteria. Add terms here when
// production evidence shows a positive adjective is missed — not per-criterion.

const POSITIVE_POLARITY_TERMS = [
  'strong', 'compelling', 'effective', 'excellent',
  'rich', 'well-developed', 'distinctive', 'assured',
  'confident', 'authentic', 'vivid', 'immersive',
  'satisfying', 'polished', 'precise', 'controlled',
];

// ── Negative rationale tokens ─────────────────────────────────────────────────
// High-confidence negative editorial indicators. These do not appear in
// positive rationale contexts. Extend based on production evidence only.

const NEGATIVE_RATIONALE_TOKENS = [
  'underdeveloped', 'weak', 'lacks', 'lacking', 'absent',
  'insufficient', 'thin', 'shallow', 'inconsistent',
  'unconvincing', 'unclear', 'flat', 'generic',
  'missing', 'fails to', 'fail to',
  'does not', 'no clear', 'not established',
  'needs work', 'needs development', 'needs strengthening',
  'limited', 'underpowered', 'underutilized',
];

// ── Utility helpers ───────────────────────────────────────────────────────────

/** Split text into sentences on . ! ? boundaries, preserving the delimiter. */
function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace or end-of-string.
  // Keep each fragment so indexes are recoverable if needed.
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Return a ±100-char excerpt of `text` centred on the first occurrence of
 * `token`, clamped to the nearest sentence boundary where possible.
 */
function excerpt(text: string, token: string, maxChars = 200): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(token.toLowerCase());
  if (idx === -1) return text.slice(0, maxChars).trim();

  const half = Math.floor(maxChars / 2);
  const start = Math.max(0, idx - half);
  const end = Math.min(text.length, idx + half);
  let slice = text.slice(start, end).trim();
  if (start > 0) slice = `…${slice}`;
  if (end < text.length) slice = `${slice}…`;
  return slice;
}

/**
 * Check whether `text` contains any of the given tokens (case-insensitive
 * substring match). Returns the first matching token, or null.
 */
function firstMatch(text: string, tokens: string[]): string | null {
  const lower = text.toLowerCase();
  for (const token of tokens) {
    if (lower.includes(token.toLowerCase())) return token;
  }
  return null;
}

/**
 * Collect all tokens from `tokens` that appear in `text`.
 */
function allMatches(text: string, tokens: string[]): string[] {
  const lower = text.toLowerCase();
  return tokens.filter((token) => lower.includes(token.toLowerCase()));
}

/**
 * Detect a positive signal for a given criterion in `summary`.
 *
 * Locality requirement: the criterion anchor and a positive polarity term
 * must co-occur in the **same sentence** of the summary. A polarity term
 * anywhere in the summary while the anchor is in a different sentence does
 * not count.
 *
 * Returns the matched anchor and polarity tokens, or null if no signal.
 */
function detectPositiveSignal(
  summary: string,
  criterionKey: CriterionKey,
): { anchorToken: string; polarityToken: string; sentence: string } | null {
  const anchors = CRITERION_ANCHORS[criterionKey];
  const sentences = splitIntoSentences(summary);

  for (const sentence of sentences) {
    const anchorToken = firstMatch(sentence, anchors);
    if (!anchorToken) continue;

    const polarityToken = firstMatch(sentence, POSITIVE_POLARITY_TERMS);
    if (!polarityToken) continue;

    return { anchorToken, polarityToken, sentence };
  }

  return null;
}

/**
 * Detect a negative signal in `rationale`. Returns all matching tokens.
 */
function detectNegativeSignal(rationale: string): string[] {
  return allMatches(rationale, NEGATIVE_RATIONALE_TOKENS);
}

// ── Main gate function ────────────────────────────────────────────────────────

export function runSummaryCriterionConsistencyGate(params: {
  effectiveQGResult: EvaluationResultV2;
}): SummaryCriterionConsistencyResult {
  const generatedAt = new Date().toISOString();
  const summary = params.effectiveQGResult.overview.one_paragraph_summary ?? '';
  const contradictions: SummaryCriterionContradiction[] = [];

  for (const criterion of params.effectiveQGResult.criteria) {
    // Only check SCORABLE criteria — non-scorable have no meaningful score to
    // contradict.
    if (criterion.status !== 'SCORABLE') continue;
    if (typeof criterion.score_0_10 !== 'number') continue;
    if (criterion.score_0_10 > SUMMARY_CRITERION_CONTRADICTION_SCORE_THRESHOLD) continue;

    const key = criterion.key as CriterionKey;
    const rationale = criterion.rationale ?? '';

    // Step 2: positive signal in summary (locality-enforced)
    const positiveSignal = detectPositiveSignal(summary, key);
    if (!positiveSignal) continue;

    // Step 3: negative signal in rationale
    const negativeTokens = detectNegativeSignal(rationale);
    if (negativeTokens.length === 0) continue;

    // Both signals present → contradiction
    const firstNegToken = negativeTokens[0]!;
    contradictions.push({
      criterion_key: key,
      criterion_label: CRITERIA_METADATA[key]?.label ?? key,
      score_0_10: criterion.score_0_10,
      summary_excerpt: excerpt(positiveSignal.sentence, positiveSignal.anchorToken),
      rationale_excerpt: excerpt(rationale, firstNegToken),
      matched_positive_tokens: [positiveSignal.anchorToken, positiveSignal.polarityToken],
      matched_negative_tokens: negativeTokens,
    });
  }

  // Step 4: graduated verdict
  const count = contradictions.length;
  const verdict: SummaryCriterionConsistencyVerdict =
    count === 0 ? 'PASS' : count === 1 ? 'WARN' : 'BLOCK';
  const blocking = verdict === 'BLOCK';

  const reason =
    count === 0
      ? 'No summary ↔ criterion contradictions detected.'
      : count === 1
        ? `1 summary ↔ criterion contradiction detected (criterion: ${contradictions[0]!.criterion_key}). Possible wording ambiguity — job continues.`
        : `${count} summary ↔ criterion contradictions detected (criteria: ${contradictions.map((c) => c.criterion_key).join(', ')}). Summary is not reliably representing the evaluation.`;

  return {
    schema_version: 'summary_criterion_consistency_v1',
    generated_at: generatedAt,
    verdict,
    check_id: 'summary_criterion_positive_contradiction',
    contradictions,
    contradiction_count: count,
    blocking,
    reason,
  };
}

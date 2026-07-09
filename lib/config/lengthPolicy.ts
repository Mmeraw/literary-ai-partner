/**
 * lengthPolicy.ts — Deterministic three-part length policy for all
 * LLM-generated text fields.
 *
 * GOVERNANCE CONTRACT
 * -------------------
 * Every LLM-generated text field is bounded by THREE hard integer values.
 * There are NO percentages anywhere in this policy — the LLM must never be
 * asked to compute a percentage drift, and the gate must never multiply a
 * limit by a ratio. All tolerances are expressed as literal ± counts.
 *
 *   MIN   — the minimum floor. Users MUST receive at least this much
 *           explanation. Below MIN ⇒ governance kickback (INSUFFICIENT_
 *           EXPLANATION); never pad or fabricate to reach it.
 *   BASE  — the target length we prompt the model to aim for.
 *   OVER  — the allowed overage above BASE, as a hard integer count.
 *   CAP   — BASE + OVER. A HARD ceiling the model may never exceed. LLMs need
 *           a finite cap; there is no "infinite characters/words".
 *
 * Invariant enforced at module load:  MIN <= BASE <= CAP  and  CAP = BASE+OVER.
 *
 * When a field exceeds CAP we trim at a COMPLETE-SENTENCE boundary
 * (NO_MIDSENTENCE_TRUNCATION) — never mid-sentence, never mid-word.
 *
 * Two unit systems:
 *   - CharLengthPolicy  — bounds measured in characters (pipeline synthesis
 *                         fields: summary, pitches).
 *   - WordLengthPolicy  — bounds measured in words (agent-readiness sections:
 *                         query letter, synopsis tiers, comparables, etc.).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LengthPolicy {
  /** Minimum floor (inclusive). Below this ⇒ kickback for regeneration. */
  min: number;
  /** Prompt target the model aims for. */
  base: number;
  /** Allowed overage above base, as a hard integer count (NOT a percentage). */
  overage: number;
  /** Hard ceiling = base + overage. Field may never exceed this. */
  cap: number;
  /** Unit the bounds are measured in. */
  unit: 'chars' | 'words';
}

/** Build a policy from hard integer values and assert the invariant. */
function policy(unit: 'chars' | 'words', min: number, base: number, overage: number): LengthPolicy {
  const cap = base + overage;
  if (!(min <= base && base <= cap)) {
    throw new Error(
      `Invalid length policy: expected min <= base <= cap, got min=${min} base=${base} cap=${cap} (${unit})`,
    );
  }
  return { min, base, overage, cap, unit };
}

// ─────────────────────────────────────────────────────────────────────────────
// Character-based policies — pipeline synthesis fields (normalizeArtifact)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Executive summary / overview. Author-facing prose — "more is more", so it
 * gets a generous overage above base before the hard cap. Trimmed at a
 * sentence boundary only when it exceeds CAP.
 *   MIN 300 · BASE 750 · +250 · CAP 1000 chars
 */
export const SUMMARY_POLICY: LengthPolicy = policy('chars', 300, 750, 250);

/**
 * One-sentence pitch — a single sentence, hard-capped by design.
 *   MIN 40 · BASE 180 · +40 · CAP 220 chars
 */
export const ONE_SENTENCE_PITCH_POLICY: LengthPolicy = policy('chars', 40, 180, 40);

/**
 * One-paragraph pitch — a single paragraph, hard-capped by design.
 *   MIN 200 · BASE 600 · +150 · CAP 750 chars
 */
export const ONE_PARAGRAPH_PITCH_POLICY: LengthPolicy = policy('chars', 200, 600, 150);

// ─────────────────────────────────────────────────────────────────────────────
// Word-based policies — agent-readiness submission sections
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Three synopsis tiers (Mike's 150 / 450 / 750). Bounds are in WORDS.
 * Overage is a hard word count, never a percentage.
 *
 *   short  (query)    — MIN 100 · BASE 150 · +30  · CAP 180 words
 *   medium (standard) — MIN 250 · BASE 450 · +50  · CAP 500 words
 *   long   (extended) — MIN 500 · BASE 750 · +250 · CAP 1000 words
 */
export const SYNOPSIS_POLICY = {
  short: policy('words', 100, 150, 30),
  medium: policy('words', 250, 450, 50),
  long: policy('words', 500, 750, 250),
} as const;

export type SynopsisVariant = keyof typeof SYNOPSIS_POLICY;

/**
 * Other agent-readiness sections (words). Base = prior WORD_LIMITS target,
 * with a hard-integer overage instead of the old `max * 1.1` percentage.
 */
export const SECTION_POLICY = {
  query_letter: policy('words', 200, 450, 50),
  what_makes_unique: policy('words', 60, 150, 20),
  // One-sentence query pitch: 25 floor keeps it a real sentence without
  // forcing padding; base 50, hard cap 75.
  query_pitch: policy('words', 25, 50, 25),
  comparables: policy('words', 60, 200, 25),
  author_bio: policy('words', 50, 200, 25),
} as const;

export type PolicySection = keyof typeof SECTION_POLICY;

// ─────────────────────────────────────────────────────────────────────────────
// Measurement + verdict helpers (no percentages)
// ─────────────────────────────────────────────────────────────────────────────

/** Count words the same way the generation gate does. */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Measure a text in the policy's unit. */
export function measure(text: string, unit: 'chars' | 'words'): number {
  return unit === 'words' ? countWords(text) : text.length;
}

export type LengthVerdictStatus = 'ok' | 'below_min' | 'above_cap';

export interface LengthVerdict {
  status: LengthVerdictStatus;
  measured: number;
  policy: LengthPolicy;
}

/**
 * Deterministic verdict for a text against a policy. Uses only hard integer
 * comparisons — no ratios, no drift.
 *   measured < min  ⇒ below_min  (kickback: INSUFFICIENT_EXPLANATION)
 *   measured > cap  ⇒ above_cap   (trim at sentence boundary)
 *   otherwise       ⇒ ok
 */
export function evaluateLength(text: string, p: LengthPolicy): LengthVerdict {
  const measured = measure(text, p.unit);
  let status: LengthVerdictStatus = 'ok';
  if (measured < p.min) status = 'below_min';
  else if (measured > p.cap) status = 'above_cap';
  return { status, measured, policy: p };
}

/** Human-readable target for prompts: hard numbers only, no percentages. */
export function promptRange(p: LengthPolicy): string {
  const u = p.unit === 'words' ? 'words' : 'characters';
  return `Aim for about ${p.base} ${u}. Never fewer than ${p.min} ${u}. Never more than ${p.cap} ${u}.`;
}

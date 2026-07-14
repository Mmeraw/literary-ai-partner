/**
 * lengthPolicy.ts — Deterministic length policy for LLM-generated text fields.
 *
 * GOVERNANCE CONTRACT
 * -------------------
 * Submission artifacts use industry-governed targets and limits. Evaluation
 * prose is different: its editorial depth is proportional to the manuscript,
 * and its character ceiling exists only as an abnormal-output circuit breaker.
 *
 * There are no percentage tolerances in this policy. All safeguards are literal
 * integer counts.
 */

export interface LengthPolicy {
  /** Minimum floor (inclusive). Below this may trigger regeneration. */
  min: number;
  /** Reference value retained for diagnostics; not necessarily a prompt target. */
  base: number;
  /** Integer distance from base to cap. */
  overage: number;
  /** Absolute technical or industry ceiling. */
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
// Evaluation prose — editorial intent first; caps are circuit breakers only.
// These values must not be inserted into Pass 3 prompts as desired lengths.
// Canonical prose is never trimmed to satisfy them: an over-cap result is
// rejected for regeneration.
// ─────────────────────────────────────────────────────────────────────────────

/** Executive/editorial summary: proportionate depth, 20k technical safeguard. */
export const SUMMARY_POLICY: LengthPolicy = policy('chars', 300, 1500, 18_500);

/** One complete sentence, with a 5k pathological-output safeguard. */
export const ONE_SENTENCE_PITCH_POLICY: LengthPolicy = policy('chars', 40, 400, 4600);

/** One coherent paragraph, with a 10k pathological-output safeguard. */
export const ONE_PARAGRAPH_PITCH_POLICY: LengthPolicy = policy('chars', 200, 800, 9200);

// ─────────────────────────────────────────────────────────────────────────────
// Submission artifacts — industry conventions remain authoritative.
// ─────────────────────────────────────────────────────────────────────────────

/** Three synopsis tiers (Mike's 150 / 450 / 750). Bounds are in WORDS. */
export const SYNOPSIS_POLICY = {
  short: policy('words', 100, 150, 30),
  medium: policy('words', 250, 450, 50),
  long: policy('words', 500, 750, 250),
} as const;

export type SynopsisVariant = keyof typeof SYNOPSIS_POLICY;

/** Other agent-readiness sections governed by publishing conventions. */
export const SECTION_POLICY = {
  query_letter: policy('words', 200, 450, 50),
  what_makes_unique: policy('words', 60, 150, 20),
  query_pitch: policy('words', 25, 50, 25),
  comparables: policy('words', 60, 200, 25),
  author_bio: policy('words', 50, 200, 25),
} as const;

export type PolicySection = keyof typeof SECTION_POLICY;

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

/** Deterministic verdict. Callers decide whether a policy is editorial or technical. */
export function evaluateLength(text: string, p: LengthPolicy): LengthVerdict {
  const measured = measure(text, p.unit);
  let status: LengthVerdictStatus = 'ok';
  if (measured < p.min) status = 'below_min';
  else if (measured > p.cap) status = 'above_cap';
  return { status, measured, policy: p };
}

/**
 * Human-readable range for submission-artifact prompts. Do not use this helper
 * for SUMMARY_POLICY or either evaluation pitch policy.
 */
export function promptRange(p: LengthPolicy): string {
  const u = p.unit === 'words' ? 'words' : 'characters';
  return `Aim for about ${p.base} ${u}. Never fewer than ${p.min} ${u}. Never more than ${p.cap} ${u}.`;
}

/**
 * @file legacyValueNormalizer.ts
 * @module lib/evaluation/canon
 *
 * Read-boundary normalizer for legacy evaluation artifact values.
 *
 * PURPOSE
 * -------
 * The `submission_readiness` field in evaluation artifacts stored before the
 * canon(pr2) rename used the value `"close"`. After PR 2 merged, the canonical
 * value is `"nearly_ready"`. This module normalizes stale DB rows at read time
 * so that all consumers see only canonical values regardless of when the row
 * was written.
 *
 * SCOPE
 * -----
 * Only operates on `submission_readiness`. Does NOT touch:
 * - `Pass4WindowLabel` (window-label "close" is legitimate — see canon-audit-allow)
 * - `SubmissionReadiness` (the excellence-filter type — separate domain)
 * - Any criterion key values
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * - Self-contained: zero imports from @/schemas/criteria-keys or other canon modules
 *   (avoids circular dependency and unverified re-exports)
 * - No side effects: pure transformation, no I/O
 * - Fail-safe: unknown values are passed through unchanged and logged as warnings
 * - Machine-auditable: the LEGACY_SUBMISSION_READINESS_MAP is the single source
 *   of truth for all value migrations in this domain
 */

/** Canonical submission_readiness values post-PR2 */
export type CanonicalSubmissionReadiness =
  | "queryable_now"
  | "nearly_ready"
  | "not_yet";

/**
 * All known legacy → canonical value mappings for submission_readiness.
 * Add new rows here (never remove old ones) as future renames occur.
 */
const LEGACY_SUBMISSION_READINESS_MAP: Record<string, CanonicalSubmissionReadiness> = {
  // PR2 rename: "close" was the pre-canon value
  close: "nearly_ready",
  // Canonical values are idempotent (normalize-in-place)
  queryable_now: "queryable_now",
  nearly_ready: "nearly_ready",
  not_yet: "not_yet",
} as const;

/**
 * Normalizes a raw `submission_readiness` value read from the database or an
 * evaluation artifact to its current canonical form.
 *
 * @param raw - The raw value from DB/artifact (may be a legacy string)
 * @returns Canonical submission_readiness value
 *
 * @example
 * normalizeSubmissionReadiness("close")       // → "nearly_ready"
 * normalizeSubmissionReadiness("nearly_ready") // → "nearly_ready"
 * normalizeSubmissionReadiness("queryable_now") // → "queryable_now"
 */
export function normalizeSubmissionReadiness(
  raw: unknown,
): CanonicalSubmissionReadiness {
  if (raw === null || raw === undefined) {
    // Missing value — default to conservative posture
    return "not_yet";
  }

  const str = String(raw).trim().toLowerCase();
  const canonical = LEGACY_SUBMISSION_READINESS_MAP[str];

  if (canonical !== undefined) {
    return canonical;
  }

  // Unknown value — warn and fall back to conservative
  console.warn(
    `[legacyValueNormalizer] Unknown submission_readiness value: "${str}". ` +
      `Falling back to "not_yet". Add to LEGACY_SUBMISSION_READINESS_MAP if this is valid.`,
  );
  return "not_yet";
}

/**
 * Type-guard for canonical submission_readiness values.
 * Use this after normalization to satisfy TypeScript narrowing.
 */
export function isCanonicalSubmissionReadiness(
  value: unknown,
): value is CanonicalSubmissionReadiness {
  return (
    value === "queryable_now" ||
    value === "nearly_ready" ||
    value === "not_yet"
  );
}

/**
 * Normalizes the `submission_readiness` field on a partial overall object
 * read from a stored evaluation artifact. Mutates in place and returns the
 * same object for chaining.
 *
 * Usage at DB read boundaries:
 * ```ts
 * const artifact = await db.from("evaluation_artifacts").select(...).single();
 * const overall = normalizeOverallSubmissionReadiness(artifact.data?.overall);
 * ```
 */
export function normalizeOverallSubmissionReadiness<
  T extends { submission_readiness?: unknown },
>(overall: T): T & { submission_readiness: CanonicalSubmissionReadiness } {
  return {
    ...overall,
    submission_readiness: normalizeSubmissionReadiness(overall.submission_readiness),
  };
}

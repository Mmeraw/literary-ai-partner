const DEFAULT_CHUNK_MAX_PER_PASS = 72;

function parseChunkCap(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * Canonical per-pass chunk cap resolver.
 *
 * Priority:
 * 1) EVAL_CHUNK_MAX_PER_PASS env override (must be positive integer)
 * 2) default cap = 72
 */
export function getConfiguredChunkCap(): number {
  const configured = parseChunkCap(process.env.EVAL_CHUNK_MAX_PER_PASS);
  if (configured === null) {
    return DEFAULT_CHUNK_MAX_PER_PASS;
  }

  // Tests intentionally set tiny caps (e.g., 10) to validate fail-closed paths.
  if (process.env.NODE_ENV === "test") {
    return configured;
  }

  return Math.max(DEFAULT_CHUNK_MAX_PER_PASS, configured);
}

export { DEFAULT_CHUNK_MAX_PER_PASS };
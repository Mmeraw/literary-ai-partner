export type SurfaceIntegrityStatus = "ACCEPT" | "FLAG" | "REJECT";

export type SurfaceIntegrityResult = {
  status: SurfaceIntegrityStatus;
  reasons: string[];
};

const ACTION_CLAMP_MAX_CHARS = 300;
const ACTION_CLAMP_PREFIX_BUDGET = 180;
const ACTION_CLAMP_SUFFIX_BUDGET = 119;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function ensureTerminalPunctuation(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * Stranded connector pattern.
 *
 * Mirrors the surface-integrity REJECT rules:
 *   - unresolved_conjunction_tail (and|or|by)
 *   - unresolved_mechanism_tail   (because|since|so|so that)
 *
 * If a clamp boundary lands on one of these connectors with no continuation,
 * the rendered action would be a stranded fragment. Backing off one word at a
 * time until the connector is no longer terminal restores a clean tail.
 */
const STRANDED_CONNECTOR_RE =
  /\s+(?:and|or|by|because|since|so|so\s+that)$/i;

/**
 * Bounded backoff: drop trailing words until no connector is stranded at the
 * tail. The iteration cap exists only to mistake-proof against pathological
 * inputs; in practice 1–2 hops always suffice. Returns the original text if
 * backoff would empty it (preserves a non-empty result for downstream
 * punctuation finalization).
 *
 * Punctuation tolerance: the input may already carry terminal punctuation
 * (because ensureTerminalPunctuation runs upstream in some paths). We strip
 * trailing terminal punctuation before testing, matching the REJECT regexes
 * in collectSurfaceDefects which use `\s*\.$`. ensureTerminalPunctuation in
 * finalizeClampedAction reapplies a single period after the backoff, so the
 * round-trip is idempotent.
 */
function backoffStrandedConnector(text: string): string {
  let out = text.replace(/[.!?]+\s*$/, "").trimEnd();
  for (let i = 0; i < 4; i++) {
    if (!STRANDED_CONNECTOR_RE.test(out)) return out;
    const trimmed = out.replace(/\s+\S+$/, "").trim();
    if (trimmed === out || trimmed.length === 0) return out;
    out = trimmed;
  }
  return out;
}

/**
 * Final surface-finalization for any clamped action. Every return path of
 * simulateRecommendationClamp passes through this so no truncation can leave
 * a stranded connector before terminal punctuation is applied.
 */
function finalizeClampedAction(text: string): string {
  return ensureTerminalPunctuation(backoffStrandedConnector(text));
}

/**
 * Mirrors runPass3Synthesis.ts::clampRecommendationAction.
 * This intentionally duplicates the clamp boundary so surface validation can
 * prove the final rendered action will still be valid after downstream clamp.
 * The two implementations are a witness pair: if either drifts, the
 * post-clamp surface check in checkSurfaceIntegrity catches the divergence.
 */
function simulateRecommendationClamp(action: string): string {
  const normalized = normalizeText(action);
  if (normalized.length <= ACTION_CLAMP_MAX_CHARS) return finalizeClampedAction(normalized);

  const mechanismMatch = normalized.match(/\b(because|since|so that)\b/i);
  if (!mechanismMatch || mechanismMatch.index === undefined) {
    return finalizeClampedAction(
      normalized.slice(0, ACTION_CLAMP_MAX_CHARS).replace(/\s+\S*$/, "").trim(),
    );
  }

  const mechanismIndex = mechanismMatch.index;
  const prefix = normalized.slice(0, mechanismIndex).trim();
  const suffix = normalized.slice(mechanismIndex).trim();

  const safePrefix =
    prefix.length > ACTION_CLAMP_PREFIX_BUDGET
      ? prefix.slice(0, ACTION_CLAMP_PREFIX_BUDGET).replace(/\s+\S*$/, "").trim()
      : prefix;

  const safeSuffix =
    suffix.length > ACTION_CLAMP_SUFFIX_BUDGET
      ? suffix.slice(0, ACTION_CLAMP_SUFFIX_BUDGET).replace(/\s+\S*$/, "").trim()
      : suffix;

  const clamped = `${safePrefix} ${safeSuffix}`.trim();
  return finalizeClampedAction(
    clamped.length <= ACTION_CLAMP_MAX_CHARS
      ? clamped
      : clamped.slice(0, ACTION_CLAMP_MAX_CHARS).replace(/\s+\S*$/, "").trim(),
  );
}

function buildResult(status: SurfaceIntegrityStatus, reasons: string[] = []): SurfaceIntegrityResult {
  return {
    status,
    reasons,
  };
}

function collectSurfaceDefects(text: string): { rejectReasons: Set<string>; flagReasons: Set<string> } {
  const normalized = normalizeText(text);
  const rejectReasons = new Set<string>();
  const flagReasons = new Set<string>();

  if (!normalized) {
    rejectReasons.add("empty_text");
    return { rejectReasons, flagReasons };
  }

  // 1) Fragment-only infinitive lead with no main clause.
  // Example reject: "To make it more personal."
  if (/^to\b[^,]*\.$/i.test(normalized)) {
    rejectReasons.add("fragment_to_clause_without_main_clause");
  }

  // 2) Clause glue / connector collisions.
  if (/\bso\b[^.]*\bbecause\b/i.test(normalized)) {
    rejectReasons.add("connector_collision_so_because");
  }
  if (/\bso\s+that\b[^.]*\bbecause\b/i.test(normalized)) {
    rejectReasons.add("connector_collision_so_that_because");
  }

  // 3) Unresolved conjunction / mechanism tails.
  if (/\b(and|or|by)\s*\.$/i.test(normalized)) {
    rejectReasons.add("unresolved_conjunction_tail");
  }
  if (/\b(because|since|so|so\s+that)\s*\.$/i.test(normalized)) {
    rejectReasons.add("unresolved_mechanism_tail");
  }

  // 4) Incomplete tails / dangling comparatives and adjectives.
  if (/\bmore\s*\.$/i.test(normalized)) {
    rejectReasons.add("dangling_comparative_tail");
  }
  if (/\b(?:adding|make|making)\b[^.]*\bmore\s+(?:specific|detailed)\s*\.$/i.test(normalized)) {
    rejectReasons.add("dangling_adjective_missing_object");
  }
  if (/\badding\s+more\s+personal\s*\.$/i.test(normalized)) {
    rejectReasons.add("dangling_adjective_missing_object");
  }

  // Borderline case kept as FLAG (bounded repair candidate).
  if (/\bmake\s+the\s+secondary\s+characters\s+more\s+personal\s*\.$/i.test(normalized)) {
    flagReasons.add("borderline_comparative_needs_noun_anchor");
  }

  // 5) Generic bare imperatives with no concrete mechanism path.
  const genericImperative = /^(Improve|Trim|Tighten)\b/i.test(normalized);
  const hasConcreteMechanism = /\b(by|because|so that)\b/i.test(normalized);
  if (genericImperative && !hasConcreteMechanism) {
    rejectReasons.add("generic_bare_imperative_missing_mechanism");
  }

  // 6) Dangling/orphaned modifier attachment (flag for bounded repair).
  if (/^By\s+[^,]+,\s*the\s+[^,]+\b(becomes|is|feels)\b/i.test(normalized)) {
    flagReasons.add("possible_dangling_modifier_attachment");
  }

  return { rejectReasons, flagReasons };
}

export function checkSurfaceIntegrity(text: string): SurfaceIntegrityResult {
  const normalized = normalizeText(text);
  const { rejectReasons, flagReasons } = collectSurfaceDefects(normalized);

  // Mistake-proofing: downstream clamping is itself a text mutation. Validate the
  // simulated post-clamp surface here so no later clamp can introduce dangling
  // tails after the integrity decision has already been made.
  if (normalized.length > ACTION_CLAMP_MAX_CHARS) {
    const clamped = simulateRecommendationClamp(normalized);
    const clampedDefects = collectSurfaceDefects(clamped);
    for (const reason of clampedDefects.rejectReasons) {
      rejectReasons.add(`post_clamp_${reason}`);
    }
    for (const reason of clampedDefects.flagReasons) {
      flagReasons.add(`post_clamp_${reason}`);
    }
  }

  if (rejectReasons.size > 0) {
    return buildResult("REJECT", Array.from(rejectReasons));
  }

  if (flagReasons.size > 0) {
    return buildResult("FLAG", Array.from(flagReasons));
  }

  return buildResult("ACCEPT");
}

export function annotateSurfaceIntegrityFlag(expectedImpact: string, reasons: string[]): string {
  const normalized = normalizeText(expectedImpact);
  if (reasons.length === 0) {
    return normalized;
  }

  const annotation = `Surface-integrity flag: ${reasons.join("; ")}.`;
  if (normalized.length === 0) {
    return annotation;
  }

  if (/surface-integrity flag:/i.test(normalized)) {
    return normalized;
  }

  return `${normalized} ${annotation}`;
}

export function repairSurfaceIntegrity(text: string, reasons: string[]): string | null {
  const normalized = normalizeText(text);
  if (!normalized || reasons.length === 0) {
    return null;
  }

  let repaired = normalized;
  let changed = false;

  if (
    reasons.includes("connector_collision_so_because") ||
    reasons.includes("connector_collision_so_that_because")
  ) {
    // Deterministically collapse malformed connector chains:
    // "... so ... because ..." -> "... because ..."
    const collapsed = repaired.replace(/\bso\b[^.]*?\bbecause\b\s*/i, "because ");
    if (collapsed !== repaired) {
      repaired = collapsed;
      changed = true;
    }
  }

  if (reasons.includes("unresolved_conjunction_tail")) {
    const trimmedTail = repaired.replace(/\s+(and|or|by)\s*\.$/i, ".");
    if (trimmedTail !== repaired) {
      repaired = trimmedTail;
      changed = true;
    }
  }

  if (reasons.includes("unresolved_mechanism_tail")) {
    const trimmedTail = repaired.replace(/\s+(because|since|so|so\s+that)\s*\.$/i, ".");
    if (trimmedTail !== repaired) {
      repaired = trimmedTail;
      changed = true;
    }
  }

  if (!changed) {
    return null;
  }

  return normalizeText(repaired);
}

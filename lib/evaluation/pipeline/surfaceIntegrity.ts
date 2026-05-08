export type SurfaceIntegrityStatus = "ACCEPT" | "FLAG" | "REJECT";

export type SurfaceIntegrityResult = {
  status: SurfaceIntegrityStatus;
  reasons: string[];
};

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function buildResult(status: SurfaceIntegrityStatus, reasons: string[] = []): SurfaceIntegrityResult {
  return {
    status,
    reasons,
  };
}

export function checkSurfaceIntegrity(text: string): SurfaceIntegrityResult {
  const normalized = normalizeText(text);
  if (!normalized) {
    return buildResult("REJECT", ["empty_text"]);
  }

  const rejectReasons = new Set<string>();
  const flagReasons = new Set<string>();

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

  // 3) Unresolved conjunction tails.
  if (/\b(and|or|by)\s*\.$/i.test(normalized)) {
    rejectReasons.add("unresolved_conjunction_tail");
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

  if (!changed) {
    return null;
  }

  return normalizeText(repaired);
}

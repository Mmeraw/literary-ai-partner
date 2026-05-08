const DASH_PATTERN = /\s+[—–]\s+/g;
const DOUBLE_HYPHEN_PATTERN = /\s+--\s+/g;
const CONTRACTION_APOSTROPHE_PATTERN = /([A-Za-z])'([A-Za-z])/g;
const MULTISPACE_PATTERN = /[ \t]{2,}/g;

export type RenderSegment = {
  type: "critic" | "evidence";
  text: string | null | undefined;
};

function normalizeCriticSegment(text: string): string {
  return text
    .replace(DOUBLE_HYPHEN_PATTERN, " — ")
    .replace(DASH_PATTERN, "—")
    .replace(CONTRACTION_APOSTROPHE_PATTERN, "$1’$2")
    .replace(MULTISPACE_PATTERN, " ")
    .replace(/\s+([,.;:!?])/g, "$1");
}

export function preserveEvidenceText(input: string | null | undefined): string {
  return typeof input === "string" ? input : "";
}

/**
 * Deterministic Chicago-style normalization for RevisionGrade-authored user-facing prose.
 * Scope: renderer/report text only (not diagnostics, telemetry, or JSON envelopes).
 */
export function normalizeCriticText(input: string | null | undefined): string {
  const raw = typeof input === "string" ? input : "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  return normalizeCriticSegment(trimmed).trim();
}

/**
 * Render mixed-provenance content by provenance type, not punctuation.
 */
export function renderMixedText(segments: RenderSegment[]): string {
  return segments
    .map((segment) => {
      if (segment.type === "evidence") {
        return preserveEvidenceText(segment.text);
      }
      const criticRaw = typeof segment.text === "string" ? segment.text : "";
      return normalizeCriticSegment(criticRaw);
    })
    .join("")
    .trim();
}

/**
 * Backward-compatible alias for existing call sites.
 */
export function normalizeChicagoSurfaceText(input: string | null | undefined): string {
  return normalizeCriticText(input);
}

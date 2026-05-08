const DASH_PATTERN = /\s+[—–]\s+/g;
const DOUBLE_HYPHEN_PATTERN = /\s+--\s+/g;
const CONTRACTION_APOSTROPHE_PATTERN = /([A-Za-z])'([A-Za-z])/g;
const MULTISPACE_PATTERN = /[ \t]{2,}/g;

function normalizeUnquotedSegment(text: string): string {
  return text
    .replace(DOUBLE_HYPHEN_PATTERN, " — ")
    .replace(DASH_PATTERN, "—")
    .replace(CONTRACTION_APOSTROPHE_PATTERN, "$1’$2")
    .replace(MULTISPACE_PATTERN, " ")
    .replace(/\s+([,.;:!?])/g, "$1");
}

function splitQuotedAndUnquoted(text: string): Array<{ quoted: boolean; value: string }> {
  const segments: Array<{ quoted: boolean; value: string }> = [];
  let current = "";
  let inQuote = false;
  let quoteCloser = "";

  const flush = (quoted: boolean) => {
    if (!current) return;
    segments.push({ quoted, value: current });
    current = "";
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (!inQuote && (ch === '"' || ch === "“")) {
      flush(false);
      inQuote = true;
      quoteCloser = ch === '"' ? '"' : "”";
      current += ch;
      continue;
    }

    if (inQuote) {
      current += ch;
      if (ch === quoteCloser) {
        flush(true);
        inQuote = false;
        quoteCloser = "";
      }
      continue;
    }

    current += ch;
  }

  if (current) {
    flush(inQuote);
  }

  return segments;
}

/**
 * Deterministic Chicago-style normalization for user-facing prose.
 * Scope: renderer/report text only (not diagnostics, telemetry, or JSON envelopes).
 */
export function normalizeChicagoSurfaceText(input: string | null | undefined): string {
  const raw = typeof input === "string" ? input : "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const segmented = splitQuotedAndUnquoted(trimmed)
    .map((segment) => (segment.quoted ? segment.value : normalizeUnquotedSegment(segment.value)))
    .join("");

  return segmented.trim();
}

const DASH_PATTERN = /\s+[—–]\s+/g;
const DOUBLE_HYPHEN_PATTERN = /\s+--\s+/g;
const CONTRACTION_APOSTROPHE_PATTERN = /([A-Za-z])'([A-Za-z])/g;
const MULTISPACE_PATTERN = /[ \t]{2,}/g;

function smartenDoubleQuotes(text: string): string {
  let out = "";
  let open = true;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch !== '"') {
      out += ch;
      continue;
    }

    const prev = i > 0 ? text[i - 1] : "";
    const isLikelyOpening =
      prev === "" ||
      /[\s([\{—–-]/.test(prev);

    if (isLikelyOpening) {
      out += "“";
      open = false;
      continue;
    }

    if (open) {
      out += "“";
      open = false;
    } else {
      out += "”";
      open = true;
    }
  }

  return out;
}

/**
 * Deterministic Chicago-style normalization for user-facing prose.
 * Scope: renderer/report text only (not diagnostics, telemetry, or JSON envelopes).
 */
export function normalizeChicagoSurfaceText(input: string | null | undefined): string {
  const raw = typeof input === "string" ? input : "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const normalizedDashes = trimmed
    .replace(DOUBLE_HYPHEN_PATTERN, " — ")
    .replace(DASH_PATTERN, "—");

  const normalizedApostrophes = normalizedDashes.replace(
    CONTRACTION_APOSTROPHE_PATTERN,
    "$1’$2",
  );

  const smartQuotes = smartenDoubleQuotes(normalizedApostrophes);

  return smartQuotes
    .replace(MULTISPACE_PATTERN, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

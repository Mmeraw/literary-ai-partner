export const ENGLISH_VARIANTS = ["us", "uk", "ca", "au", "za", "nz"] as const;

export type EnglishVariant = (typeof ENGLISH_VARIANTS)[number];

const ENGLISH_VARIANT_LABELS: Record<EnglishVariant, string> = {
  us: "American English",
  uk: "British English",
  ca: "Canadian English",
  au: "Australian English",
  za: "South African English",
  nz: "New Zealand English",
};

export function normalizeEnglishVariant(value: unknown): EnglishVariant {
  if (typeof value !== "string") return "us";
  const normalized = value.trim().toLowerCase();
  return ENGLISH_VARIANTS.includes(normalized as EnglishVariant)
    ? (normalized as EnglishVariant)
    : "us";
}

export function englishVariantLabel(value: unknown): string {
  return ENGLISH_VARIANT_LABELS[normalizeEnglishVariant(value)];
}

export function buildEnglishVariantPromptBlock(value: unknown): string {
  const label = englishVariantLabel(value);

  return `AUTHOR-FACING LANGUAGE CONTRACT — ${label}
- All RevisionGrade-generated author-facing output MUST use ${label}: summaries, rationales, recommendations, executive verdicts, revision plans, candidate prose, headings that are part of the generated report, and any future editorial content produced from this prompt.
- Do NOT silently fall back to American English unless ${label} is the selected variant.
- NEVER alter manuscript text, quotations, excerpts, evidence snippets, anchor_snippet values, or author-provided content. Copy quoted/source text exactly as supplied, preserving original spelling, punctuation, and wording even when it differs from ${label}.
- Apply the selected variant only to new system-generated editorial prose.`;
}

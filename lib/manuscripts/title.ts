const PLACEHOLDER_TITLE_PATTERNS = [
  /^untitled(?:\s+(?:manuscript|upload))?$/i,
  /^new\s+document$/i,
  /^document$/i,
  /^draft$/i,
  /^my\s+writing$/i,
];

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripDecorations(value: string): string {
  return value
    .replace(/^[\s#>*\-–—:]+/, "")
    .replace(/[\s:;\-–—]+$/, "")
    .trim();
}

export function normalizeTitleCandidate(input: unknown): string | null {
  if (typeof input !== "string") return null;

  const collapsed = collapseWhitespace(input);
  if (!collapsed) return null;

  const stripped = stripDecorations(collapsed);
  if (!stripped) return null;

  if (PLACEHOLDER_TITLE_PATTERNS.some((pattern) => pattern.test(stripped))) {
    return null;
  }

  return stripped;
}

function firstMeaningfulLine(text: string): string | null {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripDecorations(collapseWhitespace(rawLine));
    if (!line) continue;

    if (/^[\[{(<\"'`\d\W]+$/.test(line)) continue;
    return line;
  }
  return null;
}

function firstMeaningfulWords(text: string, maxWords = 8): string | null {
  const words = collapseWhitespace(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);

  if (words.length === 0) return null;

  return words.slice(0, maxWords).join(" ");
}

export function deriveManuscriptTitleFromText(text: string): string {
  const trimmed = collapseWhitespace(text);
  if (!trimmed) return "Imported Manuscript";

  const line = firstMeaningfulLine(text);
  if (line && line.length <= 80) {
    const normalizedLine = normalizeTitleCandidate(line);
    if (normalizedLine) return normalizedLine;
  }

  const words = firstMeaningfulWords(trimmed);
  if (words) {
    const normalizedWords = normalizeTitleCandidate(words);
    if (normalizedWords) {
      return normalizedWords.length > 72
        ? `${normalizedWords.slice(0, 69).trimEnd()}...`
        : normalizedWords;
    }
  }

  return "Imported Manuscript";
}

export function deriveManuscriptTitleFromFileName(fileName: string): string | null {
  const stem = fileName.replace(/\.[^.]+$/, "").replace(/[._-]+/g, " ");
  const normalized = normalizeTitleCandidate(stem);
  if (!normalized) return null;

  if (!/[A-Za-z\p{L}]/u.test(normalized)) return null;
  if (/^\d+$/.test(normalized.replace(/\s+/g, ""))) return null;

  return normalized.length > 72 ? `${normalized.slice(0, 69).trimEnd()}...` : normalized;
}

export function resolveManuscriptTitle(params: {
  explicitTitle?: unknown;
  text?: string;
  fileName?: string;
  fallback?: string;
}): string {
  const explicit = normalizeTitleCandidate(params.explicitTitle);
  if (explicit) return explicit;

  if (params.text && params.text.trim().length > 0) {
    return deriveManuscriptTitleFromText(params.text);
  }

  if (params.fileName) {
    const fromFileName = deriveManuscriptTitleFromFileName(params.fileName);
    if (fromFileName) return fromFileName;
  }

  return params.fallback?.trim() || "Imported Manuscript";
}

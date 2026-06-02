const PLACEHOLDER_TITLE_PATTERNS = [
  /^untitled(?:\s+(?:manuscript|upload))?$/i,
  /^new\s+document$/i,
  /^document$/i,
  /^draft$/i,
  /^my\s+writing$/i,
];

const GENERIC_OPENING_PATTERNS = [
  /^chapter\s*$/i,
  /^contents?$/i,
  /^table\s+of\s+contents$/i,
  /^part\s+(?:one|two|three|four|five|\d+|[ivxlcdm]+)$/i,
  /^book\s+(?:one|two|three|four|five|\d+|[ivxlcdm]+)$/i,
];

const SPELLED_ORDINALS =
  "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth";

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripDecorations(value: string): string {
  return value
    .replace(/^[\s#>*\-–—:]+/, "")
    .replace(/[\s:;\-–—]+$/, "")
    .trim();
}

function truncateTitle(value: string, maxLength = 96): string {
  const trimmed = value.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 3).trimEnd()}...` : trimmed;
}

function isByline(value: string): boolean {
  return /^(?:by|author|written\s+by)\s+[\p{L}][\p{L} .,'’-]+$/iu.test(value.trim());
}

function isGenericOpeningLine(value: string): boolean {
  return GENERIC_OPENING_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

function isChapterHeading(value: string): boolean {
  const line = value.trim();
  if (!line) return false;

  if (new RegExp(`^chapter\\s+(?:\\d{1,4}|[ivxlcdm]+|${SPELLED_ORDINALS})(?:\\b|[:.\\-–—])`, "iu").test(line)) {
    return true;
  }

  if (/^(?:prologue|epilogue|preface|introduction)(?:\b|[:.\-–—])/i.test(line)) {
    return true;
  }

  // Public-domain and manuscript excerpts often begin chapter headings as:
  // "1 A Fellow Traveller" or "I The Shadow on the Door".
  // Only treat this as a chapter heading when there is actual heading text after the marker.
  return /^(?:\d{1,3}|[ivxlcdm]{1,8})\s+[\p{L}"'“‘]/iu.test(line);
}

function meaningfulLines(text: string, limit = 16): string[] {
  const lines: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripDecorations(collapseWhitespace(rawLine));
    if (!line) continue;
    if (/^[\[{(<"'`\d\W]+$/.test(line)) continue;

    lines.push(line);
    if (lines.length >= limit) break;
  }

  return lines;
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

  if (isByline(stripped) || isGenericOpeningLine(stripped)) {
    return null;
  }

  return stripped;
}

function firstMeaningfulLine(text: string): string | null {
  return meaningfulLines(text, 1)[0] ?? null;
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

function deriveStructuredTitleFromOpeningLines(text: string): string | null {
  const lines = meaningfulLines(text, 18);
  if (lines.length === 0) return null;

  const titleLine = lines.find((line) => {
    const normalized = normalizeTitleCandidate(line);
    return Boolean(normalized && normalized.length <= 80 && !isChapterHeading(normalized));
  });

  if (!titleLine) return null;

  const titleIndex = lines.indexOf(titleLine);
  const normalizedTitle = normalizeTitleCandidate(titleLine);
  if (!normalizedTitle) return null;

  const chapterLine = lines
    .slice(titleIndex + 1, titleIndex + 8)
    .filter((line) => !isByline(line))
    .find((line) => {
      const normalized = normalizeTitleCandidate(line);
      return Boolean(normalized && normalized.length <= 80 && isChapterHeading(normalized));
    });

  const normalizedChapter = normalizeTitleCandidate(chapterLine);
  if (normalizedChapter) {
    return truncateTitle(`${normalizedTitle} — ${normalizedChapter}`);
  }

  return truncateTitle(normalizedTitle, 72);
}

export function deriveManuscriptTitleFromText(text: string): string {
  const trimmed = collapseWhitespace(text);
  if (!trimmed) return "Imported Manuscript";

  const structuredTitle = deriveStructuredTitleFromOpeningLines(text);
  if (structuredTitle) return structuredTitle;

  const line = firstMeaningfulLine(text);
  if (line && line.length <= 80) {
    const normalizedLine = normalizeTitleCandidate(line);
    if (normalizedLine) return truncateTitle(normalizedLine, 72);
  }

  const words = firstMeaningfulWords(trimmed);
  if (words) {
    const normalizedWords = normalizeTitleCandidate(words);
    if (normalizedWords) {
      return truncateTitle(normalizedWords, 72);
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

  return truncateTitle(normalized, 72);
}

export function resolveManuscriptTitle(params: {
  explicitTitle?: unknown;
  text?: string;
  fileName?: string;
  fallback?: string;
}): string {
  const explicit = normalizeTitleCandidate(params.explicitTitle);
  if (explicit) return truncateTitle(explicit, 96);

  if (params.text && params.text.trim().length > 0) {
    return deriveManuscriptTitleFromText(params.text);
  }

  if (params.fileName) {
    const fromFileName = deriveManuscriptTitleFromFileName(params.fileName);
    if (fromFileName) return fromFileName;
  }

  return params.fallback?.trim() || "Imported Manuscript";
}

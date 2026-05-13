export type ExcludedSectionKind =
  | "title_page"
  | "table_of_contents"
  | "disclaimer"
  | "dedication"
  | "research_note"
  | "index"
  | "custom_non_evaluative";

export type ExcludedSection = {
  kind: ExcludedSectionKind;
  label: string;
  startLine: number; // 1-based inclusive
  endLine: number; // 1-based inclusive
};

export type NonEvaluativeStripResult = {
  sanitizedText: string;
  excludedSections: ExcludedSection[];
};

const CHAPTER_HEADING_RE =
  /^\s*#*\s*(chapter|ch\.?)\s+(\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;

const TOC_HEADING_RE = /^\s*(table\s+of\s+contents|contents)\s*$/i;
const DISCLAIMER_HEADING_RE = /^\s*disclaimer\s*$/i;
const DEDICATION_HEADING_RE = /^\s*dedication\s*$/i;
const RESEARCH_NOTE_HEADING_RE = /^\s*research\s+note\s*$/i;
const INDEX_HEADING_RE = /^\s*index\s*$/i;
const BEFORE_CARTELS_HEADING_RE = /^\s*before\s+cartels,?\s+there['’]s\s+us\s*$/i;

const TITLE_PAGE_SIGNAL_RE =
  /(^\s*[©©]\s*\d{4}\b)|(^\s*all\s+rights\s+reserved\b)|(^\s*a\s+novel\s*$)|(^\s*by\s+.+$)/im;

function isAnyStructuralHeading(line: string): boolean {
  return (
    CHAPTER_HEADING_RE.test(line) ||
    TOC_HEADING_RE.test(line) ||
    DISCLAIMER_HEADING_RE.test(line) ||
    DEDICATION_HEADING_RE.test(line) ||
    RESEARCH_NOTE_HEADING_RE.test(line) ||
    INDEX_HEADING_RE.test(line) ||
    BEFORE_CARTELS_HEADING_RE.test(line)
  );
}

function nextHeadingLine(lines: string[], fromIdxExclusive: number): number {
  for (let i = fromIdxExclusive + 1; i < lines.length; i++) {
    if (isAnyStructuralHeading(lines[i])) return i;
  }
  return lines.length - 1;
}

function markRange(markers: boolean[], start: number, endInclusive: number) {
  if (start < 0 || endInclusive < start) return;
  for (let i = start; i <= Math.min(endInclusive, markers.length - 1); i++) {
    markers[i] = true;
  }
}

export function stripNonEvaluativeSections(rawText: string): NonEvaluativeStripResult {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (text.trim().length === 0) {
    return { sanitizedText: text, excludedSections: [] };
  }

  const lines = text.split("\n");
  const remove = new Array<boolean>(lines.length).fill(false);
  const excludedSections: ExcludedSection[] = [];

  // 1) Title-page style preface: contiguous non-blank lead-in before first structural heading,
  // only when it carries title-page signals.
  let firstHeadingIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isAnyStructuralHeading(lines[i])) {
      firstHeadingIdx = i;
      break;
    }
  }

  if (firstHeadingIdx > 0) {
    const lead = lines.slice(0, firstHeadingIdx).join("\n");
    if (TITLE_PAGE_SIGNAL_RE.test(lead)) {
      markRange(remove, 0, firstHeadingIdx - 1);
      excludedSections.push({
        kind: "title_page",
        label: "Title page / copyright front matter",
        startLine: 1,
        endLine: firstHeadingIdx,
      });
    }
  }

  // 2) Explicit headed sections.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const addSection = (kind: ExcludedSectionKind, label: string, endIdx: number) => {
      markRange(remove, i, endIdx);
      excludedSections.push({
        kind,
        label,
        startLine: i + 1,
        endLine: endIdx + 1,
      });
    };

    if (TOC_HEADING_RE.test(line)) {
      const next = nextHeadingLine(lines, i);
      addSection("table_of_contents", "Table of contents", next === i ? i : next - 1);
      continue;
    }

    if (DISCLAIMER_HEADING_RE.test(line)) {
      const next = nextHeadingLine(lines, i);
      addSection("disclaimer", "Disclaimer", next === i ? i : next - 1);
      continue;
    }

    if (DEDICATION_HEADING_RE.test(line)) {
      const next = nextHeadingLine(lines, i);
      addSection("dedication", "Dedication", next === i ? i : next - 1);
      continue;
    }

    if (RESEARCH_NOTE_HEADING_RE.test(line)) {
      addSection("research_note", "Research note", lines.length - 1);
      continue;
    }

    if (INDEX_HEADING_RE.test(line)) {
      addSection("index", "Index", lines.length - 1);
      continue;
    }

    if (BEFORE_CARTELS_HEADING_RE.test(line)) {
      const next = nextHeadingLine(lines, i);
      const end = next === i ? lines.length - 1 : next - 1;
      addSection("custom_non_evaluative", "Before Cartels, There’s Us", end);
      continue;
    }
  }

  const sanitizedLines = lines.filter((_, idx) => !remove[idx]);
  const sanitizedText = sanitizedLines.join("\n").replace(/\n{4,}/g, "\n\n\n").trim();

  return {
    sanitizedText,
    excludedSections,
  };
}

export function buildNonEvaluativeWarning(excludedSections: ExcludedSection[]): string | null {
  if (!excludedSections || excludedSections.length === 0) return null;
  const uniqueLabels = Array.from(new Set(excludedSections.map((s) => s.label)));
  return `Non-evaluative sections were excluded from scoring: ${uniqueLabels.join(", ")}.`;
}

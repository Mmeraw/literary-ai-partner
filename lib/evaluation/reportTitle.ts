export type ReportTitleInput = {
  chapterTitle?: string | null;
  manuscriptTitle?: string | null;
  sourceTitle?: string | null;
};

export type ReportTitleResolution = {
  displayTitle: string;
  pageTitle: string;
  chapterTitle: string | null;
  manuscriptTitle: string | null;
};

/**
 * Internal/test suffixes that should never appear in a customer-facing report.
 * These are stripped from the display title automatically.
 */
const INTERNAL_TITLE_SUFFIXES = /\s*(?:NO\s+TOC\s+TEST\s+FILE|TEST\s*FILE|CALIBRATION\s*FILE|BENCHMARK\s*RUN|\(TEST\)|\[TEST\]|\[INTERNAL\])\s*$/i;

function normalizeTitle(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length === 0) return null;
  // Strip internal test suffixes that should never appear in author-facing reports
  return trimmed.replace(INTERNAL_TITLE_SUFFIXES, '').trim() || null;
}

export function resolveReportTitle(input: ReportTitleInput): ReportTitleResolution {
  const chapterTitle = normalizeTitle(input.chapterTitle);
  const manuscriptTitle = normalizeTitle(input.manuscriptTitle);
  const sourceTitle = normalizeTitle(input.sourceTitle);
  const displayTitle = chapterTitle || manuscriptTitle || sourceTitle || "Untitled";

  return {
    displayTitle,
    pageTitle: "Evaluation Report",
    chapterTitle,
    manuscriptTitle,
  };
}

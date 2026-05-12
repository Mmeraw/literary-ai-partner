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

function normalizeTitle(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function resolveReportTitle(input: ReportTitleInput): ReportTitleResolution {
  const chapterTitle = normalizeTitle(input.chapterTitle);
  const manuscriptTitle = normalizeTitle(input.manuscriptTitle);
  const sourceTitle = normalizeTitle(input.sourceTitle);
  const displayTitle = chapterTitle || manuscriptTitle || sourceTitle || "Untitled";

  return {
    displayTitle,
    pageTitle: `${displayTitle} — Evaluation Report`,
    chapterTitle,
    manuscriptTitle,
  };
}

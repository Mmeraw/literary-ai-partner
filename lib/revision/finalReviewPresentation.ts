export type AnchorableFinalReviewDecision = {
  id: string;
  decision: "accepted_a" | "accepted_b" | "accepted_c" | "custom" | "keep_original" | "reject" | "deferred";
  selectedText: string | null;
  customText: string | null;
  sourceExcerpt: string | null;
};

export type AnchoredPreviewParagraph = {
  text: string;
  decisionIds: string[];
};

export type AnchoredPreviewResult = {
  paragraphs: AnchoredPreviewParagraph[];
  applicableDecisionCount: number;
  anchoredDecisionCount: number;
  unmatchedDecisionCount: number;
};

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function countOccurrences(text: string, search: string): number {
  if (!search) return 0;
  let count = 0;
  let cursor = 0;
  while (cursor <= text.length - search.length) {
    const index = text.indexOf(search, cursor);
    if (index < 0) break;
    count += 1;
    cursor = index + search.length;
  }
  return count;
}

export function splitFinalReviewParagraphs(sourceText: string): string[] {
  return sourceText
    .split(/\n{2,}/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(0, 48);
}

export function buildAnchoredMarkedPreview(
  sourceText: string,
  decisions: AnchorableFinalReviewDecision[],
): AnchoredPreviewResult {
  const paragraphs: AnchoredPreviewParagraph[] = splitFinalReviewParagraphs(sourceText).map((text) => ({
    text,
    decisionIds: [],
  }));

  const applicable = decisions.filter((decision) =>
    ["accepted_a", "accepted_b", "accepted_c", "custom"].includes(decision.decision),
  );

  let anchoredDecisionCount = 0;

  for (const decision of applicable) {
    const source = clean(decision.sourceExcerpt);
    const replacement = clean(decision.decision === "custom" ? decision.customText : decision.selectedText);
    if (!source || !replacement) continue;

    // Fail closed when the source excerpt is ambiguous in the manuscript.
    if (countOccurrences(sourceText, source) !== 1) continue;

    const matchingParagraphIndexes = paragraphs
      .map((paragraph, index) => ({ index, occurrences: countOccurrences(paragraph.text, source) }))
      .filter((entry) => entry.occurrences === 1)
      .map((entry) => entry.index);

    // Cross-paragraph and ambiguous matches stay changelog-only.
    if (matchingParagraphIndexes.length !== 1) continue;

    const paragraph = paragraphs[matchingParagraphIndexes[0]];
    paragraph.text = paragraph.text.replace(source, replacement);
    paragraph.decisionIds.push(decision.id);
    anchoredDecisionCount += 1;
  }

  return {
    paragraphs,
    applicableDecisionCount: applicable.length,
    anchoredDecisionCount,
    unmatchedDecisionCount: applicable.length - anchoredDecisionCount,
  };
}

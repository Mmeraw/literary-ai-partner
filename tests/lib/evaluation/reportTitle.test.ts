import { resolveReportTitle } from "@/lib/evaluation/reportTitle";

describe("resolveReportTitle", () => {
  it("prefers chapter title over manuscript title and source title", () => {
    const result = resolveReportTitle({
      chapterTitle: "  Chapter 7: Quiet Breakage  ",
      manuscriptTitle: "The Long Manuscript",
      sourceTitle: "source.md",
    });

    expect(result).toEqual({
      displayTitle: "Chapter 7: Quiet Breakage",
      pageTitle: "Chapter 7: Quiet Breakage — Evaluation Report",
      chapterTitle: "Chapter 7: Quiet Breakage",
      manuscriptTitle: "The Long Manuscript",
    });
  });

  it("falls back to manuscript title when chapter title is missing", () => {
    const result = resolveReportTitle({
      chapterTitle: "   ",
      manuscriptTitle: "Manuscript Title",
      sourceTitle: "source.md",
    });

    expect(result.displayTitle).toBe("Manuscript Title");
    expect(result.pageTitle).toBe("Manuscript Title — Evaluation Report");
  });

  it("falls back to source title and then Untitled", () => {
    expect(
      resolveReportTitle({
        sourceTitle: "chapter-draft.md",
      }).displayTitle,
    ).toBe("chapter-draft.md");

    expect(
      resolveReportTitle({
        chapterTitle: null,
        manuscriptTitle: null,
        sourceTitle: "   ",
      }).displayTitle,
    ).toBe("Untitled");
  });
});

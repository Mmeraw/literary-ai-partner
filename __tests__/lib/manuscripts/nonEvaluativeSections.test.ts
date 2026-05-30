import {
  buildNonEvaluativeWarning,
  stripNonEvaluativeSections,
} from "@/lib/manuscripts/nonEvaluativeSections";

describe("stripNonEvaluativeSections", () => {
  it("removes title/disclaimer/dedication/toc and preserves chapter prose", () => {
    const input = [
      "CARTEL BABIES",
      "A Novel",
      "By Michael J. Meraw",
      "© 2025 Michael J. Meraw / All rights reserved",
      "",
      "Disclaimer",
      "This is a work of fiction.",
      "",
      "Dedication",
      "To the people of México.",
      "",
      "Contents",
      "Chapter 1 – The Stop\t1",
      "Chapter 2 – The Basin\t8",
      "",
      "Chapter 1 – The Stop",
      "I drove the highway scores of times.",
      "",
      "Chapter 2 – The Basin",
      "The truck clawed upward.",
    ].join("\n");

    const result = stripNonEvaluativeSections(input);

    expect(result.sanitizedText).toContain("Chapter 1 – The Stop");
    expect(result.sanitizedText).toContain("I drove the highway scores of times.");
    expect(result.sanitizedText).toContain("Chapter 2 – The Basin");

    expect(result.sanitizedText).not.toContain("Disclaimer");
    expect(result.sanitizedText).not.toContain("Dedication");
    expect(result.sanitizedText).not.toContain("Contents");
    expect(result.sanitizedText).not.toContain("A Novel");

    const labels = result.excludedSections.map((s) => s.label);
    expect(labels).toContain("Title page / copyright front matter");
    expect(labels).toContain("Disclaimer");
    expect(labels).toContain("Dedication");
    expect(labels).toContain("Table of contents");
  });

  it("removes 'Before Cartels, There’s Us' and trailing Research Note from evaluation text", () => {
    const input = [
      "Chapter 85 – Landing in Vancouver",
      "Final chapter text.",
      "",
      "Before Cartels, There’s Us",
      "Companion non-narrative context.",
      "",
      "Research Note",
      "Open-source materials used.",
      "More references.",
    ].join("\n");

    const result = stripNonEvaluativeSections(input);

    expect(result.sanitizedText).toContain("Chapter 85 – Landing in Vancouver");
    expect(result.sanitizedText).toContain("Final chapter text.");
    expect(result.sanitizedText).not.toContain("Before Cartels, There’s Us");
    expect(result.sanitizedText).not.toContain("Research Note");
    expect(result.sanitizedText).not.toContain("Open-source materials used.");

    const labels = result.excludedSections.map((s) => s.label);
    expect(labels).toContain("Before Cartels, There’s Us");
    expect(labels).toContain("Research note");
  });

  it("builds a user-facing warning when exclusions exist", () => {
    const result = stripNonEvaluativeSections(
      [
        "Disclaimer",
        "Some text",
        "",
        "Chapter 1",
        "Body text",
      ].join("\n"),
    );

    const warning = buildNonEvaluativeWarning(result.excludedSections);
    expect(warning).toBeTruthy();
    expect(warning).toContain("Non-evaluative sections were excluded");
    expect(warning).toContain("Disclaimer");
  });

  it("does not over-strip full manuscripts when TOC is followed by non-chapter headings", () => {
    const input = [
      "Contents",
      "STORY OF THE DOOR.............1",
      "SEARCH OF MY PEOPLE...........8",
      "THE CAREW MURDER CASE.........15",
      "INCIDENT OF THE LETTER........24",
      "REMARKABLE INCIDENT............31",
      "LAST NIGHT.....................38",
      "LANYON'S NARRATIVE.............46",
      "HENRY JEKYLL'S FULL STATEMENT..59",
      "",
      "STORY OF THE DOOR",
      "Mr. Utterson the lawyer was a man of a rugged countenance.",
      "He was austere with himself and tasted gin when he was alone.",
      "",
      "SEARCH OF MY PEOPLE",
      "That evening Mr. Utterson came home to his bachelor house in sombre spirits.",
      "He sat down to dinner without relish and read a volume of dry divinity.",
    ].join("\n");

    const result = stripNonEvaluativeSections(input);

    expect(result.sanitizedText).toContain("STORY OF THE DOOR");
    expect(result.sanitizedText).toContain("Mr. Utterson the lawyer was a man of a rugged countenance.");
    expect(result.sanitizedText).toContain("SEARCH OF MY PEOPLE");
    expect(result.sanitizedText).not.toContain("Contents");
    expect(result.sanitizedText.split(/\s+/).filter(Boolean).length).toBeGreaterThan(40);

    const labels = result.excludedSections.map((s) => s.label);
    expect(labels).toContain("Table of contents");
  });
});

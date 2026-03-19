import { describe, expect, test } from "@jest/globals";

import {
  normalizeForStrictMatch,
  validateExtractionContract,
} from "@/lib/revision/anchorContract";

type GoldenCase = {
  id: string;
  sourceText: string;
  snippet: string;
};

function buildProposalFromSnippet(sourceText: string, snippet: string) {
  const start = sourceText.indexOf(snippet);
  if (start < 0) {
    throw new Error(`Golden corpus setup error: snippet not found for case: ${snippet}`);
  }

  return {
    start_offset: start,
    end_offset: start + snippet.length,
    original_text: snippet,
  };
}

describe("Phase 2.2 extraction golden corpus", () => {
  const corpus: GoldenCase[] = [
    {
      id: "crlf-lf-boundary",
      sourceText: "Line one.\r\nLine two target phrase.\nLine three.",
      snippet: "Line two target phrase.",
    },
    {
      id: "unicode-accents",
      sourceText: "The café served crème brûlée beside the façade.",
      snippet: "café served crème brûlée",
    },
    {
      id: "em-dash",
      sourceText: "She paused—then answered without hesitation.",
      snippet: "paused—then answered",
    },
    {
      id: "smart-curly-quotes",
      sourceText: "He whispered, “Stay here,” and closed the door.",
      snippet: "“Stay here,”",
    },
    {
      id: "multiline-dialogue",
      sourceText:
        "She said, \"I know.\"\n\"Then we go now,\" he replied.\nSilence followed.",
      snippet: "\"Then we go now,\" he replied.",
    },
    {
      id: "punctuation-boundary",
      sourceText: "Wait... what?! Yes; exactly: this part.",
      snippet: "what?! Yes; exactly:",
    },
    {
      id: "whitespace-sensitive-span",
      sourceText: "Prefix\twith  exact   spacing\nSuffix",
      snippet: "with  exact   spacing",
    },
  ];

  test.each(corpus)("$id: validates exact extraction contract", ({ sourceText, snippet }) => {
    const proposal = buildProposalFromSnippet(sourceText, snippet);

    const result = validateExtractionContract(proposal, sourceText);

    expect(result.extractedText).toBe(snippet);
    expect(normalizeForStrictMatch(result.extractedText)).toBe(
      normalizeForStrictMatch(proposal.original_text),
    );
  });

  test("fails closed on whitespace-sensitive off-by-one in golden corpus text", () => {
    const sourceText = "Prefix\twith  exact   spacing\nSuffix";
    const snippet = "with  exact   spacing";
    const start = sourceText.indexOf(snippet);

    expect(start).toBeGreaterThanOrEqual(0);

    expect(() =>
      validateExtractionContract(
        {
          start_offset: start + 1,
          end_offset: start + snippet.length,
          original_text: snippet,
        },
        sourceText,
      ),
    ).toThrow(/does not match original_text/);
  });
});

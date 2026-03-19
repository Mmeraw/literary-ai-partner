// Phase 2.2 — Extraction Contract Tests
// Contract: source_text.slice(start_offset, end_offset) must exactly reproduce
// original_text after CRLF-only normalization. Fail-closed. No fallback. No re-search.

import { describe, expect, test } from "@jest/globals";
import {
  normalizeForStrictMatch,
  validateExtractionContract,
} from "@/lib/revision/anchorContract";

describe("Phase 2.2 extraction contract", () => {
  // A. Exact raw slice match
  test("passes when raw slice exactly equals original_text", () => {
    const sourceText = "Alpha line.\nTarget sentence here.\nOmega line.";
    // "Alpha line.\n" = 12 chars; "Target sentence here." = 21 chars → end = 33
    const proposal = {
      start_offset: 12,
      end_offset: 33,
      original_text: "Target sentence here.",
    };

    const result = validateExtractionContract(proposal, sourceText);
    expect(result.extractedText).toBe("Target sentence here.");
  });

  // B. CRLF normalization — slice is CRLF, original is LF-only; must pass after normalization
  test("passes when CRLF-normalized slice matches original_text", () => {
    const sourceText = "Alpha line.\r\nTarget sentence here.\r\nOmega line.";
    // "Alpha line.\r\n" = 13 chars; "Target sentence here." = 21 chars → end = 34
    const proposal = {
      start_offset: 13,
      end_offset: 34,
      original_text: "Target sentence here.",
    };

    const result = validateExtractionContract(proposal, sourceText);
    expect(normalizeForStrictMatch(result.extractedText)).toBe(
      normalizeForStrictMatch(proposal.original_text),
    );
  });

  // C. Off-by-one start — slice includes a preceding newline, mismatch must throw
  test("fails when start_offset is off by one (includes preceding newline)", () => {
    const sourceText = "Alpha line.\nTarget sentence here.\nOmega line.";
    const proposal = {
      start_offset: 11, // '\n' before "Target"
      end_offset: 33,
      original_text: "Target sentence here.",
    };

    expect(() => validateExtractionContract(proposal, sourceText)).toThrow(
      /does not match original_text/,
    );
  });

  // D. Off-by-one end — slice is missing the final period, mismatch must throw
  test("fails when end_offset is off by one (trailing character cut off)", () => {
    const sourceText = "Alpha line.\nTarget sentence here.\nOmega line.";
    const proposal = {
      start_offset: 12,
      end_offset: 32, // "Target sentence here" — missing the period
      original_text: "Target sentence here.",
    };

    expect(() => validateExtractionContract(proposal, sourceText)).toThrow(
      /does not match original_text/,
    );
  });

  // E. Empty slice — slice beyond source length produces empty string
  test("fails when extracted slice is empty", () => {
    const sourceText = "Hello";
    const proposal = {
      start_offset: 5, // at length boundary
      end_offset: 6, // beyond end → slice returns ""
      original_text: "!",
    };

    expect(() => validateExtractionContract(proposal, sourceText)).toThrow(
      /empty/,
    );
  });

  // F. No fallback — mismatch throws even when original_text exists elsewhere in source
  test("throws on mismatch even when original_text appears elsewhere in the document", () => {
    // "Target sentence here." appears later in the source, but offsets point elsewhere
    const sourceText =
      "Alpha line.\nWrong text here.\nTarget sentence here.\nOmega line.";
    // "Alpha line.\n" = 12 chars; "Wrong text here." = 16 chars → slice 12:28
    const proposal = {
      start_offset: 12,
      end_offset: 28,
      original_text: "Target sentence here.",
    };

    // Must throw — no re-search, no fallback to the correct position at index 29
    expect(() => validateExtractionContract(proposal, sourceText)).toThrow(
      /does not match original_text/,
    );
  });

  // G. Punctuation boundary — handles em-dashes, quotes, and punctuation correctly
  test("handles punctuation boundaries correctly", () => {
    const sourceText = 'She said, "Hello, world!" And smiled.';
    // "She said, " = 10 chars; '"Hello, world!"' = 15 chars → end = 25
    const proposal = {
      start_offset: 10,
      end_offset: 25,
      original_text: '"Hello, world!"',
    };

    const result = validateExtractionContract(proposal, sourceText);
    expect(result.extractedText).toBe('"Hello, world!"');
  });

  // H. Document boundary — anchors at start and end of document are valid
  test("allows anchors at the very start of the document", () => {
    const sourceText = "Start of document content.";
    const proposal = {
      start_offset: 0,
      end_offset: 5,
      original_text: "Start",
    };

    const result = validateExtractionContract(proposal, sourceText);
    expect(result.extractedText).toBe("Start");
  });

  test("allows anchors at the very end of the document", () => {
    const sourceText = "Document ends here.";
    // "Document ends " = 14 chars; "here." = 5 chars → end = 19 (== sourceText.length)
    const proposal = {
      start_offset: 14,
      end_offset: 19,
      original_text: "here.",
    };

    const result = validateExtractionContract(proposal, sourceText);
    expect(result.extractedText).toBe("here.");
    expect(proposal.end_offset).toBe(sourceText.length);
  });

  // Guard: invalid start_offset must throw before slice
  test("throws for negative start_offset", () => {
    const proposal = { start_offset: -1, end_offset: 5, original_text: "Hello" };
    expect(() => validateExtractionContract(proposal, "Hello world")).toThrow(
      /start_offset must be a non-negative integer/,
    );
  });

  // Guard: end_offset not greater than start_offset must throw
  test("throws when end_offset equals start_offset", () => {
    const proposal = { start_offset: 3, end_offset: 3, original_text: "" };
    expect(() => validateExtractionContract(proposal, "Hello world")).toThrow(
      /end_offset must be greater than start_offset/,
    );
  });
});

describe("normalizeForStrictMatch", () => {
  test("converts CRLF to LF", () => {
    expect(normalizeForStrictMatch("foo\r\nbar")).toBe("foo\nbar");
  });

  test("converts bare CR to LF", () => {
    expect(normalizeForStrictMatch("foo\rbar")).toBe("foo\nbar");
  });

  test("does not collapse internal whitespace", () => {
    expect(normalizeForStrictMatch("foo  bar\tbaz")).toBe("foo  bar\tbaz");
  });

  test("does not trim leading or trailing whitespace", () => {
    expect(normalizeForStrictMatch("  hello  ")).toBe("  hello  ");
  });

  test("leaves prose punctuation and case unchanged", () => {
    expect(normalizeForStrictMatch('He said, "Wait!"')).toBe('He said, "Wait!"');
  });
});

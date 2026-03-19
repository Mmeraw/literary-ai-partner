import { describe, expect, test } from "@jest/globals";
import { applyProposalsBatchStrict } from "@/lib/revision/applyBatch";
import type { ChangeProposal } from "@/lib/revision/types";

function buildProposal(
  source: string,
  original: string,
  replacement: string,
  overrides: Partial<ChangeProposal> = {},
): ChangeProposal {
  const start = source.indexOf(original);

  if (start === -1) {
    throw new Error(`Original text not found in source: ${original}`);
  }

  const end = start + original.length;

  return {
    id: overrides.id ?? `${start}-${end}-${original}`,
    revision_session_id: overrides.revision_session_id ?? "session-apply-integrity",
    location_ref: overrides.location_ref ?? "loc:1",
    rule: overrides.rule ?? "clarity",
    action: overrides.action ?? "refine",
    original_text: overrides.original_text ?? original,
    proposed_text: overrides.proposed_text ?? replacement,
    justification: overrides.justification ?? "test",
    severity: overrides.severity ?? "medium",
    decision: overrides.decision ?? "accepted",
    modified_text: overrides.modified_text ?? null,
    start_offset: overrides.start_offset ?? start,
    end_offset: overrides.end_offset ?? end,
    before_context:
      overrides.before_context ??
      source.slice(Math.max(0, start - 40), start),
    after_context:
      overrides.after_context ??
      source.slice(end, Math.min(source.length, end + 40)),
    anchor_text_normalized:
      overrides.anchor_text_normalized ?? original.replace(/\r\n/g, "\n"),
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
}

describe("Phase 2.3 apply integrity", () => {
  test("returns source unchanged when no actionable proposals are present", () => {
    const source = "Alpha beta gamma.";
    const rejected = buildProposal(source, "beta", "BETA", {
      decision: "rejected",
    });

    const result = applyProposalsBatchStrict(source, [rejected]);

    expect(result.output_text).toBe(source);
    expect(result.applied_count).toBe(0);
  });

  test("applies multiple disjoint proposals deterministically regardless of input order", () => {
    const source = "Alpha beta gamma delta.";
    const p1 = buildProposal(source, "beta", "BETA", { id: "p1" });
    const p2 = buildProposal(source, "delta", "DELTA", { id: "p2" });

    const a = applyProposalsBatchStrict(source, [p1, p2]);
    const b = applyProposalsBatchStrict(source, [p2, p1]);

    expect(a.output_text).toBe("Alpha BETA gamma DELTA.");
    expect(b.output_text).toBe("Alpha BETA gamma DELTA.");
    expect(a.output_text).toBe(b.output_text);
  });

  test("uses modified_text for modified decisions", () => {
    const source = "Alpha beta gamma.";
    const proposal = buildProposal(source, "beta", "BETA", {
      decision: "modified",
      proposed_text: "WRONG",
      modified_text: "BETTER",
    });

    const result = applyProposalsBatchStrict(source, [proposal]);
    expect(result.output_text).toBe("Alpha BETTER gamma.");
  });

  test("rejects overlapping proposals", () => {
    const source = "abcdefg";

    const p1 = buildProposal(source, "bcd", "BCD", {
      id: "p1",
      start_offset: 1,
      end_offset: 4,
      original_text: "bcd",
      before_context: "a",
      after_context: "efg",
    });

    const p2 = buildProposal(source, "cde", "CDE", {
      id: "p2",
      start_offset: 2,
      end_offset: 5,
      original_text: "cde",
      before_context: "ab",
      after_context: "fg",
    });

    expect(() => applyProposalsBatchStrict(source, [p1, p2])).toThrow(
      /Overlapping proposals detected/,
    );
  });

  test("rejects duplicate ranges", () => {
    const source = "abcdef";
    const p1 = buildProposal(source, "cd", "CD", { id: "p1" });
    const p2 = buildProposal(source, "cd", "XX", { id: "p2" });

    expect(() => applyProposalsBatchStrict(source, [p1, p2])).toThrow(
      /Duplicate proposal range detected/,
    );
  });

  test("allows adjacent proposals", () => {
    const source = "abcdef";
    const p1 = buildProposal(source, "ab", "AB", {
      id: "p1",
      start_offset: 0,
      end_offset: 2,
      original_text: "ab",
      before_context: "",
      after_context: "cdef",
    });
    const p2 = buildProposal(source, "cd", "CD", {
      id: "p2",
      start_offset: 2,
      end_offset: 4,
      original_text: "cd",
      before_context: "ab",
      after_context: "ef",
    });

    const result = applyProposalsBatchStrict(source, [p1, p2]);
    expect(result.output_text).toBe("ABCDef");
    expect(result.applied_count).toBe(2);
  });

  test("fails closed when anchor slice does not match original_text", () => {
    const source = "Alpha beta gamma.";
    const bad = buildProposal(source, "beta", "BETA", {
      original_text: "theta",
      before_context: "Alpha ",
      after_context: " gamma.",
    });

    expect(() => applyProposalsBatchStrict(source, [bad])).toThrow(
      /source slice does not match original_text/,
    );
  });

  test("fails closed when context mismatches", () => {
    const source = "Alpha beta gamma.";
    const bad = buildProposal(source, "beta", "BETA", {
      after_context: "WRONG",
    });

    expect(() => applyProposalsBatchStrict(source, [bad])).toThrow(
      /before\/after context verification failed/,
    );
  });

  test("fails closed when re-applying same anchored batch to mutated output", () => {
    const source = "Alpha beta gamma.";
    const p1 = buildProposal(source, "beta", "BETA");

    const once = applyProposalsBatchStrict(source, [p1]);

    expect(() => applyProposalsBatchStrict(once.output_text, [p1])).toThrow(
      /source slice does not match original_text|before\/after context verification failed/,
    );
  });

  test("fails atomically when one proposal in a batch is invalid", () => {
    const source = "Alpha beta gamma delta.";
    const good = buildProposal(source, "delta", "DELTA");
    const bad = buildProposal(source, "beta", "BETA", {
      after_context: "WRONG",
    });

    expect(() => applyProposalsBatchStrict(source, [good, bad])).toThrow();

    const control = applyProposalsBatchStrict(source, [good]);
    expect(control.output_text).toBe("Alpha beta gamma DELTA.");
  });

  test("handles CRLF source normalization for comparison while preserving output newlines", () => {
    const source = "Line one\r\nLine two\r\nLine three";
    const p1 = buildProposal(source, "Line two", "Middle line");

    const result = applyProposalsBatchStrict(source, [p1]);
    expect(result.output_text).toBe("Line one\r\nMiddle line\r\nLine three");
  });
});
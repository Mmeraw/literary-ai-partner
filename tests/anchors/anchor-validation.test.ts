import { describe, expect, test } from "@jest/globals";
import {
  ANCHOR_CONTEXT_TARGET_CHARS,
  buildAnchorForSnippet,
  normalizeAnchorText,
  normalizeForAnchorSearch,
  validateAnchorAgainstSource,
} from "@/lib/revision/anchorContract";
import { normalizeProposalCandidates } from "@/lib/revision/proposals";

describe("Phase 2.1 anchor contract", () => {
  test("buildAnchorForSnippet returns deterministic offsets and contexts", () => {
    const sourceText =
      "Alpha line.\nThis is a middle sentence with useful context.\nOmega line.";
    const snippet = "middle sentence with useful context";

    const anchor = buildAnchorForSnippet(sourceText, snippet);
    expect(anchor.anchor_status).toBe("created");

    if (anchor.anchor_status !== "created") {
      throw new Error(`Expected created anchor, got: ${anchor.anchor_status}`);
    }

    expect(anchor.start_offset).toBeGreaterThanOrEqual(0);
    expect(anchor.end_offset).toBeGreaterThan(anchor.start_offset);

    const extracted = sourceText.slice(anchor.start_offset, anchor.end_offset);
    expect(extracted.length).toBeGreaterThan(0);
    expect(normalizeForAnchorSearch(extracted)).toBe(normalizeForAnchorSearch(snippet));

    expect(anchor.before_context).toBe(
      sourceText.slice(
        Math.max(0, anchor.start_offset - ANCHOR_CONTEXT_TARGET_CHARS),
        anchor.start_offset,
      ),
    );
    expect(anchor.after_context).toBe(
      sourceText.slice(
        anchor.end_offset,
        Math.min(sourceText.length, anchor.end_offset + ANCHOR_CONTEXT_TARGET_CHARS),
      ),
    );

    expect(anchor.anchor_text_normalized).toBe(normalizeAnchorText(extracted));

    expect(() => validateAnchorAgainstSource(anchor, sourceText, snippet)).not.toThrow();
  });

  test("buildAnchorForSnippet indexes offsets against raw source with CRLF", () => {
    const sourceText =
      "Alpha line.\r\nThis is a middle sentence with useful context.\r\nOmega line.";
    const snippet = "middle sentence with useful context";

    const anchor = buildAnchorForSnippet(sourceText, snippet);
    expect(anchor.anchor_status).toBe("created");

    if (anchor.anchor_status !== "created") {
      throw new Error(`Expected created anchor, got: ${anchor.anchor_status}`);
    }

    const extractedRaw = sourceText.slice(anchor.start_offset, anchor.end_offset);
    expect(normalizeForAnchorSearch(extractedRaw)).toBe(normalizeForAnchorSearch(snippet));

    expect(anchor.before_context).toBe(
      sourceText.slice(
        Math.max(0, anchor.start_offset - ANCHOR_CONTEXT_TARGET_CHARS),
        anchor.start_offset,
      ),
    );
    expect(anchor.after_context).toBe(
      sourceText.slice(
        anchor.end_offset,
        Math.min(sourceText.length, anchor.end_offset + ANCHOR_CONTEXT_TARGET_CHARS),
      ),
    );
  });

  test("buildAnchorForSnippet fails closed when anchor is ambiguous", () => {
    const sourceText = "repeat me\nrepeat me\n";
    const snippet = "repeat me";

    const anchor = buildAnchorForSnippet(sourceText, snippet);
    expect(anchor.anchor_status).toBe("ambiguous");
  });

  test("normalizeProposalCandidates returns only valid anchored proposals", () => {
    const sourceText =
      "Opening paragraph.\nHero enters the room and looks around carefully.\nClosing paragraph.";

    const proposals = normalizeProposalCandidates(
      "session-1",
      [
        {
          location_ref: "scene:1",
          rule: "clarity",
          action: "refine",
          original_text: "Hero enters the room and looks around carefully.",
          proposed_text: "Hero steps into the room, scanning every corner.",
          justification: "Tighten pacing.",
          severity: "medium",
        },
      ],
      sourceText,
    );

    expect(proposals).toHaveLength(1);
    const proposal = proposals[0];

    expect(proposal.start_offset).toBeGreaterThanOrEqual(0);
    expect(proposal.end_offset).toBeGreaterThan(proposal.start_offset);

    const extracted = sourceText.slice(
      proposal.start_offset,
      proposal.end_offset,
    );

    expect(extracted.length).toBeGreaterThan(0);
    expect(proposal.anchor_text_normalized).toBe(normalizeAnchorText(extracted));

    if (proposal.start_offset > 0) {
      expect(proposal.before_context.length).toBeGreaterThan(0);
    }

    if (proposal.end_offset < sourceText.length) {
      expect(proposal.after_context.length).toBeGreaterThan(0);
    }
  });

  test("normalizeProposalCandidates rejects unanchorable candidates (no anchor, no row)", () => {
    const sourceText = "Only one sentence exists here.";

    expect(() =>
      normalizeProposalCandidates(
        "session-2",
        [
          {
            location_ref: "missing:1",
            rule: "precision",
            action: "refine",
            original_text: "This text does not exist in source.",
            proposed_text: "Replacement",
            justification: "Should fail",
            severity: "high",
          },
        ],
        sourceText,
      ),
    ).toThrow(/Anchor generation failed/);
  });

  test("normalizeProposalCandidates fails closed on malformed candidates", () => {
    const sourceText = "One valid source sentence.";

    expect(() =>
      normalizeProposalCandidates(
        "session-3",
        [
          {
            location_ref: "malformed:1",
            rule: "clarity",
            action: "refine",
            original_text: "",
            proposed_text: "Replacement text.",
            justification: "",
            severity: "medium",
          },
        ],
        sourceText,
      ),
    ).toThrow(/Malformed proposal candidate/);

    expect(() =>
      normalizeProposalCandidates(
        "session-3",
        [
          {
            location_ref: "malformed:2",
            rule: "clarity",
            action: "refine",
            original_text: "One valid source sentence.",
            proposed_text: "",
            justification: "Needed revision",
            severity: "medium",
          },
        ],
        sourceText,
      ),
    ).toThrow(/missing required field\(s\): proposed_text/);
  });
});

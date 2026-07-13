/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import FinalReviewClient from "@/components/revision/FinalReviewClient";
import type { FinalReviewPayload } from "@/lib/revision/finalReview";

jest.mock("@/components/revision/DownloadFinalReviewButton", () => ({
  __esModule: true,
  default: () => <button type="button">Download review</button>,
}));

jest.mock("@/components/revision/PrintSavePdfButton", () => ({
  __esModule: true,
  default: () => <button type="button">Print</button>,
}));

function payload(overrides: Partial<FinalReviewPayload> = {}): FinalReviewPayload {
  return {
    ok: true,
    error: null,
    manuscriptId: "7519",
    evaluationJobId: "b099a623",
    manuscriptTitle: "Let the River Decide",
    sourceVersionId: "version-1",
    sourceText: "The river moved below them.\n\nCliff tightened both hands on the wheel.",
    sourceAvailable: true,
    sourceUnavailableReason: null,
    previewParagraphs: ["The river moved below them.", "Cliff locked both hands around the wheel."],
    decisions: [{
      id: "decision-1",
      opportunityId: "OPP-001",
      title: "Tighten the physical beat",
      decision: "accepted_a",
      selectedOption: "A",
      customText: null,
      selectedText: "Cliff locked both hands around the wheel.",
      sourceExcerpt: "Cliff tightened both hands on the wheel.",
      sourceLocation: "Chapter 5, paragraph 2",
      criterion: "Narrative Drive",
      severity: "must",
      createdAt: "2026-07-13T10:00:00.000Z",
      highlightTone: "system",
    }],
    acceptedCount: 1,
    customCount: 0,
    keptCount: 0,
    rejectedCount: 0,
    deferredCount: 0,
    unresolvedMustCount: 0,
    ...overrides,
  };
}

describe("FinalReviewClient anchor integrity", () => {
  it("highlights only the exact paragraph and preserves the canonical workbench query", () => {
    render(<FinalReviewClient payload={payload()} />);

    expect(screen.getByText("Ready to apply")).toBeTruthy();
    // The staged replacement is shown in both the anchor-verified preview and
    // the authoritative changelog. Requiring exactly one match would make the
    // test contradict the intended two-surface Final Review contract.
    expect(screen.getAllByText("Cliff locked both hands around the wheel.")).toHaveLength(2);
    expect(screen.getByText("The river moved below them.")).toBeTruthy();
    expect(screen.queryByText(/could not be positioned safely/i)).toBeNull();

    const link = screen.getByRole("link", { name: /Back to Revise Queue/i });
    expect(link.getAttribute("href")).toContain("manuscriptId=7519");
    expect(link.getAttribute("href")).toContain("evaluationJobId=b099a623");
  });

  it("blocks apply and reports an unmatched accepted decision honestly", () => {
    const ambiguousSource = "The river moved below them.\n\nThe river moved below them.";
    const ambiguous = payload({
      sourceText: ambiguousSource,
      previewParagraphs: ["The river moved below them.", "The river moved below them."],
      decisions: [{
        ...payload().decisions[0],
        sourceExcerpt: "The river moved below them.",
        selectedText: "The river narrowed below them.",
      }],
    });

    render(<FinalReviewClient payload={ambiguous} />);

    expect(screen.getByText("Source matching required")).toBeTruthy();
    expect(screen.getByText(/lacks a unique exact source match/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Apply to new version/i })).toBeDisabled();
  });

  it("distinguishes deferred Must items from lower-priority deferrals", () => {
    const deferredMust = {
      ...payload().decisions[0],
      id: "decision-deferred",
      decision: "deferred" as const,
      selectedOption: null,
      selectedText: null,
      sourceExcerpt: null,
      severity: "must" as const,
      highlightTone: "deferred" as const,
    };

    render(<FinalReviewClient payload={payload({
      decisions: [deferredMust],
      acceptedCount: 0,
      deferredCount: 1,
      unresolvedMustCount: 1,
    })} />);

    expect(screen.getByText("No changes staged")).toBeTruthy();
    expect(screen.getByText(/1 Must item is deferred/i)).toBeTruthy();
  });

  it("keeps changelog available while source-dependent actions are blocked", () => {
    render(<FinalReviewClient payload={payload({
      sourceAvailable: false,
      sourceText: "",
      previewParagraphs: ["Accepted A: Tighten the physical beat"],
    })} />);

    expect(screen.getByText("Changelog only")).toBeTruthy();
    expect(screen.getByText(/Revision Changelog remains available/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Apply to new version/i })).toBeDisabled();
    expect(screen.getByText(/Tighten the physical beat/i)).toBeTruthy();
  });
});

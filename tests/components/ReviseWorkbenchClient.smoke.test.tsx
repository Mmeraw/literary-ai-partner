/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";

import ReviseWorkbenchClient from "@/components/revision/ReviseWorkbenchClient";
import type { WorkbenchOpportunity, WorkbenchQueuePayload } from "@/lib/revision/workbenchQueue";

jest.mock("next/link", () => {
  return ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>;
});

describe("ReviseWorkbenchClient smoke", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, entries: [] }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("does not render diagnostic/recommendation text as candidate prose on non-V2 surface", async () => {
    const invalidInstruction = "Apply the same repair goal across this section without rewriting manuscript prose.";

    const opportunities: WorkbenchOpportunity[] = [
      {
        id: "wb-1",
        severity: "should",
        scope: "Passage",
        mode: "direct-rewrite",
        source: "evaluation",
        criterion: "Pacing",
        leverage: "Pacing",
        crumb: "Pacing · passage:1",
        title: "Instructional fallback should be blocked",
        issueStatement: "Instructional fallback should be blocked",
        meta: "Pacing · passage:1",
        confidence: "70% confidence",
        anchor: "passage:1",
        quoteHighlight: "A dense passage appears here",
        quoteRest: " and needs targeted prose revision.",
        symptom: "The recommendation is instruction-like rather than manuscript-ready prose.",
        cause: "Fallback recommendation text leaked into candidate content.",
        fixDirection: "Replace with copy-paste-ready manuscript prose candidates.",
        readerEffect: "Prevents non-prose guidance from shipping as revision content.",
        mistakeProofing: "Block diagnostic/recommendation phrasing from A/B/C display.",
        diagnostic: {
          symptom: "The recommendation is instruction-like rather than manuscript-ready prose.",
          cause: "Fallback recommendation text leaked into candidate content.",
          fixStrategy: "Replace with copy-paste-ready manuscript prose candidates.",
          readerImpact: "Prevents non-prose guidance from shipping as revision content.",
          evidence: {
            quotedExcerpt: "A dense passage appears here and needs targeted prose revision.",
            locationLabel: "passage:1",
          },
          operationTargeting: "replace_selected_passage · passage:1",
          mistakeProofing: "Block diagnostic/recommendation phrasing from A/B/C display.",
        },
        revisionOperation: "replace_selected_passage",
        readiness: "ready_for_revise",
        readinessReason: null,
        options: [
          {
            key: "A",
            mechanism: "Recommended repair",
            candidateText: invalidInstruction,
            text: invalidInstruction,
            rationale: "This should never render as manuscript prose.",
          },
          {
            key: "B",
            mechanism: "Rhythm variant",
            candidateText: "",
            text: "",
            rationale: "Needs targeting.",
          },
          {
            key: "C",
            mechanism: "Bolder rendering shift",
            candidateText: "",
            text: "",
            rationale: "Needs targeting.",
          },
        ],
      },
    ];

    const payload: WorkbenchQueuePayload = {
      ok: true,
      error: null,
      manuscriptId: "6074",
      evaluationJobId: "e5ced7ac-117f-4d13-8cd0-3957c15dc189",
      manuscriptTitle: "Test Manuscript",
      opportunities,
      needsTargeting: [],
      readinessTotals: {
        ready_for_revise: 1,
        needs_targeting: 0,
      },
      totals: { must: 0, should: 1, could: 0 },
      scopes: { Line: 0, Passage: 1, Scene: 0, Chapter: 0, Structural: 0, Manuscript: 0 },
      criteria: { Pacing: 1 },
      synthesis: { admitted: 1, clustered: 0, held: 0, suppressed: 0 },
    };

    render(<ReviseWorkbenchClient payload={payload} />);

    expect(screen.getAllByText(/Candidate text failed the render-safe prose contract/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(invalidInstruction)).toBeNull();

    const acceptSelected = (await screen.findByRole("button", { name: "Accept selected (A)" })) as HTMLButtonElement;
    expect(acceptSelected.disabled).toBe(true);
  });
});

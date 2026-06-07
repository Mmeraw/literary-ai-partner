/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";

import ReviseCockpitClient from "@/components/revision/ReviseCockpitClient";
import type { WorkbenchOpportunity, WorkbenchQueuePayload } from "@/lib/revision/workbenchQueue";

function makeNeedsTargetingOpportunity(id: string): WorkbenchOpportunity {
  return {
    id,
    severity: "should",
    scope: "Passage",
    mode: "direct-rewrite",
    source: "evaluation",
    criterion: "Pacing",
    leverage: "Pacing",
    crumb: "Pacing · passage:1",
    title: "Instruction-style candidate blocked",
    issueStatement: "Instruction-style candidate blocked",
    meta: "Pacing · passage:1",
    confidence: "medium confidence",
    anchor: "passage:1",
    quoteHighlight: "No excerpt available",
    quoteRest: "",
    symptom: "The recommendation is not grounded to usable source prose.",
    cause: "Missing exact source passage.",
    fixDirection: "Target an exact passage before proposing A/B/C.",
    readerEffect: "Prevents copy/accept of non-prose guidance.",
    mistakeProofing: "Require source-anchored prose candidates.",
    diagnostic: {
      symptom: "The recommendation is not grounded to usable source prose.",
      cause: "Missing exact source passage.",
      fixStrategy: "Target an exact passage before proposing A/B/C.",
      readerImpact: "Prevents copy/accept of non-prose guidance.",
      evidence: {
        quotedExcerpt: "No excerpt available",
        locationLabel: "passage:1",
      },
      operationTargeting: "replace_selected_passage · passage:1",
      mistakeProofing: "Require source-anchored prose candidates.",
    },
    revisionOperation: "replace_selected_passage",
    readiness: "needs_targeting",
    readinessReason: "Missing exact source passage.",
    options: [
      {
        key: "A",
        mechanism: "Recommended repair",
        candidateText: "In the paragraph containing the scene, replace one clause.",
        text: "In the paragraph containing the scene, replace one clause.",
        rationale: "Not copy-ready.",
      },
      {
        key: "B",
        mechanism: "Rhythm variant",
        candidateText: "In the paragraph containing the scene, replace one clause.",
        text: "In the paragraph containing the scene, replace one clause.",
        rationale: "Not copy-ready.",
      },
      {
        key: "C",
        mechanism: "Bolder rendering shift",
        candidateText: "In the paragraph containing the scene, replace one clause.",
        text: "In the paragraph containing the scene, replace one clause.",
        rationale: "Not copy-ready.",
      },
    ],
  };
}

describe("ReviseCockpitClient smoke", () => {
  it("renders cockpit shell when only needs-targeting cards exist", () => {
    const payload: WorkbenchQueuePayload = {
      ok: true,
      error: null,
      manuscriptId: "6074",
      evaluationJobId: "e5ced7ac-117f-4d13-8cd0-3957c15dc189",
      manuscriptTitle: "Ancient Bloodlines—Love Between Species",
      opportunities: [],
      needsTargeting: [makeNeedsTargetingOpportunity("nt-1")],
      readinessTotals: {
        ready_for_revise: 0,
        needs_targeting: 1,
      },
      totals: { must: 0, should: 0, could: 0 },
      scopes: { Line: 0, Passage: 0, Scene: 0, Chapter: 0, Structural: 0, Manuscript: 0 },
      criteria: {},
      synthesis: { admitted: 0, clustered: 0, held: 1, suppressed: 0 },      modeContract: null,    };

    render(<ReviseCockpitClient payload={payload} />);

    expect(screen.queryByText("No revision queue available.")).toBeNull();
    expect(screen.getAllByText(/Instruction-style candidate blocked/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Needs Targeting").length).toBeGreaterThan(0);
    expect(screen.getByText(/Queue\s*1\s*\/\s*1/i)).toBeTruthy();
    expect(screen.queryByText(/No Ready cards yet/i)).toBeNull();
  });

  it("disables accept actions for needs-targeting cards even when candidate text looks copy-ready", () => {
    const item = makeNeedsTargetingOpportunity("nt-copy-ready");
    item.options = [
      {
        key: "A",
        mechanism: "Recommended repair",
        candidateText: "She closed the door softly, the latch clicking once as rain traced silver lines down the glass.",
        text: "She closed the door softly, the latch clicking once as rain traced silver lines down the glass.",
        rationale: "Copy-ready prose variant.",
      },
      {
        key: "B",
        mechanism: "Rhythm variant",
        candidateText: "She closed the door softly, and the latch clicked once while rain drew silver lines on the glass.",
        text: "She closed the door softly, and the latch clicked once while rain drew silver lines on the glass.",
        rationale: "Copy-ready prose variant.",
      },
      {
        key: "C",
        mechanism: "Bolder rendering shift",
        candidateText: "She eased the door shut; one latch click, then rain threading silver across the pane.",
        text: "She eased the door shut; one latch click, then rain threading silver across the pane.",
        rationale: "Copy-ready prose variant.",
      },
    ];

    const payload: WorkbenchQueuePayload = {
      ok: true,
      error: null,
      manuscriptId: "6074",
      evaluationJobId: "e5ced7ac-117f-4d13-8cd0-3957c15dc189",
      manuscriptTitle: "Ancient Bloodlines—Love Between Species",
      opportunities: [],
      needsTargeting: [item],
      readinessTotals: {
        ready_for_revise: 0,
        needs_targeting: 1,
      },
      totals: { must: 0, should: 0, could: 0 },
      scopes: { Line: 0, Passage: 0, Scene: 0, Chapter: 0, Structural: 0, Manuscript: 0 },
      criteria: {},
      synthesis: { admitted: 0, clustered: 0, held: 1, suppressed: 0 },
      modeContract: null,
    };

    render(<ReviseCockpitClient payload={payload} />);

    expect(screen.getAllByRole("button", { name: "Accept A" }).every((button) => button.hasAttribute("disabled"))).toBe(true);
    expect(screen.getAllByRole("button", { name: "Accept B" }).every((button) => button.hasAttribute("disabled"))).toBe(true);
    expect(screen.getAllByRole("button", { name: "Accept C" }).every((button) => button.hasAttribute("disabled"))).toBe(true);
  });
});

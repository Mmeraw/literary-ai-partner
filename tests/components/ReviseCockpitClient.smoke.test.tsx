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
    revisionOperation: "replace_selected_passage",
    readiness: "needs_targeting",
    readinessReason: "Missing exact source passage.",
    options: [
      {
        key: "A",
        mechanism: "Recommended repair",
        text: "In the paragraph containing the scene, replace one clause.",
        rationale: "Not copy-ready.",
      },
      {
        key: "B",
        mechanism: "Rhythm variant",
        text: "In the paragraph containing the scene, replace one clause.",
        rationale: "Not copy-ready.",
      },
      {
        key: "C",
        mechanism: "Bolder rendering shift",
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
      synthesis: { admitted: 0, clustered: 0, held: 1, suppressed: 0 },
    };

    render(<ReviseCockpitClient payload={payload} />);

    expect(screen.queryByText("No revision queue available.")).toBeNull();
    expect(screen.getAllByText("Needs Targeting").length).toBeGreaterThan(0);
    expect(screen.getByText(/No Ready cards yet/i)).toBeTruthy();
  });
});

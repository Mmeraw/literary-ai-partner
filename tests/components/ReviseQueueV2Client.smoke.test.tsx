/**
 * @jest-environment jsdom
 */

import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";

import ReviseQueueV2Client from "@/components/revision/ReviseQueueV2Client";
import type { WorkbenchOpportunity, WorkbenchQueuePayload } from "@/lib/revision/workbenchQueue";

jest.mock("next/link", () => {
  return ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>;
});

describe("ReviseQueueV2Client smoke", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, entries: [] }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function makeOpportunity(id: string, title: string, overrides?: Partial<WorkbenchOpportunity>): WorkbenchOpportunity {
    return {
      id,
      severity: "should",
      scope: "Line",
      mode: "direct-rewrite",
      source: "evaluation",
      leverage: "Pacing",
      crumb: `Pacing · Item ${id}`,
      title,
      issueStatement: title,
      meta: `Pacing · Item ${id}`,
      confidence: "70% confidence",
      anchor: "Location pending",
      quoteHighlight: "No excerpt available",
      quoteRest: "",
      symptom: "Sentence density may be high in this area.",
      cause: "Too many beats in one line.",
      fixDirection: "Split into clearer units.",
      readerEffect: "Improves readability and pacing.",
      mistakeProofing: "Preserve author voice.",
      diagnostic: {
        symptom: "Sentence density may be high in this area.",
        cause: "Too many beats in one line.",
        fixStrategy: "Split into clearer units.",
        readerImpact: "Improves readability and pacing.",
        evidence: {
          quotedExcerpt: "No excerpt available",
          locationLabel: "Location pending",
        },
        operationTargeting: "replace_selected_passage · Location pending",
        mistakeProofing: "Preserve author voice.",
      },
      options: [
        { key: "A", mechanism: "Recommended repair", text: "Repair A", rationale: "Best default." },
        { key: "B", mechanism: "Rhythm variant", text: "Repair B", rationale: "Lighter touch." },
        { key: "C", mechanism: "Bolder rendering shift", text: "Repair C", rationale: "Bolder move." },
      ],
      ...overrides,
    } as WorkbenchOpportunity;
  }

  it("renders guided V2 shell, clusters repeated long-sentence findings, and enforces missing-evidence gate", async () => {
    const opportunities: WorkbenchOpportunity[] = [
      makeOpportunity("1", "Long sentence may be carrying too many beats at once"),
      makeOpportunity("2", "Long sentence may be carrying too many beats at once", { crumb: "Pacing · Item 2" }),
      makeOpportunity("3", "Long sentence may be carrying too many beats at once", { crumb: "Pacing · Item 3" }),
    ];

    const payload: WorkbenchQueuePayload = {
      ok: true,
      error: null,
      manuscriptId: null,
      evaluationJobId: null,
      manuscriptTitle: "Untitled Manuscript",
      opportunities,
      needsTargeting: [],
      readinessTotals: {
        ready_for_revise: 0,
        needs_targeting: 0,
      },
      totals: { must: 0, should: 3, could: 0 },
      scopes: { Line: 3, Passage: 0, Scene: 0, Chapter: 0, Structural: 0, Manuscript: 0 },
      criteria: {},
    };

    render(<ReviseQueueV2Client payload={payload} />);

    expect(screen.getByText("Untitled Manuscript")).toBeTruthy();
    expect(screen.getByText(/No MUST repairs found\./)).toBeTruthy();
    expect(screen.getByPlaceholderText("Search queue")).toBeTruthy();
    expect(screen.getByText("Revision Ledger")).toBeTruthy();

    expect(await screen.findByText("Long sentence density pattern")).toBeTruthy();

    expect(screen.getByText(/needs an excerpt or usable manuscript anchor/i)).toBeTruthy();

    const accept = screen.getAllByRole("button", { name: "Accept A" })[0] as HTMLButtonElement;
    const keep = screen.getAllByRole("button", { name: "Keep My Original" })[0] as HTMLButtonElement;
    const reject = screen.getAllByRole("button", { name: "Reject These Suggestions" })[0] as HTMLButtonElement;
    const decideLater = screen.getAllByRole("button", { name: "Decide Later" })[0] as HTMLButtonElement;

    expect(accept.disabled).toBe(true);
    expect(keep.disabled).toBe(true);
    expect(reject.disabled).toBe(true);
    expect(decideLater.disabled).toBe(false);
  });

  it("wires /workbench to redirect into /workbench-v2 route target resolution", () => {
    const repoRoot = process.cwd();
    const workbenchPage = fs.readFileSync(path.join(repoRoot, "app/workbench/page.tsx"), "utf8");

    expect(workbenchPage).toContain('import { redirect } from "next/navigation";');
    expect(workbenchPage).toContain('import { resolveWorkbenchRouteTargetForUser } from "@/lib/revision/workbenchQueue";');
    expect(workbenchPage).toContain('redirect(`/workbench-v2?${new URLSearchParams({ manuscriptId, evaluationJobId }).toString()}`);');
    expect(workbenchPage).toContain('redirect("/workbench-v2");');
    expect(workbenchPage).not.toContain("ReviseQueueV2Client");
  });
});

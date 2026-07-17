import React from "react";

import WorkbenchV2Page from "@/app/workbench-v2/page";
import { getWorkbenchQueue, type WorkbenchOpportunity, type WorkbenchQueuePayload } from "@/lib/revision/workbenchQueue";
import { buildClassifiedWorkbenchOpportunity, classifyWorkbenchExecutabilityDetailed } from "@/lib/revision/workbenchQueueProjection";
import type { ClassifiedWorkbenchOpportunity } from "@/lib/revision/workbenchQueueProjection";

function classify(opp: WorkbenchOpportunity): ClassifiedWorkbenchOpportunity {
  return buildClassifiedWorkbenchOpportunity(opp, classifyWorkbenchExecutabilityDetailed(opp));
}

jest.mock("@/lib/revision/workbenchQueue", () => ({
  getWorkbenchQueue: jest.fn(),
  resolveWorkbenchRouteTargetForUser: jest.fn(async () => null),
}));

jest.mock("@/components/revision/ReviseCockpitClientWorkflowV2", () => ({
  __esModule: true,
  default: ({ payload }: { payload: WorkbenchQueuePayload }) => (
    <div data-testid="workbench-v2-client">{JSON.stringify(payload)}</div>
  ),
}));

// The page is an async server component; the cockpit client is not invoked during
// that call, so walk the returned element tree to read the payload prop it was given.
function findWorkbenchPayload(node: unknown): WorkbenchQueuePayload | null {
  if (!React.isValidElement(node)) return null;
  const props = node.props as { payload?: WorkbenchQueuePayload; children?: React.ReactNode };
  if (props.payload && Array.isArray(props.payload.opportunities)) return props.payload;
  const children = React.Children.toArray(props.children);
  for (const child of children) {
    const found = findWorkbenchPayload(child);
    if (found) return found;
  }
  return null;
}

function opportunity(id: string, readiness: "ready_for_revise" | "needs_targeting"): WorkbenchOpportunity {
  return {
    id,
    readiness,
    severity: "should",
    scope: "Line",
    criterion: "pacing",
    anchor: "passage:1",
  } as unknown as WorkbenchOpportunity;
}

function basePayload(overrides: Partial<WorkbenchQueuePayload>): WorkbenchQueuePayload {
  return {
    ok: true,
    error: null,
    manuscriptId: "7307",
    evaluationJobId: "e39ba4ef-ce0d-45af-ae01-d7380109d33f",
    modeContract: null,
    manuscriptTitle: "Great Expectations",
    opportunities: [],
    needsTargeting: [],
    withheldUnsupported: [],
    readinessTotals: { ready_for_revise: 0, needs_targeting: 0, withheld_unsupported: 0 },
    totals: { must: 0, should: 0, could: 0 },
    scopes: { Line: 0, Passage: 0, Scene: 0, Chapter: 0, Structural: 0, Manuscript: 0 },
    criteria: {},
    ...overrides,
  };
}

describe("/workbench-v2 page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads queue payload and renders the cockpit client", async () => {
    (getWorkbenchQueue as jest.Mock).mockResolvedValue(
      basePayload({ opportunities: [classify(opportunity("op-1", "ready_for_revise"))] }),
    );

    const element = await WorkbenchV2Page({
      searchParams: Promise.resolve({
        manuscriptId: "7307",
        evaluationJobId: "e39ba4ef-ce0d-45af-ae01-d7380109d33f",
      }),
    });

    expect(getWorkbenchQueue).toHaveBeenCalledWith({
      manuscriptId: "7307",
      evaluationJobId: "e39ba4ef-ce0d-45af-ae01-d7380109d33f",
    });
    expect(React.isValidElement(element)).toBe(true);
    expect(findWorkbenchPayload(element)?.opportunities.map((o) => o.id)).toEqual(["op-1"]);
  });

  it("passes held buckets through to the client when nothing is copy-paste ready", async () => {
    (getWorkbenchQueue as jest.Mock).mockResolvedValue(
      basePayload({
        opportunities: [],
        needsTargeting: [classify(opportunity("held-1", "needs_targeting")), classify(opportunity("held-2", "needs_targeting"))],
        withheldUnsupported: [classify(opportunity("held-3", "ready_for_revise"))],
      }),
    );

    const element = await WorkbenchV2Page({
      searchParams: Promise.resolve({
        manuscriptId: "7307",
        evaluationJobId: "e39ba4ef-ce0d-45af-ae01-d7380109d33f",
      }),
    });

    const payload = findWorkbenchPayload(element);
    // The page passes the queue payload unchanged to the client component.
    // Held-item promotion is the client's responsibility, not the server page's.
    expect(payload?.opportunities).toEqual([]);
    expect(payload?.needsTargeting?.map((o) => o.id)).toEqual(["held-1", "held-2"]);
    expect(payload?.withheldUnsupported?.map((o) => o.id)).toEqual(["held-3"]);
  });

  it("does not crash when held buckets are missing from the payload", async () => {
    const malformed = basePayload({ opportunities: [] });
    delete (malformed as Partial<WorkbenchQueuePayload>).needsTargeting;
    delete (malformed as Partial<WorkbenchQueuePayload>).withheldUnsupported;
    (getWorkbenchQueue as jest.Mock).mockResolvedValue(malformed);

    const element = await WorkbenchV2Page({
      searchParams: Promise.resolve({
        manuscriptId: "7307",
        evaluationJobId: "e39ba4ef-ce0d-45af-ae01-d7380109d33f",
      }),
    });

    expect(React.isValidElement(element)).toBe(true);
  });
});

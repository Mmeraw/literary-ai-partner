import React from "react";

import WorkbenchV2Page from "@/app/workbench-v2/page";
import { getWorkbenchQueue } from "@/lib/revision/workbenchQueue";

function MockReviseCockpitClient({ payload }: { payload: unknown }) {
  return <div data-testid="workbench-v2-cockpit">{JSON.stringify(payload)}</div>;
}

jest.mock("@/lib/revision/workbenchQueue", () => ({
  getWorkbenchQueue: jest.fn(),
}));

jest.mock("@/components/revision/ReviseCockpitClient", () => ({
  __esModule: true,
  default: MockReviseCockpitClient,
}));

describe("/workbench-v2 page", () => {
  it("loads queue payload and renders ReviseCockpitClient", async () => {
    const mockedPayload = {
      ok: true,
      error: null,
      manuscriptId: "7307",
      evaluationJobId: "e39ba4ef-ce0d-45af-ae01-d7380109d33f",
      manuscriptTitle: "Great Expectations",
      opportunities: [],
      totals: { must: 0, should: 1, could: 2 },
      scopes: { Line: 1, Passage: 0, Scene: 0, Chapter: 0, Structural: 0, Manuscript: 2 },
    };

    (getWorkbenchQueue as jest.Mock).mockResolvedValue(mockedPayload);

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
    expect((element as React.ReactElement).type).toBe(MockReviseCockpitClient);
    expect((element as React.ReactElement<{ payload: unknown }>).props.payload).toEqual(mockedPayload);
  });
});

/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";

import EvaluateEntry from "@/components/evaluation/EvaluateEntry";
import { useJobs } from "@/lib/jobs/useJobs";

jest.mock("@/lib/jobs/useJobs", () => ({
  useJobs: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock("@/lib/activity/userActivity", () => ({
  appendUserActivity: jest.fn(),
}));

jest.mock("@/components/evaluation/ManuscriptSubmissionForm", () => ({
  __esModule: true,
  default: () => <div data-testid="submission-form" />,
}));

jest.mock("@/components/evaluation/CompletionBanner", () => ({
  __esModule: true,
  default: () => <div data-testid="completion-banner" />,
}));

describe("EvaluateEntry failed history row", () => {
  it("renders Needs attention without cancel action or phase leakage", () => {
    (useJobs as jest.Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      jobs: [
        {
          id: "f2a60aa2-6518-4ec7-b58f-38d3a4c1aafd",
          status: "failed",
          created_at: "2026-02-23T16:00:00.000Z",
          manuscript_title: "Author Manuscript",
          progress: {
            phase: "phase_3b",
            phase_status: "failed",
            dashboard_status: "failed",
            message: "QG_POV_MISSING_EVIDENCE",
          },
        },
      ],
    });

    const { container } = render(<EvaluateEntry />);

    expect(screen.getAllByText("Needs attention").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("button", { name: /Cancel Evaluation/i })).not.toBeInTheDocument();

    const pageText = container.textContent || "";
    expect(pageText).not.toMatch(/\bPhase\b/i);
    expect(pageText).not.toMatch(/phase_/i);
    expect(pageText).not.toMatch(/\b3B\b/i);
  });
});
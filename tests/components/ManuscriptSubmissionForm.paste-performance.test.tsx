/**
 * @jest-environment jsdom
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import ManuscriptSubmissionForm from "@/components/evaluation/ManuscriptSubmissionForm";

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null),
    },
    json: async () => body,
  };
}

const PASTE_WORD_LIMIT = 250000;

describe("ManuscriptSubmissionForm pasted manuscript input", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("submits the exact pasted text even though the large textarea is not React-controlled", async () => {
    const onSubmitSuccess = jest.fn();
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/manuscripts") {
        return jsonResponse({ manuscripts: [] });
      }

      if (url === "/api/jobs" && init?.method === "POST") {
        return jsonResponse({ job_id: "job-paste-1" });
      }

      throw new Error(`Unexpected fetch ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ManuscriptSubmissionForm onSubmitSuccess={onSubmitSuccess} />);

    fireEvent.click(screen.getByRole("button", { name: /Paste Text/i }));

    const pastedText = "First paragraph survives.\n\nSecond paragraph also survives — including punctuation.";
    fireEvent.change(screen.getByLabelText(/Paste text/i), {
      target: { value: pastedText },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Begin Editorial Evaluation/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/jobs",
        expect.objectContaining({ method: "POST" }),
      );
    });

    const jobsCall = fetchMock.mock.calls.find(([input]) => String(input) === "/api/jobs");
    expect(jobsCall).toBeDefined();
    const payload = JSON.parse(String(jobsCall?.[1]?.body));

    expect(payload).toMatchObject({
      job_type: "evaluate_full",
      manuscript_text: pastedText,
      processing_terms_accepted: true,
    });
    expect(payload).not.toHaveProperty("manuscript_id");
    expect(onSubmitSuccess).toHaveBeenCalledWith({ job_id: "job-paste-1" });
  });

  it("blocks submission and shows the Upload redirect when pasted word count exceeds 250,000", async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/manuscripts") return jsonResponse({ manuscripts: [] });
      throw new Error(`Unexpected fetch ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ManuscriptSubmissionForm onSubmitSuccess={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Paste Text/i }));

    // Build a string of exactly PASTE_WORD_LIMIT + 1 words
    const overLimitText = Array.from({ length: PASTE_WORD_LIMIT + 1 }, (_, i) => `w${i}`).join(" ");
    fireEvent.change(screen.getByLabelText(/Paste text/i), {
      target: { value: overLimitText },
    });

    // The over-limit warning and redirect button must be visible
    expect(await screen.findByText(/Paste limit exceeded/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Switch to Upload File/i })).toBeTruthy();

    // The submit button must be disabled (no jest-dom; use DOM attribute directly)
    const submitButton = screen.getByRole("button", { name: /Begin Editorial Evaluation/i });
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    // /api/jobs must never have been called
    expect(fetchMock).not.toHaveBeenCalledWith("/api/jobs", expect.anything());
  });
});

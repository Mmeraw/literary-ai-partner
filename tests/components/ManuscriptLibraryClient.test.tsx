/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ManuscriptLibraryClient from "@/components/manuscripts/ManuscriptLibraryClient";

const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("ManuscriptLibraryClient", () => {
  const manuscripts = [
    { id: 1, title: "Criminality V2", word_count: 120000, source: "upload", file_size: 1024, updated_at: "2026-07-20T10:00:00Z" },
    { id: 2, title: "Untitled Manuscript", word_count: 5000, source: "paste", file_size: 256, updated_at: "2026-07-19T10:00:00Z" },
  ];

  beforeEach(() => {
    mockRefresh.mockClear();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, deleted: [1], count: 1, counts: {} }) });
  });

  it("renders checkboxes as the first column and delete action as the last column", () => {
    render(<ManuscriptLibraryClient manuscripts={manuscripts} />);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThanOrEqual(3); // header + two rows

    const rows = screen.getAllByRole("row");
    const dataRow = rows.find((row) => row.textContent?.includes("Criminality V2"));
    expect(dataRow).toBeDefined();
    const cells = dataRow?.querySelectorAll("td");
    expect(cells?.[0]?.querySelector('input[type="checkbox"]')).toBeTruthy();
    expect(cells?.[cells.length - 1]?.textContent).toMatch(/Delete/);
  });

  it("keeps bulk delete disabled until rows are selected", () => {
    render(<ManuscriptLibraryClient manuscripts={manuscripts} />);
    const bulkButton = screen.getByRole("button", { name: /Delete selected/i }) as HTMLButtonElement;
    expect(bulkButton.disabled).toBe(true);

    const rowCheckbox = screen.getByLabelText(/Select Criminality V2/i);
    fireEvent.click(rowCheckbox);

    expect(bulkButton.disabled).toBe(false);
  });

  it("opens a confirmation modal and requires typing DELETE for bulk deletion", async () => {
    render(<ManuscriptLibraryClient manuscripts={manuscripts} />);

    const rowCheckbox = screen.getByLabelText(/Select Criminality V2/i);
    fireEvent.click(rowCheckbox);

    const bulkButton = screen.getByRole("button", { name: /Delete selected/i });
    fireEvent.click(bulkButton);

    const heading = screen.getByRole("heading", { name: /Permanently delete 1 manuscript/i });
    expect(heading).toBeTruthy();

    const confirmInput = screen.getByLabelText(/Type DELETE to continue/i) as HTMLInputElement;
    const confirmButton = screen.getByRole("button", { name: /Delete permanently/i }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);

    fireEvent.change(confirmInput, { target: { value: "DELETE" } });
    expect(confirmButton.disabled).toBe(false);

    fireEvent.click(confirmButton);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/manuscripts?ids=1"),
      expect.objectContaining({ method: "DELETE" }),
    ));
  });

  it("performs single deletion without typed confirmation", async () => {
    render(<ManuscriptLibraryClient manuscripts={manuscripts} />);

    const deleteButtons = screen.getAllByRole("button", { name: /^Delete$/i });
    fireEvent.click(deleteButtons[0]);

    const heading = screen.getByRole("heading", { name: /Permanently delete manuscript\?/i });
    expect(heading).toBeTruthy();

    const confirmButton = screen.getByRole("button", { name: /Delete permanently/i });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/manuscripts?ids=1"),
      expect.objectContaining({ method: "DELETE" }),
    ));
  });
});

/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import ReviseQueueDemo from "@/components/revise/ReviseQueueDemo";

describe("ReviseQueueDemo public contract", () => {
  it("shows exactly three executable A/B/C choices only on the Copy-Paste card", () => {
    render(<ReviseQueueDemo />);

    const card = screen.getByTestId("revise-demo-copy-paste");
    expect(within(card).getAllByRole("radio")).toHaveLength(3);
    expect(within(card).getByText(/A — Recommended repair/i)).toBeTruthy();
    expect(within(card).getByText(/B — Rhythm variant/i)).toBeTruthy();
    expect(within(card).getByText(/C — Bolder rendering shift/i)).toBeTruthy();
    expect(within(card).getByRole("button", { name: /Accept A/i })).toBeTruthy();
  });

  it("renders Strategy as one guided plan with no A/B/C or Accept controls", () => {
    render(<ReviseQueueDemo />);
    fireEvent.click(screen.getByRole("tab", { name: /Strategy/i }));

    const card = screen.getByTestId("revise-demo-strategy");
    expect(within(card).getByText(/Recommended strategy/i)).toBeTruthy();
    expect(within(card).getByText(/Implementation sequence/i)).toBeTruthy();
    expect(within(card).getByText(/Author decision required/i)).toBeTruthy();
    expect(within(card).queryByRole("radio")).toBeNull();
    expect(within(card).queryByRole("button", { name: /Accept/i })).toBeNull();
    expect(within(card).queryByText(/A —/i)).toBeNull();
  });

  it("renders Held as recovery guidance with no generated candidate controls", () => {
    render(<ReviseQueueDemo />);
    fireEvent.click(screen.getByRole("tab", { name: /Held/i }));

    const card = screen.getByTestId("revise-demo-held");
    expect(within(card).getByText(/Why this was held/i)).toBeTruthy();
    expect(within(card).getByText(/Missing context/i)).toBeTruthy();
    expect(within(card).getByText(/How to recover it/i)).toBeTruthy();
    expect(within(card).queryByRole("radio")).toBeNull();
    expect(within(card).queryByRole("button", { name: /Accept/i })).toBeNull();
    expect(within(card).queryByRole("button", { name: /Generate/i })).toBeNull();
    expect(within(card).queryByText(/Trusted Path eligible/i)).toBeNull();
  });
});

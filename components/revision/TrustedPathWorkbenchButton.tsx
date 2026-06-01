"use client";

import { useState } from "react";

type TrustedPathWorkbenchButtonProps = {
  disabled?: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function readyQueueButtons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll("aside li button"))
    .filter((button): button is HTMLButtonElement => button instanceof HTMLButtonElement)
    .filter((button) => {
      const text = (button.textContent ?? "").replace(/\s+/g, " ");
      return /\bReady\b/.test(text) && !/\bNeeds Targeting\b/i.test(text);
    });
}

function acceptAButton(): HTMLButtonElement | null {
  return Array.from(document.querySelectorAll("button"))
    .filter((button): button is HTMLButtonElement => button instanceof HTMLButtonElement)
    .find((button) => (button.textContent ?? "").trim() === "Accept A" && !button.disabled) ?? null;
}

async function resetQueueFilters() {
  const search = document.querySelector('input[placeholder="Search queue"]');
  if (search instanceof HTMLInputElement && search.value) setInputValue(search, "");

  const selects = Array.from(document.querySelectorAll("select"));
  for (const select of selects) {
    if (!(select instanceof HTMLSelectElement)) continue;
    if (Array.from(select.options).some((option) => option.value === "all") && select.value !== "all") {
      setSelectValue(select, "all");
    }
  }

  await sleep(125);
}

export default function TrustedPathWorkbenchButton({ disabled }: TrustedPathWorkbenchButtonProps) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runTrustedPath() {
    if (disabled || running) return;

    const confirmed = window.confirm(
      "TrustedPath™ will accept Recommended Repair A for every Ready item in the current Revise Queue. Needs Targeting, deferred, rejected, and custom-only items remain untouched. You can still use Unselect in the ledger before Final Review. Continue?",
    );
    if (!confirmed) return;

    setRunning(true);
    setMessage("TrustedPath™ is accepting Ready A repairs…");

    try {
      await resetQueueFilters();
      let applied = 0;
      let guardedStop = false;

      for (let safety = 0; safety < 500; safety += 1) {
        const nextReady = readyQueueButtons()[0];
        if (!nextReady) break;

        nextReady.click();
        await sleep(90);

        const accept = acceptAButton();
        if (!accept) {
          guardedStop = true;
          break;
        }

        accept.click();
        applied += 1;
        await sleep(180);
      }

      setMessage(
        applied > 0
          ? `TrustedPath™ accepted ${applied} Recommended Repair A item${applied === 1 ? "" : "s"}. Review the ledger before Final Review.`
          : guardedStop
            ? "TrustedPath™ stopped because the next item was not copy-ready. Review Needs Targeting items manually."
            : "TrustedPath™ found no Ready items to accept.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "TrustedPath™ could not complete.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="fixed right-6 top-[132px] z-50 max-w-[320px] text-right">
      <button
        type="button"
        onClick={runTrustedPath}
        disabled={disabled || running}
        className={`rounded border px-3 py-2 text-xs font-semibold shadow-lg ${
          disabled || running
            ? "cursor-not-allowed border-[#3A3022] bg-[#120E08] text-[#7F735F]"
            : "border-[#C8A96E] bg-[#C8A96E] text-[#1A140C] hover:bg-[#D8BB7B]"
        }`}
        title="Accept Recommended Repair A for every Ready item and move those choices to the ledger."
      >
        {running ? "TrustedPath™ running…" : "TrustedPath™"}
      </button>
      {message && (
        <p className="mt-2 rounded border border-[#3A3022] bg-[#120E08] px-3 py-2 text-[11px] leading-4 text-[#CBBDA4] shadow-lg">
          {message}
        </p>
      )}
    </div>
  );
}

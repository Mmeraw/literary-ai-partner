"use client";

import { useState } from "react";

type TrustedPathWorkbenchButtonProps = {
  manuscriptId: string | null;
  evaluationJobId: string | null;
  disabled?: boolean;
};

export default function TrustedPathWorkbenchButton({ manuscriptId, evaluationJobId, disabled }: TrustedPathWorkbenchButtonProps) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function runTrustedPath() {
    if (disabled || running || !manuscriptId || !evaluationJobId) return;

    setConfirming(false);
    setRunning(true);
    setMessage("TrustedPath™ is moving Recommended Repair A decisions to the ledger…");

    try {
      const response = await fetch("/api/revision-ledger/trusted-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manuscriptId, evaluationJobId }),
      });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "TrustedPath™ could not complete.");
      }

      const skipped = Number(json.skippedCount ?? 0);
      const applied = Number(json.appliedCount ?? 0);
      setMessage(`TrustedPath™ accepted ${applied} Recommended Repair A item${applied === 1 ? "" : "s"}${skipped ? ` and left ${skipped} item${skipped === 1 ? "" : "s"} for manual review` : ""}. Opening Final Review…`);

      window.location.assign(json.finalReviewUrl ?? `/workbench/final-review?${new URLSearchParams({ manuscriptId, evaluationJobId }).toString()}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "TrustedPath™ could not complete.");
      setRunning(false);
    }
  }

  const isDisabled = disabled || running || !manuscriptId || !evaluationJobId;

  return (
    <div className="workbench-v2-trusted-path relative">
      <button
        type="button"
        onClick={() => {
          if (isDisabled) return;
          setMessage(null);
          setConfirming(true);
        }}
        disabled={isDisabled}
        className={`flex h-10 items-center justify-center rounded border px-4 text-[12px] font-bold uppercase tracking-[0.08em] shadow-lg transition whitespace-nowrap ${
          isDisabled
            ? "cursor-not-allowed border-[#3A3022] bg-[#120E08] text-[#7F735F]"
            : "border-[#E0BF78] bg-[#D5B36C] text-[#171006] hover:bg-[#E4C982]"
        }`}
        title="Accept Recommended Repair A for every copy-ready item and open Final Review."
      >
        {running ? "Running…" : "TrustedPath"}
      </button>
      {confirming && !running && (
        <div className="absolute right-0 mt-2 w-[390px] rounded border border-[#E0BF78] bg-[#120E08] px-3 py-3 text-left text-[11px] leading-4 text-[#CBBDA4] shadow-lg">
          <p className="font-bold text-[#F4E3B0]">Confirm TrustedPath™</p>
          <p className="mt-1">
            TrustedPath™ will accept Recommended Repair A for every copy-ready item in the current Revise Queue. Needs Targeting items remain untouched. You can still use Final Review before applying/exporting.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded border border-[#3A3022] bg-[#171006] px-3 py-1.5 text-[11px] font-bold text-[#CBBDA4] hover:bg-[#21180E]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runTrustedPath}
              className="rounded border border-[#E0BF78] bg-[#D5B36C] px-3 py-1.5 text-[11px] font-bold text-[#171006] hover:bg-[#E4C982]"
            >
              Continue
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className="absolute right-0 mt-2 w-[360px] rounded border border-[#3A3022] bg-[#120E08] px-3 py-2 text-[11px] leading-4 text-[#CBBDA4] shadow-lg">
          {message}
        </p>
      )}
    </div>
  );
}

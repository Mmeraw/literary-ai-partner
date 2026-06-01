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

  async function runTrustedPath() {
    if (disabled || running || !manuscriptId || !evaluationJobId) return;

    const confirmed = window.confirm(
      "TrustedPath™ will accept Recommended Repair A for every copy-ready item in the current Revise Queue. Needs Targeting items remain untouched. You can still use Final Review before applying/exporting. Continue?",
    );
    if (!confirmed) return;

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
    <div className="fixed right-[300px] top-[88px] z-50 max-w-[360px] text-right">
      <button
        type="button"
        onClick={runTrustedPath}
        disabled={isDisabled}
        className={`rounded-md border px-5 py-2.5 text-sm font-bold uppercase tracking-[0.08em] shadow-xl ring-1 ring-[#F0D28A]/25 transition ${
          isDisabled
            ? "cursor-not-allowed border-[#3A3022] bg-[#120E08] text-[#7F735F] ring-0"
            : "border-[#E0BF78] bg-[#D5B36C] text-[#171006] hover:bg-[#E4C982] hover:shadow-2xl"
        }`}
        title="Accept Recommended Repair A for every copy-ready item and open Final Review."
      >
        {running ? "Running…" : "TrustedPath"}
      </button>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#C8A96E]">
        TrustedPath™ one-click repair path
      </p>
      {message && (
        <p className="mt-2 rounded border border-[#3A3022] bg-[#120E08] px-3 py-2 text-[11px] leading-4 text-[#CBBDA4] shadow-lg">
          {message}
        </p>
      )}
    </div>
  );
}

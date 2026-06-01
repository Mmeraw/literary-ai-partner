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

  return (
    <div className="fixed right-6 top-[132px] z-50 max-w-[340px] text-right">
      <button
        type="button"
        onClick={runTrustedPath}
        disabled={disabled || running || !manuscriptId || !evaluationJobId}
        className={`rounded border px-3 py-2 text-xs font-semibold shadow-lg ${
          disabled || running || !manuscriptId || !evaluationJobId
            ? "cursor-not-allowed border-[#3A3022] bg-[#120E08] text-[#7F735F]"
            : "border-[#C8A96E] bg-[#C8A96E] text-[#1A140C] hover:bg-[#D8BB7B]"
        }`}
        title="Accept Recommended Repair A for every copy-ready item and open Final Review."
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

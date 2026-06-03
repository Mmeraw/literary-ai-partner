"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetQueueButton({
  evaluationJobId,
}: {
  evaluationJobId: string | null;
}) {
  const [status, setStatus] = useState<"idle" | "confirming" | "resetting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleReset = useCallback(async () => {
    if (status === "idle") {
      setStatus("confirming");
      return;
    }

    if (status !== "confirming") return;

    setStatus("resetting");
    try {
      const res = await fetch("/api/revise/reset-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluationJobId }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("done");
        setMessage(data.message ?? "Queue reset. Reloading...");
        setTimeout(() => router.refresh(), 800);
      } else {
        setStatus("error");
        setMessage(data.error ?? "Failed to reset queue.");
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Network error");
    }
  }, [evaluationJobId, status, router]);

  const cancel = useCallback(() => {
    setStatus("idle");
    setMessage("");
  }, []);

  if (!evaluationJobId) return null;

  return (
    <div className="relative">
      {status === "confirming" && (
        <div className="absolute right-0 mt-2 w-[320px] rounded border border-[#E0BF78] bg-[#120E08] px-3 py-3 text-left text-[11px] leading-4 text-[#CBBDA4] shadow-lg z-50">
          <p className="font-bold text-[#F4E3B0]">Confirm Reset Queue</p>
          <p className="mt-1">This will clear the cached revision queue and rebuild it from evaluation data on next page load.</p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={cancel}
              className="rounded border border-[#3A3022] bg-[#171006] px-3 py-1.5 text-[11px] font-bold text-[#CBBDA4] hover:bg-[#21180E]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded border border-red-600/60 bg-red-900/60 px-3 py-1.5 text-[11px] font-bold text-red-300 hover:bg-red-800/70"
            >
              Reset Queue
            </button>
          </div>
        </div>
      )}

      {status === "idle" && (
        <button
          onClick={handleReset}
          className="flex h-10 items-center justify-center rounded border border-[#C8A96E] bg-[#1C160E] px-4 text-[12px] font-bold uppercase tracking-[0.08em] text-[#F3E3C3] shadow-lg transition hover:bg-[#2A2115] whitespace-nowrap"
        >
          Reset Queue
        </button>
      )}

      {status === "resetting" && (
        <span className="rounded border border-[#3A3022] bg-[#120E08] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#7F735F] shadow-lg">Resetting…</span>
      )}

      {(status === "done" || status === "error") && (
        <span className={`rounded border px-4 py-2 text-[12px] font-bold uppercase tracking-[0.08em] shadow-lg ${
          status === "done" ? "border-emerald-700/50 bg-emerald-900/30 text-emerald-400" : "border-red-700/50 bg-red-900/30 text-red-400"
        }`}>
          {status === "done" ? "Queue Reset" : "Error"}
        </span>
      )}
    </div>
  );
}

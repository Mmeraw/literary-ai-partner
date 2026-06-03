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
    <div className="inline-flex items-center gap-2">
      {status === "confirming" && (
        <>
          <span className="text-[11px] text-amber-400">Clear cached queue and rebuild?</span>
          <button
            onClick={handleReset}
            className="rounded border border-red-600/60 bg-red-900/40 px-3 py-1 text-[11px] font-bold text-red-300 transition hover:bg-red-800/50"
          >
            Confirm Reset
          </button>
          <button
            onClick={cancel}
            className="rounded border border-[#F3E3C3]/15 px-3 py-1 text-[11px] text-[#F3E3C3]/50 transition hover:text-[#F3E3C3]/70"
          >
            Cancel
          </button>
        </>
      )}

      {status === "idle" && (
        <button
          onClick={handleReset}
          className="rounded border border-[#F3E3C3]/15 bg-[#1C160E] px-3 py-1.5 text-[11px] font-medium text-[#F3E3C3]/60 transition hover:border-[#C8A96E]/40 hover:text-[#C8A96E]"
        >
          Reset Queue
        </button>
      )}

      {status === "resetting" && (
        <span className="text-[11px] text-[#F3E3C3]/40">Resetting...</span>
      )}

      {(status === "done" || status === "error") && (
        <span className={`text-[11px] ${status === "done" ? "text-emerald-400" : "text-red-400"}`}>
          {message}
        </span>
      )}
    </div>
  );
}

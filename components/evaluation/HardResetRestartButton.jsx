"use client";

import { useCallback, useState } from "react";

/**
 * Small, reusable hard-reset/restart control for list surfaces.
 *
 * The authoritative reset logic lives in /api/jobs/[jobId]/resume. This button
 * only provides the missing UX affordance on summary/list surfaces where a
 * failed or stalled job would otherwise look like a dead end.
 */
export default function HardResetRestartButton({
  jobId,
  compact = false,
  className = "",
  label = "Hard reset / restart",
}) {
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");

  const run = useCallback(async () => {
    if (!jobId || state === "running" || state === "done") return;

    if (state === "idle") {
      setState("confirming");
      setMessage("Confirm restart from the safest saved checkpoint. Your manuscript will not need to be uploaded again.");
      return;
    }

    if (state !== "confirming") return;

    setState("running");
    setMessage("Restarting from saved checkpoint…");

    try {
      const res = await fetch(`/api/jobs/${jobId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        setState("error");
        setMessage(data?.error ?? "Unable to restart this evaluation. Open details for more recovery options.");
        return;
      }

      setState("done");
      setMessage("Restart accepted. Refreshing status…");
      window.setTimeout(() => window.location.reload(), 450);
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Network error while restarting evaluation.");
    }
  }, [jobId, state]);

  const cancel = useCallback(() => {
    setState("idle");
    setMessage("");
  }, []);

  if (!jobId) return null;

  const buttonClass = compact
    ? "inline-flex min-h-[34px] items-center justify-center rounded-lg px-3 py-1.5 font-rg-mono text-[11px] font-bold uppercase tracking-[0.08em] text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
    : "inline-flex min-h-[40px] items-center justify-center rounded-lg px-4 py-2 font-rg-mono text-sm font-bold uppercase tracking-[0.08em] text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className={`inline-flex flex-col items-end gap-1 ${className}`.trim()}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {state === "confirming" && (
          <button
            type="button"
            onClick={cancel}
            className="inline-flex min-h-[34px] items-center justify-center rounded-lg border border-stone-300 bg-white px-3 py-1.5 font-rg-mono text-[11px] font-bold uppercase tracking-[0.08em] text-stone-800 transition hover:bg-stone-50"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={run}
          disabled={state === "running" || state === "done"}
          className={`${buttonClass} ${state === "error" ? "bg-red-800 hover:bg-red-900" : "bg-[#7A2B1A] hover:bg-[#622114]"}`}
        >
          {state === "running" ? "Restarting…" : state === "done" ? "Restarted" : state === "confirming" ? "Confirm restart" : label}
        </button>
      </div>
      {message && (
        <p className={`max-w-[18rem] text-right text-[11px] leading-4 ${state === "error" ? "text-red-700" : "text-stone-600"}`}>
          {message}
        </p>
      )}
    </div>
  );
}

"use client";

import React, { useState } from "react";

/**
 * PurgeJobsButton
 *
 * Deletes all terminal (failed + complete) jobs for the current user.
 * Active jobs are never touched. Requires a confirmation click.
 * On success, triggers a full jobs list refresh via onPurged().
 */
export default function PurgeJobsButton({ terminalCount = 0, onPurged }) {
  const [confirming, setConfirming] = useState(false);
  const [purging, setPurging] = useState(false);
  const [error, setError] = useState(null);

  if (terminalCount === 0) return null;

  async function handlePurge() {
    setPurging(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs/purge", { method: "DELETE" });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setError(body.error ?? "Purge failed");
        setConfirming(false);
      } else {
        setConfirming(false);
        onPurged?.();
      }
    } catch (err) {
      setError("Network error — try again");
      setConfirming(false);
    } finally {
      setPurging(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">
          Delete {terminalCount} old {terminalCount === 1 ? "job" : "jobs"}?
        </span>
        <button
          onClick={handlePurge}
          disabled={purging}
          className="inline-flex items-center px-3 py-1.5 text-xs font-bold tracking-wide text-white bg-red-700 hover:bg-red-800 rounded-md shadow-sm transition-colors disabled:opacity-50"
        >
          {purging ? "Purging…" : "Confirm Purge"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={purging}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold tracking-widest uppercase text-red-700 border border-red-300 hover:bg-red-50 rounded-md transition-colors"
      title={`Clear ${terminalCount} completed or failed ${terminalCount === 1 ? "job" : "jobs"}`}
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      Purge Old Jobs
    </button>
  );
}

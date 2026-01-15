// app/evaluate/page.jsx

"use client";

import { useState } from "react";

export default function EvaluatePage() {
  const [manuscriptId, setManuscriptId] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manuscriptId,
          workType: "novel",
          inputs: {},
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setStatus({ type: "error", message: data.error || "Evaluation failed" });
      } else {
        setStatus({
          type: "success",
          message: "Evaluation request accepted under governance envelope.",
        });
      }
    } catch (err) {
      setStatus({ type: "error", message: String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="rg-card p-6 max-w-md w-full space-y-4">
        <h1 className="text-2xl font-semibold">Evaluate Manuscript</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Manuscript ID</label>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={manuscriptId}
              onChange={(e) => setManuscriptId(e.target.value)}
              placeholder="manuscript_123"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !manuscriptId}
            className="w-full inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Start Evaluation"}
          </button>
        </form>

        {status && (
          <p
            className={
              status.type === "success"
                ? "text-sm text-green-600"
                : "text-sm text-red-600"
            }
          >
            {status.message}
          </p>
        )}
      </div>
    </main>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { DetectedMode, EvaluationMode, VoicePreservationMode } from "@/lib/evaluation/modeDetection";
import type { ConfirmedMode } from "@/lib/evaluation/modeGate";

type Props = {
  jobId: string;
  detectedMode: DetectedMode;
  confirmedMode: ConfirmedMode | null;
};

export default function ModeConfirmationBlock({ jobId, detectedMode, confirmedMode }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [evaluationMode, setEvaluationMode] = useState<EvaluationMode>(
    confirmedMode?.evaluationMode ?? detectedMode.proposedEvaluationMode,
  );
  const [voicePreservationMode, setVoicePreservationMode] = useState<VoicePreservationMode>(
    confirmedMode?.voicePreservationMode ?? detectedMode.proposedVoicePreservationMode,
  );

  const isConfirmed = confirmedMode !== null;

  const sortedEvidence = useMemo(() => detectedMode.evidence.slice(0, 5), [detectedMode.evidence]);

  async function submit(action: "keep" | "replace" | "refine") {
    setBusy(true);
    setError(null);

    try {
      const payload =
        action === "keep"
          ? { action }
          : {
              action,
              confirmedMode: {
                evaluationMode,
                voicePreservationMode,
              },
            };

      const res = await fetch(`/api/evaluations/${jobId}/mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to confirm mode");
      }

      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to confirm mode");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border bg-white p-6 mb-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Mode Confirmation</h2>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
            detectedMode.confidence === "HIGH"
              ? "bg-emerald-100 text-emerald-800"
              : detectedMode.confidence === "MODERATE"
              ? "bg-amber-100 text-amber-800"
              : "bg-rose-100 text-rose-800"
          }`}
        >
          {detectedMode.confidence} confidence
        </span>
      </div>

      <p className="mt-2 text-sm text-gray-700">
        {/*
          PR-J (2026-05-16): TESTIMONY mode was previously surfaced as a confident
          "Proposed: TESTIMONY · MAXIMUM" which over-stated the system's certainty
          and risked appearing to label real lived events. TESTIMONY/STANDARD/
          TRANSGRESSIVE detection runs on textual markers alone and cannot, by
          design, distinguish a memoir from a novel that mimics one. The softer
          "Possible … — confirmation required" wording communicates that this is
          a triage hint pending author confirmation, not a classification.
        */}
        {detectedMode.proposedEvaluationMode === "TESTIMONY" ? (
          <>
            Possible testimony / sensitive-material content — confirmation required.{" "}
            <span className="text-gray-600">
              Suggested voice preservation:{" "}
              <span className="font-semibold">{detectedMode.proposedVoicePreservationMode}</span>.
            </span>
          </>
        ) : (
          <>
            Proposed: <span className="font-semibold">{detectedMode.proposedEvaluationMode}</span> ·{" "}
            <span className="font-semibold">{detectedMode.proposedVoicePreservationMode}</span>
          </>
        )}
      </p>

      <ul className="mt-3 list-disc pl-5 text-sm text-gray-700 space-y-1">
        {sortedEvidence.map((item, idx) => (
          <li key={`${item.signal}-${idx}`}>
            {item.signal} <span className="text-gray-500">({item.where})</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">Evaluation Mode</span>
          <select
            value={evaluationMode}
            onChange={(e) => setEvaluationMode(e.target.value as EvaluationMode)}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            disabled={busy}
          >
            <option value="STANDARD">STANDARD</option>
            <option value="TRANSGRESSIVE">TRANSGRESSIVE</option>
            <option value="TESTIMONY">TESTIMONY</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-gray-600 mb-1">Voice Preservation</span>
          <select
            value={voicePreservationMode}
            onChange={(e) => setVoicePreservationMode(e.target.value as VoicePreservationMode)}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            disabled={busy}
          >
            <option value="MAXIMUM">MAXIMUM</option>
            <option value="BALANCED">BALANCED</option>
            <option value="POLISHED">POLISHED</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void submit("keep")}
          disabled={busy}
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Keep
        </button>
        <button
          type="button"
          onClick={() => void submit("replace")}
          disabled={busy}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Replace
        </button>
        <button
          type="button"
          onClick={() => void submit("refine")}
          disabled={busy}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Refine
        </button>
      </div>

      {!isConfirmed && (
        <p className="mt-3 text-sm text-amber-700">
          Revise and Trustpath remain hard-disabled until a mode is confirmed.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}

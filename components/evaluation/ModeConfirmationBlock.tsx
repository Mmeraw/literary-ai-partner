"use client";

import { useState } from "react";
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
    confirmedMode?.evaluationMode ?? "STANDARD",
  );
  const [voicePreservationMode, setVoicePreservationMode] = useState<VoicePreservationMode>(
    confirmedMode?.voicePreservationMode ?? "BALANCED",
  );

  const isConfirmed = confirmedMode !== null;

  async function submit() {
    setBusy(true);
    setError(null);

    try {
      const requestedMode = {
        evaluationMode,
        voicePreservationMode,
      };
      const matchesDetectedProposal =
        requestedMode.evaluationMode === detectedMode.proposedEvaluationMode &&
        requestedMode.voicePreservationMode === detectedMode.proposedVoicePreservationMode;
      const action: "keep" | "replace" = matchesDetectedProposal ? "keep" : "replace";

      const payload =
        action === "keep"
          ? { action }
          : {
              action,
              confirmedMode: requestedMode,
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
        <h2 className="text-xl font-semibold text-gray-900">Access Confirmation</h2>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
            detectedMode.confidence === "HIGH"
              ? "bg-emerald-100 text-emerald-800"
              : detectedMode.confidence === "MODERATE"
              ? "bg-amber-100 text-amber-800"
              : "bg-rose-100 text-rose-800"
          }`}
        >
          {detectedMode.confidence} Safety Confidence
        </span>
      </div>

      <p className="mt-2 text-sm text-gray-800 leading-relaxed">
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
            <span className="text-gray-700">
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block text-gray-700 font-medium mb-1">Evaluation Mode</span>
          <select
            value={evaluationMode}
            onChange={(e) => setEvaluationMode(e.target.value as EvaluationMode)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
            disabled={busy}
          >
            <option value="STANDARD">STANDARD</option>
            <option value="TRANSGRESSIVE">TRANSGRESSIVE</option>
            <option value="TESTIMONY">TESTIMONY</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-gray-700 font-medium mb-1">Voice Preservation</span>
          <select
            value={voicePreservationMode}
            onChange={(e) => setVoicePreservationMode(e.target.value as VoicePreservationMode)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
            disabled={busy}
          >
            <option value="MAXIMUM">MAXIMUM</option>
            <option value="BALANCED">BALANCED</option>
            <option value="POLISHED">POLISHED</option>
          </select>
        </label>
      </div>

      <p className="mt-2 text-sm text-gray-700 leading-relaxed">You can change your selection at any time — confirming does not re-run your evaluation.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isConfirmed ? "Save Mode" : "Confirm Access"}
        </button>
      </div>

      {!isConfirmed && (
        <p className="mt-3 text-sm font-medium text-amber-700 leading-relaxed">
          Revise and Trustpath are locked until access is confirmed.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}

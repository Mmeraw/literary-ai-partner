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

  // Design tokens
  const surfaceRaised = '#1C160E';
  const cream         = '#F5EFE0';
  const cream2        = '#C8BEA8';
  const gold          = '#C8A96E';
  const dim           = '#6B6560';
  const border        = 'rgba(216,209,192,0.14)';

  async function submit() {
    setBusy(true);
    setError(null);

    try {
      const requestedMode = { evaluationMode, voicePreservationMode };
      const matchesDetectedProposal =
        requestedMode.evaluationMode === detectedMode.proposedEvaluationMode &&
        requestedMode.voicePreservationMode === detectedMode.proposedVoicePreservationMode;
      const action: "keep" | "replace" = matchesDetectedProposal ? "keep" : "replace";

      const payload =
        action === "keep"
          ? { action }
          : { action, confirmedMode: requestedMode };

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

  const confidenceBadgeStyle = (() => {
    if (detectedMode.confidence === "HIGH") {
      return { background: 'rgba(127,163,107,0.15)', color: '#7FA36B', border: '1px solid rgba(127,163,107,0.3)' };
    }
    if (detectedMode.confidence === "MODERATE") {
      return { background: 'rgba(200,169,110,0.12)', color: gold, border: '1px solid rgba(200,169,110,0.3)' };
    }
    return { background: 'rgba(167,71,42,0.15)', color: '#e07a5f', border: '1px solid rgba(167,71,42,0.35)' };
  })();

  const selectStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: '0.375rem',
    border: '1px solid rgba(216,209,192,0.22)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    background: '#12100B',
    color: cream,
    fontFamily: "'Switzer', system-ui, sans-serif",
    outline: 'none',
  };

  return (
    <section
      className="rounded-xl p-6 mb-4"
      style={{
        background: surfaceRaised,
        border: `1px solid ${border}`,
        fontFamily: "'Switzer', system-ui, sans-serif",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          className="text-xl font-semibold"
          style={{ color: cream, fontFamily: "'Instrument Serif', Georgia, serif" }}
        >
          Mode Confirmation
        </h2>
        <span
          className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
          style={confidenceBadgeStyle}
        >
          {detectedMode.confidence} confidence
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed" style={{ color: cream2 }}>
        {detectedMode.proposedEvaluationMode === "TESTIMONY" ? (
          <>
            Possible testimony / sensitive-material content — confirmation required.{" "}
            <span style={{ color: dim }}>
              Suggested voice preservation:{" "}
              <span className="font-semibold" style={{ color: cream2 }}>{detectedMode.proposedVoicePreservationMode}</span>.
            </span>
          </>
        ) : (
          <>
            Proposed:{" "}
            <span className="font-semibold" style={{ color: cream }}>{detectedMode.proposedEvaluationMode}</span>
            {" · "}
            <span className="font-semibold" style={{ color: cream }}>{detectedMode.proposedVoicePreservationMode}</span>
          </>
        )}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block mb-1 font-medium" style={{ color: cream2 }}>Evaluation Mode</span>
          <select
            value={evaluationMode}
            onChange={(e) => setEvaluationMode(e.target.value as EvaluationMode)}
            style={selectStyle}
            disabled={busy}
          >
            <option value="STANDARD">STANDARD</option>
            <option value="TRANSGRESSIVE">TRANSGRESSIVE</option>
            <option value="TESTIMONY">TESTIMONY</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1 font-medium" style={{ color: cream2 }}>Voice Preservation</span>
          <select
            value={voicePreservationMode}
            onChange={(e) => setVoicePreservationMode(e.target.value as VoicePreservationMode)}
            style={selectStyle}
            disabled={busy}
          >
            <option value="MAXIMUM">MAXIMUM</option>
            <option value="BALANCED">BALANCED</option>
            <option value="POLISHED">POLISHED</option>
          </select>
        </label>
      </div>

      <p className="mt-2 text-sm leading-relaxed" style={{ color: dim }}>
        You can change your selection at any time — confirming does not re-run your evaluation.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            background: gold,
            color: '#0D0A05',
            border: 'none',
            fontFamily: "'Switzer', system-ui, sans-serif",
          }}
        >
          {isConfirmed ? "Save Mode" : "Confirm Mode"}
        </button>
      </div>

      {!isConfirmed && (
        <p className="mt-3 text-sm font-medium leading-relaxed" style={{ color: gold }}>
          Revise and Trustpath remain hard-disabled until a mode is confirmed.
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm" style={{ color: '#e07a5f' }}>{error}</p>
      )}
    </section>
  );
}

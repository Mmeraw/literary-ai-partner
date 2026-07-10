"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";
import { projectLongFormMultiLayerEvaluation } from "@/lib/evaluation/evaluationReportViewModel";
import {
  LongformExecutiveVerdict,
  LongformScoreGrid,
  LongformMarketShelf,
  LongformStructuralStack,
  LongformArcMap,
  LongformCriterionAnalyses,
  LongformLayerAnalysis,
  LongformSymbolicAudit,
  LongformReaderExperience,
  LongformRevisionPlan,
  LongformReleasability,
} from "@/components/reports/longform";
import { SynthesisArtifactControls } from "./SynthesisArtifactControls";

const POLL_INTERVAL_MS = 15_000;

function estimateSynthesisMinutes(wordCount: number): string {
  if (wordCount >= 100_000) return "5–10";
  if (wordCount >= 60_000) return "4–8";
  if (wordCount >= 30_000) return "3–6";
  return "2–5";
}

// Recovery is deliberately later than the published estimate. A customer
// should never be asked to intervene while synthesis is still inside its
// normal operating window.
function stalledAfterMs(wordCount: number): number {
  if (wordCount >= 100_000) return 12 * 60_000;
  if (wordCount >= 60_000) return 10 * 60_000;
  if (wordCount >= 30_000) return 8 * 60_000;
  return 7 * 60_000;
}

type Props = {
  jobId: string;
  wordCount: number;
  initialDreamDoc?: LongformDreamDocument | null;
  onReady?: (doc: LongformDreamDocument) => void;
};

type ArtifactRow = {
  artifact_type: string;
  content: { longform_document?: LongformDreamDocument } | null;
};

type SynthesisStatus = "pending" | "complete" | "skipped" | "failed";

export function SynthesisPoller({ jobId, wordCount, initialDreamDoc = null, onReady }: Props) {
  const [dreamDoc, setDreamDoc] = useState<LongformDreamDocument | null>(initialDreamDoc);
  const [synthesisStatus, setSynthesisStatus] = useState<SynthesisStatus>(
    initialDreamDoc ? "complete" : "pending",
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const [topStatusHost, setTopStatusHost] = useState<HTMLElement | null>(null);
  const startRef = useRef(Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchArtifact = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/artifacts`, { cache: "no-store" });
      if (!res.ok) {
        console.warn(`[SynthesisPoller] artifacts endpoint returned ${res.status} for job ${jobId}`);
        return;
      }
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        console.warn(`[SynthesisPoller] non-JSON response (${ct}) for job ${jobId}`);
        return;
      }
      const data = await res.json() as {
        ok: boolean;
        artifact?: ArtifactRow | null;
        synthesis_status?: SynthesisStatus;
      };
      const synthesisStatus = data.synthesis_status ?? "pending";

      if (synthesisStatus === "skipped" || synthesisStatus === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        if (elapsedRef.current) clearInterval(elapsedRef.current);
        setSynthesisStatus(synthesisStatus);
        return;
      }

      if (!data.ok || !data.artifact) return;
      if (data.artifact.artifact_type !== "longform_document_v1") return;

      let content = data.artifact.content;
      if (typeof content === "string") {
        try { content = JSON.parse(content); } catch { return; }
      }
      const longformDoc = (content as { longform_document?: LongformDreamDocument } | null)
        ?.longform_document;
      if (!longformDoc || typeof longformDoc !== "object") return;

      if (pollRef.current) clearInterval(pollRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      setSynthesisStatus("complete");

      if (onReady) {
        setDreamDoc(longformDoc);
        onReady(longformDoc);
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.warn(`[SynthesisPoller] fetch error for job ${jobId}:`, err);
    }
  }, [jobId, onReady]);

  useEffect(() => {
    // Already terminal — nothing to poll
    if (dreamDoc || synthesisStatus === "skipped" || synthesisStatus === "failed") return;

    elapsedRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startRef.current);
    }, 1000);

    fetchArtifact();
    pollRef.current = setInterval(fetchArtifact, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [dreamDoc, fetchArtifact, synthesisStatus]);

  useEffect(() => {
    if (dreamDoc) return;

    const reportHeader = document.querySelector<HTMLElement>(".rg-report-page header");
    if (!reportHeader?.parentElement) return;

    const host = document.createElement("div");
    host.setAttribute("data-narrative-synthesis-status", "");
    reportHeader.insertAdjacentElement("afterend", host);
    setTopStatusHost(host);

    return () => {
      setTopStatusHost(null);
      host.remove();
    };
  }, [dreamDoc]);

  const lf = projectLongFormMultiLayerEvaluation(dreamDoc);
  if (lf) {
    return (
      <div className="space-y-8">
        <div><h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Executive Verdict</h3><LongformExecutiveVerdict vm={lf} /></div>
        <div><h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Market Shelf</h3><LongformMarketShelf vm={lf} /></div>
        <div><h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Structural Stack</h3><LongformStructuralStack vm={lf} /></div>
        <div><h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Arc Map</h3><LongformArcMap vm={lf} /></div>
        <div><h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">13-Criterion Score Grid</h3><LongformScoreGrid vm={lf} /></div>
        <div><h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Criterion Analysis</h3><LongformCriterionAnalyses vm={lf} /></div>
        <div><h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Layer Analysis</h3><LongformLayerAnalysis vm={lf} /></div>
        <div><h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Symbolic / Doctrine Audit</h3><LongformSymbolicAudit vm={lf} /></div>
        <div><h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Reader Experience</h3><LongformReaderExperience vm={lf} /></div>
        <div><h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Revision Plan</h3><LongformRevisionPlan vm={lf} /></div>
        <div><h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Releasability</h3><LongformReleasability vm={lf} /></div>
      </div>
    );
  }

  if (synthesisStatus === "skipped") {
    // skipped = operator-disabled or explicit operator skip request.
    // Polling has stopped; the retry control lets the user request a new attempt.
    return (
      <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-900">
          Narrative Synthesis is temporarily unavailable. Your Evidence Review is ready above.
          Use the button below to request a retry.
        </p>
        <SynthesisArtifactControls jobId={jobId} />
      </div>
    );
  }

  if (synthesisStatus === "failed") {
    return (
      <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-900">
          Narrative Synthesis did not complete. Your Evidence Review is ready above.
          Use the button below to retry.
        </p>
        <SynthesisArtifactControls jobId={jobId} />
      </div>
    );
  }

  // ── Synthesis pending ─────────────────────────────────────────────────────
  const rangeLabel = estimateSynthesisMinutes(wordCount);
  const elapsedMin = Math.floor(elapsedMs / 60_000);
  const showRecovery = elapsedMs >= stalledAfterMs(wordCount);

  const topStatus = topStatusHost ? createPortal(
    <section className="mb-4 rounded-sm border border-[#D9D0C3] border-l-4 border-l-[#8B2E2E] bg-[#FFF6E8] px-4 py-3 shadow-sm print-hidden" aria-live="polite">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#8B2E2E] border-t-transparent" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-[#1C1814]">Evidence Review ready · Narrative Synthesis generating…</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[#5C5549]">
            Your scores, criterion analyses, and revision plan are ready. Narrative Synthesis is being prepared below and will appear automatically in approximately {rangeLabel} minutes. No refresh needed.
          </p>
        </div>
      </div>
    </section>,
    topStatusHost,
  ) : null;

  return (
    <>
      {topStatus}
      <div className="space-y-4">
        <div className="flex items-center gap-3 py-4">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-400 border-t-transparent shrink-0" aria-hidden />
          <div>
            <p className="text-sm text-gray-700 font-medium">Narrative Synthesis is generating automatically.</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Your Evidence Review, including scores, criterion analyses, and revision plan, is ready above. Narrative Synthesis will appear here in approximately {rangeLabel} minutes
              {elapsedMin > 0 ? ` — ${elapsedMin} min elapsed` : ""}. This page will update automatically — no refresh needed.
            </p>
          </div>
        </div>

        {showRecovery && (
          <div className="rounded-md bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm font-medium text-amber-900 mb-1">Narrative Synthesis appears to be stalled.</p>
            <p className="mb-3 text-xs text-amber-800">
              Recovery uses the completed Evidence Review and preserved artifacts as its restart anchor; the evaluation itself will not run again.
            </p>
            <SynthesisArtifactControls
              jobId={jobId}
              onSuccess={() => {
                startRef.current = Date.now();
                setElapsedMs(0);
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}

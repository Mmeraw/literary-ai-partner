"use client";

/**
 * SynthesisPoller
 *
 * Client component that automatically polls for the longform_document_v1
 * artifact after job completion. Replaces the static "check back in a minute"
 * message with:
 *   - Auto-polling every 15s (cron fires every 2 min; synthesis takes 3-8 min)
 *   - Honest time estimate based on manuscript word count
 *   - Renders the full longform report inline when the artifact arrives
 *   - No manual refresh required
 *
 * Architecture: server page passes null dreamDoc + wordCount + jobId.
 * This component takes over rendering of the synthesis section client-side.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";
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

// How long between polls while waiting for synthesis.
// Cron fires every 2 min; synthesis itself takes 3-10 min for long manuscripts.
// 15s polling means we surface the result within 15s of it landing.
const POLL_INTERVAL_MS = 15_000;

// After this many minutes with no artifact, show the "taking longer" panel.
const SHOW_CONTROLS_AFTER_MS = 5 * 60 * 1000; // 5 minutes

function estimateSynthesisMinutes(wordCount: number): string {
  // Based on observed runs: ~8 min for 110k words, ~3-4 min for 25-50k words.
  if (wordCount >= 100_000) return "5–10";
  if (wordCount >= 60_000) return "4–8";
  if (wordCount >= 30_000) return "3–6";
  return "2–5";
}

type Props = {
  jobId: string;
  wordCount: number;
  // If the server already resolved the artifact (fast path), pass it here
  // and this component renders it immediately without polling.
  initialDreamDoc?: LongformDreamDocument | null;
};

type ArtifactRow = {
  artifact_type: string;
  content: { longform_document?: LongformDreamDocument } | null;
};

export function SynthesisPoller({ jobId, wordCount, initialDreamDoc = null }: Props) {
  const [dreamDoc, setDreamDoc] = useState<LongformDreamDocument | null>(initialDreamDoc);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef(Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchArtifact = useCallback(async () => {
    try {
      // The artifacts endpoint filters by job_id + artifact_type=longform_document_v1.
      // Once synthesis is complete this will return the doc; until then artifact is null.
      const res = await fetch(`/api/jobs/${jobId}/artifacts`, { cache: "no-store" });
      if (!res.ok) {
        // Non-2xx — log and retry on next interval
        console.warn(`[SynthesisPoller] artifacts endpoint returned ${res.status} for job ${jobId}`);
        return;
      }
      const data = await res.json() as { ok: boolean; artifact?: ArtifactRow | null };
      if (!data.ok || !data.artifact) return;
      if (data.artifact.artifact_type !== "longform_document_v1") return;

      // content may be a deeply nested object; handle both parsed-object and
      // raw-JSON-string cases defensively.
      let content = data.artifact.content;
      if (typeof content === "string") {
        try { content = JSON.parse(content); } catch { return; }
      }
      const longformDoc = (content as { longform_document?: LongformDreamDocument } | null)
        ?.longform_document;
      if (!longformDoc || typeof longformDoc !== "object") return;

      // Stop polling
      if (pollRef.current) clearInterval(pollRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);

      // Reload the page so the server-rendered path delivers the full synthesis
      // with initialDreamDoc pre-populated. This is the same reliable path that
      // "Skip Synthesis" takes and avoids any client-side hydration edge cases.
      window.location.reload();
    } catch (err) {
      // Silent — will retry on next interval
      console.warn(`[SynthesisPoller] fetch error for job ${jobId}:`, err);
    }
  }, [jobId]);

  useEffect(() => {
    // Already have it — nothing to poll
    if (dreamDoc) return;

    // Start elapsed timer for the time estimate display
    elapsedRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startRef.current);
    }, 1000);

    // Poll immediately, then every 15s
    fetchArtifact();
    pollRef.current = setInterval(fetchArtifact, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [dreamDoc, fetchArtifact]);

  // ── Synthesis ready ───────────────────────────────────────────────────────
  if (dreamDoc) {
    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Executive Verdict</h3>
          <LongformExecutiveVerdict doc={dreamDoc} />
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Market Shelf</h3>
          <LongformMarketShelf doc={dreamDoc} />
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Structural Stack</h3>
          <LongformStructuralStack doc={dreamDoc} />
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Arc Map</h3>
          <LongformArcMap doc={dreamDoc} />
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">13-Criterion Score Grid</h3>
          <LongformScoreGrid doc={dreamDoc} />
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Criterion Analysis</h3>
          <LongformCriterionAnalyses doc={dreamDoc} />
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Layer Analysis</h3>
          <LongformLayerAnalysis doc={dreamDoc} />
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Symbolic / Doctrine Audit</h3>
          <LongformSymbolicAudit doc={dreamDoc} />
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Reader Experience</h3>
          <LongformReaderExperience doc={dreamDoc} />
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Revision Plan</h3>
          <LongformRevisionPlan doc={dreamDoc} />
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Releasability</h3>
          <LongformReleasability doc={dreamDoc} />
        </div>
      </div>
    );
  }

  // ── Synthesis pending ─────────────────────────────────────────────────────
  const rangeLabel = estimateSynthesisMinutes(wordCount);
  const elapsedMin = Math.floor(elapsedMs / 60_000);
  const showControls = elapsedMs >= SHOW_CONTROLS_AFTER_MS;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 py-4">
        <div
          className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-400 border-t-transparent shrink-0"
          aria-hidden
        />
        <div>
          <p className="text-sm text-gray-700 font-medium">
            Narrative Synthesis is generating automatically.
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            Expected in approximately {rangeLabel} minutes for this manuscript length
            {elapsedMin > 0 ? ` — ${elapsedMin} min elapsed` : ""}.
            This page will update automatically — no refresh needed.
          </p>
        </div>
      </div>

      {showControls && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm font-medium text-amber-900 mb-3">
            Taking longer than expected?
          </p>
          <SynthesisArtifactControls jobId={jobId} />
        </div>
      )}
    </div>
  );
}

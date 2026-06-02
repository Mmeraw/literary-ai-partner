"use client";
import { useState } from "react";
import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";

type Props = { doc: LongformDreamDocument };

const CONFIDENCE_BADGE: Record<string, string> = {
  High: "bg-emerald-200 text-emerald-900 ring-1 ring-emerald-400",
  "Moderate-High": "bg-teal-200 text-teal-900 ring-1 ring-teal-400",
  Moderate: "bg-yellow-200 text-yellow-900 ring-1 ring-yellow-400",
  Low: "bg-rose-200 text-rose-900 ring-1 ring-rose-400",
};

function EvidenceList({ items, label, accent }: { items: string[]; label: string; accent: string }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${accent}`}>{label}</p>
      <ol className="space-y-1 list-decimal list-inside">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-gray-600 leading-relaxed">
            {item}
          </li>
        ))}
      </ol>
    </div>
  );
}

function CriterionCard({ a }: { a: LongformDreamDocument["criterion_analyses"][number] }) {
  const [open, setOpen] = useState(true);
  const badge = CONFIDENCE_BADGE[a.confidence] ?? "bg-gray-100 text-gray-600";
  // score can be null (e.g. proseControl in insufficient-signal state) — guard
  const safeScore = a.score ?? null;
  const scoreColor =
    safeScore !== null && safeScore >= 8 ? "text-green-700 font-black"
    : safeScore !== null && safeScore >= 6 ? "text-amber-600 font-black"
    : safeScore !== null ? "text-red-700 font-black"
    : "text-gray-600";

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className={`text-xl font-bold tabular-nums ${scoreColor}`}>
            {safeScore !== null ? safeScore.toFixed(1) : "—"}
          </span>
          <span className="font-medium text-gray-800 capitalize text-sm">
            {a.key.replace(/_/g, " ")}
          </span>
          <span className={`hidden sm:inline-block px-2 py-0.5 rounded text-xs font-medium ${badge}`}>
            {a.confidence}
          </span>
        </div>
        <span className="text-gray-600 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3 bg-gray-50">
          <EvidenceList items={a.fit_evidence} label="What is working" accent="text-emerald-600" />
          <EvidenceList items={a.gap_evidence} label="What weakens impact" accent="text-amber-600" />
          <EvidenceList items={a.revision_queue} label="Revision queue" accent="text-indigo-600" />
        </div>
      )}
    </div>
  );
}

export default function LongformCriterionAnalyses({ doc }: Props) {
  const analyses = doc.criterion_analyses ?? [];
  if (analyses.length === 0) return null;

  return (
    <div className="space-y-2">
      {analyses.map((a, i) => (
        <CriterionCard key={i} a={a} />
      ))}
    </div>
  );
}

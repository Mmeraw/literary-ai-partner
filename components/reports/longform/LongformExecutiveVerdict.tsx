import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";

type Props = { doc: LongformDreamDocument };

const SCORE_DIMS = [
  { key: "quality", label: "Quality" },
  { key: "readiness", label: "Readiness" },
  { key: "commercial", label: "Commercial" },
  { key: "literary", label: "Literary" },
] as const;

/**
 * Executive Verdict score-color thresholds intentionally mirror the report's
 * confidence guide so readers see one consistent meaning across the page:
 *   Low      < 60  → red
 *   Moderate 60–84 → dark amber
 *   High     ≥ 85  → dark green
 */
function scoreColor(n: number): string {
  if (n >= 85) return "text-emerald-700";
  if (n >= 60) return "text-amber-700";
  return "text-red-700";
}

export default function LongformExecutiveVerdict({ doc }: Props) {
  return (
    <div className="space-y-5">
      {/* DREAM subscores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SCORE_DIMS.map(({ key, label }) => {
          const val = doc.dream_scores?.[key];
          const display = typeof val === "number" ? val : "—";
          return (
            <div
              key={key}
              className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-center"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 mb-1">
                {label}
              </p>
              <p
                className={`text-3xl font-bold ${typeof val === "number" ? scoreColor(val) : "text-gray-400"}`}
              >
                {display}
              </p>
              <p className="text-xs text-indigo-400 mt-0.5">/100</p>
            </div>
          );
        })}
      </div>

      {/* Executive verdict prose */}
      {doc.executive_verdict && (
        <p className="text-gray-700 leading-relaxed whitespace-pre-line text-[15px]">
          {doc.executive_verdict}
        </p>
      )}
    </div>
  );
}

import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";

type Props = { doc: LongformDreamDocument };

const CONFIDENCE_BADGE: Record<string, string> = {
  High: "bg-emerald-100 text-emerald-700",
  "Moderate-High": "bg-teal-100 text-teal-700",
  Moderate: "bg-amber-100 text-amber-700",
  Low: "bg-rose-100 text-rose-700",
};

function scoreBar(score: number | null) {
  // score can be null when the LLM returns null for a criterion (e.g. proseControl
  // in insufficient-signal states). Guard here prevents a runtime crash.
  if (score === null || score === undefined) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-8 text-right text-sm font-semibold tabular-nums text-gray-600">—</span>
        <div className="flex-1 h-2 rounded-full bg-gray-100" />
      </div>
    );
  }
  const pct = Math.min(100, Math.max(0, (score / 10) * 100));
  const color =
    score >= 7.5
      ? "bg-emerald-400"
      : score >= 6
        ? "bg-amber-400"
        : "bg-rose-400";
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-right text-sm font-semibold tabular-nums text-gray-800">
        {score.toFixed(1)}
      </span>
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function LongformScoreGrid({ doc }: Props) {
  const analyses = doc.criterion_analyses ?? [];
  if (analyses.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 pr-4 font-semibold text-gray-600 w-56">Criterion</th>
            <th className="text-left py-2 pr-6 font-semibold text-gray-600 w-36">Score</th>
            <th className="text-left py-2 pr-4 font-semibold text-gray-600 w-32">Confidence</th>
            <th className="text-left py-2 font-semibold text-gray-600">Summary finding</th>
          </tr>
        </thead>
        <tbody>
          {analyses.map((a, i) => {
            const badge = CONFIDENCE_BADGE[a.confidence] ?? "bg-gray-100 text-gray-600";
            const summary = a.fit_evidence?.[0] ?? "—";
            return (
              <tr key={i} className="border-b border-gray-100 align-top">
                <td className="py-2.5 pr-4 font-medium text-gray-800 capitalize">
                  {a.key.replace(/_/g, " ")}
                </td>
                <td className="py-2.5 pr-6">{scoreBar(a.score)}</td>
                <td className="py-2.5 pr-4">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge}`}
                  >
                    {a.confidence}
                  </span>
                </td>
                <td className="py-2.5 text-gray-600 text-xs leading-relaxed">{summary}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

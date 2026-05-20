import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";

type Props = { doc: LongformDreamDocument };

const CONFIDENCE_COLORS: Record<string, string> = {
  High: "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Moderate-High": "bg-blue-100 text-blue-800 border-blue-200",
  Moderate: "bg-amber-100 text-amber-800 border-amber-200",
  Low: "bg-rose-100 text-rose-800 border-rose-200",
};

export default function LongformEvidenceDistributionGate({ doc }: Props) {
  // Evidence distribution / confidence gate surfaces through:
  // - criterion_analyses (confidence per criterion, fit_evidence, gap_evidence distribution flags)
  // - acceptance_checks (failure conditions around evidence distribution)
  // - calibration_notes (evidence distribution lessons)

  const criteriaWithConfidence = (doc.criterion_analyses ?? []).map((c) => ({
    ...c,
    hasDistributionGap:
      c.gap_evidence?.some((g) =>
        /distribution|opening.heavy|narrow|insufficient|single|limited|concentrated/i.test(g)
      ) ?? false,
  }));

  const distributionGaps = criteriaWithConfidence.filter((c) => c.hasDistributionGap);
  const lowConfidence = criteriaWithConfidence.filter(
    (c) => c.confidence === "Low" || c.confidence === "Moderate"
  );

  const evidenceFailures = (doc.acceptance_checks?.failure_conditions ?? []).filter((f) =>
    /evidence|distribution|opening.heavy|confidence|narrow|insufficient/i.test(f)
  );
  const evidenceDetections = (doc.acceptance_checks?.required_detection ?? []).filter((d) =>
    /evidence|distribution|confidence|coverage/i.test(d)
  );

  const distributionNotes = (doc.calibration_notes ?? []).filter((n) =>
    /evidence|distribution|opening.heavy|confidence|narrow|coverage/i.test(n)
  );

  // Build confidence summary
  const confidenceCounts: Record<string, number> = {
    High: 0,
    "Moderate-High": 0,
    Moderate: 0,
    Low: 0,
  };
  criteriaWithConfidence.forEach((c) => {
    if (c.confidence in confidenceCounts) {
      confidenceCounts[c.confidence]++;
    }
  });

  const hasData =
    criteriaWithConfidence.length > 0 ||
    evidenceFailures.length > 0 ||
    distributionNotes.length > 0;

  if (!hasData) return null;

  return (
    <div className="space-y-5">
      {/* Confidence distribution summary */}
      {criteriaWithConfidence.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Confidence distribution — all 13 criteria
          </p>
          <div className="flex gap-2 flex-wrap mb-3">
            {Object.entries(confidenceCounts)
              .filter(([, count]) => count > 0)
              .map(([level, count]) => {
                const colorClass =
                  CONFIDENCE_COLORS[level] ?? "bg-gray-100 text-gray-700 border-gray-200";
                return (
                  <span
                    key={level}
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${colorClass}`}
                  >
                    {level}: {count}
                  </span>
                );
              })}
          </div>

          {/* Per-criterion confidence grid */}
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            {criteriaWithConfidence.map((c, i) => {
              const colorClass =
                CONFIDENCE_COLORS[c.confidence] ?? "bg-gray-100 text-gray-700 border-gray-200";
              return (
                <div
                  key={i}
                  className={`rounded border ${
                    c.hasDistributionGap
                      ? "border-amber-300 bg-amber-50"
                      : "border-gray-200"
                  } p-2 text-xs`}
                >
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="font-medium text-gray-800 capitalize">{c.key}</span>
                    <span
                      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs font-semibold ${colorClass}`}
                    >
                      {c.confidence}
                    </span>
                  </div>
                  <span className="text-gray-500">{c.score}/10</span>
                  {c.hasDistributionGap && (
                    <p className="text-amber-700 mt-0.5 font-medium">⚠ evidence gap flagged</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Evidence distribution gaps */}
      {distributionGaps.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-2">
            Evidence distribution gaps
          </p>
          <div className="space-y-2">
            {distributionGaps.map((c, i) => (
              <div
                key={i}
                className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"
              >
                <p className="font-medium text-amber-800 mb-1 capitalize">{c.key}</p>
                <ul className="space-y-0.5">
                  {c.gap_evidence
                    .filter((g) =>
                      /distribution|opening.heavy|narrow|insufficient|single|limited|concentrated/i.test(
                        g
                      )
                    )
                    .map((g, j) => (
                      <li key={j} className="text-xs text-amber-700 flex gap-2">
                        <span className="shrink-0">⚠</span>
                        {g}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence acceptance checks */}
      {(evidenceDetections.length > 0 || evidenceFailures.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {evidenceDetections.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-2">
                Required evidence coverage
              </p>
              <ul className="space-y-1">
                {evidenceDetections.map((d, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-2">
                    <span className="text-emerald-400 shrink-0">✓</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {evidenceFailures.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 mb-2">
                Failure conditions
              </p>
              <ul className="space-y-1">
                {evidenceFailures.map((f, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-2">
                    <span className="text-rose-400 shrink-0">⚠</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Calibration notes on evidence */}
      {distributionNotes.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Calibration notes — evidence coverage
          </p>
          <ul className="space-y-1">
            {distributionNotes.map((n, i) => (
              <li key={i} className="text-xs text-gray-600 flex gap-2">
                <span className="text-indigo-400 shrink-0">◆</span>
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

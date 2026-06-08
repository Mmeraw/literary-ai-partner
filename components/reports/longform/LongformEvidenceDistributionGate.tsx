import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";
import {
  formatCriterionConfidenceLabel,
  getConfidenceLabelClasses,
  type CanonicalConfidenceLabel,
} from "@/lib/evaluation/confidenceFieldPolicy";
import { getCriterionDisplayLabel } from "@/lib/evaluation/reportRenderSafety";
import { formatScoreFractionForDisplay } from "@/lib/ui/score-formatting";

type Props = { doc: LongformDreamDocument; showInternalSections?: boolean };

export default function LongformEvidenceDistributionGate({ doc, showInternalSections = false }: Props) {
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
  const confidenceCounts: Record<CanonicalConfidenceLabel, number> = {
    "Very High Confidence": 0,
    "High Confidence": 0,
    "Moderate Confidence": 0,
    "Low Confidence": 0,
    "Insufficient Evidence": 0,
  };
  criteriaWithConfidence.forEach((c) => {
    const confidenceLabel = formatCriterionConfidenceLabel(c.confidence, undefined);
    if (confidenceLabel) {
      confidenceCounts[confidenceLabel]++;
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
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Confidence distribution — all 13 criteria
          </p>
          <div className="flex gap-2 flex-wrap mb-3">
            {Object.entries(confidenceCounts)
              .filter(([, count]) => count > 0)
              .map(([level, count]) => {
                const colorClass = getConfidenceLabelClasses(level as CanonicalConfidenceLabel);
                return (
                  <span
                    key={level}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${colorClass}`}
                  >
                    {level}: {count}
                  </span>
                );
              })}
          </div>

          {/* Per-criterion confidence grid */}
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            {criteriaWithConfidence.map((c, i) => {
              const confidenceLabel = formatCriterionConfidenceLabel(c.confidence, undefined);
              const colorClass = confidenceLabel
                ? getConfidenceLabelClasses(confidenceLabel)
                : "bg-stone-200 text-stone-700 ring-1 ring-stone-300";
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
                    <span className="font-medium text-gray-800">{getCriterionDisplayLabel(c.key)}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-semibold ${colorClass}`}
                    >
                      {confidenceLabel ?? c.confidence}
                    </span>
                  </div>
                  <span className="text-gray-700">{formatScoreFractionForDisplay(c.score, 10)}</span>
                  {c.hasDistributionGap && (
                    <p className="text-amber-700 mt-0.5 font-medium text-xs">Evidence gap flagged</p>
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
                <p className="font-medium text-amber-800 mb-1">{getCriterionDisplayLabel(c.key)}</p>
                <ul className="list-none space-y-0.5 pl-0">
                  {c.gap_evidence
                    .filter((g) =>
                      /distribution|opening.heavy|narrow|insufficient|single|limited|concentrated/i.test(
                        g
                      )
                    )
                    .map((g, j) => (
                      <li key={j} className="flex gap-1.5 text-xs text-amber-700">
                        <span className="shrink-0 text-amber-500">•</span>
                        <span>{g}</span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence acceptance checks — INTERNAL ONLY (never shown to authors) */}
      {showInternalSections && (evidenceDetections.length > 0 || evidenceFailures.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {evidenceDetections.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-2">
                Required evidence coverage <span className="text-amber-700">(internal)</span>
              </p>
              <ul className="list-none space-y-1 pl-0">
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
                Failure conditions <span className="text-amber-700">(internal)</span>
              </p>
              <ul className="list-none space-y-1 pl-0">
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

      {/* Calibration notes on evidence — INTERNAL ONLY */}
      {showInternalSections && distributionNotes.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Calibration notes — evidence coverage <span className="text-amber-700">(internal)</span>
          </p>
          <ul className="list-none space-y-1 pl-0">
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

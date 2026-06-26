import type { LongFormMultiLayerEvaluationViewModel } from "@/lib/evaluation/evaluationReportViewModel";

type Props = { vm: LongFormMultiLayerEvaluationViewModel; showInternalSections?: boolean };

const QUALITY_COLORS: Record<string, string> = {
  strong: "bg-emerald-100 text-emerald-800 border-emerald-200",
  moderate: "bg-amber-100 text-amber-800 border-amber-200",
  weak: "bg-rose-100 text-rose-800 border-rose-200",
};

export default function LongformRelationshipSpineLedger({ vm, showInternalSections = false }: Props) {
  // Relationship spine data surfaces through crossLayerIntegration (relationship motifs),
  // structuralStack (relationship spine layers), and acceptanceChecks.
  const relationshipMotifs = (vm.crossLayerIntegration ?? []).filter((m) =>
    /relation|spine|bond|dyad|companion|bridge|connect|family|trust|tension|captiv|guard|dynamic|unit/i.test(
      m.motif + " " + m.description
    )
  );

  const relationshipLayers = (vm.structuralStack ?? []).filter((l) =>
    /relation|spine|bond|companion|family|unit|dyad/i.test(l.layerName)
  );

  const requiredDetections = (vm.acceptanceChecks?.requiredDetection ?? []).filter((d) =>
    /relation|spine|bond|bridge|companion|dyad|family|unit/i.test(d)
  );
  const failureConditions = (vm.acceptanceChecks?.failureConditions ?? []).filter((f) =>
    /relation|spine|bond|bridge|companion|dyad|family|unit|underweight/i.test(f)
  );

  // Also pull from revisionPlan items that target relationships
  const relationshipRevisions = (vm.revisionPlan ?? []).filter((p) =>
    /relation|spine|bond|companion|bridge|dyad|family|unit/i.test(p.title + " " + p.goal)
  );

  const hasData =
    relationshipMotifs.length > 0 ||
    relationshipLayers.length > 0 ||
    requiredDetections.length > 0 ||
    relationshipRevisions.length > 0;

  if (!hasData) return null;

  return (
    <div className="space-y-5">
      {/* Relationship motifs from cross-layer integration */}
      {relationshipMotifs.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Relationship engines &amp; bridge mechanisms
          </p>
          <div className="space-y-2">
            {relationshipMotifs.map((m, i) => {
              const qualityClass =
                QUALITY_COLORS[m.integrationQuality] ??
                "bg-gray-100 text-gray-700 border-gray-200";
              return (
                <div key={i} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-gray-800">{m.motif}</p>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${qualityClass}`}
                    >
                      {m.integrationQuality}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-1">{m.description}</p>
                  {m.revisionNote && (
                    <p className="text-xs text-indigo-600">
                      <span className="font-medium">Revision note:</span> {m.revisionNote}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Structural layers identified as relationship spines */}
      {relationshipLayers.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Structural stack — relationship layers
          </p>
          <div className="space-y-2">
            {relationshipLayers.map((l, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-3 text-sm">
                <p className="font-medium text-gray-800 mb-0.5">{l.layerName}</p>
                <p className="text-xs text-gray-600 mb-1">{l.function}</p>
                <p className="text-xs text-indigo-600">
                  <span className="font-medium">Status:</span> {l.status} —{" "}
                  {l.revisionNote}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revision plan items targeting relationship work */}
      {relationshipRevisions.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Revision priorities — relationship spine
          </p>
          <div className="space-y-2">
            {relationshipRevisions.map((p, i) => (
              <div key={i} className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm">
                <p className="font-medium text-indigo-800 mb-0.5">
                  #{p.displayPriority} — {p.title}
                </p>
                <p className="text-xs text-indigo-700 mb-1">{p.goal}</p>
                {p.actions?.length > 0 && (
                  <ul className="list-none space-y-0.5 pl-0">
                    {p.actions.map((a, j) => (
                      <li key={j} className="flex gap-1.5 text-xs text-indigo-600">
                        <span className="shrink-0 text-indigo-500">{j + 1}.</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {p.acceptanceCheck && (
                  <p className="text-xs text-emerald-700 mt-1 border-t border-indigo-200 pt-1">
                    <span className="font-medium">Acceptance check:</span>{" "}
                    {p.acceptanceCheck}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acceptance checks — INTERNAL ONLY (never shown to authors) */}
      {showInternalSections && (requiredDetections.length > 0 || failureConditions.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {requiredDetections.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-2">
                Required detections <span className="text-amber-700">(internal)</span>
              </p>
              <ul className="list-none space-y-1 pl-0">
                {requiredDetections.map((d, i) => (
                  <li key={i} className="flex gap-1.5 text-xs text-gray-600">
                    <span className="shrink-0 text-gray-500">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {failureConditions.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 mb-2">
                Failure conditions <span className="text-amber-700">(internal)</span>
              </p>
              <ul className="list-none space-y-1 pl-0">
                {failureConditions.map((f, i) => (
                  <li key={i} className="flex gap-1.5 text-xs text-gray-600">
                    <span className="shrink-0 text-gray-500">•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

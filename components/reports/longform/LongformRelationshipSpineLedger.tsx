import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";

type Props = { doc: LongformDreamDocument };

const QUALITY_COLORS: Record<string, string> = {
  strong: "bg-emerald-100 text-emerald-800 border-emerald-200",
  moderate: "bg-amber-100 text-amber-800 border-amber-200",
  weak: "bg-rose-100 text-rose-800 border-rose-200",
};

export default function LongformRelationshipSpineLedger({ doc }: Props) {
  // Relationship spine data surfaces through cross_layer_integration (relationship motifs),
  // structural_stack (relationship spine layers), and acceptance_checks.
  const relationshipMotifs = (doc.cross_layer_integration ?? []).filter((m) =>
    /relation|spine|bond|dyad|companion|bridge|connect|family|trust|tension|captiv|guard|dynamic|unit/i.test(
      m.motif + " " + m.description
    )
  );

  const relationshipLayers = (doc.structural_stack ?? []).filter((l) =>
    /relation|spine|bond|companion|family|unit|dyad/i.test(l.layer_name)
  );

  const requiredDetections = (doc.acceptance_checks?.required_detection ?? []).filter((d) =>
    /relation|spine|bond|bridge|companion|dyad|family|unit/i.test(d)
  );
  const failureConditions = (doc.acceptance_checks?.failure_conditions ?? []).filter((f) =>
    /relation|spine|bond|bridge|companion|dyad|family|unit|underweight/i.test(f)
  );

  // Also pull from revision_plan items that target relationships
  const relationshipRevisions = (doc.revision_plan ?? []).filter((p) =>
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
                QUALITY_COLORS[m.integration_quality] ??
                "bg-gray-100 text-gray-700 border-gray-200";
              return (
                <div key={i} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-gray-800">{m.motif}</p>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${qualityClass}`}
                    >
                      {m.integration_quality}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-1">{m.description}</p>
                  {m.revision_note && (
                    <p className="text-xs text-indigo-600">
                      <span className="font-medium">Revision note:</span> {m.revision_note}
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
                <p className="font-medium text-gray-800 mb-0.5">{l.layer_name}</p>
                <p className="text-xs text-gray-600 mb-1">{l.function}</p>
                <p className="text-xs text-indigo-600">
                  <span className="font-medium">Status:</span> {l.status} —{" "}
                  {l.revision_note}
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
                  #{p.priority} — {p.title}
                </p>
                <p className="text-xs text-indigo-700 mb-1">{p.goal}</p>
                {p.actions?.length > 0 && (
                  <ol className="list-decimal list-inside space-y-0.5">
                    {p.actions.map((a, j) => (
                      <li key={j} className="text-xs text-indigo-600">
                        {a}
                      </li>
                    ))}
                  </ol>
                )}
                {p.acceptance_check && (
                  <p className="text-xs text-emerald-700 mt-1 border-t border-indigo-200 pt-1">
                    <span className="font-medium">Acceptance check:</span>{" "}
                    {p.acceptance_check}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acceptance checks */}
      {(requiredDetections.length > 0 || failureConditions.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {requiredDetections.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-2">
                Required detections
              </p>
              <ul className="space-y-1">
                {requiredDetections.map((d, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-2">
                    <span className="text-emerald-400 shrink-0">✓</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {failureConditions.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 mb-2">
                Failure conditions
              </p>
              <ul className="space-y-1">
                {failureConditions.map((f, i) => (
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
    </div>
  );
}

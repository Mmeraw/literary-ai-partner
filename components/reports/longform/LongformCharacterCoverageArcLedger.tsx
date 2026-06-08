import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";
import { formatCriterionConfidenceLabel, getConfidenceLabelClasses } from "@/lib/evaluation/confidenceFieldPolicy";
import { getDisplayText } from "@/lib/evaluation/reportRenderSafety";
import { formatScoreFractionForDisplay } from "@/lib/ui/score-formatting";

type Props = { doc: LongformDreamDocument; showInternalSections?: boolean };

const STATUS_COLORS: Record<string, string> = {
  strong: "bg-emerald-100 text-emerald-800 border-emerald-200",
  moderate: "bg-amber-100 text-amber-800 border-amber-200",
  weak: "bg-rose-100 text-rose-800 border-rose-200",
  fragile: "bg-red-100 text-red-800 border-red-200",
};

export default function LongformCharacterCoverageArcLedger({ doc, showInternalSections = false }: Props) {
  // Character coverage is distributed across structural_stack (character layers),
  // layer_analyses (character status), and criterion_analyses (character criterion).
  const characterLayers = (doc.structural_stack ?? []).filter((l) =>
    /character|protagonist|arc|pov|voice|companion|co-prot/i.test(l.layer_name)
  );
  const characterLayerAnalyses = (doc.layer_analyses ?? []).filter((l) =>
    /character|protagonist|arc|pov|voice|companion|co-prot/i.test(l.layer_name)
  );
  const characterCriterion = (doc.criterion_analyses ?? []).find(
    (c) => c.key === "character" || c.key === "character_arc" || c.key === "characterization"
  );
  const voiceCriterion = (doc.criterion_analyses ?? []).find(
    (c) => c.key === "voice" || c.key === "pov" || c.key === "voice_pov"
  );
  const closureCriterion = (doc.criterion_analyses ?? []).find(
    (c) => c.key === "closure" || c.key === "narrative_closure" || c.key === "ending"
  );

  const requiredDetections = doc.acceptance_checks?.required_detection ?? [];
  const failureConditions = doc.acceptance_checks?.failure_conditions ?? [];

  const characterDetections = requiredDetections.filter((d) =>
    /character|protagonist|companion|arc|pov|co-prot/i.test(d)
  );
  const characterFailures = failureConditions.filter((f) =>
    /character|protagonist|companion|arc|omit|co-prot/i.test(f)
  );

  const hasData =
    characterLayers.length > 0 ||
    characterLayerAnalyses.length > 0 ||
    characterCriterion ||
    voiceCriterion ||
    characterDetections.length > 0;

  if (!hasData) return null;

  return (
    <div className="space-y-5">
      {/* Character / Arc layers from structural stack */}
      {characterLayers.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Structural layers — character & arc
          </p>
          <div className="space-y-2">
            {characterLayers.map((layer, i) => {
              const statusClass =
                STATUS_COLORS[layer.status as string] ??
                "bg-gray-100 text-gray-700 border-gray-200";
              return (
                <div
                  key={i}
                  className="rounded-lg border border-gray-200 p-3 text-sm"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-gray-800">{layer.layer_name}</p>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass}`}
                    >
                      {layer.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-1">{layer.function}</p>
                  {layer.revision_note && (
                    <p className="text-xs text-indigo-600">
                      <span className="font-medium">Revision note:</span>{" "}
                      {layer.revision_note}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Layer-level character analysis */}
      {characterLayerAnalyses.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Layer analysis — character system
          </p>
          <div className="space-y-2">
            {characterLayerAnalyses.map((l, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-3 text-sm">
                <p className="font-medium text-gray-800 mb-0.5">{l.layer_name}</p>
                <p className="text-xs text-gray-600 mb-1">
                  <span className="font-medium text-gray-700">Status:</span> {l.status}
                </p>
                <p className="text-xs text-indigo-600">
                  <span className="font-medium">Needed revision:</span> {l.needed_revision}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Character criterion deep-dive */}
      {characterCriterion && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Character criterion — score &amp; evidence
          </p>
          <CriterionMiniBlock criterion={characterCriterion} />
        </div>
      )}

      {/* Voice / POV criterion */}
      {voiceCriterion && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Voice &amp; POV — character expression
          </p>
          <CriterionMiniBlock criterion={voiceCriterion} />
        </div>
      )}

      {/* Closure criterion — ending accountability */}
      {closureCriterion && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Narrative closure — ending accountability
          </p>
          <CriterionMiniBlock criterion={closureCriterion} />
        </div>
      )}

      {/* Required detections — INTERNAL ONLY (never shown to authors) */}
      {showInternalSections && (characterDetections.length > 0 || characterFailures.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {characterDetections.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-2">
                Required detections <span className="text-amber-700">(internal)</span>
              </p>
              <ul className="list-none space-y-1 pl-0">
                {characterDetections.map((d, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-2">
                    <span className="text-emerald-400 shrink-0">✓</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {characterFailures.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 mb-2">
                Failure conditions <span className="text-amber-700">(internal)</span>
              </p>
              <ul className="list-none space-y-1 pl-0">
                {characterFailures.map((f, i) => (
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

// ── Shared sub-component ──────────────────────────────────────────────────────

type CriterionEntry = {
  key: string;
  score: number;
  confidence: string;
  fit_evidence: string[];
  gap_evidence: string[];
  revision_queue: string[];
};

function CriterionMiniBlock({ criterion }: { criterion: CriterionEntry }) {
  const confidenceLabel = formatCriterionConfidenceLabel(criterion.confidence, undefined);
  const confidenceClasses = confidenceLabel
    ? getConfidenceLabelClasses(confidenceLabel)
    : "bg-stone-200 text-stone-700 ring-1 ring-stone-300";

  return (
    <div className="rounded-lg border border-gray-200 p-3 text-sm space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold text-indigo-700">{formatScoreFractionForDisplay(criterion.score, 10)}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${confidenceClasses}`}>
          {confidenceLabel ?? `${criterion.confidence} confidence`}
        </span>
      </div>
      {criterion.fit_evidence?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-emerald-600 mb-1">Fit evidence</p>
          <ul className="list-none space-y-0.5 pl-0">
            {criterion.fit_evidence.map((e, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-gray-600">
                <span className="shrink-0 text-gray-500">•</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {criterion.gap_evidence?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-rose-600 mb-1">Gap evidence</p>
          <ul className="list-none space-y-0.5 pl-0">
            {criterion.gap_evidence.map((e, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-gray-600">
                <span className="shrink-0 text-gray-500">•</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {criterion.revision_queue?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-indigo-600 mb-1">Revision queue</p>
          <ul className="list-none space-y-0.5 pl-0">
            {criterion.revision_queue.map((r, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-gray-700">
                <span className="shrink-0 text-gray-500">{i + 1}.</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

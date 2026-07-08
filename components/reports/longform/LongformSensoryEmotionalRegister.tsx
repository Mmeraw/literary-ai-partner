import type { LongFormMultiLayerEvaluationViewModel } from "@/lib/evaluation/evaluationReportViewModel";
import {
  getConfidenceLabelClasses,
  type CanonicalConfidenceLabel,
} from "@/lib/evaluation/confidenceFieldPolicy";

type Props = { vm: LongFormMultiLayerEvaluationViewModel };

export default function LongformSensoryEmotionalRegister({ vm }: Props) {
  // Sensory/emotional register surfaces through:
  // - crossLayerIntegration (sensory/emotional system motifs)
  // - symbolicAudit.doctrineStrengths / doctrineRisks (sensory governance)
  // - readerExperience (emotional state, aftertaste, register language)
  // - criterionAnalyses for tone, prose, worldbuilding

  const sensoryMotifs = (vm.crossLayerIntegration ?? []).filter((m) =>
    /sensor|sound|music|smell|taste|touch|light|silence|dread|tender|obedien|trauma|belong|disorienta|register|atmosphere|conditi|punishment|emotional/i.test(
      m.motif + " " + m.description
    )
  );

  const doctrineSensory = [
    ...(vm.symbolicAudit?.doctrineStrengths ?? []).filter((s) =>
      /sensor|sound|music|smell|taste|touch|light|silence|emotional|register|atmosphere/i.test(s)
    ),
  ];
  const doctureRiskSensory = [
    ...(vm.symbolicAudit?.doctrineRisks ?? []).filter((r) =>
      /sensor|sound|music|smell|taste|touch|light|silence|emotional|register|atmosphere/i.test(r)
    ),
  ];

  const toneOrProseCriteria = (vm.criterionAnalyses ?? []).filter((c) =>
    /tone|prose|style|voice|world|atmosphere/i.test(c.key)
  );

  const rx = vm.readerExperience;
  const firstActEmotional = rx?.firstAct?.emotionalState;
  const middleEmotional = rx?.middle?.emotionalState;
  const finalEmotional = rx?.finalAct?.emotionalState;
  const aftertaste = rx?.aftertaste;

  const hasData =
    sensoryMotifs.length > 0 ||
    doctrineSensory.length > 0 ||
    doctureRiskSensory.length > 0 ||
    toneOrProseCriteria.length > 0 ||
    firstActEmotional ||
    aftertaste;

  if (!hasData) return null;

  return (
    <div className="space-y-5">
      {/* Sensory/emotional motifs */}
      {sensoryMotifs.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Sensory &amp; emotional systems
          </p>
          <div className="space-y-2">
            {sensoryMotifs.map((m, i) => {
              const qualityColor =
                m.integrationQuality === "strong"
                  ? "text-emerald-700"
                  : m.integrationQuality === "weak"
                  ? "text-rose-700"
                  : "text-amber-700";
              return (
                <div key={i} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-gray-800">{m.motif}</p>
                    <span className={`text-xs font-semibold ${qualityColor}`}>
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

      {/* Sensory doctrine from symbolic audit */}
      {(doctrineSensory.length > 0 || doctureRiskSensory.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {doctrineSensory.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-2">
                Sensory governance strengths
              </p>
              <ul className="list-none space-y-1 pl-0">
                {doctrineSensory.map((s, i) => (
                  <li key={i} className="flex gap-1.5 text-xs text-gray-600">
                    <span className="shrink-0 text-gray-500">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {doctureRiskSensory.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 mb-2">
                Sensory governance risks
              </p>
              <ul className="list-none space-y-1 pl-0">
                {doctureRiskSensory.map((r, i) => (
                  <li key={i} className="flex gap-1.5 text-xs text-gray-600">
                    <span className="shrink-0 text-gray-500">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Emotional register arc */}
      {(firstActEmotional || middleEmotional || finalEmotional || aftertaste) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Emotional register arc
          </p>
          <div className="grid md:grid-cols-3 gap-2 text-xs mb-3">
            {firstActEmotional && (
              <div className="rounded border border-gray-200 p-2">
                <p className="font-medium text-gray-700 mb-0.5">First act</p>
                <p className="text-gray-600">{firstActEmotional}</p>
              </div>
            )}
            {middleEmotional && (
              <div className="rounded border border-gray-200 p-2">
                <p className="font-medium text-gray-700 mb-0.5">Middle</p>
                <p className="text-gray-600">{middleEmotional}</p>
              </div>
            )}
            {finalEmotional && (
              <div className="rounded border border-gray-200 p-2">
                <p className="font-medium text-gray-700 mb-0.5">Final act</p>
                <p className="text-gray-600">{finalEmotional}</p>
              </div>
            )}
          </div>
          {aftertaste && (
            <p className="text-sm text-gray-700 italic border-l-4 border-indigo-200 pl-3">
              <span className="font-medium not-italic">Aftertaste:</span> {aftertaste}
            </p>
          )}
        </div>
      )}

      {/* Tone / prose / worldbuilding criteria */}
      {toneOrProseCriteria.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Craft criteria — tone, prose &amp; world
          </p>
          <div className="space-y-2">
            {toneOrProseCriteria.map((c, i) => {
              const confidenceClasses = c.confidenceLabel
                ? getConfidenceLabelClasses(c.confidenceLabel as CanonicalConfidenceLabel)
                : "bg-stone-200 text-stone-700 ring-1 ring-stone-300";
              return (
                <div key={i} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-gray-800">{c.displayLabel}</span>
                    <span className="text-lg font-bold text-indigo-700">{c.scoreLabel}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${confidenceClasses}`}>
                      {c.confidenceLabel}
                    </span>
                  </div>
                  {c.fitEvidence?.length > 0 && (
                    <p className="text-xs text-gray-600">
                      <span className="font-medium text-emerald-600">Fit: </span>
                      {c.fitEvidence[0]}
                    </p>
                  )}
                  {c.gapEvidence?.length > 0 && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      <span className="font-medium text-rose-600">Gap: </span>
                      {c.gapEvidence[0]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

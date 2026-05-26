import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";

type Props = { doc: LongformDreamDocument };

export default function LongformSensoryEmotionalRegister({ doc }: Props) {
  // Sensory/emotional register surfaces through:
  // - cross_layer_integration (sensory/emotional system motifs)
  // - symbolic_audit.doctrine_strengths / doctrine_risks (sensory governance)
  // - reader_experience (emotional state, aftertaste, register language)
  // - criterion_analyses for tone, prose, worldbuilding

  const sensoryMotifs = (doc.cross_layer_integration ?? []).filter((m) =>
    /sensor|sound|music|smell|taste|touch|light|silence|dread|tender|obedien|trauma|belong|disorienta|register|atmosphere|conditi|punishment|emotional/i.test(
      m.motif + " " + m.description
    )
  );

  const doctrineSensory = [
    ...(doc.symbolic_audit?.doctrine_strengths ?? []).filter((s) =>
      /sensor|sound|music|smell|taste|touch|light|silence|emotional|register|atmosphere/i.test(s)
    ),
  ];
  const doctureRiskSensory = [
    ...(doc.symbolic_audit?.doctrine_risks ?? []).filter((r) =>
      /sensor|sound|music|smell|taste|touch|light|silence|emotional|register|atmosphere/i.test(r)
    ),
  ];

  const toneOrProseCriteria = (doc.criterion_analyses ?? []).filter((c) =>
    /tone|prose|style|voice|world|atmosphere/i.test(c.key)
  );

  const rx = doc.reader_experience;
  const firstActEmotional = rx?.first_act?.emotional_state;
  const middleEmotional = rx?.middle?.emotional_state;
  const finalEmotional = rx?.final_act?.emotional_state;
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
                m.integration_quality === "strong"
                  ? "text-emerald-700"
                  : m.integration_quality === "weak"
                  ? "text-rose-700"
                  : "text-amber-700";
              return (
                <div key={i} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-gray-800">{m.motif}</p>
                    <span className={`text-xs font-semibold ${qualityColor}`}>
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

      {/* Sensory doctrine from symbolic audit */}
      {(doctrineSensory.length > 0 || doctureRiskSensory.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {doctrineSensory.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-2">
                Sensory governance strengths
              </p>
              <ul className="space-y-1">
                {doctrineSensory.map((s, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-2">
                    <span className="text-emerald-400 shrink-0">✓</span>
                    {s}
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
              <ul className="space-y-1">
                {doctureRiskSensory.map((r, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-2">
                    <span className="text-rose-400 shrink-0">⚠</span>
                    {r}
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
              const confidenceColor =
                c.confidence === "High"
                  ? "text-emerald-700"
                  : c.confidence === "Low"
                  ? "text-rose-700"
                  : "text-amber-700";
              return (
                <div key={i} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-gray-800 capitalize">{c.key}</span>
                    <span className="text-lg font-bold text-indigo-700">{c.score}/10</span>
                    <span className={`text-xs font-semibold ${confidenceColor}`}>
                      {c.confidence}
                    </span>
                  </div>
                  {c.fit_evidence?.length > 0 && (
                    <p className="text-xs text-gray-600">
                      <span className="font-medium text-emerald-600">✓ </span>
                      {c.fit_evidence[0]}
                    </p>
                  )}
                  {c.gap_evidence?.length > 0 && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      <span className="font-medium text-rose-600">⚠ </span>
                      {c.gap_evidence[0]}
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

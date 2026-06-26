import type { LongFormMultiLayerEvaluationViewModel } from "@/lib/evaluation/evaluationReportViewModel";

type Props = { vm: LongFormMultiLayerEvaluationViewModel };

export default function LongformSymbolicAudit({ vm }: Props) {
  const audit = vm.symbolicAudit;
  if (!audit) return null;

  const symbols = audit.preservedSymbols ?? [];
  const strengths = audit.doctrineStrengths ?? [];
  const risks = audit.doctrineRisks ?? [];

  return (
    <div className="space-y-5">
      {symbols.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Preserved symbols
          </p>
          <div className="space-y-2">
            {symbols.map((s, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-3 text-sm">
                <p className="font-medium text-gray-800 mb-0.5">{s.symbol}</p>
                <p className="text-xs text-gray-600 mb-1">
                  <span className="font-medium text-gray-700">Current function:</span>{" "}
                  {s.currentFunction}
                </p>
                <p className="text-xs text-indigo-600">
                  <span className="font-medium">Instruction:</span> {s.revisionInstruction}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {strengths.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-2">
              Doctrine strengths
            </p>
            <ul className="list-none space-y-1 pl-0">
              {strengths.map((s, i) => (
                <li key={i} className="flex gap-1.5 text-xs text-gray-600">
                  <span className="shrink-0 text-gray-500">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {risks.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 mb-2">
              Doctrine risks
            </p>
            <ul className="list-none space-y-1 pl-0">
              {risks.map((r, i) => (
                <li key={i} className="flex gap-1.5 text-xs text-gray-600">
                  <span className="shrink-0 text-gray-500">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {audit.auditConclusion && (
        <p className="text-sm text-gray-700 italic border-l-4 border-indigo-200 pl-3">
          {audit.auditConclusion}
        </p>
      )}
    </div>
  );
}

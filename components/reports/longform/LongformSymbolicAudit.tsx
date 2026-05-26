import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";

type Props = { doc: LongformDreamDocument };

export default function LongformSymbolicAudit({ doc }: Props) {
  const audit = doc.symbolic_audit;
  if (!audit) return null;

  const symbols = audit.preserved_symbols ?? [];
  const strengths = audit.doctrine_strengths ?? [];
  const risks = audit.doctrine_risks ?? [];

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
                  {s.current_function}
                </p>
                <p className="text-xs text-indigo-600">
                  <span className="font-medium">Instruction:</span> {s.revision_instruction}
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
            <ul className="space-y-1">
              {strengths.map((s, i) => (
                <li key={i} className="text-xs text-gray-600 flex gap-2">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  {s}
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
            <ul className="space-y-1">
              {risks.map((r, i) => (
                <li key={i} className="text-xs text-gray-600 flex gap-2">
                  <span className="text-rose-400 shrink-0">⚠</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {audit.audit_conclusion && (
        <p className="text-sm text-gray-700 italic border-l-4 border-indigo-200 pl-3">
          {audit.audit_conclusion}
        </p>
      )}
    </div>
  );
}

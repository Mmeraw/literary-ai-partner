import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";

type Props = { doc: LongformDreamDocument };

export default function LongformSymbolPayoffLedger({ doc }: Props) {
  // Symbol-to-character payoff lives in symbolic_audit.preserved_symbols (lifecycle traces)
  // and cross_layer_integration (symbol/motif entries).
  const symbols = doc.symbolic_audit?.preserved_symbols ?? [];
  const symbolMotifs = (doc.cross_layer_integration ?? []).filter((m) =>
    /symbol|motif|object|artifact|charm|icon|token|recurring/i.test(
      m.motif + " " + m.description
    )
  );
  const auditConclusion = doc.symbolic_audit?.audit_conclusion;

  const hasData = symbols.length > 0 || symbolMotifs.length > 0 || auditConclusion;

  if (!hasData) return null;

  return (
    <div className="space-y-5">
      {/* Symbol lifecycle traces */}
      {symbols.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Symbol lifecycle — appearance → transfer → payoff
          </p>
          <div className="space-y-3">
            {symbols.map((s, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-3 text-sm">
                <p className="font-semibold text-gray-800 mb-1">{s.symbol}</p>
                <p className="text-xs text-gray-600 mb-2">
                  <span className="font-medium text-gray-700">Current function:</span>{" "}
                  {s.current_function}
                </p>
                <p className="text-xs text-indigo-600 border-l-2 border-indigo-200 pl-2">
                  <span className="font-medium">Revision instruction:</span>{" "}
                  {s.revision_instruction}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Symbol motifs from cross-layer integration */}
      {symbolMotifs.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Symbol &amp; motif integration
          </p>
          <div className="space-y-2">
            {symbolMotifs.map((m, i) => {
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

      {/* Audit conclusion */}
      {auditConclusion && (
        <p className="text-sm text-gray-700 italic border-l-4 border-indigo-200 pl-3">
          {auditConclusion}
        </p>
      )}
    </div>
  );
}

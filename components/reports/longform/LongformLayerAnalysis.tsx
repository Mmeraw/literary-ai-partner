import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";

type Props = { doc: LongformDreamDocument };

const STATUS_DOT: Record<string, string> = {
  strong: "bg-emerald-400",
  moderate: "bg-amber-400",
  weak: "bg-orange-400",
  fragile: "bg-rose-400",
};

export default function LongformLayerAnalysis({ doc }: Props) {
  const layers = doc.layer_analyses ?? [];
  const crossLayer = doc.cross_layer_integration ?? [];
  if (layers.length === 0 && crossLayer.length === 0) return null;

  return (
    <div className="space-y-6">
      {layers.length > 0 && (
        <div className="space-y-2">
          {layers.map((layer, i) => {
            const dot = STATUS_DOT[layer.status] ?? "bg-gray-300";
            return (
              <div key={i} className="rounded-lg border border-gray-200 p-3 flex gap-3">
                <div className="mt-1.5 shrink-0">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${dot}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{layer.layer_name}</p>
                  <p className="text-xs text-gray-500 capitalize mb-1">{layer.status}</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{layer.needed_revision}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {crossLayer.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Cross-layer integration
          </p>
          <div className="space-y-2">
            {crossLayer.map((row, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-3 text-sm">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-medium text-gray-800">{row.motif}</span>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium border ${
                      row.integration_quality === "strong"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : row.integration_quality === "moderate"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                  >
                    {row.integration_quality}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-1">{row.description}</p>
                {row.revision_note && (
                  <p className="text-xs text-indigo-600 italic">{row.revision_note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

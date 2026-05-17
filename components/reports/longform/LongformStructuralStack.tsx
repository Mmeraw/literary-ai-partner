import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";

type Props = { doc: LongformDreamDocument };

const STATUS_STYLES: Record<string, string> = {
  strong: "bg-emerald-100 text-emerald-700 border-emerald-200",
  moderate: "bg-amber-100 text-amber-700 border-amber-200",
  weak: "bg-orange-100 text-orange-700 border-orange-200",
  fragile: "bg-rose-100 text-rose-700 border-rose-200",
};

export default function LongformStructuralStack({ doc }: Props) {
  const stack = doc.structural_stack ?? [];
  const antiPatterns = doc.what_not_to_become ?? [];
  if (stack.length === 0 && antiPatterns.length === 0) return null;

  return (
    <div className="space-y-5">
      {stack.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 pr-4 font-semibold text-gray-600 w-44">Layer</th>
                <th className="text-left py-2 pr-4 font-semibold text-gray-600 w-24">Status</th>
                <th className="text-left py-2 pr-4 font-semibold text-gray-600">Function</th>
                <th className="text-left py-2 font-semibold text-gray-600">Revision note</th>
              </tr>
            </thead>
            <tbody>
              {stack.map((layer, i) => {
                const badgeClass =
                  STATUS_STYLES[layer.status] ?? "bg-gray-100 text-gray-600 border-gray-200";
                return (
                  <tr key={i} className="border-b border-gray-100 align-top">
                    <td className="py-2.5 pr-4 font-medium text-gray-800">{layer.layer_name}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${badgeClass}`}>
                        {layer.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 text-xs leading-relaxed">{layer.function}</td>
                    <td className="py-2.5 text-gray-600 text-xs leading-relaxed">{layer.revision_note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {antiPatterns.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            What this manuscript must not become
          </p>
          <ul className="space-y-1.5">
            {antiPatterns.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="mt-0.5 shrink-0 text-rose-400">✗</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

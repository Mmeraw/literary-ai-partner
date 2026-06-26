import type { LongFormMultiLayerEvaluationViewModel } from "@/lib/evaluation/evaluationReportViewModel";

type Props = { vm: LongFormMultiLayerEvaluationViewModel };

export default function LongformArcMap({ vm }: Props) {
  const arcs = vm.arcMap ?? [];
  if (arcs.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 pr-4 font-semibold text-gray-600 w-36">Act</th>
            <th className="text-left py-2 pr-4 font-semibold text-gray-600 w-28">Chapters</th>
            <th className="text-left py-2 pr-4 font-semibold text-gray-600">Primary function</th>
            <th className="text-left py-2 font-semibold text-gray-600">Revision priority</th>
          </tr>
        </thead>
        <tbody>
          {arcs.map((arc, i) => (
            <tr key={i} className="border-b border-gray-100 align-top">
              <td className="py-2.5 pr-4 font-medium text-gray-800">{arc.actName}</td>
              <td className="py-2.5 pr-4 font-mono text-xs text-gray-500">{arc.chapterRange}</td>
              <td className="py-2.5 pr-4 text-gray-600 text-xs leading-relaxed">{arc.primaryFunction}</td>
              <td className="py-2.5 text-gray-600 text-xs leading-relaxed">{arc.revisionPriority}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

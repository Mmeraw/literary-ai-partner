import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";

type Props = { doc: LongformDreamDocument };

export default function LongformArcMap({ doc }: Props) {
  const arcs = doc.arc_map ?? [];
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
              <td className="py-2.5 pr-4 font-medium text-gray-800">{arc.act_name}</td>
              <td className="py-2.5 pr-4 font-mono text-xs text-gray-500">{arc.chapter_range}</td>
              <td className="py-2.5 pr-4 text-gray-600 text-xs leading-relaxed">{arc.primary_function}</td>
              <td className="py-2.5 text-gray-600 text-xs leading-relaxed">{arc.revision_priority}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

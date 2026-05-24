import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";

type Props = { doc: LongformDreamDocument };

const VERDICT_STYLES: Record<string, string> = {
  Ready: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Near-ready": "bg-teal-100 text-teal-700 border-teal-200",
  Revise: "bg-amber-100 text-amber-700 border-amber-200",
  "Must fix": "bg-rose-100 text-rose-700 border-rose-200",
};

export default function LongformReleasability({ doc }: Props) {
  const rows = doc.releasability ?? [];
  const checks = doc.acceptance_checks;
  const integrity = doc.manuscript_integrity_issues ?? [];

  if (rows.length === 0 && !checks && integrity.length === 0) return null;

  return (
    <div className="space-y-5">
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 pr-4 font-semibold text-gray-600 w-44">Dimension</th>
                <th className="text-left py-2 pr-4 font-semibold text-gray-600">Current status</th>
                <th className="text-left py-2 font-semibold text-gray-600 w-28">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const verdictClass =
                  VERDICT_STYLES[row.verdict] ?? "bg-gray-100 text-gray-600 border-gray-200";
                return (
                  <tr key={i} className="border-b border-gray-100 align-top">
                    <td className="py-2.5 pr-4 font-medium text-gray-800">{row.dimension}</td>
                    <td className="py-2.5 pr-4 text-gray-600 text-xs leading-relaxed">
                      {row.current_status}
                    </td>
                    <td className="py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${verdictClass}`}>
                        {row.verdict}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {checks && (
        <div className="grid sm:grid-cols-2 gap-4">
          {(checks.required_detection?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
                Required detection
              </p>
              <ul className="space-y-1">
                {checks.required_detection.map((item, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-2">
                    <span className="text-emerald-400 shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(checks.failure_conditions?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
                Failure conditions
              </p>
              <ul className="space-y-1">
                {checks.failure_conditions.map((item, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-2">
                    <span className="text-rose-400 shrink-0">✗</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {integrity.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-500 mb-2">
            Manuscript integrity issues
          </p>
          <div className="space-y-2">
            {integrity.map((issue, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 text-xs ${
                  issue.severity === "blocking"
                    ? "border-rose-300 bg-rose-50"
                    : issue.severity === "major"
                      ? "border-amber-300 bg-amber-50"
                      : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-700 capitalize">{issue.kind}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      issue.severity === "blocking"
                        ? "bg-rose-200 text-rose-700"
                        : issue.severity === "major"
                          ? "bg-amber-200 text-amber-700"
                          : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {issue.severity}
                  </span>
                </div>
                <p className="text-gray-600 leading-relaxed">{issue.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

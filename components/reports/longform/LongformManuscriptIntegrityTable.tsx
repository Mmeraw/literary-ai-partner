import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";

type Props = { doc: LongformDreamDocument };

const SEVERITY_COLORS: Record<string, { badge: string; border: string }> = {
  blocking: {
    badge: "bg-red-100 text-red-800 border-red-300",
    border: "border-l-red-500",
  },
  major: {
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    border: "border-l-amber-500",
  },
  minor: {
    badge: "bg-gray-100 text-gray-700 border-gray-300",
    border: "border-l-gray-400",
  },
};

const KIND_LABELS: Record<string, string> = {
  confirmed_defect: "Confirmed defect",
  likely_defect: "Likely defect",
  artifact_suspected: "Artifact suspected",
  intentional_motif_suspected: "Intentional motif?",
  title_package_hygiene: "Title / package hygiene",
  anchor_toc_issue: "Anchor / TOC issue",
  needs_manual_verification: "Needs verification",
};

export default function LongformManuscriptIntegrityTable({ doc }: Props) {
  const issues = doc.manuscript_integrity_issues ?? [];

  // Also pull releasability rows that relate to integrity/confidence
  const integrityReleasability = (doc.releasability ?? []).filter((r) =>
    /integrit|confidence|publication|defect|hygiene|toc|anchor|duplic/i.test(
      r.dimension + " " + r.current_status
    )
  );

  if (issues.length === 0 && integrityReleasability.length === 0) {
    return (
      <p className="text-sm text-gray-700 italic">
        No manuscript integrity issues detected.
      </p>
    );
  }

  const blocking = issues.filter((i) => i.severity === "blocking");
  const major = issues.filter((i) => i.severity === "major");
  const minor = issues.filter((i) => i.severity === "minor");

  return (
    <div className="space-y-5">
      {/* Summary counts */}
      {issues.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {blocking.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 border border-red-300 px-3 py-1 text-xs font-semibold">
              {blocking.length} Blocking
            </span>
          )}
          {major.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1 text-xs font-semibold">
              {major.length} Major
            </span>
          )}
          {minor.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 border border-gray-300 px-3 py-1 text-xs font-semibold">
              {minor.length} Minor
            </span>
          )}
        </div>
      )}

      {/* Issue rows sorted blocking → major → minor */}
      {issues.length > 0 && (
        <div className="space-y-2">
          {[...blocking, ...major, ...minor].map((issue, i) => {
            const colors =
              SEVERITY_COLORS[issue.severity] ?? SEVERITY_COLORS.minor;
            const kindLabel =
              KIND_LABELS[issue.kind] ?? issue.kind.replace(/_/g, " ");
            return (
              <div
                key={i}
                className={`rounded-lg border border-gray-200 border-l-4 ${colors.border} p-3 text-sm`}
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${colors.badge}`}
                  >
                    {issue.severity}
                  </span>
                  <span className="text-xs text-gray-700 font-medium">{kindLabel}</span>
                </div>
                <p className="text-gray-700">{issue.description}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Integrity-related releasability dimensions */}
      {integrityReleasability.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Releasability — integrity &amp; confidence
          </p>
          <div className="space-y-2">
            {integrityReleasability.map((r, i) => {
              const verdictColor =
                r.verdict === "Ready"
                  ? "text-emerald-700"
                  : r.verdict === "Must fix"
                  ? "text-red-700"
                  : r.verdict === "Revise"
                  ? "text-amber-700"
                  : "text-indigo-700";
              return (
                <div key={i} className="rounded border border-gray-200 p-3 text-sm">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-medium text-gray-800">{r.dimension}</p>
                    <span className={`text-xs font-semibold ${verdictColor}`}>
                      {r.verdict}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{r.current_status}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

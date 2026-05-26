import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";

type Props = { doc: LongformDreamDocument };

const SCORE_DIMS = [
  { key: "quality", label: "Quality" },
  { key: "readiness", label: "Readiness" },
  { key: "commercial", label: "Commercial" },
  { key: "literary", label: "Literary" },
] as const;

// Known labeled sections the model writes in the verdict prose
const VERDICT_LABELS = [
  "Governing ambition",
  "Primary emotional engine",
  "Strongest achievement",
  "Dominant differentiator",
  "Pressure point",
  "Release recommendation",
];

/**
 * Executive Verdict score-color thresholds intentionally mirror the report's
 * confidence guide so readers see one consistent meaning across the page:
 *   Low      < 60  → red
 *   Moderate 60–84 → dark amber
 *   High     ≥ 85  → dark green
 */
function scoreColor(n: number): string {
  if (n >= 85) return "text-emerald-700";
  if (n >= 60) return "text-amber-700";
  return "text-red-700";
}

/**
 * Split the verdict prose into labeled segments when the model
 * uses "Label: text" formatting. Falls back to plain paragraph
 * if no known labels are found.
 */
function parseVerdictSegments(
  text: string
): Array<{ label: string | null; body: string }> {
  // Build a regex that matches any known label (with optional plural s/s:)
  // at the start of a segment, e.g. "Governing ambition:", "Pressure points:"
  const labelPattern = VERDICT_LABELS.map((l) =>
    l.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
  ).join("|");
  const re = new RegExp(`(${labelPattern})s?:`, "gi");

  const segments: Array<{ label: string | null; body: string }> = [];
  let lastIndex = 0;
  let lastLabel: string | null = null;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index).trim();
    if (before) {
      segments.push({ label: lastLabel, body: before });
    }
    lastLabel = match[1];
    lastIndex = match.index + match[0].length;
  }

  // Remainder
  const remaining = text.slice(lastIndex).trim();
  if (remaining) {
    segments.push({ label: lastLabel, body: remaining });
  }

  // If nothing was split (no labels found), return as single plain block
  if (segments.length === 0) {
    return [{ label: null, body: text.trim() }];
  }

  return segments;
}

export default function LongformExecutiveVerdict({ doc }: Props) {
  const segments = doc.executive_verdict
    ? parseVerdictSegments(doc.executive_verdict)
    : [];

  return (
    <div className="space-y-5">
      {/* DREAM subscores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SCORE_DIMS.map(({ key, label }) => {
          const val = doc.dream_scores?.[key];
          const display = typeof val === "number" ? val : "—";
          return (
            <div
              key={key}
              className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-center"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 mb-1">
                {label}
              </p>
              <p
                className={`text-3xl font-bold ${typeof val === "number" ? scoreColor(val) : "text-gray-400"}`}
              >
                {display}
              </p>
              <p className="text-xs text-indigo-400 mt-0.5">/100</p>
            </div>
          );
        })}
      </div>

      {/* Executive verdict prose */}
      {segments.length > 0 && (
        <div className="space-y-3 text-gray-700 leading-relaxed text-[15px]">
          {segments.map((segment, idx) => (
            <p key={idx}>
              {segment.label && (
                <span className="font-semibold text-gray-900">
                  {segment.label}: {" "}
                </span>
              )}
              <span>{segment.body}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

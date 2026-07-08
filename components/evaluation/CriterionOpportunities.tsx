"use client";

import { useState } from "react";
import { mistakeProofText, safeEvidenceQuote } from "@/lib/evaluation/reportRenderSafety";
import { normalizeRecommendationActionForDisplay } from "@/lib/evaluation/reportRecommendations";

type Recommendation = {
  action: string;
  priority?: "high" | "medium" | "low";
  expected_impact?: string;
  anchor_snippet?: string;
  mechanism?: string;
  specific_fix?: string;
  reader_effect?: string;
  symptom?: string;
  mistake_proofing?: string;
  issue_family?: string;
  strategic_lever?: string;
  revision_granularity?: string;
};

function severityLabel(priority?: string): string {
  if (priority === "high") return "Recommended";
  if (priority === "medium") return "Optional";
  return "Consider";
}

function severityClasses(priority?: string): string {
  if (priority === "high") return "bg-red-100 text-red-700";
  if (priority === "medium") return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-600";
}

function normalizeAction(action: string): string {
  return mistakeProofText(normalizeRecommendationActionForDisplay(action));
}

function hasExpandableDetails(r: Recommendation): boolean {
  return Boolean(r.mechanism || r.reader_effect || r.mistake_proofing || r.expected_impact);
}

function OpportunityCard({ r, index, defaultExpanded }: { r: Recommendation; index: number; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const showExpander = hasExpandableDetails(r);
  const detailClass = expanded ? "block" : "hidden print:block";

  return (
    <li className="rounded-md border border-gray-200 bg-gray-50/50 p-3 text-sm text-gray-700 print:break-inside-avoid">
      <div className="min-w-0">
        {r.priority && (
          <span className={`mb-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityClasses(r.priority)}`}>
            {severityLabel(r.priority)} #{index}
          </span>
        )}
        {r.anchor_snippet && (
          <p className="mb-2 border-l-2 border-gray-300 pl-2 text-xs italic text-gray-500">
            {"\u201c"}{safeEvidenceQuote(r.anchor_snippet)}{"\u201d"}
          </p>
        )}
        {r.symptom && (
          <p className="mt-1 text-xs text-gray-600">
            <span className="font-semibold text-gray-500 cursor-help" style={{ borderBottom: '1px dotted #9ca3af' }} title="What the reader experiences — the visible effect of the underlying craft issue.">Symptom:</span> {mistakeProofText(r.symptom)}
          </p>
        )}
        {r.specific_fix ? (
          <p className="mt-1.5 text-xs text-gray-600">
            <span className="font-semibold text-gray-500 cursor-help" style={{ borderBottom: '1px dotted #9ca3af' }} title="A concrete editorial action the author can take — not a rewrite, but a direction.">Fix direction:</span> {mistakeProofText(r.specific_fix)}
          </p>
        ) : (
          <p className="mt-1.5 font-medium">{normalizeAction(r.action)}</p>
        )}
      </div>
      {showExpander && (
        <div className={`${detailClass} mt-2 space-y-1 border-t border-gray-100 pt-2`}>
          {r.mechanism && (
            <p className="text-xs text-gray-600">
              <span className="font-semibold text-gray-500 cursor-help" style={{ borderBottom: '1px dotted #9ca3af' }} title="The underlying craft mechanism producing the symptom — why it happens.">Cause:</span> {mistakeProofText(r.mechanism)}
            </p>
          )}
          {r.reader_effect && (
            <p className="text-xs text-gray-600">
              <span className="font-semibold text-gray-500 cursor-help" style={{ borderBottom: '1px dotted #9ca3af' }} title="How a reader is likely to experience this issue — emotional, cognitive, or trust impact.">Reader effect:</span> {mistakeProofText(r.reader_effect)}
            </p>
          )}
          {r.expected_impact && !r.reader_effect && (
            <p className="text-xs italic text-gray-500">{r.expected_impact}</p>
          )}
          {r.mistake_proofing && (
            <p className="text-xs text-gray-600">
              <span className="font-semibold text-gray-500 cursor-help" style={{ borderBottom: '1px dotted #9ca3af' }} title="A guardrail or check the author can use during revision to prevent reintroducing this issue.">Mistake-proofing:</span> {mistakeProofText(r.mistake_proofing)}
            </p>
          )}
        </div>
      )}
      {showExpander && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 text-[11px] text-gray-400 transition-colors hover:text-gray-600 print:hidden"
        >
          {expanded ? "Hide details" : "Show cause, reader effect, mistake-proofing"}
        </button>
      )}
    </li>
  );
}

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function sortBySeverity(recs: Recommendation[]): Recommendation[] {
  return [...recs].sort((a, b) => {
    const aOrder = SEVERITY_ORDER[a.priority ?? 'low'] ?? 2;
    const bOrder = SEVERITY_ORDER[b.priority ?? 'low'] ?? 2;
    return aOrder - bOrder;
  });
}

export default function CriterionOpportunities({ recommendations }: { recommendations: Recommendation[] }) {
  const [showMore, setShowMore] = useState(false);
  if (!recommendations || recommendations.length === 0) return null;

  const sorted = sortBySeverity(recommendations);
  const visible = sorted.slice(0, 3);
  const primary = visible[0];
  const additional = visible.slice(1);
  const hasMore = additional.length > 0;

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
        {visible.length === 1 ? "Highest-Priority Opportunity:" : `Top Opportunities (${visible.length} surfaced, severity-ordered):`}
      </p>
      <ul className="mt-2 list-none space-y-3 pl-0">
        <OpportunityCard r={primary} index={1} defaultExpanded />
        {hasMore && additional.map((r, ri) => (
          <div key={ri} className={showMore ? "block" : "hidden print:block"}>
            <OpportunityCard r={r} index={ri + 2} defaultExpanded={false} />
          </div>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          className="mt-2 text-xs font-medium text-[#7A2B1A] transition-colors hover:text-[#5C1F12] print:hidden"
        >
          {showMore ? "Hide additional opportunities" : `Show ${additional.length} more opportunit${additional.length === 1 ? "y" : "ies"}`}
        </button>
      )}
    </div>
  );
}

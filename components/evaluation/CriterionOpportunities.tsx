"use client";

import { useState } from "react";

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
  if (priority === "high") return "Must";
  if (priority === "medium") return "Should";
  return "Could";
}

function severityClasses(priority?: string): string {
  if (priority === "high") return "bg-red-100 text-red-700";
  if (priority === "medium") return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-600";
}

function normalizeAction(action: string): string {
  let result = action.trim();
  const familyPrefixPattern = /^\s*[•*\-]?\s*(quick win|strategic revision)\s*:\s*/i;
  while (familyPrefixPattern.test(result)) {
    result = result.replace(familyPrefixPattern, "");
  }
  return result
    .replace(/^in the anchored moment\s+"[^"]+",\s*/i, "")
    .replace(/^at the passage beginning\s+"[^"]+",\s*/i, "")
    .replace(/^in the closing beat beginning\s+"[^"]+",\s*/i, "")
    .replace(/^starting from\s+"[^"]+",\s*/i, "")
    .replace(/^at the line\s+"[^"]+",\s*/i, "")
    .replace(/\band\s+a\s+because\b/gi, "because")
    .trim();
}

function hasExpandableDetails(r: Recommendation): boolean {
  return Boolean(r.mechanism || r.reader_effect || r.mistake_proofing || r.expected_impact);
}

function OpportunityCard({ r, defaultExpanded }: { r: Recommendation; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const showExpander = hasExpandableDetails(r);
  const detailClass = expanded ? "block" : "hidden print:block";

  return (
    <li className="rounded-md border border-gray-200 bg-gray-50/50 p-3 text-sm text-gray-700 print:break-inside-avoid">
      <div className="min-w-0">
        {r.priority && (
          <span className={`mb-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityClasses(r.priority)}`}>
            {severityLabel(r.priority)}
          </span>
        )}
        {r.anchor_snippet && (
          <p className="mb-2 border-l-2 border-gray-300 pl-2 text-xs italic text-gray-500">
            {"\u201c"}{r.anchor_snippet}{"\u201d"}
          </p>
        )}
        {r.symptom && (
          <p className="mt-1 text-xs text-gray-600">
            <span className="font-semibold text-gray-500">Symptom:</span> {r.symptom}
          </p>
        )}
        {r.specific_fix ? (
          <p className="mt-1.5 text-xs text-gray-600">
            <span className="font-semibold text-gray-500">Fix direction:</span> {r.specific_fix}
          </p>
        ) : (
          <p className="mt-1.5 font-medium">{normalizeAction(r.action)}</p>
        )}
      </div>
      {showExpander && (
        <div className={`${detailClass} mt-2 space-y-1 border-t border-gray-100 pt-2`}>
          {r.mechanism && (
            <p className="text-xs text-gray-600">
              <span className="font-semibold text-gray-500">Cause:</span> {r.mechanism}
            </p>
          )}
          {r.reader_effect && (
            <p className="text-xs text-gray-600">
              <span className="font-semibold text-gray-500">Reader effect:</span> {r.reader_effect}
            </p>
          )}
          {r.expected_impact && !r.reader_effect && (
            <p className="text-xs italic text-gray-500">{r.expected_impact}</p>
          )}
          {r.mistake_proofing && (
            <p className="text-xs text-gray-600">
              <span className="font-semibold text-gray-500">Mistake-proofing:</span> {r.mistake_proofing}
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

export default function CriterionOpportunities({ recommendations }: { recommendations: Recommendation[] }) {
  const [showMore, setShowMore] = useState(false);
  if (!recommendations || recommendations.length === 0) return null;

  const visible = recommendations.slice(0, 3);
  const primary = visible[0];
  const additional = visible.slice(1);
  const hasMore = additional.length > 0;

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
        {visible.length === 1 ? "Primary Opportunity:" : `Primary Opportunity (${visible.length} surfaced):`}
      </p>
      <ul className="mt-2 space-y-3">
        <OpportunityCard r={primary} defaultExpanded />
        {hasMore && additional.map((r, ri) => (
          <div key={ri} className={showMore ? "block" : "hidden print:block"}>
            <OpportunityCard r={r} defaultExpanded={false} />
          </div>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          className="mt-2 text-xs font-medium text-blue-600 transition-colors hover:text-blue-800 print:hidden"
        >
          {showMore ? "Hide additional opportunities" : `Show ${additional.length} more opportunit${additional.length === 1 ? "y" : "ies"}`}
        </button>
      )}
    </div>
  );
}

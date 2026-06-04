"use client";
import { useState } from "react";

type Opportunity = {
  priority?: string;
  anchor_snippet?: string;
  symptom?: string;
  mechanism?: string;
  specific_fix?: string;
  reader_effect?: string;
  mistake_proofing?: string;
};

function severityLabel(priority?: string): string {
  if (priority === "high") return "MUST";
  if (priority === "medium") return "SHOULD";
  return "COULD";
}

function severityColor(priority?: string): string {
  if (priority === "high") return "text-red-700 bg-red-50 border-red-200";
  if (priority === "medium") return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-blue-700 bg-blue-50 border-blue-200";
}

function OpportunityCard({ opp, idx }: { opp: Opportunity; idx: number }) {
  const label = severityLabel(opp.priority);
  const color = severityColor(opp.priority);
  const rows: [string, string][] = [];
  if (opp.anchor_snippet) rows.push(["Evidence", opp.anchor_snippet]);
  if (opp.symptom) rows.push(["Symptom", opp.symptom]);
  if (opp.mechanism) rows.push(["Cause", opp.mechanism]);
  if (opp.specific_fix) rows.push(["Fix direction", opp.specific_fix]);
  if (opp.reader_effect) rows.push(["Reader effect", opp.reader_effect]);
  if (opp.mistake_proofing) rows.push(["Mistake-proofing", opp.mistake_proofing]);

  return (
    <div className={`rounded border p-3 ${color}`}>
      <p className="text-xs font-bold mb-1.5">
        {label} #{idx + 1}
      </p>
      <div className="space-y-1">
        {rows.map(([k, v]) => (
          <p key={k} className="text-xs leading-relaxed">
            <span className="font-semibold">{k}:</span>{" "}
            {k === "Evidence" ? <em>&ldquo;{v}&rdquo;</em> : v}
          </p>
        ))}
      </div>
    </div>
  );
}

type Props = {
  recommendations: Opportunity[];
};

export default function CriterionOpportunities({ recommendations }: Props) {
  const sorted = [...recommendations]
    .sort((a, b) => {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (order[a.priority ?? "low"] ?? 2) - (order[b.priority ?? "low"] ?? 2);
    })
    .slice(0, 3);

  const [expanded, setExpanded] = useState(false);

  if (sorted.length === 0) return null;

  const visible = expanded ? sorted : sorted.slice(0, 1);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
          Opportunities ({sorted.length})
        </p>
        {sorted.length > 1 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {expanded ? "Show less" : `Show all ${sorted.length}`}
          </button>
        )}
      </div>
      {visible.map((opp, i) => (
        <OpportunityCard key={i} opp={opp} idx={i} />
      ))}
    </div>
  );
}

"use client";
import { useState } from "react";

type Opportunity = {
  opportunity_id?: string;
  priority?: string;
  anchor_snippet?: string;
  anchor_type?: 'verbatim_quote' | 'paraphrased_observation' | 'editorial_diagnosis';
  symptom?: string;
  mechanism?: string;
  specific_fix?: string;
  reader_effect?: string;
  mistake_proofing?: string;
  collapsed_from_criteria?: string[];
};

function severityLabel(priority?: string): string {
  if (priority === "high") return "LEDGER PRIORITY";
  if (priority === "medium") return "LEDGER OPTION";
  return "LEDGER NOTE";
}

function severityAccent(priority?: string): string {
  if (priority === "high") return "border-l-[#8B2E2E]";
  if (priority === "medium") return "border-l-[#C8A96E]";
  return "border-l-[#D9D0C3]";
}

function severityLabelColor(priority?: string): string {
  if (priority === "high") return "text-[#8B2E2E]";
  if (priority === "medium") return "text-[#B8922A]";
  return "text-[#5C5549]";
}

function OpportunityCard({ opp, idx }: { opp: Opportunity; idx: number }) {
  const label = severityLabel(opp.priority);
  const accent = severityAccent(opp.priority);
  const labelColor = severityLabelColor(opp.priority);
  const rows: [string, string, boolean][] = [];
  if (opp.anchor_snippet) {
    const anchorLabel = opp.anchor_type === 'paraphrased_observation' ? 'Observation' : opp.anchor_type === 'editorial_diagnosis' ? 'Diagnostic Basis' : 'Evidence';
    const isQuote = opp.anchor_type !== 'editorial_diagnosis';
    rows.push([anchorLabel, opp.anchor_snippet, isQuote]);
  }
  if (opp.symptom) rows.push(["Symptom", opp.symptom, false]);
  if (opp.mechanism) rows.push(["Cause", opp.mechanism, false]);
  if (opp.specific_fix) rows.push(["Fix direction", opp.specific_fix, false]);
  if (opp.reader_effect) rows.push(["Reader effect", opp.reader_effect, false]);
  if (opp.mistake_proofing) rows.push(["Mistake-proofing", opp.mistake_proofing, false]);
  if (opp.collapsed_from_criteria && opp.collapsed_from_criteria.length > 0) {
    rows.push(["Also affects", opp.collapsed_from_criteria.map(k => k.replace(/([A-Z])/g, ' $1').trim()).join(", "), false]);
  }

  return (
    <div className={`border border-[#D9D0C3] border-l-4 ${accent} bg-white`}>
      <div className={`px-3 py-1.5 border-b border-[#E6DED2] ${labelColor}`}>
        <span className="text-[10px] font-bold uppercase tracking-wider">
          {label} {opp.opportunity_id ? `· ${opp.opportunity_id}` : `#${idx + 1}`}
        </span>
      </div>
      <div className="divide-y divide-[#EDE7DE]">
        {rows.map(([k, v, isQuote]) => (
          <div key={k} className="flex gap-3 px-3 py-2 text-xs">
            <span className="w-28 shrink-0 font-semibold uppercase tracking-wide text-[#5C5549]">{k}</span>
            <span className="text-[#1C1814] leading-relaxed">
              {isQuote ? <>&ldquo;{v}&rdquo;</> : v}
            </span>
          </div>
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
    .slice(0, 1);

  const [expanded, setExpanded] = useState(false);

  if (sorted.length === 0) return null;

  const visible = expanded ? sorted : sorted.slice(0, 1);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8B2E2E]">
          Ledger Opportunity
        </p>
        {sorted.length > 1 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-[#8B2E2E] hover:text-[#6F1D1B] font-medium"
          >
            {expanded ? "Show less" : `Show all ${sorted.length}`}
          </button>
        )}
      </div>
      {visible.map((opp, i) => (
        <OpportunityCard key={opp.opportunity_id ?? i} opp={opp} idx={i} />
      ))}
    </div>
  );
}

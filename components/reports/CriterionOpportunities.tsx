"use client";

import { useState } from "react";
import type { PresentedOpportunity, PresentedOpportunitySection } from "@/lib/evaluation/presentation/reportPresentation";
import { OPPORTUNITY_PRIORITY_LABELS } from "@/lib/evaluation/presentation/reportDesignSystem";

type Props = {
  presentedOpportunities: PresentedOpportunity[];
};

function priorityClass(priority: PresentedOpportunity["priority"]): string {
  switch (priority) {
    case "high":
      return "border-l-[#8B2E2E]";
    case "medium":
      return "border-l-[#C8A96E]";
    case "low":
      return "border-l-[#D9D0C3]";
    case "unknown":
    default:
      return "border-l-[#9A9087]";
  }
}

function priorityTextClass(priority: PresentedOpportunity["priority"]): string {
  switch (priority) {
    case "high":
      return "text-[#8B2E2E]";
    case "medium":
      return "text-[#B8922A]";
    case "low":
      return "text-[#5C5549]";
    case "unknown":
    default:
      return "text-[#9A9087]";
  }
}

function SectionValue({ section }: { section: PresentedOpportunitySection }) {
  if (section.items && section.items.length > 0) {
    return (
      <ul className="list-disc pl-4 text-[#1C1814] leading-relaxed [overflow-wrap:anywhere]">
        {section.items.map((item, i) => (
          <li key={`${item.slice(0, 24)}-${i}`}>{item}</li>
        ))}
      </ul>
    );
  }

  const isQuote = section.role === "quotation";
  const value = isQuote ? `\u201c${section.text}\u201d` : section.text;

  return (
    <span className="text-[#1C1814] leading-relaxed [overflow-wrap:anywhere]">
      {value}
    </span>
  );
}

function SectionRow({ section }: { section: PresentedOpportunitySection }) {
  return (
    <div className="grid grid-cols-1 gap-1.5 px-3 py-2.5 text-xs sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3">
      <span className="font-semibold uppercase tracking-wide text-[#5C5549]">
        {section.label}
      </span>
      <SectionValue section={section} />
    </div>
  );
}

function OpportunityCard({ opp, idx }: { opp: PresentedOpportunity; idx: number }) {
  const priorityLabel = OPPORTUNITY_PRIORITY_LABELS[opp.priority] ?? OPPORTUNITY_PRIORITY_LABELS.unknown;

  return (
    <div className={`overflow-hidden rounded-sm border border-[#D9D0C3] border-l-4 ${priorityClass(opp.priority)} bg-white shadow-[0_1px_0_rgba(28,24,20,0.03)]`}>
      <div className={`px-3 py-2 border-b border-[#E6DED2] bg-[#FAF7F2] ${priorityTextClass(opp.priority)}`}>
        <span className="text-[10px] font-bold uppercase tracking-wider">
          {priorityLabel} #{idx + 1}
        </span>
      </div>
      <div className="divide-y divide-[#EDE7DE]">
        {opp.sections.map((section) => (
          <SectionRow key={section.key} section={section} />
        ))}
      </div>
    </div>
  );
}

export default function CriterionOpportunities({ presentedOpportunities }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (presentedOpportunities.length === 0) return null;

  const visible = expanded ? presentedOpportunities : presentedOpportunities.slice(0, 1);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8B2E2E]">
          Revision Opportunities
        </p>
        {presentedOpportunities.length > 1 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-[#8B2E2E] hover:text-[#6F1D1B] font-medium"
          >
            {expanded ? "Show less" : `Show all ${presentedOpportunities.length}`}
          </button>
        )}
      </div>
      {visible.map((opp, i) => (
        <OpportunityCard key={opp.id ?? i} opp={opp} idx={i} />
      ))}
    </div>
  );
}

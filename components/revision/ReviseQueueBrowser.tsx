"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  WorkbenchOpportunity,
  WorkbenchQueuePayload,
  WorkbenchSeverity,
  WorkbenchScope,
} from "@/lib/revision/workbenchQueue";
import { getReviseQueueLedgerColumnLabel } from "@/lib/revision/reviseQueueLedgerContract";
import ResetQueueButton from "@/components/revision/ResetQueueButton";

type FilterState = {
  severity: WorkbenchSeverity | "all";
  scope: WorkbenchScope | "all";
  criterion: string;
  search: string;
};

const SEVERITY_COLORS: Record<WorkbenchSeverity, string> = {
  must: "bg-red-900/60 text-red-300 border-red-700/50",
  should: "bg-amber-900/50 text-amber-300 border-amber-700/50",
  could: "bg-emerald-900/50 text-emerald-300 border-emerald-700/50",
};

const SEVERITY_LABELS: Record<WorkbenchSeverity, string> = {
  must: "Recommended",
  should: "Optional",
  could: "Consider",
};

const SCOPE_ORDER: WorkbenchScope[] = [
  "Line",
  "Passage",
  "Scene",
  "Chapter",
  "Structural",
  "Manuscript",
];

function Badge({
  label,
  count,
  active,
  onClick,
  colorClass,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  colorClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition ${
        active
          ? colorClass ?? "border-[#C8A96E] bg-[#C8A96E]/15 text-[#C8A96E]"
          : "border-[#F3E3C3]/15 text-[#F3E3C3]/50 hover:border-[#F3E3C3]/30 hover:text-[#F3E3C3]/70"
      }`}
    >
      {label}
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-[#C8A96E]/20" : "bg-[#F3E3C3]/8"}`}>
        {count}
      </span>
    </button>
  );
}

function formatCriterion(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function extractChapter(anchor: string): string {
  const match = anchor.match(/chapter\s*(\d+)/i);
  if (match) return `Ch. ${match[1]}`;
  const chMatch = anchor.match(/ch\.?\s*(\d+)/i);
  if (chMatch) return `Ch. ${chMatch[1]}`;
  return "";
}

export default function ReviseQueueBrowser({ payload }: { payload: WorkbenchQueuePayload }) {
  const [filters, setFilters] = useState<FilterState>({
    severity: "all",
    scope: "all",
    criterion: "all",
    search: "",
  });

  const allOpportunities = useMemo(() => {
    return [...payload.opportunities, ...payload.needsTargeting];
  }, [payload.opportunities, payload.needsTargeting]);

  const criteriaList = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const opp of allOpportunities) {
      counts[opp.criterion] = (counts[opp.criterion] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [allOpportunities]);

  const severityCounts = useMemo(() => {
    const counts: Record<WorkbenchSeverity, number> = { must: 0, should: 0, could: 0 };
    for (const opp of allOpportunities) counts[opp.severity] += 1;
    return counts;
  }, [allOpportunities]);

  const scopeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const opp of allOpportunities) counts[opp.scope] = (counts[opp.scope] ?? 0) + 1;
    return counts;
  }, [allOpportunities]);

  const filtered = useMemo(() => {
    return allOpportunities.filter((opp) => {
      if (filters.severity !== "all" && opp.severity !== filters.severity) return false;
      if (filters.scope !== "all" && opp.scope !== filters.scope) return false;
      if (filters.criterion !== "all" && opp.criterion !== filters.criterion) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const haystack = [opp.title, opp.criterion, opp.anchor, opp.symptom, opp.issueStatement]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [allOpportunities, filters]);

  const workbenchHref = payload.manuscriptId && payload.evaluationJobId
    ? `/workbench-v2?manuscriptId=${payload.manuscriptId}&evaluationJobId=${payload.evaluationJobId}`
    : "/workbench-v2";

  if (!payload.ok) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="font-serif text-3xl text-[#C8A96E]">Revise Queue</h1>
        <p className="mt-4 text-[#F3E3C3]/60">{payload.error ?? "No revision data available."}</p>
        <Link href="/evaluate" className="mt-6 inline-block border border-[#C8A96E] px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-[#C8A96E] hover:bg-[#C8A96E]/10">
          Start Evaluation
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#F3E3C3]/10 pb-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C8A96E]">
            Revise Queue
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#F3E3C3]">
            {payload.manuscriptTitle}
          </h1>
          <p className="mt-1 text-xs text-[#F3E3C3]/50">
            {allOpportunities.length} revision {allOpportunities.length === 1 ? "opportunity" : "opportunities"} ·{" "}
            {payload.opportunities.length} ready · {payload.needsTargeting.length} needs targeting
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ResetQueueButton evaluationJobId={payload.evaluationJobId} />
          <Link
            href={workbenchHref}
            className="rounded border border-[#C8A96E] bg-[#C8A96E]/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#C8A96E] transition hover:bg-[#C8A96E]/20"
          >
            Open Workbench
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-5 space-y-3">
        {/* Severity */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#F3E3C3]/40">
            Severity
          </span>
          <Badge
            label="All"
            count={allOpportunities.length}
            active={filters.severity === "all"}
            onClick={() => setFilters((f) => ({ ...f, severity: "all" }))}
          />
          {(["must", "should", "could"] as WorkbenchSeverity[]).map((sev) => (
            <Badge
              key={sev}
              label={SEVERITY_LABELS[sev]}
              count={severityCounts[sev]}
              active={filters.severity === sev}
              onClick={() => setFilters((f) => ({ ...f, severity: f.severity === sev ? "all" : sev }))}
              colorClass={filters.severity === sev ? SEVERITY_COLORS[sev] : undefined}
            />
          ))}
        </div>

        {/* Scope */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#F3E3C3]/40">
            Scope
          </span>
          <Badge
            label="All"
            count={allOpportunities.length}
            active={filters.scope === "all"}
            onClick={() => setFilters((f) => ({ ...f, scope: "all" }))}
          />
          {SCOPE_ORDER.filter((s) => (scopeCounts[s] ?? 0) > 0).map((scope) => (
            <Badge
              key={scope}
              label={scope}
              count={scopeCounts[scope] ?? 0}
              active={filters.scope === scope}
              onClick={() => setFilters((f) => ({ ...f, scope: f.scope === scope ? "all" : scope }))}
            />
          ))}
        </div>

        {/* Criteria */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#F3E3C3]/40">
            Criteria
          </span>
          <Badge
            label="All Criteria"
            count={allOpportunities.length}
            active={filters.criterion === "all"}
            onClick={() => setFilters((f) => ({ ...f, criterion: "all" }))}
          />
          {criteriaList.map(([criterion, count]) => (
            <Badge
              key={criterion}
              label={formatCriterion(criterion)}
              count={count}
              active={filters.criterion === criterion}
              onClick={() => setFilters((f) => ({ ...f, criterion: f.criterion === criterion ? "all" : criterion }))}
            />
          ))}
        </div>

        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Search opportunities..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="w-full max-w-md rounded border border-[#F3E3C3]/15 bg-[#1C160E] px-3 py-2 text-sm text-[#F3E3C3] placeholder-[#F3E3C3]/30 outline-none focus:border-[#C8A96E]/50"
          />
        </div>
      </div>

      {/* Results count */}
      <div className="mt-4 flex items-center justify-between border-b border-[#F3E3C3]/10 pb-2">
        <p className="text-xs text-[#F3E3C3]/40">
          Showing {filtered.length} of {allOpportunities.length}
        </p>
        {(filters.severity !== "all" || filters.scope !== "all" || filters.criterion !== "all" || filters.search) && (
          <button
            onClick={() => setFilters({ severity: "all", scope: "all", criterion: "all", search: "" })}
            className="text-xs text-[#C8A96E] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#F3E3C3]/10 text-[10px] font-bold uppercase tracking-[0.12em] text-[#F3E3C3]/40">
              <th className="px-2 py-2.5 w-8">{getReviseQueueLedgerColumnLabel("index")}</th>
              <th className="px-2 py-2.5 w-16">{getReviseQueueLedgerColumnLabel("severity")}</th>
              <th className="px-2 py-2.5 w-20">{getReviseQueueLedgerColumnLabel("scope")}</th>
              <th className="px-2 py-2.5 w-14">{getReviseQueueLedgerColumnLabel("chapter")}</th>
              <th className="px-2 py-2.5 min-w-[120px]">{getReviseQueueLedgerColumnLabel("criterion")}</th>
              <th className="px-2 py-2.5 min-w-[280px]">{getReviseQueueLedgerColumnLabel("issue")}</th>
              <th className="px-2 py-2.5 w-20">{getReviseQueueLedgerColumnLabel("options")}</th>
              <th className="px-2 py-2.5 w-20">{getReviseQueueLedgerColumnLabel("status")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((opp, i) => (
              <OpportunityRow key={opp.id} opp={opp} index={i + 1} workbenchHref={workbenchHref} />
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center text-sm text-[#F3E3C3]/40">
          No opportunities match the current filters.
        </div>
      )}
    </div>
  );
}

function OpportunityRow({
  opp,
  index,
  workbenchHref,
}: {
  opp: WorkbenchOpportunity;
  index: number;
  workbenchHref: string;
}) {
  const chapter = extractChapter(opp.anchor);
  const optionCount = opp.options.filter((o) => o.candidateText.trim().length > 0).length;

  return (
    <tr className="border-b border-[#F3E3C3]/5 transition hover:bg-[#F3E3C3]/[0.03]">
      <td className="px-2 py-2.5 text-xs text-[#F3E3C3]/30">{index}</td>
      <td className="px-2 py-2.5">
        <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${SEVERITY_COLORS[opp.severity]}`}>
          {SEVERITY_LABELS[opp.severity]}
        </span>
      </td>
      <td className="px-2 py-2.5 text-xs text-[#F3E3C3]/60">{opp.scope}</td>
      <td className="px-2 py-2.5 text-xs text-[#F3E3C3]/60">{chapter || "—"}</td>
      <td className="px-2 py-2.5 text-xs font-medium text-[#C8A96E]">
        {formatCriterion(opp.criterion)}
      </td>
      <td className="px-2 py-2.5">
        <p className="text-xs leading-relaxed text-[#F3E3C3]/80 line-clamp-2">{opp.title}</p>
        {opp.quoteHighlight && opp.quoteHighlight !== "No excerpt available" && (
          <p className="mt-0.5 text-[10px] italic text-[#F3E3C3]/35 line-clamp-1">
            &ldquo;{opp.quoteHighlight}{opp.quoteRest}&rdquo;
          </p>
        )}
      </td>
      <td className="px-2 py-2.5 text-center">
        <span className={`text-xs font-bold ${optionCount > 0 ? "text-emerald-400" : "text-[#F3E3C3]/25"}`}>
          {optionCount > 0 ? `${optionCount} A/B/C` : "—"}
        </span>
      </td>
      <td className="px-2 py-2.5">
        <span
          className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${
            opp.readiness === "ready_for_revise"
              ? "border-emerald-700/50 bg-emerald-900/40 text-emerald-300"
              : "border-amber-700/50 bg-amber-900/40 text-amber-300"
          }`}
        >
          {opp.readiness === "ready_for_revise" ? "Ready" : "Targeting"}
        </span>
      </td>
    </tr>
  );
}

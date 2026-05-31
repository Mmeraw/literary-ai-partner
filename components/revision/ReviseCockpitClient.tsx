"use client";

import { useEffect, useMemo, useState } from "react";
import type { WorkbenchOpportunity, WorkbenchQueuePayload, WorkbenchScope, WorkbenchSource } from "@/lib/revision/workbenchQueue";
import { candidateTextIsCopyPasteReady, customOperationLabels, getRenderableCandidateText, operationLabels } from "@/lib/revision/reviseCardContract";

type DecisionState = "accepted_a" | "accepted_b" | "accepted_c" | "custom" | "keep_original" | "reject" | "deferred";
type DecisionFilter = "all" | "pending" | "accepted" | "custom" | "kept_original" | "rejected" | "deferred";
type QueueType = "repair_plan" | "direct_rewrite";
type EvidenceStatus = "has_excerpt" | "has_location" | "manuscript_wide" | "missing_evidence";

type LedgerEntry = {
  localId: string;
  serverId?: string;
  at?: string;
  createdAtIso: string;
  itemId: string;
  itemTitle: string;
  decision: DecisionState;
  selectedOption?: "A" | "B" | "C";
  customText?: string;
  selectedText?: string;
  sourceExcerpt?: string;
  sourceLocation?: string;
  criterion?: string;
  severity?: WorkbenchOpportunity["severity"];
  scope?: WorkbenchScope;
  queueType?: QueueType;
  source?: WorkbenchSource;
  evidenceStatus?: EvidenceStatus;
  isUndo?: boolean;
  undoneLocalId?: string;
  syncStatus: "pending" | "synced" | "failed";
};

type ServerLedgerEntry = {
  id: string;
  local_id: string;
  opportunity_id: string;
  opportunity_title: string;
  decision: DecisionState;
  selected_option: "A" | "B" | "C" | null;
  custom_text: string | null;
  source_excerpt?: string | null;
  source_location?: string | null;
  client_created_at: string | null;
  client_synced_at: string;
  is_undo: boolean;
  undone_local_id: string | null;
};

type Filters = {
  search: string;
  priority: "all" | WorkbenchOpportunity["severity"];
  criterion: "all" | string;
  status: DecisionFilter;
};

function localId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ledgerEntryFromServerRow(row: ServerLedgerEntry): LedgerEntry {
  const createdAtIso = row.client_created_at ?? row.client_synced_at ?? new Date().toISOString();
  return {
    localId: row.local_id,
    serverId: row.id,
    at: new Date(createdAtIso).toLocaleTimeString(),
    createdAtIso,
    itemId: row.opportunity_id,
    itemTitle: row.opportunity_title,
    decision: row.decision,
    selectedOption: row.selected_option ?? undefined,
    customText: row.custom_text ?? undefined,
    sourceExcerpt: row.source_excerpt ?? undefined,
    sourceLocation: row.source_location ?? undefined,
    isUndo: row.is_undo,
    undoneLocalId: row.undone_local_id ?? undefined,
    syncStatus: "synced",
  };
}

function mergeLedgers(localEntries: LedgerEntry[], serverEntries: LedgerEntry[]) {
  const byLocalId = new Map<string, LedgerEntry>();
  [...serverEntries, ...localEntries].forEach((entry) => {
    const existing = byLocalId.get(entry.localId);
    if (!existing || existing.syncStatus !== "pending") {
      byLocalId.set(entry.localId, entry);
    }
  });
  return [...byLocalId.values()].sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
}

function criterionOf(item: WorkbenchOpportunity) {
  return item.criterion || item.crumb.split(" · ")[0]?.trim() || "General";
}

function queueTypeOf(item: WorkbenchOpportunity): QueueType {
  return item.mode === "direct-rewrite" ? "direct_rewrite" : "repair_plan";
}

function evidenceStatusOf(item: WorkbenchOpportunity): EvidenceStatus {
  const quote = `${item.quoteHighlight ?? ""}${item.quoteRest ?? ""}`.trim();
  if (quote.length > 0 && !quote.toLowerCase().includes("no excerpt available")) return "has_excerpt";
  const anchor = (item.anchor ?? "").trim().toLowerCase();
  if (anchor.length > 0 && !anchor.includes("location pending") && !anchor.includes("pending")) return "has_location";
  if (item.scope === "Manuscript" || /manuscript-wide/i.test(item.meta ?? "")) return "manuscript_wide";
  return "missing_evidence";
}

function operationOptionLabel(item: WorkbenchOpportunity, optionKey: "A" | "B" | "C") {
  const base = operationLabels[item.revisionOperation] ?? "Suggested revision"
  if (optionKey === "A") return `${optionKey} — ${base}`
  if (optionKey === "B") return `${optionKey} — ${base} (rhythm variant)`
  return `${optionKey} — ${base} (bolder rendering)`
}

function decisionGroup(decision?: DecisionState): Exclude<DecisionFilter, "all"> {
  if (!decision) return "pending";
  if (decision === "accepted_a" || decision === "accepted_b" || decision === "accepted_c") return "accepted";
  if (decision === "keep_original") return "kept_original";
  if (decision === "reject") return "rejected";
  if (decision === "custom") return "custom";
  return "deferred";
}

function decisionLabel(entry: LedgerEntry) {
  if (entry.decision === "accepted_a") return "Accepted A";
  if (entry.decision === "accepted_b") return "Accepted B";
  if (entry.decision === "accepted_c") return "Accepted C";
  if (entry.decision === "custom") return "Custom";
  if (entry.decision === "keep_original") return "Kept original";
  if (entry.decision === "reject") return "Rejected";
  return "Deferred";
}

function severityClass(severity: WorkbenchOpportunity["severity"]) {
  if (severity === "must") return "border-[#7A2B1A]/70 bg-[#7A2B1A]/25 text-[#F1B6A5]";
  if (severity === "should") return "border-[#C8A96E]/60 bg-[#C8A96E]/15 text-[#EAD8AE]";
  return "border-[#48603F]/70 bg-[#2D3B2A]/35 text-[#BBD8B4]";
}

function truncate(value: string, max = 320) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean;
}

function candidateTextOf(option: { candidateText?: string; text: string }, issueStatement?: string) {
  return getRenderableCandidateText({
    candidateText: option.candidateText ?? option.text,
    issueStatement,
  });
}

function canAcceptOption(item: WorkbenchOpportunity, option: { candidateText?: string; text: string }) {
  if (item.readiness !== "ready_for_revise") return false;
  return candidateTextIsCopyPasteReady(candidateTextOf(option, item.issueStatement));
}

function shouldRenderRationale(rationale?: string) {
  const value = (rationale ?? "").trim();
  if (!value) return false;
  return !/(primary repair path from the evaluation|secondary variant for author-controlled cadence|alternative variant for stronger emphasis|copy-ready prose variant|not copy-ready)/i.test(value);
}

export default function ReviseCockpitClient({ payload }: { payload: WorkbenchQueuePayload }) {
  const [activeId, setActiveId] = useState(payload.opportunities[0]?.id ?? "");
  const [selectedOption, setSelectedOption] = useState<"A" | "B" | "C">("A");
  const [filters, setFilters] = useState<Filters>({ search: "", priority: "all", criterion: "all", status: "all" });
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const needsTargeting = payload.needsTargeting ?? [];
  const hasAnyQueueItems = payload.opportunities.length > 0 || needsTargeting.length > 0;
  const readyForReviseCount = payload.readinessTotals?.ready_for_revise ?? payload.opportunities.length;
  const needsTargetingCount = payload.readinessTotals?.needs_targeting ?? needsTargeting.length;

  const decisionById = useMemo(() => {
    const map: Record<string, DecisionState> = {};
    for (const entry of ledger) if (!map[entry.itemId]) map[entry.itemId] = entry.decision;
    return map;
  }, [ledger]);

  const queueItems = useMemo(
    () => [...payload.opportunities, ...needsTargeting],
    [payload.opportunities, needsTargeting],
  );

  const criteria = useMemo(() => [...new Set(queueItems.map(criterionOf))].sort(), [queueItems]);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return queueItems.filter((item) => {
      if (filters.priority !== "all" && item.severity !== filters.priority) return false;
      if (filters.criterion !== "all" && criterionOf(item) !== filters.criterion) return false;
      if (filters.status !== "all" && decisionGroup(decisionById[item.id]) !== filters.status) return false;
      if (search) {
        const haystack = `${item.title} ${item.meta} ${item.criterion} ${item.anchor} ${item.symptom}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [decisionById, filters, queueItems]);

  const active = filtered.find((item) => item.id === activeId) ?? filtered[0] ?? null;
  const activeIndex = active ? Math.max(0, filtered.findIndex((item) => item.id === active.id)) : 0;
  const selectedProposal = active?.options.find((option) => option.key === selectedOption) ?? active?.options[0] ?? null;
  const canAcceptSelection =
    active?.readiness === "ready_for_revise"
      && (selectedProposal ? candidateTextIsCopyPasteReady(candidateTextOf(selectedProposal, active?.issueStatement)) : false);

  const counts = useMemo(() => {
    const result = { pending: 0, accepted: 0, custom: 0, kept: 0, rejected: 0, deferred: 0 };
    for (const item of queueItems) {
      const group = decisionGroup(decisionById[item.id]);
      if (group === "pending") result.pending += 1;
      if (group === "accepted") result.accepted += 1;
      if (group === "custom") result.custom += 1;
      if (group === "kept_original") result.kept += 1;
      if (group === "rejected") result.rejected += 1;
      if (group === "deferred") result.deferred += 1;
    }
    return result;
  }, [decisionById, queueItems]);

  useEffect(() => {
    let cancelled = false;

    async function loadServerLedger() {
      if (!payload.manuscriptId || !payload.evaluationJobId) return;

      try {
        const params = new URLSearchParams({
          manuscriptId: payload.manuscriptId,
          evaluationJobId: payload.evaluationJobId,
        });
        const response = await fetch(`/api/revision-ledger?${params.toString()}`);
        if (!response.ok) return;
        const json = await response.json();
        if (!json?.ok || !Array.isArray(json.entries) || cancelled) return;

        const serverEntries = (json.entries as ServerLedgerEntry[]).map(ledgerEntryFromServerRow);
        setLedger((current) => mergeLedgers(current, serverEntries));
      } catch {
        // Keep the local ledger empty if hydration fails; current-session edits still work.
      }
    }

    void loadServerLedger();
    return () => {
      cancelled = true;
    };
  }, [payload.evaluationJobId, payload.manuscriptId]);

  function moveNext(from: WorkbenchOpportunity) {
    const currentIndex = filtered.findIndex((item) => item.id === from.id);
    const next = filtered.slice(currentIndex + 1).find((item) => !decisionById[item.id])
      ?? filtered.find((item) => item.id !== from.id && !decisionById[item.id])
      ?? filtered[currentIndex + 1]
      ?? filtered[currentIndex - 1]
      ?? null;
    if (next) setActiveId(next.id);
    setSelectedOption("A");
    setCustomOpen(false);
    setCustomText("");
  }

  async function sync(entry: LedgerEntry, item: WorkbenchOpportunity) {
    if (!payload.manuscriptId || !payload.evaluationJobId) return;
    try {
      const response = await fetch("/api/revision-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manuscriptId: payload.manuscriptId,
          evaluationJobId: payload.evaluationJobId,
          entries: [{
            localId: entry.localId,
            opportunityId: item.id,
            opportunityTitle: item.title,
            decision: entry.decision,
            selectedOption: entry.selectedOption ?? null,
            customText: entry.customText ?? null,
            selectedText: entry.selectedText ?? entry.customText ?? null,
            sourceExcerpt: entry.sourceExcerpt ?? null,
            sourceLocation: entry.sourceLocation ?? null,
            clientCreatedAt: entry.createdAtIso,
            isUndo: false,
            undoneLocalId: null,
            metadata: {
              source: "final-revision-cockpit",
              criterion: entry.criterion ?? null,
              severity: entry.severity ?? null,
              scope: entry.scope ?? null,
              queueType: entry.queueType ?? null,
              opportunitySource: entry.source ?? null,
              evidenceStatus: entry.evidenceStatus ?? null,
            },
          }],
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error ?? "Ledger sync failed");
      setLedger((rows) => rows.map((row) => row.localId === entry.localId ? { ...row, syncStatus: "synced" } : row));
      setSyncMessage("Synced");
    } catch (error) {
      setLedger((rows) => rows.map((row) => row.localId === entry.localId ? { ...row, syncStatus: "failed" } : row));
      setSyncMessage(error instanceof Error ? error.message : "Sync failed");
    }
  }

  function decide(decision: DecisionState, option?: "A" | "B" | "C", custom?: string) {
    if (!active) return;
    const proposal = option ? active.options.find((candidate) => candidate.key === option) : undefined;
    if (option && (!proposal || !canAcceptOption(active, proposal))) return;
    const entry: LedgerEntry = {
      localId: localId(),
      createdAtIso: new Date().toISOString(),
      itemId: active.id,
      itemTitle: active.title,
      decision,
      selectedOption: option,
      customText: custom?.trim() || undefined,
      selectedText: proposal ? candidateTextOf(proposal, active.issueStatement) : custom?.trim() ?? undefined,
      sourceExcerpt: `${active.quoteHighlight ?? ""}${active.quoteRest ?? ""}`.trim() || undefined,
      sourceLocation: active.anchor || active.meta || undefined,
      criterion: criterionOf(active),
      severity: active.severity,
      scope: active.scope,
      queueType: queueTypeOf(active),
      source: active.source,
      evidenceStatus: evidenceStatusOf(active),
      syncStatus: "pending",
    };
    setLedger((rows) => [entry, ...rows]);
    void sync(entry, active);
    moveNext(active);
  }

  async function copyOptionText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Copied candidate text");
    } catch {
      setCopyMessage("Copy failed");
    }
  }

  if (!payload.ok || !hasAnyQueueItems) {
    return (
      <main className="flex h-screen items-center justify-center overflow-hidden bg-[#0D0A05] p-6 text-[#F5EFE4]">
        <section className="max-w-2xl rounded-2xl border border-[#3A3022] bg-[#1C160E] p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-[#C8A96E]">Revision Cockpit</p>
          <h1 className="mt-3 text-3xl">No revision queue available.</h1>
          <p className="mt-3 text-[#CBBDA4]">{payload.error ?? "This evaluation does not have revision opportunities yet."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-[#0D0A05] text-[#F5EFE4]">
      <header className="flex h-14 items-center justify-between gap-3 border-b border-[#2E261A] bg-[#151008] px-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#C8A96E]">Revision Cockpit</p>
          <h1 className="truncate text-base font-semibold text-[#F8F1E6]">{payload.manuscriptTitle}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-[#D8C6A4]">
          <span className="rounded border border-[#5D4C31] px-2 py-1">Queue {filtered.length === 0 ? 0 : activeIndex + 1}/{filtered.length}</span>
          {payload.goLiveProof?.phase0Warmup && (
            <span className="rounded border border-[#48603F]/70 px-2 py-1 text-[#BBD8B4]">Warmup proof ✓ {payload.goLiveProof.phase0Warmup.fileCount} files</span>
          )}
          <span className="rounded border border-[#5D4C31] px-2 py-1">Ready {readyForReviseCount}</span>
          <span className="rounded border border-[#7A2B1A]/60 px-2 py-1 text-[#F1B6A5]">Needs Targeting {needsTargetingCount}</span>
          <span className="rounded border border-[#7A2B1A]/60 px-2 py-1 text-[#F1B6A5]">MUST {payload.totals.must}</span>
          <span className="rounded border border-[#C8A96E]/50 px-2 py-1 text-[#EAD8AE]">SHOULD {payload.totals.should}</span>
          <span className="rounded border border-[#48603F]/60 px-2 py-1 text-[#BBD8B4]">COULD {payload.totals.could}</span>
          <span className="rounded border border-[#5D4C31] px-2 py-1">Pending {counts.pending}</span>
          <span className="rounded border border-[#5D4C31] px-2 py-1">Accepted {counts.accepted}</span>
          {copyMessage && <span className="hidden rounded border border-[#5D4C31] px-2 py-1 text-[#A9987D] lg:inline">{copyMessage}</span>}
          {syncMessage && <span className="hidden rounded border border-[#5D4C31] px-2 py-1 text-[#A9987D] lg:inline">{syncMessage}</span>}
        </div>
      </header>

      <section className="flex h-[calc(100vh-56px)] min-h-0 overflow-hidden">
        <aside className="flex w-[320px] shrink-0 flex-col border-r border-[#2E261A] bg-[#110D07]">
          <div className="space-y-2 border-b border-[#2E261A] p-2">
            <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search queue" className="h-8 w-full rounded border border-[#3A3022] bg-[#0D0A05] px-2 text-xs outline-none focus:border-[#C8A96E]" />
            <div className="grid grid-cols-2 gap-2">
              <select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value as Filters["priority"] }))} className="h-8 rounded border border-[#3A3022] bg-[#0D0A05] px-2 text-xs">
                <option value="all">All priority</option><option value="must">MUST</option><option value="should">SHOULD</option><option value="could">COULD</option>
              </select>
              <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as DecisionFilter }))} className="h-8 rounded border border-[#3A3022] bg-[#0D0A05] px-2 text-xs">
                <option value="all">All status</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="custom">Custom</option><option value="kept_original">Kept</option><option value="rejected">Rejected</option><option value="deferred">Deferred</option>
              </select>
            </div>
            <select value={filters.criterion} onChange={(event) => setFilters((current) => ({ ...current, criterion: event.target.value }))} className="h-8 w-full rounded border border-[#3A3022] bg-[#0D0A05] px-2 text-xs">
              <option value="all">All criteria</option>{criteria.map((criterion) => <option key={criterion} value={criterion}>{criterion}</option>)}
            </select>
          </div>
          <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {filtered.map((item, index) => {
              const activeCard = item.id === active?.id;
              return (
                <li key={item.id}>
                  <button type="button" onClick={() => setActiveId(item.id)} className={`w-full rounded-lg border p-2 text-left transition ${activeCard ? "border-[#C8A96E] bg-[#221B11]" : "border-[#2B241A] bg-[#161109] hover:border-[#5D4C31]"}`}>
                    <div className="mb-1 flex flex-wrap gap-1">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${severityClass(item.severity)}`}>{item.severity}</span>
                      <span className="rounded border border-[#4E4333] px-1.5 py-0.5 text-[10px] text-[#D6C3A2]">{item.scope}</span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] ${item.readiness === "ready_for_revise" ? "border-[#48603F]/70 text-[#BBD8B4]" : "border-[#7A2B1A]/70 text-[#F1B6A5]"}`}>
                        {item.readiness === "ready_for_revise" ? "Ready" : "Needs Targeting"}
                      </span>
                      <span className="rounded border border-[#4E4333] px-1.5 py-0.5 text-[10px] text-[#A9987D]">{decisionGroup(decisionById[item.id])}</span>
                    </div>
                    <p className="line-clamp-2 text-xs leading-4 text-[#F2E7D4]">{index + 1}. {item.title}</p>
                    <p className="mt-1 truncate text-[11px] text-[#A9987D]">{criterionOf(item)} · {item.anchor || item.meta}</p>
                    {item.readiness !== "ready_for_revise" && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-[#E2B2A6]">{item.readinessReason ?? "Needs exact source targeting"}</p>
                    )}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && needsTargeting.length > 0 && (
              <li className="rounded-lg border border-[#3A3022] bg-[#141008] p-3 text-xs text-[#CBBDA4]">
                No Ready cards for this evaluation. Review <span className="text-[#F1B6A5]">Needs Targeting</span> below.
              </li>
            )}
          </ol>
          {needsTargeting.length > 0 && (
            <section className="border-t border-[#2E261A] p-2">
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-[#C8A96E]">Needs Targeting</p>
              <ol className="max-h-40 space-y-1 overflow-y-auto">
                {needsTargeting.slice(0, 25).map((item) => (
                  <li key={item.id} className="rounded border border-[#3A3022] bg-[#141008] p-2 text-[11px] text-[#BDAE91]">
                    <p className="line-clamp-2 text-[#E2D4BB]">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-[#A9987D]">{item.readinessReason ?? "Needs exact source targeting"}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#1C160E]">
          {active ? (
            <>
              <div className="shrink-0 border-b border-[#2E261A] p-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-[#CDBB9A]">
                  <span className={`rounded px-2 py-1 ${severityClass(active.severity)}`}>{active.severity}</span>
                  <span className="rounded border border-[#5A4B33] px-2 py-1">{criterionOf(active)}</span>
                  <span className="rounded border border-[#5A4B33] px-2 py-1">{active.scope}</span>
                  <span className="rounded border border-[#5A4B33] px-2 py-1">{evidenceStatusOf(active).replace(/_/g, " ")}</span>
                </div>
                <h2 className="mt-2 line-clamp-2 text-xl leading-tight text-[#F7EFDF]">{active.title}</h2>
                <div className="mt-2 grid gap-1 text-xs text-[#CBBDA4] md:grid-cols-2">
                  <p>Concept / Premise • {active.severity.toUpperCase()}</p>
                  <p>Scope: {active.scope}</p>
                  <p>Chapter / Location: {active.anchor || active.meta || "Location pending"}</p>
                  <p>Status: {decisionGroup(decisionById[active.id])}</p>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <section className="rounded-xl border border-[#2E261A] bg-[#12100B] p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#C8A96E]">Original Passage</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#E8DCC4]">“{active.quoteHighlight}”{active.quoteRest}</p>
                  <p className="mt-1 text-xs text-[#A9987D]">{active.anchor || active.meta || "Location pending"}</p>
                </section>

                <section className="mt-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#C8A96E]">Replacement Options</p>
                </section>

                <div className="mt-2 grid gap-2 xl:grid-cols-3">
                  {active.options.map((option) => {
                    const candidateText = candidateTextOf(option, active.issueStatement);
                    const copyReady = canAcceptOption(active, option);
                    return (
                    <article key={option.key} onClick={() => setSelectedOption(option.key)} className={`cursor-pointer rounded-xl border bg-[#12100B] p-3 transition ${selectedOption === option.key ? "border-[#C8A96E]" : "border-[#2E261A] hover:border-[#5D4C31]"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#F2E8D6]">{operationOptionLabel(active, option.key)}</p>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={(event) => { event.stopPropagation(); void copyOptionText(candidateText); }} disabled={!copyReady} className="rounded border border-[#5D4C31] px-2 py-1 text-xs font-semibold text-[#E8DABF] disabled:opacity-40">Copy</button>
                          <button type="button" onClick={(event) => { event.stopPropagation(); decide(`accepted_${option.key.toLowerCase()}` as DecisionState, option.key); }} disabled={!copyReady} className="rounded bg-[#C8A96E] px-2 py-1 text-xs font-semibold text-[#1A140C] disabled:opacity-40">Accept {option.key}</button>
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] uppercase tracking-wider text-[#A9987D]">{option.mechanism}</p>
                      <p className="mt-2 line-clamp-5 whitespace-pre-wrap text-sm leading-5 text-[#E5D8BE]">{truncate(candidateText)}</p>
                      {!copyReady && <p className="mt-2 text-xs text-[#E2B2A6]">Not copy-ready; move card to Needs Targeting.</p>}
                      <details className="mt-2 text-xs text-[#BDAE91]"><summary className="cursor-pointer text-[#C8A96E]">Show full fix</summary><p className="mt-2 whitespace-pre-wrap leading-5">{candidateText}</p>{shouldRenderRationale(option.rationale) ? <p className="mt-2 text-[#A9987D]">{option.rationale}</p> : null}</details>
                    </article>
                  )})}
                </div>

                <details className="mt-3 rounded-xl border border-[#2E261A] bg-[#12100B] p-3" open>
                  <summary className="cursor-pointer text-[11px] uppercase tracking-[0.18em] text-[#C8A96E]">Why this was flagged</summary>
                  <div className="mt-3 space-y-1 text-sm leading-6 text-[#E8DCC4]">
                    <p><span className="text-[#C8A96E]">Evidence:</span> “{active.quoteHighlight}”{active.quoteRest}</p>
                    <p><span className="text-[#C8A96E]">Symptom:</span> {active.symptom}</p>
                    <p><span className="text-[#C8A96E]">Cause:</span> {active.cause}</p>
                    <p><span className="text-[#C8A96E]">Fix direction:</span> {active.fixDirection}</p>
                    <p><span className="text-[#C8A96E]">Reader effect:</span> {active.readerEffect}</p>
                    <p><span className="text-[#C8A96E]">Mistake-proofing:</span> {active.mistakeProofing}</p>
                    <p><span className="text-[#C8A96E]">Operation:</span> {operationLabels[active.revisionOperation]}</p>
                  </div>
                </details>

                {customOpen && <div className="mt-3 rounded-xl border border-[#C8A96E]/60 bg-[#120E08] p-3"><textarea value={customText} onChange={(event) => setCustomText(event.target.value)} rows={4} className="w-full rounded border border-[#3A3022] bg-[#0D0A05] p-3 font-mono text-sm outline-none focus:border-[#C8A96E]" /><button disabled={!customText.trim()} onClick={() => decide("custom", undefined, customText)} className="mt-2 rounded bg-[#C8A96E] px-3 py-1.5 text-sm font-semibold text-[#1A140C] disabled:opacity-50">Save custom + next</button></div>}
              </div>

              <footer id="revision-ledger" className="shrink-0 border-t border-[#2E261A] bg-[#120E08] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => decide("accepted_a", "A")} disabled={!canAcceptOption(active, active.options.find((option) => option.key === "A") ?? { text: "" })} className="rounded bg-[#C8A96E] px-4 py-2 text-sm font-semibold text-[#1A140C] disabled:opacity-40">Accept A</button>
                  <button onClick={() => decide("accepted_b", "B")} disabled={!canAcceptOption(active, active.options.find((option) => option.key === "B") ?? { text: "" })} className="rounded border border-[#C8A96E] px-4 py-2 text-sm text-[#F3E3C3] disabled:opacity-40">Accept B</button>
                  <button onClick={() => decide("accepted_c", "C")} disabled={!canAcceptOption(active, active.options.find((option) => option.key === "C") ?? { text: "" })} className="rounded border border-[#C8A96E] px-4 py-2 text-sm text-[#F3E3C3] disabled:opacity-40">Accept C</button>
                  <button onClick={() => decide("keep_original")} disabled={!canAcceptSelection} className="rounded border border-[#5D4C31] px-3 py-2 text-sm text-[#E8DABF] disabled:opacity-40">Keep Original</button>
                  <button onClick={() => decide("reject")} disabled={!canAcceptSelection} className="rounded border border-[#7A2B1A]/70 px-3 py-2 text-sm text-[#E2B2A6] disabled:opacity-40">Reject</button>
                  <button onClick={() => decide("deferred")} className="rounded border border-[#5C5140] px-3 py-2 text-sm text-[#B7A98D]">Defer</button>
                  <button onClick={() => { const selected = active.options.find((option) => option.key === selectedOption) ?? active.options[0]; setCustomText(selected ? candidateTextOf(selected, active.issueStatement) : ""); setCustomOpen(true); }} className="rounded border border-[#C8A96E] bg-[#C8A96E]/10 px-3 py-2 text-sm text-[#F3E3C3]">{customOperationLabels[active.revisionOperation]}</button>
                  <button onClick={() => setLedgerOpen((value) => !value)} className="ml-auto rounded border border-[#5D4C31] px-3 py-2 text-sm text-[#A9987D]">Ledger ({ledger.length})</button>
                </div>
                {ledgerOpen && <div className="mt-2 max-h-28 overflow-y-auto rounded border border-[#2E261A] bg-[#0D0A05] p-2 text-xs text-[#CBBDA4]">{ledger.length === 0 ? <p>No decisions yet.</p> : ledger.slice(0, 12).map((entry) => <p key={entry.localId} className="truncate">{decisionLabel(entry)} · {entry.itemTitle} · {entry.syncStatus}</p>)}</div>}
              </footer>
            </>
          ) : (
            <div className="m-4 rounded-xl border border-[#3A3022] bg-[#12100B] p-6 text-[#CBBDA4]">
              {needsTargeting.length > 0
                ? "No Ready cards yet. This evaluation currently has opportunities in Needs Targeting."
                : "No matching opportunity. Adjust filters."}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import type { WorkbenchOpportunity, WorkbenchQueuePayload, WorkbenchScope, WorkbenchSource } from "@/lib/revision/workbenchQueue";
import {
  customOperationLabels,
  getRenderableCandidateText,
  operationLabels,
  REVISION_OPTION_LABELS,
} from "@/lib/revision/reviseCardContract";
import type { RevisionOperation } from "@/lib/revision/reviseCardContract";

type DecisionState = "accepted_a" | "accepted_b" | "accepted_c" | "custom" | "keep_original" | "reject" | "deferred";
type DecisionFilter = "all" | "pending" | "accepted" | "custom" | "kept_original" | "rejected" | "deferred";
type QueueType = "repair_plan" | "direct_rewrite";
type EvidenceStatus = "has_excerpt" | "has_location" | "manuscript_wide" | "missing_evidence";
type OptionKey = "A" | "B" | "C";

type LedgerEntry = {
  localId: string;
  serverId?: string;
  createdAtIso: string;
  itemId: string;
  itemTitle: string;
  decision: DecisionState;
  selectedOption?: OptionKey;
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
  syncStatus: "pending" | "synced" | "failed";
};

type ServerLedgerEntry = {
  id: string;
  local_id: string;
  opportunity_id: string;
  opportunity_title: string;
  decision: DecisionState;
  selected_option: OptionKey | null;
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

const OPTION_KEYS: OptionKey[] = ["A", "B", "C"];
const LEDGER_FILTERS: Array<{ value: DecisionFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "accepted", label: "Accepted" },
  { value: "custom", label: "Custom" },
  { value: "kept_original", label: "Kept" },
  { value: "rejected", label: "Rejected" },
  { value: "deferred", label: "Deferred" },
  { value: "pending", label: "Pending" },
];

function localId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function compareText(value: string | null | undefined): string {
  return normalize(value).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function sourceTextOf(item: WorkbenchOpportunity): string {
  const text = `${item.quoteHighlight ?? ""}${item.quoteRest ?? ""}`.trim();
  if (!text || /no excerpt available/i.test(text)) return "";
  return text;
}

function ledgerEntryFromServerRow(row: ServerLedgerEntry): LedgerEntry {
  const createdAtIso = row.client_created_at ?? row.client_synced_at ?? new Date().toISOString();
  return {
    localId: row.local_id,
    serverId: row.id,
    createdAtIso,
    itemId: row.opportunity_id,
    itemTitle: row.opportunity_title,
    decision: row.decision,
    selectedOption: row.selected_option ?? undefined,
    customText: row.custom_text ?? undefined,
    sourceExcerpt: row.source_excerpt ?? undefined,
    sourceLocation: row.source_location ?? undefined,
    syncStatus: "synced",
  };
}

function mergeLedgers(localEntries: LedgerEntry[], serverEntries: LedgerEntry[]) {
  const byLocalId = new Map<string, LedgerEntry>();
  [...serverEntries, ...localEntries].forEach((entry) => {
    const existing = byLocalId.get(entry.localId);
    if (!existing || existing.syncStatus !== "pending") byLocalId.set(entry.localId, entry);
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
  const quote = sourceTextOf(item);
  if (quote) return "has_excerpt";

  const anchor = normalize(item.anchor).toLowerCase();
  if (anchor && !anchor.includes("location pending") && !anchor.includes("pending")) return "has_location";
  if (item.scope === "Manuscript" || /manuscript-wide/i.test(item.meta ?? "")) return "manuscript_wide";
  return "missing_evidence";
}

function effectiveRevisionOperation(item: WorkbenchOpportunity): RevisionOperation {
  const current = item.revisionOperation;
  const haystack = [item.title, item.issueStatement, item.fixDirection, item.diagnostic?.operationTargeting, sourceTextOf(item)]
    .map(normalize)
    .join(" ")
    .toLowerCase();

  if (current === "replace_selected_passage" && /\b(insert|add|include|introduce)\b/.test(haystack)) {
    return /\bbefore\b/.test(haystack) ? "insert_before_selected_passage" : "insert_after_selected_passage";
  }

  return current;
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

function truncate(value: string, max = 300) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean;
}

function optionFor(item: WorkbenchOpportunity, key: OptionKey) {
  return item.options.find((option) => option.key === key);
}

function rawCandidateTextOf(option: { candidateText?: string; text?: string }) {
  return normalize(option.candidateText ?? option.text ?? "");
}

function renderedCandidateTextOf(option: { candidateText?: string; text?: string }, issueStatement?: string) {
  return getRenderableCandidateText({
    candidateText: option.candidateText ?? option.text ?? "",
    issueStatement,
  });
}

function displayCandidateTextOf(option: { candidateText?: string; text?: string }, issueStatement?: string) {
  return renderedCandidateTextOf(option, issueStatement) || rawCandidateTextOf(option);
}

function candidateRepeatsSourceForInsertion(item: WorkbenchOpportunity, candidateText: string) {
  const operation = effectiveRevisionOperation(item);
  if (operation !== "insert_before_selected_passage" && operation !== "insert_after_selected_passage") return false;

  const source = compareText(sourceTextOf(item));
  const candidate = compareText(candidateText);
  if (!source || !candidate) return false;

  const sourceTokens = source.split(/\s+/).filter(Boolean);
  if (sourceTokens.length < 2) return false;

  const lead = sourceTokens.slice(0, Math.min(6, sourceTokens.length)).join(" ");
  return lead.length >= 8 && candidate.startsWith(lead);
}

function optionIsOperationSafe(item: WorkbenchOpportunity, candidateText: string) {
  if (!candidateText) return false;
  if (candidateRepeatsSourceForInsertion(item, candidateText)) return false;
  return true;
}

function canAcceptOption(item: WorkbenchOpportunity, key: OptionKey) {
  if (item.readiness !== "ready_for_revise") return false;
  if (effectiveRevisionOperation(item) === "needs_targeting") return false;

  const option = optionFor(item, key);
  if (!option) return false;

  const candidateText = renderedCandidateTextOf(option, item.issueStatement);
  return optionIsOperationSafe(item, candidateText);
}

function cardIsLiveReady(item: WorkbenchOpportunity) {
  if (item.readiness !== "ready_for_revise") return false;
  if (effectiveRevisionOperation(item) === "needs_targeting") return false;
  if (evidenceStatusOf(item) === "missing_evidence") return false;
  return OPTION_KEYS.every((key) => canAcceptOption(item, key));
}

function uniqueById(items: WorkbenchOpportunity[]) {
  const seen = new Set<string>();
  const result: WorkbenchOpportunity[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function optionSectionLabel(item: WorkbenchOpportunity) {
  switch (effectiveRevisionOperation(item)) {
    case "insert_before_selected_passage":
    case "insert_after_selected_passage":
      return "Suggested insertions";
    case "compress_selected_passage":
      return "Suggested compressed versions";
    case "delete_selected_passage":
      return "Suggested deletion/compression choices";
    case "split_paragraph":
      return "Suggested paragraph split";
    case "merge_paragraphs":
      return "Suggested merged passage";
    case "reorder_within_section":
      return "Suggested reordered sequence";
    case "rewrite_full_paragraph":
      return "Suggested paragraph rewrites";
    case "rewrite_multi_paragraph_span":
      return "Suggested structural rewrites";
    case "replace_selected_passage":
      return "Suggested replacements";
    default:
      return "Suggested revisions";
  }
}

function operationInstruction(item: WorkbenchOpportunity) {
  switch (effectiveRevisionOperation(item)) {
    case "insert_before_selected_passage":
      return "Insert copy-ready prose before the selected passage.";
    case "insert_after_selected_passage":
      return "Insert copy-ready prose after the selected passage.";
    case "replace_selected_passage":
      return "Replace the selected passage with copy-ready prose.";
    case "rewrite_full_paragraph":
      return "Rewrite the full paragraph as copy-ready manuscript prose.";
    case "rewrite_multi_paragraph_span":
      return "Rewrite the targeted span while preserving author voice and continuity.";
    case "compress_selected_passage":
      return "Compress the selected passage without damaging meaning or voice.";
    case "delete_selected_passage":
      return "Remove or compress the selected passage only if the surrounding logic remains intact.";
    case "split_paragraph":
      return "Split the paragraph into cleaner beats without changing the underlying meaning.";
    case "merge_paragraphs":
      return "Merge the selected material into one coherent passage.";
    case "reorder_within_section":
      return "Reorder the selected sequence while preserving causal logic.";
    default:
      return "Target this issue before generating apply-ready prose.";
  }
}

function removeRepeatedTitleText(value: string | null | undefined, item: WorkbenchOpportunity): string {
  const clean = normalize(value);
  if (!clean) return "";

  for (const repeatedSource of [item.title, item.issueStatement]) {
    const repeated = normalize(repeatedSource);
    if (!repeated) continue;
    if (compareText(clean) === compareText(repeated)) return "";
    if (compareText(clean).startsWith(compareText(repeated))) {
      return clean.slice(repeated.length).replace(/^[\s:;.,—–-]+/, "").trim();
    }
  }

  return clean;
}

function compactGoalFromText(item: WorkbenchOpportunity): string {
  const source = [item.fixDirection, item.diagnostic?.fixStrategy, item.issueStatement, item.title]
    .map((value) => removeRepeatedTitleText(value, item) || normalize(value))
    .find(Boolean) ?? "";
  const action = source.match(/\b(expand|insert|replace|clarify|strengthen|show|make|compress|delete|split|tighten|restore|add|remove|deepen)\b/i);
  const goal = action && typeof action.index === "number" ? source.slice(action.index).trim() : source;
  if (!goal) return operationInstruction(item);
  return `${goal.charAt(0).toUpperCase()}${goal.slice(1)}`;
}

function diagnosticText(item: WorkbenchOpportunity, field: "symptom" | "cause" | "fix" | "readerEffect" | "mistakeProofing"): string {
  const rawByField = {
    symptom: item.symptom || item.diagnostic?.symptom,
    cause: item.cause || item.diagnostic?.cause,
    fix: item.fixDirection || item.diagnostic?.fixStrategy,
    readerEffect: item.readerEffect || item.diagnostic?.readerImpact,
    mistakeProofing: item.mistakeProofing || item.diagnostic?.mistakeProofing,
  } satisfies Record<typeof field, string | undefined>;

  const cleaned = removeRepeatedTitleText(rawByField[field], item);
  if (cleaned) return cleaned;

  if (field === "symptom") {
    return "The selected beat is underdeveloped; the choice, consequence, or causal turn needs to land more clearly on the page.";
  }
  if (field === "fix") return compactGoalFromText(item);
  if (field === "cause") return "The draft has not yet converted this moment into a clear, playable manuscript beat.";
  if (field === "readerEffect") return "The reader should feel the immediate consequence of the moment instead of receiving only a summary of the intended repair.";
  return "Preserve author voice, continuity, and meaning while limiting the change to the declared revision operation.";
}

function revisionTaskOf(item: WorkbenchOpportunity) {
  return `${operationInstruction(item)} ${compactGoalFromText(item)}`.trim();
}

function readinessReason(item: WorkbenchOpportunity) {
  if (item.readiness !== "ready_for_revise") return item.readinessReason ?? "This card needs exact source targeting before it can be accepted.";
  if (effectiveRevisionOperation(item) === "needs_targeting") return "Revision operation is not specific enough for safe apply.";
  if (evidenceStatusOf(item) === "missing_evidence") return "Missing exact source excerpt or usable manuscript anchor.";
  if (!OPTION_KEYS.every((key) => canAcceptOption(item, key))) return "One or more A/B/C options are not copy-ready or do not match the declared revision operation.";
  return null;
}

function selectedDecisionFor(key: OptionKey): DecisionState {
  if (key === "A") return "accepted_a";
  if (key === "B") return "accepted_b";
  return "accepted_c";
}

export default function ReviseCockpitClient({ payload }: { payload: WorkbenchQueuePayload }) {
  const [activeId, setActiveId] = useState(payload.opportunities[0]?.id ?? payload.needsTargeting?.[0]?.id ?? "");
  const [selectedOption, setSelectedOption] = useState<OptionKey>("A");
  const [filters, setFilters] = useState<Filters>({ search: "", priority: "all", criterion: "all", status: "all" });
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const liveOpportunities = useMemo(() => payload.opportunities.filter(cardIsLiveReady), [payload.opportunities]);

  const needsTargeting = useMemo(
    () => uniqueById([...(payload.needsTargeting ?? []), ...payload.opportunities.filter((item) => !cardIsLiveReady(item))]),
    [payload.needsTargeting, payload.opportunities],
  );

  const primaryQueue = liveOpportunities.length > 0 ? liveOpportunities : needsTargeting;
  const allCards = useMemo(() => uniqueById([...liveOpportunities, ...needsTargeting]), [liveOpportunities, needsTargeting]);
  const hasAnyQueueItems = allCards.length > 0;
  const readyForReviseCount = liveOpportunities.length;
  const needsTargetingCount = needsTargeting.length;

  const decisionById = useMemo(() => {
    const map: Record<string, DecisionState> = {};
    for (const entry of ledger) if (!map[entry.itemId]) map[entry.itemId] = entry.decision;
    return map;
  }, [ledger]);

  const criteria = useMemo(() => [...new Set(allCards.map(criterionOf))].sort(), [allCards]);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return primaryQueue.filter((item) => {
      if (filters.priority !== "all" && item.severity !== filters.priority) return false;
      if (filters.criterion !== "all" && criterionOf(item) !== filters.criterion) return false;
      if (filters.status !== "all" && decisionGroup(decisionById[item.id]) !== filters.status) return false;
      if (search) {
        const haystack = `${item.title} ${item.meta} ${item.criterion} ${item.anchor} ${item.symptom} ${item.fixDirection}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [decisionById, filters, primaryQueue]);

  const active = allCards.find((item) => item.id === activeId) ?? filtered[0] ?? allCards[0] ?? null;
  const activeIndex = active ? Math.max(0, filtered.findIndex((item) => item.id === active.id)) : 0;
  const selectedProposal = active ? optionFor(active, selectedOption) ?? active.options[0] ?? null : null;
  const selectedCandidateText = active && selectedProposal ? displayCandidateTextOf(selectedProposal, active.issueStatement) : "";

  const counts = useMemo(() => {
    const result = { pending: 0, accepted: 0, custom: 0, kept: 0, rejected: 0, deferred: 0 };
    for (const item of allCards) {
      const group = decisionGroup(decisionById[item.id]);
      if (group === "pending") result.pending += 1;
      if (group === "accepted") result.accepted += 1;
      if (group === "custom") result.custom += 1;
      if (group === "kept_original") result.kept += 1;
      if (group === "rejected") result.rejected += 1;
      if (group === "deferred") result.deferred += 1;
    }
    return result;
  }, [allCards, decisionById]);

  const visibleLedger = useMemo(() => {
    if (filters.status === "all") return ledger;
    return ledger.filter((entry) => decisionGroup(entry.decision) === filters.status);
  }, [filters.status, ledger]);

  useEffect(() => {
    if (!activeId && filtered[0]) setActiveId(filtered[0].id);
    if (activeId && allCards.length > 0 && !allCards.some((item) => item.id === activeId)) {
      setActiveId(filtered[0]?.id ?? allCards[0]?.id ?? "");
    }
  }, [activeId, allCards, filtered]);

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
        // Current-session edits still work if hydration fails.
      }
    }

    void loadServerLedger();
    return () => {
      cancelled = true;
    };
  }, [payload.evaluationJobId, payload.manuscriptId]);

  function selectOpportunity(id: string) {
    setActiveId(id);
    setSelectedOption("A");
    setCustomOpen(false);
    setCustomText("");
  }

  function moveNext(from: WorkbenchOpportunity) {
    const currentIndex = filtered.findIndex((item) => item.id === from.id);
    const next = filtered.slice(currentIndex + 1).find((item) => !decisionById[item.id])
      ?? filtered.find((item) => item.id !== from.id && !decisionById[item.id])
      ?? filtered[currentIndex + 1]
      ?? filtered[currentIndex - 1]
      ?? null;
    if (next) selectOpportunity(next.id);
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
              source: "surgical-revision-cockpit",
              criterion: entry.criterion ?? null,
              severity: entry.severity ?? null,
              scope: entry.scope ?? null,
              queueType: entry.queueType ?? null,
              opportunitySource: entry.source ?? null,
              evidenceStatus: entry.evidenceStatus ?? null,
              revisionOperation: effectiveRevisionOperation(item),
              cardLiveReady: cardIsLiveReady(item),
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

  function decide(decision: DecisionState, option?: OptionKey, custom?: string) {
    if (!active) return;
    const proposal = option ? optionFor(active, option) : undefined;
    if (option && !canAcceptOption(active, option)) return;

    const entry: LedgerEntry = {
      localId: localId(),
      createdAtIso: new Date().toISOString(),
      itemId: active.id,
      itemTitle: active.title,
      decision,
      selectedOption: option,
      customText: custom?.trim() || undefined,
      selectedText: proposal ? renderedCandidateTextOf(proposal, active.issueStatement) : custom?.trim() ?? undefined,
      sourceExcerpt: sourceTextOf(active) || undefined,
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
    if (!text.trim()) {
      setCopyMessage("Candidate unavailable");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Copied candidate text");
    } catch {
      setCopyMessage("Copy failed");
    }
  }

  if (!payload.ok || !hasAnyQueueItems) {
    return (
      <main className="fixed inset-x-0 bottom-0 top-[72px] z-10 flex items-center justify-center overflow-hidden bg-[#0D0A05] p-6 text-[#F5EFE4]">
        <section className="max-w-2xl rounded-2xl border border-[#3A3022] bg-[#1C160E] p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-[#C8A96E]">Revision Cockpit</p>
          <h1 className="mt-3 text-3xl">No revision queue available.</h1>
          <p className="mt-3 text-[#CBBDA4]">{payload.error ?? "This evaluation does not have revision opportunities yet."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="fixed inset-x-0 bottom-0 top-[72px] z-10 overflow-hidden bg-[#0D0A05] text-[#F5EFE4]">
      <header className="flex h-11 items-center justify-between gap-3 border-b border-[#2E261A] bg-[#151008] px-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#C8A96E]">Revision Cockpit · surgical repair queue</p>
          <h1 className="truncate text-sm font-semibold text-[#F8F1E6]">{payload.manuscriptTitle}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[11px] text-[#D8C6A4]">
          <span className="rounded border border-[#48603F]/70 px-2 py-1 text-[#BBD8B4]">Ready {readyForReviseCount}</span>
          <span className="rounded border border-[#7A2B1A]/60 px-2 py-1 text-[#F1B6A5]">Needs Targeting {needsTargetingCount}</span>
          <span className="rounded border border-[#C8A96E]/50 px-2 py-1 text-[#EAD8AE]">Pending {counts.pending}</span>
          <span className="rounded border border-[#5D4C31] px-2 py-1">Accepted {counts.accepted}</span>
          {copyMessage && <span className="hidden rounded border border-[#5D4C31] px-2 py-1 text-[#A9987D] lg:inline">{copyMessage}</span>}
          {syncMessage && <span className="hidden rounded border border-[#5D4C31] px-2 py-1 text-[#A9987D] lg:inline">{syncMessage}</span>}
        </div>
      </header>

      <section className="grid h-[calc(100%-44px)] min-h-0 overflow-hidden xl:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-[#2E261A] bg-[#110D07]">
          <div className="space-y-2 border-b border-[#2E261A] p-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#C8A96E]">Search Queue</p>
              <span className="shrink-0 rounded border border-[#C8A96E]/70 bg-[#C8A96E]/10 px-2 py-1 text-[11px] font-semibold text-[#F3E3C3]">
                Queue {filtered.length === 0 ? 0 : activeIndex + 1}/{filtered.length}
              </span>
            </div>
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
              const reason = readinessReason(item);
              return (
                <li key={item.id}>
                  <button type="button" onClick={() => selectOpportunity(item.id)} className={`w-full rounded-lg border p-2 text-left transition ${activeCard ? "border-[#C8A96E] bg-[#221B11]" : "border-[#2B241A] bg-[#161109] hover:border-[#5D4C31]"}`}>
                    <div className="mb-1 flex flex-wrap gap-1">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${severityClass(item.severity)}`}>{item.severity}</span>
                      <span className="rounded border border-[#4E4333] px-1.5 py-0.5 text-[10px] text-[#D6C3A2]">{item.scope}</span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] ${cardIsLiveReady(item) ? "border-[#48603F]/70 text-[#BBD8B4]" : "border-[#7A2B1A]/70 text-[#F1B6A5]"}`}>
                        {cardIsLiveReady(item) ? "Ready" : "Needs Targeting"}
                      </span>
                      <span className="rounded border border-[#4E4333] px-1.5 py-0.5 text-[10px] text-[#A9987D]">{decisionGroup(decisionById[item.id])}</span>
                    </div>
                    <p className="line-clamp-2 text-xs leading-4 text-[#F2E7D4]">{index + 1}. {item.title}</p>
                    <p className="mt-1 truncate text-[11px] text-[#A9987D]">{criterionOf(item)} · {item.anchor || item.meta}</p>
                    {reason && <p className="mt-1 line-clamp-2 text-[11px] text-[#E2B2A6]">{reason}</p>}
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="flex min-w-0 flex-col overflow-hidden bg-[#1C160E]">
          {active ? (
            <>
              <div className="shrink-0 border-b border-[#2E261A] p-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-[#CDBB9A]">
                  <span className={`rounded px-2 py-1 ${severityClass(active.severity)}`}>{active.severity}</span>
                  <span className="rounded border border-[#5A4B33] px-2 py-1">{criterionOf(active)}</span>
                  <span className="rounded border border-[#5A4B33] px-2 py-1">{active.scope}</span>
                  <span className="rounded border border-[#5A4B33] px-2 py-1">{operationLabels[effectiveRevisionOperation(active)] ?? "Revision operation missing"}</span>
                  <span className={`rounded border px-2 py-1 ${cardIsLiveReady(active) ? "border-[#48603F]/70 text-[#BBD8B4]" : "border-[#7A2B1A]/70 text-[#F1B6A5]"}`}>{cardIsLiveReady(active) ? "Ready" : "Needs Targeting"}</span>
                </div>
                <h2 className="mt-1 line-clamp-2 text-lg leading-tight text-[#F7EFDF]">{active.title}</h2>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <section className="rounded-xl border border-[#2E261A] bg-[#12100B] p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#C8A96E]">Diagnosis & Guardrails</p>
                    {!cardIsLiveReady(active) && <span className="rounded border border-[#7A2B1A]/60 bg-[#7A2B1A]/15 px-2 py-1 text-[11px] text-[#E9B19F]">{readinessReason(active)}</span>}
                  </div>
                  <div className="grid gap-x-4 gap-y-1 text-sm leading-5 text-[#E8DCC4] xl:grid-cols-2">
                    <p><span className="text-[#C8A96E]">Symptom:</span> {diagnosticText(active, "symptom")}</p>
                    <p><span className="text-[#C8A96E]">Cause:</span> {diagnosticText(active, "cause")}</p>
                    <p><span className="text-[#C8A96E]">Fix:</span> {diagnosticText(active, "fix")}</p>
                    <p><span className="text-[#C8A96E]">Reader effect:</span> {diagnosticText(active, "readerEffect")}</p>
                    <p><span className="text-[#C8A96E]">Mistake-proofing:</span> {diagnosticText(active, "mistakeProofing")}</p>
                    <p><span className="text-[#C8A96E]">Operation:</span> {operationLabels[effectiveRevisionOperation(active)] ?? "Needs targeting"}</p>
                  </div>
                </section>

                <section className="mt-2 grid gap-2 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="rounded-xl border border-[#2E261A] bg-[#12100B] p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#C8A96E]">Original Passage</p>
                    {sourceTextOf(active) ? (
                      <p className="mt-2 max-h-20 overflow-y-auto whitespace-pre-wrap text-sm leading-5 text-[#E8DCC4]">{sourceTextOf(active)}</p>
                    ) : (
                      <p className="mt-2 text-sm leading-5 text-[#E2B2A6]">No exact passage is available yet. This card cannot enter live Revise until the source passage is targeted.</p>
                    )}
                    <p className="mt-1 text-xs text-[#A9987D]">{active.anchor || active.meta || "Location pending"}</p>
                  </div>

                  <div className="rounded-xl border border-[#2E261A] bg-[#12100B] p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#C8A96E]">Revision Task</p>
                    <p className="mt-2 text-sm leading-5 text-[#E8DCC4]">{revisionTaskOf(active)}</p>
                  </div>
                </section>

                <section className="mt-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#C8A96E]">{optionSectionLabel(active)}</p>
                </section>

                <div className="mt-2 grid gap-2 xl:grid-cols-3">
                  {active.options.map((option) => {
                    const displayText = displayCandidateTextOf(option, active.issueStatement);
                    const copyReady = canAcceptOption(active, option.key);
                    return (
                      <article key={option.key} onClick={() => setSelectedOption(option.key)} className={`cursor-pointer rounded-xl border bg-[#12100B] p-3 transition ${selectedOption === option.key ? "border-[#C8A96E]" : "border-[#2E261A] hover:border-[#5D4C31]"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-[#F2E8D6]">{REVISION_OPTION_LABELS[option.key]}</p>
                            <p className="mt-1 text-[11px] uppercase tracking-wider text-[#A9987D]">{operationLabels[effectiveRevisionOperation(active)] ?? option.mechanism}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button type="button" onClick={(event) => { event.stopPropagation(); void copyOptionText(displayText); }} disabled={!copyReady} className="rounded border border-[#5D4C31] px-2 py-1 text-xs font-semibold text-[#E8DABF] disabled:opacity-40">Copy</button>
                            <button type="button" onClick={(event) => { event.stopPropagation(); decide(selectedDecisionFor(option.key), option.key); }} disabled={!copyReady} className="rounded bg-[#C8A96E] px-2 py-1 text-xs font-semibold text-[#1A140C] disabled:opacity-40">Accept {option.key}</button>
                          </div>
                        </div>
                        <p className={`mt-2 line-clamp-6 whitespace-pre-wrap text-sm leading-5 ${copyReady ? "text-[#E5D8BE]" : "text-[#E2B2A6]"}`}>{displayText || "No candidate text available."}</p>
                        {!copyReady && <p className="mt-2 rounded border border-[#7A2B1A]/55 bg-[#7A2B1A]/15 p-2 text-xs leading-5 text-[#E2B2A6]">Draft shown for diagnosis only. Accept/Copy stay disabled until this option is copy-ready for the declared operation.</p>}
                      </article>
                    );
                  })}
                </div>

                {customOpen && (
                  <div className="mt-2 rounded-xl border border-[#C8A96E]/60 bg-[#120E08] p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-[#C8A96E]">Author custom revision</p>
                    <textarea value={customText} onChange={(event) => setCustomText(event.target.value)} rows={4} className="mt-2 w-full rounded border border-[#3A3022] bg-[#0D0A05] p-3 font-mono text-sm outline-none focus:border-[#C8A96E]" />
                    <button disabled={!customText.trim()} onClick={() => decide("custom", undefined, customText)} className="mt-2 rounded bg-[#C8A96E] px-3 py-1.5 text-sm font-semibold text-[#1A140C] disabled:opacity-50">Save custom + next</button>
                  </div>
                )}
              </div>

              <footer className="shrink-0 border-t border-[#2E261A] bg-[#120E08] p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => decide("accepted_a", "A")} disabled={!active || !canAcceptOption(active, "A")} className="rounded bg-[#C8A96E] px-4 py-2 text-sm font-semibold text-[#1A140C] disabled:opacity-40">Accept A</button>
                  <button onClick={() => decide("accepted_b", "B")} disabled={!active || !canAcceptOption(active, "B")} className="rounded border border-[#C8A96E] px-4 py-2 text-sm text-[#F3E3C3] disabled:opacity-40">Accept B</button>
                  <button onClick={() => decide("accepted_c", "C")} disabled={!active || !canAcceptOption(active, "C")} className="rounded border border-[#C8A96E] px-4 py-2 text-sm text-[#F3E3C3] disabled:opacity-40">Accept C</button>
                  <button onClick={() => decide("keep_original")} disabled={!active} className="rounded border border-[#5D4C31] px-3 py-2 text-sm text-[#E8DABF] disabled:opacity-40">Keep Original</button>
                  <button onClick={() => decide("reject")} disabled={!active} className="rounded border border-[#7A2B1A]/70 px-3 py-2 text-sm text-[#E2B2A6] disabled:opacity-40">Reject</button>
                  <button onClick={() => decide("deferred")} disabled={!active} className="rounded border border-[#5C5140] px-3 py-2 text-sm text-[#B7A98D] disabled:opacity-40">Defer</button>
                  <button onClick={() => { setCustomText(selectedCandidateText); setCustomOpen(true); }} disabled={!active} className="rounded border border-[#C8A96E] bg-[#C8A96E]/10 px-3 py-2 text-sm text-[#F3E3C3] disabled:opacity-40">{active ? customOperationLabels[effectiveRevisionOperation(active)] ?? "Write Custom" : "Write Custom"}</button>
                </div>
              </footer>

              <section className="shrink-0 border-t border-[#2E261A] bg-[#0D0A05] p-2">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="mr-2 uppercase tracking-[0.16em] text-[#C8A96E]">Revision Ledger</span>
                  {LEDGER_FILTERS.map((filter) => (
                    <button key={filter.value} type="button" onClick={() => setFilters((current) => ({ ...current, status: filter.value }))} className={`rounded border px-2 py-1 ${filters.status === filter.value ? "border-[#C8A96E] text-[#F3E3C3]" : "border-[#3A3022] text-[#A9987D]"}`}>
                      {filter.label}
                    </button>
                  ))}
                </div>
                <div className="max-h-24 overflow-y-auto rounded border border-[#2E261A]">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-[#161109] text-[#C8A96E]">
                      <tr><th className="px-2 py-1">Decision</th><th className="px-2 py-1">Option</th><th className="px-2 py-1">Criterion</th><th className="px-2 py-1">Opportunity</th><th className="px-2 py-1">Sync</th></tr>
                    </thead>
                    <tbody className="text-[#D8C6A4]">
                      {visibleLedger.length === 0 ? (
                        <tr><td colSpan={5} className="px-2 py-2 text-[#A9987D]">No decisions yet.</td></tr>
                      ) : (
                        visibleLedger.slice(0, 25).map((entry) => (
                          <tr key={entry.localId} className="border-t border-[#2E261A]"><td className="px-2 py-1">{decisionLabel(entry)}</td><td className="px-2 py-1">{entry.selectedOption ?? "—"}</td><td className="px-2 py-1">{entry.criterion ?? "—"}</td><td className="max-w-[520px] truncate px-2 py-1">{entry.itemTitle}</td><td className="px-2 py-1">{entry.syncStatus}</td></tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <div className="m-4 rounded-xl border border-[#3A3022] bg-[#12100B] p-6 text-[#CBBDA4]">No matching opportunity. Adjust filters.</div>
          )}
        </section>
      </section>
    </main>
  );
}

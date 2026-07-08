"use client";

import { useCallback, useMemo, useState } from "react";
import type { WorkbenchOpportunity, WorkbenchQueuePayload } from "@/lib/revision/workbenchQueue";
import {
  candidateTextIsCopyPasteReady,
  customOperationLabels,
  getRenderableCandidateText,
  operationLabels,
  REVISION_OPTION_LABELS,
} from "@/lib/revision/reviseCardContract";
import type { RevisionOperation } from "@/lib/revision/reviseCardContract";

type OptionKey = "A" | "B" | "C";
type DecisionState = "accepted_a" | "accepted_b" | "accepted_c" | "custom" | "keep_original" | "reject" | "deferred";
type DecisionFilter = "all" | "pending" | "accepted" | "custom" | "kept_original" | "rejected" | "deferred";
type SourceFilter = "all" | "deep_craft" | "surface_polish";

type LedgerEntry = {
  id: string;
  itemId: string;
  itemTitle: string;
  decision: DecisionState;
  option?: OptionKey;
  selectedText?: string;
  criterion: string;
  syncStatus: "pending" | "synced" | "failed";
};

type Filters = {
  search: string;
  priority: "all" | WorkbenchOpportunity["severity"];
  criterion: "all" | string;
  status: DecisionFilter;
  sourceFilter: SourceFilter;
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

function criterionOf(item: WorkbenchOpportunity): string {
  return item.criterion || item.crumb.split(" · ")[0]?.trim() || "General";
}

function formatCriterion(raw: string): string {
  return raw.replace(/_/g, " ");
}

function effectiveOperation(item: WorkbenchOpportunity): RevisionOperation {
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

function optionFor(item: WorkbenchOpportunity, key: OptionKey) {
  return item.options.find((option) => option.key === key);
}

function renderableCandidate(item: WorkbenchOpportunity, key: OptionKey): string {
  const option = optionFor(item, key);
  if (!option) return "";
  return getRenderableCandidateText({ candidateText: option.candidateText ?? option.text, issueStatement: item.issueStatement });
}

function candidateRepeatsSourceForInsertion(item: WorkbenchOpportunity, text: string): boolean {
  const operation = effectiveOperation(item);
  if (operation !== "insert_before_selected_passage" && operation !== "insert_after_selected_passage") return false;

  const source = compareText(sourceTextOf(item));
  const candidate = compareText(text);
  if (!source || !candidate) return false;

  const lead = source.split(/\s+/).slice(0, 6).join(" ");
  return lead.length >= 8 && candidate.startsWith(lead);
}

function candidateText(item: WorkbenchOpportunity, key: OptionKey): string {
  const renderable = renderableCandidate(item, key);
  if (renderable && candidateTextIsCopyPasteReady(renderable) && !candidateRepeatsSourceForInsertion(item, renderable)) return renderable;
  return "";
}

// ─── Template residue detection (quality gate) ─────────────────────────────
// Candidates containing pipeline template tokens are NOT manuscript-ready.
// Fall back to "revision strategy" mode instead of showing residue.
const TEMPLATE_TOKENS = /\b(LOCATION|OPERATION|CHARACTER|PROTAGONIST|ANTAGONIST)\b/;

function hasTemplateResidue(text: string): boolean {
  return TEMPLATE_TOKENS.test(text);
}

// ─── Three-tier display mode ────────────────────────────────────────────────
// ≤300 words: full original + full A/B/C replacement prose
// 300–1200 words: anchor excerpt + A/B/C insertions/replacement chunks
// >1200 words: anchor excerpt + diagnosis + rewrite strategy only
type RevisionDisplayMode = "full_replacement" | "excerpt_insertion" | "strategy_only";

function displayMode(item: WorkbenchOpportunity): RevisionDisplayMode {
  const source = sourceTextOf(item);
  const wordCount = source ? source.split(/\s+/).length : 0;
  if (wordCount > 1200) return "strategy_only";
  if (wordCount > 300) return "excerpt_insertion";
  return "full_replacement";
}

function excerptText(text: string, maxSentences: number = 3): string {
  const sentences = text.match(/[^.!?]+[.!?][""']?\s*/g);
  if (!sentences || sentences.length <= maxSentences) return text;
  return sentences.slice(0, maxSentences).join("").trim() + " …";
}

function candidateDisplayText(item: WorkbenchOpportunity, key: OptionKey): string {
  const text = candidateText(item, key);
  if (!text || hasTemplateResidue(text)) return "";
  return text;
}

function canSelectOption(item: WorkbenchOpportunity, key: OptionKey): boolean {
  const text = candidateText(item, key);
  if (hasTemplateResidue(text)) return false;
  return candidateTextIsCopyPasteReady(text) && !candidateRepeatsSourceForInsertion(item, text);
}

function liveReady(item: WorkbenchOpportunity): boolean {
  return effectiveOperation(item) !== "needs_targeting" && OPTION_KEYS.every((key) => canSelectOption(item, key));
}

function decisionGroup(decision?: DecisionState): Exclude<DecisionFilter, "all"> {
  if (!decision) return "pending";
  if (decision === "accepted_a" || decision === "accepted_b" || decision === "accepted_c") return "accepted";
  if (decision === "keep_original") return "kept_original";
  if (decision === "custom") return "custom";
  if (decision === "reject") return "rejected";
  return "deferred";
}

function decisionLabel(decision: DecisionState): string {
  if (decision === "accepted_a") return "Accepted A";
  if (decision === "accepted_b") return "Accepted B";
  if (decision === "accepted_c") return "Accepted C";
  if (decision === "custom") return "Custom";
  if (decision === "keep_original") return "Kept";
  if (decision === "reject") return "Rejected";
  return "Deferred";
}

function selectedDecisionFor(key: OptionKey): DecisionState {
  if (key === "A") return "accepted_a";
  if (key === "B") return "accepted_b";
  return "accepted_c";
}

function severityClass(severity: WorkbenchOpportunity["severity"]): string {
  if (severity === "must") return "border-red-600 bg-red-700 text-white font-semibold";
  if (severity === "should") return "border-amber-500 bg-amber-600 text-white font-semibold";
  return "border-green-600 bg-green-700 text-white font-semibold";
}

function severityLabel(severity: WorkbenchOpportunity["severity"]): string {
  if (severity === "must") return "Recommended";
  if (severity === "should") return "Optional";
  return "Consider";
}

function compactGoal(item: WorkbenchOpportunity): string {
  const source = normalize(item.fixDirection || item.diagnostic?.fixStrategy || item.issueStatement || item.title);
  if (!source) return "Revise this targeted span.";
  return source.length > 180 ? `${source.slice(0, 177).trim()}…` : source;
}

function operationInstruction(item: WorkbenchOpportunity): string {
  switch (effectiveOperation(item)) {
    case "insert_before_selected_passage": return "Insert before the selected passage:";
    case "insert_after_selected_passage": return "Insert after the selected passage:";
    case "replace_selected_passage": return "Replace selected passage:";
    case "compress_selected_passage": return "Compress selected passage:";
    case "delete_selected_passage": return "Delete or compress selected passage:";
    case "split_paragraph": return "Split paragraph:";
    case "merge_paragraphs": return "Merge selected passage:";
    case "reorder_within_section": return "Reorder selected sequence:";
    default: return "Revise targeted span:";
  }
}

function diagnosticText(item: WorkbenchOpportunity, field: "symptom" | "cause" | "fix" | "readerEffect" | "mistakeProofing"): string {
  const raw = {
    symptom: item.symptom || item.diagnostic?.symptom,
    cause: item.cause || item.diagnostic?.cause,
    fix: item.fixDirection || item.diagnostic?.fixStrategy,
    readerEffect: item.readerEffect || item.diagnostic?.readerImpact,
    mistakeProofing: item.mistakeProofing || item.diagnostic?.mistakeProofing,
  }[field];
  return normalize(raw) || "Review the evidence and choose the least disruptive repair path.";
}

function optionSectionLabel(item: WorkbenchOpportunity): string {
  const op = effectiveOperation(item);
  if (op === "insert_before_selected_passage" || op === "insert_after_selected_passage") return "Suggested insertions";
  if (op === "compress_selected_passage") return "Suggested compressed versions";
  if (op === "replace_selected_passage") return "Suggested replacements";
  return "Suggested revisions";
}

export default function ReviseCockpitClientWorkflowV1({ payload }: { payload: WorkbenchQueuePayload }) {
  const allInputItems = useMemo(() => payload.opportunities, [payload.opportunities]);
  const [activeId, setActiveId] = useState(allInputItems[0]?.id ?? "");
  const [selectedOption, setSelectedOption] = useState<OptionKey>("A");
  const [filters, setFilters] = useState<Filters>({ search: "", priority: "all", criterion: "all", status: "all", sourceFilter: "all" });
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [rewriteCache, setRewriteCache] = useState<Record<string, { a: string; b: string; c: string; error?: string }>>({});
  const [rewriteLoading, setRewriteLoading] = useState<string | null>(null);

  const generateVoiceRewrite = useCallback(async (item: WorkbenchOpportunity) => {
    if (rewriteLoading) return;
    setRewriteLoading(item.id);
    setMessage("Generating rewrites in author voice…");
    try {
      const response = await fetch("/api/revise/generate-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluationJobId: payload.evaluationJobId,
          manuscriptId: payload.manuscriptId,
          opportunityId: item.id,
          originalPassage: sourceTextOf(item),
          editorialInstruction: item.fixDirection || item.diagnostic?.fixStrategy || "",
          symptom: item.symptom || item.diagnostic?.symptom || "",
          cause: item.cause || item.diagnostic?.cause || "",
          mistakeProofing: item.mistakeProofing || item.diagnostic?.mistakeProofing || "",
          operation: effectiveOperation(item),
          location: item.anchor || item.meta || "",
        }),
      });
      const data = await response.json();
      if (data.ok && data.candidates) {
        setRewriteCache((prev) => ({ ...prev, [item.id]: data.candidates }));
        setMessage("Voice rewrites generated!");
        setTimeout(() => setMessage(null), 3000);
      } else {
        // Store error persistently in cache so the UI shows it below the button
        const errMsg = data.error || "Rewrite generation failed";
        setRewriteCache((prev) => ({ ...prev, [item.id]: { a: "", b: "", c: "", error: errMsg } }));
        setMessage(errMsg);
        setTimeout(() => setMessage(null), 5000);
      }
    } catch {
      const errMsg = "Network error — could not reach the rewrite API";
      setRewriteCache((prev) => ({ ...prev, [item.id]: { a: "", b: "", c: "", error: errMsg } }));
      setMessage(errMsg);
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setRewriteLoading(null);
    }
  }, [rewriteLoading, payload.evaluationJobId, payload.manuscriptId]);

  const items = useMemo(() => {
    const seen = new Set<string>();
    return allInputItems.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [allInputItems]);

  const selectedById = useMemo(() => {
    const map: Record<string, LedgerEntry> = {};
    for (const entry of ledger) if (!map[entry.itemId]) map[entry.itemId] = entry;
    return map;
  }, [ledger]);

  const openItems = useMemo(() => items.filter((item) => !selectedById[item.id]), [items, selectedById]);
  const criteria = useMemo(() => [...new Set(items.map(criterionOf))].sort(), [items]);
  const readyCount = openItems.filter(liveReady).length;
  const needsTargetingCount = openItems.length - readyCount;

  const filtered = useMemo(() => {
    const search = filters.search.toLowerCase().trim();
    return openItems.filter((item) => {
      if (filters.sourceFilter === "deep_craft" && item.source === "surface_polish") return false;
      if (filters.sourceFilter === "surface_polish" && item.source !== "surface_polish") return false;
      if (filters.priority !== "all" && item.severity !== filters.priority) return false;
      if (filters.criterion !== "all" && criterionOf(item) !== filters.criterion) return false;
      if (search && !`${item.title} ${item.meta} ${item.criterion} ${item.anchor}`.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [filters.criterion, filters.priority, filters.search, filters.sourceFilter, openItems]);

  const active = filtered.find((item) => item.id === activeId) ?? filtered[0] ?? openItems[0] ?? items[0] ?? null;
  const activeIndex = active ? Math.max(0, filtered.findIndex((item) => item.id === active.id)) : 0;
  const invalidCandidates = active ? !OPTION_KEYS.every((key) => canSelectOption(active, key)) : false;
  const selectedText = active ? candidateText(active, selectedOption) : "";
  const visibleLedger = filters.status === "all" ? ledger : ledger.filter((entry) => decisionGroup(entry.decision) === filters.status);
  const counts = { accepted: ledger.filter((entry) => decisionGroup(entry.decision) === "accepted").length, pending: openItems.length };

  function selectItem(id: string) {
    setActiveId(id);
    setSelectedOption("A");
    setCustomOpen(false);
    setCustomText("");
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copied");
    } catch {
      setMessage("Copy failed");
    }
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
            localId: entry.id,
            opportunityId: item.id,
            opportunityTitle: item.title,
            decision: entry.decision,
            selectedOption: entry.option ?? null,
            selectedText: entry.selectedText ?? null,
            customText: entry.decision === "custom" ? entry.selectedText ?? null : null,
            sourceExcerpt: sourceTextOf(item) || null,
            sourceLocation: item.anchor || item.meta || null,
            clientCreatedAt: new Date().toISOString(),
            isUndo: false,
            undoneLocalId: null,
            metadata: { source: "workflow-revise-cockpit-v1", revisionOperation: effectiveOperation(item), criterion: criterionOf(item), severity: item.severity, scope: item.scope },
          }],
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error ?? "Ledger sync failed");
      setLedger((rows) => rows.map((row) => row.id === entry.id ? { ...row, syncStatus: "synced" } : row));
    } catch {
      setLedger((rows) => rows.map((row) => row.id === entry.id ? { ...row, syncStatus: "failed" } : row));
    }
  }

  function advanceAfterDecision(item: WorkbenchOpportunity) {
    const currentIndex = filtered.findIndex((row) => row.id === item.id);
    const next = filtered.slice(currentIndex + 1).find((row) => row.id !== item.id) ?? filtered.find((row) => row.id !== item.id) ?? null;
    setActiveId(next?.id ?? "");
    setSelectedOption("A");
    setCustomOpen(false);
    setCustomText("");
  }

  function decide(decision: DecisionState, option?: OptionKey, text?: string) {
    if (!active) return;
    if (option && !canSelectOption(active, option)) return;
    const entry: LedgerEntry = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      itemId: active.id,
      itemTitle: active.title,
      decision,
      option,
      selectedText: text?.trim() || undefined,
      criterion: criterionOf(active),
      syncStatus: "pending",
    };
    setLedger((rows) => [entry, ...rows.filter((row) => row.itemId !== active.id)]);
    setMessage(option ? `Selected ${option} moved to ledger` : `${decisionLabel(decision)} moved to ledger`);
    void sync(entry, active);
    advanceAfterDecision(active);
  }

  function unselect(entry: LedgerEntry) {
    setLedger((rows) => rows.filter((row) => row.itemId !== entry.itemId));
    setActiveId(entry.itemId);
    setMessage("Choice removed — opportunity returned to queue");
  }

  if (!payload.ok || items.length === 0) {
    const heldCount =
      (payload.needsTargeting?.length ?? 0) + (payload.withheldUnsupported?.length ?? 0);
    let heading = "No revision queue available.";
    let detail: string | null = null;
    if (!payload.ok) {
      heading = "Revise workbench couldn't load this evaluation.";
      detail = payload.error ?? "Please try reopening the report, or contact support if this persists.";
    } else if (heldCount > 0) {
      heading = `${heldCount} revision ${heldCount === 1 ? "opportunity" : "opportunities"} found, but none are ready to revise yet.`;
      detail =
        "These opportunities need targeting or additional grounding before RevisionGrade can offer copy-paste-ready rewrites. Re-run the evaluation or open Final Review to see the full ledger.";
    } else {
      heading = "No revision opportunities were found for this evaluation.";
      detail =
        "The manuscript passed the readiness checks that Revise targets, so there is nothing queued to revise.";
    }
    return (
      <main className="fixed inset-x-0 bottom-0 top-[72px] z-10 flex items-center justify-center bg-[#0D0A05] px-4 pb-5 pt-3">
        <div className="max-w-lg rounded-xl border border-[#C8A96E]/30 bg-[#1C160E] px-8 py-8 text-center shadow-2xl">
          <p className="text-base font-bold" style={{color: '#F5EFE4'}}>{heading}</p>
          {detail && <p className="mt-3 text-sm leading-relaxed" style={{color: '#D6C4A2'}}>{detail}</p>}
          {heldCount > 0 && (
            <p className="mt-4 text-xs" style={{color: '#C8A96E'}}>
              Use <strong style={{color: '#F5EFE4'}}>Final Review / Apply &amp; Export</strong> above to inspect the full ledger and export what is available.
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="fixed inset-x-0 bottom-0 top-[72px] z-10 overflow-hidden bg-[#0D0A05] px-4 pb-5 pt-3 text-[#F5EFE4]">
      <div className="mx-auto flex h-full max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-[#2E261A] bg-[#151008] shadow-2xl">
        <header className="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-[#2E261A] bg-[#151008] px-4 py-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#C8A96E]">Revision Cockpit · up to 100 prioritized opportunities per pass</p>
            <h1 className="text-sm font-semibold">{payload.manuscriptTitle}</h1>
          </div>
          {message && <div className="flex flex-wrap justify-end gap-2 text-[11px]"><span className="rounded border border-[#5D4C31] px-2 py-1 text-[#A9987D]">{message}</span></div>}
        </header>

        <nav className="flex shrink-0 items-center gap-1 border-b border-[#2E261A] bg-[#110D07] px-4 py-1.5">
          {([ ["all", "All"], ["deep_craft", "Craft"], ["surface_polish", "Surface Polish"] ] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilters((current) => ({ ...current, sourceFilter: value }))} className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${filters.sourceFilter === value ? "border border-[#C8A96E] bg-[#C8A96E]/20 text-[#F5EFE4]" : "border border-transparent text-[#A9987D] hover:text-[#F5EFE4]"}`}>
              {label}{value === "surface_polish" && <span className="ml-1 rounded bg-[#B8922A]/20 px-1 py-0.5 text-[9px] text-[#C8A96E]">Polish</span>}
            </button>
          ))}
        </nav>

        <section className="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-r border-[#2E261A] bg-[#110D07]">
            <div className="space-y-2 border-b border-[#2E261A] p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded border border-[#C8A96E]/70 bg-[#C8A96E]/10 px-2 py-1 text-[11px] font-semibold text-[#F3E3C3]">Queue{"\u2003"}{filtered.length ? activeIndex + 1 : 0}/{filtered.length}</span>
              </div>
              <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search queue" className="h-8 w-full rounded border border-[#3A3022] bg-[#0D0A05] px-2 text-xs" />
              <div className="grid grid-cols-2 gap-2">
                <select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value as Filters["priority"] }))} className="h-8 rounded border border-[#3A3022] bg-[#0D0A05] px-2 text-xs">
                  <option value="all">All priority</option><option value="must">Recommended</option><option value="should">Optional</option><option value="could">Consider</option>
                </select>
                <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as DecisionFilter }))} className="h-8 rounded border border-[#3A3022] bg-[#0D0A05] px-2 text-xs">
                  <option value="all">All status</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="custom">Custom</option><option value="kept_original">Author Kept Original</option><option value="rejected">Rejected</option><option value="deferred">Deferred</option>
                </select>
              </div>
              <select value={filters.criterion} onChange={(event) => setFilters((current) => ({ ...current, criterion: event.target.value }))} className="h-8 w-full rounded border border-[#3A3022] bg-[#0D0A05] px-2 text-xs">
                <option value="all">All Criteria</option>{criteria.map((criterion) => <option key={criterion} value={criterion}>{formatCriterion(criterion)}</option>)}
              </select>
            </div>

            <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {filtered.map((item, index) => (
                <li key={item.id}>
                  <button type="button" onClick={() => selectItem(item.id)} className={`w-full rounded-lg border p-2 text-left ${item.id === active?.id ? "border-[#C8A96E] bg-[#221B11]" : "border-[#2B241A] bg-[#161109]"}`}>
                    <div className="mb-1 flex flex-wrap gap-1">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${severityClass(item.severity)}`}>{severityLabel(item.severity)}</span>
                      <span className="rounded border border-[#4E4333] px-1.5 py-0.5 text-[10px]">{item.scope}</span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] ${liveReady(item) ? "border-[#48603F] text-[#BBD8B4]" : "border-[#7A2B1A] text-[#F1B6A5]"}`}>{liveReady(item) ? "Ready" : "Needs Targeting"}</span>
                      <span className="rounded border border-[#4E4333] px-1.5 py-0.5 text-[10px] text-[#A9987D]">pending</span>
                    </div>
                    <p className="line-clamp-2 text-xs leading-4">{index + 1}. {item.title}</p>
                    <p className="mt-1 truncate text-[11px] text-[#A9987D]">{formatCriterion(criterionOf(item))} · {item.anchor || item.meta}</p>
                  </button>
                </li>
              ))}
            </ol>
          </aside>

          <section className="flex min-w-0 flex-col overflow-hidden bg-[#1C160E]">
            {active ? (
              <>
                <div className="shrink-0 border-b border-[#2E261A] px-2 pb-2 pt-1.5">
                  <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-[#C8A96E]">Diagnosis & Guardrails</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider">
                    <span className={`rounded px-1.5 py-0.5 ${severityClass(active.severity)}`}>{severityLabel(active.severity)}</span>
                    <span className="rounded border border-[#5A4B33] px-1.5 py-0.5">{formatCriterion(criterionOf(active))}</span>
                    <span className="rounded border border-[#5A4B33] px-1.5 py-0.5">{active.scope}</span>
                    <span className={`rounded border px-1.5 py-0.5 ${liveReady(active) ? "border-[#48603F] text-[#BBD8B4]" : "border-[#7A2B1A] text-[#F1B6A5]"}`}>{liveReady(active) ? "Ready" : "Needs Targeting"}</span>
                  </div>
                  <h2 className="mt-1 truncate text-base font-semibold">{active.title}</h2>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
                  <section className="rounded-lg border border-[#2E261A] bg-[#12100B] px-2 py-1.5">
                    <div className="grid gap-x-4 gap-y-1.5 text-xs leading-relaxed xl:grid-cols-2">
                      <p><span className="font-bold text-[#F0C060]">Symptom:</span> <span className="text-[#F0E8D5]">{diagnosticText(active, "symptom")}</span></p>
                      <p><span className="font-bold text-[#F0C060]">Cause:</span> <span className="text-[#F0E8D5]">{diagnosticText(active, "cause")}</span></p>
                      <p><span className="font-bold text-[#F0C060]">Fix:</span> <span className="text-[#F0E8D5]">{diagnosticText(active, "fix")}</span></p>
                      <p><span className="font-bold text-[#F0C060]">Reader effect:</span> <span className="text-[#F0E8D5]">{diagnosticText(active, "readerEffect")}</span></p>
                      <p><span className="font-bold text-[#F0C060]">Mistake-proofing:</span> <span className="text-[#F0E8D5]">{diagnosticText(active, "mistakeProofing")}</span></p>
                      <p><span className="font-bold text-[#F0C060]">Operation:</span> <span className="text-[#F0E8D5]">{operationLabels[effectiveOperation(active)]}</span></p>
                    </div>
                  </section>

                  {/* ── Three-tier display: passage + candidates ── */}
                  {(() => {
                    const mode = displayMode(active);
                    const source = sourceTextOf(active);
                    const allCandidatesHaveResidue = OPTION_KEYS.every((k) => {
                      const t = candidateText(active, k);
                      return !t || hasTemplateResidue(t);
                    });
                    const effectiveMode = allCandidatesHaveResidue ? "strategy_only" : mode;

                    return (
                      <>
                        {/* Original Passage — adapts by mode */}
                        <section className="mt-1.5 grid gap-2 xl:grid-cols-2">
                          <div className="rounded-lg border border-[#2E261A] bg-[#12100B] px-2 py-1.5">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-[#C8A96E]">Original Passage</p>
                              {effectiveMode !== "full_replacement" && source && (
                                <span className="text-[9px] text-[#A9987D]">
                                  {source.split(/\s+/).length} words
                                  {effectiveMode === "excerpt_insertion" && " · excerpt shown"}
                                  {effectiveMode === "strategy_only" && " · anchor only"}
                                </span>
                              )}
                            </div>
                            {effectiveMode === "full_replacement" ? (
                              <p className="mt-1 max-h-24 overflow-y-auto text-xs leading-relaxed text-[#E5D8BE]">{source || "No exact passage is available yet."}</p>
                            ) : (
                              <>
                                <p className="mt-1 max-h-20 overflow-y-auto text-xs leading-relaxed text-[#E5D8BE]">
                                  {source ? excerptText(source, effectiveMode === "strategy_only" ? 2 : 3) : "No exact passage is available yet."}
                                </p>
                                {source && source.split(/\s+/).length > (effectiveMode === "strategy_only" ? 50 : 80) && (
                                  <details className="mt-1">
                                    <summary className="cursor-pointer text-[10px] text-[#C8A96E] hover:text-[#F3E3C3]">View full passage</summary>
                                    <p className="mt-1 max-h-40 overflow-y-auto rounded border border-[#2E261A] bg-[#0D0A05] p-2 text-xs leading-relaxed text-[#E5D8BE]">{source}</p>
                                  </details>
                                )}
                              </>
                            )}
                            <p className="mt-0.5 text-[10px] text-[#A9987D]">{active.anchor || active.meta || "Location pending"}</p>
                          </div>
                          <div className="rounded-lg border border-[#2E261A] bg-[#12100B] px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[#C8A96E]">Revision Task</p>
                            <p className="mt-1 text-xs leading-relaxed text-[#E5D8BE]">{operationInstruction(active)} {compactGoal(active)}</p>
                          </div>
                        </section>

                        {/* A/B/C Candidates — full prose OR strategy mode */}
                        {effectiveMode === "strategy_only" ? (
                          <section className="mt-1.5 rounded-lg border border-[#2E261A] bg-[#12100B] px-2 py-2">
                            {rewriteCache[active.id]?.error ? (
                              // Persistent error state — shown until user retries
                              <>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E2B2A6]">Generation Failed</p>
                                <p className="mb-2 rounded border border-[#7A2B1A]/60 bg-[#7A2B1A]/10 px-2 py-1.5 text-xs leading-relaxed text-[#F1B6A5]">{rewriteCache[active.id].error}</p>
                                {source && source.split(/\s+/).length <= 1200 && (
                                  <button
                                    type="button"
                                    onClick={() => { setRewriteCache((prev) => { const next = { ...prev }; delete next[active.id]; return next; }); void generateVoiceRewrite(active); }}
                                    disabled={rewriteLoading === active.id}
                                    className="mt-1 w-full rounded border border-[#6B8F5E] bg-[#6B8F5E]/10 px-3 py-1.5 text-xs font-semibold text-[#A8D99C] hover:bg-[#6B8F5E]/20 disabled:opacity-50"
                                  >
                                    {rewriteLoading === active.id ? "Retrying…" : "Retry Generate"}
                                  </button>
                                )}
                              </>
                            ) : rewriteCache[active.id]?.a ? (
                              <>
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#C8A96E]">Voice-Generated Rewrites</p>
                                  <span className="text-[9px] text-[#6B8F5E]">Generated in author voice</span>
                                </div>
                                <div className="space-y-2">
                                  {OPTION_KEYS.map((key) => {
                                    const label = key === "A" ? "Recommended" : key === "B" ? "Quieter" : "Bolder";
                                    const rewrite = rewriteCache[active.id][key.toLowerCase() as "a" | "b" | "c"];
                                    return (
                                      <div key={key} className={`rounded border px-2 py-1.5 ${selectedOption === key ? "border-[#C8A96E] bg-[#1A140C]" : "border-[#2E261A]"}`}>
                                        <button type="button" onClick={() => setSelectedOption(key)} className="w-full text-left">
                                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#C8A96E]">{REVISION_OPTION_LABELS[key]} — {label}</span>
                                          <p className="mt-0.5 max-h-24 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-[#E5D8BE]">{rewrite}</p>
                                        </button>
                                        <div className="mt-1 flex gap-1">
                                          <button type="button" onClick={() => void navigator.clipboard.writeText(rewrite).then(() => setMessage("Copied"))} className="rounded border border-[#5D4C31] px-1.5 py-0.5 text-[10px] text-[#C8A96E]">Copy</button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="text-[10px] uppercase tracking-[0.18em] text-[#C8A96E] mb-1.5">Revision Strategies</p>
                                <p className="text-[10px] text-[#A9987D] mb-2">
                                  {source && source.split(/\s+/).length > 1200
                                    ? "Passage too large for inline replacement. Choose a strategy approach:"
                                    : "Template residue detected. Choose a strategy approach or generate voice rewrites:"}
                                </p>
                                <div className="space-y-2">
                                  {OPTION_KEYS.map((key) => {
                                    const goal = compactGoal(active);
                                    const strategyMeta: Record<OptionKey, { label: string; approach: string }> = {
                                      A: { label: "Recommended Repair—Conservative", approach: `Implement the fix at minimum scope: ${goal}` },
                                      B: { label: "Rhythm Variant—Scene-Driven", approach: `Anchor the same repair in concrete action or sensory detail rather than exposition. ${goal}` },
                                      C: { label: "Bolder Rendering Shift—Structural", approach: `Reframe the structural context entirely: consider a different order, a cut, or a tonal pivot. ${goal}` },
                                    };
                                    const { label, approach } = strategyMeta[key];
                                    return (
                                      <div key={key} className={`rounded border px-2 py-1.5 ${selectedOption === key ? "border-[#C8A96E] bg-[#1A140C]" : "border-[#2E261A]"}`}>
                                        <button type="button" onClick={() => setSelectedOption(key)} className="w-full text-left">
                                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#C8A96E]">{REVISION_OPTION_LABELS[key]} — {label}</span>
                                          <p className="mt-0.5 text-xs leading-relaxed text-[#E5D8BE]">{approach}</p>
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                                {/* Generate in Voice button — only for ≤1200 word passages */}
                                {source && source.split(/\s+/).length <= 1200 && (
                                  <button
                                    type="button"
                                    onClick={() => void generateVoiceRewrite(active)}
                                    disabled={rewriteLoading === active.id}
                                    className="mt-2 w-full rounded border border-[#6B8F5E] bg-[#6B8F5E]/10 px-3 py-1.5 text-xs font-semibold text-[#A8D99C] hover:bg-[#6B8F5E]/20 disabled:opacity-50"
                                  >
                                    {rewriteLoading === active.id ? "Generating in author voice…" : "Generate Draft in Author Voice"}
                                  </button>
                                )}
                              </>
                            )}
                          </section>
                        ) : (
                          <section className="mt-1.5">
                            <div className="mb-1 flex items-center gap-2">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-[#C8A96E]">Compare A/B/C Options</p>
                              {invalidCandidates && <span className="ml-auto text-[10px] text-[#E2B2A6]">Awaiting passage</span>}
                            </div>
                            <div className="grid gap-2 xl:grid-cols-3">
                              {OPTION_KEYS.map((key) => {
                                const text = candidateDisplayText(active, key);
                                const ok = canSelectOption(active, key);
                                const selected = selectedOption === key;
                                const role = key === "A" ? "Recommended Repair" : key === "B" ? "Rhythm Variant" : "Bolder Rendering Shift";
                                return (
                                  <article key={key} className={`rounded-lg border bg-[#12100B] px-2 py-2 ${selected ? "border-[#C8A96E]" : "border-[#2E261A]"}`}>
                                    <button type="button" onClick={() => setSelectedOption(key)} className="w-full text-left">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#C8A96E]">{REVISION_OPTION_LABELS[key]}</span>
                                        <span className="text-[9px] text-[#A9987D]">{role}</span>
                                      </div>
                                      <p className={`line-clamp-4 min-h-[3rem] whitespace-pre-wrap text-xs leading-5 ${ok ? "text-[#E5D8BE]" : "text-[#A9987D] italic"}`}>
                                        {text || "Prose not yet generated — click \u201cGenerate Distinct A/B/C Drafts\u201d below to create three different options."}
                                      </p>
                                    </button>
                                    {text && text.length > 190 ? (
                                      <details className="mt-1.5">
                                        <summary className="cursor-pointer text-[10px] text-[#C8A96E] hover:text-[#F3E3C3]">Show full fix</summary>
                                        <p className="mt-1 max-h-28 overflow-y-auto rounded border border-[#2E261A] bg-[#0D0A05] p-1.5 whitespace-pre-wrap text-xs leading-relaxed text-[#E5D8BE]">{text}</p>
                                      </details>
                                    ) : null}
                                    <button type="button" onClick={() => void copyText(text)} disabled={!ok} className="mt-1.5 rounded border border-[#5D4C31] px-1.5 py-0.5 text-[10px] disabled:opacity-40">Copy</button>
                                  </article>
                                );
                              })}
                            </div>
                            {/* Generate button when any option is missing prose */}
                            {OPTION_KEYS.some((k) => !canSelectOption(active, k)) && (
                              <>
                                {rewriteCache[active.id]?.error && (
                                  <p className="mt-2 rounded border border-[#7A2B1A]/60 bg-[#7A2B1A]/10 px-2 py-1.5 text-xs leading-relaxed text-[#F1B6A5]">{rewriteCache[active.id].error}</p>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (rewriteCache[active.id]?.error) {
                                      setRewriteCache((prev) => { const next = { ...prev }; delete next[active.id]; return next; });
                                    }
                                    void generateVoiceRewrite(active);
                                  }}
                                  disabled={rewriteLoading === active.id}
                                  className="mt-2 w-full rounded border border-[#6B8F5E] bg-[#6B8F5E]/10 px-3 py-1.5 text-xs font-semibold text-[#A8D99C] hover:bg-[#6B8F5E]/20 disabled:opacity-50"
                                >
                                  {rewriteLoading === active.id
                                    ? "Generating distinct A/B/C drafts in author voice…"
                                    : rewriteCache[active.id]?.error
                                      ? "Retry Generate Distinct A/B/C Drafts"
                                      : "Generate Distinct A/B/C Drafts in Author Voice"}
                                </button>
                              </>
                            )}
                          </section>
                        )}
                      </>
                    );
                  })()}

                  {customOpen && (
                    <div className="mt-1.5 rounded-lg border border-[#C8A96E]/60 bg-[#120E08] px-2 py-1.5">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-[#C8A96E]">Author custom revision</p>
                      <textarea value={customText} onChange={(event) => setCustomText(event.target.value)} rows={3} className="mt-1 w-full rounded border border-[#3A3022] bg-[#0D0A05] p-2 font-mono text-xs" />
                      <button disabled={!customText.trim()} onClick={() => decide("custom", undefined, customText)} className="mt-1 rounded bg-[#C8A96E] px-2 py-1 text-xs font-semibold text-[#1A140C] disabled:opacity-50">Save custom</button>
                    </div>
                  )}
                </div>

                <footer className="shrink-0 border-t border-[#2E261A] bg-[#120E08] px-2 py-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(() => {
                      const mode = displayMode(active);
                      const allResidue = OPTION_KEYS.every((k) => { const t = candidateText(active, k); return !t || hasTemplateResidue(t); });
                      const effectiveMode = allResidue ? "strategy_only" : mode;
                      const insertLabel = effectiveMode === "excerpt_insertion" ? "Insert" : "Accept";

                      if (effectiveMode === "strategy_only") {
                        const hasVoiceRewrite = !!(rewriteCache[active.id]?.a);
                        if (hasVoiceRewrite) {
                          const rw = rewriteCache[active.id];
                          return (
                            <>
                              <button onClick={() => decide("accepted_a", "A", rw.a)} className="rounded bg-[#C8A96E] px-2.5 py-1 text-xs font-semibold text-[#1A140C]">Accept A</button>
                              <button onClick={() => decide("accepted_b", "B", rw.b)} className="rounded border border-[#C8A96E] px-2.5 py-1 text-xs">Accept B</button>
                              <button onClick={() => decide("accepted_c", "C", rw.c)} className="rounded border border-[#C8A96E] px-2.5 py-1 text-xs">Accept C</button>
                              <button onClick={() => decide("keep_original", undefined, "Kept original")} className="rounded border border-[#5D4C31] px-2 py-1 text-xs">Keep Original</button>
                              <button onClick={() => decide("reject", undefined, "Rejected suggestions")} className="rounded border border-[#7A2B1A]/70 px-2 py-1 text-xs text-[#E2B2A6]">Reject All</button>
                              <button onClick={() => decide("deferred", undefined, "Deferred for later decision")} className="rounded border border-[#5C5140] px-2 py-1 text-xs">Defer</button>
                              <button onClick={() => { if (!customOpen) setCustomText(rw.a); setCustomOpen(true); }} className="rounded border border-[#C8A96E] bg-[#C8A96E]/10 px-2 py-1 text-xs">Custom Rewrite</button>
                            </>
                          );
                        }
                        return (
                          <>
                            <span className="rounded border border-[#5D4C31] px-2.5 py-1 text-xs text-[#A9987D]">Needs exact A/B/C prose before acceptance</span>
                            <button onClick={() => decide("reject", undefined, "Rejected suggestions")} className="rounded border border-[#7A2B1A]/70 px-2 py-1 text-xs text-[#E2B2A6]">Reject All</button>
                            <button onClick={() => decide("deferred", undefined, "Deferred for later decision")} className="rounded border border-[#5C5140] px-2 py-1 text-xs">Defer</button>
                            <button onClick={() => { if (!customOpen) setCustomText(""); setCustomOpen(true); }} className="rounded border border-[#C8A96E] bg-[#C8A96E]/10 px-2 py-1 text-xs">Custom Rewrite</button>
                          </>
                        );
                      }
                      return (
                        <>
                          <button onClick={() => decide("accepted_a", "A", candidateText(active, "A"))} disabled={!canSelectOption(active, "A")} className="rounded bg-[#C8A96E] px-2.5 py-1 text-xs font-semibold text-[#1A140C] disabled:opacity-40">{insertLabel} A</button>
                          <button onClick={() => decide("accepted_b", "B", candidateText(active, "B"))} disabled={!canSelectOption(active, "B")} className="rounded border border-[#C8A96E] px-2.5 py-1 text-xs disabled:opacity-40">{insertLabel} B</button>
                          <button onClick={() => decide("accepted_c", "C", candidateText(active, "C"))} disabled={!canSelectOption(active, "C")} className="rounded border border-[#C8A96E] px-2.5 py-1 text-xs disabled:opacity-40">{insertLabel} C</button>
                          <button onClick={() => decide("keep_original", undefined, "Kept original")} className="rounded border border-[#5D4C31] px-2 py-1 text-xs">Keep Original</button>
                          <button onClick={() => decide("reject", undefined, "Rejected suggestions")} className="rounded border border-[#7A2B1A]/70 px-2 py-1 text-xs text-[#E2B2A6]">Reject All</button>
                          <button onClick={() => decide("deferred", undefined, "Deferred for later decision")} className="rounded border border-[#5C5140] px-2 py-1 text-xs">Defer</button>
                          <button onClick={() => { if (customOpen && customText.trim()) { decide("custom", undefined, customText); } else { if (!customOpen) setCustomText(selectedText); setCustomOpen(true); } }} className="rounded border border-[#C8A96E] bg-[#C8A96E]/10 px-2 py-1 text-xs">{customOpen && customText.trim() ? "Save Custom" : (customOperationLabels[effectiveOperation(active)] ?? "Custom Rewrite")}</button>
                        </>
                      );
                    })()}
                  </div>
                </footer>
              </>
            ) : (
              <div className="m-3 rounded-xl border border-[#2E261A] bg-[#12100B] p-6 text-[#CBBDA4]">No open opportunities match the current filters.</div>
            )}

            <section className="shrink-0 border-t border-[#2E261A] bg-[#0D0A05] px-3 pb-3 pt-3">
              {ledger.length === 0 ? (
                <div className="flex gap-3 rounded border border-[#2E261A] bg-[#120E08] px-3 py-2 text-xs"><span className="uppercase tracking-[0.16em] text-[#C8A96E]">Revision Ledger</span><span className="text-[#A9987D]">No decisions yet.</span></div>
              ) : (
                <>
                  <div className="mb-2 flex flex-wrap gap-2 text-xs"><span className="mr-2 uppercase tracking-[0.16em] text-[#C8A96E]">Revision Ledger</span>{LEDGER_FILTERS.map((filter) => <button key={filter.value} type="button" onClick={() => setFilters((current) => ({ ...current, status: filter.value }))} className={`rounded border px-2 py-1 ${filters.status === filter.value ? "border-[#C8A96E] text-[#F5EFE4]" : "border-[#3A3022] text-[#A9987D]"}`}>{filter.label}</button>)}</div>
                  <div className="max-h-32 overflow-y-auto rounded border border-[#2E261A]">
                    <table className="w-full text-left text-xs"><thead className="sticky top-0 bg-[#171006] text-[#C8A96E]"><tr><th className="px-2 py-1">Decision</th><th className="px-2 py-1">Criterion</th><th className="px-2 py-1">Item</th><th className="px-2 py-1">Status</th><th className="px-2 py-1">Action</th></tr></thead><tbody>{visibleLedger.map((entry) => <tr key={entry.id} className="border-t border-[#2E261A]"><td className="px-2 py-1">{decisionLabel(entry.decision)}{entry.option ? ` (${entry.option})` : ""}</td><td className="px-2 py-1">{entry.criterion}</td><td className="px-2 py-1">{entry.itemTitle}</td><td className="px-2 py-1">{entry.syncStatus}</td><td className="px-2 py-1"><button onClick={() => unselect(entry)} className="rounded border border-[#5D4C31] px-2 py-0.5 text-[#C8A96E]">Unselect</button></td></tr>)}</tbody></table>
                  </div>
                </>
              )}
            </section>
          </section>
        </section>
      </div>
    </main>
  );
}

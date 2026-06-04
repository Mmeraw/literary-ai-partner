"use client";

import { useMemo, useState } from "react";
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

function rawCandidate(item: WorkbenchOpportunity, key: OptionKey): string {
  const option = optionFor(item, key);
  if (!option) return "";
  return normalize(option.candidateText ?? option.text);
}

function renderableCandidate(item: WorkbenchOpportunity, key: OptionKey): string {
  const option = optionFor(item, key);
  if (!option) return "";
  return getRenderableCandidateText({ candidateText: option.candidateText ?? option.text, issueStatement: item.issueStatement });
}

function stripEvidenceWrapper(value: string): string {
  let text = normalize(value);
  text = text.replace(/^Evidence:\s*/i, "");
  text = text.replace(/^Original Passage\s*/i, "");
  text = text.replace(/^LOCATION\s*/i, "");
  text = text.replace(/^Recommendation:\s*/i, "");
  text = text.replace(/^“(.+)”$/u, "$1");
  text = text.replace(/^"(.+)"$/u, "$1");
  return text.trim();
}

function trimWords(value: string, maxWords: number): string {
  const words = normalize(value).split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return normalize(value);
  return `${words.slice(0, maxWords).join(" ").replace(/[,;:—–-]+$/, "")}.`;
}

function sentenceUnits(value: string): string[] {
  const clean = stripEvidenceWrapper(value);
  const matches = clean.match(/[^.!?]+[.!?][”"']?/g);
  if (matches && matches.length > 0) return matches.map((item) => item.trim()).filter(Boolean);
  return clean ? [clean] : [];
}

function extractSpeech(value: string): { setup: string; speaker: string; verb: string; speech: string } | null {
  const clean = stripEvidenceWrapper(value);
  const match = clean.match(/^(.*?\b)?([A-Z][A-Za-z’'\-]+)\s+(said|asked|whispered|muttered|shouted|called|cried),\s*[“"](.+?)[”"]\.?$/u);
  if (!match) return null;
  return {
    setup: normalize(match[1] ?? ""),
    speaker: match[2],
    verb: match[3],
    speech: normalize(match[4]),
  };
}

function quoteSpeech(text: string): string {
  const clean = normalize(text).replace(/^['"“”]+|['"“”]+$/g, "");
  return `“${clean}”`;
}

function fallbackCharacters(item: WorkbenchOpportunity): string[] {
  const haystack = `${item.title} ${item.issueStatement} ${sourceTextOf(item)} ${item.fixDirection}`;
  const names = [...haystack.matchAll(/\b[A-Z][a-z]{2,}(?:’s)?\b/g)]
    .map((match) => match[0].replace(/’s$/, ""))
    .filter((name) => ![
      "The", "This", "That", "At", "Item", "Line", "Passage", "Scene", "Chapter",
      "Kingdom", "Lake", "Concept", "Core", "Premise", "Needs", "Targeting",
      // Editorial instruction verbs that may be capitalized at sentence start
      "Deepen", "Expand", "Clarify", "Strengthen", "Tighten", "Compress", "Heighten",
      "Foreground", "Surface", "Sharpen", "Simplify", "Brighten", "Replace", "Repair",
      "Rewrite", "Restructure", "Dramatize", "Intensify", "Underscore", "Anchor",
      "Ground", "Dial", "Trim", "Cut", "Develop", "Revise", "Remove", "Break",
      "Insert", "Weave", "Highlight", "Show", "Add", "Fix",
    ].includes(name));
  return [...new Set(names)].slice(0, 3);
}

function compressedCandidates(item: WorkbenchOpportunity): Record<OptionKey, string> {
  const source = stripEvidenceWrapper(sourceTextOf(item));
  const speech = extractSpeech(source);
  if (speech) {
    const shortSpeech = speech.speech.split(/(?<=[.!?])\s+/)[0] || speech.speech;
    const strongerSpeech = shortSpeech.includes("toadstone")
      ? shortSpeech.replace(/\.\s*Imagine .+$/i, ".")
      : shortSpeech;
    return {
      A: `${speech.setup ? `${speech.setup}, ` : ""}${speech.speaker} ${speech.verb}, ${quoteSpeech(strongerSpeech)}`,
      B: `${speech.setup ? `${speech.setup}. ` : ""}${quoteSpeech(strongerSpeech)} ${speech.speaker} ${speech.verb}.`,
      C: `${speech.speaker} waited for the air to clear. ${quoteSpeech(strongerSpeech)}`,
    };
  }

  const sentences = sentenceUnits(source);
  const first = sentences[0] ?? source;
  const second = sentences[1] ?? "";
  return {
    A: trimWords(first, 28),
    B: trimWords(second ? `${first} ${second}` : first, 34),
    C: trimWords(first.replace(/\bvery\b|\breally\b|\bjust\b/gi, "").replace(/\s+/g, " "), 24),
  };
}

function replacementCandidates(item: WorkbenchOpportunity): Record<OptionKey, string> {
  const source = stripEvidenceWrapper(sourceTextOf(item));
  const speech = extractSpeech(source);
  if (speech) return compressedCandidates(item);

  const sentences = sentenceUnits(source);
  const base = trimWords(sentences.slice(0, 2).join(" ") || source, 46);
  const names = fallbackCharacters(item);
  const leadName = names[0] ?? "The moment";
  return {
    A: base,
    B: `${leadName} held still long enough for the choice to register, and the moment tightened around it.`,
    C: `${leadName} felt the cost before anyone named it, and the scene moved on with that pressure still in the air.`,
  };
}

function insertionCandidates(item: WorkbenchOpportunity): Record<OptionKey, string> {
  const names = fallbackCharacters(item);
  const lead = names[0] ?? "He";
  const other = names[1] ?? "the others";
  return {
    A: `${lead} hesitated, and the small delay told ${other} more than he meant to reveal.`,
    B: `${lead} felt the choice land before he made it, a pressure no one else had to name.`,
    C: `${lead} looked away first, and that was enough for the moment to claim its price.`,
  };
}

function synthesizedCandidate(item: WorkbenchOpportunity, key: OptionKey): string {
  const operation = effectiveOperation(item);
  const source = sourceTextOf(item);
  if (!source && operation !== "insert_before_selected_passage" && operation !== "insert_after_selected_passage") return "";

  const candidates = operation === "compress_selected_passage"
    ? compressedCandidates(item)
    : operation === "insert_before_selected_passage" || operation === "insert_after_selected_passage"
      ? insertionCandidates(item)
      : replacementCandidates(item);

  const candidate = candidates[key];
  if (!candidateTextIsCopyPasteReady(candidate)) return "";
  return candidate;
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

  const raw = rawCandidate(item, key);
  if (raw && candidateTextIsCopyPasteReady(raw) && !candidateRepeatsSourceForInsertion(item, raw)) return raw;

  const synthesized = synthesizedCandidate(item, key);
  if (synthesized && !candidateRepeatsSourceForInsertion(item, synthesized)) return synthesized;

  return "";
}

function canSelectOption(item: WorkbenchOpportunity, key: OptionKey): boolean {
  const text = candidateText(item, key);
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
  if (severity === "must") return "border-[#7A2B1A]/70 bg-[#7A2B1A]/25 text-[#F1B6A5]";
  if (severity === "should") return "border-[#C8A96E]/60 bg-[#C8A96E]/15 text-[#EAD8AE]";
  return "border-[#48603F]/70 bg-[#2D3B2A]/35 text-[#BBD8B4]";
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
  const allInputItems = useMemo(() => [...payload.opportunities, ...(payload.needsTargeting ?? [])], [payload.opportunities, payload.needsTargeting]);
  const [activeId, setActiveId] = useState(allInputItems[0]?.id ?? "");
  const [selectedOption, setSelectedOption] = useState<OptionKey>("A");
  const [filters, setFilters] = useState<Filters>({ search: "", priority: "all", criterion: "all", status: "all", sourceFilter: "all" });
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

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
    return <main className="fixed inset-x-0 bottom-0 top-[72px] flex items-center justify-center bg-[#0D0A05] px-4 pb-5 pt-3 text-[#F5EFE4]">No revision queue available.</main>;
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
                      <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${severityClass(item.severity)}`}>{item.severity}</span>
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
                    <span className={`rounded px-1.5 py-0.5 ${severityClass(active.severity)}`}>{active.severity}</span>
                    <span className="rounded border border-[#5A4B33] px-1.5 py-0.5">{formatCriterion(criterionOf(active))}</span>
                    <span className="rounded border border-[#5A4B33] px-1.5 py-0.5">{active.scope}</span>
                    <span className={`rounded border px-1.5 py-0.5 ${liveReady(active) ? "border-[#48603F] text-[#BBD8B4]" : "border-[#7A2B1A] text-[#F1B6A5]"}`}>{liveReady(active) ? "Ready" : "Needs Targeting"}</span>
                  </div>
                  <h2 className="mt-1 truncate text-base font-semibold">{active.title}</h2>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
                  <section className="rounded-lg border border-[#2E261A] bg-[#12100B] px-2 py-1.5">
                    <div className="grid gap-x-3 gap-y-0.5 text-xs leading-4 xl:grid-cols-2">
                      <p><span className="text-[#C8A96E]">Symptom:</span> {diagnosticText(active, "symptom")}</p>
                      <p><span className="text-[#C8A96E]">Cause:</span> {diagnosticText(active, "cause")}</p>
                      <p><span className="text-[#C8A96E]">Fix:</span> {diagnosticText(active, "fix")}</p>
                      <p><span className="text-[#C8A96E]">Reader effect:</span> {diagnosticText(active, "readerEffect")}</p>
                      <p><span className="text-[#C8A96E]">Mistake-proofing:</span> {diagnosticText(active, "mistakeProofing")}</p>
                      <p><span className="text-[#C8A96E]">Operation:</span> {operationLabels[effectiveOperation(active)]}</p>
                    </div>
                  </section>

                  <section className="mt-1.5 grid gap-2 xl:grid-cols-2">
                    <div className="rounded-lg border border-[#2E261A] bg-[#12100B] px-2 py-1.5">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[#C8A96E]">Original Passage</p>
                      <p className="mt-1 max-h-16 overflow-y-auto text-xs leading-4">{sourceTextOf(active) || "No exact passage is available yet."}</p>
                      <p className="mt-0.5 text-[10px] text-[#A9987D]">{active.anchor || active.meta || "Location pending"}</p>
                    </div>
                    <div className="rounded-lg border border-[#2E261A] bg-[#12100B] px-2 py-1.5">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[#C8A96E]">Revision Task</p>
                      <p className="mt-1 text-xs leading-4">{operationInstruction(active)} {compactGoal(active)}</p>
                    </div>
                  </section>

                  <section className="mt-1.5">
                    <div className="flex items-center gap-1">
                      {OPTION_KEYS.map((key) => {
                        const focused = selectedOption === key;
                        return <button key={key} type="button" onClick={() => setSelectedOption(key)} className={`rounded-t px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${focused ? "border border-b-0 border-[#C8A96E] bg-[#12100B] text-[#F3E3C3]" : "border border-transparent text-[#A9987D] hover:text-[#F3E3C3]"}`}>{REVISION_OPTION_LABELS[key]}</button>;
                      })}
                      {invalidCandidates && <span className="ml-auto text-[10px] text-[#E2B2A6]">Awaiting passage</span>}
                    </div>
                    {(() => { const key = selectedOption || "A"; const text = candidateText(active, key); const ok = canSelectOption(active, key); return (
                      <div className="rounded-b-lg rounded-tr-lg border border-[#2E261A] bg-[#12100B] px-2 py-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`line-clamp-3 whitespace-pre-wrap text-xs leading-4 ${ok ? "text-[#E5D8BE]" : "text-[#E2B2A6]"}`}>{text || "Candidate generation needs an exact source passage."}</p>
                          <div className="flex shrink-0 gap-1">
                            <button type="button" onClick={() => void copyText(text)} disabled={!ok} className="rounded border border-[#5D4C31] px-1.5 py-0.5 text-[10px] disabled:opacity-40">Copy</button>
                          </div>
                        </div>
                      </div>
                    ); })()}
                  </section>

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
                    <button onClick={() => decide("accepted_a", "A", candidateText(active, "A"))} disabled={!canSelectOption(active, "A")} className="rounded bg-[#C8A96E] px-2.5 py-1 text-xs font-semibold text-[#1A140C] disabled:opacity-40">Accept A</button>
                    <button onClick={() => decide("accepted_b", "B", candidateText(active, "B"))} disabled={!canSelectOption(active, "B")} className="rounded border border-[#C8A96E] px-2.5 py-1 text-xs disabled:opacity-40">Accept B</button>
                    <button onClick={() => decide("accepted_c", "C", candidateText(active, "C"))} disabled={!canSelectOption(active, "C")} className="rounded border border-[#C8A96E] px-2.5 py-1 text-xs disabled:opacity-40">Accept C</button>
                    <button onClick={() => decide("keep_original", undefined, "Kept original")} className="rounded border border-[#5D4C31] px-2 py-1 text-xs">Keep Original</button>
                    <button onClick={() => decide("reject", undefined, "Rejected suggestions")} className="rounded border border-[#7A2B1A]/70 px-2 py-1 text-xs text-[#E2B2A6]">Reject</button>
                    <button onClick={() => decide("deferred", undefined, "Deferred for later decision")} className="rounded border border-[#5C5140] px-2 py-1 text-xs">Defer</button>
                    <button onClick={() => { if (customOpen && customText.trim()) { decide("custom", undefined, customText); } else { if (!customOpen) setCustomText(selectedText); setCustomOpen(true); } }} className="rounded border border-[#C8A96E] bg-[#C8A96E]/10 px-2 py-1 text-xs">{customOpen && customText.trim() ? "Save Custom" : (customOperationLabels[effectiveOperation(active)] ?? "Write Custom")}</button>
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

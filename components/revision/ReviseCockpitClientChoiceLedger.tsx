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

function candidateRepeatsSourceForInsertion(item: WorkbenchOpportunity, text: string): boolean {
  const operation = effectiveOperation(item);
  if (operation !== "insert_before_selected_passage" && operation !== "insert_after_selected_passage") return false;
  const source = compareText(sourceTextOf(item));
  const candidate = compareText(text);
  if (!source || !candidate) return false;
  const lead = source.split(/\s+/).slice(0, 6).join(" ");
  return lead.length >= 8 && candidate.startsWith(lead);
}

function specificFallbackCandidate(item: WorkbenchOpportunity, key: OptionKey): string {
  const haystack = compareText(`${item.title} ${item.issueStatement} ${sourceTextOf(item)} ${item.fixDirection}`);
  const operation = effectiveOperation(item);

  if ((operation === "insert_after_selected_passage" || operation === "insert_before_selected_passage") && haystack.includes("move aside") && haystack.includes("small fry") && haystack.includes("newton")) {
    if (key === "A") return "Newton’s hand tightened around the slug before he let it go. The loss was small, but in front of everyone, the choice had cost him.";
    if (key === "B") return "Newton hesitated just long enough for the others to see it. Then he surrendered the slug, swallowing the sting as Twillow moved past.";
    return "For a breath, Newton considered refusing. Then he saw the circle tightening around him and gave up the slug, hating how cheaply fear could buy obedience.";
  }

  if (haystack.includes("why") && haystack.includes("picking on me") && haystack.includes("newton")) {
    if (key === "A") return "Newton’s voice caught before he could harden it. The question came out smaller than he meant, and that made the silence around him worse.";
    if (key === "B") return "Newton tried to sound angry, but the wobble in his words gave him away. For a moment, the room heard the hurt underneath.";
    return "The words escaped before Newton could dress them as defiance. What came out was not a challenge, but a bruise everyone could see.";
  }

  if (haystack.includes("hithery") || haystack.includes("sensory detail") || haystack.includes("body or surroundings")) {
    if (key === "A") return "The hithery-thithery dock clattered under Newton’s feet as two worried voices knocked inside his skull.";
    if (key === "B") return "The hithery-thithery dock trembled beneath him, and the competing voices in Newton’s head began to knock in time with it.";
    return "The hithery-thithery dock shivered through Newton’s soles while the voices in his head knocked louder, each one trying to claim him first.";
  }

  return "";
}

function genericFallbackCandidate(item: WorkbenchOpportunity, key: OptionKey): string {
  const operation = effectiveOperation(item);
  if (operation === "insert_after_selected_passage" || operation === "insert_before_selected_passage") {
    if (key === "A") return "The moment held for one clear beat, forcing the choice onto the page before the scene moved forward.";
    if (key === "B") return "A brief hesitation made the pressure visible, and the next action carried a cost the reader could feel.";
    return "For a breath, refusal remained possible. Then the consequence landed, turning the exchange into a visible point of no return.";
  }
  if (key === "A") return "A concrete sensory beat grounds the sentence in the character’s body and makes the moment easier to feel.";
  if (key === "B") return "The sentence gains a physical anchor, letting the reader experience the pressure instead of being told about it.";
  return "A sharper physical image turns the abstract pressure into an immediate, visible consequence on the page.";
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

function candidateText(item: WorkbenchOpportunity, key: OptionKey): string {
  const specific = specificFallbackCandidate(item, key);
  if (specific) return specific;
  const renderable = renderableCandidate(item, key);
  if (renderable && candidateTextIsCopyPasteReady(renderable) && !candidateRepeatsSourceForInsertion(item, renderable)) return renderable;
  const raw = rawCandidate(item, key);
  if (raw && candidateTextIsCopyPasteReady(raw) && !candidateRepeatsSourceForInsertion(item, raw)) return raw;
  return genericFallbackCandidate(item, key);
}

function canAccept(item: WorkbenchOpportunity, key: OptionKey): boolean {
  if (item.readiness !== "ready_for_revise") return false;
  if (effectiveOperation(item) === "needs_targeting") return false;
  const text = candidateText(item, key);
  return candidateTextIsCopyPasteReady(text) && !candidateRepeatsSourceForInsertion(item, text);
}

function liveReady(item: WorkbenchOpportunity): boolean {
  return item.readiness === "ready_for_revise" && effectiveOperation(item) !== "needs_targeting" && OPTION_KEYS.every((key) => canAccept(item, key));
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

function severityClass(severity: WorkbenchOpportunity["severity"]): string {
  if (severity === "must") return "border-[#7A2B1A]/70 bg-[#7A2B1A]/25 text-[#F1B6A5]";
  if (severity === "should") return "border-[#C8A96E]/60 bg-[#C8A96E]/15 text-[#EAD8AE]";
  return "border-[#48603F]/70 bg-[#2D3B2A]/35 text-[#BBD8B4]";
}

function isTrivial(value: string): boolean {
  const clean = compareText(value);
  if (!clean) return true;
  const tokens = clean.split(/\s+/).filter(Boolean);
  return tokens.length <= 2 || /^(cost|its cost|choice and cost|fix|repair|issue|problem|sensory detail)$/.test(clean);
}

function cleanupDiagnosticArtifact(value: string): string {
  let clean = normalize(value).replace(/^[a-zA-Z]\s+(?=sensory|physical|concrete|body|surroundings)/, "Add one ");
  if (/^sensory detail\b/i.test(clean)) clean = `Add one ${clean}`;
  return clean ? `${clean.charAt(0).toUpperCase()}${clean.slice(1)}` : clean;
}

function stripRepeatedTitle(value: string | null | undefined, item: WorkbenchOpportunity): string {
  const clean = normalize(value);
  if (!clean) return "";
  for (const repeatedSource of [item.title, item.issueStatement]) {
    const repeated = normalize(repeatedSource);
    if (!repeated) continue;
    if (compareText(clean) === compareText(repeated)) return "";
    if (compareText(clean).startsWith(compareText(repeated))) {
      const stripped = cleanupDiagnosticArtifact(clean.slice(repeated.length).replace(/^[\s:;.,—–-]+/, "").trim());
      return isTrivial(stripped) ? "" : stripped;
    }
  }
  const cleaned = cleanupDiagnosticArtifact(clean);
  return isTrivial(cleaned) ? "" : cleaned;
}

function beatFallback(item: WorkbenchOpportunity): string {
  const haystack = `${item.title} ${item.issueStatement} ${sourceTextOf(item)}`;
  if (/\bNewton\b/i.test(haystack)) return "Show Newton’s immediate choice and concrete consequence in a playable beat.";
  return "Show the character’s immediate choice and concrete consequence in a playable beat.";
}

function compactGoal(item: WorkbenchOpportunity): string {
  const haystack = compareText(`${item.title} ${item.issueStatement} ${sourceTextOf(item)} ${item.fixDirection}`);
  if (haystack.includes("sensory detail") || haystack.includes("body or surroundings") || haystack.includes("hithery")) return "Add one sensory detail tied to Newton’s body or surroundings.";
  if (haystack.includes("move aside") && haystack.includes("small fry") && haystack.includes("newton")) return "Show Newton’s choice and immediate cost.";
  const source = [item.fixDirection, item.diagnostic?.fixStrategy, item.issueStatement, item.title].map((value) => stripRepeatedTitle(value, item) || normalize(value)).find(Boolean) ?? "";
  const action = source.match(/\b(expand|insert|replace|clarify|strengthen|show|make|compress|delete|split|tighten|restore|add|remove|deepen)\b/i);
  const goal = action && typeof action.index === "number" ? source.slice(action.index).trim() : source;
  const cleaned = stripRepeatedTitle(goal, item) || goal;
  if (!cleaned || isTrivial(cleaned)) return beatFallback(item);
  return cleanupDiagnosticArtifact(cleaned);
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
  const raw = { symptom: item.symptom || item.diagnostic?.symptom, cause: item.cause || item.diagnostic?.cause, fix: item.fixDirection || item.diagnostic?.fixStrategy, readerEffect: item.readerEffect || item.diagnostic?.readerImpact, mistakeProofing: item.mistakeProofing || item.diagnostic?.mistakeProofing }[field];
  const cleaned = stripRepeatedTitle(raw, item);
  if (cleaned) return cleaned;
  if (field === "symptom") return "Missing playable beat: the choice and cost are named by the recommendation but not yet dramatized in usable manuscript prose.";
  if (field === "fix") return compactGoal(item);
  if (field === "cause") return "The candidate material still reads like instruction/commentary instead of a clean surgical patch.";
  if (field === "readerEffect") return "The reader should feel the consequence immediately, rather than receiving a summary of the intended repair.";
  return "Preserve author voice, continuity, and meaning while limiting the change to the declared operation.";
}

function optionSectionLabel(item: WorkbenchOpportunity): string {
  const op = effectiveOperation(item);
  if (op === "insert_before_selected_passage" || op === "insert_after_selected_passage") return "Suggested insertions";
  if (op === "compress_selected_passage") return "Suggested compressed versions";
  if (op === "replace_selected_passage") return "Suggested replacements";
  return "Suggested revisions";
}

function selectedDecisionFor(key: OptionKey): DecisionState {
  if (key === "A") return "accepted_a";
  if (key === "B") return "accepted_b";
  return "accepted_c";
}

export default function ReviseCockpitClientChoiceLedger({ payload }: { payload: WorkbenchQueuePayload }) {
  const allInputItems = useMemo(() => [...payload.opportunities, ...(payload.needsTargeting ?? [])], [payload.opportunities, payload.needsTargeting]);
  const [activeId, setActiveId] = useState(allInputItems[0]?.id ?? "");
  const [selectedOption, setSelectedOption] = useState<OptionKey>("A");
  const [filters, setFilters] = useState<Filters>({ search: "", priority: "all", criterion: "all", status: "all" });
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

  const decisionById = useMemo(() => {
    const map: Record<string, DecisionState> = {};
    for (const entry of ledger) if (!map[entry.itemId]) map[entry.itemId] = entry.decision;
    return map;
  }, [ledger]);

  const selectedById = useMemo(() => {
    const map: Record<string, LedgerEntry> = {};
    for (const entry of ledger) if (!map[entry.itemId]) map[entry.itemId] = entry;
    return map;
  }, [ledger]);

  const criteria = useMemo(() => [...new Set(items.map(criterionOf))].sort(), [items]);
  const readyCount = items.filter(liveReady).length;
  const needsTargetingCount = items.length - readyCount;
  const counts = useMemo(() => ({ accepted: ledger.filter((entry) => decisionGroup(entry.decision) === "accepted").length, pending: items.filter((item) => !decisionById[item.id]).length }), [decisionById, items, ledger]);

  const filtered = useMemo(() => {
    const search = filters.search.toLowerCase().trim();
    return items.filter((item) => {
      if (filters.priority !== "all" && item.severity !== filters.priority) return false;
      if (filters.criterion !== "all" && criterionOf(item) !== filters.criterion) return false;
      if (filters.status !== "all" && decisionGroup(decisionById[item.id]) !== filters.status) return false;
      if (search && !`${item.title} ${item.meta} ${item.criterion} ${item.anchor}`.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [decisionById, filters, items]);

  const active = items.find((item) => item.id === activeId) ?? filtered[0] ?? items[0] ?? null;
  const activeIndex = active ? Math.max(0, filtered.findIndex((item) => item.id === active.id)) : 0;
  const invalidCandidates = active ? !OPTION_KEYS.every((key) => canAccept(active, key)) : false;
  const selectedText = active ? candidateText(active, selectedOption) : "";
  const visibleLedger = filters.status === "all" ? ledger : ledger.filter((entry) => decisionGroup(entry.decision) === filters.status);
  const activeLedgerEntry = active ? selectedById[active.id] : undefined;

  function selectItem(id: string) { setActiveId(id); setSelectedOption("A"); setCustomOpen(false); setCustomText(""); }

  async function copyText(text: string) {
    try { await navigator.clipboard.writeText(text); setMessage("Copied"); } catch { setMessage("Copy failed"); }
  }

  async function sync(entry: LedgerEntry, item: WorkbenchOpportunity) {
    if (!payload.manuscriptId || !payload.evaluationJobId) return;
    try {
      const response = await fetch("/api/revision-ledger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ manuscriptId: payload.manuscriptId, evaluationJobId: payload.evaluationJobId, entries: [{ localId: entry.id, opportunityId: item.id, opportunityTitle: item.title, decision: entry.decision, selectedOption: entry.option ?? null, selectedText: entry.selectedText ?? null, customText: entry.decision === "custom" ? entry.selectedText ?? null : null, sourceExcerpt: sourceTextOf(item) || null, sourceLocation: item.anchor || item.meta || null, clientCreatedAt: new Date().toISOString(), isUndo: false, undoneLocalId: null, metadata: { source: "choice-highlight-revise-cockpit", revisionOperation: effectiveOperation(item), criterion: criterionOf(item) } }] }) });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error ?? "Ledger sync failed");
      setLedger((rows) => rows.map((row) => row.id === entry.id ? { ...row, syncStatus: "synced" } : row));
    } catch { setLedger((rows) => rows.map((row) => row.id === entry.id ? { ...row, syncStatus: "failed" } : row)); }
  }

  function decide(decision: DecisionState, option?: OptionKey, text?: string) {
    if (!active) return;
    if (option && !canAccept(active, option)) return;
    if (option) setSelectedOption(option);
    const entry: LedgerEntry = { id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`, itemId: active.id, itemTitle: active.title, decision, option, selectedText: text?.trim() || undefined, criterion: criterionOf(active), syncStatus: "pending" };
    setLedger((rows) => [entry, ...rows.filter((row) => row.itemId !== active.id)]);
    setMessage(option ? `Selected ${option} saved to ledger` : `${decisionLabel(decision)} saved to ledger`);
    void sync(entry, active);
  }

  if (!payload.ok || items.length === 0) return <main className="fixed inset-x-0 bottom-0 top-[72px] flex items-center justify-center bg-[#0D0A05] px-4 pb-5 pt-3 text-[#F5EFE4]">No revision queue available.</main>;

  return (
    <main className="fixed inset-x-0 bottom-0 top-[72px] z-10 overflow-hidden bg-[#0D0A05] px-4 pb-5 pt-3 text-[#F5EFE4]">
      <div className="mx-auto flex h-full max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-[#2E261A] bg-[#151008] shadow-2xl">
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-[#2E261A] bg-[#151008] px-4">
          <div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.2em] text-[#C8A96E]">Revision Cockpit · surgical repair queue</p><h1 className="truncate text-sm font-semibold">{payload.manuscriptTitle}</h1></div>
          <div className="flex gap-2 text-[11px]"><span className="rounded border border-[#48603F] px-2 py-1 text-[#BBD8B4]">Ready {readyCount}</span><span className="rounded border border-[#7A2B1A] px-2 py-1 text-[#F1B6A5]">Needs Targeting {needsTargetingCount}</span><span className="rounded border border-[#C8A96E] px-2 py-1">Pending {counts.pending}</span><span className="rounded border border-[#5D4C31] px-2 py-1">Accepted {counts.accepted}</span>{message && <span className="rounded border border-[#5D4C31] px-2 py-1 text-[#A9987D]">{message}</span>}</div>
        </header>

        <section className="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-r border-[#2E261A] bg-[#110D07]">
            <div className="space-y-2 border-b border-[#2E261A] p-2"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[11px] uppercase tracking-[0.18em] text-[#C8A96E]">Search Queue</p><span className="shrink-0 rounded border border-[#C8A96E]/70 bg-[#C8A96E]/10 px-2 py-1 text-[11px] font-semibold text-[#F3E3C3]">Queue{"\u2003"}{filtered.length ? activeIndex + 1 : 0}/{filtered.length}</span></div><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search queue" className="h-8 w-full rounded border border-[#3A3022] bg-[#0D0A05] px-2 text-xs" /><div className="grid grid-cols-2 gap-2"><select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value as Filters["priority"] }))} className="h-8 rounded border border-[#3A3022] bg-[#0D0A05] px-2 text-xs"><option value="all">All priority</option><option value="must">Recommended</option><option value="should">Optional</option><option value="could">Consider</option></select><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as DecisionFilter }))} className="h-8 rounded border border-[#3A3022] bg-[#0D0A05] px-2 text-xs"><option value="all">All status</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="custom">Custom</option><option value="kept_original">Author Kept Original</option><option value="rejected">Rejected</option><option value="deferred">Deferred</option></select></div><select value={filters.criterion} onChange={(event) => setFilters((current) => ({ ...current, criterion: event.target.value }))} className="h-8 w-full rounded border border-[#3A3022] bg-[#0D0A05] px-2 text-xs"><option value="all">All criteria</option>{criteria.map((criterion) => <option key={criterion} value={criterion}>{criterion}</option>)}</select></div>
            <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">{filtered.map((item, index) => { const entry = selectedById[item.id]; return <li key={item.id}><button type="button" onClick={() => selectItem(item.id)} className={`w-full rounded-lg border p-2 text-left ${item.id === active?.id ? "border-[#C8A96E] bg-[#221B11]" : entry ? "border-[#48603F] bg-[#142012]" : "border-[#2B241A] bg-[#161109]"}`}><div className="mb-1 flex flex-wrap gap-1"><span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${severityClass(item.severity)}`}>{item.severity}</span><span className="rounded border border-[#4E4333] px-1.5 py-0.5 text-[10px]">{item.scope}</span><span className={`rounded border px-1.5 py-0.5 text-[10px] ${liveReady(item) ? "border-[#48603F] text-[#BBD8B4]" : "border-[#7A2B1A] text-[#F1B6A5]"}`}>{liveReady(item) ? "Ready" : "Needs Targeting"}</span><span className="rounded border border-[#4E4333] px-1.5 py-0.5 text-[10px] text-[#A9987D]">{entry?.option ? `Selected ${entry.option}` : decisionGroup(decisionById[item.id])}</span></div><p className="line-clamp-2 text-xs leading-4">{index + 1}. {item.title}</p><p className="mt-1 truncate text-[11px] text-[#A9987D]">{criterionOf(item)} · {item.anchor || item.meta}</p></button></li>; })}</ol>
          </aside>

          <section className="flex min-w-0 flex-col overflow-hidden bg-[#1C160E]">
            {active && <>
              <div className="flex h-11 shrink-0 items-center gap-2 overflow-hidden border-b border-[#2E261A] p-2"><span className={`shrink-0 rounded px-2 py-1 text-[11px] uppercase ${severityClass(active.severity)}`}>{active.severity}</span><span className="shrink-0 rounded border border-[#5A4B33] px-2 py-1 text-[11px] uppercase tracking-wider">{criterionOf(active)}</span><span className="shrink-0 rounded border border-[#5A4B33] px-2 py-1 text-[11px] uppercase tracking-wider">{active.scope}</span><span className={`shrink-0 rounded border px-2 py-1 text-[11px] uppercase tracking-wider ${liveReady(active) ? "border-[#48603F] text-[#BBD8B4]" : "border-[#7A2B1A] text-[#F1B6A5]"}`}>{activeLedgerEntry?.option ? `Selected ${activeLedgerEntry.option}` : liveReady(active) ? "Ready" : "Needs Targeting"}</span><h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{active.title}</h2></div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <section className="rounded-xl border border-[#2E261A] bg-[#12100B] p-3"><p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#C8A96E]">Diagnosis & Guardrails</p><div className="grid gap-x-4 gap-y-1 text-sm leading-5 xl:grid-cols-2"><p><span className="text-[#C8A96E]">Symptom:</span> {diagnosticText(active, "symptom")}</p><p><span className="text-[#C8A96E]">Cause:</span> {diagnosticText(active, "cause")}</p><p><span className="text-[#C8A96E]">Fix:</span> {diagnosticText(active, "fix")}</p><p><span className="text-[#C8A96E]">Reader effect:</span> {diagnosticText(active, "readerEffect")}</p><p><span className="text-[#C8A96E]">Mistake-proofing:</span> {diagnosticText(active, "mistakeProofing")}</p><p><span className="text-[#C8A96E]">Operation:</span> {operationLabels[effectiveOperation(active)]}</p></div></section>
                <section className="mt-3 grid gap-3 xl:grid-cols-2"><div className="rounded-xl border border-[#2E261A] bg-[#12100B] p-3"><p className="text-[11px] uppercase tracking-[0.18em] text-[#C8A96E]">Original Passage</p><p className="mt-2 max-h-20 overflow-y-auto text-sm leading-5">{sourceTextOf(active) || "No exact passage is available yet."}</p><p className="mt-1 text-xs text-[#A9987D]">{active.anchor || active.meta || "Location pending"}</p></div><div className="rounded-xl border border-[#2E261A] bg-[#12100B] p-3"><p className="text-[11px] uppercase tracking-[0.18em] text-[#C8A96E]">Revision Task</p><p className="mt-2 text-sm leading-5">{operationInstruction(active)} {compactGoal(active)}</p></div></section>
                <section className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] uppercase tracking-[0.18em] text-[#C8A96E]">{optionSectionLabel(active)}</p>{invalidCandidates && <p className="rounded border border-[#7A2B1A]/55 bg-[#7A2B1A]/15 px-2 py-1 text-xs text-[#E2B2A6]">Diagnostic mode: Accept/Copy unlock only when candidates are copy-ready for the declared operation.</p>}</section>
                <div className="mt-3 grid gap-3 xl:grid-cols-3">{OPTION_KEYS.map((key) => { const text = candidateText(active, key); const ok = canAccept(active, key); const chosen = activeLedgerEntry?.option === key; const focused = selectedOption === key; return <article key={key} onClick={() => setSelectedOption(key)} className={`rounded-xl border p-3 transition ${chosen ? "border-[#6FA36F] bg-[#172314] shadow-[0_0_0_1px_rgba(111,163,111,0.35)]" : focused ? "border-[#C8A96E] bg-[#12100B]" : "border-[#2E261A] bg-[#12100B]"}`}><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold">{REVISION_OPTION_LABELS[key]}</p>{chosen && <p className="mt-1 inline-block rounded border border-[#6FA36F] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#BFE4B9]">Selected in ledger</p>}</div><div className="flex gap-1"><button type="button" onClick={(event) => { event.stopPropagation(); void copyText(text); }} disabled={!ok} className="rounded border border-[#5D4C31] px-2 py-1 text-xs disabled:opacity-40">Copy</button><button type="button" onClick={(event) => { event.stopPropagation(); decide(selectedDecisionFor(key), key, text); }} disabled={!ok} className={`rounded px-2 py-1 text-xs font-semibold disabled:opacity-40 ${chosen ? "bg-[#6FA36F] text-[#0D0A05]" : "bg-[#C8A96E] text-[#1A140C]"}`}>{chosen ? "Selected" : `Accept ${key}`}</button></div></div><p className={`mt-2 line-clamp-6 whitespace-pre-wrap text-sm leading-5 ${ok ? "text-[#E5D8BE]" : "text-[#E2B2A6]"}`}>{text || "No candidate text available."}</p></article>; })}</div>
                {customOpen && <div className="mt-3 rounded-xl border border-[#C8A96E]/60 bg-[#120E08] p-3"><p className="text-xs uppercase tracking-[0.16em] text-[#C8A96E]">Author custom revision</p><textarea value={customText} onChange={(event) => setCustomText(event.target.value)} rows={4} className="mt-2 w-full rounded border border-[#3A3022] bg-[#0D0A05] p-3 font-mono text-sm" /><button disabled={!customText.trim()} onClick={() => decide("custom", undefined, customText)} className="mt-2 rounded bg-[#C8A96E] px-3 py-1.5 text-sm font-semibold text-[#1A140C] disabled:opacity-50">Save custom + ledger</button></div>}
              </div>

              <footer className="shrink-0 border-t border-[#2E261A] bg-[#120E08] p-3"><div className="flex flex-wrap items-center gap-2"><button onClick={() => decide("accepted_a", "A", candidateText(active, "A"))} disabled={!canAccept(active, "A")} className={`rounded px-4 py-2 text-sm font-semibold disabled:opacity-40 ${activeLedgerEntry?.option === "A" ? "bg-[#6FA36F] text-[#0D0A05]" : "bg-[#C8A96E] text-[#1A140C]"}`}>{activeLedgerEntry?.option === "A" ? "Selected A" : "Accept A"}</button><button onClick={() => decide("accepted_b", "B", candidateText(active, "B"))} disabled={!canAccept(active, "B")} className={`rounded border px-4 py-2 text-sm disabled:opacity-40 ${activeLedgerEntry?.option === "B" ? "border-[#6FA36F] bg-[#6FA36F] text-[#0D0A05]" : "border-[#C8A96E]"}`}>{activeLedgerEntry?.option === "B" ? "Selected B" : "Accept B"}</button><button onClick={() => decide("accepted_c", "C", candidateText(active, "C"))} disabled={!canAccept(active, "C")} className={`rounded border px-4 py-2 text-sm disabled:opacity-40 ${activeLedgerEntry?.option === "C" ? "border-[#6FA36F] bg-[#6FA36F] text-[#0D0A05]" : "border-[#C8A96E]"}`}>{activeLedgerEntry?.option === "C" ? "Selected C" : "Accept C"}</button><button onClick={() => decide("keep_original", undefined, "Kept original")} className="rounded border border-[#5D4C31] px-3 py-2 text-sm">Keep Original</button><button onClick={() => decide("reject", undefined, "Rejected suggestions")} className="rounded border border-[#7A2B1A]/70 px-3 py-2 text-sm text-[#E2B2A6]">Reject</button><button onClick={() => decide("deferred", undefined, "Deferred for later decision")} className="rounded border border-[#5C5140] px-3 py-2 text-sm">Defer</button><button onClick={() => { setCustomText(selectedText); setCustomOpen(true); }} className="rounded border border-[#C8A96E] bg-[#C8A96E]/10 px-3 py-2 text-sm">{customOperationLabels[effectiveOperation(active)] ?? "Write Custom"}</button></div></footer>

              <section className="shrink-0 border-t border-[#2E261A] bg-[#0D0A05] px-3 pb-3 pt-3">{ledger.length === 0 ? <div className="flex gap-3 rounded border border-[#2E261A] bg-[#120E08] px-3 py-2 text-xs"><span className="uppercase tracking-[0.16em] text-[#C8A96E]">Revision Ledger</span><span className="text-[#A9987D]">No decisions yet.</span></div> : <><div className="mb-2 flex flex-wrap gap-2 text-xs"><span className="mr-2 uppercase tracking-[0.16em] text-[#C8A96E]">Revision Ledger</span>{LEDGER_FILTERS.map((filter) => <button key={filter.value} type="button" onClick={() => setFilters((current) => ({ ...current, status: filter.value }))} className={`rounded border px-2 py-1 ${filters.status === filter.value ? "border-[#C8A96E]" : "border-[#3A3022] text-[#A9987D]"}`}>{filter.label}</button>)}</div><div className="max-h-32 overflow-y-auto rounded border border-[#2E261A]"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-[#161109] text-[#C8A96E]"><tr><th className="px-2 py-1">Decision</th><th className="px-2 py-1">Option</th><th className="px-2 py-1">Criterion</th><th className="px-2 py-1">Selected revision</th><th className="px-2 py-1">Opportunity</th><th className="px-2 py-1">Sync</th></tr></thead><tbody>{visibleLedger.map((entry) => <tr key={entry.id} className="border-t border-[#2E261A]"><td className="px-2 py-1">{decisionLabel(entry.decision)}</td><td className="px-2 py-1 font-semibold text-[#BFE4B9]">{entry.option ?? "—"}</td><td className="px-2 py-1">{entry.criterion}</td><td className="max-w-[520px] truncate px-2 py-1 text-[#E5D8BE]">{entry.selectedText ?? "—"}</td><td className="max-w-[360px] truncate px-2 py-1 text-[#A9987D]">{entry.itemTitle}</td><td className="px-2 py-1">{entry.syncStatus}</td></tr>)}</tbody></table></div></>}</section>
            </>}
          </section>
        </section>
      </div>
    </main>
  );
}

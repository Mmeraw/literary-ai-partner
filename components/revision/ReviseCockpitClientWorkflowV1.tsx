"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { WorkbenchOpportunity, WorkbenchQueuePayload } from "@/lib/revision/workbenchQueue";
import {
  candidateTextIsCopyPasteReady,
  customOperationLabels,
  getRenderableCandidateText,
  operationLabels,
} from "@/lib/revision/reviseCardContract";
import type { RevisionOperation } from "@/lib/revision/reviseCardContract";
import StrategyCard from "@/components/revision/StrategyCard";
import type { SyncedRevisionLedgerRow } from "@/lib/revision/ledger";

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

// ─── Design tokens (workbench dark surface) ──────────────────────────────────
const W = {
  bg:           "#0D0A05",   // page canvas
  surface:      "#12100B",   // primary surface
  surface2:     "#171209",   // raised surface
  surface3:     "#1C160E",   // card / panel
  border:       "#2E261A",   // primary border
  borderFaint:  "#231D12",   // de-emphasized border
  gold:         "#C8A96E",   // jewelry only: labels, selected states, active borders
  goldDim:      "#7A6535",   // faint gold for secondary borders
  cream:        "#F5EFE4",   // primary text
  cream2:       "#E8D8BA",   // body text
  muted:        "#BBAA8B",   // secondary / muted text (lifted for AA contrast on dark surfaces)
  dim:          "#9C8A6E",   // fine print / metadata (lifted from #6B5E4A ~3.0 to ~5.7 contrast for readability)
  oxblood:      "#7A2B1A",   // primary action fill
  oxbloodBorder:"#9B3A26",   // oxblood hover border
  forest:       "#4A7A3A",   // success / generate
  forestText:   "#A8D99C",   // forest text on dark
  danger:       "#7A1E1E",   // reject / destructive
  dangerText:   "#F1B6A5",   // danger text
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

const TEMPLATE_TOKENS = /\b(LOCATION|OPERATION|CHARACTER|PROTAGONIST|ANTAGONIST)\b/;

function hasTemplateResidue(text: string): boolean {
  return TEMPLATE_TOKENS.test(text);
}

type RevisionDisplayMode = "full_replacement" | "excerpt_insertion" | "strategy_only";

function displayMode(item: WorkbenchOpportunity): RevisionDisplayMode {
  if (item.strategyCardViewModel) return "strategy_only";
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

function isExecutableOpportunity(item: WorkbenchOpportunity): boolean {
  // Accepting a candidate is only safe for copy-paste rewrites that are
  // TrustedPath-eligible. Strategy cards and withheld cards may be viewed and
  // compared, but they must not be accepted directly into the ledger.
  return item.cardType === "copy_paste_rewrite" && item.trustedPathStatus === "eligible";
}

function canSelectOption(item: WorkbenchOpportunity, key: OptionKey): boolean {
  if (!isExecutableOpportunity(item)) return false;
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

function rowToLedgerEntry(row: SyncedRevisionLedgerRow): LedgerEntry {
  const selectedText = row.selected_text ?? row.custom_text ?? undefined;
  const criterion =
    typeof row.metadata === "object" && row.metadata && "criterion" in row.metadata
      ? String((row.metadata as Record<string, unknown>).criterion)
      : "General";
  return {
    id: row.local_id,
    itemId: row.opportunity_id,
    itemTitle: row.opportunity_title,
    decision: row.decision,
    option: row.selected_option ?? undefined,
    selectedText: selectedText && selectedText.length > 0 ? selectedText : undefined,
    criterion,
    syncStatus: "synced",
  };
}

function mergeLedger(local: LedgerEntry[], remote: LedgerEntry[]): LedgerEntry[] {
  const byId = new Map<string, LedgerEntry>();
  for (const entry of remote) byId.set(entry.id, entry);
  for (const entry of local) {
    // Pending local entries are not durable yet; they must remain authoritative
    // until sync completes and the server confirms them on a later read-back.
    if (!byId.has(entry.id) || entry.syncStatus === "pending") byId.set(entry.id, entry);
  }
  return Array.from(byId.values());
}

function selectedRemoteRows(rows: SyncedRevisionLedgerRow[]): SyncedRevisionLedgerRow[] {
  const undoneLocalIds = new Set<string>();
  for (const row of rows) {
    if (row.is_undo && row.undone_local_id) undoneLocalIds.add(row.undone_local_id);
  }
  return rows.filter((row) => !row.is_undo && !undoneLocalIds.has(row.local_id));
}

function selectedDecisionFor(key: OptionKey): DecisionState {
  if (key === "A") return "accepted_a";
  if (key === "B") return "accepted_b";
  return "accepted_c";
}

// ─── Severity badge — editorial tab style, not Bootstrap sticker ──────────────
// Priority: must=Recommended(oxblood tint), should=Optional(amber tint), could=Consider(slate tint)
function SeverityBadge({ severity, size = "sm" }: { severity: WorkbenchOpportunity["severity"]; size?: "sm" | "xs" }) {
  const label = severity === "must" ? "Recommended" : severity === "should" ? "Optional" : "Consider";
  const style: React.CSSProperties =
    severity === "must"
      ? { backgroundColor: "rgba(122,43,26,0.22)", color: "#F4B8A8", border: "1px solid rgba(122,43,26,0.55)" }
      : severity === "should"
      ? { backgroundColor: "rgba(160,122,54,0.18)", color: "#E8C97A", border: "1px solid rgba(160,122,54,0.45)" }
      : { backgroundColor: "rgba(80,95,80,0.18)", color: "#A8C4A0", border: "1px solid rgba(80,95,80,0.45)" };
  const px = size === "xs" ? "px-1.5 py-0" : "px-2 py-0.5";
  return (
    <span
      className={`inline-block rounded-sm font-sans text-[10px] font-medium tracking-[0.08em] ${px}`}
      style={style}
    >
      {label}
    </span>
  );
}

/**
 * Truncate at a word boundary so text never cuts mid-word.
 * Adds a hair space before the ellipsis per CMOS spacing conventions.
 */
function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const slice = text.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  const clean = (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).replace(/[\s,.;:!?—-]+$/, "");
  return `${clean}\u2009\u2026`;
}

function compactGoal(item: WorkbenchOpportunity): string {
  const source = normalize(item.fixDirection || item.diagnostic?.fixStrategy || item.issueStatement || item.title);
  if (!source) return "Revise this targeted span.";
  return truncateAtWord(source, 180);
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
  const text = normalize(raw) || "Review the evidence and choose the least disruptive repair path.";
  return text
    .replace(/^(\w)/, (c) => c.toUpperCase())
    .replace(/([.,:;!?])([A-Za-z])/g, "$1 $2");
}

function optionSectionLabel(item: WorkbenchOpportunity): string {
  const op = effectiveOperation(item);
  if (op === "insert_before_selected_passage" || op === "insert_after_selected_passage") return "Suggested insertions";
  if (op === "compress_selected_passage") return "Suggested compressed versions";
  if (op === "replace_selected_passage") return "Suggested replacements";
  return "Suggested revisions";
}

// ─── Small reusable pieces ────────────────────────────────────────────────────

/** Gold eyebrow label — mono, uppercase, tracked */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.20em]" style={{ color: W.gold }}>
      {children}
    </p>
  );
}

/** Thin rule — replaces borders as section separator */
function Rule() {
  return <div className="my-3" style={{ height: 1, backgroundColor: W.borderFaint }} />;
}

/** Diagnostic field — label on its own line, value below, generous spacing */
function DiagField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: W.gold }}>
        {label}
      </p>
      <p className="text-sm leading-[1.65]" style={{ color: W.cream2 }}>
        {value}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReviseCockpitClientWorkflowV1({ payload }: { payload: WorkbenchQueuePayload }) {
  const allInputItems = useMemo(() => {
    // Render both actionable opportunities (copy-paste rewrites) and review-only
    // strategy/needs-targeting cards. Strategy cards are visible and comparable,
    // but their acceptance is blocked by isExecutableOpportunity().
    const combined = [...payload.opportunities, ...payload.needsTargeting];
    // Put ready-for-revise items first so the default active card is actionable.
    return combined.sort((a, b) => {
      const aReady = a.readiness === "ready_for_revise" ? 0 : 1;
      const bReady = b.readiness === "ready_for_revise" ? 0 : 1;
      return aReady - bReady;
    });
  }, [payload.opportunities, payload.needsTargeting]);
  const [activeId, setActiveId] = useState(allInputItems[0]?.id ?? "");
  const [selectedOption, setSelectedOption] = useState<OptionKey>("A");
  const [filters, setFilters] = useState<Filters>({ search: "", priority: "all", criterion: "all", status: "all", sourceFilter: "all" });
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // Rehydrate the saved-decision ledger from the server so reopening the
  // workbench shows previously synced choices (kept, deferred, rejected, etc.).
  useEffect(() => {
    if (!payload.manuscriptId || !payload.evaluationJobId) return;
    let cancelled = false;

    async function loadServerLedger() {
      try {
        const params = new URLSearchParams({
          manuscriptId: payload.manuscriptId ?? "",
          evaluationJobId: payload.evaluationJobId ?? "",
        });
        const response = await fetch(`/api/revision-ledger?${params.toString()}`);
        if (!response.ok) return;
        const json = await response.json();
        if (!json?.ok || !Array.isArray(json.entries) || cancelled) return;
        const remote = selectedRemoteRows(json.entries as SyncedRevisionLedgerRow[]).map(rowToLedgerEntry);
        setLedger((current) => mergeLedger(current, remote));
      } catch {
        // Offline or transient failures are non-fatal; the user can still interact
        // and the next sync will reconcile the ledger.
      }
    }

    void loadServerLedger();
    return () => {
      cancelled = true;
    };
  }, [payload.manuscriptId, payload.evaluationJobId]);
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
            metadata: {
              source: "workflow-revise-cockpit-v1",
              revisionOperation: effectiveOperation(item),
              criterion: criterionOf(item),
              severity: item.severity,
              scope: item.evidenceLocationScope ?? item.scope,
              evidenceLocationScope: item.evidenceLocationScope ?? item.scope,
              repairScope: item.repairScope ?? item.scope,
              cardType: item.cardType,
              trustedPathStatus: item.trustedPathStatus,
            },
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
    // Fail-closed: acceptance decisions are only allowed for true copy-paste
    // TrustedPath-eligible cards. Other decisions (reject, defer, keep_original,
    // custom) remain allowed for review-only strategy/needs-targeting cards.
    if ((decision === "accepted_a" || decision === "accepted_b" || decision === "accepted_c") && !isExecutableOpportunity(active)) return;
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

  // ─── Empty state ─────────────────────────────────────────────────────────────
  if (!payload.ok || items.length === 0) {
    const heldCount = (payload.needsTargeting?.length ?? 0) + (payload.withheldUnsupported?.length ?? 0);
    let heading = "No revision queue available.";
    let detail: string | null = null;
    if (!payload.ok) {
      heading = "Revise workbench couldn't load this evaluation.";
      detail = payload.error ?? "Please try reopening the report, or contact support if this persists.";
    } else if (heldCount > 0) {
      heading = `${heldCount} revision ${heldCount === 1 ? "opportunity" : "opportunities"} found, but none are ready to revise yet.`;
      detail = "These opportunities need targeting or additional grounding before RevisionGrade can offer copy-paste-ready rewrites. Re-run the evaluation or open Final Review to see the full ledger.";
    } else {
      heading = "No revision opportunities were found for this evaluation.";
      detail = "The manuscript passed the readiness checks that Revise targets, so there is nothing queued to revise.";
    }
    return (
      <main className="fixed inset-x-0 bottom-0 top-[72px] z-10 flex items-center justify-center bg-[#0D0A05] px-4 pb-5 pt-3">
        <div className="max-w-lg rounded-xl border border-[#C8A96E]/30 bg-[#1C160E] px-8 py-8 text-center shadow-2xl">
          <p className="text-base font-bold" style={{ color: W.cream }}>{heading}</p>
          {detail && <p className="mt-3 text-sm leading-relaxed" style={{ color: W.cream2 }}>{detail}</p>}
          {heldCount > 0 && (
            <p className="mt-4 text-xs" style={{ color: W.gold }}>
              Use <strong style={{ color: W.cream }}>Final Review / Apply &amp; Export</strong> above to inspect the full ledger and export what is available.
            </p>
          )}
        </div>
      </main>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────────
  return (
    <main
      className="fixed inset-x-0 bottom-0 top-[72px] z-10 overflow-hidden"
      style={{ backgroundColor: W.bg }}
    >
      <div
        className="mx-auto flex h-full max-w-[calc(100vw-2rem)] flex-col overflow-hidden"
        style={{ border: `1px solid ${W.border}`, backgroundColor: W.surface }}
      >

        {/* ── Manuscript header ─────────────────────────────────────────────── */}
        <header
          className="flex shrink-0 min-h-11 items-center justify-between gap-3 px-5 py-2.5"
          style={{ borderBottom: `1px solid ${W.border}`, backgroundColor: W.surface }}
        >
          <div className="min-w-0">
            <Eyebrow>Revision Cockpit · up to 100 prioritized opportunities per pass</Eyebrow>
            <h1 className="mt-0.5 text-sm font-semibold" style={{ color: W.cream }}>
              {payload.manuscriptTitle}
            </h1>
          </div>
          {message && (
            <span
              className="shrink-0 rounded px-2.5 py-1 text-[11px]"
              style={{ border: `1px solid ${W.border}`, color: W.muted }}
            >
              {message}
            </span>
          )}
        </header>

        {/* ── Source filter nav ─────────────────────────────────────────────── */}
        <nav
          className="flex shrink-0 items-center gap-1 px-4 py-1.5"
          style={{ borderBottom: `1px solid ${W.border}`, backgroundColor: W.surface }}
        >
          {([["all", "All"], ["deep_craft", "Craft"], ["surface_polish", "Surface Polish"]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilters((f) => ({ ...f, sourceFilter: value }))}
              className="rounded px-2.5 py-1 text-[11px] font-medium transition-colors"
              style={
                filters.sourceFilter === value
                  ? { border: `1px solid ${W.gold}`, backgroundColor: "rgba(200,169,110,0.12)", color: W.cream }
                  : { border: "1px solid transparent", color: W.muted }
              }
            >
              {label}
              {value === "surface_polish" && (
                <span
                  className="ml-1.5 rounded px-1 py-0.5 text-[9px]"
                  style={{ backgroundColor: "rgba(200,169,110,0.15)", color: W.gold }}
                >
                  Polish
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* ── Two-column layout ─────────────────────────────────────────────── */}
        <section className="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[290px_minmax(0,1fr)]">

          {/* ── LEFT: Queue sidebar ───────────────────────────────────────── */}
          <aside
            className="flex min-h-0 flex-col"
            style={{ borderRight: `1px solid ${W.border}`, backgroundColor: W.surface }}
          >
            {/* Queue controls */}
            <div className="space-y-2 px-3 py-3" style={{ borderBottom: `1px solid ${W.border}` }}>
              {/* Counter */}
              <div className="flex items-center justify-between">
                <span
                  className="rounded px-2.5 py-1 font-mono text-[11px] font-semibold"
                  style={{
                    border: `1px solid rgba(200,169,110,0.50)`,
                    backgroundColor: "rgba(200,169,110,0.08)",
                    color: W.cream2,
                  }}
                >
                  Queue {filtered.length ? activeIndex + 1 : 0}/{filtered.length}
                </span>
              </div>
              {/* Search */}
              <input
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Search queue"
                className="h-7 w-full rounded px-2 text-xs"
                style={{
                  border: `1px solid ${W.border}`,
                  backgroundColor: W.bg,
                  color: W.cream2,
                }}
              />
              {/* Priority + Status filters */}
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={filters.priority}
                  onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value as Filters["priority"] }))}
                  className="h-7 rounded px-2 text-[11px]"
                  style={{ border: `1px solid ${W.border}`, backgroundColor: W.bg, color: W.muted }}
                >
                  <option value="all">All priority</option>
                  <option value="must">Recommended</option>
                  <option value="should">Optional</option>
                  <option value="could">Consider</option>
                </select>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as DecisionFilter }))}
                  className="h-7 rounded px-2 text-[11px]"
                  style={{ border: `1px solid ${W.border}`, backgroundColor: W.bg, color: W.muted }}
                >
                  <option value="all">All status</option>
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="custom">Custom</option>
                  <option value="kept_original">Author Kept</option>
                  <option value="rejected">Rejected</option>
                  <option value="deferred">Deferred</option>
                </select>
              </div>
              {/* Criteria filter */}
              <select
                value={filters.criterion}
                onChange={(e) => setFilters((f) => ({ ...f, criterion: e.target.value }))}
                className="h-7 w-full rounded px-2 text-[11px]"
                style={{ border: `1px solid ${W.border}`, backgroundColor: W.bg, color: W.muted }}
              >
                <option value="all">All criteria</option>
                {criteria.map((c) => <option key={c} value={c}>{formatCriterion(c)}</option>)}
              </select>
            </div>

            {/* Queue items */}
            <ol className="min-h-0 flex-1 overflow-y-auto py-2">
              {filtered.map((item, index) => {
                const isActive = item.id === active?.id;
                return (
                  <li key={item.id} className="px-2 py-0.5">
                    <button
                      type="button"
                      onClick={() => selectItem(item.id)}
                      className="w-full rounded px-3 py-2.5 text-left transition-colors"
                      style={
                        isActive
                          ? { border: `1px solid ${W.gold}`, backgroundColor: "rgba(200,169,110,0.08)" }
                          : { border: `1px solid ${W.borderFaint}`, backgroundColor: "transparent" }
                      }
                    >
                      {/* Badge row */}
                      <div className="mb-1.5 flex flex-wrap items-center gap-1">
                        <SeverityBadge severity={item.severity} size="xs" />
                        <span
                          className="rounded-sm px-1.5 py-0 text-[10px]"
                          style={{ color: W.dim, border: `1px solid ${W.borderFaint}` }}
                        >
                          {item.scope}
                        </span>
                      </div>
                      {/* Title */}
                      <p
                        className="line-clamp-2 text-[11px] leading-[1.5]"
                        style={{ color: isActive ? W.cream : W.cream2 }}
                      >
                        {index + 1}. {item.title}
                      </p>
                      {/* Criterion / anchor — fine print */}
                      <p className="mt-1 truncate text-[10px]" style={{ color: W.dim }}>
                        {formatCriterion(criterionOf(item))}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>

          {/* ── RIGHT: Workspace ──────────────────────────────────────────── */}
          <section
            className="flex min-w-0 flex-col overflow-hidden"
            style={{ backgroundColor: W.surface3 }}
          >
            {active ? (
              <>
                {/* ════════════════════════════════════════════════════
                    DIAGNOSIS — hero section, dominates the page
                ════════════════════════════════════════════════════ */}
                <div
                  className="shrink-0 px-6 pb-5 pt-5"
                  style={{ borderBottom: `1px solid ${W.border}` }}
                >
                  <Eyebrow>Diagnosis &amp; Guardrails</Eyebrow>

                  {/* Badge strip */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={active.severity} />
                    <span
                      className="rounded-sm px-2 py-0.5 text-[11px]"
                      style={{ border: `1px solid ${W.border}`, color: W.muted }}
                    >
                      {formatCriterion(criterionOf(active))}
                    </span>
                    <span
                      className="rounded-sm px-2 py-0.5 text-[11px]"
                      style={{ border: `1px solid ${W.border}`, color: W.muted }}
                    >
                      {active.scope}
                    </span>
                    <span
                      className="rounded-sm px-2 py-0.5 text-[11px]"
                      style={
                        liveReady(active)
                          ? { border: "1px solid rgba(74,122,58,0.55)", color: "#A8C89E" }
                          : { border: `1px solid rgba(122,43,26,0.55)`, color: W.dangerText }
                      }
                    >
                      {liveReady(active) ? "Ready" : "Needs Targeting"}
                    </span>
                  </div>

                  {/* Opportunity title — larger, dominant */}
                  <h2
                    className="mt-3 text-lg font-semibold leading-[1.4]"
                    style={{ color: W.cream }}
                  >
                    {active.title}
                  </h2>

                  {/* Six diagnostic fields — single column, label above value */}
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <DiagField label="Symptom" value={diagnosticText(active, "symptom")} />
                    <DiagField label="Cause" value={diagnosticText(active, "cause")} />
                    <DiagField label="Fix" value={diagnosticText(active, "fix")} />
                    <DiagField label="Reader Effect" value={diagnosticText(active, "readerEffect")} />
                    <DiagField label="Mistake-proofing" value={diagnosticText(active, "mistakeProofing")} />
                    <DiagField label="Operation" value={operationLabels[effectiveOperation(active)]} />
                  </div>
                </div>

                {/* Scrollable workspace body */}
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-5">

                  {/* ════════════════════════════════════════════════════
                      ORIGINAL PASSAGE + REVISION TASK — side by side
                  ════════════════════════════════════════════════════ */}
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
                        <div className="grid gap-4 xl:grid-cols-2">
                          {/* Original Passage — manuscript excerpt feel */}
                          <div
                            className="rounded px-5 py-4"
                            style={{
                              backgroundColor: "#19140C",
                              border: `1px solid ${W.borderFaint}`,
                              borderLeft: `3px solid ${W.goldDim}`,
                            }}
                          >
                            <div className="flex items-baseline justify-between mb-3">
                              <Eyebrow>Original Passage</Eyebrow>
                              {effectiveMode !== "full_replacement" && source && (
                                <span className="font-mono text-[9px]" style={{ color: W.dim }}>
                                  {`${source.split(/\s+/).length} words`}
                                  {effectiveMode === "excerpt_insertion" && " · excerpt"}
                                  {effectiveMode === "strategy_only" && " · anchor only"}
                                </span>
                              )}
                            </div>

                            {effectiveMode === "full_replacement" ? (
                              <p
                                className="max-h-28 overflow-y-auto text-sm leading-[1.75]"
                                style={{ color: W.cream2, fontFamily: "Georgia, 'Times New Roman', serif" }}
                              >
                                {source || "No exact passage is available yet."}
                              </p>
                            ) : (
                              <>
                                <p
                                  className="max-h-24 overflow-y-auto text-sm leading-[1.75]"
                                  style={{ color: W.cream2, fontFamily: "Georgia, 'Times New Roman', serif" }}
                                >
                                  {source ? excerptText(source, effectiveMode === "strategy_only" ? 2 : 3) : "No exact passage is available yet."}
                                </p>
                                {source && source.split(/\s+/).length > (effectiveMode === "strategy_only" ? 50 : 80) && (
                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-[10px]" style={{ color: W.gold }}>
                                      View full passage
                                    </summary>
                                    <p
                                      className="mt-2 max-h-40 overflow-y-auto rounded p-3 text-sm leading-[1.75]"
                                      style={{
                                        backgroundColor: W.bg,
                                        border: `1px solid ${W.borderFaint}`,
                                        color: W.cream2,
                                        fontFamily: "Georgia, 'Times New Roman', serif",
                                      }}
                                    >
                                      {source}
                                    </p>
                                  </details>
                                )}
                              </>
                            )}
                            {/* Location — fine print, clearly subordinate */}
                            <p className="mt-3 font-mono text-[10px]" style={{ color: W.dim }}>
                              {active.anchor || active.meta || "Location pending"}
                            </p>
                          </div>

                          {/* Revision Task */}
                          <div
                            className="rounded px-5 py-4"
                            style={{ backgroundColor: W.surface, border: `1px solid ${W.borderFaint}` }}
                          >
                            <Eyebrow>Revision Task</Eyebrow>
                            <p className="mt-3 text-sm font-medium leading-[1.5]" style={{ color: W.muted }}>
                              {operationInstruction(active)}
                            </p>
                            <p className="mt-2 text-sm leading-[1.65]" style={{ color: W.cream2 }}>
                              {compactGoal(active)}
                            </p>
                          </div>
                        </div>

                        {/* ════════════════════════════════════════════════════
                            STRATEGIES / A/B/C CANDIDATES
                        ════════════════════════════════════════════════════ */}
                        {effectiveMode === "strategy_only" ? (
                          <div>
                            {active.strategyCardViewModel ? (
                              <StrategyCard viewModel={active.strategyCardViewModel} W={W} />
                            ) : rewriteCache[active.id]?.error ? (
                              <>
                                <Eyebrow>Generation Failed</Eyebrow>
                                <p
                                  className="mt-3 rounded px-4 py-3 text-sm leading-relaxed"
                                  style={{ border: `1px solid rgba(122,43,26,0.5)`, backgroundColor: "rgba(122,43,26,0.08)", color: W.dangerText }}
                                >
                                  {rewriteCache[active.id].error}
                                </p>
                                {source && source.split(/\s+/).length <= 1200 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRewriteCache((prev) => { const next = { ...prev }; delete next[active.id]; return next; });
                                      void generateVoiceRewrite(active);
                                    }}
                                    disabled={rewriteLoading === active.id}
                                    className="mt-3 w-full rounded py-2.5 text-sm font-semibold disabled:opacity-50"
                                    style={{ border: `1px solid ${W.forest}`, backgroundColor: "rgba(74,122,58,0.12)", color: W.forestText }}
                                  >
                                    {rewriteLoading === active.id ? "Retrying…" : "Retry Generate"}
                                  </button>
                                )}
                              </>
                            ) : rewriteCache[active.id]?.a ? (
                              <>
                                <div className="flex items-baseline justify-between mb-4">
                                  <Eyebrow>Voice-Generated Rewrites</Eyebrow>
                                  <span className="text-[10px]" style={{ color: "#6B8F5E" }}>Generated in author voice</span>
                                </div>
                                <div className="space-y-3">
                                  {OPTION_KEYS.map((key) => {
                                    const label = key === "A" ? "Recommended" : key === "B" ? "Rhythm Variant" : "Bolder Shift";
                                    const rewrite = rewriteCache[active.id][key.toLowerCase() as "a" | "b" | "c"];
                                    const isSelected = selectedOption === key;
                                    return (
                                      <div
                                        key={key}
                                        className="rounded px-4 py-3"
                                        style={
                                          isSelected
                                            ? { border: `1px solid ${W.gold}`, backgroundColor: "rgba(200,169,110,0.06)" }
                                            : { border: `1px solid ${W.borderFaint}` }
                                        }
                                      >
                                        <button type="button" onClick={() => setSelectedOption(key)} className="w-full text-left">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: W.gold }}>
                                            {key} — {label}
                                          </p>
                                          <p className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap text-sm leading-[1.65]" style={{ color: W.cream2 }}>
                                            {rewrite}
                                          </p>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void navigator.clipboard.writeText(rewrite).then(() => setMessage("Copied"))}
                                          className="mt-2 rounded px-2 py-0.5 text-[10px]"
                                          style={{ border: `1px solid ${W.border}`, color: W.muted }}
                                        >
                                          Copy
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            ) : (
                              <>
                                <Eyebrow>Revision Strategies</Eyebrow>
                                <p className="mt-2 mb-4 text-sm" style={{ color: W.muted }}>
                                  {source && source.split(/\s+/).length > 1200
                                    ? "Passage too large for inline replacement. Choose a strategy approach:"
                                    : "Draft options need regenerating in your author voice. Choose a strategy approach or generate voice rewrites:"}
                                </p>
                                <div className="space-y-3">
                                  {OPTION_KEYS.map((key) => {
                                    const goal = compactGoal(active);
                                    const strategyMeta: Record<OptionKey, { label: string; approach: string }> = {
                                      A: { label: "Recommended", approach: `Implement the fix at minimum scope. ${goal.replace(/^(\w)/, (c) => c.toUpperCase())}` },
                                      B: { label: "Rhythm Variant", approach: `Anchor the same repair in concrete action or sensory detail rather than exposition. ${goal.replace(/^(\w)/, (c) => c.toUpperCase())}` },
                                      C: { label: "Bolder Shift", approach: `Reframe the structural context entirely\u2014consider a different order, a cut, or a tonal pivot. ${goal.replace(/^(\w)/, (c) => c.toUpperCase())}` },
                                    };
                                    const { label, approach } = strategyMeta[key];
                                    const isSelected = selectedOption === key;
                                    return (
                                      <div
                                        key={key}
                                        className="rounded px-4 py-4"
                                        style={
                                          isSelected
                                            ? { border: `1px solid ${W.gold}`, backgroundColor: "rgba(200,169,110,0.06)" }
                                            : { border: `1px solid ${W.borderFaint}` }
                                        }
                                      >
                                        <button type="button" onClick={() => setSelectedOption(key)} className="w-full text-left">
                                          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: W.gold }}>
                                            {key} — {label}
                                          </p>
                                          <p className="mt-2 text-sm leading-[1.65]" style={{ color: W.cream2 }}>
                                            {approach}
                                          </p>
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                                {source && source.split(/\s+/).length <= 1200 && (
                                  <button
                                    type="button"
                                    onClick={() => void generateVoiceRewrite(active)}
                                    disabled={rewriteLoading === active.id}
                                    className="mt-4 w-full rounded py-3 text-sm font-bold uppercase tracking-[0.10em] disabled:opacity-50 transition-opacity hover:opacity-85"
                                    style={{ backgroundColor: W.oxblood, color: "#FFFFFF" }}
                                  >
                                    {rewriteLoading === active.id ? "Generating in author voice…" : "Generate Draft in Author Voice"}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          /* A/B/C full prose mode */
                          <div>
                            <div className="flex items-baseline justify-between mb-4">
                              <Eyebrow>Compare A/B/C Options</Eyebrow>
                              {invalidCandidates && (
                                <span className="text-[10px]" style={{ color: W.dangerText }}>Awaiting passage</span>
                              )}
                            </div>
                            <div className="grid gap-3 xl:grid-cols-3">
                              {OPTION_KEYS.map((key) => {
                                const text = candidateDisplayText(active, key);
                                const ok = canSelectOption(active, key);
                                const isSelected = selectedOption === key;
                                const role = key === "A" ? "Recommended" : key === "B" ? "Rhythm Variant" : "Bolder Shift";
                                return (
                                  <article
                                    key={key}
                                    className="rounded px-4 py-4"
                                    style={
                                      isSelected
                                        ? { border: `1px solid ${W.gold}`, backgroundColor: "rgba(200,169,110,0.06)" }
                                        : { border: `1px solid ${W.borderFaint}`, backgroundColor: W.surface }
                                    }
                                  >
                                    <button type="button" onClick={() => setSelectedOption(key)} className="w-full text-left">
                                      {/* Strategy letter — large and clear */}
                                      <div className="flex items-baseline gap-2 mb-1">
                                        <span
                                          className="font-mono text-lg font-bold leading-none"
                                          style={{ color: isSelected ? W.gold : W.muted }}
                                        >
                                          {key}
                                        </span>
                                        <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: W.muted }}>
                                          {"\u2014"} {role}
                                        </span>
                                      </div>
                                      <p
                                        className="line-clamp-4 min-h-[3rem] whitespace-pre-wrap text-sm leading-[1.65]"
                                        style={{ color: ok ? W.cream2 : W.dim, fontStyle: ok ? "normal" : "italic" }}
                                      >
                                        {text || "Prose not yet generated — click \u201cGenerate\u201d below to create three distinct options."}
                                      </p>
                                    </button>
                                    {text && text.length > 190 && (
                                      <details className="mt-2">
                                        <summary className="cursor-pointer text-[10px]" style={{ color: W.gold }}>
                                          Show full fix
                                        </summary>
                                        <p
                                          className="mt-1.5 max-h-28 overflow-y-auto rounded p-2.5 whitespace-pre-wrap text-sm leading-[1.65]"
                                          style={{ backgroundColor: W.bg, border: `1px solid ${W.borderFaint}`, color: W.cream2 }}
                                        >
                                          {text}
                                        </p>
                                      </details>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => void copyText(text)}
                                      disabled={!ok}
                                      className="mt-2.5 rounded px-2.5 py-0.5 text-[10px] disabled:opacity-40"
                                      style={{ border: `1px solid ${W.border}`, color: W.muted }}
                                    >
                                      Copy
                                    </button>
                                  </article>
                                );
                              })}
                            </div>
                            {/* Generate button — primary focal action */}
                            {OPTION_KEYS.some((k) => !canSelectOption(active, k)) &&
                              // Strategy cards with already-hydrated candidates should be
                              // reviewed, not regenerated. Only offer generation for
                              // needs-targeting or copy-paste cards that are actually missing
                              // or invalid candidates.
                              !(active.cardType === "revision_strategy" && active.readiness === "ready_for_revise") && (
                              <>
                                {rewriteCache[active.id]?.error && (
                                  <p
                                    className="mt-3 rounded px-4 py-2.5 text-sm leading-relaxed"
                                    style={{ border: `1px solid rgba(122,43,26,0.5)`, backgroundColor: "rgba(122,43,26,0.08)", color: W.dangerText }}
                                  >
                                    {rewriteCache[active.id].error}
                                  </p>
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
                                  className="mt-4 w-full rounded py-3 text-sm font-bold uppercase tracking-[0.10em] disabled:opacity-50 transition-opacity hover:opacity-85"
                                  style={{ backgroundColor: W.oxblood, color: "#FFFFFF" }}
                                >
                                  {rewriteLoading === active.id
                                    ? "Generating distinct A/B/C drafts in author voice…"
                                    : rewriteCache[active.id]?.error
                                    ? "Retry — Generate Distinct A/B/C Drafts"
                                    : "Generate Distinct A/B/C Drafts in Author Voice"}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Custom rewrite textarea */}
                  {customOpen && (
                    <div
                      className="rounded px-5 py-4"
                      style={{ border: `1px solid rgba(200,169,110,0.45)`, backgroundColor: W.surface }}
                    >
                      <Eyebrow>Author Custom Revision</Eyebrow>
                      <textarea
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        rows={4}
                        className="mt-3 w-full rounded p-3 font-serif text-sm leading-[1.65]"
                        style={{ border: `1px solid ${W.border}`, backgroundColor: W.bg, color: W.cream2 }}
                      />
                      <button
                        disabled={!customText.trim()}
                        onClick={() => decide("custom", undefined, customText)}
                        className="mt-2 rounded px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                        style={{ backgroundColor: W.gold, color: W.bg }}
                      >
                        Save custom
                      </button>
                    </div>
                  )}
                </div>

                {/* ════════════════════════════════════════════════════
                    FOOTER TOOLBAR — primary action bar
                ════════════════════════════════════════════════════ */}
                <footer
                  className="shrink-0 px-5 py-3"
                  style={{ borderTop: `1px solid ${W.border}`, backgroundColor: W.surface }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {(() => {
                      const mode = displayMode(active);
                      const allResidue = OPTION_KEYS.every((k) => { const t = candidateText(active, k); return !t || hasTemplateResidue(t); });
                      const effectiveMode = allResidue ? "strategy_only" : mode;
                      const insertLabel = effectiveMode === "excerpt_insertion" ? "Insert" : "Accept";

                      if (effectiveMode === "strategy_only") {
                        const hasVoiceRewrite = !!(rewriteCache[active.id]?.a);
                        if (hasVoiceRewrite && !active.strategyCardViewModel) {
                          const rw = rewriteCache[active.id];
                          return (
                            <>
                              {/* Primary */}
                              <button
                                onClick={() => decide("accepted_a", "A", rw.a)}
                                className="rounded px-4 py-2 text-sm font-semibold"
                                style={{ backgroundColor: W.oxblood, color: "#FFFFFF" }}
                              >
                                Accept A
                              </button>
                              {/* Secondary */}
                              <button
                                onClick={() => decide("accepted_b", "B", rw.b)}
                                className="rounded px-3 py-2 text-sm"
                                style={{ border: `1px solid ${W.border}`, color: W.cream2 }}
                              >
                                Accept B
                              </button>
                              <button
                                onClick={() => decide("accepted_c", "C", rw.c)}
                                className="rounded px-3 py-2 text-sm"
                                style={{ border: `1px solid ${W.border}`, color: W.cream2 }}
                              >
                                Accept C
                              </button>
                              {/* Separator */}
                              <div className="mx-1 h-4 w-px" style={{ backgroundColor: W.border }} />
                              <button
                                onClick={() => decide("keep_original", undefined, "Kept original")}
                                className="rounded px-3 py-2 text-sm"
                                style={{ border: `1px solid ${W.border}`, color: W.muted }}
                              >
                                Keep Original
                              </button>
                              <button
                                onClick={() => decide("deferred", undefined, "Deferred for later decision")}
                                className="rounded px-3 py-2 text-sm"
                                style={{ border: `1px solid ${W.border}`, color: W.muted }}
                              >
                                Defer
                              </button>
                              <button
                                onClick={() => { if (!customOpen) setCustomText(rw.a); setCustomOpen(true); }}
                                className="rounded px-3 py-2 text-sm"
                                style={{ border: `1px solid ${W.border}`, color: W.cream2 }}
                              >
                                Custom Rewrite
                              </button>
                              {/* Danger — visually separated */}
                              <div className="ml-auto">
                                <button
                                  onClick={() => decide("reject", undefined, "Rejected suggestions")}
                                  className="rounded px-3 py-2 text-sm"
                                  style={{ border: `1px solid rgba(122,43,26,0.50)`, color: W.dangerText }}
                                >
                                  Reject All
                                </button>
                              </div>
                            </>
                          );
                        }
                        return (
                          <>
                            <span
                              className="rounded px-3 py-2 text-xs"
                              style={{ border: `1px solid ${W.border}`, color: W.muted }}
                            >
                              Needs A/B/C prose before acceptance
                            </span>
                            <button
                              onClick={() => decide("deferred", undefined, "Deferred for later decision")}
                              className="rounded px-3 py-2 text-sm"
                              style={{ border: `1px solid ${W.border}`, color: W.muted }}
                            >
                              Defer
                            </button>
                            <button
                              onClick={() => { if (!customOpen) setCustomText(""); setCustomOpen(true); }}
                              className="rounded px-3 py-2 text-sm"
                              style={{ border: `1px solid ${W.border}`, color: W.cream2 }}
                            >
                              Custom Rewrite
                            </button>
                            <div className="ml-auto">
                              <button
                                onClick={() => decide("reject", undefined, "Rejected suggestions")}
                                className="rounded px-3 py-2 text-sm"
                                style={{ border: `1px solid rgba(122,43,26,0.50)`, color: W.dangerText }}
                              >
                                Reject All
                              </button>
                            </div>
                          </>
                        );
                      }

                      return (
                        <>
                          {/* Primary — Accept A */}
                          <button
                            onClick={() => decide("accepted_a", "A", candidateText(active, "A"))}
                            disabled={!canSelectOption(active, "A")}
                            className="rounded px-4 py-2 text-sm font-semibold disabled:opacity-40"
                            style={{ backgroundColor: W.oxblood, color: "#FFFFFF" }}
                          >
                            {insertLabel} A
                          </button>
                          {/* Secondary */}
                          <button
                            onClick={() => decide("accepted_b", "B", candidateText(active, "B"))}
                            disabled={!canSelectOption(active, "B")}
                            className="rounded px-3 py-2 text-sm disabled:opacity-40"
                            style={{ border: `1px solid ${W.border}`, color: W.cream2 }}
                          >
                            {insertLabel} B
                          </button>
                          <button
                            onClick={() => decide("accepted_c", "C", candidateText(active, "C"))}
                            disabled={!canSelectOption(active, "C")}
                            className="rounded px-3 py-2 text-sm disabled:opacity-40"
                            style={{ border: `1px solid ${W.border}`, color: W.cream2 }}
                          >
                            {insertLabel} C
                          </button>
                          {/* Separator */}
                          <div className="mx-1 h-4 w-px" style={{ backgroundColor: W.border }} />
                          <button
                            onClick={() => decide("keep_original", undefined, "Kept original")}
                            className="rounded px-3 py-2 text-sm"
                            style={{ border: `1px solid ${W.border}`, color: W.muted }}
                          >
                            Keep Original
                          </button>
                          <button
                            onClick={() => decide("deferred", undefined, "Deferred for later decision")}
                            className="rounded px-3 py-2 text-sm"
                            style={{ border: `1px solid ${W.border}`, color: W.muted }}
                          >
                            Defer
                          </button>
                          <button
                            onClick={() => {
                              if (customOpen && customText.trim()) {
                                decide("custom", undefined, customText);
                              } else {
                                if (!customOpen) setCustomText(selectedText);
                                setCustomOpen(true);
                              }
                            }}
                            className="rounded px-3 py-2 text-sm"
                            style={{ border: `1px solid ${W.border}`, color: W.cream2 }}
                          >
                            {customOpen && customText.trim() ? "Save Custom" : (customOperationLabels[effectiveOperation(active)] ?? "Custom Rewrite")}
                          </button>
                          {/* Danger — pushed to far right */}
                          <div className="ml-auto">
                            <button
                              onClick={() => decide("reject", undefined, "Rejected suggestions")}
                              className="rounded px-3 py-2 text-sm"
                              style={{ border: `1px solid rgba(122,43,26,0.50)`, color: W.dangerText }}
                            >
                              Reject All
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </footer>
              </>
            ) : (
              <div className="m-5 rounded px-5 py-5 text-sm" style={{ border: `1px solid ${W.border}`, color: W.muted }}>
                No open opportunities match the current filters.
              </div>
            )}

            {/* ════════════════════════════════════════════════════
                REVISION LEDGER — bottom strip
            ════════════════════════════════════════════════════ */}
            <section
              className="shrink-0 px-5 pb-4 pt-3"
              style={{ borderTop: `1px solid ${W.border}`, backgroundColor: W.bg }}
            >
              {ledger.length === 0 ? (
                <div className="flex gap-3 items-center">
                  <Eyebrow>Revision Ledger</Eyebrow>
                  <span aria-hidden="true" style={{ color: W.border }}>{"\u00b7"}</span>
                  <span className="text-xs" style={{ color: W.dim }}>No decisions yet.</span>
                </div>
              ) : (
                <>
                  <div className="mb-2.5 flex flex-wrap gap-1.5 items-center">
                    <Eyebrow>Revision Ledger</Eyebrow>
                    <div className="ml-3 flex flex-wrap gap-1">
                      {LEDGER_FILTERS.map((filter) => (
                        <button
                          key={filter.value}
                          type="button"
                          onClick={() => setFilters((f) => ({ ...f, status: filter.value }))}
                          className="rounded px-2 py-0.5 text-[10px]"
                          style={
                            filters.status === filter.value
                              ? { border: `1px solid ${W.gold}`, color: W.cream }
                              : { border: `1px solid ${W.border}`, color: W.dim }
                          }
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div
                    className="max-h-28 overflow-y-auto rounded"
                    style={{ border: `1px solid ${W.borderFaint}` }}
                  >
                    <table className="w-full text-left text-xs">
                      <thead
                        className="sticky top-0 text-[10px] uppercase tracking-[0.12em]"
                        style={{ backgroundColor: W.surface, color: W.gold }}
                      >
                        <tr>
                          <th className="px-3 py-1.5">Decision</th>
                          <th className="px-3 py-1.5">Criterion</th>
                          <th className="px-3 py-1.5">Item</th>
                          <th className="px-3 py-1.5">Sync</th>
                          <th className="px-3 py-1.5">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLedger.map((entry) => (
                          <tr key={entry.id} style={{ borderTop: `1px solid ${W.borderFaint}` }}>
                            <td className="px-3 py-2" style={{ color: W.cream2 }}>
                              {decisionLabel(entry.decision)}{entry.option ? ` (${entry.option})` : ""}
                            </td>
                            <td className="px-3 py-2" style={{ color: W.muted }}>{entry.criterion}</td>
                            <td className="px-3 py-2" style={{ color: W.muted }}>{entry.itemTitle}</td>
                            <td className="px-3 py-2" style={{ color: W.dim }}>{entry.syncStatus}</td>
                            <td className="px-3 py-2">
                              <button
                                onClick={() => unselect(entry)}
                                className="rounded px-2 py-0.5 text-[10px]"
                                style={{ border: `1px solid ${W.border}`, color: W.gold }}
                              >
                                Unselect
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

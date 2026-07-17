"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { WorkbenchOpportunity, WorkbenchQueuePayload } from "@/lib/revision/workbenchQueue";
import type { ClassifiedWorkbenchOpportunity } from "@/lib/revision/workbenchQueueProjection";
import WorkbenchCardSurface from "./WorkbenchCardSurface";
import { adaptWorkbenchOpportunityToCard } from "./workbenchCardAdapter";
import type { CopyPasteCandidateKey } from "./workbenchCardModels";
import ResetQueueButton from "./ResetQueueButton";
import TrustedPathWorkbenchButton from "./TrustedPathWorkbenchButton";
import HardResetRestartButton from "@/components/evaluation/HardResetRestartButton";

type Decision = "accepted_a" | "accepted_b" | "accepted_c" | "custom" | "keep_original" | "reject" | "deferred";

type LedgerEntry = {
  localId: string;
  opportunityId: string;
  opportunityTitle: string;
  decision: Decision;
  selectedOption: CopyPasteCandidateKey | null;
  selectedText: string | null;
  syncStatus: "pending" | "synced" | "failed";
};

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rg-workbench-gold)]";

function sourceTextOf(item: WorkbenchOpportunity): string {
  const text = `${item.quoteHighlight ?? ""}${item.quoteRest ?? ""}`.trim();
  return /no excerpt available/i.test(text) ? "" : text;
}

function optionText(item: WorkbenchOpportunity, key: CopyPasteCandidateKey): string {
  const option = item.options.find((candidate) => candidate.key === key);
  return (option?.candidateText ?? option?.text ?? "").trim();
}

function criterionOf(item: WorkbenchOpportunity): string {
  return item.criterion || item.crumb.split(" · ")[0]?.trim() || "General";
}

function formatCriterion(value: string): string {
  return value.replace(/_/g, " ");
}

function decisionFor(key: CopyPasteCandidateKey): Decision {
  return key === "A" ? "accepted_a" : key === "B" ? "accepted_b" : "accepted_c";
}

function cardLabel(item: ClassifiedWorkbenchOpportunity): string {
  if (item.finalDecision.cardType === "copy_paste_rewrite") return "Copy-paste";
  if (item.finalDecision.cardType === "revision_strategy") return "Strategy";
  return "Held";
}

function cardBadgeClasses(item: ClassifiedWorkbenchOpportunity): string {
  if (item.finalDecision.cardType === "copy_paste_rewrite") {
    return "border-[#2a5a3f] bg-[#132a1e] text-[var(--rg-workbench-success)]";
  }
  if (item.finalDecision.cardType === "revision_strategy") {
    return "border-[#7b4b1f] bg-[#2a1b0b] text-[var(--rg-workbench-gold)]";
  }
  return "border-[#8f4141] bg-[#2a1010] text-[var(--rg-workbench-danger)]";
}

function queueBadgeClasses(active: boolean, type: "active" | "held"): string {
  if (active && type === "active") {
    return "border-[var(--rg-workbench-gold)] bg-[#2a1b0b] text-[var(--rg-workbench-gold-strong)]";
  }
  if (active && type === "held") {
    return "border-[#8f4141] bg-[#2a1010] text-[#efb0b0]";
  }
  return "border-[var(--rg-workbench-border)] text-[var(--rg-workbench-text-secondary)]";
}

function messageClasses(message: string | null): string {
  if (!message) return "";
  if (/could not|failed/i.test(message)) {
    return "border-[#8f4141] bg-[#2a1010] text-[var(--rg-workbench-danger)]";
  }
  if (/saving|retrying|re-analysis/i.test(message)) {
    return "border-[#7b4b1f] bg-[#2a1b0b] text-[var(--rg-workbench-warning)]";
  }
  return "border-[#2a5a3f] bg-[#132a1e] text-[var(--rg-workbench-success)]";
}

function getHeldReason(item: WorkbenchOpportunity): string {
  const reasons = [
    ...(item.executabilityReasons ?? []),
    ...(item.preflightReasons ?? []),
    ...(item.hydrationFailureReasons ?? []),
    ...(item.resBlockerReasons ?? []),
  ]
    .join(" ")
    .toLowerCase();

  if (/evidence|anchor|grounding|excerpt|manuscript match/.test(reasons)) {
    return "Evidence could not be verified against the manuscript.";
  }
  if (/coordinate|location|target|placeholder/.test(reasons)) {
    return "The revision location is not precise enough.";
  }
  if (/context|before_after|hydration|local context/.test(reasons)) {
    return "More surrounding manuscript context is required.";
  }
  if (/canon|continuity|voice|pov|testimony|metaphor/.test(reasons)) {
    return "The proposed change may affect canon, continuity, voice, or point of view.";
  }
  if (/candidate|quality|rewrite|prose|copy-paste/.test(reasons)) {
    return "The suggested wording did not pass the revision quality checks.";
  }
  return item.groundingNote ?? item.adminRepairReason ?? item.readinessReason ?? "This revision requires re-analysis before it can be used safely.";
}

export default function ReviseCockpitClientWorkflowV2({ payload }: { payload: WorkbenchQueuePayload }) {
  const interactiveItems = useMemo(() => {
    const seen = new Set<string>();
    return [...payload.opportunities, ...payload.needsTargeting]
      .filter((item) => item.finalDecision.cardType !== "withheld")
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
  }, [payload.needsTargeting, payload.opportunities]);

  const heldItems = useMemo(() => {
    const seen = new Set<string>();
    return [...payload.withheldUnsupported, ...payload.needsTargeting.filter((item) => item.finalDecision.cardType === "withheld")]
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
  }, [payload.needsTargeting, payload.withheldUnsupported]);

  const [activeId, setActiveId] = useState(interactiveItems[0]?.id ?? "");
  const [selectedKey, setSelectedKey] = useState<CopyPasteCandidateKey>("A");
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<"all" | WorkbenchOpportunity["severity"]>("all");
  const [showHeld, setShowHeld] = useState(interactiveItems.length === 0 && heldItems.length > 0);

  const decidedIds = useMemo(() => new Set(ledger.map((entry) => entry.opportunityId)), [ledger]);
  const openItems = interactiveItems.filter((item) => !decidedIds.has(item.id));
  const filteredItems = openItems.filter((item) => {
    if (priority !== "all" && item.severity !== priority) return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return `${item.title} ${item.criterion} ${item.anchor ?? ""}`.toLowerCase().includes(query);
  });

  const active = filteredItems.find((item) => item.id === activeId) ?? filteredItems[0] ?? openItems[0] ?? null;
  const activeCard = active
    ? adaptWorkbenchOpportunityToCard(active)
    : null;
  const failedEntries = ledger.filter((entry) => entry.syncStatus === "failed");
  const totalInteractive = interactiveItems.length;
  const completedCount = ledger.length;

  const finalReviewHref =
    payload.manuscriptId && payload.evaluationJobId
      ? `/workbench/final-review?${new URLSearchParams({ manuscriptId: payload.manuscriptId, evaluationJobId: payload.evaluationJobId }).toString()}`
      : "/workbench/final-review";

  async function sync(entry: LedgerEntry, item: ClassifiedWorkbenchOpportunity) {
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
            selectedOption: entry.selectedOption,
            selectedText: entry.selectedText,
            customText: entry.decision === "custom" ? entry.selectedText : null,
            sourceExcerpt: sourceTextOf(item) || null,
            sourceLocation: item.anchor || item.meta || null,
            clientCreatedAt: new Date().toISOString(),
            isUndo: false,
            undoneLocalId: null,
            metadata: {
              source: "workflow-revise-cockpit-v2",
              revisionOperation: item.revisionOperation,
              criterion: criterionOf(item),
              severity: item.severity,
              scope: item.evidenceLocationScope ?? item.scope,
              evidenceLocationScope: item.evidenceLocationScope ?? item.scope,
              repairScope: item.repairScope ?? item.scope,
              cardType: item.finalDecision.cardType,
              trustedPathStatus: item.finalDecision.trustedPathStatus,
            },
          }],
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error ?? "Ledger sync failed");
      setLedger((rows) => rows.map((row) => (row.localId === entry.localId ? { ...row, syncStatus: "synced" } : row)));
      setMessage(`Saved: ${entry.opportunityTitle}`);
    } catch {
      setLedger((rows) => rows.map((row) => (row.localId === entry.localId ? { ...row, syncStatus: "failed" } : row)));
      setMessage(`Save failed: ${entry.opportunityTitle}`);
    }
  }

  function retry(entry: LedgerEntry) {
    const item = interactiveItems.find((candidate) => candidate.id === entry.opportunityId);
    if (!item) {
      setMessage("Retry unavailable because the opportunity is no longer in this queue");
      return;
    }
    const pending = { ...entry, syncStatus: "pending" as const };
    setLedger((rows) => rows.map((row) => (row.localId === entry.localId ? pending : row)));
    setMessage(`Retrying: ${entry.opportunityTitle}`);
    void sync(pending, item);
  }

  function advance(item: ClassifiedWorkbenchOpportunity) {
    const index = filteredItems.findIndex((candidate) => candidate.id === item.id);
    const next = filteredItems[index + 1] ?? filteredItems.find((candidate) => candidate.id !== item.id) ?? null;
    setActiveId(next?.id ?? "");
    setSelectedKey("A");
  }

  function decide(item: ClassifiedWorkbenchOpportunity, decision: Decision, selectedOption: CopyPasteCandidateKey | null, selectedText: string | null) {
    if (decision.startsWith("accepted_") && item.finalDecision.cardType !== "copy_paste_rewrite") return;
    const entry: LedgerEntry = {
      localId: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      opportunityId: item.id,
      opportunityTitle: item.title,
      decision,
      selectedOption,
      selectedText,
      syncStatus: "pending",
    };
    setLedger((rows) => [entry, ...rows.filter((row) => row.opportunityId !== item.id)]);
    setMessage(`Saving: ${item.title}`);
    void sync(entry, item);
    advance(item);
  }

  function customDecision(item: ClassifiedWorkbenchOpportunity, strategy: boolean) {
    const prompt = strategy ? "Add your revision plan or notes:" : "Enter your custom replacement text:";
    const text = window.prompt(prompt, "");
    if (text?.trim()) decide(item, "custom", null, text.trim());
  }

  function requestReanalysis(item: ClassifiedWorkbenchOpportunity) {
    setMessage(`Re-analysis requested for ${item.title}`);
  }

  if (!payload.ok) {
    return (
      <main className="rg-workbench flex min-h-[calc(100vh-72px)] items-center justify-center p-6">
        <section className="max-w-xl rounded-xl border border-[#8f4141] bg-[var(--rg-workbench-surface)] p-8 text-center" role="alert">
          <h1 className="text-lg font-semibold text-[var(--rg-workbench-text-primary)]">Revise Workbench could not load</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--rg-workbench-text-secondary)]">{payload.error ?? "Please reopen the evaluation and try again."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="rg-workbench min-h-[calc(100vh-72px)]">
      <div className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-none flex-col">
        <header className="border-b border-[var(--rg-workbench-border)] bg-[var(--rg-workbench-surface)] px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--rg-workbench-gold)]">Revise Workbench</p>
              <h1 className="mt-2 text-2xl font-semibold leading-tight text-[var(--rg-workbench-text-primary)]">{payload.manuscriptTitle}</h1>
              <p className="mt-2 text-sm text-[var(--rg-workbench-text-secondary)]">{completedCount} of {totalInteractive} active decisions recorded</p>
            </div>

            <div className="mt-1 flex flex-col gap-3 xl:mt-0 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("h-10 rounded-md border px-3 py-2 text-xs font-semibold flex items-center", "border-[#2a5a3f] bg-[#132a1e] text-[var(--rg-workbench-success)]")}>
                  {openItems.filter((item) => item.finalDecision.cardType === "copy_paste_rewrite").length} copy-paste
                </span>
                <span className={cn("h-10 rounded-md border px-3 py-2 text-xs font-semibold flex items-center", "border-[#7b4b1f] bg-[#2a1b0b] text-[var(--rg-workbench-gold)]")}
                >
                  {openItems.filter((item) => item.finalDecision.cardType === "revision_strategy").length} strategies
                </span>
                <button
                  type="button"
                  onClick={() => setShowHeld((value) => !value)}
                  className={cn("h-10 rounded-md border px-3 py-2 text-xs font-semibold", focusRing, showHeld ? "border-[#8f4141] bg-[#2a1010] text-[#efb0b0]" : "border-[var(--rg-workbench-border)] text-[var(--rg-workbench-text-secondary)]")}
                  aria-pressed={showHeld}
                >
                  {heldItems.length} held
                </button>
                {message && <span className={cn("h-10 rounded-md border px-3 py-2 text-xs flex items-center", messageClasses(message))} role="status" aria-live="polite">{message}</span>}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ResetQueueButton evaluationJobId={payload.evaluationJobId ?? null} />
                {payload.evaluationJobId && <HardResetRestartButton jobId={payload.evaluationJobId} compact label="Restart Eval" />}
                <TrustedPathWorkbenchButton manuscriptId={payload.manuscriptId ?? null} evaluationJobId={payload.evaluationJobId ?? null} disabled={!payload.ok || payload.opportunities.length === 0} />
                <Link
                  href={finalReviewHref}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--rg-workbench-gold)] bg-[var(--rg-workbench-surface)] px-4 text-sm font-semibold text-[var(--rg-workbench-gold)] shadow-sm transition hover:bg-[var(--rg-workbench-surface-raised)]"
                >
                  Apply & Export
                </Link>
              </div>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[var(--rg-workbench-sidebar-width)_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
          <aside
            className="flex min-h-0 flex-col border-b border-[var(--rg-workbench-border)] bg-[var(--rg-workbench-surface)] lg:border-b-0 lg:border-r"
            aria-label="Revision opportunity navigation"
          >
            <div className="space-y-3 border-b border-[var(--rg-workbench-border)] p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--rg-workbench-text-primary)]">Revision Queue</h2>
                <span className="rounded-full border border-[var(--rg-workbench-border)] bg-[var(--rg-workbench-bg)] px-2 py-0.5 text-[11px] text-[var(--rg-workbench-gold)]">
                  {showHeld ? heldItems.length : filteredItems.length} / {showHeld ? heldItems.length : openItems.length}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Queue view">
                <button
                  type="button"
                  onClick={() => setShowHeld(false)}
                  aria-pressed={!showHeld}
                  className={cn("h-11 rounded-md border px-4 text-sm font-semibold", focusRing, queueBadgeClasses(!showHeld, "active"))}
                >
                  Active ({openItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setShowHeld(true)}
                  aria-pressed={showHeld}
                  className={cn("h-11 rounded-md border px-4 text-sm font-semibold", focusRing, queueBadgeClasses(showHeld, "held"))}
                >
                  Held ({heldItems.length})
                </button>
              </div>

              {!showHeld && (
                <>
                  <label className="sr-only" htmlFor="workbench-search">Search opportunities</label>
                  <input
                    id="workbench-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search opportunities"
                    className={cn(
                      "h-10 w-full rounded-md border border-[var(--rg-workbench-border)] bg-[var(--rg-workbench-bg)] px-3 text-sm",
                      "text-[var(--rg-workbench-text-primary)] placeholder:text-[var(--rg-workbench-text-muted)]",
                      focusRing
                    )}
                  />
                  <label className="sr-only" htmlFor="workbench-priority">Filter by priority</label>
                  <select
                    id="workbench-priority"
                    value={priority}
                    onChange={(event) => setPriority(event.target.value as typeof priority)}
                    className={cn(
                      "h-10 w-full rounded-md border border-[var(--rg-workbench-border)] bg-[var(--rg-workbench-bg)] px-3 text-sm",
                      "text-[var(--rg-workbench-text-secondary)]",
                      focusRing
                    )}
                  >
                    <option value="all">All priorities</option>
                    <option value="must">Recommended</option>
                    <option value="should">Optional</option>
                    <option value="could">Consider</option>
                  </select>
                </>
              )}
            </div>

            <ol className="min-h-0 flex-1 overflow-y-auto p-4" aria-label={showHeld ? "Held items" : "Active revision opportunities"}>
              {(showHeld ? heldItems : filteredItems).map((item, index) => {
                const isActive = !showHeld && item.id === active?.id;
                return (
                  <li key={item.id} className="mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!showHeld) {
                          setActiveId(item.id);
                          setSelectedKey("A");
                        }
                      }}
                      aria-current={isActive ? "true" : undefined}
                      className={cn(
                        "w-full rounded-lg border p-4 text-left transition",
                        focusRing,
                        isActive
                          ? "rg-workbench-selected"
                          : "rg-workbench-surface-raised hover:border-[var(--rg-workbench-border-strong)]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className={cn("shrink-0 rounded border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide", cardBadgeClasses(item))}>
                          {cardLabel(item)}
                        </span>
                        <span className="min-w-0 text-right text-sm font-semibold leading-5 text-[var(--rg-workbench-text-secondary)]">
                          {formatCriterion(criterionOf(item))}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm font-medium leading-5 text-[var(--rg-workbench-text-primary)]">
                        {index + 1}. {item.title}
                      </p>
                      {item.issueStatement && (
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--rg-workbench-text-muted)]">{item.issueStatement}</p>
                      )}
                      {showHeld && (
                        <div className="mt-3 rounded-md border border-[#6d3232] bg-[#241010] p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#efb0b0]">Why this is held</p>
                          <p className="mt-1 text-sm leading-5 text-[#e6c6c6]">{getHeldReason(item)}</p>
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
              {!showHeld && openItems.length > 0 && filteredItems.length === 0 && (
                <li className="rounded-lg border border-[var(--rg-workbench-border)] p-4 text-sm leading-5 text-[var(--rg-workbench-text-muted)]">
                  No open opportunities match the current search and priority filters.
                </li>
              )}
            </ol>
          </aside>

          <section className="min-h-0 flex-1 overflow-y-auto bg-[var(--rg-workbench-bg)] px-6 py-6 lg:px-8 lg:py-8" aria-label={showHeld ? "Held items summary" : "Active revision workspace"}>
            {showHeld ? (
              <div className="mx-auto w-full max-w-[1200px] space-y-5">
                <header className="border-b border-[var(--rg-workbench-border)] pb-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--rg-workbench-danger)]">Held Items Summary</p>
                  <h2 className="mt-1 text-2xl font-semibold text-[var(--rg-workbench-text-primary)]">Items requiring more evidence or context</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--rg-workbench-text-secondary)]">
                    Held items are visible for transparency but are not part of the interactive editing queue. They contain no generated candidate prose and cannot be accepted.
                  </p>
                </header>
                {heldItems.length ? (
                  heldItems.map((item) => (
                    <div key={item.id} className="rounded-xl border border-[var(--rg-workbench-border)] bg-[var(--rg-workbench-surface)] p-5">
                      <WorkbenchCardSurface
                        viewModel={adaptWorkbenchOpportunityToCard(item)}
                        actions={{ onRequestReanalysis: () => requestReanalysis(item) }}
                      />
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-[var(--rg-workbench-border)] p-5 text-sm text-[var(--rg-workbench-text-muted)]">No held items.</p>
                )}
              </div>
            ) : active && activeCard ? (
              <div className="mx-auto w-full max-w-[1200px]">
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  <span className={cn("rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]", cardBadgeClasses(active))}>{cardLabel(active)}</span>
                  <span className="rounded border border-[var(--rg-workbench-border)] px-2 py-1 text-[10px] text-[var(--rg-workbench-text-secondary)]">{formatCriterion(criterionOf(active))}</span>
                  <span className="rounded border border-[var(--rg-workbench-border)] px-2 py-1 text-[10px] text-[var(--rg-workbench-text-secondary)]">{active.evidenceLocationScope ?? active.scope}</span>
                </div>
                <WorkbenchCardSurface
                  viewModel={activeCard}
                  actions={{
                    selectedKey,
                    onSelectCandidate: setSelectedKey,
                    onAcceptCandidate: (key) => decide(active, decisionFor(key), key, optionText(active, key)),
                    onKeepOriginal: () => decide(active, "keep_original", null, "Kept original"),
                    onCustomRewrite: () => customDecision(active, false),
                    onCustomPlan: () => customDecision(active, true),
                    onDefer: () => decide(active, "deferred", null, "Deferred for later decision"),
                    onReject: () => decide(active, "reject", null, "Rejected recommendation"),
                    onRequestReanalysis: () => requestReanalysis(active),
                  }}
                />
              </div>
            ) : ledger.length ? (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-lg rounded-xl border border-[#2a5a3f] bg-[#132a1e] p-8 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--rg-workbench-success)]">Queue complete</p>
                  <h2 className="mt-2 text-lg font-semibold text-[var(--rg-workbench-text-primary)]">All active opportunities are in the ledger</h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--rg-workbench-text-secondary)]">Open Final Review to apply accepted changes or inspect your deferred and rejected decisions.</p>
                  {failedEntries.length > 0 && (
                    <div className="mt-4 rounded-md border border-[#8f4141] bg-[#2a1010] p-3 text-left">
                      <p className="text-sm text-[var(--rg-workbench-danger)]">
                        {failedEntries.length} decision{failedEntries.length === 1 ? " still needs" : "s still need"} to be retried before Final Review is complete.
                      </p>
                      <ul className="mt-3 space-y-2">
                        {failedEntries.map((entry) => (
                          <li key={entry.localId} className="flex items-center justify-between gap-3">
                            <span className="text-sm text-[var(--rg-workbench-text-secondary)] truncate">{entry.opportunityTitle}</span>
                            <button
                              type="button"
                              onClick={() => retry(entry)}
                              className={cn("rounded-md border border-[var(--rg-workbench-border)] px-3 py-1.5 text-xs text-[var(--rg-workbench-gold)] transition hover:border-[var(--rg-workbench-gold)]", focusRing)}
                            >
                              Retry: {entry.opportunityTitle}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : heldItems.length ? (
              <div className="flex h-full items-center justify-center">
                <button type="button" onClick={() => setShowHeld(true)} className={cn("max-w-lg rounded-xl border border-[#8f4141] bg-[#2a1010] p-8 text-left", focusRing)}>
                  <h2 className="text-lg font-semibold text-[var(--rg-workbench-text-primary)]">No interactive revisions are available</h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--rg-workbench-text-secondary)]">
                    {heldItems.length} item{heldItems.length === 1 ? " is" : "s are"} held for additional grounding. Open the Held Items Summary for details.
                  </p>
                </button>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--rg-workbench-text-muted)]">No revision opportunities were found.</div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

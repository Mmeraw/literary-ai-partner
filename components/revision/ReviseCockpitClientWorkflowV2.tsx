"use client";

import { useMemo, useState } from "react";
import type { WorkbenchOpportunity, WorkbenchQueuePayload } from "@/lib/revision/workbenchQueue";
import WorkbenchCardSurface from "./WorkbenchCardSurface";
import { adaptWorkbenchOpportunityToCard } from "./workbenchCardAdapter";
import type { CopyPasteCandidateKey } from "./workbenchCardModels";

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

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#12100B]";

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

function cardLabel(item: WorkbenchOpportunity): string {
  if (item.cardType === "copy_paste_rewrite") return "Copy-paste";
  if (item.cardType === "revision_strategy") return "Strategy";
  return "Held";
}

function statusClasses(item: WorkbenchOpportunity): string {
  if (item.cardType === "copy_paste_rewrite") return "border-emerald-800/70 bg-emerald-950/30 text-emerald-200";
  if (item.cardType === "revision_strategy") return "border-amber-800/70 bg-amber-950/20 text-amber-200";
  return "border-red-900/70 bg-red-950/20 text-red-200";
}

function messageClasses(message: string | null): string {
  if (!message) return "";
  if (/could not|failed/i.test(message)) return "border-red-800/70 bg-red-950/25 text-red-200";
  if (/saving/i.test(message)) return "border-amber-800/70 bg-amber-950/25 text-amber-100";
  return "border-emerald-800/70 bg-emerald-950/25 text-emerald-200";
}

export default function ReviseCockpitClientWorkflowV2({ payload }: { payload: WorkbenchQueuePayload }) {
  const interactiveItems = useMemo(() => {
    const seen = new Set<string>();
    return [...payload.opportunities, ...payload.needsTargeting]
      .filter((item) => item.cardType !== "withheld")
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
  }, [payload.needsTargeting, payload.opportunities]);

  const heldItems = useMemo(() => {
    const seen = new Set<string>();
    return [...payload.withheldUnsupported, ...payload.needsTargeting.filter((item) => item.cardType === "withheld")]
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
  const activeCard = active ? adaptWorkbenchOpportunityToCard(active) : null;
  const failedEntries = ledger.filter((entry) => entry.syncStatus === "failed");
  const totalInteractive = interactiveItems.length;
  const completedCount = ledger.length;

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
              cardType: item.cardType,
              trustedPathStatus: item.trustedPathStatus,
            },
          }],
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error ?? "Ledger sync failed");
      setLedger((rows) => rows.map((row) => row.localId === entry.localId ? { ...row, syncStatus: "synced" } : row));
      setMessage(`Saved: ${entry.opportunityTitle}`);
    } catch {
      setLedger((rows) => rows.map((row) => row.localId === entry.localId ? { ...row, syncStatus: "failed" } : row));
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
    setLedger((rows) => rows.map((row) => row.localId === entry.localId ? pending : row));
    setMessage(`Retrying: ${entry.opportunityTitle}`);
    void sync(pending, item);
  }

  function advance(item: WorkbenchOpportunity) {
    const index = filteredItems.findIndex((candidate) => candidate.id === item.id);
    const next = filteredItems[index + 1] ?? filteredItems.find((candidate) => candidate.id !== item.id) ?? null;
    setActiveId(next?.id ?? "");
    setSelectedKey("A");
  }

  function decide(item: WorkbenchOpportunity, decision: Decision, selectedOption: CopyPasteCandidateKey | null, selectedText: string | null) {
    if (decision.startsWith("accepted_") && item.cardType !== "copy_paste_rewrite") return;
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

  function customDecision(item: WorkbenchOpportunity, strategy: boolean) {
    const prompt = strategy ? "Add your revision plan or notes:" : "Enter your custom replacement text:";
    const text = window.prompt(prompt, "");
    if (text?.trim()) decide(item, "custom", null, text.trim());
  }

  function requestReanalysis(item: WorkbenchOpportunity) {
    setMessage(`Re-analysis requested for ${item.title}`);
  }

  if (!payload.ok) {
    return (
      <main className="fixed inset-x-0 bottom-0 top-[72px] flex items-center justify-center bg-[#0D0A05] p-6 text-stone-100">
        <section className="max-w-xl rounded-xl border border-red-900/60 bg-[#1C160E] p-8 text-center" role="alert">
          <h1 className="text-lg font-semibold">Revise Workbench could not load</h1>
          <p className="mt-3 text-sm leading-6 text-stone-300">{payload.error ?? "Please reopen the evaluation and try again."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="fixed inset-x-0 bottom-0 top-[72px] overflow-hidden bg-[#0D0A05] p-2 text-stone-100 sm:p-3">
      <div className="mx-auto flex h-full max-w-[1600px] flex-col overflow-hidden rounded-xl border border-[#2E261A] bg-[#12100B] shadow-2xl">
        <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#2E261A] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300/75">Revision Workbench</p>
            <h1 className="mt-1 truncate text-lg font-semibold text-stone-100">{payload.manuscriptTitle}</h1>
            <p className="mt-1 text-[11px] text-stone-500">{completedCount} of {totalInteractive} active decisions recorded</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded border border-emerald-800/60 px-2 py-1 text-emerald-200">{openItems.filter((item) => item.cardType === "copy_paste_rewrite").length} copy-paste</span>
            <span className="rounded border border-amber-800/60 px-2 py-1 text-amber-200">{openItems.filter((item) => item.cardType === "revision_strategy").length} strategies</span>
            <button type="button" onClick={() => setShowHeld((value) => !value)} className={`rounded border border-red-900/60 px-2 py-1 text-red-200 ${focusRing}`} aria-pressed={showHeld}>
              {heldItems.length} held
            </button>
            {message && <span className={`rounded border px-2 py-1 ${messageClasses(message)}`} role="status" aria-live="polite">{message}</span>}
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-b border-[#2E261A] bg-[#171209] lg:border-b-0 lg:border-r" aria-label="Revision opportunity navigation">
            <div className="space-y-2 border-b border-[#2E261A] p-3">
              <div className="flex gap-2" role="group" aria-label="Queue view">
                <button type="button" onClick={() => setShowHeld(false)} aria-pressed={!showHeld} className={`flex-1 rounded px-3 py-2 text-xs ${focusRing} ${!showHeld ? "bg-amber-900/30 text-amber-100" : "border border-stone-700 text-stone-400"}`}>
                  Active ({openItems.length})
                </button>
                <button type="button" onClick={() => setShowHeld(true)} aria-pressed={showHeld} className={`flex-1 rounded px-3 py-2 text-xs ${focusRing} ${showHeld ? "bg-red-950/40 text-red-200" : "border border-stone-700 text-stone-400"}`}>
                  Held ({heldItems.length})
                </button>
              </div>
              {!showHeld && (
                <>
                  <label className="sr-only" htmlFor="workbench-search">Search opportunities</label>
                  <input id="workbench-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search opportunities" className={`h-9 w-full rounded border border-stone-700 bg-[#0D0A05] px-3 text-xs text-stone-200 ${focusRing}`} />
                  <label className="sr-only" htmlFor="workbench-priority">Filter by priority</label>
                  <select id="workbench-priority" value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)} className={`h-9 w-full rounded border border-stone-700 bg-[#0D0A05] px-3 text-xs text-stone-300 ${focusRing}`}>
                    <option value="all">All priorities</option>
                    <option value="must">Recommended</option>
                    <option value="should">Optional</option>
                    <option value="could">Consider</option>
                  </select>
                </>
              )}
            </div>

            <ol className="min-h-0 flex-1 overflow-y-auto p-2" aria-label={showHeld ? "Held items" : "Active revision opportunities"}>
              {(showHeld ? heldItems : filteredItems).map((item, index) => {
                const isActive = !showHeld && item.id === active?.id;
                return (
                  <li key={item.id} className="mb-1">
                    <button type="button" onClick={() => { if (!showHeld) { setActiveId(item.id); setSelectedKey("A"); } }} aria-current={isActive ? "true" : undefined} className={`w-full rounded border p-3 text-left transition ${focusRing} ${isActive ? "border-amber-500 bg-amber-950/25 shadow-[inset_3px_0_0_0_rgba(245,158,11,0.9)]" : "border-stone-800 bg-transparent hover:border-stone-700 hover:bg-stone-900/20"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] ${statusClasses(item)}`}>{cardLabel(item)}</span>
                        <span className="text-[9px] text-stone-500">{formatCriterion(criterionOf(item))}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-stone-200">{index + 1}. {item.title}</p>
                    </button>
                  </li>
                );
              })}
              {!showHeld && openItems.length > 0 && filteredItems.length === 0 && (
                <li className="rounded-lg border border-stone-800 p-4 text-xs leading-5 text-stone-400">No open opportunities match the current search and priority filters.</li>
              )}
            </ol>
          </aside>

          <section className="min-h-0 overflow-y-auto bg-[#1C160E] p-4 sm:p-5 lg:p-7" aria-label={showHeld ? "Held items summary" : "Active revision workspace"}>
            {showHeld ? (
              <div className="space-y-5">
                <header>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-300/80">Held Items Summary</p>
                  <h2 className="mt-1 text-xl font-semibold">Items requiring more evidence or context</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-400">Held items are visible for transparency but are not part of the interactive editing queue. They contain no generated candidate prose and cannot be accepted.</p>
                </header>
                {heldItems.length ? heldItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-stone-800 bg-[#12100B] p-4 sm:p-5">
                    <WorkbenchCardSurface viewModel={adaptWorkbenchOpportunityToCard(item)} actions={{ onRequestReanalysis: () => requestReanalysis(item) }} />
                  </div>
                )) : <p className="rounded border border-stone-800 p-5 text-sm text-stone-400">No held items.</p>}
              </div>
            ) : active && activeCard ? (
              <div className="mx-auto max-w-6xl">
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <span className={`rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusClasses(active)}`}>{cardLabel(active)}</span>
                  <span className="rounded border border-stone-700 px-2 py-1 text-[10px] text-stone-400">{formatCriterion(criterionOf(active))}</span>
                  <span className="rounded border border-stone-700 px-2 py-1 text-[10px] text-stone-400">{active.evidenceLocationScope ?? active.scope}</span>
                </div>
                <WorkbenchCardSurface viewModel={activeCard} actions={{ selectedKey, onSelectCandidate: setSelectedKey, onAcceptCandidate: (key) => decide(active, decisionFor(key), key, optionText(active, key)), onKeepOriginal: () => decide(active, "keep_original", null, "Kept original"), onCustomRewrite: () => customDecision(active, false), onCustomPlan: () => customDecision(active, true), onDefer: () => decide(active, "deferred", null, "Deferred for later decision"), onReject: () => decide(active, "reject", null, "Rejected recommendation"), onRequestReanalysis: () => requestReanalysis(active) }} />
              </div>
            ) : ledger.length ? (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-lg rounded-xl border border-emerald-900/50 bg-emerald-950/10 p-8 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300/80">Queue complete</p>
                  <h2 className="mt-2 text-lg font-semibold">All active opportunities are in the ledger</h2>
                  <p className="mt-3 text-sm leading-6 text-stone-400">Open Final Review to apply accepted changes or inspect your deferred and rejected decisions.</p>
                  {failedEntries.length > 0 && <p className="mt-4 rounded border border-red-900/60 bg-red-950/20 p-3 text-sm text-red-200">{failedEntries.length} decision{failedEntries.length === 1 ? " still needs" : "s still need"} to be retried before Final Review is complete.</p>}
                </div>
              </div>
            ) : heldItems.length ? (
              <div className="flex h-full items-center justify-center">
                <button type="button" onClick={() => setShowHeld(true)} className={`rounded-xl border border-red-900/60 bg-red-950/10 p-8 text-left ${focusRing}`}>
                  <h2 className="text-lg font-semibold">No interactive revisions are available</h2>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-stone-400">{heldItems.length} item{heldItems.length === 1 ? " is" : "s are"} held for additional grounding. Open the Held Items Summary for details.</p>
                </button>
              </div>
            ) : <div className="flex h-full items-center justify-center text-sm text-stone-400">No revision opportunities were found.</div>}
          </section>
        </div>

        {ledger.length > 0 && (
          <footer className="shrink-0 border-t border-[#2E261A] bg-[#12100B] px-4 py-3 sm:px-5" aria-label="Revision ledger status">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300/70">Revision Ledger</p>
                <p className="mt-1 text-xs text-stone-400">{ledger.length} decision{ledger.length === 1 ? "" : "s"} · {ledger.filter((entry) => entry.syncStatus === "synced").length} synced · {ledger.filter((entry) => entry.syncStatus === "pending").length} saving · {failedEntries.length} failed</p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                {failedEntries.map((entry) => <button key={entry.localId} type="button" onClick={() => retry(entry)} className={`max-w-[280px] truncate rounded border border-red-800/70 bg-red-950/20 px-3 py-2 text-xs text-red-100 ${focusRing}`} title={`Retry saving ${entry.opportunityTitle}`}>Retry: {entry.opportunityTitle}</button>)}
                {!failedEntries.length && <div className="max-w-[320px] truncate text-xs text-stone-500">{ledger[0]?.opportunityTitle}</div>}
              </div>
            </div>
          </footer>
        )}
      </div>
    </main>
  );
}

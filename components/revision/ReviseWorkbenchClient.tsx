"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { WorkbenchOpportunity, WorkbenchQueuePayload } from "@/lib/revision/workbenchQueue";

type DecisionState = "pending" | "accepted_a" | "accepted_b" | "accepted_c" | "custom" | "keep_original" | "reject" | "deferred";
type SyncStatus = "pending" | "synced" | "failed";

type LedgerEntry = {
  localId: string;
  at: string;
  itemId: string;
  itemTitle: string;
  decision: DecisionState;
  selectedOption?: "A" | "B" | "C";
  customText?: string;
  syncStatus: SyncStatus;
};

type LocalWorkbenchCache = {
  version: 1;
  cachedAt: string;
  payload: WorkbenchQueuePayload;
  ledger: LedgerEntry[];
};

const SCOPES = ["Line", "Passage", "Scene", "Chapter", "Structural", "Manuscript"] as const;
const CACHE_PREFIX = "revisiongrade:revise-workbench:v1";

function cacheKey(payload: WorkbenchQueuePayload) {
  const manuscript = payload.manuscriptId ?? "unknown-manuscript";
  const evaluation = payload.evaluationJobId ?? "unknown-evaluation";
  return `${CACHE_PREFIX}:${manuscript}:${evaluation}`;
}

function localId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadLocalCache(key: string): LocalWorkbenchCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalWorkbenchCache;
    if (parsed?.version !== 1 || !parsed.payload) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveLocalCache(key: string, payload: WorkbenchQueuePayload, ledger: LedgerEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        cachedAt: new Date().toISOString(),
        payload,
        ledger,
      } satisfies LocalWorkbenchCache),
    );
  } catch {
    // Local cache is a resilience layer. Never block author decisions if storage is unavailable.
  }
}

function severityClasses(severity: WorkbenchOpportunity["severity"]) {
  switch (severity) {
    case "must":
      return "bg-[#7A2B1A]/30 text-[#E9B19F] border border-[#7A2B1A]/50";
    case "should":
      return "bg-[#C8A96E]/20 text-[#E9D9B7] border border-[#C8A96E]/45";
    case "could":
      return "bg-[#2D3B2A]/35 text-[#B8D6AD] border border-[#48603F]/50";
  }
}

function decisionLabel(entry: LedgerEntry) {
  switch (entry.decision) {
    case "accepted_a":
    case "accepted_b":
    case "accepted_c":
      return `Accepted ${entry.selectedOption}`;
    case "keep_original":
      return "Kept original";
    case "reject":
      return "Rejected all";
    case "custom":
      return "Custom rewrite";
    case "deferred":
      return "Deferred";
    default:
      return "Pending";
  }
}

function rebuildDecisionMap(entries: LedgerEntry[]): Record<string, DecisionState> {
  const next: Record<string, DecisionState> = {};
  [...entries].reverse().forEach((entry) => {
    next[entry.itemId] = entry.decision;
  });
  return next;
}

function EmptyWorkbench({ payload, cachedAt }: { payload: WorkbenchQueuePayload; cachedAt?: string | null }) {
  return (
    <main className="min-h-screen bg-[#0D0A05] px-4 py-6 text-[#F5EFE4] md:px-6 md:py-8">
      <div className="mx-auto max-w-4xl rounded-xl border border-[#3A3022] bg-[#1C160E]/80 p-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#C8A96E]">Revise Workspace</p>
        <h1 className="mt-3 text-4xl text-[#F8F1E6]" style={{ fontFamily: "Instrument Serif, Georgia, serif" }}>No live revision queue available yet.</h1>
        <p className="mt-4 leading-7 text-[#CBBDA4]">{payload.error ?? "This evaluation did not persist revision opportunities. Re-run evaluation or generate a Revise queue."}</p>
        {cachedAt && <p className="mt-3 text-sm text-[#A9987D]">Last local cache: {cachedAt}</p>}
        <div className="mt-6 flex flex-wrap gap-3 text-xs">
          <Link href="/dashboard" className="rounded border border-[#6D5A3B] px-3 py-1.5 text-[#E8D8BA] hover:border-[#C8A96E]">Dashboard</Link>
          <Link href="/evaluate" className="rounded border border-[#6D5A3B] px-3 py-1.5 text-[#E8D8BA] hover:border-[#C8A96E]">Evaluate</Link>
        </div>
      </div>
    </main>
  );
}

export default function ReviseWorkbenchClient({ payload }: { payload: WorkbenchQueuePayload }) {
  const [cachedPayload, setCachedPayload] = useState<WorkbenchQueuePayload | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const effectivePayload = payload.ok && payload.opportunities.length > 0 ? payload : (cachedPayload ?? payload);
  const opportunities = effectivePayload.opportunities;
  const key = cacheKey(effectivePayload);

  const [activeId, setActiveId] = useState<string>(opportunities[0]?.id ?? "");
  const [selectedOption, setSelectedOption] = useState<"A" | "B" | "C">("A");
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [decisionById, setDecisionById] = useState<Record<string, DecisionState>>({});
  const [isDraftOpen, setIsDraftOpen] = useState(false);
  const [draftText, setDraftText] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(window.navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const liveKey = cacheKey(payload);
    const cached = loadLocalCache(liveKey);
    if (cached) {
      setCachedPayload(cached.payload);
      setCachedAt(cached.cachedAt);
      setLedger(cached.ledger ?? []);
      setDecisionById(rebuildDecisionMap(cached.ledger ?? []));
      setActiveId((current) => current || cached.payload.opportunities[0]?.id || "");
    }

    if (payload.ok && payload.opportunities.length > 0) {
      saveLocalCache(liveKey, payload, cached?.ledger ?? []);
      setCachedPayload(payload);
      setCachedAt(new Date().toISOString());
      setActiveId((current) => current || payload.opportunities[0]?.id || "");
    }
  }, [payload]);

  useEffect(() => {
    if (!effectivePayload.ok || effectivePayload.opportunities.length === 0) return;
    saveLocalCache(key, effectivePayload, ledger);
    setCachedAt(new Date().toISOString());
  }, [effectivePayload, key, ledger]);

  const active = useMemo(() => opportunities.find((item) => item.id === activeId) ?? opportunities[0], [activeId, opportunities]);
  const selectedProposal = useMemo(() => active?.options.find((option) => option.key === selectedOption) ?? active?.options[0], [active, selectedOption]);
  const queueIndex = opportunities.findIndex((item) => item.id === active?.id);
  const nextId = queueIndex >= 0 && queueIndex < opportunities.length - 1 ? opportunities[queueIndex + 1].id : null;

  if (!effectivePayload.ok || opportunities.length === 0 || !active) {
    return <EmptyWorkbench payload={effectivePayload} cachedAt={cachedAt} />;
  }

  const accepted = Object.values(decisionById).filter((d) => d.startsWith("accepted")).length;
  const rejected = Object.values(decisionById).filter((d) => d === "reject").length;
  const custom = Object.values(decisionById).filter((d) => d === "custom").length;
  const deferred = Object.values(decisionById).filter((d) => d === "deferred").length;
  const pendingSync = ledger.filter((entry) => entry.syncStatus !== "synced").length;
  const pending = opportunities.length - Object.keys(decisionById).length;

  function moveToOpportunity(itemId: string) {
    setActiveId(itemId);
    setSelectedOption("A");
    setIsDraftOpen(false);
    setDraftText("");
  }

  function stampDecision(decision: DecisionState, customText?: string) {
    const normalized = decision === "accepted_a" || decision === "accepted_b" || decision === "accepted_c" ? (`accepted_${selectedOption.toLowerCase()}` as DecisionState) : decision;
    const entry: LedgerEntry = {
      localId: localId(),
      at: new Date().toLocaleTimeString(),
      itemId: active.id,
      itemTitle: active.title,
      decision: normalized,
      selectedOption: normalized.startsWith("accepted") ? selectedOption : undefined,
      customText: customText?.trim() || undefined,
      syncStatus: "pending",
    };
    const nextLedger = [entry, ...ledger];
    setLedger(nextLedger);
    setDecisionById(rebuildDecisionMap(nextLedger));
    saveLocalCache(key, effectivePayload, nextLedger);
    if (nextId) moveToOpportunity(nextId);
  }

  function undoLedgerEntry(index: number) {
    const removed = ledger[index];
    const nextLedger = ledger.filter((_, i) => i !== index);
    setLedger(nextLedger);
    setDecisionById(rebuildDecisionMap(nextLedger));
    saveLocalCache(key, effectivePayload, nextLedger);
    if (removed) moveToOpportunity(removed.itemId);
  }

  return (
    <main className="min-h-screen bg-[#0D0A05] px-4 py-6 text-[#F5EFE4] md:px-6 md:py-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 rounded-xl border border-[#3A3022] bg-[#1C160E]/80 p-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#C8A96E]">Revise Workspace · live queue</p>
          <h1 className="mt-2 text-3xl leading-tight text-[#F8F1E6] md:text-4xl" style={{ fontFamily: "Instrument Serif, Georgia, serif" }}>{effectivePayload.manuscriptTitle}</h1>
          <p className="mt-3 max-w-3xl text-sm text-[#CBBDA4]">RevisionGrade loaded this queue from the completed evaluation and baseline manuscript discovery. Start with MUST repairs before lower-level polish.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className={`rounded border px-2 py-1 ${isOnline ? "border-[#48603F] text-[#B8D6AD]" : "border-[#7A2B1A]/70 text-[#E9B19F]"}`}>{isOnline ? "Online" : "Offline"}</span>
            <span className="rounded border border-[#5D4C31] px-2 py-1 text-[#D8C6A4]">Local cache active</span>
            {pendingSync > 0 && <span className="rounded border border-[#C8A96E]/45 px-2 py-1 text-[#E9D9B7]">{pendingSync} pending sync</span>}
            {cachedAt && <span className="rounded border border-[#5D4C31] px-2 py-1 text-[#A9987D]">Cached {new Date(cachedAt).toLocaleString()}</span>}
          </div>
          <div className="mt-5 grid gap-3 rounded-lg border border-[#2D2519] bg-[#110D07] p-3 text-xs text-[#D8C6A4] md:grid-cols-2">
            <div><span className="text-[#C8A96E]">Priority:</span> {effectivePayload.totals.must} MUST · {effectivePayload.totals.should} SHOULD · {effectivePayload.totals.could} COULD</div>
            <div><span className="text-[#C8A96E]">Decisions:</span> {deferred} Deferred · {accepted} Accepted · {custom} Custom · {rejected} Rejected · {pending} Pending</div>
          </div>
          <div className="mt-3 rounded-lg border border-[#2D2519] bg-[#110D07] p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#C8A96E]">Total revisions by category</p>
            <div className="mt-2 grid gap-2 text-xs text-[#D8C6A4] md:grid-cols-2">
              <div>{effectivePayload.totals.must} MUST · {effectivePayload.totals.should} SHOULD · {effectivePayload.totals.could} COULD</div>
              <div>{SCOPES.map((scope) => `${effectivePayload.scopes[scope]} ${scope}`).join(" · ")}</div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-[#3A3022] bg-[#161109] p-4">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-sm uppercase tracking-[0.18em] text-[#D7C4A1]">First Batch</h2><span className="rounded-full border border-[#5D4C31] px-2 py-0.5 text-[11px] text-[#C8A96E]">{opportunities.length} queued</span></div>
            <ol className="space-y-3">
              {opportunities.map((item) => {
                const decision = decisionById[item.id];
                return <li key={item.id}><button type="button" onClick={() => moveToOpportunity(item.id)} className={`w-full rounded-lg border p-3 text-left transition ${active.id === item.id ? "border-[#C8A96E] bg-[#221B11]" : "border-[#2B241A] bg-[#110D07] hover:border-[#5D4C31]"}`}><div className="mb-2 flex flex-wrap gap-1.5"><span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${severityClasses(item.severity)}`}>{item.severity}</span><span className="rounded border border-[#4E4333] bg-[#1B150E] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#D6C3A2]">{item.scope}</span><span className="rounded border border-[#4E4333] bg-[#1B150E] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#D6C3A2]">{item.mode === "repair-brief" ? "Brief" : "Rewrite"}</span>{decision === "deferred" && <span className="rounded border border-[#5C5140] bg-[#2E2A22] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#B7A98D]">Deferred by author</span>}</div><p className="text-sm text-[#F2E7D4]">{item.title}</p><p className="mt-1 text-xs text-[#AA9A7F]">{item.meta}</p></button></li>;
              })}
            </ol>
          </aside>

          <article className="rounded-xl border border-[#3A3022] bg-[#1C160E] p-5">
            <p className="text-xs text-[#A89574]">{active.crumb}</p>
            <h2 className="mt-2 text-3xl text-[#F7EFDF]" style={{ fontFamily: "Instrument Serif, Georgia, serif" }}>{active.title}</h2>
            <div className="mt-3 flex flex-wrap gap-2"><span className={`rounded px-2 py-1 text-[11px] uppercase tracking-wider ${severityClasses(active.severity)}`}>{active.severity}</span><span className="rounded border border-[#5A4B33] bg-[#231C12] px-2 py-1 text-[11px] uppercase tracking-wider text-[#D7C6A8]">{active.scope}</span><span className="rounded border border-[#5A4B33] bg-[#231C12] px-2 py-1 text-[11px] uppercase tracking-wider text-[#D7C6A8]">{active.mode === "repair-brief" ? "Repair Brief" : "Direct Rewrite"}</span><span className="rounded border border-[#5A4B33] bg-[#231C12] px-2 py-1 text-[11px] uppercase tracking-wider text-[#D7C6A8]">{active.confidence}</span></div>
            {active.mode === "repair-brief" && <div className="mt-4 rounded-lg border border-[#C8A96E]/45 bg-[#120E08] p-3 text-sm text-[#E8DCC4]"><strong className="text-[#C8A96E]">Repair Brief:</strong> this is larger-scope work. A/B/C are repair plans, not sentence swaps.</div>}
            <section className="mt-5 rounded-lg border border-[#2E261A] bg-[#12100B] p-4"><h3 className="text-xs uppercase tracking-[0.16em] text-[#C8A96E]">Evidence</h3><blockquote className="mt-2 border-l border-[#C8A96E]/60 pl-3 text-sm leading-relaxed text-[#E9DCC4]"><span className="text-[#F8F1E2]">“{active.quoteHighlight}”</span>{active.quoteRest}</blockquote><p className="mt-2 text-xs text-[#9D8D72]">{active.anchor}</p></section>
            <section className="mt-4 grid gap-3 md:grid-cols-2">{[["Symptom", active.symptom], ["Cause", active.cause], ["Fix direction", active.fixDirection], ["Reader effect", active.readerEffect]].map(([label, text]) => <div key={label} className="rounded-lg border border-[#2E261A] bg-[#12100B] p-3"><p className="text-xs uppercase tracking-[0.14em] text-[#C8A96E]">{label}</p><p className="mt-1 text-sm leading-6 text-[#E8DCC4]">{text}</p></div>)}</section>
            <section className="mt-4 rounded-lg border border-[#2E261A] bg-[#12100B] p-3"><p className="text-xs uppercase tracking-[0.14em] text-[#C8A96E]">Mistake-proofing</p><p className="mt-1 text-sm text-[#E8DCC4]">{active.mistakeProofing}</p></section>
            <section className="mt-5 space-y-3">{active.options.map((option) => { const isSelected = selectedOption === option.key; return <button key={option.key} type="button" onClick={() => { setSelectedOption(option.key); if (isDraftOpen) setDraftText(option.text); }} className={`w-full rounded-lg border p-4 text-left transition ${isSelected ? "border-[#C8A96E] bg-[#221B11]" : "border-[#2E261A] bg-[#12100B] hover:border-[#5D4C31]"}`}><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-[#F2E8D6]">{option.key} · {option.mechanism}</p><span className="text-xs text-[#B29F7D]">{active.mode === "repair-brief" ? "Plan" : "Proposal"}</span></div><pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#E5D8BE]">{option.text}</pre><p className="mt-2 text-xs text-[#BDAE91]">{option.rationale}</p></button>; })}</section>
            <section className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => stampDecision(`accepted_${selectedOption.toLowerCase()}` as DecisionState)} className="rounded border border-[#C8A96E] bg-[#C8A96E] px-4 py-2 text-sm font-medium text-[#1A140C] hover:bg-[#D5B67E]">Accept selected ({selectedOption})</button><button type="button" onClick={() => stampDecision("keep_original")} className="rounded border border-[#5D4C31] px-4 py-2 text-sm text-[#E8DABF] hover:border-[#C8A96E]">Keep original</button><button type="button" onClick={() => stampDecision("reject")} className="rounded border border-[#7A2B1A]/70 px-4 py-2 text-sm text-[#E2B2A6] hover:bg-[#7A2B1A]/20">Reject all three</button><button type="button" onClick={() => stampDecision("deferred")} className="rounded border border-[#5C5140] px-4 py-2 text-sm text-[#B7A98D] hover:border-[#C8A96E]">Defer</button><button type="button" onClick={() => { setDraftText((current) => current || selectedProposal?.text || ""); setIsDraftOpen(true); }} className="rounded border border-[#C8A96E] bg-[#C8A96E]/10 px-4 py-2 text-sm text-[#F3E3C3] hover:bg-[#C8A96E]/20">Write custom</button></section>
            {isDraftOpen && <section className="mt-4 rounded-lg border border-[#C8A96E]/60 bg-[#120E08] p-4"><p className="text-xs uppercase tracking-[0.16em] text-[#C8A96E]">Author custom revision</p><textarea value={draftText} onChange={(event) => setDraftText(event.target.value)} rows={6} className="mt-3 w-full rounded border border-[#3A3022] bg-[#0D0A05] p-3 font-mono text-sm leading-6 text-[#F7EFDF] outline-none focus:border-[#C8A96E]" placeholder="Write your custom repair here..." /><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!draftText.trim()} onClick={() => stampDecision("custom", draftText)} className="rounded border border-[#C8A96E] bg-[#C8A96E] px-3 py-2 text-sm font-medium text-[#1A140C] disabled:opacity-50">Save custom revision</button><button type="button" onClick={() => setIsDraftOpen(false)} className="rounded border border-[#5D4C31] px-3 py-2 text-sm text-[#E8DABF] hover:border-[#C8A96E]">Close</button></div></section>}
          </article>
        </section>

        <section className="mt-4 rounded-xl border border-[#3A3022] bg-[#161109] p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><h2 className="text-sm uppercase tracking-[0.18em] text-[#D7C4A1]">Revision Ledger</h2><p className="mt-1 text-xs text-[#A9987D]">A running list of author decisions. Queue and ledger are cached locally for offline review. Pending decisions sync when the server endpoint lands.</p></div>{ledger.length > 0 && <button type="button" onClick={() => undoLedgerEntry(0)} className="self-start rounded border border-[#5D4C31] px-3 py-1.5 text-xs text-[#E8D8BA] hover:border-[#C8A96E] md:self-auto">Undo last decision</button>}</div>
          <ol className="mt-4 grid gap-2 xl:grid-cols-2">{ledger.length === 0 ? <li className="rounded-lg border border-[#2D2519] bg-[#120E08] p-3 text-sm text-[#B3A185]"><strong>No revision decisions yet.</strong><br />Accept proposals, keep originals, write custom repairs, reject, or defer work to begin the ledger.</li> : ledger.map((entry, i) => <li key={entry.localId} className="rounded-lg border border-[#2D2519] bg-[#120E08] p-3 text-sm"><div className="flex items-start justify-between gap-3"><p className="text-[#E9DCC4]"><span className="mr-1 text-[11px] uppercase tracking-wider text-[#C8A96E]">{decisionLabel(entry)}</span> — {entry.itemTitle}</p><button type="button" onClick={() => undoLedgerEntry(i)} className="shrink-0 rounded border border-[#5D4C31] px-2 py-1 text-[11px] text-[#D8C6A4] hover:border-[#C8A96E]">Undo</button></div>{entry.customText && <pre className="mt-2 whitespace-pre-wrap rounded border border-[#2D2519] bg-[#0D0A05] p-2 text-xs leading-5 text-[#E8DCC4]">{entry.customText}</pre>}<p className="mt-1 text-xs text-[#9F8F75]">{entry.at} · {entry.syncStatus === "synced" ? "Synced" : "Pending sync"}</p></li>)}</ol>
        </section>
      </div>
    </main>
  );
}

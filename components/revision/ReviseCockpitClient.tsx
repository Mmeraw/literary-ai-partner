"use client";

import { useMemo, useState } from "react";
import type { WorkbenchOpportunity, WorkbenchQueuePayload, WorkbenchSeverity } from "@/lib/revision/workbenchQueue";

type Decision = "accepted_a" | "accepted_b" | "accepted_c" | "custom" | "keep_original" | "reject" | "deferred";
type OptionKey = "A" | "B" | "C";

type SavedDecision = {
  id: string;
  itemId: string;
  title: string;
  decision: Decision;
  option?: OptionKey;
  customText?: string;
  at: string;
  sync: "pending" | "synced" | "failed";
};

function id() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function severityClass(severity: WorkbenchSeverity) {
  if (severity === "must") return "border-[#7A2B1A]/60 bg-[#7A2B1A]/25 text-[#E9B19F]";
  if (severity === "should") return "border-[#C8A96E]/45 bg-[#C8A96E]/15 text-[#E9D9B7]";
  return "border-[#48603F]/50 bg-[#2D3B2A]/35 text-[#B8D6AD]";
}

function optionRole(key: OptionKey) {
  if (key === "A") return "Recommended Repair";
  if (key === "B") return "Rhythm Variant";
  return "Bolder Rendering Shift";
}

function decisionGroup(decision?: Decision) {
  if (!decision) return "pending";
  if (decision.startsWith("accepted")) return "accepted";
  return decision;
}

function decisionLabel(decision?: Decision) {
  if (!decision) return "Pending";
  if (decision === "accepted_a") return "Accepted A";
  if (decision === "accepted_b") return "Accepted B";
  if (decision === "accepted_c") return "Accepted C";
  if (decision === "keep_original") return "Kept original";
  if (decision === "custom") return "Custom";
  if (decision === "deferred") return "Deferred";
  return "Rejected";
}

function preview(text: string, max = 260) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean;
}

export default function ReviseCockpitClient({ payload }: { payload: WorkbenchQueuePayload }) {
  const [activeId, setActiveId] = useState(payload.opportunities[0]?.id ?? "");
  const [priority, setPriority] = useState<"all" | WorkbenchSeverity>("all");
  const [criterion, setCriterion] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"evidence" | "diagnosis" | "logic">("evidence");
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledger, setLedger] = useState<SavedDecision[]>([]);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const decisionById = useMemo(() => {
    const map: Record<string, Decision> = {};
    for (const entry of ledger) if (!map[entry.itemId]) map[entry.itemId] = entry.decision;
    return map;
  }, [ledger]);

  const criteria = useMemo(() => [...new Set(payload.opportunities.map((item) => item.criterion))].sort(), [payload.opportunities]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payload.opportunities.filter((item) => {
      if (priority !== "all" && item.severity !== priority) return false;
      if (criterion !== "all" && item.criterion !== criterion) return false;
      if (status !== "all" && decisionGroup(decisionById[item.id]) !== status) return false;
      if (q && !`${item.title} ${item.symptom} ${item.meta} ${item.anchor}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [criterion, decisionById, payload.opportunities, priority, search, status]);

  const active = filtered.find((item) => item.id === activeId) ?? filtered[0] ?? null;

  const counts = useMemo(() => {
    let accepted = 0, custom = 0, deferred = 0, rejected = 0, kept = 0;
    for (const item of payload.opportunities) {
      const d = decisionById[item.id];
      if (!d) continue;
      if (d.startsWith("accepted")) accepted += 1;
      else if (d === "custom") custom += 1;
      else if (d === "deferred") deferred += 1;
      else if (d === "reject") rejected += 1;
      else if (d === "keep_original") kept += 1;
    }
    return { pending: payload.opportunities.length - accepted - custom - deferred - rejected - kept, accepted, custom, deferred, rejected, kept };
  }, [decisionById, payload.opportunities]);

  async function sync(entry: SavedDecision, item: WorkbenchOpportunity, selectedText?: string) {
    if (!payload.manuscriptId || !payload.evaluationJobId) return;
    try {
      const res = await fetch("/api/revision-ledger", {
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
            customText: entry.customText ?? null,
            selectedText: selectedText ?? entry.customText ?? null,
            clientCreatedAt: entry.at,
            isUndo: false,
            undoneLocalId: null,
            metadata: { source: "revise-cockpit", criterion: item.criterion, severity: item.severity, scope: item.scope, anchor: item.anchor },
          }],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "sync failed");
      setLedger((rows) => rows.map((row) => row.id === entry.id ? { ...row, sync: "synced" } : row));
      setSyncMessage("Synced");
    } catch (err) {
      setLedger((rows) => rows.map((row) => row.id === entry.id ? { ...row, sync: "failed" } : row));
      setSyncMessage(err instanceof Error ? err.message : "Sync failed");
    }
  }

  function advance(from: WorkbenchOpportunity) {
    const index = filtered.findIndex((item) => item.id === from.id);
    const next = filtered.slice(index + 1).find((item) => !decisionById[item.id]) ?? filtered.find((item) => item.id !== from.id && !decisionById[item.id]) ?? filtered[index + 1] ?? filtered[index - 1];
    if (next) setActiveId(next.id);
    setTab("evidence");
    setCustomOpen(false);
    setCustomText("");
  }

  function decide(decision: Decision, option?: OptionKey, custom?: string) {
    if (!active) return;
    const selected = option ? active.options.find((candidate) => candidate.key === option)?.text : undefined;
    const entry: SavedDecision = { id: id(), itemId: active.id, title: active.title, decision, option, customText: custom?.trim() || undefined, at: new Date().toISOString(), sync: "pending" };
    setLedger((rows) => [entry, ...rows]);
    void sync(entry, active, selected);
    advance(active);
  }

  if (!payload.ok || payload.opportunities.length === 0) {
    return <main className="flex h-screen items-center justify-center overflow-hidden bg-[#0D0A05] p-6 text-[#F5EFE4]"><section className="max-w-2xl rounded-xl border border-[#3A3022] bg-[#1C160E] p-8"><p className="text-xs uppercase tracking-[0.2em] text-[#C8A96E]">Revise Cockpit</p><h1 className="mt-3 text-3xl">No revision queue available.</h1><p className="mt-3 text-[#CBBDA4]">{payload.error ?? "This evaluation has no revision opportunities yet."}</p></section></main>;
  }

  return (
    <main className="h-screen overflow-hidden bg-[#0D0A05] text-[#F5EFE4]">
      <header className="flex h-14 items-center justify-between gap-3 border-b border-[#2E261A] bg-[#161109] px-4">
        <div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.2em] text-[#C8A96E]">Revision Cockpit</p><h1 className="truncate text-lg">{payload.manuscriptTitle}</h1></div>
        <div className="flex shrink-0 gap-2 text-xs"><span className="rounded border border-[#7A2B1A]/50 px-2 py-1">MUST {payload.totals.must}</span><span className="rounded border border-[#C8A96E]/45 px-2 py-1">SHOULD {payload.totals.should}</span><span className="rounded border border-[#48603F]/50 px-2 py-1">COULD {payload.totals.could}</span><span className="rounded border border-[#5D4C31] px-2 py-1">Pending {counts.pending}</span>{syncMessage && <span className="hidden rounded border border-[#5D4C31] px-2 py-1 lg:inline">{syncMessage}</span>}</div>
      </header>
      <section className="grid h-[calc(100vh-56px)] grid-cols-[320px_minmax(0,1fr)] overflow-hidden">
        <aside className="flex min-h-0 flex-col border-r border-[#2E261A] bg-[#110D07]">
          <div className="space-y-2 border-b border-[#2E261A] p-3"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="w-full rounded border border-[#3A3022] bg-[#0D0A05] px-2 py-1.5 text-xs" /><div className="grid grid-cols-2 gap-2"><select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="rounded border border-[#3A3022] bg-[#0D0A05] px-2 py-1.5 text-xs"><option value="all">All priority</option><option value="must">MUST</option><option value="should">SHOULD</option><option value="could">COULD</option></select><select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-[#3A3022] bg-[#0D0A05] px-2 py-1.5 text-xs"><option value="all">All status</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="custom">Custom</option><option value="keep_original">Kept</option><option value="reject">Rejected</option><option value="deferred">Deferred</option></select></div><select value={criterion} onChange={(e) => setCriterion(e.target.value)} className="w-full rounded border border-[#3A3022] bg-[#0D0A05] px-2 py-1.5 text-xs"><option value="all">All criteria</option>{criteria.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
          <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">{filtered.map((item, index) => <li key={item.id}><button onClick={() => setActiveId(item.id)} className={`w-full rounded-lg border p-2 text-left ${item.id === active?.id ? "border-[#C8A96E] bg-[#221B11]" : "border-[#2B241A] bg-[#161109] hover:border-[#5D4C31]"}`}><div className="mb-1 flex gap-1"><span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${severityClass(item.severity)}`}>{item.severity}</span><span className="rounded border border-[#4E4333] px-1.5 py-0.5 text-[10px]">{item.scope}</span><span className="rounded border border-[#4E4333] px-1.5 py-0.5 text-[10px]">{decisionLabel(decisionById[item.id])}</span></div><p className="line-clamp-2 text-xs">{index + 1}. {item.title}</p><p className="mt-1 truncate text-[11px] text-[#A9987D]">{item.criterion} · {item.anchor}</p></button></li>)}</ol>
        </aside>
        <section className="flex min-h-0 flex-col overflow-hidden bg-[#1C160E]">
          {active ? <><div className="shrink-0 border-b border-[#2E261A] p-3"><div className="flex flex-wrap gap-2 text-[11px] uppercase"><span className={`rounded px-2 py-1 ${severityClass(active.severity)}`}>{active.severity}</span><span className="rounded border border-[#5A4B33] px-2 py-1">{active.criterion}</span><span className="rounded border border-[#5A4B33] px-2 py-1">{active.scope}</span><span className="rounded border border-[#5A4B33] px-2 py-1">{active.confidence}</span></div><h2 className="mt-2 line-clamp-2 text-2xl leading-tight">{active.title}</h2></div><div className="min-h-0 flex-1 overflow-y-auto p-3"><div className="grid gap-2 xl:grid-cols-3">{active.options.map((option) => <article key={option.key} className="rounded-xl border border-[#2E261A] bg-[#12100B] p-3"><div className="flex justify-between gap-2"><div><p className="text-sm font-semibold">{option.key} — {optionRole(option.key)}</p><p className="mt-1 text-[11px] uppercase text-[#A9987D]">{option.mechanism}</p></div><button onClick={() => decide(`accepted_${option.key.toLowerCase()}` as Decision, option.key)} className="rounded bg-[#C8A96E] px-2 py-1 text-xs font-semibold text-[#1A140C]">Accept {option.key}</button></div><p className="mt-2 line-clamp-5 whitespace-pre-wrap text-sm leading-5 text-[#E5D8BE]">{preview(option.text)}</p><details className="mt-2 text-xs text-[#BDAE91]"><summary className="cursor-pointer text-[#C8A96E]">Show full fix</summary><p className="mt-2 whitespace-pre-wrap">{option.text}</p><p className="mt-2">{option.rationale}</p></details></article>)}</div><div className="mt-3 rounded-xl border border-[#2E261A] bg-[#12100B]"><div className="flex border-b border-[#2E261A] text-xs">{(["evidence", "diagnosis", "logic"] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`px-3 py-2 capitalize ${tab === item ? "bg-[#221B11] text-[#C8A96E]" : "text-[#A9987D]"}`}>{item}</button>)}</div><div className="max-h-36 overflow-y-auto p-3 text-sm leading-6">{tab === "evidence" && <><p>“{active.quoteHighlight}”{active.quoteRest}</p><p className="mt-1 text-xs text-[#A9987D]">{active.anchor}</p></>}{tab === "diagnosis" && <><p><span className="text-[#C8A96E]">Symptom:</span> {active.symptom}</p><p><span className="text-[#C8A96E]">Cause:</span> {active.cause}</p></>}{tab === "logic" && <><p><span className="text-[#C8A96E]">Fix:</span> {active.fixDirection}</p><p><span className="text-[#C8A96E]">Reader effect:</span> {active.readerEffect}</p><p><span className="text-[#C8A96E]">Mistake-proofing:</span> {active.mistakeProofing}</p></>}</div></div>{customOpen && <div className="mt-3 rounded-xl border border-[#C8A96E]/60 bg-[#120E08] p-3"><textarea value={customText} onChange={(e) => setCustomText(e.target.value)} rows={5} className="w-full rounded border border-[#3A3022] bg-[#0D0A05] p-3 font-mono text-sm" /><button disabled={!customText.trim()} onClick={() => decide("custom", undefined, customText)} className="mt-2 rounded bg-[#C8A96E] px-3 py-1.5 text-sm font-semibold text-[#1A140C] disabled:opacity-50">Save custom + next</button></div>}</div><footer className="shrink-0 border-t border-[#2E261A] bg-[#120E08] p-3"><div className="flex flex-wrap gap-2"><button onClick={() => decide("accepted_a", "A")} className="rounded bg-[#C8A96E] px-4 py-2 text-sm font-semibold text-[#1A140C]">Accept A</button><button onClick={() => decide("accepted_b", "B")} className="rounded border border-[#C8A96E] px-4 py-2 text-sm">Accept B</button><button onClick={() => decide("accepted_c", "C")} className="rounded border border-[#C8A96E] px-4 py-2 text-sm">Accept C</button><button onClick={() => decide("keep_original")} className="rounded border border-[#5D4C31] px-3 py-2 text-sm">Keep Original</button><button onClick={() => decide("reject")} className="rounded border border-[#7A2B1A]/70 px-3 py-2 text-sm">Reject</button><button onClick={() => decide("deferred")} className="rounded border border-[#5C5140] px-3 py-2 text-sm">Defer</button><button onClick={() => { setCustomText(active.options[0]?.text ?? ""); setCustomOpen(true); }} className="rounded border border-[#C8A96E] px-3 py-2 text-sm">Custom</button><button onClick={() => setLedgerOpen(!ledgerOpen)} className="ml-auto rounded border border-[#5D4C31] px-3 py-2 text-sm">Ledger ({ledger.length})</button></div>{ledgerOpen && <div className="mt-2 max-h-28 overflow-y-auto rounded border border-[#2E261A] bg-[#0D0A05] p-2 text-xs">{ledger.slice(0, 10).map((entry) => <p key={entry.id} className="truncate">{decisionLabel(entry.decision)} · {entry.title} · {entry.sync}</p>)}</div>}</footer></> : <div className="m-4 rounded-xl border border-[#3A3022] bg-[#12100B] p-6">No matching opportunity. Adjust filters.</div>}
        </section>
      </section>
    </main>
  );
}

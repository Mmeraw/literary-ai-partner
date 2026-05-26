"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Severity = "must" | "should" | "could";
type Scope = "Line" | "Passage" | "Scene" | "Chapter" | "Structural" | "Manuscript";
type Mode = "direct-rewrite" | "repair-brief";
type DecisionState = "pending" | "accepted_a" | "accepted_b" | "accepted_c" | "custom" | "keep_original" | "reject" | "deferred";

type Option = { key: "A" | "B" | "C"; mechanism: string; text: string; rationale: string };

type Opportunity = {
  id: number;
  severity: Severity;
  scope: Scope;
  mode: Mode;
  leverage: string;
  crumb: string;
  title: string;
  meta: string;
  confidence: string;
  anchor: string;
  quoteHighlight: string;
  quoteRest: string;
  symptom: string;
  cause: string;
  fixDirection: string;
  readerEffect: string;
  mistakeProofing: string;
  options: Option[];
};

type LedgerEntry = {
  at: string;
  itemId: number;
  itemTitle: string;
  decision: DecisionState;
  selectedOption?: "A" | "B" | "C";
  customText?: string;
};

const SEVERITY_ORDER: Record<Severity, number> = { must: 0, should: 1, could: 2 };
const SCOPES: Scope[] = ["Line", "Passage", "Scene", "Chapter", "Structural", "Manuscript"];

const OPPORTUNITIES: Opportunity[] = [
  {
    id: 1,
    severity: "must",
    scope: "Scene",
    mode: "direct-rewrite",
    leverage: "Spine",
    crumb: "Dialogue · Chapter 11 · river scene",
    title: "Abstract phrasing weakens river-scene tension",
    meta: "Dialogue · Ch. 11 · evidence anchored",
    confidence: "Moderate confidence",
    anchor: "char 1247–1330 · Chapter 11 · river scene",
    quoteHighlight: "It’s okay,",
    quoteRest: " I whispered. But even as I said it, I knew it wasn’t okay.",
    symptom: "Emotional contradiction is stated directly instead of dramatized.",
    cause: "Internal realization duplicates what the dialogue already implies, flattening the moment into commentary.",
    fixDirection: "Replace internal explanation with a physical hesitation or interruption beat.",
    readerEffect: "Tension escalates instead of pausing for narrator gloss.",
    mistakeProofing: "Preserve voice and rhythm. Do not introduce new information.",
    options: [
      { key: "A", mechanism: "Action-beat substitution", text: "“It’s okay,” I whispered.\nThe lie caught halfway out.", rationale: "Replaces internal gloss with a physical reaction; voice fingerprint preserved." },
      { key: "B", mechanism: "Interruption beat", text: "“It’s okay—”\nMy voice cracked before I could finish.", rationale: "Cuts reassurance mid-line so failure is heard, not narrated." },
      { key: "C", mechanism: "Rendering shift", text: "“It’s okay.”\nShe looked at me long enough to know I didn’t believe it.", rationale: "Lets the listener carry contradiction; closes with weight." },
    ],
  },
  {
    id: 2,
    severity: "must",
    scope: "Passage",
    mode: "direct-rewrite",
    leverage: "High",
    crumb: "Pacing · Chapter 11 · scene close",
    title: "Internal monologue duplicates dialogue subtext",
    meta: "Pacing · Ch. 11",
    confidence: "High confidence",
    anchor: "char 1331–1462 · Chapter 11 · scene close",
    quoteHighlight: "I knew it wasn’t okay.",
    quoteRest: " That was the whole problem, really — knowing things and saying nothing.",
    symptom: "Narrator restates emotional verdict the prior dialogue already delivered.",
    cause: "Pass-through interiority used as a crutch where action would advance the scene.",
    fixDirection: "Cut recap line; let the next beat carry consequence.",
    readerEffect: "Scene momentum returns; reader is trusted to hold contradiction.",
    mistakeProofing: "Retain sensory anchors in the next paragraph.",
    options: [
      { key: "A", mechanism: "Excision", text: "[remove sentence]\n— scene continues with next paragraph —", rationale: "Cleanest cut; preserves rhythm by removing restatement." },
      { key: "B", mechanism: "Compression", text: "I knew. That was the problem.", rationale: "Keeps cadence while trimming recap." },
      { key: "C", mechanism: "Substitution", text: "I looked at the river. The river didn’t care.", rationale: "Replaces interiority with sensory beat." },
    ],
  },
  {
    id: 3,
    severity: "must",
    scope: "Structural",
    mode: "repair-brief",
    leverage: "Golden Spine",
    crumb: "Golden Spine · cross-chapter",
    title: "Promise opened in Ch. 4 still unresolved at midpoint",
    meta: "Golden Spine · cross-chapter",
    confidence: "Moderate confidence",
    anchor: "Ch. 4 setup → Ch. 12 expected payoff",
    quoteHighlight: "He promised himself he would tell her.",
    quoteRest: " By the midpoint, the promise has not been pressured, avoided, or meaningfully escalated.",
    symptom: "Primary character promise is opened in Act I but not acknowledged by midpoint.",
    cause: "Narrative spine carries this thread silently instead of tightening pressure.",
    fixDirection: "Create a repair plan that reactivates the promise without resolving it too early.",
    readerEffect: "Pressure continuity is restored across the second-act plateau.",
    mistakeProofing: "Do not resolve the promise before its intended payoff. Repair causality, not just wording.",
    options: [
      { key: "A", mechanism: "Recommended structural repair plan", text: "Add one avoidance beat in Ch. 12 and one consequence reminder before the midpoint turn.", rationale: "Keeps existing structure while reconnecting setup to midpoint pressure." },
      { key: "B", mechanism: "Conservative bridge-beat plan", text: "Preserve chapter order; add two light reminders that the promise remains active.", rationale: "Lowest disruption path; improves continuity without rewriting the act." },
      { key: "C", mechanism: "Bolder pressure shift", text: "Move one later consequence earlier so the promise becomes visible before the midpoint stalls.", rationale: "Higher leverage structural option for manuscripts with a soft middle." },
    ],
  },
  {
    id: 4,
    severity: "should",
    scope: "Chapter",
    mode: "repair-brief",
    leverage: "Medium",
    crumb: "Pacing valley · Ch. 12–14",
    title: "Pressure plateaus across chapters 12–14",
    meta: "Pacing valley · 3 chapters",
    confidence: "Moderate confidence",
    anchor: "Ch. 12 §3 → Ch. 14 §1 · scene density 0.42",
    quoteHighlight: "Three chapters of conversation",
    quoteRest: " separate inciting confrontation from next consequence.",
    symptom: "Narrative pressure flattens across the second-act seam.",
    cause: "Scene density drops below 0.5 with no compensating escalation.",
    fixDirection: "Choose a chapter-level repair path: compress, escalate, or re-sequence existing pressure.",
    readerEffect: "Engagement curve recovers ahead of the next major turn.",
    mistakeProofing: "Preserve quiet character work; do not solve pacing by deleting voice.",
    options: [
      { key: "A", mechanism: "Compression plan", text: "Merge Ch. 12 §4 into Ch. 13 §1 and cut the soft transition.", rationale: "Removes low-pressure seam without losing content." },
      { key: "B", mechanism: "Escalation plan", text: "Add one consequence-bearing scene in Ch. 13.", rationale: "Re-establishes stakes with minimal disruption." },
      { key: "C", mechanism: "Subplot weave", text: "Move the Ch. 16 subplot reveal earlier to rebalance the spine.", rationale: "Uses existing material to repair the pressure valley." },
    ],
  },
  {
    id: 5,
    severity: "could",
    scope: "Line",
    mode: "direct-rewrite",
    leverage: "Local",
    crumb: "Voice · Ch. 11, p. 132",
    title: "Filtered perception softens close-third POV",
    meta: "Voice · Ch. 11, p. 132",
    confidence: "High confidence",
    anchor: "char 4089–4131 · Ch. 11, p. 132",
    quoteHighlight: "She could see the boat",
    quoteRest: " moving downstream against the dimming light.",
    symptom: "Filter verb inserts narrative distance in close-third POV.",
    cause: "Habitual perception phrasing is not used as deliberate style elsewhere.",
    fixDirection: "Drop filter and render perception directly.",
    readerEffect: "POV closeness restores and image lands harder.",
    mistakeProofing: "Preserve observational rhythm; remove only filter verb.",
    options: [
      { key: "A", mechanism: "Filter removal", text: "The boat moved downstream against the dimming light.", rationale: "Direct rendering aligned to close-third voice." },
      { key: "B", mechanism: "Active substitution", text: "She watched the boat move downstream against the dimming light.", rationale: "Keeps seeing as action, not capability." },
      { key: "C", mechanism: "Compression", text: "Downstream, the boat moved against the dimming light.", rationale: "Foregrounds image itself." },
    ],
  },
  {
    id: 6,
    severity: "could",
    scope: "Line",
    mode: "direct-rewrite",
    leverage: "Local",
    crumb: "Prose control · Ch. 11",
    title: "Adverb stack thins key reassurance line",
    meta: "Prose control · Ch. 11",
    confidence: "High confidence",
    anchor: "char 1198–1246 · Ch. 11",
    quoteHighlight: "she said softly, gently, almost apologetically",
    quoteRest: ", reaching for his hand.",
    symptom: "Three adverbs stack on one attribution, diluting tonal precision.",
    cause: "Uncertainty about whether dialogue alone carries emotional weight.",
    fixDirection: "Choose one adverb or replace with physical beat.",
    readerEffect: "Tone sharpens with one clear signal.",
    mistakeProofing: "Keep gesture; it carries tonal load.",
    options: [
      { key: "A", mechanism: "Single-adverb selection", text: "she said gently, reaching for his hand.", rationale: "Smallest possible change." },
      { key: "B", mechanism: "Adverb removal", text: "she said, reaching for his hand.", rationale: "Lets gesture do tonal work." },
      { key: "C", mechanism: "Beat substitution", text: "She reached for his hand. “It’s okay.”", rationale: "Reorders to reduce attribution overhead." },
    ],
  },
];

const SORTED_OPPORTUNITIES = [...OPPORTUNITIES].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.id - b.id);

function severityClasses(severity: Severity) {
  switch (severity) {
    case "must":
      return "bg-[#7A2B1A]/30 text-[#E9B19F] border border-[#7A2B1A]/50";
    case "should":
      return "bg-[#C8A96E]/20 text-[#E9D9B7] border border-[#C8A96E]/45";
    case "could":
      return "bg-[#2D3B2A]/35 text-[#B8D6AD] border border-[#48603F]/50";
  }
}

function countBySeverity(severity: Severity) {
  return OPPORTUNITIES.filter((item) => item.severity === severity).length;
}

function countByScope(scope: Scope) {
  return OPPORTUNITIES.filter((item) => item.scope === scope).length;
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

function rebuildDecisionMap(entries: LedgerEntry[]): Record<number, DecisionState> {
  const next: Record<number, DecisionState> = {};
  [...entries].reverse().forEach((entry) => {
    next[entry.itemId] = entry.decision;
  });
  return next;
}

export default function WorkbenchPage() {
  const [activeId, setActiveId] = useState<number>(SORTED_OPPORTUNITIES[0].id);
  const [selectedOption, setSelectedOption] = useState<"A" | "B" | "C">("A");
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [decisionById, setDecisionById] = useState<Record<number, DecisionState>>({});
  const [isDraftOpen, setIsDraftOpen] = useState(false);
  const [draftText, setDraftText] = useState("");

  const active = useMemo(() => SORTED_OPPORTUNITIES.find((item) => item.id === activeId) ?? SORTED_OPPORTUNITIES[0], [activeId]);
  const selectedProposal = useMemo(() => active.options.find((option) => option.key === selectedOption) ?? active.options[0], [active, selectedOption]);
  const queueIndex = SORTED_OPPORTUNITIES.findIndex((item) => item.id === active.id);
  const nextId = queueIndex >= 0 && queueIndex < SORTED_OPPORTUNITIES.length - 1 ? SORTED_OPPORTUNITIES[queueIndex + 1].id : null;

  const accepted = Object.values(decisionById).filter((d) => d.startsWith("accepted")).length;
  const rejected = Object.values(decisionById).filter((d) => d === "reject").length;
  const custom = Object.values(decisionById).filter((d) => d === "custom").length;
  const deferred = Object.values(decisionById).filter((d) => d === "deferred").length;
  const pending = OPPORTUNITIES.length - Object.keys(decisionById).length;

  function moveToOpportunity(itemId: number) {
    setActiveId(itemId);
    setSelectedOption("A");
    setIsDraftOpen(false);
    setDraftText("");
  }

  function stampDecision(decision: DecisionState, customText?: string) {
    const normalized = decision === "accepted_a" || decision === "accepted_b" || decision === "accepted_c" ? (`accepted_${selectedOption.toLowerCase()}` as DecisionState) : decision;
    const entry: LedgerEntry = { at: new Date().toLocaleTimeString(), itemId: active.id, itemTitle: active.title, decision: normalized, selectedOption: normalized.startsWith("accepted") ? selectedOption : undefined, customText: customText?.trim() || undefined };
    const nextLedger = [entry, ...ledger];
    setLedger(nextLedger);
    setDecisionById(rebuildDecisionMap(nextLedger));
    if (nextId) moveToOpportunity(nextId);
  }

  function undoLedgerEntry(index: number) {
    const removed = ledger[index];
    const nextLedger = ledger.filter((_, i) => i !== index);
    setLedger(nextLedger);
    setDecisionById(rebuildDecisionMap(nextLedger));
    if (removed) moveToOpportunity(removed.itemId);
  }

  return (
    <main className="min-h-screen bg-[#0D0A05] px-4 py-6 text-[#F5EFE4] md:px-6 md:py-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 rounded-xl border border-[#3A3022] bg-[#1C160E]/80 p-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#C8A96E]">Revise Workspace</p>
          <h1 className="mt-2 text-3xl leading-tight text-[#F8F1E6] md:text-4xl" style={{ fontFamily: "Instrument Serif, Georgia, serif" }}>Governed repair queue for narrative revision.</h1>
          <p className="mt-3 max-w-3xl text-sm text-[#CBBDA4]">RevisionGrade diagnoses severity and scope. The author controls decisions. Deferral is an author choice, not a downgrade.</p>
          <div className="mt-5 grid gap-3 rounded-lg border border-[#2D2519] bg-[#110D07] p-3 text-xs text-[#D8C6A4] md:grid-cols-2">
            <div><span className="text-[#C8A96E]">Priority:</span> {countBySeverity("must")} MUST · {countBySeverity("should")} SHOULD · {countBySeverity("could")} COULD</div>
            <div><span className="text-[#C8A96E]">Decisions:</span> {deferred} Deferred · {accepted} Accepted · {custom} Custom · {rejected} Rejected · {pending} Pending</div>
          </div>
          <div className="mt-3 rounded-lg border border-[#2D2519] bg-[#110D07] p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#C8A96E]">Total revisions by category</p>
            <div className="mt-2 grid gap-2 text-xs text-[#D8C6A4] md:grid-cols-2">
              <div>{countBySeverity("must")} MUST · {countBySeverity("should")} SHOULD · {countBySeverity("could")} COULD</div>
              <div>{SCOPES.map((scope) => `${countByScope(scope)} ${scope}`).join(" · ")}</div>
            </div>
          </div>
          <p className="mt-2 text-xs text-[#A9987D]">First batch is sorted by editorial priority: MUST first, then SHOULD, then COULD. Recommended path: resolve MUST items before lower-level polish.</p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <Link href="/revise" className="rounded border border-[#6D5A3B] px-3 py-1.5 text-[#E8D8BA] hover:border-[#C8A96E]">← Revise landing</Link>
            <Link href="/evaluate" className="rounded border border-[#6D5A3B] px-3 py-1.5 text-[#E8D8BA] hover:border-[#C8A96E]">Evaluate</Link>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-[#3A3022] bg-[#161109] p-4">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-sm uppercase tracking-[0.18em] text-[#D7C4A1]">First Batch</h2><span className="rounded-full border border-[#5D4C31] px-2 py-0.5 text-[11px] text-[#C8A96E]">{SORTED_OPPORTUNITIES.length} queued</span></div>
            <p className="mb-3 text-xs leading-5 text-[#A9987D]">MUST items are shown first so the author starts with readiness blockers before lower-level repairs.</p>
            <ol className="space-y-3">
              {SORTED_OPPORTUNITIES.map((item) => {
                const decision = decisionById[item.id];
                return (
                  <li key={item.id}>
                    <button type="button" onClick={() => moveToOpportunity(item.id)} className={`w-full rounded-lg border p-3 text-left transition ${active.id === item.id ? "border-[#C8A96E] bg-[#221B11]" : "border-[#2B241A] bg-[#110D07] hover:border-[#5D4C31]"}`}>
                      <div className="mb-2 flex flex-wrap gap-1.5"><span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${severityClasses(item.severity)}`}>{item.severity}</span><span className="rounded border border-[#4E4333] bg-[#1B150E] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#D6C3A2]">{item.scope}</span><span className="rounded border border-[#4E4333] bg-[#1B150E] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#D6C3A2]">{item.mode === "repair-brief" ? "Brief" : "Rewrite"}</span>{decision === "deferred" && <span className="rounded border border-[#5C5140] bg-[#2E2A22] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#B7A98D]">Deferred by author</span>}</div>
                      <p className="text-sm text-[#F2E7D4]">{item.title}</p><p className="mt-1 text-xs text-[#AA9A7F]">{item.meta}</p>
                    </button>
                  </li>
                );
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

            <section className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => stampDecision(`accepted_${selectedOption.toLowerCase()}` as DecisionState)} className="rounded border border-[#C8A96E] bg-[#C8A96E] px-4 py-2 text-sm font-medium text-[#1A140C] hover:bg-[#D5B67E]">Accept selected ({selectedOption})</button><button type="button" onClick={() => stampDecision("keep_original")} className="rounded border border-[#5D4C31] px-4 py-2 text-sm text-[#E8DABF] hover:border-[#C8A96E]">Keep original</button><button type="button" onClick={() => stampDecision("reject")} className="rounded border border-[#7A2B1A]/70 px-4 py-2 text-sm text-[#E2B2A6] hover:bg-[#7A2B1A]/20">Reject all three</button><button type="button" onClick={() => stampDecision("deferred")} className="rounded border border-[#5C5140] px-4 py-2 text-sm text-[#B7A98D] hover:border-[#C8A96E]">Defer</button><button type="button" onClick={() => { setDraftText((current) => current || selectedProposal.text); setIsDraftOpen(true); }} className="rounded border border-[#C8A96E] bg-[#C8A96E]/10 px-4 py-2 text-sm text-[#F3E3C3] hover:bg-[#C8A96E]/20">Write custom</button></section>

            {isDraftOpen && <section className="mt-4 rounded-lg border border-[#C8A96E]/60 bg-[#120E08] p-4"><p className="text-xs uppercase tracking-[0.16em] text-[#C8A96E]">Author custom revision</p><textarea value={draftText} onChange={(event) => setDraftText(event.target.value)} rows={6} className="mt-3 w-full rounded border border-[#3A3022] bg-[#0D0A05] p-3 font-mono text-sm leading-6 text-[#F7EFDF] outline-none focus:border-[#C8A96E]" placeholder="Write your custom repair here..." /><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!draftText.trim()} onClick={() => stampDecision("custom", draftText)} className="rounded border border-[#C8A96E] bg-[#C8A96E] px-3 py-2 text-sm font-medium text-[#1A140C] disabled:opacity-50">Save custom revision</button><button type="button" onClick={() => setIsDraftOpen(false)} className="rounded border border-[#5D4C31] px-3 py-2 text-sm text-[#E8DABF] hover:border-[#C8A96E]">Close</button></div></section>}
          </article>
        </section>

        <section className="mt-4 rounded-xl border border-[#3A3022] bg-[#161109] p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div><h2 className="text-sm uppercase tracking-[0.18em] text-[#D7C4A1]">Revision Ledger</h2><p className="mt-1 text-xs text-[#A9987D]">A running list of author decisions. Undo returns the opportunity to active review and recalculates the queue state.</p></div>
            {ledger.length > 0 && <button type="button" onClick={() => undoLedgerEntry(0)} className="self-start rounded border border-[#5D4C31] px-3 py-1.5 text-xs text-[#E8D8BA] hover:border-[#C8A96E] md:self-auto">Undo last decision</button>}
          </div>
          <ol className="mt-4 grid gap-2 xl:grid-cols-2">{ledger.length === 0 ? <li className="rounded-lg border border-[#2D2519] bg-[#120E08] p-3 text-sm text-[#B3A185]"><strong>No revision decisions yet.</strong><br />Accept proposals, keep originals, write custom repairs, reject, or defer work to begin the ledger.</li> : ledger.map((entry, i) => <li key={`${entry.at}-${entry.itemId}-${i}`} className="rounded-lg border border-[#2D2519] bg-[#120E08] p-3 text-sm"><div className="flex items-start justify-between gap-3"><p className="text-[#E9DCC4]"><span className="mr-1 text-[11px] uppercase tracking-wider text-[#C8A96E]">{decisionLabel(entry)}</span> — {entry.itemTitle}</p><button type="button" onClick={() => undoLedgerEntry(i)} className="shrink-0 rounded border border-[#5D4C31] px-2 py-1 text-[11px] text-[#D8C6A4] hover:border-[#C8A96E]">Undo</button></div>{entry.customText && <pre className="mt-2 whitespace-pre-wrap rounded border border-[#2D2519] bg-[#0D0A05] p-2 text-xs leading-5 text-[#E8DCC4]">{entry.customText}</pre>}<p className="mt-1 text-xs text-[#9F8F75]">{entry.at}</p></li>)}</ol>
        </section>
      </div>
    </main>
  );
}

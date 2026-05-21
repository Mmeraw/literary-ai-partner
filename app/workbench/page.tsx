"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Severity = "must" | "should" | "could" | "deferred";

type Opportunity = {
  id: number;
  severity: Severity;
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
  options: { key: "A" | "B" | "C"; mechanism: string; text: string; rationale: string }[];
};

type Decision = "accept" | "keep" | "reject" | "custom";

type SessionEntry = {
  at: string;
  itemId: number;
  itemTitle: string;
  decision: Decision;
};

const OPPORTUNITIES: Opportunity[] = [
  {
    id: 1,
    severity: "must",
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
    severity: "should",
    leverage: "Medium",
    crumb: "Golden Spine · cross-chapter",
    title: "Promise opened in Ch. 4 still unresolved at midpoint",
    meta: "Golden Spine · cross-chapter",
    confidence: "Moderate confidence",
    anchor: "Ch. 4 setup → Ch. 12 expected payoff",
    quoteHighlight: "He promised himself he would tell her.",
    quoteRest: " By the river scene, he still had not.",
    symptom: "Primary character promise is opened in Act I but not acknowledged by midpoint.",
    cause: "Narrative spine carries this thread silently instead of tightening pressure.",
    fixDirection: "Surface promise in Ch. 12 with one beat of avoidance or near-confession.",
    readerEffect: "Pressure continuity is restored across second-act plateau.",
    mistakeProofing: "Do not resolve the promise before Ch. 18 payoff.",
    options: [
      { key: "A", mechanism: "Avoidance beat", text: "He almost said it. He drank instead.", rationale: "Lightest touch; keeps promise live without spending it." },
      { key: "B", mechanism: "Reader-only acknowledgment", text: "The thing he promised himself in May had still not been said.", rationale: "Gives spine cue without burdening scene." },
      { key: "C", mechanism: "Near-confession", text: "“There’s something—” he started. Then the call came in.", rationale: "Highest leverage without resolving the thread." },
    ],
  },
  {
    id: 4,
    severity: "should",
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
    fixDirection: "Insert one consequence-bearing scene or compress two slow chapters.",
    readerEffect: "Engagement curve recovers ahead of Ch. 15 turn.",
    mistakeProofing: "Preserve quiet character work in Ch. 13 §2.",
    options: [
      { key: "A", mechanism: "Compression", text: "Merge Ch. 12 §4 into Ch. 13 §1; cut transition.", rationale: "Removes soft seam without losing content." },
      { key: "B", mechanism: "Escalation insertion", text: "Add one external pressure event in Ch. 13.", rationale: "Re-establishes stakes with minimal disruption." },
      { key: "C", mechanism: "Subplot weave", text: "Move Ch. 16 subplot reveal earlier.", rationale: "Uses existing material to rebalance spine." },
    ],
  },
  {
    id: 5,
    severity: "could",
    leverage: "Local",
    crumb: "Voice · Ch. 11, p. 132",
    title: "Filtered perception softens close-third POV",
    meta: "Voice · Ch. 11, p. 132",
    confidence: "High confidence",
    anchor: "char 4089–4131 · Ch. 11, p. 132",
    quoteHighlight: "She could see the boat",
    quoteRest: " moving downstream against the dimming light.",
    symptom: "Filter verb inserts narrative distance in close-third POV.",
    cause: "Habitual perception phrasing not used as deliberate style elsewhere.",
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
  {
    id: 7,
    severity: "deferred",
    leverage: "Deferred",
    crumb: "WAVE · Act II",
    title: "Thematic propagation thin in Act II",
    meta: "WAVE · revisit next pass",
    confidence: "Low confidence",
    anchor: "Cross-chapter · Ch. 12–17",
    quoteHighlight: "The river motif",
    quoteRest: " established early does not recur with sufficient density.",
    symptom: "Central motif loses presence in manuscript middle.",
    cause: "Act II focuses on consequence; thematic substrate goes quiet.",
    fixDirection: "Re-thread motif across two Act-II chapters using light anchors.",
    readerEffect: "Thematic continuity improves without over-signaling.",
    mistakeProofing: "Avoid placing motif in dialogue; use image-only re-entry.",
    options: [
      { key: "A", mechanism: "Image cameo", text: "Add a river-light reflection in Ch. 13 §2.", rationale: "Lightest re-entry." },
      { key: "B", mechanism: "Sound cameo", text: "Add an off-stage water sound in Ch. 15 §1.", rationale: "Sensory substrate without visual repetition." },
      { key: "C", mechanism: "Object echo", text: "Reintroduce the Ch. 4 oar in Ch. 16 §3.", rationale: "Uses an existing object for motif carry." },
    ],
  },
];

function severityClasses(severity: Severity) {
  switch (severity) {
    case "must":
      return "bg-[#7A2B1A]/30 text-[#E9B19F] border border-[#7A2B1A]/50";
    case "should":
      return "bg-[#C8A96E]/20 text-[#E9D9B7] border border-[#C8A96E]/45";
    case "could":
      return "bg-[#2D3B2A]/35 text-[#B8D6AD] border border-[#48603F]/50";
    case "deferred":
      return "bg-[#2E2A22]/70 text-[#B7A98D] border border-[#5C5140]/50";
    default:
      return "bg-[#2E2A22] text-[#EDE1CC] border border-[#5C5140]";
  }
}

export default function WorkbenchPage() {
  const [activeId, setActiveId] = useState<number>(1);
  const [selectedOption, setSelectedOption] = useState<"A" | "B" | "C">("A");
  const [sessionLog, setSessionLog] = useState<SessionEntry[]>([]);

  const active = useMemo(
    () => OPPORTUNITIES.find((item) => item.id === activeId) ?? OPPORTUNITIES[0],
    [activeId]
  );

  const queueIndex = OPPORTUNITIES.findIndex((item) => item.id === active.id);
  const nextId = queueIndex >= 0 && queueIndex < OPPORTUNITIES.length - 1 ? OPPORTUNITIES[queueIndex + 1].id : null;

  function stampDecision(decision: Decision) {
    setSessionLog((prev) => [
      {
        at: new Date().toLocaleTimeString(),
        itemId: active.id,
        itemTitle: active.title,
        decision,
      },
      ...prev,
    ]);

    if (nextId) {
      setActiveId(nextId);
      setSelectedOption("A");
    }
  }

  const accepted = sessionLog.filter((e) => e.decision === "accept").length;
  const rejected = sessionLog.filter((e) => e.decision === "reject").length;
  const custom = sessionLog.filter((e) => e.decision === "custom").length;
  const pending = Math.max(OPPORTUNITIES.length - sessionLog.length, 0);

  return (
    <main className="min-h-screen bg-[#0D0A05] text-[#F5EFE4] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 rounded-xl border border-[#3A3022] bg-[#1C160E]/80 p-5">
          <p className="text-[11px] tracking-[0.22em] uppercase text-[#C8A96E]">Revise Workspace</p>
          <h1 className="mt-2 text-3xl md:text-4xl leading-tight text-[#F8F1E6]" style={{ fontFamily: "Instrument Serif, Georgia, serif" }}>
            Governed repair queue for narrative revision.
          </h1>
          <p className="mt-3 text-sm text-[#CBBDA4] max-w-3xl">
            One opportunity at a time: evidence, diagnosis, three proposals, and explicit author decisions.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <Link href="/revise" className="inline-flex items-center rounded border border-[#6D5A3B] px-3 py-1.5 text-[#E8D8BA] hover:border-[#C8A96E] hover:text-[#F7EEDB]">
              ← Revise landing
            </Link>
            <Link href="/evaluate" className="inline-flex items-center rounded border border-[#6D5A3B] px-3 py-1.5 text-[#E8D8BA] hover:border-[#C8A96E] hover:text-[#F7EEDB]">
              Evaluate
            </Link>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)_340px]">
          <aside className="rounded-xl border border-[#3A3022] bg-[#161109] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-[0.18em] text-[#D7C4A1]">Repair Queue</h2>
              <span className="rounded-full border border-[#5D4C31] px-2 py-0.5 text-[11px] text-[#C8A96E]">{OPPORTUNITIES.length} queued</span>
            </div>
            <ol className="space-y-2">
              {OPPORTUNITIES.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(item.id);
                      setSelectedOption("A");
                    }}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      active.id === item.id
                        ? "border-[#C8A96E] bg-[#221B11] shadow-[0_0_0_1px_rgba(200,169,110,0.2)]"
                        : "border-[#2B241A] bg-[#110D07] hover:border-[#5D4C31]"
                    }`}
                  >
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${severityClasses(item.severity)}`}>{item.severity}</span>
                      <span className="rounded border border-[#4E4333] bg-[#1B150E] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#D6C3A2]">{item.leverage}</span>
                    </div>
                    <p className="text-sm text-[#F2E7D4]">{item.title}</p>
                    <p className="mt-1 text-xs text-[#AA9A7F]">{item.meta}</p>
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[#C7B89C]">
              <div>Accepted <strong>{accepted}</strong></div>
              <div>Rejected <strong>{rejected}</strong></div>
              <div>Custom <strong>{custom}</strong></div>
              <div>Pending <strong>{pending}</strong></div>
            </div>
          </aside>

          <article className="rounded-xl border border-[#3A3022] bg-[#1C160E] p-4 md:p-5">
            <p className="text-xs text-[#A89574]">{active.crumb}</p>
            <h2 className="mt-2 text-2xl text-[#F7EFDF]" style={{ fontFamily: "Instrument Serif, Georgia, serif" }}>{active.title}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`rounded px-2 py-1 text-[11px] uppercase tracking-wider ${severityClasses(active.severity)}`}>{active.severity}</span>
              <span className="rounded border border-[#5A4B33] bg-[#231C12] px-2 py-1 text-[11px] uppercase tracking-wider text-[#D7C6A8]">{active.leverage}</span>
              <span className="rounded border border-[#5A4B33] bg-[#231C12] px-2 py-1 text-[11px] uppercase tracking-wider text-[#D7C6A8]">{active.confidence}</span>
            </div>

            <section className="mt-5 rounded-lg border border-[#2E261A] bg-[#12100B] p-4">
              <h3 className="text-xs uppercase tracking-[0.16em] text-[#C8A96E]">Evidence</h3>
              <blockquote className="mt-2 border-l border-[#C8A96E]/60 pl-3 text-sm leading-relaxed text-[#E9DCC4]">
                <span className="text-[#F8F1E2]">“{active.quoteHighlight}”</span>
                {active.quoteRest}
              </blockquote>
              <p className="mt-2 text-xs text-[#9D8D72]">{active.anchor}</p>
            </section>

            <section className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-[#2E261A] bg-[#12100B] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#C8A96E]">Symptom</p>
                <p className="mt-1 text-sm text-[#E8DCC4]">{active.symptom}</p>
              </div>
              <div className="rounded-lg border border-[#2E261A] bg-[#12100B] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#C8A96E]">Cause</p>
                <p className="mt-1 text-sm text-[#E8DCC4]">{active.cause}</p>
              </div>
              <div className="rounded-lg border border-[#2E261A] bg-[#12100B] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#C8A96E]">Fix direction</p>
                <p className="mt-1 text-sm text-[#E8DCC4]">{active.fixDirection}</p>
              </div>
              <div className="rounded-lg border border-[#2E261A] bg-[#12100B] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#C8A96E]">Reader effect</p>
                <p className="mt-1 text-sm text-[#E8DCC4]">{active.readerEffect}</p>
              </div>
            </section>

            <section className="mt-4 rounded-lg border border-[#2E261A] bg-[#12100B] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[#C8A96E]">Mistake-proofing</p>
              <p className="mt-1 text-sm text-[#E8DCC4]">{active.mistakeProofing}</p>
            </section>

            <section className="mt-5 space-y-2">
              {active.options.map((option) => {
                const isSelected = selectedOption === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSelectedOption(option.key)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      isSelected
                        ? "border-[#C8A96E] bg-[#221B11] shadow-[0_0_0_1px_rgba(200,169,110,0.2)]"
                        : "border-[#2E261A] bg-[#12100B] hover:border-[#5D4C31]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-[#F2E8D6]">{option.key} · {option.mechanism}</p>
                      <span className="text-xs text-[#B29F7D]">Proposal</span>
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap text-sm text-[#E5D8BE]">{option.text}</pre>
                    <p className="mt-2 text-xs text-[#BDAE91]">{option.rationale}</p>
                  </button>
                );
              })}
            </section>

            <section className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => stampDecision("accept")} className="rounded border border-[#C8A96E] bg-[#C8A96E] px-3 py-2 text-sm font-medium text-[#1A140C] hover:bg-[#D5B67E]">
                Accept selected ({selectedOption})
              </button>
              <button type="button" onClick={() => stampDecision("keep")} className="rounded border border-[#5D4C31] bg-transparent px-3 py-2 text-sm text-[#E8DABF] hover:border-[#C8A96E]">
                Keep original
              </button>
              <button type="button" onClick={() => stampDecision("reject")} className="rounded border border-[#7A2B1A]/70 bg-transparent px-3 py-2 text-sm text-[#E2B2A6] hover:bg-[#7A2B1A]/20">
                Reject all three
              </button>
              <button type="button" onClick={() => stampDecision("custom")} className="rounded border border-[#5D4C31] bg-transparent px-3 py-2 text-sm text-[#E8DABF] hover:border-[#C8A96E]">
                Write custom
              </button>
            </section>
          </article>

          <aside className="rounded-xl border border-[#3A3022] bg-[#161109] p-4">
            <h2 className="text-sm uppercase tracking-[0.18em] text-[#D7C4A1]">Session Log</h2>
            <p className="mt-1 text-xs text-[#A9987D]">Every decision is explicitly recorded in sequence.</p>
            <ol className="mt-4 space-y-2">
              {sessionLog.length === 0 ? (
                <li className="rounded-lg border border-[#2D2519] bg-[#120E08] p-3 text-sm text-[#B3A185]">
                  No actions yet. Select an option and choose a decision.
                </li>
              ) : (
                sessionLog.map((entry, i) => (
                  <li key={`${entry.at}-${entry.itemId}-${i}`} className="rounded-lg border border-[#2D2519] bg-[#120E08] p-3 text-sm">
                    <p className="text-[#E9DCC4]">
                      <span className="uppercase tracking-wider text-[#C8A96E] text-[11px] mr-1">{entry.decision}</span>
                      #{entry.itemId} · {entry.itemTitle}
                    </p>
                    <p className="mt-1 text-xs text-[#9F8F75]">{entry.at}</p>
                  </li>
                ))
              )}
            </ol>
          </aside>
        </section>
      </div>
    </main>
  );
}

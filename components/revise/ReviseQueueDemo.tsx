"use client";

import { useState } from "react";

/* ── Types ─────────────────────────────────────────────────────────────── */

type Decision = "accepted" | "kept" | "rejected" | "custom" | "deferred" | null;

type Proposal = {
  label: string;
  mechanism: string;
  lines: string[];
  rationale: string;
};

type ItemDetail = {
  id: number;
  severity: "must" | "should" | "could" | "deferred";
  leverage: string;
  title: string;
  meta: string;
  context: string;
  confidence: string;
  evidence: { quote: string; location: string };
  symptom: string;
  cause: string;
  fix_direction: string;
  reader_effect: string;
  mistake_proofing: string;
  proposals: Proposal[];
};

/* ── Sample data for all 7 queue items ─────────────────────────────────── */

const items: ItemDetail[] = [
  {
    id: 1,
    severity: "must",
    leverage: "Spine",
    title: "Abstract phrasing weakens river-scene tension",
    meta: "Dialogue \u00b7 Ch.\u00a011 \u00b7 evidence anchored",
    context: "Dialogue \u00b7 Chapter 11 \u00b7 river scene",
    confidence: "Moderate confidence",
    evidence: {
      quote: "\u201cIt\u2019s okay,\u201d I whispered. But even as I said it, I knew it wasn\u2019t okay.",
      location: "char 1247\u20131330 \u00b7 Chapter 11 \u00b7 river scene",
    },
    symptom: "Emotional contradiction is stated directly instead of dramatized.",
    cause: "Internal realization duplicates what the dialogue already implies, flattening the moment into commentary.",
    fix_direction: "Replace internal explanation with a physical hesitation or interruption beat.",
    reader_effect: "Tension escalates instead of pausing for narrator gloss.",
    mistake_proofing: "Preserve the speaker\u2019s voice and the dialogue\u2019s rhythm. Do not introduce new information about the river or the listener\u2019s reaction.",
    proposals: [
      {
        label: "A",
        mechanism: "Action-beat substitution",
        lines: ["\u201cIt\u2019s okay,\u201d I whispered.", "The lie caught halfway out."],
        rationale: "Replaces internal gloss with a physical reaction; voice fingerprint preserved.",
      },
      {
        label: "B",
        mechanism: "Interruption beat",
        lines: ["\u201cIt\u2019s okay\u2014\u201d", "My voice cracked before I could finish."],
        rationale: "Cuts the reassurance mid-line so the failure is heard, not narrated.",
      },
      {
        label: "C",
        mechanism: "Rendering shift",
        lines: ["\u201cIt\u2019s okay.\u201d", "She looked at me long enough to know I didn\u2019t believe it."],
        rationale: "Lets the listener carry the contradiction; closes the scene with weight.",
      },
    ],
  },
  {
    id: 2,
    severity: "must",
    leverage: "High",
    title: "Internal monologue duplicates dialogue subtext",
    meta: "Pacing \u00b7 Ch.\u00a011",
    context: "Pacing \u00b7 Chapter 11",
    confidence: "High confidence",
    evidence: {
      quote: "I could tell from Cliff\u2019s silence that he was afraid. He didn\u2019t say it, but I knew. His fear was obvious.",
      location: "char 2450\u20132560 \u00b7 Chapter 11 \u00b7 highway scene",
    },
    symptom: "Reader receives the same emotional information twice: once through dialogue cues, again through interior narration.",
    cause: "The narrator explains what the dialogue already shows, reducing subtext to text.",
    fix_direction: "Cut the interior echo. Let the dialogue\u2019s silence carry the fear.",
    reader_effect: "Pacing tightens; reader engages actively instead of being told what they already understood.",
    mistake_proofing: "Do not cut so much that Cliff\u2019s emotional state becomes ambiguous. The silence must remain legible.",
    proposals: [
      {
        label: "A",
        mechanism: "Deletion with beat",
        lines: ["Cliff said nothing.", "The highway stretched ahead."],
        rationale: "Removes interior gloss entirely; landscape fills the silence.",
      },
      {
        label: "B",
        mechanism: "Physical substitution",
        lines: ["Cliff\u2019s knuckles went white on the steering wheel."],
        rationale: "Replaces told emotion with a single physical detail.",
      },
      {
        label: "C",
        mechanism: "Deflection through action",
        lines: ["Cliff turned the radio on, then off, then on again.", "\u201cReception\u2019s bad up here,\u201d he said."],
        rationale: "Fear surfaces through displacement behavior rather than interior narration.",
      },
    ],
  },
  {
    id: 3,
    severity: "should",
    leverage: "Medium",
    title: "Promise opened in Ch.\u00a04 still unresolved at midpoint",
    meta: "Narrative closure \u00b7 cross-chapter",
    context: "Narrative closure \u00b7 cross-chapter \u00b7 chapters 4\u201312",
    confidence: "Moderate confidence",
    evidence: {
      quote: "\u201cWe\u2019ll come back for the ledger,\u201d Cliff said. \u201cBefore the river freezes.\u201d",
      location: "Chapter 4, p.\u00a047 \u00b7 promise planted",
    },
    symptom: "The ledger promise from Chapter 4 has not been referenced, complicated, or addressed by the midpoint.",
    cause: "The plot advanced through new incidents without revisiting the open thread, creating a sense of narrative drift.",
    fix_direction: "Add one mid-act callback: a brief reference to the ledger that either complicates or reaffirms the promise.",
    reader_effect: "Reader feels the story\u2019s throughline is intentional, not forgotten.",
    mistake_proofing: "Do not resolve the ledger promise early. The callback should deepen uncertainty, not close the loop.",
    proposals: [
      {
        label: "A",
        mechanism: "Interior callback",
        lines: ["I hadn\u2019t forgotten about the ledger. That was the problem\u2014", "neither had the river."],
        rationale: "Brief interior line ties the open thread to the present without resolving it.",
      },
      {
        label: "B",
        mechanism: "Dialogue reminder",
        lines: ["\u201cYou still thinking about that ledger?\u201d Cliff asked.", "\u201cI\u2019m thinking about what\u2019s in it.\u201d"],
        rationale: "Surfaces the promise through character exchange; keeps it alive in dialogue.",
      },
      {
        label: "C",
        mechanism: "Environmental echo",
        lines: ["The lockbox sat where we\u2019d left it, half-buried under river silt.", "The clasp had rusted shut."],
        rationale: "Physical detail suggests the promise is decaying, raising urgency without exposition.",
      },
    ],
  },
  {
    id: 4,
    severity: "should",
    leverage: "Medium",
    title: "Pressure plateaus across chapters 12\u201314",
    meta: "Pacing \u00b7 3 chapters",
    context: "Pacing \u00b7 Chapters 12\u201314",
    confidence: "Moderate confidence",
    evidence: {
      quote: "We drove. We arrived. We set up camp. The river was still there.",
      location: "Chapters 12\u201314 \u00b7 recurring pattern",
    },
    symptom: "Narrative tension stays flat across three consecutive chapters, creating a sensation of treading water.",
    cause: "Each chapter follows a similar arrive-observe-reflect rhythm without escalation or reversal.",
    fix_direction: "Introduce a complication, reversal, or discovery in at least one of the three chapters to break the pattern.",
    reader_effect: "Reader re-engages because the story\u2019s trajectory changes direction, even slightly.",
    mistake_proofing: "Do not add artificial conflict. The complication should emerge from existing story elements, not feel imposed.",
    proposals: [
      {
        label: "A",
        mechanism: "Discovery insertion",
        lines: ["The river had shifted overnight.", "Where the bank used to be, there was nothing\u2014", "just a clean edge, like something had been cut away."],
        rationale: "A physical change in the landscape breaks the pattern and raises questions.",
      },
      {
        label: "B",
        mechanism: "Character friction",
        lines: ["\u201cI want to go back,\u201d Cliff said.", "It was the first time he\u2019d said that. I didn\u2019t know what to do with it."],
        rationale: "Cliff\u2019s reversal disrupts the routine and forces a response.",
      },
      {
        label: "C",
        mechanism: "Information drop",
        lines: ["Melvin left a note on the cabin door.", "Three words: \u201cThey found one.\u201d"],
        rationale: "Sudden external information breaks the observation loop and accelerates the plot.",
      },
    ],
  },
  {
    id: 5,
    severity: "could",
    leverage: "Local",
    title: "Filtered perception softens close-third POV",
    meta: "Voice \u00b7 Ch.\u00a011, p.\u00a0132",
    context: "Voice \u00b7 Chapter 11, p.\u00a0132",
    confidence: "High confidence",
    evidence: {
      quote: "It seemed like Cliff was worried. I thought maybe the road was getting to him.",
      location: "Chapter 11, p.\u00a0132 \u00b7 close-third violation",
    },
    symptom: "Filter words (\u201cseemed like,\u201d \u201cI thought maybe\u201d) add distance where close-third POV should be immediate.",
    cause: "The narrator hedges observations that should be rendered as direct perception in close-third voice.",
    fix_direction: "Remove filter phrases. State the perception directly, as the POV character experiences it.",
    reader_effect: "The reader feels inside the character\u2019s head instead of watching from one remove.",
    mistake_proofing: "Preserve genuine uncertainty where it serves the story. Not every hedge is a filter\u2014only remove the ones that soften perception unnecessarily.",
    proposals: [
      {
        label: "A",
        mechanism: "Direct perception",
        lines: ["Cliff was worried. The road was getting to him."],
        rationale: "Removes both filters; perception becomes statement of fact within the POV.",
      },
      {
        label: "B",
        mechanism: "Physical grounding",
        lines: ["Cliff\u2019s jaw tightened every time the truck hit a rut.", "The road was winning."],
        rationale: "Replaces filters with observed detail that implies the same conclusion.",
      },
      {
        label: "C",
        mechanism: "Selective retention",
        lines: ["Cliff was worried\u2014I could see that much.", "Whether the road was getting to him or something else, I couldn\u2019t tell."],
        rationale: "Preserves one uncertainty as genuine while removing the unnecessary filter from the first clause.",
      },
    ],
  },
  {
    id: 6,
    severity: "could",
    leverage: "Local",
    title: "Adverb stack thins on key reassurance line",
    meta: "Prose control \u00b7 Ch.\u00a011",
    context: "Prose control \u00b7 Chapter 11",
    confidence: "High confidence",
    evidence: {
      quote: "\u201cWe\u2019ll be absolutely, completely fine,\u201d I said softly, reassuringly.",
      location: "Chapter 11 \u00b7 reassurance scene",
    },
    symptom: "Adverb stack (\u201cabsolutely, completely, softly, reassuringly\u201d) dilutes the line\u2019s emotional weight.",
    cause: "Multiple modifiers compete for the same job, so none lands with force.",
    fix_direction: "Cut to one adverb maximum. Let the dialogue\u2019s content and context carry the tone.",
    reader_effect: "The reassurance line hits harder because the words do the work, not the modifiers.",
    mistake_proofing: "Do not strip all softness from the moment. One well-chosen modifier can stay if it earns its place.",
    proposals: [
      {
        label: "A",
        mechanism: "Total cut",
        lines: ["\u201cWe\u2019ll be fine,\u201d I said."],
        rationale: "Bare statement; confidence implied by brevity.",
      },
      {
        label: "B",
        mechanism: "Single modifier",
        lines: ["\u201cWe\u2019ll be fine,\u201d I said quietly."],
        rationale: "One adverb survives; \u201cquietly\u201d does more work than the original four.",
      },
      {
        label: "C",
        mechanism: "Action replacement",
        lines: ["\u201cWe\u2019ll be fine.\u201d", "I squeezed her hand. The words had to be enough."],
        rationale: "Physical gesture replaces verbal reassurance; closing line adds internal weight.",
      },
    ],
  },
  {
    id: 7,
    severity: "deferred",
    leverage: "",
    title: "Thematic propagation thin in Act II",
    meta: "Long-form continuity \u00b7 revisit after evaluation",
    context: "Long-form continuity \u00b7 Act II",
    confidence: "Low confidence",
    evidence: {
      quote: "The river theme from Act I does not surface in any of the Act II chapters reviewed.",
      location: "Act II \u00b7 chapters 6\u201311 \u00b7 thematic gap",
    },
    symptom: "The central river-as-ledger theme disappears for most of Act II, making its return in Act III feel abrupt.",
    cause: "Act II focuses on character relationships and immediate plot, letting the thematic substrate go dormant.",
    fix_direction: "Seed 2\u20133 brief thematic echoes across Act II: imagery, dialogue fragments, or environmental details that keep the river motif alive.",
    reader_effect: "When the theme resurfaces in Act III, the reader feels it was present all along, not reintroduced.",
    mistake_proofing: "Do not force the theme into scenes where it doesn\u2019t belong. The echoes should feel organic, not inserted. This is a long-form continuity note\u2014revisit after the full evaluation.",
    proposals: [
      {
        label: "A",
        mechanism: "Environmental echo",
        lines: ["Rain collected in the gutters outside the motel.", "It ran in one direction. Everything here did."],
        rationale: "Water imagery keeps the river motif alive without forcing it into the foreground.",
      },
      {
        label: "B",
        mechanism: "Dialogue fragment",
        lines: ["\u201cEverything flows downhill,\u201d Cliff muttered.", "I didn\u2019t ask what he meant."],
        rationale: "A throwaway line in dialogue carries the theme without requiring a scene about it.",
      },
      {
        label: "C",
        mechanism: "Interior reflection",
        lines: ["I caught myself counting again\u2014exits, distances, water sources.", "Old habits from the river."],
        rationale: "The narrator\u2019s internal habit keeps the theme present as character texture.",
      },
    ],
  },
];

const filterLabels = ["All", "Evaluation finding", "Criterion", "Severity", "Chapter", "Cross-chapter"];

function severityClasses(severity: string): string {
  if (severity === "must") return "bg-red-900/60 text-red-300 border-red-700/40";
  if (severity === "should") return "bg-amber-900/50 text-amber-300 border-amber-700/40";
  if (severity === "could") return "bg-gray-700/50 text-gray-300 border-gray-600/40";
  return "bg-gray-800/40 text-gray-400 border-gray-700/30";
}

function leverageClasses(leverage: string): string {
  if (leverage === "Spine") return "bg-red-900/40 text-red-200 border-red-800/30";
  if (leverage === "High") return "bg-amber-900/40 text-amber-200 border-amber-800/30";
  return "bg-gray-800/30 text-gray-400 border-gray-700/20";
}

function decisionLabel(d: Decision): string {
  if (d === "accepted") return "Accepted";
  if (d === "kept") return "Kept original";
  if (d === "rejected") return "Rejected all";
  if (d === "custom") return "Custom written";
  if (d === "deferred") return "Deferred";
  return "";
}

function decisionBadgeClass(d: Decision): string {
  if (d === "accepted") return "bg-green-900/50 text-green-300 border-green-700/40";
  if (d === "kept") return "bg-blue-900/40 text-blue-300 border-blue-700/30";
  if (d === "rejected") return "bg-red-900/40 text-red-300 border-red-700/30";
  if (d === "custom") return "bg-purple-900/40 text-purple-300 border-purple-700/30";
  if (d === "deferred") return "bg-gray-800/40 text-gray-400 border-gray-700/30";
  return "";
}

export default function ReviseQueueDemo() {
  const [activeId, setActiveId] = useState(1);
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedProposal, setSelectedProposal] = useState<Record<number, string>>({ 1: "A" });
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});

  const active = items.find((i) => i.id === activeId) ?? items[0];
  const currentProposal = selectedProposal[activeId] ?? "A";
  const currentDecision = decisions[activeId] ?? null;

  const acceptedCount = Object.values(decisions).filter((d) => d === "accepted").length;
  const rejectedCount = Object.values(decisions).filter((d) => d === "rejected").length;
  const customCount = Object.values(decisions).filter((d) => d === "custom").length;
  const deferredCount = Object.values(decisions).filter((d) => d === "deferred").length;
  const pendingCount = items.length - acceptedCount - rejectedCount - customCount - deferredCount - Object.values(decisions).filter((d) => d === "kept").length;

  function handleDecision(d: Decision) {
    setDecisions((prev) => ({ ...prev, [activeId]: d }));
    // Auto-advance to next undecided item
    const currentIndex = items.findIndex((i) => i.id === activeId);
    for (let offset = 1; offset < items.length; offset++) {
      const nextItem = items[(currentIndex + offset) % items.length];
      if (!decisions[nextItem.id]) {
        setTimeout(() => setActiveId(nextItem.id), 300);
        return;
      }
    }
  }

  return (
    <section id="revise-demo" className="border-y border-[#C8BEA8]/10 bg-[#1A1208]/50">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-[#C8A96E]">
          See the Revise Queue in action
        </p>
        <h2 className="mt-4 max-w-4xl font-rg-serif text-4xl leading-tight md:text-5xl text-[#F5EFE0]">
          A repair queue, not a report.{" "}
          <span className="text-[#C8BEA8]/60">Progressive disclosure of one meaningful problem at a time.</span>
        </h2>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded border border-[#C8A96E]/25 bg-[#C8A96E]/10 px-3 py-1.5">
            <span className="font-rg-mono text-[10px] uppercase tracking-wider text-[#C8A96E]">Example preview</span>
            <span className="text-xs text-[#C8BEA8]/60">{"\u2014"} this is sample data, not your manuscript</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded border border-[#C8A96E]/40 bg-[#C8A96E]/15 px-3 py-1.5 animate-pulse">
            <span className="text-sm text-[#C8A96E] font-semibold">{"\u2190"} Try it!</span>
            <span className="text-xs text-[#C8BEA8]/70">Click items on the left, choose a proposal, then make a decision.</span>
          </div>
        </div>

        <div className="mt-10 grid gap-0 overflow-hidden rounded-lg border border-[#C8BEA8]/12 lg:grid-cols-[340px_1fr]">
          {/* LEFT: Queue Panel */}
          <aside className="border-b border-[#C8BEA8]/12 bg-[#0D0A05]/80 lg:border-b-0 lg:border-r">
            <header className="flex items-center justify-between border-b border-[#C8BEA8]/10 px-4 py-3">
              <h3 className="font-rg-serif text-lg text-[#F5EFE0]">Repair Queue</h3>
              <span className="font-rg-mono text-[10px] uppercase tracking-wider text-[#C8BEA8]/50">
                {items.length} queued
              </span>
            </header>
            <div className="flex flex-wrap gap-1.5 border-b border-[#C8BEA8]/8 px-4 py-2.5">
              {filterLabels.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setActiveFilter(label)}
                  className={`rounded-full px-2.5 py-1 font-rg-mono text-[10px] uppercase tracking-wider transition ${
                    activeFilter === label
                      ? "bg-[#C8A96E]/20 text-[#C8A96E] border border-[#C8A96E]/30"
                      : "text-[#C8BEA8]/50 border border-transparent hover:text-[#C8BEA8]/80"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <ol className="divide-y divide-[#C8BEA8]/6">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(item.id)}
                    className={`w-full px-4 py-3 text-left transition ${
                      activeId === item.id
                        ? "bg-[#C8A96E]/10 border-l-2 border-l-[#C8A96E]"
                        : item.severity === "deferred"
                          ? "opacity-50 hover:opacity-70"
                          : "hover:bg-[#C8BEA8]/5"
                    }`}
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider border ${severityClasses(item.severity)}`}>
                        {item.severity === "deferred" ? "Deferred" : item.severity}
                      </span>
                      {item.leverage && (
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider border ${leverageClasses(item.leverage)}`}>
                          {item.leverage}
                        </span>
                      )}
                      {decisions[item.id] && (
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider border ${decisionBadgeClass(decisions[item.id])}`}>
                          {decisionLabel(decisions[item.id])}
                        </span>
                      )}
                    </span>
                    <span className="mt-1.5 block text-sm text-[#F5EFE0]/90">{item.title}</span>
                    <span className="mt-0.5 block text-[11px] text-[#C8BEA8]/40">{item.meta}</span>
                  </button>
                </li>
              ))}
            </ol>
            <footer className="flex justify-between border-t border-[#C8BEA8]/10 px-4 py-2.5 text-[10px] text-[#C8BEA8]/40">
              <span>Accepted <strong className="text-[#C8BEA8]/70">{acceptedCount}</strong></span>
              <span>Rejected <strong className="text-[#C8BEA8]/70">{rejectedCount}</strong></span>
              <span>Custom <strong className="text-[#C8BEA8]/70">{customCount}</strong></span>
              <span>Pending <strong className="text-[#C8BEA8]/70">{pendingCount}</strong></span>
            </footer>
          </aside>

          {/* RIGHT: Detail Panel — driven by activeId */}
          <article className="bg-[#0D0A05]/60 p-6">
            <header>
              <p className="text-xs text-[#C8BEA8]/40">{active.context}</p>
              <h3 className="mt-1 font-rg-serif text-2xl text-[#F5EFE0]">
                {active.title}
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${severityClasses(active.severity)}`}>
                  {active.severity === "deferred" ? "Deferred" : active.severity}
                </span>
                {active.leverage && (
                  <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider border ${leverageClasses(active.leverage)}`}>
                    {active.leverage === "Spine" ? "Spine-critical" : active.leverage}
                  </span>
                )}
                <span className="rounded border border-[#C8BEA8]/15 px-2 py-0.5 text-[10px] text-[#C8BEA8]/50">{active.confidence}</span>
                {currentDecision && (
                  <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${decisionBadgeClass(currentDecision)}`}>
                    {decisionLabel(currentDecision)}
                  </span>
                )}
              </div>
            </header>

            {/* Evidence */}
            <section className="mt-6">
              <h4 className="font-rg-mono text-[10px] uppercase tracking-wider text-[#C8A96E]">Evidence</h4>
              <blockquote className="mt-2 border-l-2 border-[#C8A96E]/30 pl-3 text-sm italic text-[#F5EFE0]/80">
                {active.evidence.quote}
              </blockquote>
              <p className="mt-1 font-rg-mono text-[10px] text-[#C8BEA8]/30">{active.evidence.location}</p>
            </section>

            {/* 6-Part Diagnosis */}
            <dl className="mt-5 space-y-3">
              <div>
                <dt className="font-rg-mono text-[10px] uppercase tracking-wider text-[#C8A96E]">Symptom</dt>
                <dd className="mt-1 text-sm text-[#F5EFE0]/75">{active.symptom}</dd>
              </div>
              <div>
                <dt className="font-rg-mono text-[10px] uppercase tracking-wider text-[#C8A96E]">Cause</dt>
                <dd className="mt-1 text-sm text-[#F5EFE0]/75">{active.cause}</dd>
              </div>
              <div>
                <dt className="font-rg-mono text-[10px] uppercase tracking-wider text-[#C8A96E]">Fix direction</dt>
                <dd className="mt-1 text-sm text-[#F5EFE0]/75">{active.fix_direction}</dd>
              </div>
              <div>
                <dt className="font-rg-mono text-[10px] uppercase tracking-wider text-[#C8A96E]">Reader effect</dt>
                <dd className="mt-1 text-sm text-[#F5EFE0]/75">{active.reader_effect}</dd>
              </div>
              <div>
                <dt className="font-rg-mono text-[10px] uppercase tracking-wider text-[#C8A96E]">Mistake-proofing</dt>
                <dd className="mt-1 text-sm text-[#F5EFE0]/75">{active.mistake_proofing}</dd>
              </div>
            </dl>

            {/* A/B/C Proposals */}
            <section className="mt-6">
              <h4 className="font-rg-mono text-[10px] uppercase tracking-wider text-[#C8A96E]">Three structurally distinct proposals</h4>
              <div className="mt-3 space-y-3">
                {active.proposals.map((p) => {
                  const isSelected = currentProposal === p.label;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setSelectedProposal((prev) => ({ ...prev, [activeId]: p.label }))}
                      className={`w-full rounded border p-4 text-left transition ${
                        isSelected
                          ? "border-[#C8A96E]/40 bg-[#C8A96E]/10"
                          : "border-[#C8BEA8]/12 bg-[#1A1208]/60 hover:border-[#C8BEA8]/25"
                      }`}
                    >
                      <header className="flex items-baseline gap-2">
                        <span className={`font-rg-mono text-sm font-bold ${isSelected ? "text-[#C8A96E]" : "text-[#C8BEA8]/70"}`}>
                          {p.label}
                        </span>
                        <span className="text-xs text-[#C8BEA8]/50">{p.mechanism}</span>
                        {isSelected && (
                          <span className="ml-auto rounded bg-[#C8A96E]/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#C8A96E]">
                            Selected
                          </span>
                        )}
                      </header>
                      <pre className="mt-2 whitespace-pre-wrap font-rg-mono text-sm text-[#F5EFE0]/85">
                        {p.lines.join("\n")}
                      </pre>
                      <p className="mt-2 text-xs text-[#C8BEA8]/50">{p.rationale}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Author Controls */}
            <section className="mt-6">
              <div className="flex flex-wrap gap-2">
                {([
                  ["accepted", "Accept selected"],
                  ["kept", "Keep original"],
                  ["rejected", "Reject all three"],
                  ["custom", "Write custom"],
                  ["deferred", "Defer"],
                ] as [Decision, string][]).map(([decision, label]) => {
                  const isActive = currentDecision === decision;
                  return (
                    <button
                      key={decision}
                      type="button"
                      onClick={() => handleDecision(decision)}
                      className={`rounded border px-4 py-2 font-rg-mono text-[10px] uppercase tracking-wider transition ${
                        isActive
                          ? "border-[#C8A96E] bg-[#C8A96E] text-[#0D0A05]"
                          : decision === "accepted" && !currentDecision
                            ? "border-[#C8A96E] bg-[#C8A96E] text-[#0D0A05] hover:bg-transparent hover:text-[#C8A96E]"
                            : "border-[#C8BEA8]/25 text-[#C8BEA8]/70 hover:border-[#C8A96E] hover:text-[#C8A96E]"
                      }`}
                    >
                      {isActive ? `\u2713 ${label}` : label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Voice note */}
            <footer className="mt-5 flex items-start gap-2 rounded border border-green-800/30 bg-green-900/15 px-3 py-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0 text-green-400">
                <path d="M3 8.5 L6.5 12 L13 4.5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span className="text-xs text-green-300/70">
                Voice-preservation gate passed for all three. Quoted manuscript text remains byte-for-byte unchanged unless you accept a proposal.
              </span>
            </footer>
          </article>
        </div>
      </div>
    </section>
  );
}

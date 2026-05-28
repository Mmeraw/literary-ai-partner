"use client";

import { useState } from "react";

type QueueItem = {
  id: number;
  severity: "must" | "should" | "could" | "deferred";
  leverage: string;
  title: string;
  meta: string;
};

const queueItems: QueueItem[] = [
  {
    id: 1,
    severity: "must",
    leverage: "Spine",
    title: "Abstract phrasing weakens river-scene tension",
    meta: "Dialogue \u00b7 Ch.\u00a011 \u00b7 evidence anchored",
  },
  {
    id: 2,
    severity: "must",
    leverage: "High",
    title: "Internal monologue duplicates dialogue subtext",
    meta: "Pacing \u00b7 Ch.\u00a011",
  },
  {
    id: 3,
    severity: "should",
    leverage: "Medium",
    title: "Promise opened in Ch.\u00a04 still unresolved at midpoint",
    meta: "Narrative closure \u00b7 cross-chapter",
  },
  {
    id: 4,
    severity: "should",
    leverage: "Medium",
    title: "Pressure plateaus across chapters 12\u201314",
    meta: "Pacing \u00b7 3 chapters",
  },
  {
    id: 5,
    severity: "could",
    leverage: "Local",
    title: "Filtered perception softens close-third POV",
    meta: "Voice \u00b7 Ch.\u00a011, p.\u00a0132",
  },
  {
    id: 6,
    severity: "could",
    leverage: "Local",
    title: "Adverb stack thins on key reassurance line",
    meta: "Prose control \u00b7 Ch.\u00a011",
  },
  {
    id: 7,
    severity: "deferred",
    leverage: "",
    title: "Thematic propagation thin in Act II",
    meta: "Long-form continuity \u00b7 revisit after evaluation",
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

export default function ReviseQueueDemo() {
  const [activeId, setActiveId] = useState(1);
  const [activeFilter, setActiveFilter] = useState("All");

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

        <div className="mt-4 inline-flex items-center gap-2 rounded border border-[#C8A96E]/25 bg-[#C8A96E]/10 px-3 py-1.5">
          <span className="font-rg-mono text-[10px] uppercase tracking-wider text-[#C8A96E]">Example preview</span>
          <span className="text-xs text-[#C8BEA8]/60">{"\u2014"} this is sample data, not your manuscript</span>
        </div>

        <div className="mt-10 grid gap-0 overflow-hidden rounded-lg border border-[#C8BEA8]/12 lg:grid-cols-[340px_1fr]">
          {/* LEFT: Queue Panel */}
          <aside className="border-b border-[#C8BEA8]/12 bg-[#0D0A05]/80 lg:border-b-0 lg:border-r">
            <header className="flex items-center justify-between border-b border-[#C8BEA8]/10 px-4 py-3">
              <h3 className="font-rg-serif text-lg text-[#F5EFE0]">Repair Queue</h3>
              <span className="font-rg-mono text-[10px] uppercase tracking-wider text-[#C8BEA8]/50">
                7 queued
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
              {queueItems.map((item) => (
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
                    <span className="flex flex-wrap gap-1.5">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider border ${severityClasses(item.severity)}`}>
                        {item.severity === "deferred" ? "Deferred" : item.severity}
                      </span>
                      {item.leverage && (
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider border ${leverageClasses(item.leverage)}`}>
                          {item.leverage}
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
              <span>Accepted <strong className="text-[#C8BEA8]/70">2</strong></span>
              <span>Rejected <strong className="text-[#C8BEA8]/70">1</strong></span>
              <span>Custom <strong className="text-[#C8BEA8]/70">0</strong></span>
              <span>Pending <strong className="text-[#C8BEA8]/70">4</strong></span>
            </footer>
          </aside>

          {/* RIGHT: Detail Panel */}
          <article className="bg-[#0D0A05]/60 p-6">
            <header>
              <p className="text-xs text-[#C8BEA8]/40">Dialogue {"\u00b7"} Chapter 11 {"\u00b7"} river scene</p>
              <h3 className="mt-1 font-rg-serif text-2xl text-[#F5EFE0]">
                Abstract phrasing weakens river-scene tension
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${severityClasses("must")}`}>Must</span>
                <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider border ${leverageClasses("Spine")}`}>Spine-critical</span>
                <span className="rounded border border-[#C8BEA8]/15 px-2 py-0.5 text-[10px] text-[#C8BEA8]/50">Moderate confidence</span>
              </div>
            </header>

            {/* Evidence */}
            <section className="mt-6">
              <h4 className="font-rg-mono text-[10px] uppercase tracking-wider text-[#C8A96E]">Evidence</h4>
              <blockquote className="mt-2 border-l-2 border-[#C8A96E]/30 pl-3 text-sm italic text-[#F5EFE0]/80">
                <span className="text-[#C8A96E]">&ldquo;</span>It&rsquo;s okay,<span className="text-[#C8A96E]">&rdquo;</span>{" "}
                I whispered. But even as I said it, I knew it wasn&rsquo;t okay.
              </blockquote>
              <p className="mt-1 font-rg-mono text-[10px] text-[#C8BEA8]/30">char 1247{"\u2013"}1330 {"\u00b7"} Chapter 11 {"\u00b7"} river scene</p>
            </section>

            {/* 6-Part Diagnosis */}
            <dl className="mt-5 space-y-3">
              <div>
                <dt className="font-rg-mono text-[10px] uppercase tracking-wider text-[#C8A96E]">Symptom</dt>
                <dd className="mt-1 text-sm text-[#F5EFE0]/75">Emotional contradiction is stated directly instead of dramatized.</dd>
              </div>
              <div>
                <dt className="font-rg-mono text-[10px] uppercase tracking-wider text-[#C8A96E]">Cause</dt>
                <dd className="mt-1 text-sm text-[#F5EFE0]/75">Internal realization duplicates what the dialogue already implies, flattening the moment into commentary.</dd>
              </div>
              <div>
                <dt className="font-rg-mono text-[10px] uppercase tracking-wider text-[#C8A96E]">Fix direction</dt>
                <dd className="mt-1 text-sm text-[#F5EFE0]/75">Replace internal explanation with a physical hesitation or interruption beat.</dd>
              </div>
              <div>
                <dt className="font-rg-mono text-[10px] uppercase tracking-wider text-[#C8A96E]">Reader effect</dt>
                <dd className="mt-1 text-sm text-[#F5EFE0]/75">Tension escalates instead of pausing for narrator gloss.</dd>
              </div>
              <div>
                <dt className="font-rg-mono text-[10px] uppercase tracking-wider text-[#C8A96E]">Mistake-proofing</dt>
                <dd className="mt-1 text-sm text-[#F5EFE0]/75">Preserve the speaker&rsquo;s voice and the dialogue&rsquo;s rhythm. Do not introduce new information about the river or the listener&rsquo;s reaction.</dd>
              </div>
            </dl>

            {/* A/B/C Proposals */}
            <section className="mt-6">
              <h4 className="font-rg-mono text-[10px] uppercase tracking-wider text-[#C8A96E]">Three structurally distinct proposals</h4>
              <div className="mt-3 space-y-3">
                <article className="rounded border border-[#C8A96E]/20 bg-[#C8A96E]/5 p-4">
                  <header className="flex items-baseline gap-2">
                    <span className="font-rg-mono text-sm font-bold text-[#C8A96E]">A</span>
                    <span className="text-xs text-[#C8BEA8]/50">Action-beat substitution</span>
                  </header>
                  <pre className="mt-2 whitespace-pre-wrap font-rg-mono text-sm text-[#F5EFE0]/85">&ldquo;It&rsquo;s okay,&rdquo; I whispered.{"\n"}The lie caught halfway out.</pre>
                  <p className="mt-2 text-xs text-[#C8BEA8]/50">Replaces internal gloss with a physical reaction; voice fingerprint preserved.</p>
                </article>
                <article className="rounded border border-[#C8BEA8]/12 bg-[#1A1208]/60 p-4">
                  <header className="flex items-baseline gap-2">
                    <span className="font-rg-mono text-sm font-bold text-[#C8BEA8]/70">B</span>
                    <span className="text-xs text-[#C8BEA8]/50">Interruption beat</span>
                  </header>
                  <pre className="mt-2 whitespace-pre-wrap font-rg-mono text-sm text-[#F5EFE0]/85">&ldquo;It&rsquo;s okay{"\u2014"}&rdquo;{"\n"}My voice cracked before I could finish.</pre>
                  <p className="mt-2 text-xs text-[#C8BEA8]/50">Cuts the reassurance mid-line so the failure is heard, not narrated.</p>
                </article>
                <article className="rounded border border-[#C8BEA8]/12 bg-[#1A1208]/60 p-4">
                  <header className="flex items-baseline gap-2">
                    <span className="font-rg-mono text-sm font-bold text-[#C8BEA8]/70">C</span>
                    <span className="text-xs text-[#C8BEA8]/50">Rendering shift</span>
                  </header>
                  <pre className="mt-2 whitespace-pre-wrap font-rg-mono text-sm text-[#F5EFE0]/85">&ldquo;It&rsquo;s okay.&rdquo;{"\n"}She looked at me long enough to know I didn&rsquo;t believe it.</pre>
                  <p className="mt-2 text-xs text-[#C8BEA8]/50">Lets the listener carry the contradiction; closes the scene with weight.</p>
                </article>
              </div>
            </section>

            {/* Author Controls */}
            <section className="mt-6">
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded border border-[#C8A96E] bg-[#C8A96E] px-4 py-2 font-rg-mono text-[10px] uppercase tracking-wider text-[#0D0A05] transition hover:bg-transparent hover:text-[#C8A96E]">
                  Accept selected
                </button>
                <button type="button" className="rounded border border-[#C8BEA8]/25 px-4 py-2 font-rg-mono text-[10px] uppercase tracking-wider text-[#C8BEA8]/70 transition hover:border-[#C8A96E] hover:text-[#C8A96E]">
                  Keep original
                </button>
                <button type="button" className="rounded border border-[#C8BEA8]/25 px-4 py-2 font-rg-mono text-[10px] uppercase tracking-wider text-[#C8BEA8]/70 transition hover:border-[#C8A96E] hover:text-[#C8A96E]">
                  Reject all three
                </button>
                <button type="button" className="rounded border border-[#C8BEA8]/25 px-4 py-2 font-rg-mono text-[10px] uppercase tracking-wider text-[#C8BEA8]/70 transition hover:border-[#C8A96E] hover:text-[#C8A96E]">
                  Write custom
                </button>
                <button type="button" className="rounded border border-[#C8BEA8]/25 px-4 py-2 font-rg-mono text-[10px] uppercase tracking-wider text-[#C8BEA8]/70 transition hover:border-[#C8A96E] hover:text-[#C8A96E]">
                  Defer
                </button>
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

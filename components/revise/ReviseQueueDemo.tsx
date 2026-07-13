"use client";

import { useState } from "react";

type DemoCard = "copy" | "strategy" | "held";

const copyCandidates = [
  {
    key: "A",
    label: "Recommended repair",
    text: "Below them, the river carried a long sheet of grey toward the bend.",
    note: "The strongest faithful local repair and the governed default for TrustedPath™.",
  },
  {
    key: "B",
    label: "Rhythm variant",
    text: "The river slid below them—grey, long, and unbroken to the bend.",
    note: "Solves the same diagnosis with a more musical cadence.",
  },
  {
    key: "C",
    label: "Bolder rendering shift",
    text: "Far below, the river dragged its grey skin around the bend.",
    note: "A more assertive image that remains valid within the passage.",
  },
] as const;

const tabs: { key: DemoCard; label: string; caption: string }[] = [
  { key: "copy", label: "Copy-Paste", caption: "Executable A/B/C" },
  { key: "strategy", label: "Strategy", caption: "One guided plan" },
  { key: "held", label: "Held", caption: "Recovery guidance" },
];

function CardHeader({ eyebrow, title, badge }: { eyebrow: string; title: string; badge: string }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-rg-cream2/10 pb-5">
      <div>
        <p className="font-rg-mono text-[0.68rem] uppercase tracking-[0.18em] text-rg-gold">{eyebrow}</p>
        <h3 className="mt-2 font-rg-serif text-3xl text-rg-cream">{title}</h3>
      </div>
      <span className="border border-rg-gold/30 px-3 py-1 font-rg-mono text-[0.62rem] uppercase tracking-[0.14em] text-rg-gold">{badge}</span>
    </header>
  );
}

function CopyPasteDemo() {
  const [selected, setSelected] = useState<"A" | "B" | "C">("A");
  return (
    <article data-testid="revise-demo-copy-paste" className="border border-rg-gold/30 bg-rg-ink2/80 p-5 md:p-7">
      <CardHeader eyebrow="Copy-Paste Rewrite" title="Choose one executable revision" badge="Trusted Path eligible" />

      <div className="mt-6 border border-rg-cream2/10 bg-rg-ink/70 p-4">
        <p className="font-rg-mono text-[0.62rem] uppercase tracking-[0.14em] text-rg-cream2/55">Original passage</p>
        <p className="mt-3 font-rg-serif text-xl leading-8 text-rg-cream2">The river moved below them in a long sheet of grey.</p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3" role="radiogroup" aria-label="Copy-paste revision candidates">
        {copyCandidates.map((candidate) => {
          const isSelected = selected === candidate.key;
          return (
            <button
              key={candidate.key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(candidate.key)}
              className={`flex min-h-full flex-col border p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rg-gold ${isSelected ? "border-rg-gold bg-rg-gold/10" : "border-rg-cream2/15 bg-rg-ink/60 hover:border-rg-gold/50"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-rg-mono text-xs uppercase tracking-[0.16em] text-rg-gold">{candidate.key} — {candidate.label}</p>
                {candidate.key === "A" && <span className="border border-rg-gold/35 px-2 py-0.5 font-rg-mono text-[0.58rem] uppercase tracking-[0.12em] text-rg-gold">Recommended</span>}
                {isSelected && <span className="border border-rg-cream2/25 px-2 py-0.5 font-rg-mono text-[0.58rem] uppercase tracking-[0.12em] text-rg-cream">Selected</span>}
              </div>
              <p className="mt-5 flex-1 font-rg-serif text-xl leading-8 text-rg-cream">{candidate.text}</p>
              <p className="mt-5 text-sm leading-6 text-rg-cream2/65">{candidate.note}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="rg-revise-cta font-rg-mono text-xs uppercase tracking-[0.16em]">Accept {selected}</button>
        <button type="button" className="border border-rg-cream2/25 px-4 py-2 font-rg-mono text-xs uppercase tracking-[0.14em] text-rg-cream2">Keep original</button>
        <button type="button" className="border border-rg-cream2/25 px-4 py-2 font-rg-mono text-xs uppercase tracking-[0.14em] text-rg-cream2">Custom rewrite</button>
      </div>
    </article>
  );
}

function StrategyDemo() {
  return (
    <article data-testid="revise-demo-strategy" className="border border-rg-gold/25 bg-rg-ink2/80 p-5 md:p-7">
      <CardHeader eyebrow="Revision Strategy" title="Redistribute the ledger promise across Act II" badge="Author review required" />
      <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="border border-rg-cream2/12 bg-rg-ink/65 p-5">
          <p className="font-rg-mono text-[0.65rem] uppercase tracking-[0.16em] text-rg-gold">Recommended strategy</p>
          <p className="mt-4 text-lg leading-8 text-rg-cream">Seed two brief callbacks between Chapters 7 and 11 so the ledger promise remains active without resolving it early.</p>
          <p className="mt-5 text-sm leading-7 text-rg-cream2/65">A direct copy-paste replacement would be unsafe because the repair spans multiple scenes and depends on where later revelations land.</p>
        </section>
        <section className="border border-rg-cream2/12 bg-rg-ink/65 p-5">
          <p className="font-rg-mono text-[0.65rem] uppercase tracking-[0.16em] text-rg-gold">Implementation sequence</p>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-rg-cream2/80">
            <li>1. Choose two scenes already carrying river imagery.</li>
            <li>2. Add one dialogue callback and one environmental echo.</li>
            <li>3. Preserve uncertainty; do not reveal the ledger contents.</li>
            <li>4. Re-read the Act II arc for repetition or over-signalling.</li>
          </ol>
        </section>
      </div>
      <div className="mt-5 border border-rg-cream2/12 bg-rg-ink/65 p-5">
        <p className="font-rg-mono text-[0.65rem] uppercase tracking-[0.16em] text-rg-gold">Author decision required</p>
        <p className="mt-3 leading-7 text-rg-cream2/80">Decide whether the callbacks should increase dread, reinforce character memory, or point toward the later discovery.</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="border border-rg-gold/45 px-4 py-2 font-rg-mono text-xs uppercase tracking-[0.14em] text-rg-gold">Add custom plan</button>
        <button type="button" className="border border-rg-cream2/25 px-4 py-2 font-rg-mono text-xs uppercase tracking-[0.14em] text-rg-cream2">Defer</button>
        <button type="button" className="border border-rg-cream2/25 px-4 py-2 font-rg-mono text-xs uppercase tracking-[0.14em] text-rg-cream2">Request re-analysis</button>
      </div>
    </article>
  );
}

function HeldDemo() {
  return (
    <article data-testid="revise-demo-held" className="border border-red-900/55 bg-rg-ink2/80 p-5 md:p-7">
      <CardHeader eyebrow="Held Item" title="The relationship reference cannot be verified" badge="Not interactive" />
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <section className="border border-red-900/35 bg-red-950/10 p-5"><p className="font-rg-mono text-[0.65rem] uppercase tracking-[0.16em] text-red-300">Why this was held</p><p className="mt-4 text-sm leading-7 text-rg-cream2/75">The available evidence conflicts with the manuscript relationship timeline.</p></section>
        <section className="border border-rg-cream2/12 bg-rg-ink/65 p-5"><p className="font-rg-mono text-[0.65rem] uppercase tracking-[0.16em] text-rg-gold">Missing context</p><p className="mt-4 text-sm leading-7 text-rg-cream2/75">A confirmed relationship timeline and the surrounding scene transition.</p></section>
        <section className="border border-rg-cream2/12 bg-rg-ink/65 p-5"><p className="font-rg-mono text-[0.65rem] uppercase tracking-[0.16em] text-rg-gold">How to recover it</p><p className="mt-4 text-sm leading-7 text-rg-cream2/75">Confirm the timeline, then request re-analysis. No candidate prose is generated while the conflict remains.</p></section>
      </div>
      <div className="mt-5"><button type="button" className="border border-rg-gold/45 px-4 py-2 font-rg-mono text-xs uppercase tracking-[0.14em] text-rg-gold">Request re-analysis</button></div>
    </article>
  );
}

export default function ReviseQueueDemo() {
  const [active, setActive] = useState<DemoCard>("copy");
  return (
    <section id="revise-demo" className="border-y border-rg-cream2/10 bg-rg-ink/95">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Interactive contract demo</p>
        <h2 className="mt-4 max-w-4xl font-rg-serif text-4xl leading-tight text-rg-cream md:text-5xl">Three card types. Three honest interaction models.</h2>
        <p className="mt-5 max-w-3xl leading-8 text-rg-cream2/75">Switch between the surfaces below. A/B/C appears only when all three options are complete, distinct, and safe to execute.</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3" role="tablist" aria-label="Revise card type demo">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active === tab.key}
              onClick={() => setActive(tab.key)}
              className={`border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rg-gold ${active === tab.key ? "border-rg-gold bg-rg-gold/10" : "border-rg-cream2/15 bg-rg-ink2/55 hover:border-rg-gold/45"}`}
            >
              <span className="block font-rg-serif text-2xl text-rg-cream">{tab.label}</span>
              <span className="mt-1 block font-rg-mono text-[0.62rem] uppercase tracking-[0.14em] text-rg-cream2/55">{tab.caption}</span>
            </button>
          ))}
        </div>

        <div className="mt-6" role="tabpanel">
          {active === "copy" && <CopyPasteDemo />}
          {active === "strategy" && <StrategyDemo />}
          {active === "held" && <HeldDemo />}
        </div>
      </div>
    </section>
  );
}

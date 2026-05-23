import Link from "next/link";

const pillars = [
  { title: "The Instrument", copy: "The visible report surface: criteria, evidence, confidence, and revision priorities that an author can read and act on." },
  { title: "The Engine", copy: "The governed execution layer: routing, long-form handling, quality gates, failure states, and deterministic handoff semantics." },
  { title: "The Methodology", copy: "The public explanation layer: enough transparency to build trust without exposing proprietary prompts or weakening the system." },
];

const guarantees = [
  "Public pages live inside the same app shell as product routes.",
  "Navigation uses routes, not dead document anchors.",
  "Protected workflows remain gated behind auth.",
  "The author-facing promise is aligned with the governed backend model.",
];

export default function ReliabilityPage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto max-w-7xl px-6 py-20">
        <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Reliability</p>
        <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-tight md:text-6xl">Trust is the product architecture, not a marketing slogan.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-rg-cream2/80">RevisionGrade needs a first-class reliability page because authors are being asked to upload serious manuscripts. The page explains how the instrument, engine, and methodology fit together.</p>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {pillars.map((pillar) => <article key={pillar.title} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6"><h2 className="font-rg-serif text-3xl text-rg-cream">{pillar.title}</h2><p className="mt-4 leading-7 text-rg-cream2/75">{pillar.copy}</p></article>)}
        </div>
      </section>
      <section className="bg-rg-cream text-rg-ink">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr]">
          <div><p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Reliability doctrine</p><h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">A coherent user journey is a trust feature.</h2></div>
          <div className="grid gap-3 sm:grid-cols-2">{guarantees.map((item) => <div key={item} className="border border-rg-ink/15 bg-white/40 p-4 text-sm leading-7 text-rg-ink/75">{item}</div>)}</div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-20"><div className="border border-rg-gold/35 bg-rg-ink2/60 p-8"><h2 className="font-rg-serif text-4xl">Reliability connects to methodology.</h2><p className="mt-5 max-w-3xl leading-8 text-rg-cream2/75">The public methodology page should explain what the system evaluates, while Reliability explains why users can trust the routed product surface they are navigating.</p><Link href="/methodology" className="mt-7 inline-block font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">Read methodology →</Link></div></section>
    </div>
  );
}

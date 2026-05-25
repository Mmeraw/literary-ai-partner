import Link from "next/link";

const methods = [
  { title: "Criteria-led reading", copy: "The manuscript is read through stable editorial criteria so feedback is not a random chat response or a matter of taste alone." },
  { title: "Evidence before verdict", copy: "Major findings should be traceable to the submitted pages and explained in terms the author can act on." },
  { title: "Long-form continuity", copy: "Novel-length work requires attention to recurrence, payoff, pacing, character behavior, and cumulative reader experience." },
  { title: "Revision restraint", copy: "A recommendation is not automatically an instruction to rewrite. Some passages should be protected, not compressed." },
];

const modes = [
  { title: "Short-Form Evaluation", range: "Under 25,000 words", copy: "Evaluates the submitted pages against the 13 story criteria only. Designed for openings, chapters, excerpts, short stories, and shorter works where full manuscript continuity cannot yet be judged." },
  { title: "Long-Form Evaluation", range: "25,000+ words", copy: "Adds manuscript-scale analysis: continuity, recurrence, setup/payoff, pacing over distance, character behavior, structural readiness, and cumulative reader experience." },
  { title: "Long-Form Multi-Layer Evaluation", range: "Complex long-form manuscripts", copy: "A deeper architecture audit for manuscripts that need layered story ledgers, Golden Spine/WAVE governance, long-form canon/gates, dialogue and speech protection, and deeper continuity analysis." },
];

const criteria = ["Concept", "Narrative Drive", "Character", "Voice", "Scene Construction", "Dialogue", "Theme", "Worldbuilding", "Pacing", "Prose Control", "Tone", "Narrative Closure", "Marketability"];

export default function MethodologyPage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto max-w-7xl px-6 py-20">
        <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Methodology</p>
        <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-tight md:text-6xl">How RevisionGrade thinks about manuscripts.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-rg-cream2/80">RevisionGrade evaluates manuscripts through stable criteria, evidence-backed diagnosis, and revision restraint. The goal is not generic feedback. The goal is to identify what the manuscript asks the reader to believe, where that trust holds, and where it breaks.</p>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {methods.map((item) => <article key={item.title} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6"><h2 className="font-rg-serif text-3xl">{item.title}</h2><p className="mt-4 leading-7 text-rg-cream2/75">{item.copy}</p></article>)}
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Evaluation Modes</p>
          <h2 className="mt-4 max-w-4xl font-rg-serif text-4xl leading-tight md:text-5xl">Different manuscript lengths require different diagnostic depth.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {modes.map((mode) => <article key={mode.title} className="border border-rg-cream2/12 bg-rg-ink/60 p-6"><p className="font-rg-mono text-[0.68rem] uppercase tracking-[0.18em] text-rg-gold">{mode.range}</p><h3 className="mt-3 font-rg-serif text-2xl text-rg-cream">{mode.title}</h3><p className="mt-4 text-sm leading-7 text-rg-cream2/75">{mode.copy}</p></article>)}
          </div>
        </div>
      </section>

      <section className="bg-rg-cream text-rg-ink">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr]">
          <div><p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Thirteen Story Criteria</p><h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">The core evaluation language stays stable.</h2></div>
          <div className="grid gap-2 sm:grid-cols-2">{criteria.map((item) => <div key={item} className="border border-rg-ink/15 bg-white/45 px-4 py-3 font-rg-mono text-[0.68rem] uppercase tracking-[0.12em] text-rg-ink/80">{item}</div>)}</div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="border border-rg-gold/35 bg-rg-ink2/60 p-8"><h2 className="font-rg-serif text-4xl">From diagnosis to governed revision.</h2><p className="mt-5 max-w-3xl leading-8 text-rg-cream2/75">Evaluation identifies the weakness. Revise turns the weakness into a governed repair opportunity: evidence, diagnosis, options, voice risk, and explicit author decision.</p><div className="mt-7 flex flex-wrap gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]"><Link href="/reliability" className="text-rg-gold hover:text-rg-cream">Reliability →</Link><Link href="/revise" className="text-rg-gold hover:text-rg-cream">Revise →</Link><Link href="/evaluate" className="text-rg-gold hover:text-rg-cream">Evaluate →</Link></div></div>
      </section>
    </div>
  );
}

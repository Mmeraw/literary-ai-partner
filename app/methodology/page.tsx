import Link from "next/link";

const methods = [
  { title: "Criteria-led reading", copy: "The manuscript is read through a stable set of literary criteria so feedback is not a random chat response." },
  { title: "Evidence before verdict", copy: "Findings should be traceable to the manuscript and explained in terms the author can understand." },
  { title: "Long-form continuity", copy: "Novel-length work requires attention to recurrence, payoff, pacing, character behavior, and cumulative reader experience." },
  { title: "Revision restraint", copy: "A recommendation is not automatically an instruction to rewrite. Some passages should be protected, not compressed." },
];

export default function MethodologyPage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto max-w-7xl px-6 py-20">
        <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Methodology</p>
        <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-tight md:text-6xl">How RevisionGrade thinks about manuscripts.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-rg-cream2/80">This public methodology route explains the editorial model at a useful level without exposing proprietary implementation internals.</p>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {methods.map((item) => <article key={item.title} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6"><h2 className="font-rg-serif text-3xl">{item.title}</h2><p className="mt-4 leading-7 text-rg-cream2/75">{item.copy}</p></article>)}
        </div>
        <div className="mt-12 flex flex-wrap gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]"><Link href="/reliability" className="text-rg-gold hover:text-rg-cream">Reliability →</Link><Link href="/resources" className="text-rg-gold hover:text-rg-cream">Resources →</Link><Link href="/evaluate" className="text-rg-gold hover:text-rg-cream">Evaluate →</Link></div>
      </section>
    </div>
  );
}

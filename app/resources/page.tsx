import Link from "next/link";

const faqs = [
  { q: "What does RevisionGrade evaluate?", a: "RevisionGrade evaluates manuscript-level craft and market readiness across thirteen literary criteria, including concept, narrative drive, character, voice, dialogue, pacing, prose control, and marketability." },
  { q: "Is this only a score?", a: "No. The score is only useful when it is connected to evidence, confidence, and revision priorities. The product goal is diagnosis plus a path to repair." },
  { q: "What happens after evaluation?", a: "Findings should become a queue of revision opportunities. That queue is the bridge between Evaluate and Revise." },
  { q: "Does the system rewrite my voice?", a: "The Revise layer is framed around voice protection. Zero compression is a valid outcome when a passage should be preserved." },
  { q: "Why does long-form fiction need special handling?", a: "A novel is not a bundle of isolated pages. Character continuity, pacing, theme, scene function, and payoff depend on long-range context." },
  { q: "Is RevisionGrade in private beta?", a: "Yes. The public pages explain the product surface while protected routes preserve the app workflow and evaluation infrastructure." },
];

export default function ResourcesPage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Resources</p>
        <h1 className="mt-6 max-w-4xl font-rg-serif text-5xl leading-tight md:text-6xl">FAQ++ for authors evaluating a serious manuscript.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-rg-cream2/80">This page replaces the dead static Resources anchor with a real route for product explanation, author questions, and trust-building documentation.</p>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {faqs.map((item) => <article key={item.q} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6"><h2 className="font-rg-serif text-2xl text-rg-cream">{item.q}</h2><p className="mt-4 leading-7 text-rg-cream2/75">{item.a}</p></article>)}
        </div>
        <div className="mt-12 flex flex-wrap gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]"><Link href="/methodology" className="text-rg-gold hover:text-rg-cream">Methodology →</Link><Link href="/reliability" className="text-rg-gold hover:text-rg-cream">Reliability →</Link><Link href="/evaluate" className="text-rg-gold hover:text-rg-cream">Evaluate →</Link></div>
      </section>
    </div>
  );
}

import Link from "next/link";

const resourceCards = [
  {
    title: "The Black Box Problem",
    href: "/black-box-problem",
    copy: "Why writers need diagnosis before submission: publishing gives verdicts, not explanations.",
  },
  {
    title: "Methodology",
    href: "/methodology",
    copy: "How RevisionGrade evaluates manuscripts through criteria, evidence, evaluation depth, and revision restraint.",
  },
  {
    title: "Reliability / Editorial Doctrine",
    href: "/reliability",
    copy: "Why author control, manuscript sovereignty, evidence, and scope discipline are built into the process.",
  },
  {
    title: "Pricing Doctrine",
    href: "/pricing",
    copy: "Fixed-price readiness audit first. Metered, governed repair only after the diagnosis is clear.",
  },
  {
    title: "Agent Readiness™",
    href: "/agent-readiness",
    copy: "Build manuscript submission materials: query letter, synopsis, query pitch, comparables, and author bio.",
  },
  {
    title: "Storygate Studio™",
    href: "/storygate-studio",
    copy: "Controlled manuscript discovery for readiness-vetted projects and verified publishing professionals.",
  },
];

const faqs = [
  {
    q: "What does RevisionGrade evaluate?",
    a: "RevisionGrade evaluates manuscript-level craft, structure, reader trust, and readiness across thirteen story criteria. Longer manuscripts may also qualify for long-form or multi-layer analysis.",
  },
  {
    q: "Is this only a score?",
    a: "No. A score is only useful when connected to evidence, confidence, issue severity, and revision priorities. RevisionGrade is designed to produce diagnosis, not just a number.",
  },
  {
    q: "What are the evaluation modes?",
    a: "Short-form evaluations cover submissions under 25,000 words and use the 13 story criteria only. Long-form evaluations begin at 25,000+ words and add manuscript-scale continuity. Long-form multi-layer evaluations add deeper architecture, story-ledger, Golden Spine/WAVE, and governance analysis where appropriate.",
  },
  {
    q: "Does RevisionGrade rewrite my voice?",
    a: "No. Revise is built around voice protection and author control. Some passages should be repaired; others should be preserved. A recommendation is not an instruction to flatten the prose.",
  },
  {
    q: "Does RevisionGrade replace human editors?",
    a: "No. RevisionGrade solves a different problem: ungoverned editing, scope confusion, and opaque diagnosis. It helps distinguish structural repair, line polish, market positioning, and voice protection before the author spends money on the wrong intervention.",
  },
  {
    q: "Does RevisionGrade guarantee publication or representation?",
    a: "No. RevisionGrade diagnoses manuscript readiness. It does not guarantee agent interest, representation, publication, sales, market timing, or commercial demand.",
  },
];

export default function ResourcesPage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto max-w-7xl px-6 py-20">
        <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Resources</p>
        <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-tight md:text-6xl">
          Resources for serious manuscript evaluation.
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-rg-cream2/80">
          Learn how RevisionGrade separates manuscript readiness from market rejection, evaluates long-form prose, protects author control, and turns diagnosis into revision decisions.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resourceCards.map((item) => (
            <Link key={item.title} href={item.href} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6 transition hover:border-rg-gold/70">
              <h2 className="font-rg-serif text-2xl text-rg-cream">{item.title}</h2>
              <p className="mt-4 leading-7 text-rg-cream2/75">{item.copy}</p>
              <p className="mt-5 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold">Open →</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Author FAQ</p>
          <h2 className="mt-4 max-w-4xl font-rg-serif text-4xl leading-tight md:text-5xl">
            Practical answers before you evaluate.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {faqs.map((item) => (
              <article key={item.q} className="border border-rg-cream2/12 bg-rg-ink/60 p-6">
                <h3 className="font-rg-serif text-2xl text-rg-cream">{item.q}</h3>
                <p className="mt-4 leading-7 text-rg-cream2/75">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Start with diagnosis</p>
        <h2 className="mt-5 font-rg-serif text-4xl leading-tight md:text-5xl">
          Before you submit, know where the manuscript stands.
        </h2>
        <div className="mt-10 flex flex-wrap justify-center gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]">
          <Link href="/evaluate" className="border border-rg-gold bg-rg-gold px-5 py-3 text-rg-ink transition hover:bg-transparent hover:text-rg-gold">Begin Evaluation</Link>
          <Link href="/black-box-problem" className="border border-rg-cream2/30 px-5 py-3 text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">Read the Black Box Problem</Link>
        </div>
      </section>
    </div>
  );
}

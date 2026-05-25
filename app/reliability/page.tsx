import Link from "next/link";

const pillars = [
  { title: "Manuscript Sovereignty", copy: "Your manuscript remains your creative property. RevisionGrade evaluates submitted text to produce editorial diagnosis and revision options; it does not claim authorship or replace the writer’s judgment." },
  { title: "Evidence Before Authority", copy: "Findings should be traceable to the manuscript. A score or recommendation is not useful unless it is tied to evidence, severity, and reader effect." },
  { title: "Author-in-the-Loop", copy: "No proposed repair becomes final authorial text without author choice. The author may accept, reject, defer, keep original, or write a custom revision." },
  { title: "Scope Discipline", copy: "RevisionGrade distinguishes structural diagnosis, scene repair, line polish, market positioning, and voice protection before recommending intervention." },
];

const guarantees = [
  "Your manuscript remains your intellectual property.",
  "Your work is evaluated as private creative work, not as public material.",
  "Your manuscript is not routed to anonymous human editors as part of the standard audit.",
  "Evidence, not authority: RevisionGrade provides diagnostics, but you hold the pen.",
  "Diagnosis before polish: structural problems should not be treated as sentence-cleanup projects.",
  "AI is an instrument, not an authority. Final creative control remains with the author.",
];

const limits = [
  "RevisionGrade does not guarantee representation, publication, sales, or market demand.",
  "RevisionGrade does not rewrite by default or override author judgment.",
  "RevisionGrade does not treat smoother prose as automatically better prose.",
  "RevisionGrade does not pretend every manuscript needs the same level of intervention.",
];

export default function ReliabilityPage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto max-w-7xl px-6 py-20">
        <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Reliability</p>
        <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-tight md:text-6xl">Trust means evidence, restraint, and author control.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-rg-cream2/80">RevisionGrade is a governed manuscript readiness system. It is not a remote human-editing service, not an autonomous writing assistant, and not a style-imitation system trained to flatten other authors’ prose.</p>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-rg-cream2/75">The problem is not human editing. The problem is ungoverned editing: feedback without stable criteria, polish before diagnosis, and revision without clear author control.</p>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar) => <article key={pillar.title} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6"><h2 className="font-rg-serif text-3xl text-rg-cream">{pillar.title}</h2><p className="mt-4 leading-7 text-rg-cream2/75">{pillar.copy}</p></article>)}
        </div>
      </section>

      <section className="bg-rg-cream text-rg-ink">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr]">
          <div><p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Author authority</p><h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">Evidence, not authority. Proposals, not control.</h2></div>
          <div className="grid gap-3 sm:grid-cols-2">{guarantees.map((item) => <div key={item} className="border border-rg-ink/15 bg-white/40 p-4 text-sm leading-7 text-rg-ink/75">{item}</div>)}</div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr]">
        <div><p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">What reliability means in practice</p><h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">The system must know the level of intervention before asking the writer to change the work.</h2></div>
        <div className="space-y-5 text-lg leading-8 text-rg-cream2/80"><p>A manuscript that needs structural repair should not receive only surface polish. A scene that needs pressure should not be smoothed until it loses force. A voice that is unusual should not be normalized merely because it is unusual.</p><p>RevisionGrade’s reliability doctrine is simple: diagnose first, rank the problem, protect the author’s voice, and leave the decision with the author.</p></div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Boundaries</p>
          <h2 className="mt-4 max-w-4xl font-rg-serif text-4xl leading-tight md:text-5xl">What RevisionGrade will not pretend to know.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">{limits.map((item) => <div key={item} className="border border-rg-cream2/12 bg-rg-ink/60 p-5 leading-7 text-rg-cream2/80">{item}</div>)}</div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20"><div className="border border-rg-gold/35 bg-rg-ink2/60 p-8"><h2 className="font-rg-serif text-4xl">Reliability connects to methodology and Revise.</h2><p className="mt-5 max-w-3xl leading-8 text-rg-cream2/75">Methodology explains how the system reads. Reliability explains why the author remains protected. Revise turns findings into controlled repair decisions instead of blind rewriting.</p><div className="mt-7 flex flex-wrap gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]"><Link href="/methodology" className="text-rg-gold hover:text-rg-cream">Read methodology →</Link><Link href="/revise" className="text-rg-gold hover:text-rg-cream">See Revise →</Link></div></div></section>
    </div>
  );
}

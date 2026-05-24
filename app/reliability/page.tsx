import Link from "next/link";

const pillars = [
  { title: "Manuscript Sovereignty", copy: "Customer manuscripts, audit outputs, and revision history are not used as model-training material." },
  { title: "Governed Structural Logic", copy: "RevisionGrade is not a style-imitation system. It evaluates through the 13 Story Criteria, WAVE Revision System logic, manuscript evidence, and readiness-focused editorial reasoning." },
  { title: "Author-in-the-Loop", copy: "The author is the only human in the editorial decision loop. RevisionGrade provides evidence and repair pathways; the author decides what belongs in the manuscript." },
];

const guarantees = [
  "Your manuscript remains your intellectual property.",
  "Your work is evaluated as a private creative project, not as training material.",
  "Your manuscript is not routed to anonymous human editors as part of the audit.",
  "Evidence, not authority: RevisionGrade provides diagnostics, but you hold the pen.",
];

export default function ReliabilityPage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto max-w-7xl px-6 py-20">
        <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Reliability</p>
        <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-tight md:text-6xl">Trust means manuscript sovereignty, structural evidence, and author control.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-rg-cream2/80">RevisionGrade is a governed manuscript readiness audit system. It is not a remote human-editing service, not an autonomous writing assistant, and not a style-imitation system trained to mimic other authors’ prose.</p>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {pillars.map((pillar) => <article key={pillar.title} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6"><h2 className="font-rg-serif text-3xl text-rg-cream">{pillar.title}</h2><p className="mt-4 leading-7 text-rg-cream2/75">{pillar.copy}</p></article>)}
        </div>
      </section>
      <section className="bg-rg-cream text-rg-ink">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr]">
          <div><p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Author authority</p><h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">Evidence, not authority. Proposals, not control.</h2></div>
          <div className="grid gap-3 sm:grid-cols-2">{guarantees.map((item) => <div key={item} className="border border-rg-ink/15 bg-white/40 p-4 text-sm leading-7 text-rg-ink/75">{item}</div>)}</div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-20"><div className="border border-rg-gold/35 bg-rg-ink2/60 p-8"><h2 className="font-rg-serif text-4xl">Reliability connects to methodology.</h2><p className="mt-5 max-w-3xl leading-8 text-rg-cream2/75">Methodology explains what the system evaluates. Reliability explains why authors can trust the process: manuscript sovereignty, structural logic, evidence-bound diagnostics, and final creative authority reserved for the author.</p><Link href="/methodology" className="mt-7 inline-block font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">Read methodology →</Link></div></section>
    </div>
  );
}

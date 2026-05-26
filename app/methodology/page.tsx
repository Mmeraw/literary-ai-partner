import Link from "next/link";
import type { ReactNode } from "react";

const methods = [
  {
    title: "Criteria-led reading",
    copy: "The manuscript is read through stable editorial criteria so feedback is not a random chat response or a matter of taste alone. The same core language lets authors compare reports across drafts.",
  },
  {
    title: "Evidence before verdict",
    copy: "Major findings should be traceable to the submitted pages and explained in terms the author can act on. A score without evidence is a verdict, not a diagnosis.",
  },
  {
    title: "Long-form continuity",
    copy: "Novel-length work requires attention to recurrence, payoff, pacing over distance, character behavior, escalation, closure, and cumulative reader experience.",
  },
  {
    title: "Revision restraint",
    copy: "A recommendation is not automatically an instruction to rewrite. Some passages should be repaired; others should be protected, preserved, clarified, or left alone.",
  },
];

const modes = [
  {
    title: "Short-Form Evaluation",
    range: "Under 25,000 words",
    copy: "Evaluates the submitted pages against the 13 story criteria only. Designed for openings, chapters, excerpts, short stories, and shorter works where full manuscript continuity cannot yet be judged.",
    promise: "Core story diagnosis",
  },
  {
    title: "Long-Form Evaluation",
    range: "25,000+ words",
    copy: "Adds manuscript-scale analysis: continuity, recurrence, setup/payoff, pacing over distance, character behavior, structural readiness, and cumulative reader experience.",
    promise: "Manuscript-scale readiness",
  },
  {
    title: "Long-Form Multi-Layer Evaluation",
    range: "Complex long-form manuscripts",
    copy: "A deeper architecture audit for manuscripts that need layered evidence views, manuscript-scale continuity, proprietary repair governance, dialogue and speech protection, and deeper structural analysis where appropriate.",
    promise: "Deep architecture review",
  },
];

const criteria = [
  {
    name: "Concept",
    copy: "Whether the central idea is clear, compelling, and strong enough to sustain the promised story experience.",
  },
  {
    name: "Narrative Drive",
    copy: "Whether the story generates pressure, escalation, consequence, curiosity, and forward motion.",
  },
  {
    name: "Character",
    copy: "Whether characters behave with coherence, agency, contradiction, development, and emotional credibility.",
  },
  {
    name: "Voice",
    copy: "Whether the prose creates a distinct, controlled, and appropriate narrative presence without accidental flattening.",
  },
  {
    name: "Scene Construction",
    copy: "Whether scenes are built around action, tension, change, stakes, and consequence rather than static explanation.",
  },
  {
    name: "Dialogue",
    copy: "Whether speech reveals character, pressure, relationship, subtext, rhythm, and scene movement.",
  },
  {
    name: "Theme",
    copy: "Whether the manuscript develops meaning through dramatic pressure instead of lecture, repetition, or abstraction.",
  },
  {
    name: "Worldbuilding",
    copy: "Whether setting, context, culture, rules, history, and environment create a credible story world.",
  },
  {
    name: "Pacing",
    copy: "Whether momentum, compression, expansion, turns, and recovery beats are proportioned to reader attention.",
  },
  {
    name: "Prose Control",
    copy: "Whether the line-level writing is precise, intentional, readable, and aligned with the manuscript’s voice.",
  },
  {
    name: "Tone",
    copy: "Whether the emotional and stylistic register remains coherent, deliberate, and appropriate to the material.",
  },
  {
    name: "Narrative Closure",
    copy: "Whether the manuscript resolves, withholds, or complicates its central promises in a satisfying way.",
  },
  {
    name: "Marketability",
    copy: "Whether the manuscript can be positioned clearly for a likely readership, category, shelf, or submission path.",
  },
];

const evidenceModel = [
  {
    label: "Observation",
    copy: "What the manuscript is doing on the page: repeated behavior, missing pressure, unstable voice, over-explanation, payoff drift, or a strong craft choice.",
  },
  {
    label: "Evidence anchor",
    copy: "Where the observation appears: passage, chapter, scene, pattern, structural span, report section, or long-form layer.",
  },
  {
    label: "Reader effect",
    copy: "Why the issue matters: confusion, loss of trust, reduced pressure, emotional flattening, promise drift, or increased engagement.",
  },
  {
    label: "Revision implication",
    copy: "What kind of intervention is warranted: preserve, clarify, compress, restructure, escalate, defer, or repair in Revise.",
  },
];

const comparison = [
  {
    weak: "Increase tension.",
    strong: "The river scene states the emotional contradiction instead of dramatizing it; the reader receives explanation where hesitation, silence, or action would create pressure.",
  },
  {
    weak: "Make the protagonist more active.",
    strong: "Across the midpoint sequence, the protagonist observes consequences but rarely makes a choice that changes the scene’s direction, weakening perceived agency.",
  },
  {
    weak: "The pacing is slow.",
    strong: "Chapters 12–14 hold conversation without a consequence-bearing turn, creating a pressure plateau before the next major reversal.",
  },
];

const workflow = [
  {
    step: "Choose scope",
    copy: "The submitted word count and project type determine whether the report is short-form, long-form, or long-form multi-layer.",
  },
  {
    step: "Read through criteria",
    copy: "The manuscript is evaluated through the 13 story criteria so the diagnostic language remains stable.",
  },
  {
    step: "Anchor claims",
    copy: "Major conclusions should connect to manuscript evidence, confidence, severity, and reader effect.",
  },
  {
    step: "Route revision",
    copy: "Findings can become governed repair opportunities in Revise, where the author chooses what changes.",
  },
];

const boundaries = [
  "Short-form evaluation does not claim full-manuscript continuity diagnosis.",
  "Golden Spine/WAVE language belongs in long-form or multi-layer contexts, not short excerpts.",
  "A score is not a publication guarantee or agent-interest prediction.",
  "Marketability is positioning diagnosis, not a promise of sales or representation.",
  "Revision recommendations remain proposals until the author decides.",
  "External research should support context, not overrule the submitted manuscript.",
];

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">{children}</p>;
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="max-w-4xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">{title}</h2>
      <p className="mt-5 text-lg leading-8 text-rg-cream2/75">{copy}</p>
    </div>
  );
}

export default function MethodologyPage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <Eyebrow>Methodology</Eyebrow>
          <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-[0.98] tracking-tight md:text-7xl">
            How RevisionGrade thinks about manuscripts.
          </h1>
          <p className="mt-8 max-w-3xl text-lg leading-8 text-rg-cream2/85">
            RevisionGrade evaluates manuscripts through stable criteria, evidence-backed diagnosis, and revision restraint. The goal is not generic feedback. The goal is to identify what the manuscript asks the reader to believe, where that trust holds, and where it breaks.
          </p>
          <div className="mt-10 flex flex-wrap gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]">
            <Link href="/evaluate" className="border border-rg-gold bg-rg-gold px-5 py-3 text-rg-ink transition hover:bg-transparent hover:text-rg-gold">Begin Evaluation</Link>
            <Link href="/reliability" className="border border-rg-cream2/30 px-5 py-3 text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">Reliability Doctrine</Link>
          </div>
        </div>

        <div className="border border-rg-gold/35 bg-rg-ink2/70 p-7">
          <Eyebrow>Method standard</Eyebrow>
          <h2 className="mt-4 font-rg-serif text-3xl leading-tight">Stable criteria. Traceable evidence. Author-controlled revision.</h2>
          <div className="mt-6 space-y-3 text-sm leading-7 text-rg-cream2/80">
            <p>The manuscript is not judged by vibes.</p>
            <p>The report should explain why a finding matters.</p>
            <p>Revision follows diagnosis; it does not replace it.</p>
          </div>
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <SectionHeading
            eyebrow="Reading principles"
            title="Four principles shape the evaluation."
            copy="The methodology keeps the product from becoming a generic critique engine. It reads through stable editorial dimensions, requires evidence, respects long-form behavior, and avoids unnecessary rewriting."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {methods.map((item) => (
              <article key={item.title} className="border border-rg-cream2/12 bg-rg-ink/70 p-6">
                <h3 className="font-rg-serif text-3xl">{item.title}</h3>
                <p className="mt-4 leading-7 text-rg-cream2/75">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeading
          eyebrow="Evaluation modes"
          title="Different manuscript lengths require different diagnostic promises."
          copy="RevisionGrade should not pretend a chapter can prove what only a full manuscript can show. Evaluation mode controls what the report can responsibly diagnose."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {modes.map((mode) => (
            <article key={mode.title} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6">
              <p className="font-rg-mono text-[0.68rem] uppercase tracking-[0.18em] text-rg-gold">{mode.range}</p>
              <h3 className="mt-3 font-rg-serif text-2xl text-rg-cream">{mode.title}</h3>
              <p className="mt-4 rounded border border-rg-gold/20 bg-rg-gold/10 px-3 py-2 font-rg-mono text-[0.68rem] uppercase tracking-[0.12em] text-rg-gold">{mode.promise}</p>
              <p className="mt-4 text-sm leading-7 text-rg-cream2/75">{mode.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-rg-cream text-rg-ink">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Thirteen Story Criteria</p>
              <h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">The core evaluation language stays stable.</h2>
              <p className="mt-5 text-lg leading-8 text-rg-ink/75">
                The 13 criteria give every report a common vocabulary. Short-form evaluations use these criteria only; long-form and multi-layer evaluations build on them where manuscript length supports deeper claims.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {criteria.map((item) => (
                <article key={item.name} className="border border-rg-ink/15 bg-white/50 p-4">
                  <h3 className="font-rg-serif text-2xl text-rg-ink">{item.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-rg-ink/75">{item.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.85fr_1.15fr]">
        <SectionHeading
          eyebrow="Evidence model"
          title="A finding should move from observation to consequence."
          copy="The report should not merely name a weakness. It should explain what was observed, where it appears, how it affects the reader, and what kind of revision decision follows."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {evidenceModel.map((item) => (
            <article key={item.label} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6">
              <h3 className="font-rg-serif text-2xl text-rg-cream">{item.label}</h3>
              <p className="mt-4 leading-7 text-rg-cream2/75">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <SectionHeading
            eyebrow="What makes the diagnosis different"
            title="Useful feedback is specific enough to act on."
            copy="Generic critique tells the author to improve. RevisionGrade should identify the story behavior that causes the reader effect."
          />
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {comparison.map((item) => (
              <article key={item.weak} className="border border-rg-cream2/12 bg-rg-ink/70 p-6">
                <p className="font-rg-mono text-[0.68rem] uppercase tracking-[0.16em] text-rg-gold">Generic feedback</p>
                <p className="mt-3 text-lg leading-7 text-rg-cream2/80">“{item.weak}”</p>
                <p className="mt-6 font-rg-mono text-[0.68rem] uppercase tracking-[0.16em] text-rg-gold">Evidence-backed diagnosis</p>
                <p className="mt-3 leading-7 text-rg-cream2/80">{item.strong}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeading
          eyebrow="Evaluate → Revise bridge"
          title="The method does not stop at diagnosis. It controls what happens next."
          copy="Evaluation identifies the weakness. Revise turns the weakness into a governed repair opportunity: evidence, diagnosis, options, voice risk, and explicit author decision."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {workflow.map((item, index) => (
            <article key={item.step} className="border border-rg-cream2/12 bg-rg-ink2/60 p-5">
              <p className="font-rg-mono text-xs text-rg-gold">0{index + 1}</p>
              <h3 className="mt-3 font-rg-serif text-2xl text-rg-cream">{item.step}</h3>
              <p className="mt-4 text-sm leading-7 text-rg-cream2/75">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading
            eyebrow="Method boundaries"
            title="Responsible diagnosis requires responsible limits."
            copy="The methodology is strongest when it says what the system can diagnose and what it should not pretend to know."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {boundaries.map((item) => (
              <div key={item} className="border border-rg-cream2/12 bg-rg-ink/70 p-5 leading-7 text-rg-cream2/80">{item}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="border border-rg-gold/35 bg-rg-ink2/60 p-8 md:p-10">
          <Eyebrow>Next step</Eyebrow>
          <h2 className="mt-4 max-w-4xl font-rg-serif text-4xl leading-tight md:text-5xl">From method to manuscript action.</h2>
          <p className="mt-5 max-w-3xl leading-8 text-rg-cream2/75">
            Methodology explains how the system reads. Reliability explains why the author remains protected. Revise turns findings into controlled repair decisions instead of blind rewriting.
          </p>
          <div className="mt-7 flex flex-wrap gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]">
            <Link href="/reliability" className="text-rg-gold hover:text-rg-cream">Reliability →</Link>
            <Link href="/revise" className="text-rg-gold hover:text-rg-cream">Revise →</Link>
            <Link href="/evaluate" className="text-rg-gold hover:text-rg-cream">Evaluate →</Link>
            <Link href="/privacy-research-controls" className="text-rg-gold hover:text-rg-cream">Privacy Controls →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "The Black Box Problem | RevisionGrade™",
  description:
    "Why RevisionGrade exists: to help writers separate manuscript readiness from market rejection.",
};

const criteria = [
  "Concept",
  "Narrative Drive",
  "Character",
  "Voice",
  "Scene Construction",
  "Dialogue",
  "Theme",
  "Worldbuilding",
  "Pacing",
  "Prose Control",
  "Tone",
  "Narrative Closure",
  "Marketability",
];

const boundaries = [
  "We do not guarantee representation, publication, or market success.",
  "We do not replace the writer's creative judgment.",
  "We do not rely on generic bestseller logic that flattens authorial voice.",
  "We do not make promises about agent taste, list fit, market timing, or industry demand.",
];

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">
      {children}
    </p>
  );
}

export default function BlackBoxProblemPage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
        <div>
          <SectionLabel>RevisionGrade™ Doctrine</SectionLabel>
          <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-[0.98] tracking-tight text-rg-cream md:text-7xl">
            The Black Box Problem
          </h1>
          <p className="mt-8 max-w-2xl text-xl leading-9 text-rg-cream2/85">
            Why RevisionGrade exists: to help writers separate manuscript readiness from market rejection.
          </p>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-rg-cream2/75">
            RevisionGrade exists to make manuscript readiness visible before the publishing industry turns uncertainty into silence.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/evaluate" className="border border-rg-gold bg-rg-gold px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-ink transition hover:bg-transparent hover:text-rg-gold">
              Evaluate My Manuscript
            </Link>
            <Link href="/methodology" className="border border-rg-cream2/30 px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">
              See How RevisionGrade Works
            </Link>
          </div>
        </div>
        <aside className="border border-rg-cream2/15 bg-rg-ink2/70 p-6 shadow-2xl shadow-black/30">
          <div className="border border-rg-gold/30 p-6">
            <SectionLabel>The separation principle</SectionLabel>
            <h2 className="mt-4 font-rg-serif text-3xl text-rg-cream">
              Is the problem the manuscript, or the market?
            </h2>
            <p className="mt-5 text-sm leading-7 text-rg-cream2/75">
              RevisionGrade cannot control agent taste, list fit, market timing, or industry demand. It addresses the question writers can act on before submission: whether the manuscript itself is structurally ready.
            </p>
            <div className="mt-6 grid gap-3">
              <div className="border border-rg-cream2/12 p-4">
                <p className="font-rg-mono text-[0.68rem] uppercase tracking-[0.18em] text-rg-gold">Manuscript Readiness</p>
                <p className="mt-2 text-sm leading-6 text-rg-cream2/75">Structure, voice, narrative pressure, coherence, evidence, and revision priorities.</p>
              </div>
              <div className="border border-rg-cream2/12 p-4">
                <p className="font-rg-mono text-[0.68rem] uppercase tracking-[0.18em] text-rg-gold">Market Fit</p>
                <p className="mt-2 text-sm leading-6 text-rg-cream2/75">Agent list, personal taste, timing, commercial appetite, and category demand.</p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 md:grid-cols-[0.85fr_1.15fr]">
          <div>
            <SectionLabel>The Black Box</SectionLabel>
            <h2 className="mt-4 font-rg-serif text-4xl leading-tight text-rg-cream md:text-5xl">
              Publishing gives writers verdicts, not diagnoses.
            </h2>
          </div>
          <div className="space-y-5 text-lg leading-8 text-rg-cream2/80">
            <p>
              I wrote four novels. Like many writers, I sent them into the publishing industry's black box. At best, I received a template rejection. More often, I received silence.
            </p>
            <p>
              Agents are busy; they are not required to provide feedback. A manuscript may be rejected because the writing is not ready, because the story is not right for an agent's list, because the timing is off, or because the market is not looking for that kind of book.
            </p>
            <p>
              From the outside, all of those answers look the same: no diagnosis, no explanation, no way to know whether the next step is revision or a different door.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[1fr_1fr]">
        <article className="border border-rg-cream2/12 bg-rg-ink2/60 p-8">
          <SectionLabel>The diagnostic gap</SectionLabel>
          <h2 className="mt-4 font-rg-serif text-4xl text-rg-cream">The writer is left with professional doubt.</h2>
          <p className="mt-5 leading-8 text-rg-cream2/75">
            Without a diagnosis, a writer cannot systematically improve the work. The result is a costly loop: revise blindly, query again, wait again, and still not know whether the manuscript is structurally failing or simply mismatched to that agent, list, or moment.
          </p>
        </article>
        <article className="border border-rg-cream2/12 bg-rg-ink2/60 p-8">
          <SectionLabel>The RevisionGrade answer</SectionLabel>
          <h2 className="mt-4 font-rg-serif text-4xl text-rg-cream">Separate what can be diagnosed from what cannot be controlled.</h2>
          <p className="mt-5 leading-8 text-rg-cream2/75">
            RevisionGrade helps isolate the manuscript-readiness question from the market-fit question. It does not promise that a specific agent will say yes. It helps the author understand whether the manuscript is asking the reader to believe in a story that is structurally ready.
          </p>
        </article>
      </section>

      <section className="bg-rg-cream text-rg-ink">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">The RevisionGrade™ Readiness Standard</p>
          <div className="mt-5 grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="font-rg-serif text-4xl leading-tight md:text-5xl">
                Serious manuscripts deserve structural validation before submission.
              </h2>
              <p className="mt-6 leading-8 text-rg-ink/75">
                RevisionGrade evaluates manuscript readiness across thirteen core dimensions of long-form narrative. The goal is not to generate more words. The goal is to diagnose structural friction first, then keep any revision assistance evidence-bound, author-controlled, and voice-preserving.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {criteria.map((criterion) => (
                <div key={criterion} className="border border-rg-ink/15 bg-white/45 px-4 py-3 font-rg-mono text-[0.68rem] uppercase tracking-[0.12em] text-rg-ink/80">
                  {criterion}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionLabel>Built from systems discipline</SectionLabel>
          <h2 className="mt-4 font-rg-serif text-4xl leading-tight text-rg-cream md:text-5xl">
            Creative work should remain creative. Readiness should be governed.
          </h2>
        </div>
        <div className="space-y-5 text-lg leading-8 text-rg-cream2/80">
          <p>
            RevisionGrade was founded by Michael J. Meraw, a former Canadian Forces pilot and Major (Retired) with more than twenty years in corporate aerospace.
          </p>
          <p>
            His background in airworthiness, reliability, enterprise information management, and master data management shaped the RevisionGrade operating principle: when the stakes are high, guessing is not a process.
          </p>
          <p>
            The result is a manuscript-readiness system built around structured checks, evidence-based diagnostics, system-level thinking, and respect for the author's original voice.
          </p>
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <SectionLabel>Governance requires boundaries</SectionLabel>
          <h2 className="mt-4 max-w-4xl font-rg-serif text-4xl leading-tight text-rg-cream md:text-5xl">
            What RevisionGrade does not promise.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {boundaries.map((boundary) => (
              <div key={boundary} className="border border-rg-cream2/12 bg-rg-ink/60 p-5 text-rg-cream2/80">
                {boundary}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <SectionLabel>A structural readiness check before the black box</SectionLabel>
        <h2 className="mt-5 font-rg-serif text-4xl leading-tight text-rg-cream md:text-6xl">
          Has your manuscript been RevisionGraded?
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-rg-cream2/75">
          Before you submit, know what the manuscript is asking the reader to believe.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/evaluate" className="border border-rg-gold bg-rg-gold px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-ink transition hover:bg-transparent hover:text-rg-gold">
            Evaluate My Manuscript
          </Link>
          <Link href="/resources" className="border border-rg-cream2/30 px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">
            Read Resources
          </Link>
        </div>
      </section>
    </div>
  );
}

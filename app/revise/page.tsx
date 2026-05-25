import Link from "next/link";
import type { ReactNode } from "react";

const queueItems = [
  "Evidence-backed problem statement",
  "Affected criterion, severity, and confidence",
  "Original passage context",
  "A / B / C repair options with rationale",
  "Author decision: accept, keep original, reject, defer, or write custom",
  "Voice-protection warning when compression would damage the text",
];

const optionModel = [
  {
    label: "A — Recommended",
    copy: "The system's best repair based on evidence, severity, reader effect, and voice-protection rules. TrustedPath™ applies this option when eligible.",
  },
  {
    label: "B — Conservative",
    copy: "The smallest viable change. It repairs the issue while preserving as much of the original passage, rhythm, and structure as possible.",
  },
  {
    label: "C — Bold",
    copy: "A more assertive alternative. It may intensify, compress, restructure, or reframe the moment when a stronger move is warranted.",
  },
];

const manualDecisions = [
  "Accept selected option",
  "Keep original",
  "Reject all three",
  "Write custom revision",
  "Defer for later",
  "Record decision in session history",
];

const trustedPathSafeguards = [
  "Applies eligible Option A repairs only",
  "Creates a duplicate revised draft",
  "Preserves the original manuscript",
  "Generates a change log",
  "Skips low-confidence or high voice-risk opportunities when required",
  "Supports follow-up evaluation to measure improvement",
];

const waveSequence = [
  "Structure before polish",
  "Continuity before local line repair",
  "Voice protection before compression",
  "Author decision before manuscript change",
  "Follow-up evaluation before claiming improvement",
];

const doctrine = [
  "Evaluation findings do not automatically become edits.",
  "WAVE is the ordered repair layer after evaluation, not a single rewrite command.",
  "Revision activity is not measured improvement until a later evaluation confirms movement.",
  "The author may control every opportunity manually or authorize governed automation.",
  "TrustedPath™ is convenience with safeguards, not blind rewriting.",
];

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">{children}</p>;
}

export default function RevisePage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1fr_1fr]">
        <div>
          <Eyebrow>RevisionGrade™ Revise · WAVE Revision System™</Eyebrow>
          <h1 className="mt-6 font-rg-serif text-5xl leading-[0.95] tracking-tight md:text-7xl">
            Choose your WAVE revision path.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-rg-cream2/85">
            Revise is the WAVE Revision System™ in action: evaluation findings become ordered repair decisions. Work through the queue one opportunity at a time, or use TrustedPath™ to apply the eligible system-recommended path to a protected manuscript copy.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/workbench" className="border border-rg-gold bg-rg-gold px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-ink transition hover:bg-transparent hover:text-rg-gold">
              Open WAVE Queue
            </Link>
            <Link href="/evaluate" className="border border-rg-cream2/30 px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">
              Start Evaluation
            </Link>
          </div>
        </div>

        <div className="border border-rg-cream2/15 bg-rg-ink2/70 p-6">
          <Eyebrow>Core primitive</Eyebrow>
          <h2 className="mt-4 font-rg-serif text-3xl">RevisionOpportunity</h2>
          <p className="mt-4 text-sm leading-7 text-rg-cream2/75">
            Each WAVE opportunity is a specific manuscript repair candidate, anchored to evidence and constrained by what the author must not lose.
          </p>
          <div className="mt-6 space-y-3">
            {queueItems.map((item) => (
              <div key={item} className="border border-rg-cream2/10 px-4 py-3 font-rg-mono text-[0.7rem] uppercase tracking-[0.12em] text-rg-cream2/80">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <Eyebrow>Two revision paths</Eyebrow>
          <h2 className="mt-4 max-w-4xl font-rg-serif text-4xl leading-tight md:text-5xl">
            Manual WAVE control or governed automation.
          </h2>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <article className="border border-rg-cream2/12 bg-rg-ink/70 p-7">
              <p className="font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold">Path 1</p>
              <h3 className="mt-4 font-rg-serif text-4xl">Revise Queue</h3>
              <p className="mt-4 leading-7 text-rg-cream2/75">
                The author reviews each WAVE opportunity manually. Every decision is explicit: accept a proposed repair, keep the original, reject the opportunity, defer it, or write a custom revision.
              </p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {manualDecisions.map((item) => (
                  <div key={item} className="border border-rg-cream2/10 bg-rg-ink2/60 px-4 py-3 font-rg-mono text-[0.68rem] uppercase tracking-[0.12em] text-rg-cream2/80">
                    {item}
                  </div>
                ))}
              </div>
              <Link href="/workbench" className="mt-8 inline-block border border-rg-gold px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold transition hover:bg-rg-gold hover:text-rg-ink">
                Open Workbench
              </Link>
            </article>

            <article className="border border-rg-gold/45 bg-rg-ink/70 p-7 shadow-2xl shadow-black/20">
              <p className="font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold">Path 2</p>
              <h3 className="mt-4 font-rg-serif text-4xl">TrustedPath™</h3>
              <p className="mt-4 leading-7 text-rg-cream2/75">
                TrustedPath™ is the one-click WAVE path for authors who do not want to review dozens or hundreds of repair opportunities. It applies the eligible Option A repairs to a duplicate manuscript draft.
              </p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {trustedPathSafeguards.map((item) => (
                  <div key={item} className="border border-rg-gold/20 bg-rg-ink2/60 px-4 py-3 font-rg-mono text-[0.68rem] uppercase tracking-[0.12em] text-rg-cream2/80">
                    {item}
                  </div>
                ))}
              </div>
              <p className="mt-6 border border-rg-gold/25 bg-rg-gold/10 p-4 text-sm leading-7 text-rg-cream2/80">
                TrustedPath™ should never overwrite the original. It produces a protected revised draft, a change log, and a clear next step: review, export, or re-evaluate.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <Eyebrow>A / B / C model</Eyebrow>
          <h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">
            Three proposed repairs, one author decision.
          </h2>
          <p className="mt-6 leading-8 text-rg-cream2/75">
            The options are not random rewrites. They represent different levels of WAVE intervention, from recommended to conservative to bold.
          </p>
        </div>
        <div className="grid gap-4">
          {optionModel.map((option) => (
            <article key={option.label} className="border border-rg-cream2/12 bg-rg-ink2/60 p-5">
              <h3 className="font-rg-serif text-2xl text-rg-cream">{option.label}</h3>
              <p className="mt-3 leading-7 text-rg-cream2/75">{option.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <Eyebrow>WAVE order</Eyebrow>
            <h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">
              WAVE keeps repair sequenced instead of scattered.
            </h2>
            <p className="mt-6 leading-8 text-rg-cream2/75">
              The system should not polish a sentence before it knows whether the scene, promise, voice, or continuity is structurally sound.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {waveSequence.map((item, index) => (
              <div key={item} className="border border-rg-cream2/12 bg-rg-ink/70 p-5">
                <p className="font-rg-mono text-xs text-rg-gold">0{index + 1}</p>
                <p className="mt-3 leading-7 text-rg-cream2/85">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-rg-cream text-rg-ink">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-2">
          <div>
            <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Author sovereignty</p>
            <h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">
              RevisionGrade does not force revision. It records decisions.
            </h2>
          </div>
          <div className="space-y-5 text-lg leading-8 text-rg-ink/75">
            {doctrine.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="border border-rg-gold/35 bg-rg-ink2/60 p-8 md:p-10">
          <Eyebrow>Contract</Eyebrow>
          <h2 className="mt-4 max-w-4xl font-rg-serif text-4xl leading-tight md:text-5xl">
            Manual WAVE proves rigor. TrustedPath™ delivers speed.
          </h2>
          <p className="mt-6 max-w-3xl leading-8 text-rg-cream2/75">
            Both paths keep the same principle: the manuscript is diagnosed first, repairs are evidence-backed, and the author remains the final authority.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/workbench" className="font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">Open Revise Queue →</Link>
            <Link href="/pricing" className="font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">See pricing →</Link>
            <Link href="/reliability" className="font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">Reliability →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

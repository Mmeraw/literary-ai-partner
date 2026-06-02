import Link from "next/link";
import type { ReactNode } from "react";

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

const publicWaveSignals = [
  {
    title: "Evidence before readiness",
    copy: "The system does not revise from a vague prompt. It begins with specific manuscript evidence and a diagnosed editorial reason.",
  },
  {
    title: "Sequenced readiness analysis",
    copy: "Readiness findings are ordered by dependency and risk so downstream repair does not mask deeper manuscript problems.",
  },
  {
    title: "Voice protection",
    copy: "A downstream repair recommendation can be blocked, softened, or skipped when changing the sentence would damage the authorial signal.",
  },
  {
    title: "Author authority",
    copy: "The author can review, accept, reject, keep the original, or use a governed convenience path on a protected copy.",
  },
];

const workflow = [
  {
    step: "01",
    title: "Diagnose the manuscript",
    copy: "RevisionGrade reads the submitted work through the correct evaluation mode: short-form, long-form, or long-form multi-layer.",
  },
  {
    step: "02",
    title: "Score the story criteria",
    copy: "The 13 story criteria establish narrative readiness before repair begins. Structural weakness is not treated as simple prose polish.",
  },
  {
    step: "03",
    title: "Build the evidence layer",
    copy: "Long-form work can add manuscript-scale continuity and source-integrity checks before repair decisions are generated.",
  },
  {
    step: "04",
    title: "Apply WAVE readiness layer",
    copy: "Eligible long-form manuscripts move through WAVE as a governed readiness analysis layer before revision opportunities enter Revise.",
  },
  {
    step: "05",
    title: "Revise with control",
    copy: "Authors can work through the Revise Queue manually or use TrustedPath™ to apply eligible recommended repairs to a protected copy.",
  },
];

const proofPoints = [
  "13 story criteria before WAVE",
  "Short-form / long-form / multi-layer modes",
  "Evidence-backed readiness decisions",
  "Overcorrection protection",
  "Author-controlled repair queue",
  "TrustedPath™ governed automation",
];

const revisionContrasts = [
  {
    title: "Not a chatbot",
    copy: "The system does not ask the author for a vague prompt and produce generic feedback. It reads against a governed manuscript architecture.",
  },
  {
    title: "Not cosmetic polish",
    copy: "RevisionGrade separates structural diagnosis from line-level refinement so the wrong intervention does not flatten the manuscript.",
  },
  {
    title: "Not blind rewriting",
    copy: "WAVE readiness is bounded by evidence, ordered evaluation, and voice-protection rules. The author remains the final authority.",
  },
];

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-rg-mono text-sm uppercase tracking-[0.2em] text-rg-gold md:text-xs md:tracking-[0.24em]">
      {children}
    </p>
  );
}

export default function Home() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto grid max-w-7xl items-center gap-8 px-6 py-12 lg:grid-cols-[1.04fr_0.96fr] lg:gap-12 lg:py-16">
        <div>
          <SectionLabel>RevisionGrade™ · WAVE Readiness System™</SectionLabel>
          <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-[0.95] tracking-tight text-rg-cream md:text-7xl">
            Diagnose the manuscript. Then repair it through Revise.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-rg-cream2/90">
            RevisionGrade is a manuscript-readiness and revision system. It evaluates the story across 13 criteria, builds evidence-backed diagnosis, and uses WAVE as a governed readiness layer before repair opportunities enter Revise without erasing the writer&apos;s voice.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/evaluate" className="border border-rg-gold bg-rg-gold px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-ink transition hover:bg-transparent hover:text-rg-gold">Begin Evaluation</Link>
            <Link href="/revise" className="border border-rg-cream2/30 px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">See Revise</Link>
          </div>
        </div>
        <div className="border border-rg-cream2/20 bg-rg-ink2/80 p-6 shadow-2xl shadow-black/30">
          <div className="border border-rg-gold/35 p-6">
            <SectionLabel>The public promise</SectionLabel>
            <h2 className="mt-4 font-rg-serif text-3xl text-rg-cream">Diagnosis first. Governed repair second.</h2>
            <p className="mt-4 text-base leading-8 text-rg-cream2/90">
              Story architecture is assessed before refinement. The 13 criteria establish narrative viability. WAVE is the protected readiness layer used before eligible repair opportunities enter Revise.
            </p>
            <div className="mt-6 grid gap-3">
              {["Story diagnosis", "13 criteria", "Evidence layer", "WAVE readiness", "Author approval"].map((item, index) => (
                <div key={item} className="flex items-center gap-4 border border-rg-cream2/15 px-4 py-4">
                  <span className="font-rg-mono text-sm text-rg-gold">0{index + 1}</span>
                  <span className="font-rg-mono text-sm uppercase tracking-[0.14em] text-rg-cream2/95">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-3 lg:py-12">
          {revisionContrasts.map((item) => (
            <article key={item.title}>
              <SectionLabel>{item.title}</SectionLabel>
              <h2 className="mt-4 font-rg-serif text-3xl text-rg-cream">{item.title === "Not a chatbot" ? "Governed diagnosis." : item.title === "Not cosmetic polish" ? "Structural repair first." : "Voice protected."}</h2>
              <p className="mt-4 text-base leading-8 text-rg-cream2/90">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 lg:py-16">
        <div className="max-w-4xl">
          <SectionLabel>WAVE Readiness System™</SectionLabel>
          <h2 className="mt-4 font-rg-serif text-4xl leading-tight text-rg-cream md:text-5xl">
            WAVE is the protected readiness layer inside evaluation.
          </h2>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-rg-cream2/90">
            The WAVE Readiness System™ is not a single rewrite command. It is a proprietary, sequenced readiness methodology that turns evidence-backed findings into governed manuscript interventions while protecting the author&apos;s voice.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {publicWaveSignals.map((signal) => (
            <article key={signal.title} className="border border-rg-cream2/15 bg-rg-ink2/70 p-5">
              <p className="font-rg-mono text-sm uppercase tracking-[0.16em] text-rg-gold md:text-xs">WAVE principle</p>
              <h3 className="mt-4 font-rg-serif text-2xl text-rg-cream md:text-xl">{signal.title}</h3>
              <p className="mt-3 text-base leading-7 text-rg-cream2/90">{signal.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-rg-cream text-rg-ink">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:py-16">
          <div>
            <p className="font-rg-mono text-sm uppercase tracking-[0.2em] text-rg-gold md:text-xs md:tracking-[0.24em]">Thirteen story criteria</p>
            <h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">
              The criteria decide whether a manuscript is ready for WAVE-level readiness analysis.
            </h2>
            <p className="mt-6 text-base leading-8 text-rg-ink/80">
              Short-form work is evaluated against the 13 criteria only. Long-form work can activate deeper manuscript-scale diagnosis and WAVE readiness when appropriate.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {criteria.map((criterion) => (
              <div key={criterion} className="border border-rg-ink/20 bg-white/60 px-5 py-5 font-rg-mono text-sm uppercase tracking-[0.14em] text-rg-ink/90">
                {criterion}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 lg:py-16">
        <div className="max-w-3xl">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-4 font-rg-serif text-4xl text-rg-cream md:text-5xl">
            Evaluation first. WAVE readiness second. Revise with author control.
          </h2>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-5">
          {workflow.map((item) => (
            <article key={item.step} className="border border-rg-cream2/15 bg-rg-ink2/70 p-5">
              <p className="font-rg-mono text-sm text-rg-gold md:text-xs">{item.step}</p>
              <h3 className="mt-4 font-rg-serif text-2xl text-rg-cream md:text-xl">{item.title}</h3>
              <p className="mt-3 text-base leading-7 text-rg-cream2/90">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-rg-cream text-rg-ink">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:py-16">
          <div>
            <p className="font-rg-mono text-sm uppercase tracking-[0.2em] text-rg-gold md:text-xs md:tracking-[0.24em]">Why this is different</p>
            <h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">
              The author does not need another opinion. The author needs a governed readiness path and repair workflow.
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {proofPoints.map((point) => (
              <div key={point} className="border border-rg-ink/20 bg-white/60 p-5 font-rg-mono text-sm uppercase tracking-[0.14em] text-rg-ink/90">
                {point}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="border border-rg-cream2/15 bg-rg-ink2/70 p-8">
            <SectionLabel>Revise Queue</SectionLabel>
            <h2 className="mt-4 font-rg-serif text-4xl text-rg-cream">Manual repair, one opportunity at a time.</h2>
            <p className="mt-5 text-base leading-8 text-rg-cream2/90">
              WAVE readiness findings can become RevisionOpportunity cards with evidence, severity, repair options, rationale, and explicit author decisions.
            </p>
            <Link href="/workbench" className="mt-7 inline-block font-rg-mono text-sm uppercase tracking-[0.16em] text-rg-gold hover:text-rg-cream md:text-xs">Open Revise Queue →</Link>
          </div>
          <div className="border border-rg-cream2/15 bg-rg-ink2/70 p-8">
            <SectionLabel>TrustedPath™</SectionLabel>
            <h2 className="mt-4 font-rg-serif text-4xl text-rg-cream">One-click governed repair for eligible manuscripts.</h2>
            <p className="mt-5 text-base leading-8 text-rg-cream2/90">
              TrustedPath™ applies eligible recommended repairs to a duplicate manuscript draft, preserves the original, and generates a change log so convenience does not become blind rewriting.
            </p>
            <Link href="/revise" className="mt-7 inline-block font-rg-mono text-sm uppercase tracking-[0.16em] text-rg-gold hover:text-rg-cream md:text-xs">See Revise →</Link>
          </div>
        </div>
      </section>

      <section className="border-t border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-10 items-start">
            <div>
              <SectionLabel>Agent Readiness Package™</SectionLabel>
              <h2 className="mt-4 font-rg-serif text-4xl text-rg-cream md:text-5xl leading-tight">
                After readiness, build the submission package.
              </h2>
              <p className="mt-6 text-base leading-8 text-rg-cream2/90">
                Generate your query letter, synopsis, query pitch, comparables, manuscript positioning, and author bio—then approve each section before export. Built for authors who have moved from diagnosis toward submission readiness.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/agent-readiness" className="border border-rg-gold bg-rg-gold px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-ink transition hover:bg-transparent hover:text-rg-gold">
                  Build My Package
                </Link>
                <Link href="/agent-readiness" className="border border-rg-cream2/30 px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">
                  See What&apos;s Included
                </Link>
              </div>
            </div>
            <div className="grid gap-3">
              {[
                ["01", "Query Letter", "Hook, metadata, comparables, differentiator, and bio. 450-word hard cap."],
                ["02", "Synopsis", "Query (100–150 words), standard (250–500), or extended (700–1,000)."],
                ["03", "Query Pitch", "One sentence and paragraph versions for manuscript submission materials."],
                ["04", "Comparables & Positioning", "2–4 comps with rationale and Agent Appeal Brief."],
                ["05", "Author Bio", "Third-person, professional. Author-supplied credentials only."],
                ["06", "Package History / Export", "Approve all sections, then export as DOCX or copy."],
              ].map(([num, title, desc]) => (
                <div key={num} className="flex items-start gap-4 border border-rg-cream2/15 bg-rg-ink px-4 py-4">
                  <span className="font-rg-mono text-sm text-rg-gold shrink-0 mt-0.5 md:text-xs">{num}</span>
                  <div>
                    <p className="font-rg-mono text-sm uppercase tracking-[0.12em] text-rg-cream">{title}</p>
                    <p className="mt-2 font-rg-mono text-sm text-rg-cream2/85 leading-6">{desc}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-4 border border-rg-cream2/15 bg-rg-ink px-4 py-4 opacity-90">
                <span className="font-rg-mono text-sm text-rg-gold shrink-0 mt-0.5 md:text-xs">07</span>
                <div>
                  <p className="font-rg-mono text-sm uppercase tracking-[0.12em] text-rg-cream2/85">Agent Targeting™—Coming Next</p>
                  <p className="mt-2 font-rg-mono text-sm text-rg-cream2/75 leading-6">Find target agents. Generate agent-specific query variants.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-rg-cream2/10">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-10 items-start">
            <div>
              <SectionLabel>Storygate Studio™</SectionLabel>
              <h2 className="mt-4 font-rg-serif text-4xl text-rg-cream md:text-5xl leading-tight">
                A curated access layer for readiness-vetted manuscript projects.
              </h2>
              <p className="mt-6 text-base leading-8 text-rg-cream2/90">
                Manuscript projects that clear the readiness threshold can enter Storygate Studio—a controlled environment where verified publishing professionals request access to creator-approved materials.
              </p>
              <p className="mt-3 text-base leading-8 text-rg-cream2/80">
                No public marketplace. No cold outreach. Access is requested, approved by the creator, and logged.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/storygate-studio" className="border border-rg-gold bg-rg-gold px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-ink transition hover:bg-transparent hover:text-rg-gold">
                  Learn About Storygate
                </Link>
                <Link href="/storygate-studio/industry" className="border border-rg-cream2/30 px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">
                  Publishing Access
                </Link>
              </div>
            </div>
            <div className="grid gap-3">
              {[
                ["Verified Access Only", "Publishing users are approved before viewing any project materials."],
                ["Creator-Controlled Visibility", "Creators decide what is visible and to whom. Access requires their approval."],
                ["8.0+ Readiness Gate", "Projects must clear a minimum readiness threshold before eligibility."],
                ["Logged Activity", "All access events are recorded and append-only. No anonymous actions."],
                ["Not a Marketplace", "No public search. No cold contact. No fee to submit your project."],
              ].map(([title, desc]) => (
                <div key={title} className="border border-rg-cream2/15 bg-rg-ink2/70 px-5 py-4">
                  <p className="font-rg-mono text-sm uppercase tracking-[0.12em] text-rg-gold md:text-xs">{title}</p>
                  <p className="mt-2 text-base text-rg-cream2/85 leading-7">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

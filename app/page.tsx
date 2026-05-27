import Link from "next/link";
import type { ReactNode } from "react";

const criteria: { name: string; description: string }[] = [
  { name: "Concept", description: "Is the premise compelling enough to sustain the full narrative?" },
  { name: "Narrative Drive", description: "Does the story create forward momentum that compels the reader to continue?" },
  { name: "Character", description: "Are characters distinct, motivated, and changed by the events of the story?" },
  { name: "Voice", description: "Does the prose carry a recognizable authorial identity?" },
  { name: "Scene Construction", description: "Does each scene earn its place through conflict, change, or revelation?" },
  { name: "Dialogue", description: "Does conversation reveal character, advance story, or build tension?" },
  { name: "Theme", description: "Is there a coherent thematic layer beneath the surface narrative?" },
  { name: "Worldbuilding", description: "Is the setting specific, consistent, and integral to the story?" },
  { name: "Pacing", description: "Does the story control speed, tension, and rest across its full length?" },
  { name: "Prose Control", description: "Is the sentence-level writing precise, varied, and purposeful?" },
  { name: "Tone", description: "Does the emotional register remain consistent and intentional throughout?" },
  { name: "Narrative Closure", description: "Does the ending resolve or deliberately leave open the story's central questions?" },
  { name: "Marketability", description: "Does the work position itself clearly within a recognizable market category?" },
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

const alternativeContrasts = [
  {
    title: "Unlike Grammarly-style polish",
    copy: "RevisionGrade diagnoses structural and narrative problems before touching prose. Line-level polish on a broken structure wastes time and money.",
  },
  {
    title: "Unlike generic AI chat",
    copy: "The system does not accept a vague prompt and generate generic encouragement. It reads against 13 governed criteria with manuscript evidence.",
  },
  {
    title: "Unlike a beta reader",
    copy: "Beta readers offer subjective impressions. RevisionGrade produces a repeatable, evidence-backed readiness diagnosis with specific repair opportunities.",
  },
  {
    title: "Unlike jumping to a developmental editor",
    copy: "A developmental edit on a manuscript with undiagnosed structural issues can cost thousands and still miss the root problem. Diagnose first.",
  },
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
    <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">
      {children}
    </p>
  );
}

export default function Home() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.04fr_0.96fr] lg:py-28">
        <div>
          <SectionLabel>RevisionGrade™ · WAVE Readiness System™</SectionLabel>
          <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-[0.95] tracking-tight text-rg-cream md:text-7xl">
            Diagnose the manuscript. Then repair it through Revise.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-rg-cream2/85">
            RevisionGrade is a manuscript-readiness and revision system. It evaluates the story across 13 criteria, builds evidence-backed diagnosis, and uses WAVE as a governed readiness layer before repair opportunities enter Revise without erasing the writer&apos;s voice.
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-rg-cream2/60">
            For completed openings, chapters, short stories, and full manuscripts ready for honest structural diagnosis.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/evaluate" className="border border-rg-gold bg-rg-gold px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-ink transition hover:bg-transparent hover:text-rg-gold">Diagnose My Manuscript</Link>
            <Link href="/evaluate" className="border border-rg-cream2/30 px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">Try Free — Up to 3,000 Words</Link>
          </div>
        </div>
        <div className="border border-rg-cream2/15 bg-rg-ink2/70 p-6 shadow-2xl shadow-black/30">
          <div className="border border-rg-gold/30 p-6">
            <SectionLabel>The public promise</SectionLabel>
            <h2 className="mt-4 font-rg-serif text-3xl text-rg-cream">Diagnosis first. Governed repair second.</h2>
            <p className="mt-4 text-sm leading-7 text-rg-cream2/75">
              Story architecture is assessed before refinement. The 13 criteria establish narrative viability. WAVE is the protected readiness layer used before eligible repair opportunities enter Revise.
            </p>
            <div className="mt-6 grid gap-2">
              {["Story diagnosis", "13 criteria", "Evidence layer", "WAVE readiness", "Author approval"].map((item, index) => (
                <div key={item} className="flex items-center gap-4 border border-rg-cream2/10 px-3 py-3">
                  <span className="font-rg-mono text-xs text-rg-gold">0{index + 1}</span>
                  <span className="font-rg-mono text-[0.68rem] uppercase tracking-[0.12em] text-rg-cream2/80">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 md:grid-cols-3">
          {revisionContrasts.map((item) => (
            <article key={item.title}>
              <SectionLabel>{item.title}</SectionLabel>
              <h2 className="mt-4 font-rg-serif text-3xl text-rg-cream">{item.title === "Not a chatbot" ? "Governed diagnosis." : item.title === "Not cosmetic polish" ? "Structural repair first." : "Voice protected."}</h2>
              <p className="mt-4 leading-7 text-rg-cream2/75">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="max-w-4xl">
          <SectionLabel>WAVE Readiness System™</SectionLabel>
          <h2 className="mt-4 font-rg-serif text-4xl leading-tight text-rg-cream md:text-5xl">
            WAVE is the protected readiness layer inside evaluation.
          </h2>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-rg-cream2/80">
            The WAVE Readiness System™ is not a single rewrite command. It is a proprietary, sequenced readiness methodology that turns evidence-backed findings into governed manuscript interventions while protecting the author&apos;s voice.
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {publicWaveSignals.map((signal) => (
            <article key={signal.title} className="border border-rg-cream2/12 bg-rg-ink2/60 p-5">
              <p className="font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold">WAVE principle</p>
              <h3 className="mt-4 font-rg-serif text-xl text-rg-cream">{signal.title}</h3>
              <p className="mt-3 text-sm leading-6 text-rg-cream2/75">{signal.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-rg-cream text-rg-ink">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Thirteen story criteria</p>
            <h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">
              The criteria decide whether a manuscript is ready for WAVE-level readiness analysis.
            </h2>
            <p className="mt-6 leading-8 text-rg-ink/70">
              Short-form work is evaluated against the 13 criteria only. Long-form work can activate deeper manuscript-scale diagnosis and WAVE readiness when appropriate.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {criteria.map((criterion) => (
              <div key={criterion.name} className="border border-rg-ink/15 bg-white/40 px-4 py-3">
                <p className="font-rg-mono text-[0.68rem] uppercase tracking-[0.12em] text-rg-ink/80">{criterion.name}</p>
                <p className="mt-1 text-xs leading-5 text-rg-ink/55">{criterion.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="max-w-3xl">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-4 font-rg-serif text-4xl text-rg-cream md:text-5xl">
            Evaluation first. WAVE readiness second. Revise with author control.
          </h2>
        </div>
        <div className="mt-12 grid gap-4 lg:grid-cols-5">
          {workflow.map((item) => (
            <article key={item.step} className="border border-rg-cream2/12 bg-rg-ink2/60 p-5">
              <p className="font-rg-mono text-xs text-rg-gold">{item.step}</p>
              <h3 className="mt-4 font-rg-serif text-xl text-rg-cream">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-rg-cream2/75">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-rg-cream text-rg-ink">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="max-w-3xl">
            <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Why this is different</p>
            <h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">
              The author does not need another opinion. The author needs a governed readiness path and repair workflow.
            </h2>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {alternativeContrasts.map((item) => (
              <article key={item.title} className="border border-rg-ink/12 bg-white/50 p-5">
                <p className="font-rg-mono text-xs uppercase tracking-[0.12em] text-rg-gold">{item.title}</p>
                <p className="mt-3 text-sm leading-6 text-rg-ink/75">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="border border-rg-cream2/12 bg-rg-ink2/60 p-8">
            <SectionLabel>Revise Queue</SectionLabel>
            <h2 className="mt-4 font-rg-serif text-4xl text-rg-cream">Manual repair, one opportunity at a time.</h2>
            <p className="mt-5 leading-7 text-rg-cream2/75">
              WAVE readiness findings can become RevisionOpportunity cards with evidence, severity, repair options, rationale, and explicit author decisions.
            </p>
            <Link href="/workbench" className="mt-7 inline-block font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">Open Revise Queue →</Link>
          </div>
          <div className="border border-rg-cream2/12 bg-rg-ink2/60 p-8">
            <SectionLabel>TrustedPath™</SectionLabel>
            <h2 className="mt-4 font-rg-serif text-4xl text-rg-cream">One-click governed repair for eligible manuscripts.</h2>
            <p className="mt-5 leading-7 text-rg-cream2/75">
              TrustedPath™ applies eligible recommended repairs to a duplicate manuscript draft, preserves the original, and generates a change log so convenience does not become blind rewriting.
            </p>
            <Link href="/revise" className="mt-7 inline-block font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">See Revise →</Link>
          </div>
        </div>
      </section>

      <section className="border-t border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="max-w-3xl mb-12">
            <SectionLabel>After diagnosis and repair</SectionLabel>
            <h2 className="mt-4 font-rg-serif text-4xl text-rg-cream leading-tight">
              Downstream tools for authors who are ready.
            </h2>
          </div>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="border border-rg-cream2/12 bg-rg-ink2/60 p-8">
              <SectionLabel>Agent Readiness Package™</SectionLabel>
              <h3 className="mt-4 font-rg-serif text-2xl text-rg-cream">
                Build your submission package after diagnosis.
              </h3>
              <p className="mt-4 text-sm leading-7 text-rg-cream2/75">
                Query letter, synopsis, comparables, author bio, and more — generated from your manuscript, approved section by section before export.
              </p>
              <Link href="/agent-readiness" className="mt-6 inline-block font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">Learn more →</Link>
            </div>
            <div className="border border-rg-cream2/12 bg-rg-ink2/60 p-8">
              <SectionLabel>Storygate Studio™</SectionLabel>
              <h3 className="mt-4 font-rg-serif text-2xl text-rg-cream">
                A curated access layer for readiness-vetted projects.
              </h3>
              <p className="mt-4 text-sm leading-7 text-rg-cream2/75">
                Manuscripts that clear the readiness threshold can enter a controlled environment where verified publishing professionals request access to creator-approved materials.
              </p>
              <Link href="/storygate-studio" className="mt-6 inline-block font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">Learn more →</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

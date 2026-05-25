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

const wavePhases = [
  {
    title: "Structural Integrity",
    copy: "Narrative architecture, scene function, timeline logic, POV stability, act pacing, setup, payoff, and redundancy.",
  },
  {
    title: "Character & Dialogue Systems",
    copy: "Character arc, psychology, dialogue authenticity, subtext, relationship dynamics, antagonist pressure, and voice differentiation.",
  },
  {
    title: "Theme & World Logic",
    copy: "Theme through action, environmental consistency, cultural logic, sensory texture, motif behavior, and research credibility.",
  },
  {
    title: "Pacing & Momentum",
    copy: "Scene-to-scene pressure, chapter-end hooks, middle-sag diagnosis, escalation, rest beats, information release, and climax architecture.",
  },
  {
    title: "Literary Authority",
    copy: "Breath mechanics, sound, punctuation authority, echo detection, compression, repetition control, cadence, and late-stage polish.",
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
    title: "Build the story ledger",
    copy: "Long-form work uses manuscript-scale continuity: identity, cast, POV, relationships, objects, timeline, pressure, and source integrity.",
  },
  {
    step: "04",
    title: "Route into WAVE",
    copy: "Eligible long-form manuscripts move from diagnosis into the WAVE Revision System: ordered repair waves with governance and voice protection.",
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
  "Story Ledger for long-form continuity",
  "Gate 15 overcorrection protection",
  "Revise Queue with A/B/C options",
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
    copy: "WAVE repair is bounded by evidence, ordered execution, and voice-protection rules. The author remains the final authority.",
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
          <SectionLabel>RevisionGrade™ · WAVE Revision System™</SectionLabel>
          <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-[0.95] tracking-tight text-rg-cream md:text-7xl">
            Diagnose the manuscript. Then repair it through WAVE.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-rg-cream2/85">
            RevisionGrade is a manuscript-readiness and revision system. It evaluates the story across 13 criteria, builds evidence-backed diagnosis, and routes eligible long-form work into the WAVE Revision System™ so repair happens in the right order without erasing the writer&apos;s voice.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/evaluate" className="border border-rg-gold bg-rg-gold px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-ink transition hover:bg-transparent hover:text-rg-gold">Begin Evaluation</Link>
            <Link href="/revise" className="border border-rg-cream2/30 px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">See WAVE Revise</Link>
          </div>
        </div>
        <div className="border border-rg-cream2/15 bg-rg-ink2/70 p-6 shadow-2xl shadow-black/30">
          <div className="border border-rg-gold/30 p-6">
            <SectionLabel>The public promise</SectionLabel>
            <h2 className="mt-4 font-rg-serif text-3xl text-rg-cream">Architecture → Criteria → Gate → WAVE → Readiness.</h2>
            <p className="mt-4 text-sm leading-7 text-rg-cream2/75">
              Story architecture is assessed before refinement. The 13 criteria establish narrative viability. WAVE applies ordered revision only after the manuscript earns the right kind of repair.
            </p>
            <div className="mt-6 grid gap-2">
              {["Story diagnosis", "13 criteria", "Story Ledger", "WAVE repair", "Author approval"].map((item, index) => (
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
          <SectionLabel>WAVE Revision System™</SectionLabel>
          <h2 className="mt-4 font-rg-serif text-4xl leading-tight text-rg-cream md:text-5xl">
            WAVE is the ordered repair layer after evaluation.
          </h2>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-rg-cream2/80">
            The WAVE Revision System™ is not a single rewrite command. It is a sequenced revision methodology organized into phase groups that move from structure to character, theme, momentum, and literary authority.
          </p>
        </div>
        <div className="mt-12 grid gap-4 lg:grid-cols-5">
          {wavePhases.map((phase, index) => (
            <article key={phase.title} className="border border-rg-cream2/12 bg-rg-ink2/60 p-5">
              <p className="font-rg-mono text-xs text-rg-gold">WAVE {index + 1}</p>
              <h3 className="mt-4 font-rg-serif text-xl text-rg-cream">{phase.title}</h3>
              <p className="mt-3 text-sm leading-6 text-rg-cream2/75">{phase.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-rg-cream text-rg-ink">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Thirteen story criteria</p>
            <h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">
              The criteria decide whether a manuscript is ready for WAVE-level repair.
            </h2>
            <p className="mt-6 leading-8 text-rg-ink/70">
              Short-form work is evaluated against the 13 criteria only. Long-form work can activate deeper manuscript-scale continuity and WAVE repair when appropriate.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {criteria.map((criterion) => (
              <div key={criterion} className="border border-rg-ink/15 bg-white/40 px-4 py-3 font-rg-mono text-[0.68rem] uppercase tracking-[0.12em] text-rg-ink/80">
                {criterion}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="max-w-3xl">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-4 font-rg-serif text-4xl text-rg-cream md:text-5xl">
            Evaluation first. WAVE second. Author control throughout.
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
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Why this is different</p>
            <h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">
              The author does not need another opinion. The author needs a governed repair path.
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {proofPoints.map((point) => (
              <div key={point} className="border border-rg-ink/15 bg-white/40 p-4 font-rg-mono text-xs uppercase tracking-[0.12em] text-rg-ink/80">
                {point}
              </div>
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
              WAVE findings become RevisionOpportunity cards with evidence, severity, options, rationale, and author decisions: accept, keep original, reject, defer, or write custom.
            </p>
            <Link href="/workbench" className="mt-7 inline-block font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">Open Revise Queue →</Link>
          </div>
          <div className="border border-rg-cream2/12 bg-rg-ink2/60 p-8">
            <SectionLabel>TrustedPath™</SectionLabel>
            <h2 className="mt-4 font-rg-serif text-4xl text-rg-cream">One-click governed repair for eligible manuscripts.</h2>
            <p className="mt-5 leading-7 text-rg-cream2/75">
              TrustedPath™ applies eligible recommended repairs to a duplicate manuscript draft, preserves the original, and generates a change log so convenience does not become blind rewriting.
            </p>
            <Link href="/revise" className="mt-7 inline-block font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">See WAVE Revise →</Link>
          </div>
        </div>
      </section>

      <section className="border-t border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] items-start">
            <div>
              <SectionLabel>Agent Readiness Package™</SectionLabel>
              <h2 className="mt-4 font-rg-serif text-4xl text-rg-cream md:text-5xl leading-tight">
                After readiness, build the submission package.
              </h2>
              <p className="mt-6 text-base leading-7 text-rg-cream2/75">
                Generate your query letter, synopsis, query pitch, comparables, manuscript positioning, and author bio — then approve each section before export. Built for authors who have moved from diagnosis toward submission readiness.
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
                <div key={num} className="flex items-start gap-4 border border-rg-cream2/10 bg-rg-ink px-4 py-3">
                  <span className="font-rg-mono text-xs text-rg-gold shrink-0 mt-0.5">{num}</span>
                  <div>
                    <p className="font-rg-mono text-xs uppercase tracking-[0.1em] text-rg-cream">{title}</p>
                    <p className="mt-1 font-rg-mono text-[0.6875rem] text-rg-cream2/60 leading-5">{desc}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-4 border border-rg-cream2/10 bg-rg-ink px-4 py-3 opacity-50">
                <span className="font-rg-mono text-xs text-rg-gold shrink-0 mt-0.5">07</span>
                <div>
                  <p className="font-rg-mono text-xs uppercase tracking-[0.1em] text-rg-cream2/60">Agent Targeting™ — Coming Next</p>
                  <p className="mt-1 font-rg-mono text-[0.6875rem] text-rg-cream2/40 leading-5">Find target agents. Generate agent-specific query variants.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-rg-cream2/10">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] items-start">
            <div>
              <SectionLabel>Storygate Studio™</SectionLabel>
              <h2 className="mt-4 font-rg-serif text-4xl text-rg-cream md:text-5xl leading-tight">
                A curated access layer for readiness-vetted manuscript projects.
              </h2>
              <p className="mt-6 text-base leading-7 text-rg-cream2/75">
                Manuscript projects that clear the readiness threshold can enter Storygate Studio — a controlled environment where verified publishing professionals request access to creator-approved materials.
              </p>
              <p className="mt-3 text-sm leading-7 text-rg-cream2/60">
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
                <div key={title} className="border border-rg-cream2/10 bg-rg-ink2/60 px-5 py-4">
                  <p className="font-rg-mono text-xs uppercase tracking-[0.1em] text-rg-gold">{title}</p>
                  <p className="mt-1 text-sm text-rg-cream2/65 leading-6">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

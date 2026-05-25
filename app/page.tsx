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

const workflow = [
  {
    step: "01",
    title: "Upload the manuscript",
    copy: "Start with the work itself, not a prompt fragment. RevisionGrade reads the manuscript as an editorial object with genre, length, and structural context.",
  },
  {
    step: "02",
    title: "Evaluate at the right depth",
    copy: "Short-form uses the 13 story criteria. Long-form adds manuscript-scale continuity. Multi-layer audits add deeper architecture and governance where appropriate.",
  },
  {
    step: "03",
    title: "Separate diagnosis from repair",
    copy: "The report identifies what is working, what is weak, and what must not be flattened before any revision action begins.",
  },
  {
    step: "04",
    title: "Move into the queue",
    copy: "Revision opportunities become a prioritized queue so the author can repair the manuscript deliberately instead of chasing scattered notes.",
  },
  {
    step: "05",
    title: "Protect voice while revising",
    copy: "The repair layer is designed to preserve authorial signal. Zero compression is a valid outcome when the original passage already carries the right force.",
  },
];

const proofPoints = [
  "Evidence-linked findings",
  "Short-form / long-form / multi-layer evaluation modes",
  "Separate Evaluate and Revise surfaces",
  "Queue-based repair model",
  "TrustedPath™ governed automation",
  "Author-controlled revision decisions",
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
      <section className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.08fr_0.92fr] lg:py-28">
        <div>
          <SectionLabel>RevisionGrade™</SectionLabel>
          <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-[0.95] tracking-tight text-rg-cream md:text-7xl">
            A governed revision operating system for serious manuscripts.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-rg-cream2/85">
            RevisionGrade evaluates your manuscript across 13 story criteria, explains the editorial diagnosis with evidence, and turns weaknesses into a controlled revision path without erasing the writer&apos;s voice.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/evaluate" className="border border-rg-gold bg-rg-gold px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-ink transition hover:bg-transparent hover:text-rg-gold">Begin Evaluation</Link>
            <Link href="/revise" className="border border-rg-cream2/30 px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">See Revision Workbench</Link>
          </div>
        </div>
        <div className="border border-rg-cream2/15 bg-rg-ink2/70 p-6 shadow-2xl shadow-black/30">
          <div className="border border-rg-gold/30 p-6">
            <SectionLabel>Manuscript readiness system</SectionLabel>
            <h2 className="mt-4 font-rg-serif text-3xl text-rg-cream">Thirteen dimensions. One governed diagnosis.</h2>
            <p className="mt-4 text-sm leading-7 text-rg-cream2/75">Every score is tied to evidence, editorial criteria, and a revision path the author controls.</p>
            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {criteria.map((criterion) => <div key={criterion} className="border border-rg-cream2/10 px-3 py-2 font-rg-mono text-[0.68rem] uppercase tracking-[0.12em] text-rg-cream2/80">{criterion}</div>)}
            </div>
          </div>
        </div>
      </section>
      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 md:grid-cols-3">
          <div><SectionLabel>The instrument</SectionLabel><h2 className="mt-4 font-rg-serif text-3xl text-rg-cream">Author-facing diagnosis.</h2><p className="mt-4 leading-7 text-rg-cream2/75">The report is the visible editorial instrument: scores, evidence, confidence, warnings, and revision priorities presented in language an author can act on.</p></div>
          <div><SectionLabel>The engine</SectionLabel><h2 className="mt-4 font-rg-serif text-3xl text-rg-cream">Governed execution.</h2><p className="mt-4 leading-7 text-rg-cream2/75">The pipeline exists to keep evaluation depth, criteria coverage, failure states, and repair handoff deterministic enough to trust.</p></div>
          <div><SectionLabel>The methodology</SectionLabel><h2 className="mt-4 font-rg-serif text-3xl text-rg-cream">Readable trust layer.</h2><p className="mt-4 leading-7 text-rg-cream2/75">The public methodology explains what RevisionGrade evaluates and why, without exposing private prompt internals or weakening the moat.</p></div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="max-w-3xl"><SectionLabel>How it works</SectionLabel><h2 className="mt-4 font-rg-serif text-4xl text-rg-cream md:text-5xl">Evaluation first. Revision second. Voice protected throughout.</h2></div>
        <div className="mt-12 grid gap-4 lg:grid-cols-5">
          {workflow.map((item) => <article key={item.step} className="border border-rg-cream2/12 bg-rg-ink2/60 p-5"><p className="font-rg-mono text-xs text-rg-gold">{item.step}</p><h3 className="mt-4 font-rg-serif text-xl text-rg-cream">{item.title}</h3><p className="mt-3 text-sm leading-6 text-rg-cream2/75">{item.copy}</p></article>)}
        </div>
      </section>
      <section className="bg-rg-cream text-rg-ink">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr]">
          <div><p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Reality check</p><h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">The author does not need another chatbot. The author needs a governed path.</h2></div>
          <div className="grid gap-3 sm:grid-cols-2">{proofPoints.map((point) => <div key={point} className="border border-rg-ink/15 bg-white/40 p-4 font-rg-mono text-xs uppercase tracking-[0.12em] text-rg-ink/80">{point}</div>)}</div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="border border-rg-cream2/12 bg-rg-ink2/60 p-8"><SectionLabel>Trust surface</SectionLabel><h2 className="mt-4 font-rg-serif text-4xl text-rg-cream">Reliability is not a footer link. It is part of the product promise.</h2><p className="mt-5 leading-7 text-rg-cream2/75">The Reliability page explains manuscript sovereignty, evidence-backed diagnosis, scope discipline, and author control before a writer uploads a manuscript.</p><Link href="/reliability" className="mt-7 inline-block font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">Read reliability doctrine →</Link></div>
          <div className="border border-rg-cream2/12 bg-rg-ink2/60 p-8"><SectionLabel>Conversion surface</SectionLabel><h2 className="mt-4 font-rg-serif text-4xl text-rg-cream">Pricing and resources must clarify the path.</h2><p className="mt-5 leading-7 text-rg-cream2/75">Every public navigation destination should explain the manuscript-first workflow: Evaluate, Revise, Agent Readiness, and controlled Storygate access where eligible.</p><div className="mt-7 flex flex-wrap gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]"><Link href="/pricing" className="text-rg-gold hover:text-rg-cream">Pricing →</Link><Link href="/resources" className="text-rg-gold hover:text-rg-cream">Resources →</Link></div></div>
        </div>
      </section>

      <section className="border-t border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] items-start">
            <div>
              <SectionLabel>Agent Readiness Package™</SectionLabel>
              <h2 className="mt-4 font-rg-serif text-4xl text-rg-cream md:text-5xl leading-tight">
                One manuscript. One professional submission package.
              </h2>
              <p className="mt-6 text-base leading-7 text-rg-cream2/75">
                Generate your query letter, synopsis, query pitch, comparables, manuscript positioning, and author bio — then approve each section before export. Built for authors who are ready to submit, not authors who are still drafting.
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
                ["Verified Access Only",       "Publishing users are approved before viewing any project materials."],
                ["Creator-Controlled Visibility", "Creators decide what is visible and to whom. Access requires their approval."],
                ["8.0+ Readiness Gate",        "Projects must clear a minimum readiness threshold before eligibility."],
                ["Logged Activity",             "All access events are recorded and append-only. No anonymous actions."],
                ["Not a Marketplace",           "No public search. No cold contact. No fee to submit your project."],
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

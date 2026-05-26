import Link from "next/link";
import type { ReactNode } from "react";

const resourceCards = [
  {
    title: "The Black Box Problem",
    href: "/black-box-problem",
    eyebrow: "Why RevisionGrade exists",
    copy: "Publishing gives writers verdicts, not diagnoses. This page explains how RevisionGrade separates manuscript readiness from market rejection.",
  },
  {
    title: "Methodology",
    href: "/methodology",
    eyebrow: "How evaluation works",
    copy: "The criteria, evidence model, evaluation-depth doctrine, and Evaluate → Revise bridge behind manuscript diagnosis.",
  },
  {
    title: "Reliability / Editorial Doctrine",
    href: "/reliability",
    eyebrow: "Why authors stay in control",
    copy: "Manuscript sovereignty, evidence over taste, scope discipline, voice protection, and author-in-the-loop revision.",
  },
  {
    title: "Author FAQ",
    href: "#author-faq",
    eyebrow: "Before you evaluate",
    copy: "Practical answers about scores, reports, evaluation modes, revision, human editors, and publishing outcomes.",
  },
  {
    title: "Privacy & Research Controls",
    href: "/privacy-research-controls",
    eyebrow: "Manuscript trust",
    copy: "How uploaded work is treated, what external research means, and why the author controls what happens next.",
  },
  {
    title: "Security & Access Controls",
    href: "/security",
    eyebrow: "Controlled workspace",
    copy: "A plain-language trust page covering account-gated workspaces, manuscript boundaries, controlled downloads, and logged access.",
  },
  {
    title: "Genre & Classification FAQ",
    href: "/genre-classification-faq",
    eyebrow: "Positioning matters",
    copy: "Why genre selection affects reader expectations, market positioning, and how the report interprets evidence.",
  },
  {
    title: "Storygate Studio™ FAQ",
    href: "/storygate-studio/faq",
    eyebrow: "Controlled manuscript access",
    copy: "How manuscript-only Storygate access, creator approval, package visibility, and verified publishing-professional review fit together.",
  },
  {
    title: "Agent Readiness FAQ",
    href: "/agent-readiness/faq",
    eyebrow: "Submission package support",
    copy: "How query letters, synopses, comparables, author bios, package approval, and manuscript-specific readiness materials fit together.",
  },
];

const evaluationModes = [
  {
    name: "Short-form evaluation",
    scope: "Under 25,000 words",
    copy: "For openings, chapters, excerpts, short stories, and partial submissions. Uses the 13 story criteria only; it does not claim full-manuscript continuity or WAVE-level repair governance.",
  },
  {
    name: "Long-form evaluation",
    scope: "25,000+ words",
    copy: "For substantial manuscripts where RevisionGrade can assess manuscript-scale behavior: continuity, recurrence, payoff, pacing over distance, character development, and structural readiness.",
  },
  {
    name: "Long-form multi-layer evaluation",
    scope: "Complex 25,000+ word manuscripts",
    copy: "For deeper architecture review using layered story evidence, long-form continuity, proprietary repair governance where appropriate, and structural repair priorities.",
  },
];

const authorFaqs = [
  {
    q: "What does RevisionGrade evaluate?",
    a: "RevisionGrade evaluates manuscript-level craft, structure, reader trust, and readiness across thirteen story criteria. Longer manuscripts may qualify for long-form or multi-layer analysis when there is enough text to judge manuscript-scale behavior.",
  },
  {
    q: "Is this only a score?",
    a: "No. A score is only useful when connected to evidence, confidence, issue severity, and revision priority. RevisionGrade is designed to produce diagnosis, not just a number.",
  },
  {
    q: "Does every evaluation get Golden Spine or WAVE analysis?",
    a: "No. Short-form evaluations under 25,000 words use the 13 story criteria only. Long-form and multi-layer evaluations are the appropriate contexts for manuscript-scale continuity and deeper repair-governance logic.",
  },
  {
    q: "Does RevisionGrade rewrite my voice?",
    a: "No. Revise is built around voice protection and author control. Some passages should be repaired; others should be preserved. A recommendation is not an instruction to flatten the prose.",
  },
  {
    q: "Does RevisionGrade replace human editors?",
    a: "No. RevisionGrade solves a different problem: opaque diagnosis, scope confusion, and ungoverned repair. It helps distinguish structural repair, line polish, market positioning, and voice protection before the author spends money on the wrong intervention.",
  },
  {
    q: "Does RevisionGrade guarantee publication or representation?",
    a: "No. RevisionGrade diagnoses manuscript readiness. It does not guarantee agent interest, representation, publication, sales, market timing, or commercial demand.",
  },
];

const privacyControls = [
  "Uploaded manuscripts are treated as author-owned creative work, not public content.",
  "Reports diagnose the submitted manuscript; they do not claim authorship or replace the author’s judgment.",
  "External research, where available, should support market/context checks rather than rewrite or expose manuscript text.",
  "Storygate visibility is creator-controlled and intended for approved manuscript packages, not public indexing.",
];

const genreFaqs = [
  {
    q: "Why does primary genre matter?",
    a: "Genre changes reader promises. A Gothic horror manuscript, a literary family saga, a thriller, and a memoir create different expectations for pacing, closure, marketability, and evidence interpretation.",
  },
  {
    q: "Can a manuscript have more than one genre?",
    a: "Yes. RevisionGrade can recognize hybrid signals, but the primary classification still matters because the report needs a stable shelf and reader-expectation frame.",
  },
  {
    q: "Does genre override craft diagnosis?",
    a: "No. Genre frames expectations; it does not excuse weak evidence, unclear stakes, unstable voice, or missing narrative pressure.",
  },
];

const storygateFaqs = [
  {
    q: "What is Storygate Studio right now?",
    a: "Storygate Studio is a controlled manuscript-access layer for readiness-vetted book projects and verified publishing professionals. It is manuscript-first and publishing-facing.",
  },
  {
    q: "Who controls visibility?",
    a: "The creator controls whether a manuscript project is prepared for Storygate consideration. Access should be requested, approved, and logged rather than treated as open browsing.",
  },
  {
    q: "What materials belong in a manuscript package?",
    a: "Query letter, synopsis, author bio, comparables, manuscript positioning, sample pages or manuscript access, and a readiness audit where available.",
  },
];

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">{children}</p>;
}

function SectionHeader({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="max-w-4xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">{title}</h2>
      <p className="mt-5 text-lg leading-8 text-rg-cream2/75">{copy}</p>
    </div>
  );
}

export default function ResourcesPage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto max-w-7xl px-6 py-20">
        <Eyebrow>Resources</Eyebrow>
        <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-tight md:text-6xl">
          The trust center for serious manuscript evaluation.
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-rg-cream2/80">
          Start here to understand what RevisionGrade evaluates, what it does not promise, how evaluation depth is determined, and how diagnosis turns into author-controlled revision.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resourceCards.map((item) => (
            <Link key={item.title} href={item.href} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6 transition hover:border-rg-gold/70">
              <p className="font-rg-mono text-[0.65rem] uppercase tracking-[0.18em] text-rg-gold">{item.eyebrow}</p>
              <h2 className="mt-3 font-rg-serif text-2xl text-rg-cream">{item.title}</h2>
              <p className="mt-4 leading-7 text-rg-cream2/75">{item.copy}</p>
              <p className="mt-5 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold">Open →</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <SectionHeader
            eyebrow="Evaluation depth"
            title="Different manuscript lengths need different promises."
            copy="RevisionGrade should not pretend a short excerpt can support the same diagnosis as a full manuscript. The evaluation mode controls what the report can responsibly claim."
          />
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {evaluationModes.map((mode) => (
              <article key={mode.name} className="border border-rg-cream2/12 bg-rg-ink/60 p-6">
                <p className="font-rg-mono text-[0.68rem] uppercase tracking-[0.16em] text-rg-gold">{mode.scope}</p>
                <h3 className="mt-3 font-rg-serif text-2xl text-rg-cream">{mode.name}</h3>
                <p className="mt-4 leading-7 text-rg-cream2/75">{mode.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="author-faq" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-20">
        <SectionHeader
          eyebrow="Author FAQ"
          title="Practical answers before you evaluate."
          copy="These answers keep the product promise narrow, credible, and manuscript-first: diagnosis before polish, evidence before verdict, and author control before revision."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {authorFaqs.map((item) => (
            <article key={item.q} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6">
              <h3 className="font-rg-serif text-2xl text-rg-cream">{item.q}</h3>
              <p className="mt-4 leading-7 text-rg-cream2/75">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="privacy-research-controls" className="border-y border-rg-cream2/10 bg-rg-ink2/50 scroll-mt-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.85fr_1.15fr]">
          <SectionHeader
            eyebrow="Privacy & research controls"
            title="Manuscript trust is part of the product."
            copy="This hub surfaces the current privacy doctrine. The dedicated Privacy & Research Controls page expands this into a full trust document."
          />
          <div>
            <div className="grid gap-3 sm:grid-cols-2">
              {privacyControls.map((item) => (
                <div key={item} className="border border-rg-cream2/12 bg-rg-ink/70 p-5 leading-7 text-rg-cream2/80">
                  {item}
                </div>
              ))}
            </div>
            <Link href="/privacy-research-controls" className="mt-6 inline-block font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">
              Read Privacy & Research Controls →
            </Link>
          </div>
        </div>
      </section>

      <section id="genre-classification-faq" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-20">
        <SectionHeader
          eyebrow="Genre & classification FAQ"
          title="Classification is not decoration. It controls reader expectations."
          copy="Genre and form help the system understand what kind of promise the manuscript is making before it diagnoses whether that promise holds."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {genreFaqs.map((item) => (
            <article key={item.q} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6">
              <h3 className="font-rg-serif text-2xl text-rg-cream">{item.q}</h3>
              <p className="mt-4 leading-7 text-rg-cream2/75">{item.a}</p>
            </article>
          ))}
        </div>
        <Link href="/genre-classification-faq" className="mt-8 inline-block font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">
          Open full Genre & Classification FAQ →
        </Link>
      </section>

      <section id="storygate-faq" className="border-y border-rg-cream2/10 bg-rg-ink2/50 scroll-mt-24">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <SectionHeader
            eyebrow="Storygate Studio FAQ"
            title="Controlled manuscript access, not open slush."
            copy="Storygate Studio should remain manuscript-only until additional workflows exist. The current promise is controlled discovery for readiness-vetted book projects and verified publishing professionals."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {storygateFaqs.map((item) => (
              <article key={item.q} className="border border-rg-cream2/12 bg-rg-ink/60 p-6">
                <h3 className="font-rg-serif text-2xl text-rg-cream">{item.q}</h3>
                <p className="mt-4 leading-7 text-rg-cream2/75">{item.a}</p>
              </article>
            ))}
          </div>
          <Link href="/storygate-studio/faq" className="mt-8 inline-block font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">
            Open full Storygate Studio FAQ →
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <Eyebrow>Start with diagnosis</Eyebrow>
        <h2 className="mt-5 font-rg-serif text-4xl leading-tight md:text-5xl">
          Before you submit, know where the manuscript stands.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl leading-8 text-rg-cream2/75">
          Use the resource path to understand the standard, then begin a manuscript evaluation when you are ready for evidence-backed diagnosis.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]">
          <Link href="/evaluate" className="border border-rg-gold bg-rg-gold px-5 py-3 text-rg-ink transition hover:bg-transparent hover:text-rg-gold">Begin Evaluation</Link>
          <Link href="/black-box-problem" className="border border-rg-cream2/30 px-5 py-3 text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">Read the Black Box Problem</Link>
        </div>
      </section>
    </div>
  );
}

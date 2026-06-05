import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "RevisionGrade Resources | The Literary AI Partner",
  description:
    "Resource hub for RevisionGrade: manuscript evaluation, AI novel critique, author-controlled revision, agent readiness, privacy, methodology, and proof-report pages.",
};

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
    href: "/faq",
    eyebrow: "Before you evaluate",
    copy: "Practical answers about scores, reports, evaluation modes, revision, human editors, and publishing outcomes.",
  },
  {
    title: "Dashboard Examples",
    href: "/dashboard-examples",
    eyebrow: "Progress over time",
    copy: "Visual examples of readiness trends, issue reduction, recent wins, and how the author dashboard turns evaluation into a progress ledger.",
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

const searchGuideCards = [
  {
    title: "The Literary AI Partner™",
    href: "/literary-ai-partner",
    eyebrow: "Category claim",
    copy: "RevisionGrade’s public category page: manuscript diagnosis, author-controlled revision, and professional submission preparation for serious writers.",
  },
  {
    title: "AI Manuscript Evaluation",
    href: "/ai-manuscript-evaluation",
    eyebrow: "Evaluation guide",
    copy: "A search-focused guide explaining manuscript evaluation, criteria, evidence, confidence, and why diagnosis comes before revision.",
  },
  {
    title: "AI Novel Critique",
    href: "/ai-novel-critique",
    eyebrow: "Proof hub",
    copy: "The main proof page for public-domain sample reports and founder evaluation case studies. Evaluation reports only, no full novels.",
  },
  {
    title: "Manuscript Revision Software",
    href: "/manuscript-revision-software",
    eyebrow: "Revision guide",
    copy: "Explains the author-controlled Revise workflow and why evidence-backed repair is different from blind AI rewriting.",
  },
  {
    title: "Novel Revision Tool",
    href: "/novel-revision-tool",
    eyebrow: "Revision guide",
    copy: "A focused guide for novelists who need story diagnosis, revision priorities, voice protection, and submission preparation.",
  },
  {
    title: "Developmental Editing AI",
    href: "/developmental-editing-ai",
    eyebrow: "Editing guide",
    copy: "Positions RevisionGrade against developmental-editing needs: scene construction, scene function, reader trust, and author sovereignty.",
  },
  {
    title: "Manuscript Readiness Report",
    href: "/manuscript-readiness-report",
    eyebrow: "Report guide",
    copy: "Explains readiness reporting, evidence-backed scores, limitations, and how a report should lead into revision or submission preparation.",
  },
  {
    title: "Query Letter and Synopsis Generator",
    href: "/query-letter-synopsis-generator",
    eyebrow: "Agent readiness guide",
    copy: "Explains query letters, synopsis support, pitch paragraphs, comparables, positioning, and author bio preparation after diagnosis.",
  },
  {
    title: "AI Editor for Novels",
    href: "/ai-editor-for-novels",
    eyebrow: "Comparison guide",
    copy: "Answers the AI-editor search intent while making clear that RevisionGrade starts with diagnosis rather than automatic rewriting.",
  },
];

const samplePages = [
  {
    title: "The Awakening",
    href: "/sample-ai-novel-critique-the-awakening",
    eyebrow: "Public-domain sample",
    copy: "Prepared for a quality-gated PDF evaluation report showing how RevisionGrade handles literary interiority, theme, pacing, and closure.",
  },
  {
    title: "Dracula",
    href: "/sample-ai-novel-critique-dracula",
    eyebrow: "Public-domain sample",
    copy: "Prepared for a quality-gated PDF evaluation report showing atmosphere, epistolary structure, threat escalation, and Gothic promise-keeping.",
  },
  {
    title: "The Wonderful Wizard of Oz",
    href: "/sample-ai-novel-critique-wizard-of-oz",
    eyebrow: "Public-domain sample",
    copy: "Prepared for a quality-gated PDF evaluation report showing quest structure, world logic, wonder, character function, and closure.",
  },
];

const founderPages = [
  {
    title: "Cartel Babies",
    href: "/founder-case-study-cartel-babies",
    eyebrow: "Founder case study",
    copy: "Evaluation-report-only case study for an upmarket suspense manuscript. The manuscript itself is not publicly available on the page.",
  },
  {
    title: "Let the River Decide",
    href: "/founder-case-study-let-the-river-decide",
    eyebrow: "Founder case study",
    copy: "Evaluation-report-only case study for an upmarket eco-thriller manuscript. No full manuscript text is published.",
  },
  {
    title: "The Lost World of MythOAmphibia",
    href: "/founder-case-study-lost-world-of-mythoamphibia",
    eyebrow: "Founder case study",
    copy: "Evaluation-report-only case study for a mythic eco-fantasy manuscript. Built for diagnosis proof, not manuscript disclosure.",
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

function CardGrid({ items }: { items: typeof resourceCards }) {
  return (
    <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6 transition hover:border-rg-gold/70">
          <p className="font-rg-mono text-[0.65rem] uppercase tracking-[0.18em] text-rg-gold">{item.eyebrow}</p>
          <h3 className="mt-3 font-rg-serif text-2xl text-rg-cream">{item.title}</h3>
          <p className="mt-4 leading-7 text-rg-cream2/75">{item.copy}</p>
          <p className="mt-5 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold">Open →</p>
        </Link>
      ))}
    </div>
  );
}

export default function ResourcesPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "RevisionGrade Resources",
    description:
      "Resource hub for RevisionGrade, The Literary AI Partner for manuscript diagnosis, author-controlled revision, and professional submission preparation.",
    url: "https://www.revisiongrade.com/resources",
    isPartOf: {
      "@type": "WebSite",
      name: "RevisionGrade",
      url: "https://www.revisiongrade.com",
    },
  };

  return (
    <div className="bg-rg-ink text-rg-cream">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="mx-auto max-w-7xl px-6 py-20">
        <Eyebrow>Resources</Eyebrow>
        <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-tight md:text-6xl">
          The resource hub for RevisionGrade™, The Literary AI Partner™.
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-rg-cream2/80">
          Start here to understand what RevisionGrade evaluates, what it does not promise, how evaluation depth is determined, and how diagnosis turns into author-controlled revision and professional submission preparation.
        </p>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <SectionHeader
            eyebrow="Search guides"
            title="Guides built for the questions serious writers actually search."
            copy="These top-level pages help writers, Google, and AI search systems understand RevisionGrade’s category: manuscript evaluation, novel critique, revision software, readiness reports, and agent-facing preparation."
          />
          <CardGrid items={searchGuideCards} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeader
          eyebrow="Proof reports"
          title="Sample evaluations and founder case studies will prove the system without publishing manuscripts."
          copy="These pages are placeholders for quality-gated PDF evaluation reports. They are designed for report proof only: no full novels, no full chapters, and no extended copyrighted manuscript text."
        />
        <div className="mt-12">
          <h3 className="font-rg-serif text-3xl text-rg-cream">Public-domain sample evaluations</h3>
          <CardGrid items={samplePages} />
        </div>
        <div className="mt-14">
          <h3 className="font-rg-serif text-3xl text-rg-cream">Founder evaluation case studies</h3>
          <CardGrid items={founderPages} />
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <SectionHeader
            eyebrow="Trust center"
            title="Doctrine, methodology, privacy, and author-control pages."
            copy="These pages keep the product promise narrow, credible, and manuscript-first: diagnosis before polish, evidence before verdict, and author control before revision."
          />
          <CardGrid items={resourceCards} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeader
          eyebrow="Evaluation depth"
          title="Different manuscript lengths need different promises."
          copy="RevisionGrade should not pretend a short excerpt can support the same diagnosis as a full manuscript. The evaluation mode controls what the report can responsibly claim."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {evaluationModes.map((mode) => (
            <article key={mode.name} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6">
              <p className="font-rg-mono text-[0.68rem] uppercase tracking-[0.16em] text-rg-gold">{mode.scope}</p>
              <h3 className="mt-3 font-rg-serif text-2xl text-rg-cream">{mode.name}</h3>
              <p className="mt-4 leading-7 text-rg-cream2/75">{mode.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="author-faq" className="border-y border-rg-cream2/10 bg-rg-ink2/50 scroll-mt-24">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <SectionHeader
            eyebrow="Author FAQ"
            title="Practical answers before you evaluate."
            copy="Short answers for the most important product boundaries: what RevisionGrade evaluates, what reports mean, what remains author-controlled, and what no evaluation can promise."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {authorFaqs.map((item) => (
              <article key={item.q} className="border border-rg-cream2/12 bg-rg-ink/60 p-6">
                <h3 className="font-rg-serif text-2xl text-rg-cream">{item.q}</h3>
                <p className="mt-4 leading-7 text-rg-cream2/75">{item.a}</p>
              </article>
            ))}
          </div>
          <Link href="/faq" className="mt-8 inline-block font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">
            Open full Author FAQ →
          </Link>
        </div>
      </section>

      <section id="privacy-research-controls" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-20">
        <SectionHeader
          eyebrow="Privacy & research controls"
          title="Manuscript trust is part of the product."
          copy="This hub surfaces the current privacy doctrine. The dedicated Privacy & Research Controls page expands this into a full trust document."
        />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {privacyControls.map((item) => (
            <div key={item} className="border border-rg-cream2/12 bg-rg-ink2/70 p-5 leading-7 text-rg-cream2/80">
              {item}
            </div>
          ))}
        </div>
        <Link href="/privacy-research-controls" className="mt-8 inline-block font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">
          Read Privacy & Research Controls →
        </Link>
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
          <Link href="/ai-novel-critique" className="border border-rg-cream2/30 px-5 py-3 text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">View Proof Pages</Link>
        </div>
      </section>
    </div>
  );
}

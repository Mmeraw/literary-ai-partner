import Link from "next/link";
import type { ReactNode } from "react";

const principles = [
  {
    title: "Manuscript sovereignty",
    copy: "The manuscript remains the author’s creative property. RevisionGrade evaluates submitted text to produce diagnosis, reports, and revision options; it does not claim authorship or replace the writer’s judgment.",
  },
  {
    title: "Manuscript-first analysis",
    copy: "Evaluation should begin with the submitted pages, not internet assumptions. External context may support classification, market shelf, or comparables, but it must not override the manuscript evidence.",
  },
  {
    title: "Research by permission and purpose",
    copy: "External research should be bounded to a clear purpose: genre context, public-domain comparison, market positioning, or factual plausibility checks. It should not become broad manuscript sharing.",
  },
  {
    title: "Author-controlled visibility",
    copy: "Storygate Studio and Agent Readiness materials should remain controlled surfaces. Manuscript packages are not meant to become publicly indexed pages or open browsing inventory.",
  },
];

const researchModes = [
  {
    name: "Manuscript-only mode",
    status: "Default trust posture",
    copy: "The report relies on the submitted manuscript and RevisionGrade’s editorial criteria. This is the safest mode when the author wants diagnosis without external context.",
  },
  {
    name: "Bounded context mode",
    status: "Optional support",
    copy: "Public information may support genre, shelf, comparables, or factual plausibility checks. The purpose should be clear and limited, and the manuscript remains the primary authority.",
  },
  {
    name: "Package-preparation mode",
    status: "Author-controlled output",
    copy: "Query materials, synopsis, comparables, author bio, and Storygate package text may be prepared from the report and author-approved materials rather than exposed automatically.",
  },
];

const manuscriptLifecycle = [
  {
    step: "Upload or paste",
    copy: "The author submits writing for evaluation through the product workspace.",
  },
  {
    step: "Evaluate",
    copy: "RevisionGrade produces diagnosis, scores, evidence, report sections, and revision priorities based on the submitted text and selected workflow.",
  },
  {
    step: "Revise",
    copy: "Recommendations become author-controlled decisions: accept, keep original, reject, defer, write custom, or use a governed TrustedPath flow where available.",
  },
  {
    step: "Export or package",
    copy: "Reports and prepared materials may be downloaded or assembled into manuscript-facing submission assets under the author’s control.",
  },
];

const guardrails = [
  "No public indexing of manuscripts by default.",
  "No unsupported promise of publication, agent interest, or market outcome.",
  "No blind rewriting that overwrites the author’s original manuscript.",
  "No treating external search results as stronger than manuscript evidence.",
  "No broad screen, film, TV, or adaptation routing until those workflows exist.",
  "No final revision without author review or an explicit governed automation path.",
];

const faqs = [
  {
    q: "Are manuscripts used to train public AI models?",
    a: "RevisionGrade’s public trust posture is no: submitted manuscripts are author-owned creative work and are not positioned as model-training material. They are used to generate the requested evaluation, report, revision guidance, and author-controlled package outputs.",
  },
  {
    q: "Can RevisionGrade use external research?",
    a: "Only in bounded ways. External research should support context such as genre, comparables, public-domain reference, market shelf, or factual plausibility. It should not replace evidence from the manuscript or become uncontrolled manuscript sharing.",
  },
  {
    q: "Can I keep an evaluation manuscript-only?",
    a: "Yes. Manuscript-only analysis is the safest default framing: the report reads the submitted text through RevisionGrade’s criteria without relying on outside material for the core diagnosis.",
  },
  {
    q: "Does Storygate make my project public?",
    a: "Storygate is intended as controlled manuscript access for readiness-vetted book projects and verified publishing professionals, not public posting. Project visibility should be creator-approved and access should be logged.",
  },
  {
    q: "Who decides whether a proposed revision becomes part of the manuscript?",
    a: "The author does. RevisionGrade may diagnose, recommend, and organize repair opportunities, but author choice governs what enters the manuscript or package.",
  },
  {
    q: "Is this a legal privacy policy?",
    a: "No. This is a plain-language product trust page explaining the editorial and research-control posture. Formal account terms and privacy policies should govern legal specifics.",
  },
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

export default function PrivacyResearchControlsPage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <Eyebrow>Privacy & Research Controls</Eyebrow>
          <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-[0.98] tracking-tight md:text-7xl">
            Manuscript trust is part of the product.
          </h1>
          <p className="mt-8 max-w-3xl text-lg leading-8 text-rg-cream2/85">
            RevisionGrade is built around a simple boundary: your manuscript is not raw material for public exposure. The system may diagnose, recommend, and help package the work, but the author controls visibility, revision decisions, and the path from report to submission.
          </p>
          <div className="mt-10 flex flex-wrap gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]">
            <Link href="/evaluate" className="border border-rg-gold bg-rg-gold px-5 py-3 text-rg-ink transition hover:bg-transparent hover:text-rg-gold">Begin Evaluation</Link>
            <Link href="/resources" className="border border-rg-cream2/30 px-5 py-3 text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">Back to Resources</Link>
          </div>
        </div>

        <div className="border border-rg-gold/35 bg-rg-ink2/70 p-7">
          <Eyebrow>Plain-language standard</Eyebrow>
          <h2 className="mt-4 font-rg-serif text-3xl leading-tight">Author-owned. Evidence-led. Controlled by consent.</h2>
          <div className="mt-6 space-y-3 text-sm leading-7 text-rg-cream2/80">
            <p>Manuscript diagnosis starts with the submitted text.</p>
            <p>External research, when used, should be bounded to context and plausibility.</p>
            <p>Revision recommendations remain proposals until the author decides what happens next.</p>
          </div>
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <SectionHeading
            eyebrow="Trust principles"
            title="Four rules govern manuscript handling."
            copy="These are product promises for how RevisionGrade should treat submitted prose, evaluation evidence, external context, and downstream manuscript packages."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {principles.map((item) => (
              <article key={item.title} className="border border-rg-cream2/12 bg-rg-ink/70 p-6">
                <h3 className="font-rg-serif text-2xl text-rg-cream">{item.title}</h3>
                <p className="mt-4 leading-7 text-rg-cream2/75">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr]">
        <SectionHeading
          eyebrow="Research controls"
          title="External context should be bounded, not open-ended."
          copy="A manuscript evaluation should not become an uncontrolled web search. Research modes should be explicit, purposeful, and subordinate to the text."
        />
        <div className="space-y-4">
          {researchModes.map((mode) => (
            <article key={mode.name} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6">
              <p className="font-rg-mono text-[0.68rem] uppercase tracking-[0.16em] text-rg-gold">{mode.status}</p>
              <h3 className="mt-3 font-rg-serif text-2xl text-rg-cream">{mode.name}</h3>
              <p className="mt-4 leading-7 text-rg-cream2/75">{mode.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <SectionHeading
            eyebrow="Manuscript lifecycle"
            title="What happens after an author submits work?"
            copy="The product path should stay understandable: upload, evaluate, revise by decision, then export or package only when the author chooses."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {manuscriptLifecycle.map((item, index) => (
              <article key={item.step} className="border border-rg-cream2/12 bg-rg-ink/70 p-5">
                <p className="font-rg-mono text-xs text-rg-gold">0{index + 1}</p>
                <h3 className="mt-3 font-rg-serif text-2xl text-rg-cream">{item.step}</h3>
                <p className="mt-4 text-sm leading-7 text-rg-cream2/75">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading
          eyebrow="Guardrails"
          title="What RevisionGrade should not do."
          copy="Clear negative promises are part of trust. They prevent the product from drifting into public exposure, unsupported market claims, or blind rewriting."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {guardrails.map((item) => (
            <div key={item} className="border border-rg-cream2/12 bg-rg-ink2/60 p-5 leading-7 text-rg-cream2/80">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <SectionHeading
            eyebrow="Privacy FAQ"
            title="Direct answers for manuscript trust."
            copy="This page is intentionally plain-spoken so authors can understand the trust model before uploading serious work."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {faqs.map((item) => (
              <article key={item.q} className="border border-rg-cream2/12 bg-rg-ink/70 p-6">
                <h3 className="font-rg-serif text-2xl text-rg-cream">{item.q}</h3>
                <p className="mt-4 leading-7 text-rg-cream2/75">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <Eyebrow>Author control</Eyebrow>
        <h2 className="mt-5 font-rg-serif text-4xl leading-tight md:text-5xl">
          Diagnosis should make the author more informed, not less in control.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl leading-8 text-rg-cream2/75">
          Read the methodology next, or begin with a manuscript-only evaluation when you are ready.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]">
          <Link href="/methodology" className="border border-rg-cream2/30 px-5 py-3 text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">Read Methodology</Link>
          <Link href="/evaluate" className="border border-rg-gold bg-rg-gold px-5 py-3 text-rg-ink transition hover:bg-transparent hover:text-rg-gold">Begin Evaluation</Link>
        </div>
      </section>
    </div>
  );
}

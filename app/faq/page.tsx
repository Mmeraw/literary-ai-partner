import Link from "next/link";
import type { ReactNode } from "react";

const faqSections = [
  {
    label: "Evaluation basics",
    items: [
      {
        q: "What does RevisionGrade evaluate?",
        a: "RevisionGrade evaluates manuscript readiness across thirteen story criteria: concept, narrative drive, character, voice, scene construction, dialogue, theme, worldbuilding, pacing, prose control, tone, narrative closure, and marketability. The goal is diagnosis, not generic encouragement or a single opaque score.",
      },
      {
        q: "Is RevisionGrade only a score?",
        a: "No. The score is useful only when paired with evidence, severity, confidence, reader effect, and revision priority. RevisionGrade is designed to explain why a manuscript is or is not ready, not merely label it good or bad.",
      },
      {
        q: "Does RevisionGrade guarantee publication or representation?",
        a: "No. RevisionGrade diagnoses manuscript readiness. It cannot guarantee agent interest, representation, publication, sales, market timing, or commercial demand.",
      },
      {
        q: "Can a strong manuscript still be rejected by agents?",
        a: "Yes. A manuscript can be craft-ready and still be rejected because of list fit, market timing, category preference, agent bandwidth, comparable-title concerns, or simple subjectivity. RevisionGrade helps separate readiness problems from market-door problems.",
      },
    ],
  },
  {
    label: "Evaluation modes",
    items: [
      {
        q: "What is a short-form evaluation?",
        a: "Short-form evaluation is for submissions under 25,000 words. It evaluates the submitted pages against the 13 story criteria only. It should not claim full-manuscript continuity, Golden Spine, or WAVE-level repair governance.",
      },
      {
        q: "What is a long-form evaluation?",
        a: "Long-form evaluation begins at 25,000+ words. At that length, RevisionGrade can evaluate manuscript-scale behavior such as continuity, recurrence, setup and payoff, pacing over distance, character development, structural readiness, and cumulative reader experience.",
      },
      {
        q: "What is a long-form multi-layer evaluation?",
        a: "Long-form multi-layer evaluation is the deeper architecture path for complex manuscripts. It may use layered story evidence, long-form continuity, Golden Spine/WAVE governance where appropriate, and deeper structural repair priorities.",
      },
      {
        q: "Does every evaluation receive WAVE analysis?",
        a: "No. WAVE belongs to eligible long-form or multi-layer contexts. Short excerpts should not be marketed or interpreted as if they received full-manuscript repair-governance treatment.",
      },
    ],
  },
  {
    label: "Reports and downloads",
    items: [
      {
        q: "What do I receive after an evaluation?",
        a: "A completed evaluation should give you a readable report with scores, evidence-backed findings, strengths, risks, criteria-level diagnosis, and revision priorities appropriate to the selected evaluation depth.",
      },
      {
        q: "Are downloaded reports professional enough to keep or share?",
        a: "Report downloads are intended to be author-facing artifacts, not machine logs. The PDF should feel like the prestige document; DOCX and TXT exports remain useful utility formats for review, records, or later editing.",
      },
      {
        q: "Why does the report include confidence or severity?",
        a: "Confidence and severity help prevent overreach. A low-confidence observation should not be treated like a proven structural defect, and a small local issue should not be handled like a manuscript-level failure.",
      },
      {
        q: "Can I use the report with a human editor?",
        a: "Yes. A RevisionGrade report can help clarify whether the manuscript needs structure, scene repair, line polish, market positioning, voice protection, or another specific intervention before you hire or brief a human editor.",
      },
    ],
  },
  {
    label: "Revise and TrustedPath™",
    items: [
      {
        q: "What is Revise?",
        a: "Revise turns evaluation findings into controlled repair opportunities. Each opportunity should show evidence, diagnosis, repair options, voice-risk considerations, and an explicit author decision path.",
      },
      {
        q: "What do A, B, and C mean in the repair options?",
        a: "A is the recommended repair, the best default fix with the least unnecessary disruption. B is a rhythm or conservative variant. C is a bolder rendering shift that may be more interpretive while still remaining within the repair goal.",
      },
      {
        q: "Can I write my own revision instead of choosing A, B, or C?",
        a: "Yes. The author should be able to accept a proposed option, keep the original, reject all choices, defer the issue, or write a custom revision. Author control is part of the product doctrine.",
      },
      {
        q: "What is TrustedPath™?",
        a: "TrustedPath™ is the governed convenience path for authors who do not want to review every repair opportunity manually. It should apply eligible recommended repairs to a protected duplicate draft, preserve the original, and produce a change log.",
      },
    ],
  },
  {
    label: "Privacy, security, and author control",
    items: [
      {
        q: "Who owns my manuscript?",
        a: "You do. RevisionGrade treats submitted manuscripts as author-owned creative work. The system may diagnose, organize, and recommend, but it does not claim authorship.",
      },
      {
        q: "Are manuscripts public?",
        a: "No. The product posture is private by default and shared only by author action, such as downloading a report or preparing a controlled package surface.",
      },
      {
        q: "Are manuscripts used to train public AI models?",
        a: "RevisionGrade’s public trust posture is no: submitted manuscripts are author-owned creative work and are not positioned as model-training material. They are used to generate the requested evaluation, report, revision guidance, and author-controlled outputs.",
      },
      {
        q: "Can external research be used?",
        a: "External research should be bounded and purposeful. It may support genre context, public-domain comparison, comparables, market shelf, or factual plausibility, but it should not override the submitted manuscript evidence.",
      },
    ],
  },
  {
    label: "Agent Readiness and Storygate Studio™",
    items: [
      {
        q: "What is Agent Readiness Package™?",
        a: "Agent Readiness Package™ helps prepare publishing-facing submission materials such as query letters, synopses, author bios, comparables, and manuscript positioning. It does not guarantee agent interest.",
      },
      {
        q: "What is Storygate Studio™ right now?",
        a: "Storygate Studio™ is a controlled manuscript-access layer for readiness-vetted book projects and verified publishing professionals. Current public scope is manuscript-first and publishing-facing.",
      },
      {
        q: "Does Storygate include film, TV, screenplay, or adaptation workflows?",
        a: "Not in the current public scope. Storygate should stay focused on books, manuscripts, query packages, synopses, author bios, comparables, and controlled publishing-facing access until additional workflows exist.",
      },
      {
        q: "Does Storygate make my project visible to everyone?",
        a: "No. Storygate is intended as controlled access, not open slush or public indexing. Creator approval, access control, and logging should govern visibility.",
      },
    ],
  },
];

const quickLinks = [
  ["Evaluate", "/evaluate"],
  ["Methodology", "/methodology"],
  ["Reliability", "/reliability"],
  ["Privacy Controls", "/privacy-research-controls"],
  ["Security", "/security"],
  ["Agent Readiness FAQ", "/agent-readiness/faq"],
  ["Storygate FAQ", "/storygate-studio/faq"],
];

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">{children}</p>;
}

export default function AuthorFaqPage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <Eyebrow>Author FAQ</Eyebrow>
          <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-[0.98] tracking-tight md:text-7xl">
            Straight answers before you upload serious work.
          </h1>
          <p className="mt-8 max-w-3xl text-lg leading-8 text-rg-cream2/85">
            RevisionGrade is built to separate manuscript readiness from the publishing black box. This FAQ explains what the system evaluates, what it does not promise, how revision works, and where author control remains absolute.
          </p>
          <div className="mt-10 flex flex-wrap gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]">
            <Link href="/evaluate" className="border border-rg-gold bg-rg-gold px-5 py-3 text-rg-ink transition hover:bg-transparent hover:text-rg-gold">Begin Evaluation</Link>
            <Link href="/resources" className="border border-rg-cream2/30 px-5 py-3 text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">Resources Hub</Link>
          </div>
        </div>

        <div className="border border-rg-gold/35 bg-rg-ink2/70 p-7">
          <Eyebrow>Current scope</Eyebrow>
          <h2 className="mt-4 font-rg-serif text-3xl leading-tight">Manuscripts, readiness, revision, and publishing-facing preparation.</h2>
          <p className="mt-5 text-sm leading-7 text-rg-cream2/80">
            This FAQ intentionally avoids unsupported film, TV, screenplay, and adaptation claims. The current product promise is manuscript-first.
          </p>
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <Eyebrow>Quick path</Eyebrow>
          <div className="mt-6 flex flex-wrap gap-3">
            {quickLinks.map(([label, href]) => (
              <Link key={href} href={href} className="border border-rg-cream2/15 bg-rg-ink/70 px-4 py-3 font-rg-mono text-xs uppercase tracking-[0.16em] text-rg-cream2 transition hover:border-rg-gold hover:text-rg-gold">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {faqSections.map((section, sectionIndex) => (
        <section key={section.label} className={sectionIndex % 2 === 0 ? "mx-auto max-w-7xl px-6 py-20" : "border-y border-rg-cream2/10 bg-rg-ink2/50"}>
          <div className={sectionIndex % 2 === 0 ? "" : "mx-auto max-w-7xl px-6 py-20"}>
            <Eyebrow>{section.label}</Eyebrow>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {section.items.map((item) => (
                <article key={item.q} className="border border-rg-cream2/12 bg-rg-ink/70 p-6">
                  <h2 className="font-rg-serif text-2xl text-rg-cream">{item.q}</h2>
                  <p className="mt-4 leading-7 text-rg-cream2/75">{item.a}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <Eyebrow>Next step</Eyebrow>
        <h2 className="mt-5 font-rg-serif text-4xl leading-tight md:text-5xl">
          The best answer is still the manuscript evidence.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl leading-8 text-rg-cream2/75">
          Read the methodology for the evaluation model, or begin an evaluation when you are ready to see where the manuscript stands.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]">
          <Link href="/methodology" className="border border-rg-cream2/30 px-5 py-3 text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">Read Methodology</Link>
          <Link href="/evaluate" className="border border-rg-gold bg-rg-gold px-5 py-3 text-rg-ink transition hover:bg-transparent hover:text-rg-gold">Begin Evaluation</Link>
        </div>
      </section>
    </div>
  );
}

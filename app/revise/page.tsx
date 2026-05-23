import Link from "next/link";

const layers = [
  {
    title: "Evaluate",
    label: "Diagnosis",
    copy: "The manuscript is evaluated first so revision starts from an evidence-backed editorial diagnosis, not a vague instruction to improve.",
  },
  {
    title: "Revise",
    label: "Repair queue",
    copy: "Findings become prioritized opportunities with evidence, rationale, and options the author can accept, reject, or rewrite.",
  },
  {
    title: "Trustpath",
    label: "Continuity",
    copy: "The repair layer preserves what already works, tracks decisions, and keeps voice protection visible instead of silently flattening prose.",
  },
];

const queueItems = [
  "Evidence-backed problem statement",
  "Affected criterion and severity",
  "Original passage context",
  "Revision options with rationale",
  "Author action: accept, reject, defer, rewrite",
  "Voice-protection warning when compression would damage the text",
];

const reasoningChain = [
  "What the manuscript is trying to do",
  "Where the current passage succeeds",
  "Where the current passage weakens the effect",
  "Which criterion is implicated",
  "What repair would improve the reader experience",
  "What must be preserved so the author's voice survives",
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">{children}</p>;
}

export default function RevisePage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1fr_1fr]">
        <div>
          <Eyebrow>RevisionGrade™ Revise</Eyebrow>
          <h1 className="mt-6 font-rg-serif text-5xl leading-[0.95] tracking-tight md:text-7xl">
            The governed repair layer after evaluation.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-rg-cream2/85">
            Revise is not a rewrite button. It is the workspace where evaluation findings become ordered repair decisions, with author control and voice protection kept in the foreground.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/evaluate" className="border border-rg-gold bg-rg-gold px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-ink transition hover:bg-transparent hover:text-rg-gold">
              Start Evaluation
            </Link>
            <Link href="/workbench" className="border border-rg-cream2/30 px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">
              Open Workbench
            </Link>
          </div>
        </div>

        <div className="border border-rg-cream2/15 bg-rg-ink2/70 p-6">
          <Eyebrow>Queue primitive</Eyebrow>
          <h2 className="mt-4 font-rg-serif text-3xl">RevisionOpportunity</h2>
          <p className="mt-4 text-sm leading-7 text-rg-cream2/75">
            The core object is a specific opportunity to improve the manuscript, anchored to evidence and constrained by what the author must not lose.
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
          <Eyebrow>Three layers, one primitive</Eyebrow>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {layers.map((layer) => (
              <article key={layer.title} className="border border-rg-cream2/12 bg-rg-ink/70 p-6">
                <p className="font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold">{layer.label}</p>
                <h2 className="mt-4 font-rg-serif text-3xl">{layer.title}</h2>
                <p className="mt-4 leading-7 text-rg-cream2/75">{layer.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Eyebrow>Reasoning chain</Eyebrow>
          <h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">
            Every repair should explain why it exists.
          </h2>
          <p className="mt-6 leading-8 text-rg-cream2/75">
            The point is not to replace the author. The point is to make revision decisions legible, bounded, and reversible.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {reasoningChain.map((item, index) => (
            <div key={item} className="border border-rg-cream2/12 bg-rg-ink2/60 p-5">
              <p className="font-rg-mono text-xs text-rg-gold">0{index + 1}</p>
              <p className="mt-3 leading-7 text-rg-cream2/85">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-rg-cream text-rg-ink">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-2">
          <div>
            <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Long-form architecture</p>
            <h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">Novel-scale revision needs continuity, not one-off line edits.</h2>
          </div>
          <div className="space-y-5 text-lg leading-8 text-rg-ink/75">
            <p>
              For manuscripts over 25,000 words, revision must respect long-form structure: recurring character behavior, scene function, pacing, voice, thematic pressure, and the cumulative effect of earlier decisions.
            </p>
            <p>
              That is why Revise follows Evaluate. The system should know what the manuscript is before it proposes how to repair it.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="border border-rg-gold/35 bg-rg-ink2/60 p-8 md:p-10">
          <Eyebrow>Contract</Eyebrow>
          <h2 className="mt-4 max-w-4xl font-rg-serif text-4xl leading-tight md:text-5xl">
            Revise should make the manuscript stronger without making it sound less like itself.
          </h2>
          <p className="mt-6 max-w-3xl leading-8 text-rg-cream2/75">
            The author remains the final authority. RevisionGrade supplies the queue, evidence, options, and guardrails so the writer can make better decisions faster.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/pricing" className="font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">See pricing →</Link>
            <Link href="/resources" className="font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">Read resources →</Link>
            <Link href="/reliability" className="font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">Reliability →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

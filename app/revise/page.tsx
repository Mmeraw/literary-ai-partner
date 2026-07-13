import Link from "next/link";
import type { ReactNode } from "react";
import ReviseQueueDemo from "@/components/revise/ReviseQueueDemo";

const queueItems = [
  "Evidence-backed problem statement",
  "Affected criterion, severity, and confidence",
  "Original passage or evidence anchor",
  "One explicit card type: Copy-Paste, Strategy, or Held",
  "Only legal actions for that card type",
  "Voice, canon, and continuity safeguards",
];

const cardTypes = [
  {
    eyebrow: "Executable repair",
    title: "Copy-Paste Rewrite",
    copy: "A bounded passage repair with three complete, distinct replacement strings. This is the only card type that shows A/B/C and Accept controls.",
    details: ["A — Recommended repair", "B — Rhythm variant", "C — Bolder rendering shift", "Trusted Path may apply A when eligible"],
  },
  {
    eyebrow: "Human-guided repair",
    title: "Revision Strategy",
    copy: "One coherent repair plan for structural, scene-level, or context-sensitive work that cannot honestly be reduced to a local replacement passage.",
    details: ["One recommended strategy", "Implementation sequence", "Optional subordinate approaches", "No A/B/C and no Accept controls"],
  },
  {
    eyebrow: "Diagnostic hold",
    title: "Held Item",
    copy: "A transparent explanation that the evidence, context, canon, or grounding is not yet strong enough to support an interactive repair.",
    details: ["Why the item was held", "What context is missing", "How to recover it", "No generated candidate prose"],
  },
];

const manualDecisions = [
  "Accept A, B, or C on Copy-Paste cards",
  "Keep original",
  "Write a custom rewrite or plan",
  "Defer for later",
  "Reject the recommendation",
  "Request re-analysis when supported",
];

const trustedPathSafeguards = [
  "Applies A only on eligible Copy-Paste cards",
  "Never applies Strategy or Held items",
  "Creates a protected revised draft",
  "Preserves the original manuscript",
  "Generates a change log",
  "Supports follow-up evaluation",
];

const publicRepairPrinciples = [
  "Diagnosis before repair",
  "Evidence before edit",
  "Card type before controls",
  "Voice protection before compression",
  "Author decision before manuscript change",
  "Follow-up evaluation before claiming improvement",
];

const doctrine = [
  "Evaluation findings do not automatically become edits.",
  "A/B/C means three executable replacement passages—not three labels pasted onto every recommendation.",
  "Strategy cards guide human revision without pretending a local text swap is sufficient.",
  "Held items remain visible so the system never silently drops unsupported work.",
  "TrustedPath™ is governed convenience, not blind rewriting.",
];

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">{children}</p>;
}

export default function RevisePage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1fr_1fr]">
        <div>
          <Eyebrow>RevisionGrade™ Revise · Author-Controlled Repair</Eyebrow>
          <h1 className="mt-6 font-rg-serif text-5xl leading-[0.95] tracking-tight md:text-7xl">The right repair surface for every finding.</h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-rg-cream2/85">
            Revise turns evaluation findings into governed author decisions. Local executable repairs become Copy-Paste cards. Structural or context-sensitive work becomes a Strategy. Unsupported work remains visible as a Held item with a clear recovery path.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a href="#revise-demo" className="rg-revise-cta font-rg-mono text-xs uppercase tracking-[0.18em]">View Revise Demo</a>
            <Link href="/evaluate" className="border border-rg-cream2/30 px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">Start Evaluation</Link>
          </div>
        </div>

        <div className="border border-rg-cream2/15 bg-rg-ink2/70 p-6">
          <Eyebrow>Core primitive</Eyebrow>
          <h2 className="mt-4 font-rg-serif text-3xl">RevisionOpportunity</h2>
          <p className="mt-4 text-sm leading-7 text-rg-cream2/75">Each opportunity is anchored to evidence and rendered through exactly one author-safe card contract.</p>
          <div className="mt-6 space-y-3">
            {queueItems.map((item) => <div key={item} className="border border-rg-cream2/10 px-4 py-3 font-rg-mono text-[0.7rem] uppercase tracking-[0.12em] text-rg-cream2/80">{item}</div>)}
          </div>
        </div>
      </section>

      <ReviseQueueDemo />

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <Eyebrow>Three card contracts</Eyebrow>
          <h2 className="mt-4 max-w-4xl font-rg-serif text-4xl leading-tight md:text-5xl">No disabled-button hybrids. No misleading A/B/C placeholders.</h2>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {cardTypes.map((card) => (
              <article key={card.title} className="border border-rg-cream2/12 bg-rg-ink/70 p-7">
                <p className="font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold">{card.eyebrow}</p>
                <h3 className="mt-4 font-rg-serif text-3xl">{card.title}</h3>
                <p className="mt-4 leading-7 text-rg-cream2/75">{card.copy}</p>
                <div className="mt-6 space-y-2">
                  {card.details.map((item) => <div key={item} className="border border-rg-cream2/10 bg-rg-ink2/60 px-4 py-3 font-rg-mono text-[0.68rem] uppercase tracking-[0.12em] text-rg-cream2/80">{item}</div>)}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <Eyebrow>Two revision paths</Eyebrow>
        <h2 className="mt-4 max-w-4xl font-rg-serif text-4xl leading-tight md:text-5xl">Manual control or governed automation.</h2>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <article className="border border-rg-cream2/12 bg-rg-ink2/60 p-7">
            <h3 className="font-rg-serif text-4xl">Revise Workbench</h3>
            <p className="mt-4 leading-7 text-rg-cream2/75">Review each card through the controls that belong to it. Copy-Paste cards offer executable choices; Strategy cards guide human work; Held items explain what must be resolved first.</p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">{manualDecisions.map((item) => <div key={item} className="border border-rg-cream2/10 px-4 py-3 font-rg-mono text-[0.68rem] uppercase tracking-[0.12em] text-rg-cream2/80">{item}</div>)}</div>
            <Link href="/workbench-v2" className="rg-revise-cta mt-8 font-rg-mono text-xs uppercase tracking-[0.18em]">Open Workbench</Link>
          </article>

          <article className="border border-rg-gold/45 bg-rg-ink2/60 p-7 shadow-2xl shadow-black/20">
            <h3 className="font-rg-serif text-4xl">TrustedPath™</h3>
            <p className="mt-4 leading-7 text-rg-cream2/75">TrustedPath™ applies only the governed A candidate from eligible Copy-Paste cards. It does not auto-apply Strategy cards or Held items.</p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">{trustedPathSafeguards.map((item) => <div key={item} className="border border-rg-gold/20 px-4 py-3 font-rg-mono text-[0.68rem] uppercase tracking-[0.12em] text-rg-cream2/80">{item}</div>)}</div>
          </article>
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <Eyebrow>Repair discipline</Eyebrow>
            <h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">Revise keeps repair governed instead of scattered.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">{publicRepairPrinciples.map((item, index) => <div key={item} className="border border-rg-cream2/12 bg-rg-ink/70 p-5"><p className="font-rg-mono text-xs text-rg-gold">0{index + 1}</p><p className="mt-3 leading-7 text-rg-cream2/85">{item}</p></div>)}</div>
        </div>
      </section>

      <section className="bg-rg-cream text-rg-ink">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-2">
          <div><p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Author sovereignty</p><h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">RevisionGrade does not force revision. It records defensible decisions.</h2></div>
          <div className="space-y-5 text-lg leading-8 text-rg-ink/75">{doctrine.map((item) => <p key={item}>{item}</p>)}</div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="border border-rg-gold/35 bg-rg-ink2/60 p-8 md:p-10">
          <Eyebrow>Contract</Eyebrow>
          <h2 className="mt-4 max-w-4xl font-rg-serif text-4xl leading-tight md:text-5xl">The interface tells the truth about what the system can safely do.</h2>
          <p className="mt-6 max-w-3xl leading-8 text-rg-cream2/75">Executable prose is selectable. Strategy is guided. Unsupported work is held transparently. The author remains the final authority.</p>
          <div className="mt-8 flex flex-wrap gap-4"><Link href="/workbench-v2" className="rg-revise-cta font-rg-mono text-xs uppercase tracking-[0.18em]">Open Revise Workbench →</Link><Link href="/pricing" className="font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold hover:text-rg-cream">See pricing →</Link></div>
        </div>
      </section>
    </div>
  );
}

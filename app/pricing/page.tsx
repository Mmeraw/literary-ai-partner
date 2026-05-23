import Link from "next/link";

export const metadata = {
  title: "Pricing | RevisionGrade™",
  description:
    "Fixed-price editorial audits and metered Editorial Actions for governed manuscript readiness.",
};

const auditTiers = [
  {
    name: "Free Opening Diagnostic",
    wordCount: "Up to 3,000 words",
    price: "$0",
    actionsIncluded: "0",
    bestFor: "Testing hook, voice, and narrative pressure.",
    features: ["Opening hook", "Voice signal", "Readiness preview", "No WAVE Revision System"],
  },
  {
    name: "Short-Form Evaluation",
    wordCount: "Up to 24,999 words",
    price: "$49",
    actionsIncluded: "5",
    bestFor: "Novellas, short stories, and early concept tests.",
    features: ["13 Story Criteria", "Readiness verdict", "Editorial path preview", "No WAVE Revision System"],
  },
  {
    name: "Full Manuscript Readiness Audit",
    wordCount: "25,000–120,000 words",
    price: "$249",
    actionsIncluded: "25",
    bestFor: "The Professional Standard for novels and long-form manuscripts.",
    features: ["13 Story Criteria", "WAVE Revision System™", "Readiness diagnosis", "Golden Spine™ long-form threshold"],
    highlighted: true,
  },
  {
    name: "Long Manuscript Readiness Audit",
    wordCount: "120,001–180,000 words",
    price: "$399",
    actionsIncluded: "50",
    bestFor: "Epic-scale manuscripts and longer novels.",
    features: ["13 Story Criteria", "WAVE Revision System™", "Expanded long-form diagnostics", "Scale-aware opportunity summary"],
  },
  {
    name: "Complex Narrative Audit",
    wordCount: "180,001+ words",
    price: "$499+",
    actionsIncluded: "100",
    bestFor: "Multi-layer, transmedia, or franchise-scale work.",
    features: ["13 Story Criteria", "WAVE Revision System™", "Multi-POV architecture review", "Custom complexity handling"],
  },
];

const actionPacks = [
  { name: "Starter Pack", actions: "25 Editorial Actions", price: "$29" },
  { name: "Professional Pack", actions: "100 Editorial Actions", price: "$89" },
  { name: "Studio Pack", actions: "300 Editorial Actions", price: "$199" },
];

const faqs = [
  {
    question: "What is the difference between an audit and an Editorial Action?",
    answer:
      "An audit is the fixed-price diagnostic: it reveals the manuscript’s readiness profile, including strengths, priority signals, and the kind of editorial support the work may benefit from next. Editorial Actions unlock and repair specific opportunities through granular opportunity cards and governed repair proposals.",
  },
  {
    question: "Why does the WAVE Revision System™ start at 25,000 words?",
    answer:
      "We call 25,000 words the Golden Spine™ threshold. Below that point, most works can be evaluated through the 13 Story Criteria. At and above that threshold, long-range structure, pacing, character continuity, payoff, and cumulative reader experience require the WAVE Revision System™.",
  },
  {
    question: "Can I see every granular opportunity after an audit?",
    answer:
      "Every paid audit includes a readiness diagnosis and opportunity summary. Granular Opportunity Cards and governed repair proposals are unlocked through Editorial Actions included with your audit or available in packs.",
  },
  {
    question: "Why not offer unlimited revisions?",
    answer:
      "Revision work is variable. Some manuscripts need only a few targeted refinements, while others benefit from deeper staged repair. Fixed-price unlimited revision would dilute the audit standard and encourage low-value generation instead of focused, high-impact revision work.",
  },
  {
    question: "Is RevisionGrade replacing human editors?",
    answer:
      "No. RevisionGrade helps you understand what kind of editorial help your manuscript may benefit from before you spend money on professional human intervention: developmental editing, line editing, copyediting, proofreading, market positioning, or deeper structural repair.",
  },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">
      {children}
    </p>
  );
}

export default function PricingPage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-20 lg:py-28">
        <div className="max-w-5xl">
          <SectionLabel>RevisionGrade™ Pricing</SectionLabel>
          <h1 className="mt-6 font-rg-serif text-4xl leading-[1.02] tracking-tight text-rg-cream sm:text-5xl md:text-7xl">
            Before you pay for polish, diagnose readiness.
          </h1>
          <p className="mt-8 max-w-3xl text-base leading-8 text-rg-cream2/80 sm:text-lg">
            RevisionGrade™ is priced as an editorial audit system: fixed-price diagnosis first, metered repair only when you unlock and act on specific story opportunities.
          </p>
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 md:py-16">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <SectionLabel>Editorial Audit Pricing</SectionLabel>
              <h2 className="mt-4 font-rg-serif text-3xl leading-tight text-rg-cream sm:text-4xl md:text-5xl">
                Fixed-price readiness audits.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-rg-cream2/70">
              The Full Manuscript Readiness Audit is the professional standard for long-form authors preparing a serious manuscript for revision, editing, or submission.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {auditTiers.map((tier) => (
              <article
                key={tier.name}
                className={`relative flex min-h-full flex-col border p-6 md:p-7 ${
                  tier.highlighted
                    ? "border-rg-gold bg-rg-cream text-rg-ink shadow-2xl shadow-black/30"
                    : "border-rg-cream2/12 bg-rg-ink/70 text-rg-cream"
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-5 bg-rg-gold px-3 py-1 font-rg-mono text-[0.62rem] uppercase tracking-[0.16em] text-rg-ink">
                    Professional Standard
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-rg-serif text-2xl leading-tight sm:text-3xl">{tier.name}</h3>
                  <p className={`mt-3 font-rg-mono text-[0.68rem] uppercase tracking-[0.14em] ${tier.highlighted ? "text-rg-ink/65" : "text-rg-gold"}`}>
                    {tier.wordCount}
                  </p>
                  <p className="mt-5 font-rg-serif text-4xl sm:text-5xl">{tier.price}</p>
                  <p className={`mt-4 text-sm leading-6 ${tier.highlighted ? "text-rg-ink/70" : "text-rg-cream2/75"}`}>
                    {tier.bestFor}
                  </p>
                  <div className={`mt-6 border-t pt-5 ${tier.highlighted ? "border-rg-ink/15" : "border-rg-cream2/10"}`}>
                    <p className="font-rg-mono text-[0.65rem] uppercase tracking-[0.14em]">
                      {tier.actionsIncluded} Editorial Actions included
                    </p>
                    <ul className={`mt-4 space-y-2 text-sm leading-6 ${tier.highlighted ? "text-rg-ink/75" : "text-rg-cream2/75"}`}>
                      {tier.features.map((feature) => (
                        <li key={feature}>• {feature}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <Link
                  href="/evaluate"
                  className={`mt-7 block border px-4 py-3 text-center font-rg-mono text-xs uppercase tracking-[0.16em] transition ${
                    tier.highlighted
                      ? "border-rg-ink bg-rg-ink text-rg-cream hover:bg-transparent hover:text-rg-ink"
                      : "border-rg-gold text-rg-gold hover:bg-rg-gold hover:text-rg-ink"
                  }`}
                >
                  Start Audit
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-6 md:py-20 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <SectionLabel>Editorial Actions</SectionLabel>
          <h2 className="mt-4 font-rg-serif text-3xl leading-tight text-rg-cream sm:text-4xl md:text-5xl">
            Metered repair. No unlimited revision.
          </h2>
          <p className="mt-6 leading-8 text-rg-cream2/75">
            Once your audit is complete, Editorial Actions unlock granular opportunity cards and generate governed, continuity-aware repair proposals for specific story opportunities.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {actionPacks.map((pack) => (
            <article key={pack.name} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6 md:p-7">
              <h3 className="font-rg-serif text-2xl text-rg-cream">{pack.name}</h3>
              <p className="mt-3 font-rg-mono text-xs uppercase tracking-[0.14em] text-rg-gold">{pack.actions}</p>
              <p className="mt-5 font-rg-serif text-4xl text-rg-cream sm:text-5xl">{pack.price}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-rg-cream text-rg-ink">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-6 md:py-20 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">A Note on Editorial Readiness</p>
            <h2 className="mt-4 font-rg-serif text-3xl leading-tight sm:text-4xl md:text-5xl">
              RevisionGrade™ is not a writing tool.
            </h2>
          </div>
          <div className="space-y-5 text-base leading-8 text-rg-ink/75 sm:text-lg">
            <p>
              It is an editorial audit system. Each paid audit provides a structural diagnosis of your manuscript’s readiness: where the story is already working, where readiness can be improved, and what kind of editorial support may help next.
            </p>
            <p>
              Granular Opportunity Cards and governed repair proposals are unlocked through Editorial Actions included with your audit or available in packs.
            </p>
            <p className="font-rg-serif text-2xl leading-tight text-rg-ink sm:text-3xl">
              Before you pay for polish, diagnose readiness.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-20">
        <SectionLabel>FAQ</SectionLabel>
        <h2 className="mt-4 font-rg-serif text-3xl text-rg-cream sm:text-4xl md:text-5xl">
          Fixed-price audit. Metered repair.
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          {faqs.map((item) => (
            <article key={item.question} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6 md:p-7">
              <h3 className="font-rg-serif text-2xl text-rg-cream">{item.question}</h3>
              <p className="mt-4 leading-7 text-rg-cream2/75">{item.answer}</p>
            </article>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]">
          <Link href="/black-box-problem" className="text-rg-gold hover:text-rg-cream">Read the Black Box Problem →</Link>
          <Link href="/resources" className="text-rg-gold hover:text-rg-cream">Resources →</Link>
          <Link href="/evaluate" className="text-rg-gold hover:text-rg-cream">Start Evaluate →</Link>
        </div>
      </section>
    </div>
  );
}

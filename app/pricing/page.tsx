import Link from "next/link";
import PricingCheckoutButton from "@/components/payments/PricingCheckoutButton";
import { PRICING_PRODUCTS } from "@/lib/payments/pricing-products";

export const metadata = {
  title: "Pricing | RevisionGrade™",
  description: "Fixed-price editorial audits and metered Editorial Actions for governed manuscript readiness.",
};

function formatPrice(productId: string): string {
  const product = PRICING_PRODUCTS[productId];
  if (!product) return "Custom";
  return `$${Math.round(product.priceCents / 100).toLocaleString()}`;
}

function SectionLabel({ children }: { children: string }) {
  return <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">{children}</p>;
}

function checkoutClass(highlighted?: boolean): string {
  return `block border px-4 py-3 text-center font-rg-mono text-xs uppercase tracking-[0.16em] transition ${
    highlighted
      ? "border-rg-ink bg-rg-ink text-rg-cream hover:bg-transparent hover:text-rg-ink"
      : "border-rg-gold text-rg-gold hover:bg-rg-gold hover:text-rg-ink"
  }`;
}

const auditTiers = [
  {
    name: "Free Opening Diagnostic",
    wordCount: "Up to 3,000 words",
    price: "$0",
    bestFor: "Testing hook, voice, and opening-page narrative pressure.",
    features: ["Opening hook", "Voice signal", "Readiness preview", "Full-manuscript diagnostics not included"],
    href: "/evaluate",
  },
  {
    name: "Short-Form Story Evaluation",
    wordCount: "Up to 24,999 words",
    price: formatPrice("short_form_evaluation"),
    bestFor: "Chapters, excerpts, short stories, openings, and partial submissions.",
    features: ["13 story criteria", "Evidence-backed diagnosis", "Prioritized revision opportunities", "Readiness verdict"],
    productId: "short_form_evaluation",
  },
  {
    name: "Full Manuscript Readiness Audit",
    wordCount: "25,000–120,000 words",
    price: formatPrice("full_manuscript_audit"),
    bestFor: "The Professional Standard for novels and long-form manuscripts.",
    features: ["13 story criteria", "Up to 100 prioritized revision opportunities", "Manuscript-scale continuity", "Setup/payoff and pacing over distance"],
    highlighted: true,
    productId: "full_manuscript_audit",
  },
  {
    name: "Long Manuscript Readiness Audit",
    wordCount: "120,001–180,000 words",
    price: formatPrice("long_manuscript_audit"),
    bestFor: "Epic-scale manuscripts and longer novels.",
    features: ["13 story criteria", "Advanced continuity diagnostics", "Expanded long-form analysis", "Scale-aware opportunity summary"],
    productId: "long_manuscript_audit",
  },
  {
    name: "Multi-Layer Manuscript Audit",
    wordCount: "Complex long-form projects",
    price: `${formatPrice("multilayer_manuscript_audit")}+`,
    bestFor: "Multi-POV, multi-timeline, genre-hybrid, memoir-fiction, or unusually structured long-form prose.",
    features: ["13 story criteria", "Layered evidence analysis", "Deep architecture audit", "Custom complexity handling"],
    productId: "multilayer_manuscript_audit",
  },
  {
    name: "ReGrade Follow-Up Pass",
    wordCount: "After completing revisions",
    price: formatPrice("regrade_follow_up"),
    bestFor: "Authors who completed revisions and want the next layer surfaced.",
    features: ["Re-evaluates revised manuscript", "Updated scores and diagnosis", "New revision opportunities ranked by impact"],
    productId: "regrade_follow_up",
  },
];

const actionPacks = [
  { name: "Starter Pack", productId: "revise_starter_pack" },
  { name: "Professional Pack", productId: "revise_professional_pack" },
  { name: "Studio Pack", productId: "revise_studio_pack" },
];

const evaluates = [
  "Full novels",
  "Partial novels",
  "Individual chapters",
  "Novel excerpts",
  "Novellas",
  "Book-length memoirs",
  "Narrative nonfiction manuscripts",
  "Serious fiction and nonfiction excerpts",
];

const unsupported = [
  "Personal letters",
  "Business letters",
  "Professional correspondence",
  "Employment cover letters",
  "Resumes or CVs",
  "Academic papers",
  "Research papers",
  "Legal documents",
  "Contracts",
  "Marketing copy",
  "Sales materials",
  "Query letters",
  "Synopses",
  "Author biographies",
];

const faqs = [
  {
    question: "What can RevisionGrade evaluate?",
    answer: "RevisionGrade evaluates full manuscripts, partial manuscripts, individual chapters, and serious narrative excerpts, including novels, novellas, book-length memoirs, narrative nonfiction manuscripts, and serious fiction or nonfiction excerpts.",
  },
  {
    question: "What does RevisionGrade not evaluate?",
    answer: "RevisionGrade does not evaluate letters, resumes, academic papers, legal documents, contracts, marketing copy, query letters, synopses, author biographies, or other general documents.",
  },
  {
    question: "Are evaluation purchases refundable?",
    answer: "Paid evaluations are final once processing begins because each report is a custom digital analysis. Billing errors, duplicate charges, or verified non-delivery will be reviewed.",
  },
  {
    question: "Is RevisionGrade replacing human editors?",
    answer: "No. RevisionGrade helps you understand what kind of editorial help your manuscript may benefit from before you spend money on the wrong intervention.",
  },
];

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
            Each RevisionGrade™ pass surfaces prioritized revision opportunities. Fix the highest-impact issues first, then run a lower-cost ReGrade to surface the next layer.
          </p>
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 md:py-16">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <SectionLabel>Editorial Audit Pricing</SectionLabel>
              <h2 className="mt-4 font-rg-serif text-3xl leading-tight text-rg-cream sm:text-4xl md:text-5xl">Fixed-price readiness audits.</h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-rg-cream2/70">
              Paid audit selections show a purchase acknowledgment first, then open secure Stripe Checkout.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {auditTiers.map((tier) => (
              <article key={tier.name} className={`relative flex min-h-full flex-col border p-6 md:p-7 ${tier.highlighted ? "border-rg-gold bg-rg-cream text-rg-ink shadow-2xl shadow-black/30" : "border-rg-cream2/12 bg-rg-ink/70 text-rg-cream"}`}>
                {tier.highlighted && <div className="absolute -top-3 left-5 bg-rg-gold px-3 py-1 font-rg-mono text-[0.62rem] uppercase tracking-[0.16em] text-rg-ink">Professional Standard</div>}
                <div className="flex-1">
                  <h3 className="font-rg-serif text-2xl leading-tight sm:text-3xl">{tier.name}</h3>
                  <p className={`mt-3 font-rg-mono text-[0.68rem] uppercase tracking-[0.14em] ${tier.highlighted ? "text-rg-ink/65" : "text-rg-gold"}`}>{tier.wordCount}</p>
                  <p className="mt-5 font-rg-serif text-4xl sm:text-5xl">{tier.price}</p>
                  <p className={`mt-4 text-sm leading-6 ${tier.highlighted ? "text-rg-ink/70" : "text-rg-cream2/75"}`}>{tier.bestFor}</p>
                  <ul className={`mt-6 space-y-2 border-t pt-5 text-sm leading-6 ${tier.highlighted ? "border-rg-ink/15 text-rg-ink/75" : "border-rg-cream2/10 text-rg-cream2/75"}`}>
                    {tier.features.map((feature) => <li key={feature}>• {feature}</li>)}
                  </ul>
                </div>
                <PricingCheckoutButton productId={tier.productId} href={tier.href} className={checkoutClass(tier.highlighted)}>
                  {tier.productId ? "Secure Checkout" : "Start Free Diagnostic"}
                </PricingCheckoutButton>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-rg-gold/30 bg-rg-ink/80 p-5 text-sm leading-7 text-rg-cream2/80">
            <p className="font-rg-mono text-[0.65rem] uppercase tracking-[0.18em] text-rg-gold">Before purchasing</p>
            <p className="mt-3">
              RevisionGrade evaluates full manuscripts, partial manuscripts, chapters, and serious narrative excerpts. It does not evaluate letters, resumes, academic papers, legal documents, contracts, marketing materials, query letters, synopses, or author biographies. Paid checkout requires acknowledgment of these limits before purchase.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-20">
        <SectionLabel>What RevisionGrade Can Evaluate</SectionLabel>
        <h2 className="mt-4 font-rg-serif text-3xl text-rg-cream sm:text-4xl md:text-5xl">Manuscript diagnosis, not generic document scoring.</h2>
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <article className="border border-rg-gold/30 bg-rg-ink2/60 p-6 md:p-7">
            <h3 className="font-rg-serif text-2xl text-rg-cream">RevisionGrade evaluates</h3>
            <ul className="mt-5 grid gap-2 text-sm leading-6 text-rg-cream2/80 sm:grid-cols-2">
              {evaluates.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </article>
          <article className="border border-rg-cream2/12 bg-rg-ink2/60 p-6 md:p-7">
            <h3 className="font-rg-serif text-2xl text-rg-cream">RevisionGrade does not evaluate</h3>
            <ul className="mt-5 grid gap-2 text-sm leading-6 text-rg-cream2/80 sm:grid-cols-2">
              {unsupported.map((item) => <li key={item}>• {item}</li>)}
            </ul>
            <p className="mt-5 text-sm leading-7 text-rg-cream2/75">
              Agent Readiness™ may help create and prepare query letters, synopses, author biographies, and submission materials, but these materials are not evaluated through RevisionGrade&apos;s manuscript-evaluation engine.
            </p>
          </article>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-6 md:py-20 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <SectionLabel>Editorial Actions</SectionLabel>
          <h2 className="mt-4 font-rg-serif text-3xl leading-tight text-rg-cream sm:text-4xl md:text-5xl">Metered repair. No unlimited revision.</h2>
          <p className="mt-6 leading-8 text-rg-cream2/75">
            Once your audit is complete, Editorial Actions unlock granular opportunity cards and generate governed repair proposals for specific story opportunities.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {actionPacks.map((pack) => (
            <article key={pack.name} className="flex flex-col border border-rg-cream2/12 bg-rg-ink2/60 p-6 md:p-7">
              <div className="flex-1">
                <h3 className="font-rg-serif text-2xl text-rg-cream">{pack.name}</h3>
                <p className="mt-3 font-rg-mono text-xs uppercase tracking-[0.14em] text-rg-gold">Editorial Actions</p>
                <p className="mt-5 font-rg-serif text-4xl text-rg-cream sm:text-5xl">{formatPrice(pack.productId)}</p>
              </div>
              <PricingCheckoutButton productId={pack.productId} className={checkoutClass(false)}>Secure Checkout</PricingCheckoutButton>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-rg-cream text-rg-ink">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-6 md:py-20 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">A Note on Editorial Readiness</p>
            <h2 className="mt-4 font-rg-serif text-3xl leading-tight sm:text-4xl md:text-5xl">RevisionGrade™ is not a blank-page writing tool.</h2>
          </div>
          <div className="space-y-5 text-base leading-8 text-rg-ink/75 sm:text-lg">
            <p>It is a manuscript readiness and repair system for work that already exists.</p>
            <p>Do not buy sentence polish for a structural problem. RevisionGrade diagnoses the level of intervention before you spend money on the wrong one.</p>
            <p className="font-rg-serif text-2xl leading-tight text-rg-ink sm:text-3xl">Structural problems need structural diagnosis. Polish comes later.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-20">
        <SectionLabel>FAQ</SectionLabel>
        <h2 className="mt-4 font-rg-serif text-3xl text-rg-cream sm:text-4xl md:text-5xl">Fixed-price audit. Metered repair.</h2>
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

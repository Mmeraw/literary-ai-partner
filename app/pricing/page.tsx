/**
 * RevisionGrade — Pricing Page
 *
 * Route: /pricing
 * Design language: ritual-luxury (rg-ink, rg-cream, rg-gold, rg-red)
 * Sections: Hero + Mary Cole block · Metering explainer · Tier cards · Word-budget · Storygate · FAQ
 *
 * Pricing decided (May 2026):
 *   Free Sample        $0         3,000 words     1 chapter / query test
 *   Pilot Evaluation   $19        one-time        up to ~20k words
 *   Creamium           $249       one-time        400,000-word lifecycle · 1 manuscript
 *   Premium Annual     $599/yr    subscription    1.5M words/yr · up to 3 manuscripts
 *   Studio Pro         $1,499/yr  subscription    4M words/yr · unlimited manuscripts
 */
import Link from "next/link";

export const metadata = {
  title: "Pricing — RevisionGrade™",
  description:
    "Plans metered by total words analyzed. Unlimited evaluations, revisions, and work-tied outputs within your monthly allowance.",
};

const TIERS = [
  {
    id: "sample",
    name: "Free Sample",
    price: "$0",
    priceNote: "No credit card",
    capacity: "3,000 words",
    tagline: "One chapter. Immediate insight.",
    recommended: false,
    cta: "Begin Sample",
    ctaHref: "/evaluate",
    features: [
      "Single-chapter evaluation",
      "Core craft signals",
      "Automated insight summary",
      "Readiness score preview",
    ],
  },
  {
    id: "pilot",
    name: "Pilot",
    price: "$19",
    priceNote: "one-time",
    capacity: "Up to 20,000 words",
    tagline: "A first act, a novella, a proof of concept.",
    recommended: false,
    cta: "Begin Evaluation",
    ctaHref: "/evaluate",
    features: [
      "Full short-form manuscript evaluation",
      "13-criterion WAVE scoring",
      "Revision opportunity queue",
      "Downloadable DREAM report",
    ],
  },
  {
    id: "creamium",
    name: "Creamium",
    price: "$249",
    priceNote: "one-time · 1 manuscript",
    capacity: "Up to 400,000 words",
    tagline: "One full novel lifecycle. Every pass you need.",
    recommended: true,
    cta: "Select Creamium",
    ctaHref: "/evaluate",
    features: [
      "Full manuscript evaluation (any length)",
      "Unlimited re-evaluations within word budget",
      "Complete WAVE report & revision queue",
      "DREAM Long-Form evaluation",
      "Dashboard access for 12 months",
      "Exportable agent-facing summary",
      "Query letter & synopsis outputs",
    ],
  },
  {
    id: "premium",
    name: "Premium Annual",
    price: "$599",
    priceNote: "per year · up to 3 manuscripts",
    capacity: "1,500,000 words / year",
    tagline: "Working novelists. Active revision. Multiple books.",
    recommended: false,
    cta: "Select Premium",
    ctaHref: "/evaluate",
    features: [
      "Everything in Creamium",
      "Up to 3 manuscripts simultaneously",
      "Longitudinal tracking across revision cycles",
      "Pitch decks & market comparables",
      "Agent package & film adaptation outputs",
      "Priority processing",
    ],
  },
  {
    id: "studio",
    name: "Studio Pro",
    price: "$1,499",
    priceNote: "per year · unlimited manuscripts",
    capacity: "4,000,000 words / year",
    tagline: "Career authors, ghostwriters, and hybrid pros.",
    recommended: false,
    cta: "Select Studio",
    ctaHref: "/evaluate",
    features: [
      "Everything in Premium",
      "Unlimited manuscripts",
      "Comparative analysis reports",
      "Genre-context diagnostics",
      "Advanced benchmarking",
      "Storygate Studio eligibility review",
    ],
  },
  {
    id: "enterprise",
    name: "Agency / Studio",
    price: "Custom",
    priceNote: "contact for pricing",
    capacity: "Negotiated",
    tagline: "Editors, agencies, and MFA programs.",
    recommended: false,
    cta: "Request Access",
    ctaHref: "mailto:hello@revisiongrade.com",
    features: [
      "Multi-user seats & team dashboards",
      "Custom criteria weighting",
      "Bulk manuscript processing",
      "White-label options",
      "API access",
      "24/7 dedicated support",
    ],
  },
] as const;

const FAQS = [
  {
    q: "What counts against my word budget?",
    a: "Only words actually analyzed in an evaluation pass. Uploads, navigation, report viewing, and revision-session work do not consume your budget. Each evaluation run draws from the allowance based on the manuscript length submitted.",
  },
  {
    q: "What happens when I reach my word limit?",
    a: "New analyses pause until the next billing cycle or until you upgrade. All previous results — reports, revision queues, dashboard history — remain fully accessible. We pause, we don't punish.",
  },
  {
    q: "Can I run multiple passes on the same manuscript?",
    a: "Yes. The Creamium lifecycle is designed for roughly 2–3 full passes on a 147,000-word novel, with additional chapter-level re-evaluations in between. The 400,000-word budget covers a full revision lifecycle for most novels.",
  },
  {
    q: "Is this a replacement for a developmental editor?",
    a: "No. RevisionGrade is framework-driven analysis — a governed instrument for measuring and sequencing manuscript repair. It does not replace human editorial judgment, literary agents, or developmental editors. It gives you a rigorous, repeatable baseline before committing to expensive human review.",
  },
  {
    q: "What is the refund policy?",
    a: "If your first full-manuscript evaluation does not surface at least 10 actionable craft issues, we will issue a full refund. No questions asked.",
  },
  {
    q: "What is Storygate Studio eligibility?",
    a: "Manuscripts that reach 8.0+ on the RevisionGrade readiness scale may be reviewed for Storygate Studio curation — a governed pathway toward agent and industry exposure. Eligibility does not guarantee representation or publication.",
  },
];

export default function PricingPage() {
  return (
    <div className="bg-rg-ink text-rg-cream min-h-screen font-rg-serif">

      {/* ── HERO + MARY COLE ──────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20">

        <p className="font-rg-mono text-xs tracking-[0.22em] uppercase text-rg-gold mb-8">
          Pricing
        </p>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl leading-[1.03] tracking-tight mb-8 max-w-3xl">
          The same rigor.{" "}
          <em className="italic text-rg-gold">A fraction</em>{" "}
          of the cost.
        </h1>

        {/* Mary Cole comparison block */}
        <div className="border border-rg-cream2/15 bg-rg-ink2 p-8 max-w-2xl mb-10">
          <p className="font-rg-mono text-xs tracking-[0.18em] uppercase text-rg-gold mb-6">
            The Real Cost of Editorial Review
          </p>
          <div className="space-y-4 text-rg-cream2 text-sm leading-relaxed">
            <p>
              A senior line editor charges <strong className="text-rg-cream">$6,615</strong> to read your 147,000-word novel once.
            </p>
            <p>
              A former literary agent quoted{" "}
              <strong className="text-rg-cream">$10,000</strong> for one developmental read.
            </p>
            <div className="border-t border-rg-cream2/10 pt-4 mt-4">
              <p className="text-rg-cream text-base">
                RevisionGrade evaluates the same novel, through every revision, for{" "}
                <strong className="text-rg-gold text-lg">$249.</strong>
              </p>
              <p className="text-rg-cream2 text-xs mt-2">
                Same craft framework. Same readiness threshold. Run it again after every rewrite.
              </p>
            </div>
          </div>
        </div>

        {/* Metering principle */}
        <div className="max-w-2xl">
          <p className="text-rg-cream2 text-sm leading-relaxed border-l-2 border-rg-gold/40 pl-5">
            RevisionGrade plans are metered by total words analyzed each month. Within that allowance,
            evaluations, revisions, and work-tied outputs remain available without pass limits.
            When your allowance is reached, new analyses pause until reset or upgrade —
            past results remain fully accessible.
          </p>
        </div>

      </section>

      {/* ── TIER CARDS ────────────────────────────────────────────────────── */}
      <section className="border-t border-rg-cream2/10 bg-rg-ink2">
        <div className="max-w-6xl mx-auto px-6 py-20">

          <p className="font-rg-mono text-xs tracking-[0.22em] uppercase text-rg-gold mb-8">
            Plans
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`relative border p-7 flex flex-col ${
                  tier.recommended
                    ? "border-rg-gold/60 bg-rg-ink3"
                    : "border-rg-cream2/12 bg-rg-ink"
                }`}
              >
                {tier.recommended && (
                  <span className="absolute -top-3 left-6 font-rg-mono text-[10px] tracking-widest uppercase bg-rg-gold text-rg-ink px-3 py-1">
                    Recommended
                  </span>
                )}

                <div className="mb-6">
                  <p className="font-rg-mono text-xs tracking-widest uppercase text-rg-cream2 mb-3">
                    {tier.name}
                  </p>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl text-rg-cream">{tier.price}</span>
                    <span className="text-rg-dim text-xs font-rg-mono">{tier.priceNote}</span>
                  </div>
                  <p className="font-rg-mono text-xs text-rg-gold mt-1">
                    {tier.capacity}
                  </p>
                  <p className="text-rg-cream2 text-sm mt-3 leading-relaxed italic">
                    {tier.tagline}
                  </p>
                </div>

                <ul className="space-y-2 mb-8 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-3 text-rg-cream2 text-xs leading-relaxed">
                      <span className="text-rg-gold shrink-0 mt-0.5">→</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={tier.ctaHref}
                  className={`inline-block text-center font-rg-mono text-xs tracking-widest uppercase px-6 py-3 transition-colors duration-200 ${
                    tier.recommended
                      ? "border border-rg-gold text-rg-gold hover:bg-rg-gold hover:text-rg-ink"
                      : "border border-rg-cream2/30 text-rg-cream2 hover:border-rg-cream2 hover:text-rg-cream"
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── WORD BUDGET EXPLAINER ─────────────────────────────────────────── */}
      <section className="border-t border-rg-cream2/10">
        <div className="max-w-5xl mx-auto px-6 py-20">

          <p className="font-rg-mono text-xs tracking-[0.22em] uppercase text-rg-gold mb-6">
            How the Word Budget Works
          </p>

          <h2 className="text-4xl leading-tight mb-8 max-w-2xl">
            A realistic lifecycle for a 147,000-word novel.
          </h2>

          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-4 text-sm text-rg-cream2">
              <div className="flex justify-between border-b border-rg-cream2/10 pb-3">
                <span>Evaluation pass 1 (full read)</span>
                <span className="text-rg-cream font-rg-mono">147,000 words</span>
              </div>
              <div className="flex justify-between border-b border-rg-cream2/10 pb-3">
                <span>Revision pass (targeted chapter re-evals)</span>
                <span className="text-rg-cream font-rg-mono">~60,000 words</span>
              </div>
              <div className="flex justify-between border-b border-rg-cream2/10 pb-3">
                <span>Evaluation pass 2 (full re-read)</span>
                <span className="text-rg-cream font-rg-mono">147,000 words</span>
              </div>
              <div className="flex justify-between border-b border-rg-cream2/10 pb-3">
                <span>Final polish re-evaluation (optional)</span>
                <span className="text-rg-cream font-rg-mono">~40,000 words</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-rg-cream font-rg-mono">Total realistic lifecycle</span>
                <span className="text-rg-gold font-rg-mono">~394,000 words</span>
              </div>
              <p className="text-rg-dim text-xs pt-2">
                Creamium's 400,000-word budget is designed to cover one full novel lifecycle with headroom.
                Overages are billed at $0.0008 per word (~$80 per 100,000 additional words).
              </p>
            </div>

            <div className="border border-rg-cream2/12 bg-rg-ink2 p-6">
              <p className="font-rg-mono text-xs tracking-widest uppercase text-rg-gold mb-4">
                What you get for $249
              </p>
              <ul className="space-y-2">
                {[
                  "Full manuscript evaluation",
                  "RevisionGrade scorecard across all 13 criteria",
                  "DREAM Long-Form evaluation report",
                  "Unlimited re-evaluations within 400k-word budget",
                  "Dashboard access for 12 months",
                  "Governed revision queue (REVISE)",
                  "Exportable agent-facing summary",
                  "Query letter and synopsis outputs",
                ].map((item) => (
                  <li key={item} className="flex gap-3 text-rg-cream2 text-xs leading-relaxed">
                    <span className="text-rg-gold shrink-0">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </section>

      {/* ── STORYGATE ─────────────────────────────────────────────────────── */}
      <section className="border-t border-rg-cream2/10 bg-rg-ink2">
        <div className="max-w-5xl mx-auto px-6 py-16">

          <p className="font-rg-mono text-xs tracking-[0.22em] uppercase text-rg-gold mb-4">
            Storygate Studio™
          </p>

          <h2 className="text-3xl leading-tight mb-4 max-w-xl">
            Curation review for manuscripts that cross the threshold.
          </h2>

          <p className="text-rg-cream2 text-sm leading-relaxed max-w-2xl">
            Manuscripts that reach a RevisionGrade score of 8.0 or higher may be reviewed for
            Storygate Studio curation. Access is governed and selective — not a marketplace or
            pay-to-list system. Eligible creators submit query letters, pitch decks, and synopses
            at no additional cost. This is not a guarantee of representation or publication.
          </p>

        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="border-t border-rg-cream2/10">
        <div className="max-w-5xl mx-auto px-6 py-20">

          <p className="font-rg-mono text-xs tracking-[0.22em] uppercase text-rg-gold mb-10">
            Common Questions
          </p>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-10">
            {FAQS.map(({ q, a }) => (
              <div key={q}>
                <p className="text-rg-cream font-rg-mono text-xs tracking-wide uppercase mb-3">{q}</p>
                <p className="text-rg-cream2 text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── BOTTOM CTA ────────────────────────────────────────────────────── */}
      <section className="border-t border-rg-cream2/10 bg-rg-ink2">
        <div className="max-w-5xl mx-auto px-6 py-20 text-center">
          <h2 className="text-4xl leading-tight mb-6">
            Begin with a free sample evaluation.
          </h2>
          <p className="text-rg-cream2 text-sm max-w-md mx-auto mb-10">
            Upload one chapter. No credit card required.
            See exactly what RevisionGrade surfaces before you commit to a plan.
          </p>
          <Link
            href="/evaluate"
            className="inline-block border border-rg-gold text-rg-gold font-rg-mono text-xs tracking-widest uppercase px-10 py-4 hover:bg-rg-gold hover:text-rg-ink transition-colors duration-200"
          >
            Start Free Sample
          </Link>
          <p className="mt-6 text-rg-dim text-xs font-rg-mono">
            Framework-driven analysis · Does not replace human editorial judgment
          </p>
        </div>
      </section>

    </div>
  );
}

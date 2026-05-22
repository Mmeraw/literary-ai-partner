import Link from "next/link";

const tiers = [
  {
    name: "Essentials",
    price: "Free",
    priceNote: "No credit card required",
    tag: "Start here",
    tagColor: "bg-[#01696f]/10 text-[#01696f]",
    border: "border-[#d4d1ca]",
    features: [
      "Single manuscript evaluation",
      "Basic WAVE scoring",
      "Summary feedback report",
      "13-criteria pass/fail overview",
    ],
    cta: "Get Started",
    ctaHref: "/evaluate",
    ctaStyle: "border border-[#01696f] text-[#01696f] hover:bg-[#01696f]/5",
  },
  {
    name: "Professional",
    price: "$29",
    priceNote: "per month",
    tag: "Recommended",
    tagColor: "bg-[#01696f] text-white",
    border: "border-[#01696f] ring-1 ring-[#01696f]",
    features: [
      "Unlimited evaluations",
      "Full WAVE reports with evidence ledger",
      "Revision tracking across drafts",
      "Character arc & POV analysis",
      "Content conversion tools",
      "Priority processing",
    ],
    cta: "Start Free Trial",
    ctaHref: "/evaluate",
    ctaStyle: "bg-[#01696f] text-white hover:bg-[#0C4E54]",
  },
  {
    name: "Studio",
    price: "$79",
    priceNote: "per month",
    tag: "For serious authors",
    tagColor: "bg-[#28251d]/10 text-[#28251d]",
    border: "border-[#d4d1ca]",
    features: [
      "Everything in Professional",
      "Storygate Studio access",
      "Admin dashboard & team seats",
      "Batch manuscript processing",
      "Canon governance enforcement",
      "Dedicated support",
    ],
    cta: "Contact Us",
    ctaHref: "/resources",
    ctaStyle: "border border-[#28251d] text-[#28251d] hover:bg-[#28251d]/5",
  },
];

export default function PricingPremiumMockPage() {
  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#28251d]">
      <div className="mx-auto max-w-6xl px-6 py-8">

        {/* Back nav */}
        <Link
          href="/mock"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#7A7974] hover:text-[#28251d]"
        >
          ← Mock gallery
        </Link>

        {/* Header */}
        <header className="mt-6 mb-10 rounded-3xl border border-[#d4d1ca] bg-[#fbfbf9] p-8 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#01696f]">
            Pricing · premium marketing direction
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
            One platform. Every manuscript.
          </h1>
          <p className="mt-3 max-w-2xl text-[#6f6c66]">
            RevisionGrade enforces narrative quality through auditable, reproducible literary
            governance. Choose the tier that matches your output.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#437A22]/10 px-4 py-1.5 text-sm font-semibold text-[#437A22]">
            ✓ Recommended direction for public /pricing route
          </div>
        </header>

        {/* Tier cards */}
        <div className="grid gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`flex flex-col rounded-3xl border ${tier.border} bg-[#f9f8f5] p-7 shadow-sm`}
            >
              <span
                className={`self-start rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] ${tier.tagColor}`}
              >
                {tier.tag}
              </span>
              <h2 className="mt-4 text-2xl font-extrabold">{tier.name}</h2>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold">{tier.price}</span>
                <span className="text-sm text-[#7A7974]">{tier.priceNote}</span>
              </div>
              <ul className="mt-6 space-y-2.5 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#28251d]">
                    <span className="mt-0.5 text-[#01696f] font-bold">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={tier.ctaHref}
                className={`mt-8 block rounded-full px-5 py-3 text-center text-sm font-semibold transition-colors ${tier.ctaStyle}`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Design rationale */}
        <section className="mt-10 rounded-3xl border border-[#d4d1ca] bg-[#f9f8f5] p-7 shadow-sm">
          <h3 className="text-lg font-bold">Why this direction</h3>
          <ul className="mt-4 space-y-2 text-sm text-[#6f6c66]">
            <li>
              <span className="font-semibold text-[#28251d]">Light surface, not dark.</span>{" "}
              Pricing pages are persuasion + trust. Dark theatrics belong on the hero; pricing needs
              clarity, legibility, and calm confidence.
            </li>
            <li>
              <span className="font-semibold text-[#28251d]">Teal accent on recommended tier.</span>{" "}
              One ring + filled CTA on Professional signals hierarchy without noise. The other tiers
              step back gracefully.
            </li>
            <li>
              <span className="font-semibold text-[#28251d]">Prose over bullet soup.</span>{" "}
              Feature lists kept short and outcome-oriented — readers scan, not read.
            </li>
          </ul>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.15em] text-[#7A7974]">
            Mock only — not connected to Stripe or live auth
          </p>
        </section>

      </div>
    </main>
  );
}

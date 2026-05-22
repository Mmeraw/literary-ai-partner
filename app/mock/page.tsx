import Link from "next/link";

const pages = [
  {
    href: "/mock/dashboard-light",
    title: "Dashboard — light workspace recommendation",
    label: "Recommended for production dashboard",
    description:
      "Warm paper surface, dark text, high scanability for long-session analytics and evaluation history.",
  },
  {
    href: "/mock/revise-workbench-dark",
    title: "Revise Workbench — dark premium prototype",
    label: "Keep as showcase / A-B candidate",
    description:
      "The stunning dark repair queue. Strong brand feel; needs fatigue testing before becoming the default long-session editor.",
  },
  {
    href: "/mock/dashboard-dark",
    title: "Dashboard — dark premium mock",
    label: "Brand-heavy alternate",
    description:
      "Useful as a premium demo or investor screenshot, but probably too theatrical for daily dashboard work.",
  },
  {
    href: "/mock/pricing-premium",
    title: "Pricing — premium marketing page",
    label: "Recommended for public site",
    description:
      "Dark, literary, high-conviction pricing presentation. This belongs in the public marketing layer.",
  },
  {
    href: "/mock/resources-premium",
    title: "Resources — premium marketing page",
    label: "Recommended for public site",
    description:
      "Use the premium look here because resources are still part of persuasion, doctrine, and trust-building.",
  },
  {
    href: "/mock/evaluate-light",
    title: "Evaluate Workbench — light workspace direction",
    label: "Recommended direction",
    description:
      "A quiet intake/workflow page. Evaluation is a task surface, not a sales surface.",
  },
];

export default function MockGalleryPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#211b14]">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#d8d0c2] bg-[#fffaf1] px-6 py-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6a2f]">RevisionGrade mock gallery</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#211b14]">Separate preview pages for the uploaded design directions</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d6254]">
              These pages are intentionally isolated under /mock so we can inspect the premium marketing surfaces, light workspace direction, and dark Revise Workbench prototype without replacing the real app dashboard, evaluate flow, or workbench.
            </p>
          </div>
          <Link href="/" className="rounded-full border border-[#c9a861] px-4 py-2 text-sm font-medium text-[#6f4f12] hover:bg-[#f2eadb]">Back to live site</Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {pages.map((page) => (
            <Link key={page.href} href={page.href} className="group rounded-3xl border border-[#ded5c8] bg-white/80 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9a7a3a]">{page.label}</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#211b14] group-hover:text-[#6e1f2a]">{page.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#6d6254]">{page.description}</p>
              <span className="mt-5 inline-flex text-sm font-semibold text-[#6e1f2a]">Open preview →</span>
            </Link>
          ))}
        </div>

        <div className="mt-8 rounded-3xl border border-[#d8d0c2] bg-[#211b14] p-6 text-[#f7f0e3]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c9a861]">Recommendation</p>
          <p className="mt-3 max-w-4xl text-lg leading-8">
            Keep the premium dark/gold treatment for public persuasion pages. Use the light workspace treatment for dashboard and evaluate by default. Preserve the dark Revise Workbench because it is genuinely beautiful, but treat it as a showcase or optional focus mode until we test whether writers can comfortably work in it for 30–60 minutes.
          </p>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";

const pages = [
  ["/mock/dashboard-light", "Dashboard — light workspace", "Recommended production direction for dashboard"],
  ["/mock/evaluate-light", "Evaluate — light workspace", "Recommended production direction for evaluate"],
  ["/mock/revise-workbench-dark", "Revise Workbench — dark prototype", "Beautiful premium prototype / focus-mode candidate"],
  ["/mock/dashboard-dark", "Dashboard — dark alternate", "Brand-heavy alternate"],
  ["/mock/pricing-premium", "Pricing — premium marketing", "Public marketing direction"],
  ["/mock/resources-premium", "Resources — premium marketing", "Public marketing direction"],
];

export default function MockGalleryPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#211b14]">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 rounded-3xl border border-[#d8d0c2] bg-[#fffaf1] p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6a2f]">RevisionGrade mock gallery</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Design preview pages</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d6254]">Production-visible isolated mock pages. These do not replace dashboard, evaluate, workbench, auth, or pipeline behavior.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {pages.map(([href, title, description]) => (
            <Link key={href} href={href} className="rounded-3xl border border-[#ded5c8] bg-white/80 p-6 shadow-sm hover:shadow-md">
              <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#6d6254]">{description}</p>
              <span className="mt-5 inline-flex text-sm font-semibold text-[#6e1f2a]">Open preview →</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

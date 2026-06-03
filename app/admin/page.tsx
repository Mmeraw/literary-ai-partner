import Link from "next/link";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";

export const dynamic = "force-dynamic";

const adminCards = [
  {
    title: "Site Experience",
    href: "/admin/experience",
    eyebrow: "Visitors · clicks · funnels",
    description:
      "See who is coming to RevisionGrade, which pages they visit, what they click, how long they stay, geography, and Revise example usage.",
    priority: "Primary",
  },
  {
    title: "Pipeline Health",
    href: "/admin/pipeline-health",
    eyebrow: "Jobs · failures · synthesis",
    description:
      "Monitor evaluation jobs, failure rates, SIPOC stages, long-form synthesis coverage, and technical pipeline state.",
    priority: "Operations",
  },
  {
    title: "Diagnostics",
    href: "/admin/diagnostics",
    eyebrow: "Observability",
    description:
      "Review system-wide diagnostic metrics, phase timing, backpressure, and recent failures.",
    priority: "Operations",
  },
  {
    title: "Jobs",
    href: "/admin/jobs",
    eyebrow: "Evaluation records",
    description:
      "View evaluation jobs with filtering and pagination.",
    priority: "Operations",
  },
  {
    title: "Dead Letter Queue",
    href: "/admin/jobs/dead-letter",
    eyebrow: "Recovery",
    description:
      "Review failed jobs and retry or discard them when recovery is appropriate.",
    priority: "Recovery",
  },
];

export default async function AdminDashboard() {
  const denied = await requireAdmin({
    nextUrl: { pathname: "/admin" },
    headers: new Headers(),
  } as unknown as NextRequest);

  if (denied) redirect("/evaluate");

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-3">
          <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">
            Admin only · tsavobc@hotmail.com
          </p>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h1 className="font-rg-serif text-3xl font-semibold sm:text-4xl">
                Admin Control Center
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-rg-cream2/70">
                Private command center for product experience, user behavior, pipeline operations,
                and recovery. Public users must never see or access these routes.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex w-fit items-center justify-center rounded border border-rg-cream2/20 px-4 py-2 font-rg-mono text-xs uppercase tracking-[0.16em] text-rg-cream2 transition hover:border-rg-gold/60 hover:text-rg-cream"
            >
              Back to Dashboard
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {adminCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group flex min-h-52 flex-col justify-between rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5 shadow-sm transition hover:border-rg-gold/60 hover:bg-rg-ink2"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-rg-mono text-[10px] uppercase tracking-[0.18em] text-rg-gold/80">
                    {card.eyebrow}
                  </p>
                  <span className="rounded border border-rg-cream2/15 px-2 py-1 font-rg-mono text-[10px] uppercase tracking-[0.14em] text-rg-cream2/55">
                    {card.priority}
                  </span>
                </div>
                <h2 className="mt-4 font-rg-serif text-2xl text-rg-cream group-hover:text-rg-gold">
                  {card.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-rg-cream2/65">
                  {card.description}
                </p>
              </div>
              <span className="mt-6 font-rg-mono text-xs uppercase tracking-[0.16em] text-rg-gold">
                Open →
              </span>
            </Link>
          ))}
        </section>

        <section className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/50 p-5">
          <h2 className="font-rg-serif text-xl text-rg-cream">Admin doctrine</h2>
          <p className="mt-2 text-sm leading-6 text-rg-cream2/65">
            Site experience analytics must track product behavior only: page views, clicks,
            time on page, geography, and funnel progress. Do not store manuscript text,
            pasted text, editor contents, query letters, synopses, or generated report prose.
          </p>
        </section>
      </div>
    </main>
  );
}

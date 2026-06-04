import type { InsightCard } from '@/lib/dashboard/dashboardAnalyticsTypes'

type Props = {
  mostImproved: InsightCard
  stillBlocking: InsightCard
  recentWins: InsightCard
}

function Card({ card, accentColor }: { card: InsightCard; accentColor: string }) {
  return (
    <article className="rounded-2xl border border-neutral-300 bg-white p-5 text-neutral-950">
      <p className={`text-xs font-bold uppercase tracking-[0.18em] ${accentColor}`}>
        {card.title}
      </p>
      <ul className="mt-4 space-y-2">
        {card.items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-6 text-neutral-700">
            <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
            {item}
          </li>
        ))}
      </ul>
    </article>
  )
}

export default function InsightCards({ mostImproved, stillBlocking, recentWins }: Props) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <Card card={mostImproved} accentColor="text-emerald-600" />
      <Card card={stillBlocking} accentColor="text-amber-700" />
      <Card card={recentWins} accentColor="text-blue-600" />
    </section>
  )
}

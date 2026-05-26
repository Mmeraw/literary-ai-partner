import Link from "next/link";

const trendPoints = [
  { date: "Jan", overall: 6.1, readiness: 6.4, market: 6.8 },
  { date: "Feb", overall: 6.8, readiness: 7.0, market: 7.3 },
  { date: "Mar", overall: 7.2, readiness: 7.5, market: 7.8 },
  { date: "Apr", overall: 7.5, readiness: 7.7, market: 8.0 },
  { date: "May", overall: 8.0, readiness: 8.2, market: 8.3 },
];

const issueTypes = [
  { label: "Opening hook", jan: 15, may: 5 },
  { label: "Pacing", jan: 19, may: 9 },
  { label: "Dialogue", jan: 11, may: 6 },
  { label: "Clarity", jan: 17, may: 7 },
  { label: "Scene beats", jan: 10, may: 7 },
  { label: "Market position", jan: 13, may: 6 },
];

const dashboardAnswers = [
  {
    question: "How did I do?",
    answer: "Latest overall score, market-readiness score, status badge, and direct report access.",
  },
  {
    question: "Am I improving?",
    answer: "Trend lines compare each manuscript against its prior evaluations instead of showing isolated scores.",
  },
  {
    question: "What still blocks readiness?",
    answer: "Issue-frequency bars should reveal persistent craft problems and whether revision is reducing them.",
  },
];

function percent(score: number) {
  return `${Math.max(0, Math.min(100, score * 10))}%`;
}

export default function DashboardExamplesPage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto max-w-7xl px-6 py-20">
        <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Dashboard examples</p>
        <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-tight md:text-6xl">
          Progress should be visible, not buried inside old reports.
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-rg-cream2/80">
          These examples show the intended author experience for the RevisionGrade dashboard: scores moving toward readiness, issue types falling over time, and revision activity becoming measurable only after follow-up evaluation confirms improvement.
        </p>
        <div className="mt-10 flex flex-wrap gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]">
          <Link href="/dashboard" className="border border-rg-gold bg-rg-gold px-5 py-3 text-rg-ink transition hover:bg-transparent hover:text-rg-gold">
            Open dashboard
          </Link>
          <Link href="/resources" className="border border-rg-cream2/30 px-5 py-3 text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">
            Back to resources
          </Link>
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-4 md:grid-cols-3">
            {dashboardAnswers.map((item) => (
              <article key={item.question} className="border border-rg-cream2/12 bg-rg-ink/70 p-6">
                <p className="font-rg-mono text-[0.68rem] uppercase tracking-[0.18em] text-rg-gold">Author question</p>
                <h2 className="mt-3 font-rg-serif text-3xl text-rg-cream">{item.question}</h2>
                <p className="mt-4 leading-7 text-rg-cream2/75">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Readiness trend</p>
            <h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">Scores should trend toward the 8.0 threshold.</h2>
            <p className="mt-5 leading-8 text-rg-cream2/75">
              The dashboard should show whether overall score, market readiness, and readiness confidence are moving upward across evaluations. The 8.0 line is a curation-readiness threshold for possible later Storygate review, not a guarantee of agent interest.
            </p>
          </div>

          <div className="border border-rg-cream2/12 bg-rg-ink2/70 p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-rg-serif text-3xl">Scores trend to readiness</h3>
                <p className="mt-2 text-sm text-rg-cream2/65">Illustrative dashboard example</p>
              </div>
              <span className="rounded-full border border-rg-gold/50 px-3 py-1 font-rg-mono text-[0.65rem] uppercase tracking-[0.16em] text-rg-gold">8.0 ready</span>
            </div>
            <div className="relative h-72 border-l border-b border-rg-cream2/20 px-4 pb-8 pt-2">
              <div className="absolute left-0 right-0 top-[22%] border-t border-dashed border-rg-gold/60" />
              <div className="absolute left-2 top-[18%] bg-rg-ink2 pr-2 font-rg-mono text-[0.65rem] uppercase tracking-[0.14em] text-rg-gold">Market-ready threshold</div>
              <div className="flex h-full items-end gap-4 pt-10">
                {trendPoints.map((point) => (
                  <div key={point.date} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-44 w-full items-end justify-center gap-1">
                      <span className="w-2 rounded-t bg-cyan-400" style={{ height: percent(point.overall) }} title={`Overall ${point.overall}`} />
                      <span className="w-2 rounded-t bg-emerald-500" style={{ height: percent(point.readiness) }} title={`Ready ${point.readiness}`} />
                      <span className="w-2 rounded-t bg-rg-gold" style={{ height: percent(point.market) }} title={`Market ${point.market}`} />
                    </div>
                    <span className="font-rg-mono text-xs text-rg-cream2/70">{point.date}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-4 text-sm text-rg-cream2/75">
              <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-cyan-400" />Overall</span>
              <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-emerald-500" />Ready</span>
              <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-rg-gold" />Market</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="border border-rg-cream2/12 bg-rg-ink/70 p-6">
            <div className="mb-6">
              <h3 className="font-rg-serif text-3xl">Error types fall over time</h3>
              <p className="mt-2 text-sm text-rg-cream2/65">Illustrative dashboard example · lower bars indicate craft improvement</p>
            </div>
            <div className="grid gap-5">
              {issueTypes.map((item) => {
                const delta = item.jan - item.may;
                return (
                  <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                      <span className="text-rg-cream">{item.label}</span>
                      <span className="font-rg-mono text-xs uppercase tracking-[0.14em] text-emerald-300">-{delta} issues</span>
                    </div>
                    <div className="grid grid-cols-[1fr_1fr] gap-2">
                      <div className="h-3 rounded-full bg-rg-cream2/10"><span className="block h-3 rounded-full bg-red-400" style={{ width: `${item.jan * 5}%` }} /></div>
                      <div className="h-3 rounded-full bg-rg-cream2/10"><span className="block h-3 rounded-full bg-rg-gold" style={{ width: `${item.may * 5}%` }} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Issue analytics</p>
            <h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">The valuable chart is the one that proves repair.</h2>
            <p className="mt-5 leading-8 text-rg-cream2/75">
              Error-frequency charts should not be decorative. They become powerful when the platform stores issue counts by criterion, manuscript, evaluation, and revision session. That lets authors see whether pacing, dialogue, scene construction, clarity, and market-positioning problems are actually falling.
            </p>
            <div className="mt-8 border border-rg-gold/30 bg-rg-gold/10 p-5 text-rg-cream2/80">
              <strong className="block text-rg-gold">Production rule</strong>
              <p className="mt-3 leading-7">Do not fake issue-frequency improvement from general scores. Persist issue data first, then chart real movement.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Dashboard doctrine</p>
        <h2 className="mt-5 font-rg-serif text-4xl leading-tight md:text-5xl">The dashboard is not a vanity surface. It is the author’s progress ledger.</h2>
        <p className="mx-auto mt-5 max-w-3xl leading-8 text-rg-cream2/75">
          The strongest dashboard promise is measured movement: what improved, what stayed stuck, what declined, and what needs another revision cycle before the manuscript is treated as ready.
        </p>
      </section>
    </div>
  );
}

export default function DashboardDarkMockPage() {
  return (
    <main className="min-h-screen bg-[#0b0a08] text-[#ece5d6]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-[#13100d] px-6 py-5 shadow-2xl">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c9a861]">Dashboard · dark alternate</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Premium dashboard mock</h1>
            <p className="mt-2 text-sm text-[#b6aa95]">Beautiful, brand-heavy, and useful for demos — but probably not the default for long daily sessions.</p>
          </div>
          <button className="rounded-full bg-[#8a2733] px-4 py-2 text-sm font-semibold text-[#f8f3ea]">Start evaluation</button>
        </header>

        <section className="grid gap-5 md:grid-cols-4">
          {[
            ['Overall score', '82'],
            ['Readiness', '76'],
            ['Best criterion', 'Voice'],
            ['Open repairs', '21'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-white/10 bg-[#191511] p-5 shadow-xl">
              <p className="text-xs uppercase tracking-[0.2em] text-[#7e735f]">{label}</p>
              <p className="mt-3 text-4xl font-semibold text-[#f5efe0]">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-[#13100d] p-6">
            <h2 className="text-2xl font-semibold">Submission trail</h2>
            <div className="mt-5 space-y-3">
              {['Froggin Noggin — Revise recommended', 'Cartel Babies — Pacing pass needed', 'Let the River Decide — Package-ready'].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-[#191511] p-4 text-sm text-[#c8bea8]">{item}</div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-[#c9a861]/30 bg-[#191511] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c9a861]">Verdict</p>
            <p className="mt-4 leading-7 text-[#c8bea8]">Keep this visual language for public proof, screenshots, and investor-facing demos. For the production dashboard, prefer the light workspace.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

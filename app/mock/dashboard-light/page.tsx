export default function DashboardLightMockPage() {
  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#28251d]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-6 rounded-3xl border border-[#d4d1ca] bg-[#fbfbf9] p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#01696f]">Dashboard · light workspace</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Writer dashboard built for long-session clarity.</h1>
          <p className="mt-3 max-w-3xl text-[#6f6c66]">Recommended production direction for dashboard: warm paper, dark text, calm cards, and restrained accents.</p>
        </header>
        <section className="grid gap-4 md:grid-cols-4">
          {[["Overall", "82"], ["Readiness", "76"], ["Best", "Voice"], ["Open repairs", "21"]].map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-[#ded9cf] bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6f6c66]">{label}</p>
              <p className="mt-3 text-4xl font-extrabold">{value}</p>
            </div>
          ))}
        </section>
        <section className="mt-6 rounded-3xl border border-[#ded9cf] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Evaluation history</h2>
          <p className="mt-2 text-[#6f6c66]">This surface should be readable, quiet, and operational — not another marketing page.</p>
        </section>
      </div>
    </main>
  );
}

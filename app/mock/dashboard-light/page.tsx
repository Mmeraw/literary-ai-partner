export default function DashboardLightMockPage() {
  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#28251d]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-6 rounded-3xl border border-[#d4d1ca] bg-[#fbfbf9] p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#01696f]">Dashboard · light workspace</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Writer dashboard built for long-session clarity.</h1>
          <p className="mt-3 max-w-3xl text-[#6f6c66]">Recommended production direction for dashboard: warm paper, dark text, calm cards, and restrained accents.</p>
        </header>

        <section className="mb-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border border-[#d4d1ca] bg-[#f9f8f5] p-6 shadow-sm">
            <span className="rounded-full bg-[#01696f]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#01696f]">Current manuscript</span>
            <h2 className="mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-tight">Track the path from evaluation to agent-facing readiness.</h2>
            <p className="mt-4 max-w-2xl text-[#6f6c66]">This direction keeps the real dashboard quiet, readable, and built for scanning scores over multiple sessions rather than selling the product again.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-4">
              {[
                ["Overall", "82", "+6 since draft 2"],
                ["Readiness", "76", "+11 after revision"],
                ["Strongest", "Voice", "91 / 100"],
                ["Weakest", "Pacing", "61 / 100"],
              ].map(([label, value, meta]) => (
                <div key={label} className="rounded-2xl border border-[#e1ded8] bg-[#fbfbf9] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6f6c66]">{label}</p>
                  <p className="mt-2 text-4xl font-extrabold">{value}</p>
                  <p className="mt-2 text-sm text-[#437a22]">{meta}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-3xl border border-[#d4d1ca] bg-[#f9f8f5] p-6 shadow-sm">
            <h3 className="text-lg font-bold">Next best action</h3>
            <p className="mt-2 text-sm leading-6 text-[#6f6c66]">Run Revise on the top three pacing opportunities before re-exporting the agent package.</p>
            <div className="mt-6 space-y-3">
              {["Resolve Act II pacing valley", "Re-check dialogue attribution", "Refresh query package"].map((item, idx) => (
                <div key={item} className="rounded-2xl border border-[#e1ded8] bg-white p-4 text-sm">
                  <span className="font-bold text-[#01696f]">0{idx + 1}</span> {item}
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-3xl border border-[#d4d1ca] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">Evaluation history</h3>
                <p className="text-sm text-[#6f6c66]">Readable table surface for repeat sessions.</p>
              </div>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.14em] text-[#6f6c66]">
                <tr><th className="py-3">Manuscript</th><th>Score</th><th>Readiness</th><th>Status</th></tr>
              </thead>
              <tbody className="divide-y divide-[#e5e1da]">
                {[
                  ["Froggin Noggin", "82", "76", "Revise recommended"],
                  ["Cartel Babies", "74", "68", "Needs pacing pass"],
                  ["Let the River Decide", "88", "84", "Package-ready"],
                ].map((row) => (
                  <tr key={row[0]}><td className="py-4 font-semibold">{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td><span className="rounded-full bg-[#01696f]/10 px-3 py-1 text-xs font-semibold text-[#01696f]">{row[3]}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-3xl border border-[#d4d1ca] bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold">Why this one wins</h3>
            <p className="mt-3 text-sm leading-6 text-[#6f6c66]">Dashboard use is analytical and repetitive. Light background, dark text, restrained color, and soft card boundaries will feel less fatiguing than the marketing palette.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

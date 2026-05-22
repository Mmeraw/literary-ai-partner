export default function EvaluateLightMockPage() {
  return (
    <main className="min-h-screen bg-[#f8f5ef] text-[#241e16]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-8 rounded-3xl border border-[#d9d0c2] bg-white px-6 py-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a6a2f]">Evaluate Workbench · light direction</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">Start with a calm intake surface.</h1>
          <p className="mt-3 max-w-3xl text-[#6d6254]">This is the recommended direction for evaluation: clean, bright, operational, and manuscript-first. The public site sells the doctrine; this screen helps the writer complete a task.</p>
        </header>
        <section className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl border border-[#d9d0c2] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold">Upload manuscript</h2>
            <div className="mt-5 rounded-3xl border-2 border-dashed border-[#c9bfae] bg-[#fbfaf7] p-10 text-center">
              <p className="text-lg font-semibold">Drop DOCX, PDF, or TXT here</p>
              <p className="mt-2 text-sm text-[#6d6254]">Recommended: full manuscript for long-form routing; chapter excerpt for sample evaluation.</p>
              <button className="mt-5 rounded-full bg-[#01696f] px-5 py-3 text-sm font-semibold text-white">Choose file</button>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {['Word count detection', 'Long-form routing', 'Evidence ledger'].map((item) => (
                <div key={item} className="rounded-2xl border border-[#e2dbd1] bg-[#fbfaf7] p-4 text-sm font-semibold">{item}</div>
              ))}
            </div>
          </div>
          <aside className="rounded-3xl border border-[#d9d0c2] bg-[#241e16] p-6 text-[#f8f0e2] shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c9a861]">Why not dark here?</p>
            <p className="mt-4 leading-7 text-[#d8cfbf]">Evaluate is a utility workflow. The user is checking file names, settings, word count, and pipeline status. Light wins for trust, legibility, and reduced stress.</p>
          </aside>
        </section>
      </div>
    </main>
  );
}

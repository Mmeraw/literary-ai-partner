export default function ReviseWorkbenchDarkMockPage() {
  return (
    <main className="h-screen overflow-hidden bg-[#0d0a05] text-[#f5efe0]">
      <header className="flex h-[52px] items-center justify-between border-b border-white/10 bg-[#12100b] px-5">
        <div className="text-sm font-medium">RevisionGrade<span className="text-[9px] opacity-50">™</span></div>
        <div className="absolute left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.18em] text-[#6b6560]">Revise Workbench · <span className="normal-case tracking-normal text-[#c8bea8]">Prototype</span></div>
        <div className="text-xs text-[#6b6560]">Progress <strong className="text-[#c8a96e]">2 / 21</strong></div>
      </header>
      <div className="flex h-[calc(100vh-52px)]">
        <aside className="w-[300px] shrink-0 border-r border-white/10 bg-[#12100b]">
          <div className="border-b border-white/10 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b6560]">Repair queue</h2>
          </div>
          {['Abstract phrasing weakens river-scene tension','Internal monologue duplicates dialogue subtext','Promise opened in Ch. 4 still unresolved','Scene transition can carry more pressure'].map((title, i) => (
            <div key={title} className={`border-l-2 px-4 py-3 ${i === 0 ? 'border-[#c8a96e] bg-[#261a0a]' : 'border-transparent hover:bg-[#1c160e]'}`}>
              <div className="mb-2 flex gap-1"><span className="rounded bg-[#7a2b1a]/35 px-2 py-0.5 text-[9px] font-bold tracking-widest text-[#d98b78]">MUST</span><span className="rounded bg-[#5a4a1a]/30 px-2 py-0.5 text-[9px] font-bold tracking-widest text-[#c8a96e]">SPINE</span></div>
              <p className="font-serif text-[15px] leading-snug">{title}</p>
              <p className="mt-1 text-[10px] text-[#6b6560]">Chapter 11 · evidence anchored</p>
            </div>
          ))}
        </aside>
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-10 py-8">
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-[#6b6560]">Dialogue · Chapter 11 · river scene</p>
            <h1 className="max-w-3xl font-serif text-3xl leading-tight">Abstract phrasing weakens river-scene tension</h1>
            <blockquote className="my-6 rounded-md border-l-2 border-[#c8a96e] bg-[#1c160e] px-5 py-4 font-serif text-xl italic leading-relaxed">“<em className="text-[#c8a96e]">It’s okay,</em> I whispered. But even as I said it, I knew it wasn’t okay.”</blockquote>
            <div className="grid overflow-hidden rounded-md border border-white/10 md:grid-cols-2">
              {['Symptom: emotional contradiction is stated directly.','Cause: interiority duplicates dialogue subtext.','Fix: replace explanation with physical hesitation.','Effect: tension escalates instead of pausing.'].map((text) => <div key={text} className="border-b border-r border-white/10 p-4 text-sm leading-6 text-[#c8bea8]">{text}</div>)}
            </div>
          </div>
          <div className="flex gap-3 border-t border-white/10 bg-[#12100b] px-10 py-4"><button className="rounded-md border border-white/20 px-5 py-2 text-sm text-[#c8bea8]">Keep original</button><button className="rounded-md bg-[#c8a96e] px-5 py-2 text-sm font-semibold text-[#0d0a05]">Accept option A</button></div>
        </section>
      </div>
    </main>
  );
}

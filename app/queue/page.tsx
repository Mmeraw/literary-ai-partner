import Link from "next/link";

const queueStates = [
  "Evaluations waiting to begin",
  "Evaluations currently in progress",
  "Completed reports ready for author review",
  "Revision opportunities moving into the workbench",
];

export default function QueuePage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">The Queue</p>
        <h1 className="mt-6 max-w-4xl font-rg-serif text-5xl leading-tight md:text-6xl">The queue is the handoff between evaluation and action.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-rg-cream2/80">This route gives the public navigation a real destination while preserving the signed-in dashboard as the operational queue for authors.</p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {queueStates.map((state) => <div key={state} className="border border-rg-cream2/12 bg-rg-ink2/60 p-5 font-rg-mono text-xs uppercase tracking-[0.12em] text-rg-cream2/80">{state}</div>)}
        </div>
        <div className="mt-12 flex flex-wrap gap-4">
          <Link href="/dashboard" className="border border-rg-gold bg-rg-gold px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-ink transition hover:bg-transparent hover:text-rg-gold">Open Dashboard Queue</Link>
          <Link href="/evaluate" className="border border-rg-cream2/30 px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">Start Evaluation</Link>
        </div>
      </section>
    </div>
  );
}

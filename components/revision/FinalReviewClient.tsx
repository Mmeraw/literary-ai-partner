import Link from "next/link";
import type { FinalReviewPayload, FinalReviewDecision } from "@/lib/revision/finalReview";

function decisionLabel(decision: FinalReviewDecision) {
  switch (decision.decision) {
    case "accepted_a":
    case "accepted_b":
    case "accepted_c":
      return `Accepted ${decision.selectedOption ?? ""}`.trim();
    case "custom":
      return "Custom rewrite";
    case "keep_original":
      return "Kept original";
    case "reject":
      return "Rejected";
    case "deferred":
      return "Deferred";
    default:
      return decision.decision;
  }
}

function markerClass(tone: FinalReviewDecision["highlightTone"]) {
  if (tone === "custom") return "border-sky-400/50 bg-sky-200/15 text-sky-100";
  if (tone === "deferred") return "border-neutral-500/50 bg-neutral-500/10 text-neutral-300";
  if (tone === "rejected") return "border-red-400/45 bg-red-500/10 text-red-100";
  if (tone === "kept") return "border-neutral-400/45 bg-neutral-400/10 text-neutral-200";
  return "border-[#C8A96E]/55 bg-[#C8A96E]/15 text-[#F2DFC0]";
}

function EmptyFinalReview({ payload }: { payload: FinalReviewPayload }) {
  return (
    <main className="min-h-screen bg-[#0D0A05] px-4 py-6 text-[#F5EFE4] md:px-6 md:py-8">
      <section className="mx-auto max-w-4xl rounded-2xl border border-[#3A3022] bg-[#1C160E]/80 p-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#C8A96E]">Final Review</p>
        <h1 className="mt-3 text-4xl text-[#F8F1E6]" style={{ fontFamily: "Instrument Serif, Georgia, serif" }}>
          Final Review is not ready yet.
        </h1>
        <p className="mt-4 leading-7 text-[#CBBDA4]">
          {payload.error ?? "No synced revision decisions were found for this manuscript yet."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-xs">
          <Link href="/dashboard" className="rounded border border-[#6D5A3B] px-3 py-1.5 text-[#E8D8BA] hover:border-[#C8A96E]">Dashboard</Link>
          <Link href="/evaluate" className="rounded border border-[#6D5A3B] px-3 py-1.5 text-[#E8D8BA] hover:border-[#C8A96E]">Evaluate</Link>
        </div>
      </section>
    </main>
  );
}

export default function FinalReviewClient({ payload }: { payload: FinalReviewPayload }) {
  if (!payload.ok) return <EmptyFinalReview payload={payload} />;

  const workbenchHref = payload.manuscriptId && payload.evaluationJobId
    ? `/workbench?${new URLSearchParams({ manuscriptId: payload.manuscriptId, evaluationJobId: payload.evaluationJobId }).toString()}`
    : "/workbench";

  const exportDisabled = payload.acceptedCount + payload.customCount === 0;

  return (
    <main className="min-h-screen bg-[#0D0A05] px-4 py-6 text-[#F5EFE4] md:px-6 md:py-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 rounded-2xl border border-[#3A3022] bg-[#1C160E]/80 p-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#C8A96E]">Final Review · apply & export</p>
          <div className="mt-3 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="text-4xl leading-tight text-[#F8F1E6] md:text-5xl" style={{ fontFamily: "Instrument Serif, Georgia, serif" }}>
                Review the revised manuscript before applying changes.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#CBBDA4]">
                {payload.manuscriptTitle}. Accepted and custom decisions are staged for a revised version. Kept, rejected, and deferred items remain visible in the changelog but are not applied.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link href={workbenchHref} className="rounded border border-[#5D4C31] px-3 py-2 text-[#E8D8BA] hover:border-[#C8A96E]">Back to Workbench</Link>
              <button disabled={exportDisabled} className="rounded border border-[#C8A96E] bg-[#C8A96E] px-3 py-2 font-semibold text-[#1A140C] disabled:cursor-not-allowed disabled:opacity-40">Apply to new version</button>
              <button disabled={exportDisabled} className="rounded border border-[#5D4C31] px-3 py-2 text-[#E8D8BA] disabled:cursor-not-allowed disabled:opacity-40">Export clean draft</button>
              <button className="rounded border border-[#5D4C31] px-3 py-2 text-[#E8D8BA] hover:border-[#C8A96E]">Export marked copy</button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 text-xs text-[#D8C6A4] md:grid-cols-5">
            <div className="rounded-lg border border-[#2D2519] bg-[#110D07] p-3"><span className="text-[#C8A96E]">Accepted</span><br /><strong className="text-2xl text-[#F6E8CE]">{payload.acceptedCount}</strong></div>
            <div className="rounded-lg border border-[#2D2519] bg-[#110D07] p-3"><span className="text-[#C8A96E]">Custom</span><br /><strong className="text-2xl text-[#F6E8CE]">{payload.customCount}</strong></div>
            <div className="rounded-lg border border-[#2D2519] bg-[#110D07] p-3"><span className="text-[#C8A96E]">Kept</span><br /><strong className="text-2xl text-[#F6E8CE]">{payload.keptCount}</strong></div>
            <div className="rounded-lg border border-[#2D2519] bg-[#110D07] p-3"><span className="text-[#C8A96E]">Rejected</span><br /><strong className="text-2xl text-[#F6E8CE]">{payload.rejectedCount}</strong></div>
            <div className="rounded-lg border border-[#2D2519] bg-[#110D07] p-3"><span className="text-[#C8A96E]">Deferred</span><br /><strong className="text-2xl text-[#F6E8CE]">{payload.deferredCount}</strong></div>
          </div>

          {payload.unresolvedMustCount > 0 && (
            <div className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">
              Warning: deferred items remain unresolved. Final Review will not downgrade their severity; it only records the author choice not to apply them now.
            </div>
          )}
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <article className="rounded-2xl border border-[#3A3022] bg-[#1C160E] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl text-[#F7EFDF]" style={{ fontFamily: "Instrument Serif, Georgia, serif" }}>Marked manuscript preview</h2>
                <p className="mt-1 text-sm text-[#A9987D]">Color highlights show staged revisions; the clean export removes this markup.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="rounded border border-[#C8A96E]/55 bg-[#C8A96E]/15 px-2 py-1 text-[#F2DFC0]">System A/B/C</span>
                <span className="rounded border border-sky-400/50 bg-sky-200/15 px-2 py-1 text-sky-100">Custom</span>
                <span className="rounded border border-neutral-500/50 bg-neutral-500/10 px-2 py-1 text-neutral-300">Deferred</span>
              </div>
            </div>
            <div className="space-y-4 rounded-xl border border-[#2E261A] bg-[#120E08] p-5 leading-8 text-[#E9DCC4]">
              {payload.previewParagraphs.length === 0 ? (
                <p>No manuscript preview text was available for this evaluation version.</p>
              ) : (
                payload.previewParagraphs.map((paragraph, index) => {
                  const decision = payload.decisions[index % Math.max(1, payload.decisions.length)];
                  if (!decision || index % 4 !== 1) return <p key={`${index}-${paragraph.slice(0, 10)}`}>{paragraph}</p>;
                  return (
                    <p key={`${index}-${decision.id}`}>
                      <span className={`rounded border px-1.5 py-0.5 ${markerClass(decision.highlightTone)}`}>{paragraph}</span>
                      <sup className="ml-1 text-[#C8A96E]">{index + 1}</sup>
                    </p>
                  );
                })
              )}
            </div>
          </article>

          <aside className="rounded-2xl border border-[#3A3022] bg-[#161109] p-4">
            <h2 className="text-sm uppercase tracking-[0.18em] text-[#D7C4A1]">Revision Changelog</h2>
            <p className="mt-2 text-xs leading-5 text-[#A9987D]">The sidebar explains what changed, what stayed untouched, and what remains deferred for a later pass.</p>
            <ol className="mt-4 space-y-3">
              {payload.decisions.length === 0 ? (
                <li className="rounded-lg border border-dashed border-[#3A3022] bg-[#120E08] p-3 text-sm text-[#B3A185]">
                  No synced decisions yet. Return to the Revise Workbench and accept, customize, keep, reject, or defer at least one item.
                </li>
              ) : payload.decisions.map((decision, index) => (
                <li key={decision.id} className="rounded-lg border border-[#2B241A] bg-[#120E08] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className={`rounded px-2 py-1 text-[10px] uppercase tracking-wider ${markerClass(decision.highlightTone)}`}>{decisionLabel(decision)}</span>
                    <span className="text-xs text-[#8F8068]">#{index + 1}</span>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-[#F2E7D4]">{decision.title}</p>
                  {decision.customText && <pre className="mt-2 whitespace-pre-wrap rounded border border-[#2D2519] bg-[#0D0A05] p-2 text-xs leading-5 text-[#E8DCC4]">{decision.customText}</pre>}
                </li>
              ))}
            </ol>
          </aside>
        </section>
      </div>
    </main>
  );
}

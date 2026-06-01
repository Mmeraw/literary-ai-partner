import Link from "next/link";
import { getFinalReviewPayload } from "@/lib/revision/finalReview";

export const dynamic = "force-dynamic";

function decisionLabel(decision: string, option: string | null) {
  if (decision.startsWith("accepted_")) return `Accepted ${option ?? ""}`.trim();
  if (decision === "custom") return "Custom rewrite";
  if (decision === "keep_original") return "Kept original";
  if (decision === "reject") return "Rejected";
  if (decision === "deferred") return "Deferred";
  return decision;
}

function toneClass(tone: string) {
  if (tone === "custom") return "border-sky-400/50 bg-sky-200/15 text-sky-100";
  if (tone === "deferred") return "border-neutral-500/50 bg-neutral-500/10 text-neutral-300";
  if (tone === "rejected") return "border-red-400/45 bg-red-500/10 text-red-100";
  if (tone === "kept") return "border-neutral-400/45 bg-neutral-400/10 text-neutral-200";
  return "border-[#C8A96E]/55 bg-[#C8A96E]/15 text-[#F2DFC0]";
}

function severityClass(severity: string | null) {
  if (severity === "must") return "border-red-400/50 bg-red-500/15 text-red-100";
  if (severity === "should") return "border-amber-500/50 bg-amber-600/15 text-amber-100";
  if (severity === "could") return "border-yellow-300/45 bg-yellow-300/10 text-yellow-100";
  return "border-[#5D4C31] bg-[#120E08] text-[#CBBDA4]";
}

export default async function FinalReviewPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const manuscriptIdRaw = params.manuscriptId;
  const evaluationJobIdRaw = params.evaluationJobId;
  const appliedRaw = params.applied;
  const applyErrorRaw = params.applyError;
  const manuscriptId = Array.isArray(manuscriptIdRaw) ? manuscriptIdRaw[0] : manuscriptIdRaw;
  const evaluationJobId = Array.isArray(evaluationJobIdRaw) ? evaluationJobIdRaw[0] : evaluationJobIdRaw;
  const applied = Array.isArray(appliedRaw) ? appliedRaw[0] : appliedRaw;
  const applyError = Array.isArray(applyErrorRaw) ? applyErrorRaw[0] : applyErrorRaw;
  const payload = await getFinalReviewPayload({ manuscriptId, evaluationJobId });
  const query = manuscriptId && evaluationJobId ? new URLSearchParams({ manuscriptId, evaluationJobId }).toString() : "";
  const canApply = payload.ok && payload.acceptedCount + payload.customCount > 0;

  if (!payload.ok) {
    return (
      <main className="min-h-screen bg-[#0D0A05] px-6 py-8 text-[#F5EFE4]">
        <section className="mx-auto max-w-4xl rounded-2xl border border-[#3A3022] bg-[#1C160E]/80 p-8">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#C8A96E]">Final Review</p>
          <h1 className="mt-3 text-4xl text-[#F8F1E6]" style={{ fontFamily: "Instrument Serif, Georgia, serif" }}>Final Review is not ready yet.</h1>
          <p className="mt-4 leading-7 text-[#CBBDA4]">{payload.error ?? "No synced revision decisions were found."}</p>
          <Link href="/dashboard" className="mt-6 inline-block rounded border border-[#6D5A3B] px-3 py-1.5 text-xs text-[#E8D8BA] hover:border-[#C8A96E]">Dashboard</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0D0A05] px-4 py-6 text-[#F5EFE4] md:px-6 md:py-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 rounded-2xl border border-[#3A3022] bg-[#1C160E]/80 p-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#C8A96E]">Final Review · apply & export</p>
          <div className="mt-3 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="text-4xl leading-tight text-[#F8F1E6] md:text-5xl" style={{ fontFamily: "Instrument Serif, Georgia, serif" }}>Review the revised manuscript before applying changes.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#CBBDA4]">{payload.manuscriptTitle}. Accepted and custom decisions are staged for a revised version. Kept, rejected, and deferred items remain visible in the changelog but are not applied.</p>
            </div>
            <div className="flex max-w-xl flex-wrap gap-2 text-xs">
              <Link href={query ? `/workbench-v2?${query}` : "/workbench-v2"} className="rounded border border-[#5D4C31] px-3 py-2 text-[#E8D8BA] hover:border-[#C8A96E]">Back to Revise Queue</Link>
              <form method="POST" action="/api/final-review/apply" className="inline">
                <input type="hidden" name="manuscriptId" value={manuscriptId ?? ""} />
                <input type="hidden" name="evaluationJobId" value={evaluationJobId ?? ""} />
                <button disabled={!canApply} className="rounded border border-[#C8A96E] bg-[#C8A96E] px-3 py-2 font-semibold text-[#1A140C] disabled:cursor-not-allowed disabled:opacity-40">Apply to new version</button>
              </form>
              <a aria-disabled={!canApply} href={canApply ? `/api/final-review/export?${query}&format=clean` : undefined} className={`rounded border border-[#5D4C31] px-3 py-2 ${canApply ? "text-[#E8D8BA] hover:border-[#C8A96E]" : "cursor-not-allowed opacity-40"}`}>Export clean draft</a>
              <a href={`/api/final-review/export?${query}&format=marked`} className="rounded border border-[#5D4C31] px-3 py-2 text-[#E8D8BA] hover:border-[#C8A96E]">Export marked copy</a>
              <a href={`/api/final-review/export?${query}&format=changelog`} className="rounded border border-[#5D4C31] px-3 py-2 text-[#E8D8BA] hover:border-[#C8A96E]">Export changelog</a>
            </div>
          </div>
          {applied && <div className="mt-4 rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-100">Revised manuscript version created: {applied}</div>}
          {applyError && <div className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">Apply blocked: {applyError}</div>}
          <div className="mt-5 grid gap-3 text-xs text-[#D8C6A4] md:grid-cols-5">
            <div className="rounded-lg border border-[#2D2519] bg-[#110D07] p-3"><span className="text-[#C8A96E]">Accepted</span><br /><strong className="text-2xl text-[#F6E8CE]">{payload.acceptedCount}</strong></div>
            <div className="rounded-lg border border-[#2D2519] bg-[#110D07] p-3"><span className="text-[#C8A96E]">Custom</span><br /><strong className="text-2xl text-[#F6E8CE]">{payload.customCount}</strong></div>
            <div className="rounded-lg border border-[#2D2519] bg-[#110D07] p-3"><span className="text-[#C8A96E]">Kept</span><br /><strong className="text-2xl text-[#F6E8CE]">{payload.keptCount}</strong></div>
            <div className="rounded-lg border border-[#2D2519] bg-[#110D07] p-3"><span className="text-[#C8A96E]">Rejected</span><br /><strong className="text-2xl text-[#F6E8CE]">{payload.rejectedCount}</strong></div>
            <div className="rounded-lg border border-[#2D2519] bg-[#110D07] p-3"><span className="text-[#C8A96E]">Deferred</span><br /><strong className="text-2xl text-[#F6E8CE]">{payload.deferredCount}</strong></div>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <article className="rounded-2xl border border-[#3A3022] bg-[#1C160E] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl text-[#F7EFDF]" style={{ fontFamily: "Instrument Serif, Georgia, serif" }}>Marked manuscript preview</h2><p className="mt-1 text-sm text-[#A9987D]">Highlights show staged revisions. The clean export removes markup.</p></div><div className="flex flex-wrap gap-2 text-[11px]"><span className="rounded border border-[#C8A96E]/55 bg-[#C8A96E]/15 px-2 py-1 text-[#F2DFC0]">System A/B/C</span><span className="rounded border border-sky-400/50 bg-sky-200/15 px-2 py-1 text-sky-100">Custom</span><span className="rounded border border-neutral-500/50 bg-neutral-500/10 px-2 py-1 text-neutral-300">Deferred</span></div></div>
            <div className="space-y-4 rounded-xl border border-[#2E261A] bg-[#120E08] p-5 leading-8 text-[#E9DCC4]">
              {payload.previewParagraphs.length === 0 ? <p>No manuscript preview text was available for this evaluation version.</p> : payload.previewParagraphs.map((paragraph, index) => {
                const decision = payload.decisions[index % Math.max(1, payload.decisions.length)];
                if (!decision || index % 4 !== 1) return <p key={`${index}-${paragraph.slice(0, 10)}`}>{paragraph}</p>;
                return <p key={`${index}-${decision.id}`}><span className={`rounded border px-1.5 py-0.5 ${toneClass(decision.highlightTone)}`}>{paragraph}</span><sup className="ml-1 text-[#C8A96E]">{index + 1}</sup></p>;
              })}
            </div>
          </article>
          <aside className="rounded-2xl border border-[#3A3022] bg-[#161109] p-4">
            <h2 className="text-sm uppercase tracking-[0.18em] text-[#D7C4A1]">Revision Changelog</h2>
            <ol className="mt-4 space-y-3">
              {payload.decisions.map((decision, index) => <li key={decision.id} className="rounded-lg border border-[#2B241A] bg-[#120E08] p-3"><div className="flex items-start justify-between gap-3"><div className="flex flex-wrap gap-2"><span className={`rounded px-2 py-1 text-[10px] uppercase tracking-wider ${toneClass(decision.highlightTone)}`}>{decisionLabel(decision)}</span><span className={`rounded border px-2 py-1 text-[10px] uppercase tracking-wider ${severityClass(decision.severity)}`}>{decision.severity ?? "severity n/a"}</span></div><span className="text-xs text-[#8F8068]">#{index + 1}</span></div><p className="mt-2 text-sm leading-5 text-[#F2E7D4]">{decision.title}</p>{decision.criterion && <p className="mt-1 text-xs text-[#C8A96E]">{decision.criterion}</p>}{decision.selectedText && <pre className="mt-2 whitespace-pre-wrap rounded border border-[#2D2519] bg-[#0D0A05] p-2 text-xs leading-5 text-[#E8DCC4]">{decision.selectedText}</pre>}{decision.sourceLocation && <p className="mt-2 text-[11px] text-[#8F8068]">Location: {decision.sourceLocation}</p>}</li>)}
            </ol>
          </aside>
        </section>
      </div>
    </main>
  );
}

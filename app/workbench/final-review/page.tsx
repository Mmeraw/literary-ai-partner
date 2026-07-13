import Link from "next/link";
import { getFinalReviewPayload } from "@/lib/revision/finalReview";
import FinalReviewClient, { type FinalReviewView } from "@/components/revision/FinalReviewClient";

export const dynamic = "force-dynamic";

function viewValue(value: string | string[] | undefined): FinalReviewView {
  const view = Array.isArray(value) ? value[0] : value;
  return view === "clean" || view === "marked" || view === "changelog" ? view : "full";
}

function scalar(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FinalReviewPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const manuscriptId = scalar(params.manuscriptId);
  const evaluationJobId = scalar(params.evaluationJobId);
  const appliedVersionId = scalar(params.applied);
  const appliedCount = scalar(params.appliedCount);
  const reusedApply = scalar(params.reusedApply) === "1";
  const applyError = scalar(params.applyError);
  const printRaw = scalar(params.print);
  const payload = await getFinalReviewPayload({ manuscriptId, evaluationJobId });

  const revisedManuscriptHref = manuscriptId && appliedVersionId
    ? `/manuscripts/${encodeURIComponent(manuscriptId)}?versionId=${encodeURIComponent(appliedVersionId)}`
    : null;

  return (
    <>
      {!printRaw && appliedVersionId && (
        <section className="mx-auto mt-4 max-w-[1500px] px-4 md:px-6" aria-live="polite">
          <div className="rounded-xl border border-emerald-400/45 bg-emerald-500/10 p-4 text-emerald-100">
            <p className="text-sm font-semibold">
              {reusedApply ? "This revision was already applied." : "Revised manuscript version created successfully."}
            </p>
            <p className="mt-1 text-xs leading-5 text-emerald-100/80">
              {reusedApply
                ? <>No duplicate version was created. Existing version ID: <code>{appliedVersionId}</code>.</>
                : <>Applied {appliedCount ?? "0"} verified decision{appliedCount === "1" ? "" : "s"}. New version ID: <code>{appliedVersionId}</code>.</>}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {revisedManuscriptHref && (
                <Link href={revisedManuscriptHref} className="rounded border border-emerald-200 bg-emerald-200 px-3 py-1.5 font-semibold text-emerald-950 hover:bg-emerald-100">
                  Open revised manuscript
                </Link>
              )}
              <Link href="/dashboard" className="rounded border border-emerald-300/50 px-3 py-1.5 hover:bg-emerald-400/10">Open dashboard</Link>
              <Link href={manuscriptId && evaluationJobId ? `/workbench-v2?${new URLSearchParams({ manuscriptId, evaluationJobId }).toString()}` : "/workbench-v2"} className="rounded border border-emerald-300/50 px-3 py-1.5 hover:bg-emerald-400/10">Return to Revise Queue</Link>
            </div>
          </div>
        </section>
      )}
      {!printRaw && applyError && (
        <section className="mx-auto mt-4 max-w-[1500px] px-4 md:px-6" aria-live="assertive">
          <div className="rounded-xl border border-red-400/45 bg-red-500/10 p-4 text-red-100">
            <p className="text-sm font-semibold">No revised version was created.</p>
            <p className="mt-1 text-xs leading-5 text-red-100/80">{applyError}</p>
          </div>
        </section>
      )}
      <FinalReviewClient payload={payload} printMode={printRaw === "1"} view={viewValue(params.view)} />
    </>
  );
}

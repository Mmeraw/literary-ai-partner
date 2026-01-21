// app/evaluate/[jobId]/page.tsx
// Track D: Minimal Report Surface
import Link from "next/link";

type Job = {
  id: string;
  job_type?: string;
  status: "queued" | "running" | "retry_pending" | "failed" | "complete" | "canceled";
  phase?: string | null;
  phase_status?: string | null;
  total_units?: number;
  completed_units?: number;
  failed_units?: number;
  created_at?: string;
  updated_at?: string;
  last_error?: string | null;
};

async function getJob(jobId: string): Promise<Job | null> {
  // NOTE: Use relative fetch so it works in prod too.
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/jobs/${jobId}`, {
    // Ensure the page reflects latest status (no stale cache).
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = await res.json();

  // Support either { job: {...} } or raw job {...} depending on your API shape.
  return (data?.job ?? data) as Job;
}

export default async function EvaluationReportPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await getJob(jobId);

  if (!job) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Evaluation Report</h1>
        <p className="mt-3 text-sm text-gray-600">
          We couldn't find that job.
        </p>

        <div className="mt-6">
          <Link href="/evaluate" className="text-sm underline">
            Back to Evaluate
          </Link>
        </div>
      </main>
    );
  }

  const isComplete = job.status === "complete";

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Evaluation Report</h1>
          <p className="mt-1 text-sm text-gray-600">
            Job ID: <span className="font-mono">{job.id}</span>
          </p>
        </div>

        <Link href="/evaluate" className="text-sm underline">
          Back to Evaluate
        </Link>
      </div>

      <div className="mt-6 rounded-lg border p-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-gray-600">Status:</span>{" "}
            <span className="font-medium">{job.status}</span>
          </div>
          <div>
            <span className="text-gray-600">Phase:</span>{" "}
            <span className="font-medium">{job.phase ?? "—"}</span>
          </div>
          <div>
            <span className="text-gray-600">Phase status:</span>{" "}
            <span className="font-medium">{job.phase_status ?? "—"}</span>
          </div>
          <div>
            <span className="text-gray-600">Progress:</span>{" "}
            <span className="font-medium">
              {(job.completed_units ?? 0)}/{(job.total_units ?? 0)}
            </span>
          </div>
        </div>

        {job.last_error ? (
          <p className="mt-3 text-sm text-red-700">
            Error: {job.last_error}
          </p>
        ) : null}
      </div>

      {!isComplete ? (
        <section className="mt-6 rounded-lg border p-5">
          <h2 className="text-lg font-semibold">Report not ready yet</h2>
          <p className="mt-2 text-sm text-gray-600">
            This evaluation hasn't completed. Once the status is "complete," your
            report will appear here automatically.
          </p>
          <div className="mt-4">
            <Link
              href="/evaluate"
              className="inline-flex rounded-md border px-3 py-2 text-sm font-medium"
            >
              Return to job list
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="mt-6 rounded-lg border p-5">
            <h2 className="text-lg font-semibold">Overall Summary</h2>
            <p className="mt-2 text-sm text-gray-600">
              (Stub) This section will show a high-level assessment and the most
              important themes detected in the manuscript/screenplay.
            </p>
          </section>

          <section className="mt-6 rounded-lg border p-5">
            <h2 className="text-lg font-semibold">Top Recommendations</h2>
            <ul className="mt-2 list-disc pl-5 text-sm text-gray-600">
              <li>(Stub) Clarify the protagonist's objective in the opening.</li>
              <li>(Stub) Tighten pacing in the midpoint sequence.</li>
              <li>(Stub) Strengthen scene-to-scene causality.</li>
            </ul>
          </section>

          <section className="mt-6 rounded-lg border p-5">
            <h2 className="text-lg font-semibold">Key Metrics</h2>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border p-3">
                <div className="text-xs text-gray-600">Story Criteria</div>
                <div className="mt-1 text-sm font-semibold">(Stub) 13/13</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-gray-600">Agent Readiness</div>
                <div className="mt-1 text-sm font-semibold">(Stub) Medium</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-gray-600">Revision Priority</div>
                <div className="mt-1 text-sm font-semibold">(Stub) High</div>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

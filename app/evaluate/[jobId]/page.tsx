// app/evaluate/[jobId]/page.tsx
// Track D: Minimal Report Surface
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Job = {
  id: string;
  job_type?: string;
  status: "queued" | "running" | "failed" | "complete";
  phase?: string | null;
  phase_status?: string | null;
  total_units?: number;
  completed_units?: number;
  failed_units?: number;
  created_at?: string;
  updated_at?: string;
  last_error?: string | null;
};

type ArtifactContentV1 = {
  // Shape A: from evaluation_artifacts
  summary?: string;
  overall_score?: number;
  chunk_count?: number;
  processed_count?: number;
  generated_at?: string;
  // Shape B: from evaluation_jobs.evaluation_result (EvaluationResultV1)
  overview?: {
    verdict?: string;
    overall_score_0_100?: number;
    one_paragraph_summary?: string;
    top_3_strengths?: string[];
    top_3_risks?: string[];
  };
  criteria?: Array<{ key: string; score_0_10: number; rationale?: string }>;
  recommendations?: {
    quick_wins?: Array<{ action: string; why?: string; effort?: string; impact?: string }>;
    strategic_revisions?: Array<{ action: string; why?: string; effort?: string; impact?: string }>;
  };
  metrics?: {
    manuscript?: { word_count?: number; char_count?: number; genre?: string };
    processing?: { segment_count?: number; total_tokens_estimated?: number; runtime_ms?: number };
  };
  governance?: { confidence?: number; warnings?: string[]; limitations?: string[] };
};

async function getJob(jobId: string): Promise<Job | null> {
  try {
    const supabase = await createClient();

    const { data: job, error } = await supabase
      .from("evaluation_jobs")
      .select("id, job_type, status, phase, phase_status, total_units, completed_units, failed_units, created_at, updated_at, last_error")
      .eq("id", jobId)
      .maybeSingle();

    if (error) {
      console.error(`[getJob] Supabase error for job ${jobId}:`, error);
      return null;
    }
    if (!job) {
      console.warn(`[getJob] Job not found in database: ${jobId}`);
      return null;
    }

    return job as Job;
  } catch (err) {
    console.error(`[getJob] Unexpected error:`, err);
    return null;
  }
}

async function getArtifact(jobId: string): Promise<ArtifactContentV1 | null> {
  try {
    const supabase = await createClient();

    // Try evaluation_artifacts first (canonical)
    const { data: artifact, error } = await supabase
      .from("evaluation_artifacts")
      .select("id, job_id, artifact_type, content, created_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && artifact?.content) {
      return artifact.content as ArtifactContentV1;
    }

    // Fallback: read evaluation_result from evaluation_jobs
    const { data: job, error: jobError } = await supabase
      .from("evaluation_jobs")
      .select("evaluation_result")
      .eq("id", jobId)
      .maybeSingle();

    if (!jobError && job?.evaluation_result) {
      return job.evaluation_result as ArtifactContentV1;
    }

    return null;
  } catch (err) {
    console.error(`[getArtifact] Unexpected error:`, err);
    return null;
  }
}

function formatScore(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "N/A";
}

function extractTopRecommendations(summary: string): string[] {
  const lines = summary
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  const bullets = lines
    .filter(l => /^[-•*]\s+/.test(l))
    .map(l => l.replace(/^[-•*]\s+/, ""));

  if (bullets.length) return bullets.slice(0, 5);

  // Fallback: split by sentences if no bullets found
  return summary
    .split(/(?<=[.!?])\s+/)
    .slice(0, 5);
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

export default async function EvaluationReportPage({
  params,
}: {
  params: { jobId: string };
}) {
  const { jobId } = params;
  const job = await getJob(jobId);

  if (!job) {
    // Check if it's an auth issue
    // Auth is handled by the server client; if job is null, 
    // it may be auth failure or job not found
    const hasAccessToken = true; // Server client handles auth transparently

    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Evaluation Report</h1>
        <div className="mt-4 rounded-md bg-yellow-50 border border-yellow-200 p-4">
          <p className="text-sm text-yellow-800 font-medium">Unable to load evaluation</p>
          <p className="mt-2 text-sm text-yellow-700">
            {!hasAccessToken 
              ? "Please sign in to view your evaluation report."
              : `We couldn't find job ${jobId}. It may have expired or been deleted.`
            }
          </p>
        </div>

        <div className="mt-6">
          <Link 
            href={!hasAccessToken ? "/login" : "/evaluate"} 
            className="inline-block text-sm text-blue-600 hover:text-blue-700 underline"
          >
            {!hasAccessToken ? "Go to Sign In" : "Back to Evaluate"}
          </Link>
        </div>
      </main>
    );
  }

  const isComplete = job.status === "complete";
  const artifact = isComplete ? await getArtifact(jobId) : null;

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
      ) : !artifact ? (
        <section className="mt-6 rounded-lg border p-5">
          <h2 className="text-lg font-semibold">Report not available yet</h2>
          <p className="mt-2 text-sm text-gray-600">
            Job completed but no evaluation artifact was found.
            Phase 2 may still be persisting results. Please refresh in a moment.
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
            <pre className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
              {artifact.summary || artifact.overview?.one_paragraph_summary || "No summary available"}
            </pre>
          </section>

          <section className="mt-6 rounded-lg border p-5">
            <h2 className="text-lg font-semibold">Top Recommendations</h2>
            <ul className="mt-2 list-disc pl-5 text-sm text-gray-600">
              {extractTopRecommendations(artifact.summary || artifact.overview?.one_paragraph_summary || "").map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>

          <section className="mt-6 rounded-lg border p-5">
            <h2 className="text-lg font-semibold">Key Metrics</h2>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <Metric label="Overall Score" value={formatScore(artifact.overall_score ?? artifact.overview?.overall_score_0_100 ?? 0)} />
              <Metric label="Chunks Analyzed" value={artifact.chunk_count ?? artifact.metrics?.processing?.segment_count ?? "N/A"} />
              <Metric label="Successfully Processed" value={artifact.processed_count ?? artifact.metrics?.processing?.segment_count ?? "N/A"} />
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Generated: {artifact.generated_at ? new Date(artifact.generated_at).toLocaleString() : "N/A"}
            </p>
          </section>
        </>
      )}
    </main>
  );
}

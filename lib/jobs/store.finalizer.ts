import { createAdminClient } from "@/lib/supabase/admin";
import { ConvergenceArtifactSchema } from "@/schemas/convergence-artifact-v1";
import { PassArtifactSchema } from "@/schemas/pass-artifact-v1";
import type {
  CanonicalEvaluationArtifact,
  ConvergenceArtifact,
  EvaluationJob,
  JobAuditEvent,
  MarkJobFailedArgs,
  PassArtifact,
  PersistCanonicalAndSummaryAndCompleteArgs,
  PersistCanonicalAndSummaryAndCompleteResult,
  ReportSummaryProjection,
} from "./finalize.types";
import { JOB_STATUS, type JobStatus } from "./types";

const FINALIZER_JOB_SELECT_FIELDS = [
  "id",
  "status",
  "phase",
  "created_at",
  "updated_at",
  "last_error",
  "manuscript_id",
  "attempt_count",
  "next_retry_at",
  "next_attempt_at",
  "manuscripts(user_id)",
  "progress",
].join(", ");

const ARTIFACT_SELECT_FIELDS = "id, job_id, artifact_type, content";
const FINALIZER_CANONICAL_ARTIFACT_TYPE = "evaluation_result_v1";
const FINALIZER_SUMMARY_ARTIFACT_TYPE = "one_page_summary";

type SupabaseLike = NonNullable<ReturnType<typeof createAdminClient>>;

let _supabase: ReturnType<typeof createAdminClient> | undefined;

export function __resetFinalizerStoreForTests(): void {
  _supabase = undefined;
}

function getSupabase(): ReturnType<typeof createAdminClient> {
  if (_supabase === undefined) {
    _supabase = createAdminClient({ nullable: true });
  }
  return _supabase;
}

const supabase = new Proxy({} as SupabaseLike, {
  get(_target, prop) {
    const client = getSupabase();
    if (!client) {
      throw new Error(
        `[FINALIZER-STORE] Supabase unavailable - cannot access .${String(prop)}`,
      );
    }
    return client[prop as keyof SupabaseLike];
  },
});

function extractOwnerUserId(row: any): string {
  const ownerUserId =
    row?.manuscripts?.user_id
    ?? (Array.isArray(row?.manuscripts) ? row.manuscripts[0]?.user_id : null)
    ?? row?.user_id
    ?? null;

  if (typeof ownerUserId !== "string" || ownerUserId.length === 0) {
    throw new Error(
      `[FINALIZER-STORE] Missing ownership user_id for job ${row?.id ?? "(unknown)"}`,
    );
  }

  return ownerUserId;
}

function parseJobStatus(value: unknown, jobId: string): JobStatus {
  switch (value) {
    case JOB_STATUS.QUEUED:
    case JOB_STATUS.RUNNING:
    case JOB_STATUS.COMPLETE:
    case JOB_STATUS.FAILED:
      return value;
    default:
      throw new Error(
        `[FINALIZER-STORE] Unsupported job status '${String(value)}' for job ${jobId}`,
      );
  }
}

function requireTimestamp(value: unknown, fieldName: "created_at" | "updated_at", jobId: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `[FINALIZER-STORE] Job ${jobId} missing required ${fieldName} timestamp`,
    );
  }

  return value;
}

function mapRowToFinalizerJob(row: any): EvaluationJob {
  const progress = row?.progress && typeof row.progress === "object" ? row.progress : {};
  const jobId = String(row?.id ?? "(unknown)");
  const jobPhase =
    typeof row?.phase === "string"
      ? row.phase
      : typeof progress?.phase === "string"
        ? progress.phase
        : null;

  // Fail closed: Finalizer requires explicit phase semantics.
  if (!jobPhase) {
    throw new Error(
      `[FINALIZER-STORE] Job ${row?.id ?? "(unknown)"} missing phase required for finalization`,
    );
  }

  const canonicalPhase = (() => {
    switch (jobPhase) {
      case "submit":
      case "pass1":
      case "pass2":
      case "pass3":
      case "convergence":
      case "finalizer":
      case "report":
      case "done":
        return jobPhase;
      case "phase_1":
        return "pass1";
      case "phase_2":
        return "pass2";
      default:
        throw new Error(
          `[FINALIZER-STORE] Unsupported job phase '${jobPhase}' for finalizer mapping`,
        );
    }
  })();

  const nextRetryAt =
    row?.next_retry_at
    ?? row?.next_attempt_at
    ?? null;

  return {
    id: jobId,
    user_id: extractOwnerUserId(row),
    status: parseJobStatus(row?.status, jobId),
    phase: canonicalPhase,
    progress_percent:
      typeof row?.progress_percent === "number"
        ? row.progress_percent
        : typeof progress?.progress_percent === "number"
          ? progress.progress_percent
          : 0,
    submission_idempotency_key:
      row?.submission_idempotency_key
      ?? (typeof progress?.submission_idempotency_key === "string"
        ? progress.submission_idempotency_key
        : null),
    claimed_by:
      row?.claimed_by
      ?? (typeof progress?.lease_id === "string" ? progress.lease_id : null),
    lease_expires_at:
      row?.lease_expires_at
      ?? (typeof progress?.lease_expires_at === "string" ? progress.lease_expires_at : null),
    attempt_count:
      typeof row?.attempt_count === "number"
        ? row.attempt_count
        : 0,
    next_retry_at:
      typeof nextRetryAt === "string" ? nextRetryAt : null,
    failure_code:
      typeof row?.failure_code === "string"
        ? row.failure_code
        : null,
    last_error:
      typeof row?.last_error === "string"
        ? row.last_error
        : null,
    pass1_artifact_id:
      row?.pass1_artifact_id
      ?? (typeof progress?.pass1_artifact_id === "string" ? progress.pass1_artifact_id : null),
    pass2_artifact_id:
      row?.pass2_artifact_id
      ?? (typeof progress?.pass2_artifact_id === "string" ? progress.pass2_artifact_id : null),
    pass3_artifact_id:
      row?.pass3_artifact_id
      ?? (typeof progress?.pass3_artifact_id === "string" ? progress.pass3_artifact_id : null),
    convergence_artifact_id:
      row?.convergence_artifact_id
      ?? (typeof progress?.convergence_artifact_id === "string"
        ? progress.convergence_artifact_id
        : null),
    canonical_artifact_id:
      row?.canonical_artifact_id
      ?? (typeof progress?.canonical_artifact_id === "string"
        ? progress.canonical_artifact_id
        : null),
    summary_artifact_id:
      row?.summary_artifact_id
      ?? (typeof progress?.summary_artifact_id === "string"
        ? progress.summary_artifact_id
        : null),
    created_at: requireTimestamp(row?.created_at, "created_at", jobId),
    updated_at: requireTimestamp(row?.updated_at, "updated_at", jobId),
    terminal_at:
      typeof row?.terminal_at === "string"
        ? row.terminal_at
        : null,
  };
}

function readArtifactPayload(row: any): unknown {
  if (row?.content !== undefined && row?.content !== null) return row.content;
  throw new Error(
    `[FINALIZER-STORE] Artifact ${row?.id ?? "(unknown)"} missing content payload`,
  );
}

async function getArtifactRowById(artifactId: string): Promise<any> {
  const { data, error } = await supabase
    .from("evaluation_artifacts")
    .select(ARTIFACT_SELECT_FIELDS)
    .eq("id", artifactId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `[FINALIZER-STORE] Failed artifact lookup ${artifactId}: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(`[FINALIZER-STORE] Artifact not found: ${artifactId}`);
  }

  return data;
}

function requireCompletionIds(
  value: unknown,
): PersistCanonicalAndSummaryAndCompleteResult {
  const row = Array.isArray(value) ? value[0] : value;
  const canonicalArtifactId = row?.canonical_artifact_id;
  const summaryArtifactId = row?.summary_artifact_id;

  if (typeof canonicalArtifactId !== "string" || canonicalArtifactId.length === 0) {
    throw new Error("[FINALIZER-STORE] Atomic completion RPC missing canonical_artifact_id");
  }

  if (typeof summaryArtifactId !== "string" || summaryArtifactId.length === 0) {
    throw new Error("[FINALIZER-STORE] Atomic completion RPC missing summary_artifact_id");
  }

  return {
    canonical_artifact_id: canonicalArtifactId,
    summary_artifact_id: summaryArtifactId,
  };
}

export async function getJobForFinalization(jobId: string): Promise<EvaluationJob> {
  const { data, error } = await supabase
    .from("evaluation_jobs")
    .select(FINALIZER_JOB_SELECT_FIELDS)
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw new Error(`[FINALIZER-STORE] Failed job lookup ${jobId}: ${error.message}`);
  }

  if (!data) {
    throw new Error(`[FINALIZER-STORE] Job not found: ${jobId}`);
  }

  return mapRowToFinalizerJob(data);
}

export async function persistCanonicalAndSummaryAndCompleteJob(
  args: PersistCanonicalAndSummaryAndCompleteArgs,
): Promise<PersistCanonicalAndSummaryAndCompleteResult> {
  const canonicalContent: CanonicalEvaluationArtifact = {
    ...args.canonical,
    job_id: args.job.id,
  };

  const summaryContentCandidate: ReportSummaryProjection = {
    ...args.summary,
    job_id: args.job.id,
    user_id: args.job.user_id,
  };

  const { data, error } = await supabase.rpc("finalizer_complete_job_atomic", {
    p_job_id: args.job.id,
    p_worker_id: args.worker_id,
    p_canonical_artifact_type: FINALIZER_CANONICAL_ARTIFACT_TYPE,
    p_summary_artifact_type: FINALIZER_SUMMARY_ARTIFACT_TYPE,
    p_canonical_content: canonicalContent,
    p_summary_content_without_canonical_id: summaryContentCandidate,
  });

  if (error) {
    throw new Error(
      `[FINALIZER-STORE] Atomic completion failed for job ${args.job.id}: ${error.message}`,
    );
  }

  return requireCompletionIds(data);
}

export async function getPassArtifactById(artifactId: string): Promise<PassArtifact> {
  const row = await getArtifactRowById(artifactId);
  const payload = readArtifactPayload(row);
  const parsed = PassArtifactSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(
      `[FINALIZER-STORE] Pass artifact ${artifactId} failed schema validation: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export async function getConvergenceArtifactById(
  artifactId: string,
): Promise<ConvergenceArtifact> {
  const row = await getArtifactRowById(artifactId);
  const payload = readArtifactPayload(row);
  const parsed = ConvergenceArtifactSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(
      `[FINALIZER-STORE] Convergence artifact ${artifactId} failed schema validation: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export async function writeJobAuditEvent(
  event: Omit<JobAuditEvent, "id" | "created_at">,
): Promise<void> {
  const { error } = await supabase
    .from("evaluation_job_audit_events")
    .insert({
      job_id: event.job_id,
      event_type: event.event_type,
      actor_id: event.actor_id,
      failure_code: event.failure_code,
      message: event.message,
      metadata: event.metadata,
    });

  if (error) {
    throw new Error(`[FINALIZER-STORE] Failed to write audit event: ${error.message}`);
  }
}

export async function markJobFailed(args: MarkJobFailedArgs): Promise<void> {
  const { error } = await supabase.rpc("finalizer_mark_job_failed", {
    p_job_id: args.job_id,
    p_worker_id: args.worker_id,
    p_failure_code: args.failure_code,
    p_last_error: args.last_error,
  });

  if (error) {
    throw new Error(
      `[FINALIZER-STORE] Failed to mark job failed for ${args.job_id}: ${error.message}`,
    );
  }
}

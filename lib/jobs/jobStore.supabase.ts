import { getSupabaseClient } from "../supabase.js";
import { assertValidTransition, isValidTransition } from "./transitions";
import { validateProgressForPhase } from "./validation";
import { Job, JobStatus, JobType, PHASES } from "./types";

// Lazy-initialized Supabase client - null-safe for CI/build environments
let _supabase: ReturnType<typeof getSupabaseClient> | undefined;

function getSupabase() {
  if (_supabase === undefined) {
    _supabase = getSupabaseClient();
  }
  return _supabase;
}

// Module-level accessor that throws meaningful errors when Supabase unavailable
const supabase = new Proxy(
  {} as NonNullable<ReturnType<typeof getSupabaseClient>>,
  {
    get(_target, prop) {
      const client = getSupabase();
      if (!client) {
        throw new Error(
          `[JOB-STORE-SUPABASE] Supabase unavailable - cannot access .${String(prop)}`,
        );
      }
      return client[prop as keyof typeof client];
    },
  },
);

// Mapping between in-app job types and DB enum values
const JOB_TYPE_TO_DB: Record<JobType, string> = {
  evaluate_quick: "quick_evaluation",
  evaluate_full: "full_evaluation",
  wave_pass: "wave_only",
  synopsis_generate: "synopsis_generation",
  query_generate: "query_package_generation",
  storygate_package: "comparables_generation",
};

const JOB_TYPE_FROM_DB: Record<string, JobType> = {
  quick_evaluation: "evaluate_quick",
  full_evaluation: "evaluate_full",
  wave_only: "wave_pass",
  synopsis_generation: "synopsis_generate",
  query_package_generation: "query_generate",
  comparables_generation: "storygate_package",
};

export async function createJob(input: {
  manuscript_id: string;
  job_type: JobType;
}): Promise<Job> {
  const now = new Date().toISOString();
  
  // DB GUARD: manuscript_id MUST be numeric for Supabase writes
  // Test strings like "test_ms_..." are memory-store only
  const parsed = Number.parseInt(input.manuscript_id, 10);
  if (Number.isNaN(parsed) || String(parsed) !== input.manuscript_id.trim()) {
    throw new Error(
      `Invalid manuscript_id "${input.manuscript_id}": Database writes require numeric manuscript IDs. ` +
      `Use memory store (TEST_MODE=true) for test strings.`
    );
  }
  const manuscriptId = parsed;

  const payload = {
    manuscript_id: manuscriptId,
    job_type: JOB_TYPE_TO_DB[input.job_type] ?? input.job_type,
    status: "queued" as JobStatus,
    progress: {
      phase: PHASES.PHASE_1,
      phase_status: "queued", // CANON: aligned with JobStatus
      message: "Job created",
    },
    // keep phase/phase_status only in progress JSON for consistency
    policy_family: "standard",
    voice_preservation_level: "balanced",
    english_variant: "us",
  };

  const { data, error } = await supabase
    .from("evaluation_jobs")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create job: ${error.message}`);
  }

  console.log("EvaluationJobCreated", {
    job_id: data.id,
    job_type: input.job_type,
    timestamp: now,
  });

  return mapDbRowToJob(data);
}

export async function getJob(id: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from("evaluation_jobs")
    .select("id, manuscript_id, job_type, status, progress, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get job: ${error.message}`);
  }

  if (!data) return null;

  const job = mapDbRowToJob(data);

  // Validate progress shape; fail fast if corrupted
  const validationErr = validateProgressForPhase(job);
  if (validationErr) {
    console.error(
      `[ProgressValidation] error_code=${validationErr} job_id=${id}`,
      job.progress,
    );

    // Mark job as failed and clear lease (best-effort)
    const { error: updateError } = await supabase
      .from("evaluation_jobs")
      .update({
        status: "failed",
        progress: {
          ...job.progress,
          error_code: validationErr,
          lease_id: null,
          lease_expires_at: null,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error(
        `[ProgressValidation] Failed to mark job failed: ${updateError.message}`,
      );
    }

    // Do not let callers operate on a corrupted job
    return null;
  }

  return job;
}

export async function getAllJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from("evaluation_jobs")
    .select("id, manuscript_id, job_type, status, progress, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list jobs: ${error.message}`);
  }

  return (data ?? []).map(mapDbRowToJob);
}

export async function updateJob(
  id: string,
  updates: Partial<Pick<Job, "status" | "progress">>,
): Promise<Job | null> {
  const existing = await getJob(id);
  if (!existing) return null;

  if (updates.status) {
    assertValidTransition(existing, updates.status as JobStatus);
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.status) {
    payload.status = updates.status;
  }

  // Always merge progress to preserve existing fields
  if (updates.progress) {
    payload.progress = { ...existing.progress, ...updates.progress };
  }

  // Nothing to update besides timestamp; return the existing job
  if (Object.keys(payload).length === 1) {
    return existing;
  }

  const { data, error } = await supabase
    .from("evaluation_jobs")
    .update(payload)
    .eq("id", id)
    .select("id, manuscript_id, job_type, status, progress, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(`Failed to update job: ${error.message}`);
  }

  return mapDbRowToJob(data);
}

/**
 * Safe status update with transition validation and context logging.
 */
export async function safeUpdateJobStatus(
  id: string,
  nextStatus: JobStatus,
  reason: string,
  extraProgress?: Record<string, any>,
): Promise<Job | null> {
  const job = await getJob(id);
  if (!job) return null;

  if (!isValidTransition(job.status, nextStatus)) {
    const err = `Invalid status transition: ${job.status} -> ${nextStatus} (reason: ${reason})`;
    console.error(`[InvalidTransition] job_id=${id} ${err}`);
    throw new Error(err);
  }

  const progress = extraProgress ? { ...job.progress, ...extraProgress } : job.progress;
  return updateJob(id, { status: nextStatus, progress });
}

export async function acquireLeaseForPhase1(
  id: string,
  leaseId: string,
  ttlSeconds = 300,
): Promise<Job | null> {
  const existing = await getJob(id);
  if (!existing) return null;

  const now = new Date();

  // Eligibility: Phase 1 only starts from queued
  if (existing.status !== "queued") return null;

  // If a lease exists and is unexpired, do not steal it
  if (
    existing.progress.lease_expires_at &&
    typeof existing.progress.lease_expires_at === 'string' &&
    new Date(existing.progress.lease_expires_at) > now
  ) {
    return null;
  }

  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  const mergedProgress = {
    ...existing.progress,
    lease_id: leaseId,
    lease_expires_at: expiresAt,
    phase: PHASES.PHASE_1,
    phase_status: "running",
  };

  // Optimistic concurrency: updated_at must match to prevent double-acquire
  const { data, error } = await supabase
    .from("evaluation_jobs")
    .update({
      progress: mergedProgress,
      status: "running",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "queued")
    .eq("updated_at", existing.updated_at)
    .select("id, manuscript_id, job_type, status, progress, created_at, updated_at")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to acquire phase1 lease: ${error.message}`);
  }

  if (!data) return null;
  return mapDbRowToJob(data);
}

export async function acquireLeaseForPhase2(
  id: string,
  leaseId: string,
  ttlSeconds = 300,
): Promise<Job | null> {
  const existing = await getJob(id);
  if (!existing) return null;

  const now = new Date();

  // Phase 2 runs only while the job is already running
  if (existing.status !== "running") {
    return null;
  }

  /**
   * Eligibility:
   * - Normal entry: phase1 + completed
   * - Resume entry: phase2 + running (only if lease expired / free)
   */
  const isPhase1Completed =
    existing.progress.phase === PHASES.PHASE_1 &&
    existing.progress.phase_status === "complete";

  const isPhase2Resumable =
    existing.progress.phase === PHASES.PHASE_2 &&
    existing.progress.phase_status === "running";

  if (!isPhase1Completed && !isPhase2Resumable) {
    return null;
  }

  // Lease checks
  const existingLeaseId = existing.progress.lease_id;

  // Treat missing lease_expires_at as expired if lease_id exists (prevents “stuck forever”)
  const leaseExpiresAtRaw = existing.progress.lease_expires_at;
  const leaseExpiresAt = (leaseExpiresAtRaw && typeof leaseExpiresAtRaw === 'string') 
    ? new Date(leaseExpiresAtRaw) 
    : null;

  const isLeaseFree = !existingLeaseId;
  const isLeaseExpired =
    !!existingLeaseId && (!leaseExpiresAt || leaseExpiresAt <= now);

  if (!isLeaseFree && !isLeaseExpired) {
    return null;
  }

  if (isLeaseExpired) {
    console.log(
      `[Phase2LeaseExpired] job_id=${id} old_lease_id=${existingLeaseId} resuming_from=${
        existing.progress.phase2_last_processed_index ?? -1
      }`,
    );
  }

  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

  // If resuming, do NOT rewrite phase/phase_status; keep them stable.
  // If entering from phase1/completed, flip into phase2/running.
  const mergedProgress = isPhase2Resumable
    ? {
        ...existing.progress,
        lease_id: leaseId,
        lease_expires_at: expiresAt,
      }
    : {
        ...existing.progress,
        lease_id: leaseId,
        lease_expires_at: expiresAt,
        phase: PHASES.PHASE_2,
        phase_status: "running",
      };

  // Optimistic concurrency: prevents concurrent lease acquires / progress stomps
  const { data, error } = await supabase
    .from("evaluation_jobs")
    .update({
      progress: mergedProgress,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "running")
    .eq("updated_at", existing.updated_at)
    .or(
      [
        "and(progress->>phase.eq.phase_1,progress->>phase_status.eq.complete)",
        "and(progress->>phase.eq.phase_2,progress->>phase_status.eq.running)",
      ].join(","),
    )
    .select("id, manuscript_id, job_type, status, progress, created_at, updated_at")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to acquire phase2 lease: ${error.message}`);
  }

  if (!data) return null;
  return mapDbRowToJob(data);
}

export async function incrementCounter(
  id: string,
  counterName: string,
  increment = 1,
): Promise<Job | null> {
  const existing = await getJob(id);
  if (!existing) return null;

  const currentValue = Number(existing.progress[counterName] ?? 0);
  const mergedProgress = {
    ...existing.progress,
    [counterName]: currentValue + increment,
  };

  const { data, error } = await supabase
    .from("evaluation_jobs")
    .update({
      progress: mergedProgress,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, manuscript_id, job_type, status, progress, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(`Failed to increment counter: ${error.message}`);
  }

  return mapDbRowToJob(data);
}

/**
 * Mark a job as failed with structured error envelope
 * Phase A.1: Enables bounded retry and dead-letter queue
 * Phase A.2: Implements retry scheduling with exponential backoff
 */
export async function setJobFailed(
  jobId: string,
  errorEnvelope: {
    code: string;
    message: string;
    retryable: boolean;
    phase: string;
    provider?: string | null;
    context?: Record<string, unknown>;
    occurred_at: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  
  // Get current job to check attempt count
  const job = await getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }
  
  // Fetch current attempt_count and max_attempts from DB
  const { data: jobRow, error: fetchError } = await supabase
    .from('evaluation_jobs')
    .select('attempt_count, max_attempts')
    .eq('id', jobId)
    .single();
  
  if (fetchError || !jobRow) {
    throw new Error(`Failed to fetch job for retry check: ${fetchError?.message}`);
  }
  
  const attemptCount = jobRow.attempt_count ?? 0;
  const maxAttempts = jobRow.max_attempts ?? 3;
  const nextAttempt = attemptCount + 1;
  
  // Determine if we should retry or permanently fail
  const shouldRetry = errorEnvelope.retryable && nextAttempt <= maxAttempts;
  
  let updatePayload: any = {
    last_error: JSON.stringify(errorEnvelope),
    attempt_count: nextAttempt,
    updated_at: now,
  };
  
  if (shouldRetry) {
    // Schedule for retry with backoff
    const { calculateNextAttemptAt } = await import('./retryBackoff');
    const nextAttemptAt = calculateNextAttemptAt(nextAttempt);
    
    updatePayload = {
      ...updatePayload,
      status: 'queued', // Keep as queued for retry
      next_attempt_at: nextAttemptAt,
      progress: {
        ...job.progress,
        phase_status: 'queued',
        message: `Retry scheduled (attempt ${nextAttempt}/${maxAttempts})`,
      },
    };
  } else {
    // Permanently failed (either non-retryable or exhausted attempts)
    updatePayload = {
      ...updatePayload,
      status: 'failed',
      failed_at: now,
      progress: {
        ...job.progress,
        phase_status: 'failed',
        finished_at: now,
        message: errorEnvelope.retryable
          ? `Max retries exhausted (${maxAttempts})`
          : 'Non-retryable error',
      },
    };
  }
  
  const { error } = await supabase
    .from('evaluation_jobs')
    .update(updatePayload)
    .eq('id', jobId);
  
  if (error) {
    throw new Error(`Failed to update job after failure: ${error.message}`);
  }
}

/**
 * Backward compatibility normalizer: converts legacy "completed" to canonical "complete"
 * Can be removed once all production data is migrated
 */
function normalizePhaseStatus(status?: string): string | undefined {
  if (status === "completed") return "complete";
  return status;
}

function mapDbRowToJob(row: any): Job {
  const progress = row.progress || {};
  return {
    id: row.id,
    manuscript_id: Number(row.manuscript_id), // BigInt from DB → number
    job_type: JOB_TYPE_FROM_DB[row.job_type] ?? row.job_type,
    status: row.status,
    progress: {
      ...progress,
      phase_status: normalizePhaseStatus(progress.phase_status),
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_heartbeat: row.last_heartbeat || null,
  };
}

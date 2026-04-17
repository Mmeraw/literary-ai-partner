import { createAdminClient } from "../supabase/admin";
import { validateProgressForPhase } from "./validation";
import {
  assertValidJobStatusTransition,
  normalizeEvaluationJobStatus,
  normalizeEvaluationValidityStatus,
} from "../evaluation/status";
import {
  migrateProgressPhaseToCanonical,
  migrateProgressStageToPhaseStatus,
  validateProgressSchema,
} from "./canon";
import { Job, JobStatus, JobType, PHASES, Phase, JOB_STATUS, JobProgress } from "./types";
import { getLeaseTimeoutSeconds } from "./config";

const JOB_SELECT_FIELDS =
  "id, manuscript_id, user_id, job_type, status, validity_status, progress, created_at, updated_at, last_heartbeat, last_error, failure_envelope, manuscripts(user_id)";
const JOB_SELECT_FIELDS_LEGACY =
  "id, manuscript_id, user_id, job_type, status, progress, created_at, updated_at, last_heartbeat, last_error, failure_envelope, manuscripts(user_id)";

// Lazy-initialized Supabase client - null-safe for CI/build environments
let _supabase: ReturnType<typeof createAdminClient> | undefined;
let _supportsValidityStatusColumn: boolean | undefined;

function getSupabase() {
  if (_supabase === undefined) {
    _supabase = createAdminClient();
  }
  return _supabase;
}

function isMissingValidityStatusColumnError(error: unknown): boolean {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";

  return message.includes("validity_status") && message.includes("does not exist");
}

async function getJobSelectFields(): Promise<string> {
  if (_supportsValidityStatusColumn !== undefined) {
    return _supportsValidityStatusColumn ? JOB_SELECT_FIELDS : JOB_SELECT_FIELDS_LEGACY;
  }

  const { error } = await supabase
    .from("evaluation_jobs")
    .select("id, validity_status")
    .limit(1);

  if (!error) {
    _supportsValidityStatusColumn = true;
    return JOB_SELECT_FIELDS;
  }

  if (isMissingValidityStatusColumnError(error)) {
    _supportsValidityStatusColumn = false;
    console.warn(
      "[JOB-STORE-SUPABASE] validity_status column missing; falling back to legacy select fields until migrations are applied.",
    );
    return JOB_SELECT_FIELDS_LEGACY;
  }

  throw new Error(`Failed to probe evaluation_jobs validity_status support: ${error.message}`);
}

// Module-level accessor that throws meaningful errors when Supabase unavailable
const supabase = new Proxy(
  {} as NonNullable<ReturnType<typeof createAdminClient>>,
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

const CANON_JOB_STATUS_VALUES = new Set(Object.values(JOB_STATUS));
const CANON_PHASE_VALUES = new Set(Object.values(PHASES));

const DEFAULT_LEASE_TIMEOUT_SECONDS = getLeaseTimeoutSeconds();

function assertCanonicalStatusValue(value: string): asserts value is JobStatus {
  if (!CANON_JOB_STATUS_VALUES.has(value as JobStatus)) {
    throw new Error(
      `Non-canonical job status detected: "${value}". ` +
        `Expected: ${Object.values(JOB_STATUS).join(", ")}`,
    );
  }
}

function assertCanonicalPhaseValue(value: string): asserts value is Phase {
  if (!CANON_PHASE_VALUES.has(value as Phase)) {
    throw new Error(
      `Non-canonical phase detected: "${value}". ` +
        `Expected: ${Object.values(PHASES).join(", ")}`,
    );
  }
}

function assertCanonicalPhaseStatusValue(value: string | null | undefined): void {
  if (value === null || value === undefined) return;
  assertCanonicalStatusValue(value);
}

function normalizeLifecycleStatus(value: unknown): JobStatus {
  return normalizeEvaluationJobStatus(value) as JobStatus;
}

function assertAndNormalizeLifecycleTransition(from: JobStatus, to: unknown): JobStatus {
  const next = normalizeLifecycleStatus(to);
  assertValidJobStatusTransition(from, next);
  return next;
}

function validateProgressWrite(progress: Record<string, unknown>): void {
  validateProgressSchema(progress);
  if ("phase" in progress && typeof progress.phase === "string") {
    assertCanonicalPhaseValue(progress.phase);
  }
  if ("phase_status" in progress) {
    assertCanonicalPhaseStatusValue(progress.phase_status as string | null | undefined);
  }
}

export async function createJob(input: {
  manuscript_id: string;
  user_id: string;
  job_type: JobType;
}): Promise<Job> {
  const now = new Date().toISOString();
  
  // DB GUARD: manuscript_id MUST be numeric for Supabase writes
  // Accept string or number at boundary, but enforce numeric for DB FK constraints
  const inputType = typeof input.manuscript_id;
  if (inputType !== 'string' && inputType !== 'number') {
    throw new Error(
      `Invalid manuscript_id type: expected string or number, got ${inputType}`
    );
  }
  
  // Normalize: if number, use directly; if string, trim and parse
  let manuscriptId: number;
  if (typeof input.manuscript_id === 'number') {
    manuscriptId = input.manuscript_id;
    if (!Number.isInteger(manuscriptId) || manuscriptId <= 0) {
      throw new Error(
        `Invalid manuscript_id ${input.manuscript_id}: must be positive integer`
      );
    }
  } else {
    const trimmed = (input.manuscript_id as string).trim();
    if (trimmed === '') {
      throw new Error('Invalid manuscript_id: empty string');
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isNaN(parsed) || String(parsed) !== trimmed) {
      throw new Error(
        `Invalid manuscript_id "${input.manuscript_id}": Database writes require numeric manuscript IDs. ` +
        `Use memory store (TEST_MODE=true) for test strings.`
      );
    }
    manuscriptId = parsed;
  }

  const jobSelectFields = await getJobSelectFields();
  const includeValidityStatus = jobSelectFields === JOB_SELECT_FIELDS;

  const payload = {
    manuscript_id: manuscriptId,
    user_id: input.user_id,
    job_type: JOB_TYPE_TO_DB[input.job_type] ?? input.job_type,
    status: normalizeLifecycleStatus(JOB_STATUS.QUEUED),
    ...(includeValidityStatus
      ? { validity_status: normalizeEvaluationValidityStatus("pending") }
      : {}),
    progress: {
      phase: PHASES.PHASE_1,
      phase_status: JOB_STATUS.QUEUED, // CANON: aligned with JobStatus
      message: "Job created",
    },
    // keep phase/phase_status only in progress JSON for consistency
    policy_family: "standard",
    voice_preservation_level: "balanced",
    english_variant: "us",
  };

  validateProgressWrite(payload.progress);
  assertCanonicalStatusValue(payload.status);

  const { data, error } = await supabase
    .from("evaluation_jobs")
    .insert(payload)
    .select(jobSelectFields)
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
  const jobSelectFields = await getJobSelectFields();
  const { data, error } = await supabase
    .from("evaluation_jobs")
    .select(jobSelectFields)
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

    const failedStatus = assertAndNormalizeLifecycleTransition(
      job.status,
      JOB_STATUS.FAILED,
    );

    // Mark job as failed and clear lease (best-effort)
    const { error: updateError } = await supabase
      .from("evaluation_jobs")
      .update({
        status: failedStatus,
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
  const jobSelectFields = await getJobSelectFields();
  const { data, error } = await supabase
    .from("evaluation_jobs")
    .select(jobSelectFields)
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
  const jobSelectFields = await getJobSelectFields();
  const existing = await getJob(id);
  if (!existing) return null;

  let nextStatus: JobStatus | null = null;
  if (updates.status) {
    nextStatus = assertAndNormalizeLifecycleTransition(existing.status, updates.status);
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (nextStatus) {
    payload.status = nextStatus;
  }

  // Always merge progress to preserve existing fields
  if (updates.progress) {
    validateProgressWrite(updates.progress as Record<string, unknown>);
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
    .select(jobSelectFields)
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

  const normalizedNext = assertAndNormalizeLifecycleTransition(job.status, nextStatus);
  console.log(`[JobStatusUpdate] job_id=${id} ${job.status} -> ${normalizedNext} reason=${reason}`);

  const progress = extraProgress ? { ...job.progress, ...extraProgress } : job.progress;
  return updateJob(id, { status: normalizedNext, progress });
}

/**
 * QC Gate 2: DB-Atomic Claim for Phase 1
 * Uses RPC for atomic eligibility check + claim in single SQL UPDATE.
 * HARD RULE: NO FALLBACK to SDK update - fail-closed if RPC unavailable.
 * Includes PHASE GUARD: cannot steal Phase 2+ jobs with expired leases.
 */
export async function acquireLeaseForPhase1(
  id: string,
  leaseId: string,
  ttlSeconds = DEFAULT_LEASE_TIMEOUT_SECONDS,
): Promise<Job | null> {
  const { data, error } = await supabase.rpc("claim_evaluation_job_phase1", {
    p_job_id: id,
    p_lease_id: leaseId,
    p_ttl_seconds: ttlSeconds,
  });

  if (error) {
    // Fail-closed: do NOT fall back to SDK update.
    // This ensures Gate 2 is truly closed.
    throw new Error(`claim_evaluation_job_phase1 RPC failed: ${error.message}`);
  }

  if (!data || data.length === 0) return null;
  return mapDbRowToJob(data[0]);
}

export async function acquireLeaseForPhase2(
  id: string,
  leaseId: string,
  ttlSeconds = DEFAULT_LEASE_TIMEOUT_SECONDS,
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
   * - Normal entry: phase1 + complete
   * - Resume entry: phase2 + running (only if lease expired / free)
   */
  const isPhase1Complete =
    existing.progress.phase === PHASES.PHASE_1 &&
    existing.progress.phase_status === "complete";

  const isPhase2Resumable =
    existing.progress.phase === PHASES.PHASE_2 &&
    existing.progress.phase_status === "running";

  if (!isPhase1Complete && !isPhase2Resumable) {
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

  // Dead lease hardening: if a lease is expired and no heartbeat has been
  // recorded beyond lease expiry, classify and fail the job (fail-closed).
  if (isLeaseExpired) {
    const heartbeatAt =
      typeof existing.last_heartbeat === "string" ? new Date(existing.last_heartbeat) : null;
    const leaseExpiryTime = leaseExpiresAt?.getTime() ?? 0;
    const heartbeatTime = heartbeatAt?.getTime() ?? 0;
    const deadLease = !heartbeatAt || heartbeatTime <= leaseExpiryTime;

    if (deadLease) {
      const jobSelectFields = await getJobSelectFields();
      const nowIso = new Date().toISOString();
      const failedStatus = assertAndNormalizeLifecycleTransition(
        existing.status,
        JOB_STATUS.FAILED,
      );
      const errorMessage =
        "Lease expired with no heartbeat; marking job failed to prevent stuck running state";

      const { data: failedRow, error: failError } = await supabase
        .from("evaluation_jobs")
        .update({
          status: failedStatus,
          last_error: errorMessage,
          failure_envelope: {
            error_code: "LEASE_EXPIRED",
            code: "LEASE_EXPIRED",
            message: errorMessage,
            retryable: false,
            phase: PHASES.PHASE_2,
            provider: null,
            occurred_at: nowIso,
            context: {
              lease_id: existingLeaseId,
              lease_expires_at: leaseExpiresAtRaw ?? null,
              last_heartbeat: existing.last_heartbeat,
            },
          },
          progress: {
            ...existing.progress,
            phase: PHASES.PHASE_2,
            phase_status: JOB_STATUS.FAILED,
            message: "Phase 2 lease expired without heartbeat",
            error_code: "LEASE_EXPIRED",
            lease_id: null,
            lease_expires_at: null,
            finished_at: nowIso,
          },
          updated_at: nowIso,
        })
        .eq("id", id)
        .eq("status", JOB_STATUS.RUNNING)
        .select(jobSelectFields)
        .maybeSingle();

      if (failError) {
        throw new Error(`Failed to classify dead phase2 lease: ${failError.message}`);
      }

      if (failedRow) {
        console.warn("[Phase2LeaseDeadJobFailed]", {
          job_id: id,
          lease_id: existingLeaseId,
          lease_expires_at: leaseExpiresAtRaw,
          last_heartbeat: existing.last_heartbeat,
        });
      } else {
        console.warn("[Phase2LeaseDeadJobLostRace]", {
          job_id: id,
          lease_id: existingLeaseId,
          lease_expires_at: leaseExpiresAtRaw,
          last_heartbeat: existing.last_heartbeat,
        });
      }

      return null;
    }
  }

  if (isLeaseExpired) {
    console.log(
      `[Phase2LeaseExpired] job_id=${id} old_lease_id=${existingLeaseId} resuming_from=${
        existing.progress.phase2_last_processed_index ?? -1
      }`,
    );
  }

  const { data, error } = await supabase.rpc("claim_evaluation_job_phase2", {
    p_job_id: id,
    p_lease_id: leaseId,
    p_ttl_seconds: ttlSeconds,
  });

  if (error) {
    throw new Error(`claim_evaluation_job_phase2 RPC failed: ${error.message}`);
  }

  if (!data || data.length === 0) return null;
  return mapDbRowToJob(data[0]);
}

export async function incrementCounter(
  id: string,
  counterName: string,
  increment = 1,
): Promise<Job | null> {
  const jobSelectFields = await getJobSelectFields();
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
    .select(jobSelectFields)
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

  const failedStatus = assertAndNormalizeLifecycleTransition(
    job.status,
    JOB_STATUS.FAILED,
  );
  
  // Determine if we should retry or permanently fail
  const shouldRetry = errorEnvelope.retryable && nextAttempt <= maxAttempts;
  
  let updatePayload: any = {
    last_error: errorEnvelope.message,
    failure_envelope: {
      error_code: errorEnvelope.code,
      code: errorEnvelope.code,
      message: errorEnvelope.message,
      retryable: errorEnvelope.retryable,
      phase: errorEnvelope.phase,
      provider: errorEnvelope.provider ?? null,
      occurred_at: errorEnvelope.occurred_at,
      context: errorEnvelope.context ?? null,
    },
    attempt_count: nextAttempt,
    updated_at: now,
  };
  
  if (shouldRetry) {
    // Schedule for retry with backoff
      const { calculateNextAttemptAt } = await import('./retryBackoff');
    const nextAttemptAt = calculateNextAttemptAt(nextAttempt);
    
    updatePayload = {
      ...updatePayload,
      status: failedStatus,
      next_attempt_at: nextAttemptAt,
      progress: {
        ...job.progress,
        phase_status: JOB_STATUS.FAILED,
        message: `Retry eligible (attempt ${nextAttempt}/${maxAttempts}); awaiting explicit requeue`,
      },
    };
  } else {
    // Permanently failed (either non-retryable or exhausted attempts)
    updatePayload = {
      ...updatePayload,
      status: failedStatus,
      failed_at: now,
      progress: {
        ...job.progress,
        phase_status: JOB_STATUS.FAILED,
        finished_at: now,
        message: errorEnvelope.retryable
          ? `Max retries exhausted (${maxAttempts})`
          : 'Non-retryable error',
            error_code: errorEnvelope.code || "UNKNOWN",
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

function mapDbRowToJob(row: any): Job {
  const progress = row.progress || {};
  const migratedPhaseStatus = migrateProgressStageToPhaseStatus(progress);
  const migratedProgress = migrateProgressPhaseToCanonical(migratedPhaseStatus);
  
  // Ensure all required JobProgress fields are present
  const completeProgress: JobProgress = {
    phase: migratedProgress.phase ?? null,
    phase_status: migratedProgress.phase_status ?? null,
    total_units: migratedProgress.total_units ?? null,
    completed_units: migratedProgress.completed_units ?? null,
    ...migratedProgress, // Preserve any additional fields from DB
  };
  
  const ownerUserId =
    row?.manuscripts?.user_id ??
    (Array.isArray(row?.manuscripts) ? row.manuscripts[0]?.user_id : null) ??
    row?.user_id ??
    null;

  if (typeof ownerUserId !== "string" || ownerUserId.length === 0) {
    throw new Error(
      `[JOB-STORE-SUPABASE] Missing ownership user_id for job ${row?.id ?? "(unknown)"}`,
    );
  }

  const failureEnvelope =
    row?.failure_envelope && typeof row.failure_envelope === "object"
      ? row.failure_envelope
      : null;

  const parsedLastErrorCode = (() => {
    if (typeof row?.last_error !== "string") return null;
    try {
      const parsed = JSON.parse(row.last_error);
      if (parsed && typeof parsed === "object") {
        if (typeof parsed.code === "string") return parsed.code;
        if (typeof parsed.error_code === "string") return parsed.error_code;
      }
      return null;
    } catch {
      return null;
    }
  })();

  const failureCode =
    (typeof failureEnvelope?.error_code === "string" && failureEnvelope.error_code) ||
    (typeof failureEnvelope?.code === "string" && failureEnvelope.code) ||
    (typeof completeProgress?.error_code === "string" && completeProgress.error_code) ||
    parsedLastErrorCode ||
    null;

  return {
    id: row.id,
    user_id: ownerUserId,
    manuscript_id: Number(row.manuscript_id), // BigInt from DB → number
    job_type: JOB_TYPE_FROM_DB[row.job_type] ?? row.job_type,
    status: row.status,
    validity_status: normalizeEvaluationValidityStatus(row.validity_status ?? "pending"),
    progress: completeProgress,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_heartbeat: row.last_heartbeat || null,
    last_error: row.last_error ?? null,
    failure_code: failureCode,
  };
}

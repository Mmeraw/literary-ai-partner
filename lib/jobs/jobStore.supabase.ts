import { getSupabaseClient } from "../supabase.js";
import { assertValidTransition, isValidTransition } from "./transitions";
import { validateProgressForPhase } from "./validation";
import { Job, JobStatus, JobType } from "./types";

const supabase = getSupabaseClient();

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
  let manuscriptId = Number.parseInt(input.manuscript_id, 10);

  // For testing: if manuscript_id is not numeric, create a test manuscript
  if (Number.isNaN(manuscriptId)) {
    console.warn(
      `Non-numeric manuscript_id "${input.manuscript_id}" provided; creating test manuscript`,
    );
    const { data: manuscript, error: manuscriptError } = await supabase
      .from("manuscripts")
      .insert({ title: `Test Manuscript ${now}` })
      .select()
      .single();

    if (manuscriptError) {
      throw new Error(
        `Failed to create test manuscript: ${manuscriptError.message}`,
      );
    }
    manuscriptId = manuscript.id;
  }

  const payload = {
    manuscript_id: manuscriptId,
    job_type: JOB_TYPE_TO_DB[input.job_type] ?? input.job_type,
    status: "queued" as JobStatus,
    progress: {
      phase: "phase1",
      phase_status: "not_started",
      stage: "queued",
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

  const progress = extraProgress
    ? { ...job.progress, ...extraProgress }
    : job.progress;

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
  if (existing.status !== "queued") return null;
  if (
    existing.progress.lease_expires_at &&
    new Date(existing.progress.lease_expires_at) > now
  ) {
    return null;
  }

  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  const mergedProgress = {
    ...existing.progress,
    lease_id: leaseId,
    lease_expires_at: expiresAt,
    phase: "phase1",
    phase_status: "running",
  };

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

  // Check eligibility based on progress
  if (
    existing.progress.phase !== "phase1" ||
    existing.progress.phase_status !== "complete"
  ) {
    return null;
  }

  // Check if lease is held by someone else
  const existingLeaseId = existing.progress.lease_id;
  const leaseExpiresAt = existing.progress.lease_expires_at
    ? new Date(existing.progress.lease_expires_at)
    : null;

  const isLeaseExpired = !!leaseExpiresAt && leaseExpiresAt <= now;
  const isLeaseFree = !existingLeaseId;

  if (!isLeaseFree && !isLeaseExpired) {
    // Lease is held by someone else and not expired
    return null;
  }

  // Log if we're taking over an expired lease
  if (isLeaseExpired) {
    console.log(
      `[Phase2LeaseExpired] job_id=${id} old_lease_id=${existingLeaseId} resuming_from=${
        existing.progress.phase2_last_processed_index ?? -1
      }`,
    );
  }

  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  const mergedProgress = {
    ...existing.progress,
    lease_id: leaseId,
    lease_expires_at: expiresAt,
    phase: "phase2",
    phase_status: "running",
  };

  // Phase 2 runs after Phase 1, so status must be "running" already
  // Only update progress and updated_at, do not change status
  const { data, error } = await supabase
    .from("evaluation_jobs")
    .update({
      progress: mergedProgress,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "running")
    .eq("progress->>phase", "phase1")
    .eq("progress->>phase_status", "complete")
    // allow takeover of expired leases; JS guard above blocks active leases
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

function mapDbRowToJob(row: any): Job {
  return {
    id: row.id,
    manuscript_id: String(row.manuscript_id),
    job_type: JOB_TYPE_FROM_DB[row.job_type] ?? row.job_type,
    status: row.status,
    progress: row.progress || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

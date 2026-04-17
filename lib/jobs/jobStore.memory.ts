import { Job, JobStatus, JobType, JOB_STATUS, PHASES, Phase } from "./types";
import { assertValidTransition } from "./transitions";
import { debugLog } from "./logging";
import { assertNotProductionMemoryStore } from "./guards";
import { validateProgressSchema } from "./canon";

// Production Safety: Ensure memory store is never used in production
// Memory store is for tests/dev only - not concurrent-safe or durable
// Lazy initialization prevents any side effects at import time
let _store: Map<string, Job> | null = null;

const CANON_JOB_STATUS_VALUES = new Set(Object.values(JOB_STATUS));
const CANON_PHASE_VALUES = new Set(Object.values(PHASES));

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

function validateProgressWrite(progress: Record<string, unknown>): void {
  validateProgressSchema(progress);
  if ("phase" in progress && typeof progress.phase === "string") {
    assertCanonicalPhaseValue(progress.phase);
  }
  if ("phase_status" in progress) {
    assertCanonicalPhaseStatusValue(progress.phase_status as string | null | undefined);
  }
}

function getStore(): Map<string, Job> {
  if (_store) return _store;

  assertNotProductionMemoryStore(); // Guard runs only on first use, not at import
  const g = globalThis as unknown as { __RG_JOBS__?: Map<string, Job> };
  _store = (g.__RG_JOBS__ ??= new Map<string, Job>());
  return _store;
}

export function createJob(input: { manuscript_id: string; job_type: JobType; user_id: string }): Job {
  const store = getStore();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const job: Job = {
    id,
    user_id: input.user_id,
    manuscript_id: input.manuscript_id, // Keep as-is for test compatibility (string or number)
    job_type: input.job_type,
    status: "queued",
    validity_status: "pending",
    progress: {
      // CANON: phase + phase_status are the stored state machine keys
      // phase: phase_0 | phase_1 | phase_2
      // phase_status: queued | running | complete | failed (JobStatus | null)
      // CANON counters: total_units, completed_units (matching phase writers)
      phase: "phase_0",
      phase_status: "queued",
      total_units: null,
      completed_units: null,
    },
    created_at: now,
    updated_at: now,
    last_heartbeat: null,
  };

  store.set(id, job);

  debugLog("EvaluationJobCreated", { job_id: id, job_type: input.job_type, timestamp: now });

  return job;
}

export function getJob(id: string): Job | null {
  const store = getStore();
  return store.get(id) ?? null;
}

export function getAllJobs(): Job[] {
  const store = getStore();
  return Array.from(store.values());
}

export function updateJobStatus(id: string, nextStatus: JobStatus): Job | null {
  const store = getStore();
  const job = store.get(id);
  if (!job) return null;

  assertCanonicalStatusValue(nextStatus);

    assertValidTransition(job, nextStatus);
  const updated: Job = {
    ...job,
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };

  store.set(id, updated);
  return updated;
}

export function updateJob(id: string, updates: Partial<Job>): Job | null {
  const store = getStore();
  const job = store.get(id);
  if (!job) return null;

  if (updates.status) {
    assertCanonicalStatusValue(updates.status);
      assertValidTransition(job, updates.status as JobStatus);
  }

  // progress is intentionally flat; shallow merge is canonical to prevent nested clobbering
  if (updates.progress) {
    validateProgressWrite(updates.progress as Record<string, unknown>);
  }
  const updatedProgress = updates.progress ? { ...job.progress, ...updates.progress } : job.progress;

  const updated: Job = {
    ...job,
    ...updates,
    progress: updatedProgress,
    updated_at: new Date().toISOString(),
  };

  store.set(id, updated);
  return updated;
}
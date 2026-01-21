import { Job, JobStatus, JobType } from "./types";
import { debugLog } from "./logging";
import { assertNotProductionMemoryStore } from "./guards";

// Production Safety: Ensure memory store is never used in production
// Memory store is for tests/dev only - not concurrent-safe or durable
// Lazy initialization prevents any side effects at import time
let _store: Map<string, Job> | null = null;

function getStore(): Map<string, Job> {
  if (_store) return _store;

  assertNotProductionMemoryStore(); // Guard runs only on first use, not at import
  const g = globalThis as unknown as { __RG_JOBS__?: Map<string, Job> };
  _store = (g.__RG_JOBS__ ??= new Map<string, Job>());
  return _store;
}

export function createJob(input: { manuscript_id: string; job_type: JobType }): Job {
  const store = getStore();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const job: Job = {
    id,
    manuscript_id: input.manuscript_id,
    job_type: input.job_type,
    status: "queued",
    progress: {},
    created_at: now,
    updated_at: now,
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

  // progress is intentionally flat; shallow merge is canonical to prevent nested clobbering
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
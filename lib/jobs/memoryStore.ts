export type JobStatus = "queued" | "running" | "retry_pending" | "failed" | "complete";

export type Job = {
  id: string;
  manuscript_id: string;
  job_type: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
};

const g = globalThis as unknown as { __RG_JOBS__?: Map<string, Job> };
const store = (g.__RG_JOBS__ ??= new Map<string, Job>());

export function createJob(input: { manuscript_id: string; job_type: string }): Job {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const job: Job = {
    id,
    manuscript_id: input.manuscript_id,
    job_type: input.job_type,
    status: "queued",
    created_at: now,
    updated_at: now,
  };

  store.set(id, job);
  return job;
}

export function getJob(id: string): Job | null {
  return store.get(id) ?? null;
}

export function updateJobStatus(id: string, nextStatus: JobStatus): Job | null {
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

export function isValidTransition(from: JobStatus, to: JobStatus): boolean {
  const allowed: Record<JobStatus, JobStatus[]> = {
    queued: ["running", "failed"],
    running: ["complete", "failed"],
    retry_pending: ["queued", "failed"],
    failed: ["retry_pending"],
    complete: [],
  };

  return allowed[from].includes(to);
}

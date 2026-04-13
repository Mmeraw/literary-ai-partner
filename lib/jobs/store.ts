import type { Job, Phase } from "./types";
import { JOB_STATUS, PHASES } from "./types";
import {
  createJob as memCreateJob,
  getJob as memGetJob,
  getAllJobs as memGetAllJobs,
  updateJob as memUpdateJob,
} from "./jobStore.memory";
// import { assertValidTransition } from "./transitions"; // currently unused

const USE_SUPABASE = process.env.USE_SUPABASE_JOBS === "true";

let createJob: typeof memCreateJob,
  getJob: typeof memGetJob,
  getAllJobs: typeof memGetAllJobs,
  updateJob: typeof memUpdateJob,
  acquireLeaseForPhase1: (jobId: string, leaseId: string, ttl: number) => Promise<Job | null>,
  acquireLeaseForPhase2: (jobId: string, leaseId: string, ttl: number) => Promise<Job | null>,
  incrementCounter: () => Promise<number | null>,
  setJobFailed: (jobId: string, errorEnvelope: any) => Promise<void>;

if (USE_SUPABASE) {
  // SAFE FOR BUILD TIME: Lazy-load Supabase store only when functions are called
  // This avoids importing lib/supabase.js at module init during next build
  let supabaseStore: any = null;

  const loadSupabaseStore = async () => {
    if (!supabaseStore) {
      supabaseStore = await import("./jobStore.supabase");
    }
    return supabaseStore;
  };

  // Use .then() for lazy-load; callers always await these so Promise return is safe
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (createJob as any) = (...args: any[]) => loadSupabaseStore().then((s: any) => s.createJob(...args));
  (getJob as any) = (...args: any[]) => loadSupabaseStore().then((s: any) => s.getJob(...args));
  (getAllJobs as any) = (...args: any[]) => loadSupabaseStore().then((s: any) => s.getAllJobs(...args));
  (updateJob as any) = (...args: any[]) => loadSupabaseStore().then((s: any) => s.updateJob(...args));
  acquireLeaseForPhase1 = (...args) => loadSupabaseStore().then((s: any) => s.acquireLeaseForPhase1(...args));
  acquireLeaseForPhase2 = (...args) => loadSupabaseStore().then((s: any) => s.acquireLeaseForPhase2(...args));
  incrementCounter = (...args) => loadSupabaseStore().then((s: any) => s.incrementCounter(...args));
  setJobFailed = (...args) => loadSupabaseStore().then((s: any) => s.setJobFailed(...args));
} else {
  // In-memory store: no real leases, just delegate directly.
  createJob = memCreateJob;
  getJob = memGetJob;
  getAllJobs = memGetAllJobs;
  updateJob = memUpdateJob;
  acquireLeaseForPhase1 = async (jobId: string, _leaseId: string, _ttl: number) =>
    memGetJob(jobId);
  acquireLeaseForPhase2 = async (jobId: string, _leaseId: string, _ttl: number) =>
    memGetJob(jobId);
  incrementCounter = async () => null;

  // Memory store doesn't persist errors, just stub
  setJobFailed = async (_jobId: string, _errorEnvelope: any) => {
    console.warn('[Memory Store] setJobFailed called but not persisted in memory mode');
  };
}

export {
  createJob,
  getJob,
  getAllJobs,
  updateJob,
  acquireLeaseForPhase1,
  acquireLeaseForPhase2,
  incrementCounter,
  setJobFailed,
};

export function canRunPhase(
  job: Job,
  phase: Phase,
): { ok: boolean; reason?: string } {
  if (phase === PHASES.PHASE_1) {
    const progress = job.progress ?? { phase: null, phase_status: null };
    const phase1QueuedCandidate =
      job.status === JOB_STATUS.QUEUED &&
      progress.phase === PHASES.PHASE_1 &&
      (progress.phase_status === JOB_STATUS.QUEUED || progress.phase_status === "triggered");

    if (!phase1QueuedCandidate) {
      return {
        ok: false,
        reason:
          `Job not eligible for phase_1. status=${job.status}, ` +
          `phase=${String(progress.phase)}, phase_status=${String(progress.phase_status)}`,
      };
    }
    return { ok: true };
  } else if (phase === PHASES.PHASE_2) {
    if (
      job.progress.phase !== PHASES.PHASE_1 || job.progress.phase_status !== "complete"
    ) {
      return {
        ok: false,
        reason: `Phase 1 not complete: phase=${job.progress.phase}, phase_status=${job.progress.phase_status}`,
      };
    }
    return { ok: true };
  }
  return { ok: false, reason: "Unknown phase" };
}

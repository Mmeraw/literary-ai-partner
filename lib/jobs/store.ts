import type { Job, Phase } from "./types";
import { PHASES } from "./types";
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

  // Functions are already async, so call them directly (not async wrap)
  createJob = async (...args) => (await loadSupabaseStore()).createJob(...args);
  getJob = async (...args) => (await loadSupabaseStore()).getJob(...args);
  getAllJobs = async (...args) => (await loadSupabaseStore()).getAllJobs(...args);
  updateJob = async (...args) => (await loadSupabaseStore()).updateJob(...args);
  acquireLeaseForPhase1 = async (...args) => (await loadSupabaseStore()).acquireLeaseForPhase1(...args);
  acquireLeaseForPhase2 = async (...args) => (await loadSupabaseStore()).acquireLeaseForPhase2(...args);
  incrementCounter = async (...args) => (await loadSupabaseStore()).incrementCounter(...args);
  setJobFailed = async (...args) => (await loadSupabaseStore()).setJobFailed(...args);
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
    if (job.status !== "queued") {
      return { ok: false, reason: `Job not queued for phase_1: ${job.status}` };
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

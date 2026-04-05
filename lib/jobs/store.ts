import type { Job, Phase } from "./types";
import { PHASES } from "./types";
import type {
  CanonicalEvaluationArtifact,
  EvaluationJob,
  PersistCanonicalAndSummaryAndCompleteResult,
  ReportSummaryProjection,
} from "./finalize.types";
import type { FailureCode } from "./failures";
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

export type PersistCanonicalAndSummaryAndCompleteJobArgs = {
  job: EvaluationJob;
  worker_id: string;
  canonical: CanonicalEvaluationArtifact;
  summary: ReportSummaryProjection;
};

export type MarkFinalizerJobFailedArgs = {
  job_id: string;
  worker_id: string;
  failure_code: FailureCode;
  last_error: string;
};

let _finalizerStoreModule: any = null;

const loadFinalizerStore = async () => {
  if (!_finalizerStoreModule) {
    _finalizerStoreModule = await import("./store.finalizer");
  }
  return _finalizerStoreModule;
};

export async function persistCanonicalAndSummaryAndCompleteJob(
  args: PersistCanonicalAndSummaryAndCompleteJobArgs,
): Promise<PersistCanonicalAndSummaryAndCompleteResult> {
  if (!USE_SUPABASE) {
    throw new Error(
      "[FINALIZER-STORE] Completion authority unavailable without Supabase backing",
    );
  }

  const store = await loadFinalizerStore();
  return store.persistCanonicalAndSummaryAndCompleteJob(args);
}

export async function markJobFailed(
  args: MarkFinalizerJobFailedArgs,
): Promise<void> {
  if (!USE_SUPABASE) {
    throw new Error(
      "[FINALIZER-STORE] markJobFailed unavailable without Supabase backing",
    );
  }

  const store = await loadFinalizerStore();
  return store.markJobFailed(args);
}

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

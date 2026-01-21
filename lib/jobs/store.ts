import { createJob as memCreateJob, getJob as memGetJob, getAllJobs as memGetAllJobs, updateJob as memUpdateJob } from "./jobStore.memory";
// import { assertValidTransition } from "./transitions"; // currently unused

const USE_SUPABASE = process.env.USE_SUPABASE_JOBS === "true";

let createJob,
  getJob,
  getAllJobs,
  updateJob,
  acquireLeaseForPhase1,
  acquireLeaseForPhase2,
  incrementCounter;

if (USE_SUPABASE) {
  const supabaseStore = require("./jobStore.supabase");
  createJob = supabaseStore.createJob;
  getJob = supabaseStore.getJob;
  getAllJobs = supabaseStore.getAllJobs;
  updateJob = supabaseStore.updateJob;
  acquireLeaseForPhase1 = supabaseStore.acquireLeaseForPhase1;
  acquireLeaseForPhase2 = supabaseStore.acquireLeaseForPhase2;
  incrementCounter = supabaseStore.incrementCounter;
} else {
  // In-memory store: no real leases, just return the job so workers can run.
  createJob = async (...args) => memCreateJob(...args);
  getJob = async (...args) => memGetJob(...args);
  getAllJobs = async (...args) => memGetAllJobs(...args);
  updateJob = async (...args) => memUpdateJob(...args);

  acquireLeaseForPhase1 = async (jobId: string, _leaseId: string, _ttl: number) =>
    memGetJob(jobId);
  acquireLeaseForPhase2 = async (jobId: string, _leaseId: string, _ttl: number) =>
    memGetJob(jobId);

  incrementCounter = async () => null;
}

export {
  createJob,
  getJob,
  getAllJobs,
  updateJob,
  acquireLeaseForPhase1,
  acquireLeaseForPhase2,
  incrementCounter,
};

export function canRunPhase(
  job: Job,
  phase: "phase1" | "phase2",
): { ok: boolean; reason?: string } {
  if (phase === "phase1") {
    if (job.status !== "queued") {
      return { ok: false, reason: `Job not queued for phase1: ${job.status}` };
    }
    return { ok: true };
  } else if (phase === "phase2") {
    if (
      job.progress.phase !== "phase1" ||
      job.progress.phase_status !== "complete"
    ) {
      return {
        ok: false,
        reason: `Phase1 not complete: phase=${job.progress.phase}, phase_status=${job.progress.phase_status}`,
      };
    }
    return { ok: true };
  }
  return { ok: false, reason: "Unknown phase" };
}

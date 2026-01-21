// Contract snapshot for Phase 1:
// progress lives at job.progress.{total_units,completed_units,failed_units}
// status transitions only in route.ts (queued→running) and terminal worker update (→complete|failed)

export const PHASE_1_STATES = {
  NOT_STARTED: "not_started",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type Phase1State = (typeof PHASE_1_STATES)[keyof typeof PHASE_1_STATES];

const ALLOWED_TRANSITIONS: Record<Phase1State, Phase1State[]> = {
  not_started: ["running"],
  running: ["completed", "failed"],
  failed: ["running"],
  completed: [],
};

export function canTransitionPhase1(
  from: Phase1State,
  to: Phase1State,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canRetryPhase1(options: {
  phase_1_status: Phase1State;
  retry_count: number;
  max_retries: number;
  next_retry_at?: string | null;
  now?: Date;
}): boolean {
  const {
    phase_1_status,
    retry_count,
    max_retries,
    next_retry_at,
    now = new Date(),
  } = options;

  if (phase_1_status !== PHASE_1_STATES.FAILED) return false;
  if (retry_count >= max_retries) return false;

  if (!next_retry_at) return true;

  const scheduled = new Date(next_retry_at);
  if (Number.isNaN(scheduled.getTime())) return true;

  return scheduled.getTime() <= now.getTime();
}

import { getJob, updateJob } from "./store";

export async function runPhase1(jobId: string): Promise<void> {
  let job = await getJob(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  // Acquire lease atomically with eligibility check
  const { acquireLeaseForPhase1 } = await import("./store");
  const lease_id = crypto.randomUUID();
  const leasedJob = await acquireLeaseForPhase1(jobId, lease_id, 30); // 30 seconds TTL

  if (!leasedJob) {
    console.log("Phase1LeaseNotAcquired", {
      job_id: jobId,
      phase: "phase1",
      reason: "not eligible or already running",
    });
    return;
  }

  // Update job reference to leased version
  job = leasedJob;

  // Fake work: split manuscript into N units (mocked)
  const units = ["unit1", "unit2", "unit3", "unit4", "unit5"]; // Mocked units

  const existing_index = job.progress.phase1_last_processed_index ?? -1;
  const start_index = existing_index + 1;
  const existing_completed = job.progress.completed_units ?? 0;
  const completed_units = Math.max(
    existing_completed,
    start_index > 0 ? start_index : 0,
  );
  const started_at =
    job.progress.started_at ?? new Date().toISOString();

  // Set total_units, phase, phase_status (lease already set by acquireLease)
  await updateJob(jobId, {
    progress: {
      stage: "starting",
      message: "Initializing phase 1",
      total_units: units.length,
      completed_units,
      started_at,
      phase: "phase1",
      phase_status: "running",
      phase1_last_processed_index: existing_index,
    },
  });

  let processed = completed_units;
  console.log(
    `[Phase1] Loop start_index=${start_index} units_length=${units.length}`,
  );

  try {
    for (let i = start_index; i < units.length; i++) {
      // Invariant checks
      const currentJob = await getJob(jobId);
      if (!currentJob) return;

      const progress = currentJob.progress;

      if (progress.phase !== "phase1" || progress.phase_status !== "running") {
        console.log(
          "Phase1 invariant failed: phase or phase_status mismatch",
        );
        return;
      }

      if (
        progress.lease_expires_at &&
        new Date(progress.lease_expires_at) <= new Date()
      ) {
        console.log("Phase1 lease expired");
        return;
      }

      if (
        (progress.completed_units || 0) > (progress.total_units || 0)
      ) {
        console.log(
          "Phase1 invariant failed: completed_units > total_units",
        );
        return;
      }

      // Simulate processing time
      await new Promise<void>((resolve) => setTimeout(resolve, 500));

      processed = i + 1;

      // Heartbeat lease
      const new_lease_expires_at = new Date(
        Date.now() + 30_000,
      ).toISOString();

      await updateJob(jobId, {
        progress: {
          stage: "processing",
          message: `Processing ${units[i]}`,
          completed_units: processed,
          phase1_last_processed_index: i,
          lease_expires_at: new_lease_expires_at,
        },
      });
    }
  } catch (e) {
    console.error("Phase1Error", {
      job_id: jobId,
      phase: "phase1",
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
      processed_before_error: processed,
      total_units: units.length,
    });
    processed = 0; // Mark as failed
  }

  // Finish
  const final_status: "complete" | "failed" =
    processed > 0 ? "complete" : "failed";
  const finished_at = new Date().toISOString();

  if (processed === 0) {
    const retry_count = (job.progress.retry_count || 0) + 1;
    const max_retries = 3;

    if (retry_count <= max_retries) {
      const next_retry_at = new Date(
        Date.now() + retry_count * 60 * 1000,
      ).toISOString(); // backoff 1min, 2min, 3min

      await updateJob(jobId, {
        status: "retry_pending",
        progress: {
          stage: "failed",
          message: "No units were processed",
          finished_at,
          phase_status: final_status,
          retry_phase: "phase1",
          retry_count,
          next_retry_at,
        },
      });
    } else {
      await updateJob(jobId, {
        status: "failed",
        progress: {
          stage: "failed",
          message: "No units were processed",
          finished_at,
          phase_status: final_status,
        },
      });
    }
  } else {
    // Phase 1 success: mark phase-level completion, keep job.status non-terminal so Phase 2 can start
    // Clear lease so Phase 2 can acquire immediately
    await updateJob(jobId, {
      progress: {
        stage: "complete",
        message: "Phase 1 complete",
        finished_at,
        phase: "phase1",
        phase_status: final_status,
        lease_id: null,
        lease_expires_at: null,
      },
    });
  }

  console.log("Phase1Completed", {
    job_id: jobId,
    processed,
    total_units: units.length,
    final_status,
  });
}

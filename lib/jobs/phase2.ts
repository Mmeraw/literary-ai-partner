export const PHASE_2_STATES = {
  NOT_STARTED: "not_started",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type Phase2State = (typeof PHASE_2_STATES)[keyof typeof PHASE_2_STATES];

const PHASE2_ALLOWED_TRANSITIONS: Record<Phase2State, Phase2State[]> = {
  not_started: ["running"],
  running: ["completed", "failed"],
  failed: ["running"],
  completed: [],
};

export function canTransitionPhase2(
  from: Phase2State,
  to: Phase2State,
): boolean {
  const allowed = PHASE2_ALLOWED_TRANSITIONS[from];
  return Array.isArray(allowed) ? allowed.includes(to) : false;
}

export function assertTransitionPhase2(
  from: Phase2State,
  to: Phase2State,
): void {
  if (!canTransitionPhase2(from, to)) {
    throw new Error(`Invalid Phase 2 transition: ${from} -> ${to}`);
  }
}

import { getJob, updateJob } from "./store";

export async function runPhase2(jobId: string): Promise<void> {
  let job = await getJob(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  // Acquire lease atomically with eligibility check
  const { acquireLeaseForPhase2 } = await import("./store");
  const lease_id = crypto.randomUUID();

  console.log(
    `[Phase2] Attempting to acquire lease for job ${jobId}, current state:`,
    {
      status: job.status,
      phase: job.progress.phase,
      phase_status: job.progress.phase_status,
      lease_id: job.progress.lease_id,
      lease_expires_at: job.progress.lease_expires_at,
    },
  );

  const leasedJob = await acquireLeaseForPhase2(jobId, lease_id, 30); // 30 seconds TTL
  if (!leasedJob) {
    console.log("Phase2LeaseNotAcquired", {
      job_id: jobId,
      phase: "phase2",
      reason: "not eligible or already running",
    });
    return;
  }

  console.log(
    `[Phase2] Successfully acquired lease ${lease_id} for job ${jobId}`,
  );

  // Use the leased snapshot as our base
  job = leasedJob;

  // Fake work: split manuscript into N units (mocked)
  const units = ["unitA", "unitB", "unitC"]; // Mocked units for Phase 2

  const existingIndex = job.progress.phase2_last_processed_index ?? -1;
  const startIndex = existingIndex + 1;
  const completedUnits = Math.max(startIndex, 0);
  const startedAt =
    job.progress.phase2_started_at ?? new Date().toISOString();

  // Initialize / resume Phase 2 counters and mark as running
  await updateJob(jobId, {
    progress: {
      stage: "starting",
      message: "Initializing phase 2",
      total_units: units.length,
      completed_units: completedUnits,
      started_at: startedAt,
      phase2_started_at: startedAt,
      phase: "phase2",
      phase_status: "running",
      phase2_last_processed_index: existingIndex,
    },
  });

  let processed = completedUnits;
  console.log(
    `[Phase2] Loop start_index=${startIndex} units_length=${units.length}`,
  );

  try {
    for (let i = startIndex; i < units.length; i++) {
      // Invariant checks
      const currentJob = await getJob(jobId);
      if (!currentJob) return;

      const progress = currentJob.progress;

      if (progress.phase !== "phase2" || progress.phase_status !== "running") {
        console.log(
          "Phase2 invariant failed: phase or phase_status mismatch",
        );
        return;
      }

      if (
        progress.lease_expires_at &&
        new Date(progress.lease_expires_at) <= new Date()
      ) {
        console.log("Phase2LeaseExpired", {
          job_id: jobId,
          phase: "phase2",
          lease_id,
          processed_units: processed,
        });
        return;
      }

      if (
        (progress.completed_units || 0) > (progress.total_units || 0)
      ) {
        console.log(
          "Phase2 invariant failed: completed_units > total_units",
        );
        return;
      }

      // Simulate lease loss after first unit (optional test hook)
      if (i === 0 && process.env.SIMULATE_LEASE_LOSS) {
        await updateJob(jobId, {
          progress: {
            lease_expires_at: new Date(Date.now() - 1000).toISOString(),
          },
        });
      }

      // Simulate processing time
      await new Promise<void>((resolve) =>
        setTimeout(resolve, 500),
      );

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
          phase_status: "running",
          phase2_last_processed_index: i,
          lease_expires_at: new_lease_expires_at,
        },
      });
    }
  } catch (e) {
    console.error("Phase2Error", {
      job_id: jobId,
      phase: "phase2",
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
      processed_before_error: processed,
      total_units: units.length,
      last_processed_index: startIndex + processed - 1,
    });
    processed = 0; // Mark as failed
  }

  // Finish - Phase 2 is terminal, so set status to complete or failed
  const final_status: "complete" | "failed" =
    processed > 0 ? "complete" : "failed";
  const finished_at = new Date().toISOString();

  // Invariant: if we had units and acquired lease, we must have processed something
  if (units.length > 0 && processed === 0) {
    console.error(
      `[Phase2] INVARIANT VIOLATION: units_length=${units.length} but processed=0`,
    );
  } else if (units.length === 0) {
    console.log(
      `[Phase2] No-op: units_length=0 (expected, no work to do)`,
    );
  }

  console.log(
    `[Phase2] Completed: processed=${processed}/${units.length} final_status=${final_status}`,
  );

  if (processed === 0) {
    // Failed: running -> failed is valid
    await updateJob(jobId, {
      status: "failed",
      progress: {
        stage: "failed",
        message: "No units were processed in Phase 2",
        finished_at,
        phase_status: final_status,
        lease_id: null,
        lease_expires_at: null,
      },
    });
  } else {
    // Success: running -> complete is valid
    await updateJob(jobId, {
      status: "complete",
      progress: {
        stage: "complete",
        message: "Phase 2 complete",
        finished_at,
        phase_status: final_status,
        lease_id: null,
        lease_expires_at: null,
      },
    });
  }

  console.log("Phase2Completed", {
    job_id: jobId,
    processed,
    total_units: units.length,
    final_status,
  });
}

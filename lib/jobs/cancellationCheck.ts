import { getJob } from './store';

/**
 * Cooperative cancellation check for workers.
 *
 * Call this at safe points before starting expensive work (API calls, computation):
 * - Before Pass 1
 * - Before Pass 2
 * - Before Pass 3
 * - Before Pass 4
 * - Before Narrative Synthesis
 *
 * If job is already cancelled, returns early without throwing.
 * Allows graceful exit from worker without orphaning resources.
 *
 * @throws Will NOT throw; returns cancellation status
 * @returns { cancelled: boolean; reason?: string; cancelled_at?: string }
 */
export async function checkJobCancellation(jobId: string): Promise<{
  cancelled: boolean;
  reason?: string;
  cancelled_at?: string;
}> {
  try {
    const job = await getJob(jobId);
    if (!job) {
      return { cancelled: false };
    }

    // Cancelled jobs have status='failed' with cancel metadata in progress
    const isCancelled = job.status === 'failed';
    const progress = (job.progress as Record<string, unknown>) || {};
    const cancelled_at = progress.canceled_at as string | undefined;
    const cancelled_reason = progress.canceled_reason as string | undefined;

    if (isCancelled && cancelled_at) {
      return {
        cancelled: true,
        reason: cancelled_reason || 'Job was cancelled',
        cancelled_at,
      };
    }

    return { cancelled: false };
  } catch (err) {
    console.error('Error checking job cancellation:', err);
    return { cancelled: false };
  }
}

/**
 * Assert job is not cancelled. Intended for use with early return pattern.
 *
 * Usage in workers:
 *   const cancellation = await assertJobNotCancelled(jobId, 'before_pass_1');
 *   if (cancellation.cancelled) {
 *     console.log(`Job cancelled at ${cancellation.checkpoint}: ${cancellation.reason}`);
 *     return { success: false, error: cancellation.reason, retryable: false };
 *   }
 */
export async function assertJobNotCancelled(
  jobId: string,
  checkpoint: string
): Promise<{
  cancelled: boolean;
  checkpoint?: string;
  reason?: string;
  cancelled_at?: string;
}> {
  const check = await checkJobCancellation(jobId);

  if (check.cancelled) {
    console.warn(`[CancellationCheck] ${checkpoint}: Job ${jobId} is cancelled`, {
      checkpoint,
      reason: check.reason,
      cancelled_at: check.cancelled_at,
    });
  }

  return {
    ...check,
    checkpoint: check.cancelled ? checkpoint : undefined,
  };
}

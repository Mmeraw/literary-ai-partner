/**
 * Contract schema for claim_evaluation_jobs RPC return shape.
 *
 * Purpose: make RPC contract drift fail loudly at the processor boundary
 * instead of silently corrupting job state or producing misleading errors.
 *
 * The uuid/text type mismatch and return-shape drift incidents in Apr 2026
 * showed that blind type-casting the RPC result is a reliability hazard.
 * This module provides runtime validation so any future drift is caught
 * immediately with a clear, actionable error message.
 */
import { z } from 'zod';

/**
 * Canonical shape expected from claim_evaluation_jobs RPC.
 * Maps to SETOF public.evaluation_jobs (the fields we actually consume).
 */
export const ClaimedJobRowSchema = z.object({
  id: z.string().uuid({ message: 'claimed job id must be a UUID' }),
  phase: z.string({ required_error: 'claimed job must include phase' }),
  status: z.string({ required_error: 'claimed job must include status' }),
  phase_status: z.string().nullable().optional(),
  claimed_by: z.string().nullable().optional(),
  claimed_at: z.string().datetime().nullable().optional(),
  lease_token: z
    .string()
    .uuid({ message: 'lease_token must be a UUID — check RPC arg type (text vs uuid)' })
    .nullable()
    .optional(),
  lease_expires_at: z.string().datetime().nullable().optional(),
  manuscript_id: z
    .union([z.number(), z.string().transform((v) => Number(v))])
    .optional(),
});

export const ClaimedJobsArraySchema = z.array(ClaimedJobRowSchema);

export type ClaimedJobRow = z.infer<typeof ClaimedJobRowSchema>;

/**
 * Assert that RPC output matches the expected contract.
 * Throws a descriptive error on mismatch — never silently accepts unknown shapes.
 *
 * @param raw - raw data returned by supabase.rpc('claim_evaluation_jobs', ...)
 * @returns typed array of claimed job rows
 */
export function assertClaimedJobsContract(raw: unknown): ClaimedJobRow[] {
  const result = ClaimedJobsArraySchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `[${issue.path.join('.')}] ${issue.message}`)
      .join('; ');
    throw new Error(
      `[claim_evaluation_jobs] RPC return shape contract violation: ${issues}`,
    );
  }

  // Invariant checks on each claimed row
  for (const job of result.data) {
    if (job.status !== 'running') {
      throw new Error(
        `[claim_evaluation_jobs] contract violation: job ${job.id} returned with status=${job.status} (expected running)`,
      );
    }
    if (!job.claimed_by) {
      throw new Error(
        `[claim_evaluation_jobs] contract violation: job ${job.id} missing claimed_by`,
      );
    }
    if (job.lease_token === null || job.lease_token === undefined) {
      throw new Error(
        `[claim_evaluation_jobs] contract violation: job ${job.id} missing lease_token`,
      );
    }
  }

  return result.data;
}

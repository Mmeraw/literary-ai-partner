import { z } from 'zod';

const ClaimedJobPhaseSchema = z.enum(['phase_1a', 'phase_2', 'phase_3'], {
  required_error: 'claimed job must include phase',
  invalid_type_error: 'claimed job phase must be one of: phase_1a, phase_2, phase_3',
});

const ClaimedJobStatusSchema = z.literal('running', {
  invalid_type_error: 'claimed job status must be running',
  required_error: 'claimed job must include status',
});

const ClaimedJobManuscriptIdSchema = z.preprocess((value) => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
    return Number(value);
  }

  return value;
}, z.number().int().finite({ message: 'manuscript_id must be a finite integer' }));

/**
 * Canonical shape expected from claim_evaluation_jobs RPC.
 * Maps to SETOF public.evaluation_jobs (the fields we actually consume).
 *
 * Fail-closed by design on required invariants while permitting additional
 * canonical columns returned by SETOF public.evaluation_jobs.
 */
export const ClaimedJobRowSchema = z
  .object({
    id: z.string().uuid({ message: 'claimed job id must be a UUID' }),
    phase: ClaimedJobPhaseSchema,
    status: ClaimedJobStatusSchema,
    phase_status: z.string().nullable().optional(),
    claimed_by: z.string().nullable().optional(),
      // Postgres timestamptz can be returned as RFC3339 with numeric offset
      // (e.g. 2026-04-23T20:09:41.554452+00:00) instead of trailing Z.
      claimed_at: z.string().datetime({ offset: true }).nullable().optional(),
    lease_token: z
      .string()
      .uuid({ message: 'lease_token must be a UUID — check RPC arg type (text vs uuid)' })
      .nullable()
      .optional(),
      lease_expires_at: z.string().datetime({ offset: true }).nullable().optional(),
    manuscript_id: ClaimedJobManuscriptIdSchema.optional(),
  })
  .passthrough();

export const ClaimedJobsArraySchema = z.array(ClaimedJobRowSchema);

export type ClaimedJobRow = z.infer<typeof ClaimedJobRowSchema>;

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

  for (const job of result.data) {
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

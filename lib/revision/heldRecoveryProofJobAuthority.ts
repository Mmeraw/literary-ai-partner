import type { SupabaseClient } from '@supabase/supabase-js'

export type HeldRecoveryProofJobContext = {
  readonly jobId: string
  readonly manuscriptId: string
  readonly userId: string
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * Loads the durable, exact-job proof authority. A generated job id in an
 * environment variable is necessary but not sufficient: the persisted job
 * must also be complete and carry the proof-only marker created before
 * dispatch. Manuscript and user identities stay as database-returned text.
 */
export async function loadHeldRecoveryProofJobContext(
  supabase: Pick<SupabaseClient, 'rpc'>,
  jobId: string,
): Promise<HeldRecoveryProofJobContext | null> {
  const normalizedJobId = nonEmpty(jobId)
  if (!normalizedJobId) return null
  const { data, error } = await supabase.rpc('get_held_recovery_proof_job_context', {
    p_job_id: normalizedJobId,
  })
  if (error) throw new Error(`Held Recovery proof job context failed: ${error.message}`)
  const row = recordOf(data)
  if (!row || row.status !== 'loaded') return null
  if (
    row.job_status !== 'complete' ||
    row.phase_status !== 'complete' ||
    row.proof_target !== true
  ) return null
  const loadedJobId = nonEmpty(row.job_id)
  const manuscriptId = nonEmpty(row.manuscript_id)
  const userId = nonEmpty(row.user_id)
  if (loadedJobId !== normalizedJobId || !manuscriptId || !userId) return null
  return { jobId: normalizedJobId, manuscriptId, userId }
}

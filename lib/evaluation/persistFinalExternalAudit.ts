import { ARTIFACT_TYPES, writeArtifact } from '@/lib/artifacts/writeArtifact'
import type { FinalExternalAuditArtifact } from '@/lib/evaluation/finalExternalAudit'

export type PersistFinalExternalAuditInput = {
  jobId: string
  manuscriptId: number
  audit: FinalExternalAuditArtifact
  sourceHash?: string | null
}

export async function persistFinalExternalAuditArtifact(
  input: PersistFinalExternalAuditInput,
): Promise<string | null> {
  if (input.audit.artifact_type !== 'final_external_audit_v1') {
    throw new Error('Cannot persist non-final_external_audit_v1 artifact as Phase 4B audit')
  }

  if (input.audit.job_id !== input.jobId) {
    throw new Error(`Final external audit job_id mismatch: expected ${input.jobId}, got ${input.audit.job_id}`)
  }

  return writeArtifact({
    job_id: input.jobId,
    manuscript_id: input.manuscriptId,
    artifact_type: ARTIFACT_TYPES.FINAL_EXTERNAL_AUDIT,
    artifact_version: 'v1',
    content: input.audit,
    source_phase: 'phase_4b_final_external_audit',
    source_hash: input.sourceHash ?? null,
  })
}

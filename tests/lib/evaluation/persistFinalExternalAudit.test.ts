import type { FinalExternalAuditArtifact } from '@/lib/evaluation/finalExternalAudit'
import { persistFinalExternalAuditArtifact } from '@/lib/evaluation/persistFinalExternalAudit'
import { writeArtifact } from '@/lib/artifacts/writeArtifact'

jest.mock('@/lib/artifacts/writeArtifact', () => ({
  ARTIFACT_TYPES: {
    FINAL_EXTERNAL_AUDIT: 'final_external_audit_v1',
  },
  writeArtifact: jest.fn(async () => 'artifact-123'),
}))

const audit: FinalExternalAuditArtifact = {
  artifact_type: 'final_external_audit_v1',
  schema_version: 1,
  job_id: 'job-1',
  manuscript_id: 99,
  manuscript_version_id: 'mv-1',
  input_artifacts: ['evaluation_result_v2'],
  authority_basis: {
    registry_path: 'docs/phase-0-warmup/PHASE_0_AUTHORITY_REGISTRY.md',
    runtime_benchmark_authority_map_path: 'docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md',
    template_path: 'docs/templates/evaluation/long-form-multi-layer-evaluation-template.md',
    checksums: {},
  },
  status: 'pass',
  blocking_reason_codes: [],
  warning_reason_codes: [],
  checks: [],
  summary: 'passed',
  created_at: '2026-06-24T00:00:00.000Z',
  is_resume_safe: true,
}

describe('persistFinalExternalAuditArtifact', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('persists final_external_audit_v1 through the authoritative artifact writer', async () => {
    const id = await persistFinalExternalAuditArtifact({
      jobId: 'job-1',
      manuscriptId: 99,
      audit,
      sourceHash: 'hash-1',
    })

    expect(id).toBe('artifact-123')
    expect(writeArtifact).toHaveBeenCalledWith({
      job_id: 'job-1',
      manuscript_id: 99,
      artifact_type: 'final_external_audit_v1',
      artifact_version: 'v1',
      content: audit,
      source_phase: 'phase_4b_final_external_audit',
      source_hash: 'hash-1',
    })
  })

  test('fails closed when audit job_id does not match persistence jobId', async () => {
    await expect(
      persistFinalExternalAuditArtifact({
        jobId: 'job-2',
        manuscriptId: 99,
        audit,
      }),
    ).rejects.toThrow('Final external audit job_id mismatch')

    expect(writeArtifact).not.toHaveBeenCalled()
  })

  test('fails closed when artifact_type is not final_external_audit_v1', async () => {
    await expect(
      persistFinalExternalAuditArtifact({
        jobId: 'job-1',
        manuscriptId: 99,
        audit: {
          ...audit,
          artifact_type: 'wrong_type' as 'final_external_audit_v1',
        },
      }),
    ).rejects.toThrow('Cannot persist non-final_external_audit_v1 artifact')

    expect(writeArtifact).not.toHaveBeenCalled()
  })
})

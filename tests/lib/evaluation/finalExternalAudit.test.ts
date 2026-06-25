import {
  buildFinalExternalAuditArtifact,
  finalExternalAuditAllowsAuthorExposure,
} from '@/lib/evaluation/finalExternalAudit'

const passingInput = {
  jobId: 'job-1',
  manuscriptId: 123,
  manuscriptVersionId: 'mv-1',
  now: '2026-06-24T00:00:00.000Z',
  inputArtifacts: ['evaluation_result_v2', 'longform_document_v1'],
  authorityChecksums: {
    'docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md': 'abc123',
  },
  phase0AuthorityProofStatus: 'valid' as const,
  runtimeBenchmarkMapLoaded: true,
  outputMode: 'multi_layer_long_form',
  evaluationMode: 'long_form_multi_layer_evaluation',
  dreamDocumentPresent: true,
  longFormTemplateComplete: true,
  criteriaCount: 13,
  evidenceAnchorsPresent: true,
  acceptedStoryLedgerPresent: true,
  recommendationLedgerPresent: true,
  recommendationsSpecific: true,
  uedPresent: true,
  viewModelPresent: true,
  rendererParityStatus: 'pass' as const,
  waveStatus: 'pass' as const,
  authorExposureCertificationStatus: 'certified' as const,
}

describe('Phase 4B final external audit', () => {
  test('passes when all required audit families are clean', () => {
    const artifact = buildFinalExternalAuditArtifact(passingInput)

    expect(artifact.artifact_type).toBe('final_external_audit_v1')
    expect(artifact.status).toBe('pass')
    expect(artifact.blocking_reason_codes).toEqual([])
    expect(artifact.warning_reason_codes).toEqual([])
    expect(artifact.is_resume_safe).toBe(true)
    expect(finalExternalAuditAllowsAuthorExposure(artifact)).toBe(true)
  })

  test('warns when benchmark map or accepted Story Ledger is missing but core release evidence is intact', () => {
    const artifact = buildFinalExternalAuditArtifact({
      ...passingInput,
      runtimeBenchmarkMapLoaded: false,
      acceptedStoryLedgerPresent: false,
    })

    expect(artifact.status).toBe('warn')
    expect(artifact.blocking_reason_codes).toEqual([])
    expect(artifact.warning_reason_codes).toEqual([
      'RUNTIME_BENCHMARK_MAP_MISSING',
      'STORY_LEDGER_AUTHORITY_MISSING',
    ])
    expect(artifact.is_resume_safe).toBe(true)
    expect(finalExternalAuditAllowsAuthorExposure(artifact)).toBe(true)
  })

  test('blocks legacy long-form mode because multi-layer is now canonical', () => {
    const artifact = buildFinalExternalAuditArtifact({
      ...passingInput,
      outputMode: 'long_form',
      evaluationMode: 'long_form_evaluation',
    })

    expect(artifact.status).toBe('block')
    expect(artifact.blocking_reason_codes).toContain('LEGACY_LONG_FORM_MODE_OR_UNKNOWN')
    expect(artifact.is_resume_safe).toBe(false)
    expect(finalExternalAuditAllowsAuthorExposure(artifact)).toBe(false)
  })

  test('blocks when recommendation ledger is generic or missing', () => {
    const artifact = buildFinalExternalAuditArtifact({
      ...passingInput,
      recommendationsSpecific: false,
    })

    expect(artifact.status).toBe('block')
    expect(artifact.blocking_reason_codes).toContain('RECOMMENDATION_LEDGER_MISSING_OR_GENERIC')
  })

  test('blocks when UED or ViewModel is missing before author exposure', () => {
    const artifact = buildFinalExternalAuditArtifact({
      ...passingInput,
      uedPresent: false,
    })

    expect(artifact.status).toBe('block')
    expect(artifact.blocking_reason_codes).toContain('UED_OR_VIEWMODEL_MISSING')
  })

  test('fails closed for malformed audit exposure checks', () => {
    expect(finalExternalAuditAllowsAuthorExposure(null)).toBe(false)
    expect(finalExternalAuditAllowsAuthorExposure({ status: 'pass' })).toBe(false)
    expect(finalExternalAuditAllowsAuthorExposure({ artifact_type: 'final_external_audit_v1', status: 'block' })).toBe(false)
  })
})

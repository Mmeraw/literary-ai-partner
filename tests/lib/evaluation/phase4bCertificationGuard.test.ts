import { evaluateAuthorExposureCertification } from '@/lib/evaluation/authorExposureCertification'

describe('Phase 4B certification guard', () => {
  const base = {
    decision: 'certified',
    blocking_reasons: [],
    parity_results: { status: 'pass' },
    // Required since commit 9f95890936 (governance(dcip)): dcipCompliancePasses()
    // gates evaluateAuthorExposureCertification before it reaches the Phase 4B
    // audit check. Without this field the function short-circuits with
    // parity_check_failed and all Phase 4B assertions become unreachable.
    dcip_compliance: { status: 'pass', reasons: [] },
  }

  test('accepts pass audit', () => {
    const result = evaluateAuthorExposureCertification({
      ...base,
      final_external_audit: { artifact_type: 'final_external_audit_v1', status: 'pass' },
    })
    expect(result.exposable).toBe(true)
  })

  test('accepts warn audit', () => {
    const result = evaluateAuthorExposureCertification({
      ...base,
      final_external_audit: { artifact_type: 'final_external_audit_v1', status: 'warn' },
    })
    expect(result.exposable).toBe(true)
  })

  test('rejects block audit', () => {
    const result = evaluateAuthorExposureCertification({
      ...base,
      final_external_audit: { artifact_type: 'final_external_audit_v1', status: 'block' },
    })
    expect(result).toMatchObject({ exposable: false, reason: 'final_external_audit_failed' })
  })

  test('rejects malformed audit', () => {
    const result = evaluateAuthorExposureCertification({
      ...base,
      final_external_audit: { status: 'pass' }, // missing artifact_type — malformed
    })
    expect(result).toMatchObject({ exposable: false, reason: 'final_external_audit_failed' })
  })

  test('accepts legacy certification without audit field', () => {
    // final_external_audit is absent (null check in evaluateAuthorExposureCertification:
    // "if (certification.final_external_audit != null && ...)"). Legacy payloads
    // that predate Phase 4B are still valid as long as dcip_compliance is clean.
    const result = evaluateAuthorExposureCertification(base)
    expect(result.exposable).toBe(true)
  })
})

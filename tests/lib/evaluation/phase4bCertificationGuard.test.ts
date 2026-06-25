import { evaluateAuthorExposureCertification } from '@/lib/evaluation/authorExposureCertification'

describe('Phase 4B certification guard', () => {
  const base = {
    decision: 'certified',
    blocking_reasons: [],
    parity_results: { status: 'pass' },
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
      final_external_audit: { status: 'pass' },
    })
    expect(result).toMatchObject({ exposable: false, reason: 'final_external_audit_failed' })
  })

  test('accepts legacy certification without audit field', () => {
    const result = evaluateAuthorExposureCertification(base)
    expect(result.exposable).toBe(true)
  })
})

import { evaluateAuthorExposureCertificationWithFinalExternalAudit } from '@/lib/evaluation/authorExposureCertification'

const certifiedPayload = {
  decision: 'certified',
  certified_at: '2026-02-22T00:00:00.000Z',
  blocking_reasons: [],
  parity_results: { status: 'pass' },
}

describe('evaluateAuthorExposureCertificationWithFinalExternalAudit', () => {
  test('allows exposure when certification is clean and separate Phase 4B audit passes', () => {
    const decision = evaluateAuthorExposureCertificationWithFinalExternalAudit(certifiedPayload, {
      artifact_type: 'final_external_audit_v1',
      status: 'pass',
    })

    expect(decision).toMatchObject({
      exposable: true,
      certifiedAt: '2026-02-22T00:00:00.000Z',
    })
  })

  test('allows exposure when certification is clean and separate Phase 4B audit warns', () => {
    const decision = evaluateAuthorExposureCertificationWithFinalExternalAudit(certifiedPayload, {
      artifact_type: 'final_external_audit_v1',
      status: 'warn',
    })

    expect(decision.exposable).toBe(true)
  })

  test('blocks exposure when separate Phase 4B audit blocks', () => {
    const decision = evaluateAuthorExposureCertificationWithFinalExternalAudit(certifiedPayload, {
      artifact_type: 'final_external_audit_v1',
      status: 'block',
    })

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'final_external_audit_failed',
    })
  })

  test('blocks exposure when separate Phase 4B audit is missing', () => {
    const decision = evaluateAuthorExposureCertificationWithFinalExternalAudit(certifiedPayload, null)

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'final_external_audit_failed',
    })
  })

  test('preserves base certification failure before checking Phase 4B audit', () => {
    const decision = evaluateAuthorExposureCertificationWithFinalExternalAudit(
      {
        ...certifiedPayload,
        blocking_reasons: ['renderer mismatch'],
      },
      {
        artifact_type: 'final_external_audit_v1',
        status: 'pass',
      },
    )

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'blocking_reasons_present',
    })
  })
})

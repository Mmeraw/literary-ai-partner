import { finalExternalAuditAllowsPhase5Exposure } from '@/lib/evaluation/finalExternalAuditExposureGuard'

describe('finalExternalAuditAllowsPhase5Exposure', () => {
  test('accepts artifact status pass and warn', () => {
    expect(finalExternalAuditAllowsPhase5Exposure({ artifact_type: 'final_external_audit_v1', status: 'pass' })).toBe(true)
    expect(finalExternalAuditAllowsPhase5Exposure({ artifact_type: 'final_external_audit_v1', status: 'warn' })).toBe(true)
  })

  test('rejects artifact status block', () => {
    expect(finalExternalAuditAllowsPhase5Exposure({ artifact_type: 'final_external_audit_v1', status: 'block' })).toBe(false)
  })

  test('accepts pipeline verdict PASS WARN and SKIP', () => {
    expect(finalExternalAuditAllowsPhase5Exposure({ schema_version: 'final_external_audit_v1', verdict: 'PASS' })).toBe(true)
    expect(finalExternalAuditAllowsPhase5Exposure({ schema_version: 'final_external_audit_v1', verdict: 'WARN' })).toBe(true)
    expect(finalExternalAuditAllowsPhase5Exposure({ schema_version: 'final_external_audit_v1', verdict: 'SKIP' })).toBe(true)
  })

  test('rejects pipeline verdict BLOCK', () => {
    expect(finalExternalAuditAllowsPhase5Exposure({ schema_version: 'final_external_audit_v1', verdict: 'BLOCK' })).toBe(false)
  })

  test('fails closed for malformed values', () => {
    expect(finalExternalAuditAllowsPhase5Exposure(null)).toBe(false)
    expect(finalExternalAuditAllowsPhase5Exposure({ status: 'pass' })).toBe(false)
    expect(finalExternalAuditAllowsPhase5Exposure({ schema_version: 'wrong', verdict: 'PASS' })).toBe(false)
  })
})

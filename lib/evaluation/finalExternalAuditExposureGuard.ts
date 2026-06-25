export function finalExternalAuditAllowsPhase5Exposure(audit: unknown): boolean {
  if (!audit || typeof audit !== 'object' || Array.isArray(audit)) return false
  const record = audit as Record<string, unknown>

  const artifactType = typeof record.artifact_type === 'string' ? record.artifact_type : ''
  const schemaVersion = typeof record.schema_version === 'string' ? record.schema_version : ''
  const lowerStatus = typeof record.status === 'string' ? record.status.trim().toLowerCase() : ''
  const upperVerdict = typeof record.verdict === 'string' ? record.verdict.trim().toUpperCase() : ''

  if (artifactType === 'final_external_audit_v1') {
    return lowerStatus === 'pass' || lowerStatus === 'warn'
  }

  if (schemaVersion === 'final_external_audit_v1') {
    return upperVerdict === 'PASS' || upperVerdict === 'WARN' || upperVerdict === 'SKIP'
  }

  return false
}

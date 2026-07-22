export type Gate15AuthorExposureBlockReason =
  | 'missing_gate_15_audit'
  | 'invalid_gate_15_audit_payload'
  | 'gate_15_audit_failed'
  | 'gate_15_audit_stale'
  | 'gate_15_lineage_mismatch';

export type Gate15AuthorExposureDecision =
  | { exposable: true; status: 'pass' | 'warn' | 'skipped' }
  | { exposable: false; reason: Gate15AuthorExposureBlockReason; details: string };

type Gate15Status = 'pass' | 'warn' | 'fail' | 'skipped';

type Gate15AuditShape = {
  version?: unknown;
  schema_version?: unknown;
  artifact_type?: unknown;
  jobId?: unknown;
  job_id?: unknown;
  manuscriptId?: unknown;
  manuscript_id?: unknown;
  timestamp?: unknown;
  generated_at?: unknown;
  overallStatus?: unknown;
  overall_status?: unknown;
  status?: unknown;
  lineage_status?: unknown;
  stale?: unknown;
  superseded?: unknown;
  valid_until?: unknown;
  lineage?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeStatus(value: unknown): Gate15Status | null {
  const normalized = nonEmptyString(value)?.toLowerCase();
  if (normalized === 'pass' || normalized === 'warn' || normalized === 'fail' || normalized === 'skipped') {
    return normalized;
  }
  return null;
}

function getAuditVersion(audit: Gate15AuditShape): string | null {
  return nonEmptyString(audit.version) ?? nonEmptyString(audit.schema_version) ?? nonEmptyString(audit.artifact_type);
}

function getAuditJobId(audit: Gate15AuditShape): string | null {
  return nonEmptyString(audit.jobId) ?? nonEmptyString(audit.job_id);
}

function getAuditTimestamp(audit: Gate15AuditShape): string | null {
  return nonEmptyString(audit.timestamp) ?? nonEmptyString(audit.generated_at);
}

function isParseableDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function isAuditStale(audit: Gate15AuditShape, now: Date): boolean {
  if (audit.stale === true || audit.superseded === true) return true;

  const lineageStatus = nonEmptyString(audit.lineage_status)?.toLowerCase();
  if (lineageStatus !== 'current') return true;

  const validUntil = nonEmptyString(audit.valid_until);
  if (!validUntil) return true;
  const expiresAt = Date.parse(validUntil);
  if (!Number.isFinite(expiresAt)) return true;
  if (expiresAt < now.getTime()) return true;

  return false;
}

function hasVerifiableLineage(audit: Gate15AuditShape, jobId: string, timestamp: string): boolean {
  const lineage = asRecord(audit.lineage);
  if (!lineage) return false;
  if (nonEmptyString(lineage.artifact_type) !== 'gate_15_audit_v1') return false;
  const lineageJobId = nonEmptyString(lineage.jobId) ?? nonEmptyString(lineage.job_id);
  if (lineageJobId !== jobId) return false;
  return nonEmptyString(lineage.timestamp) === timestamp;
}

export function evaluateGate15AuthorExposure(
  gate15AuditContent: unknown,
  options: {
    jobId: string;
    now?: Date;
  },
): Gate15AuthorExposureDecision {
  const record = asRecord(gate15AuditContent) as Gate15AuditShape | null;
  if (!record) {
    return {
      exposable: false,
      reason: gate15AuditContent == null ? 'missing_gate_15_audit' : 'invalid_gate_15_audit_payload',
      details: gate15AuditContent == null ? 'gate_15_audit_v1 artifact missing' : 'gate_15_audit_v1 payload is not an object',
    };
  }

  if (getAuditVersion(record) !== 'gate_15_audit_v1') {
    return {
      exposable: false,
      reason: 'invalid_gate_15_audit_payload',
      details: 'gate_15_audit_v1 version marker is missing or invalid',
    };
  }

  const auditJobId = getAuditJobId(record);
  if (!auditJobId || auditJobId !== options.jobId) {
    return {
      exposable: false,
      reason: 'gate_15_lineage_mismatch',
      details: `gate_15_audit_v1 job lineage mismatch: expected=${options.jobId} actual=${auditJobId ?? 'missing'}`,
    };
  }

  const timestamp = getAuditTimestamp(record);
  if (!timestamp || !isParseableDate(timestamp)) {
    return {
      exposable: false,
      reason: 'invalid_gate_15_audit_payload',
      details: 'gate_15_audit_v1 timestamp is missing or invalid',
    };
  }

  if (!hasVerifiableLineage(record, auditJobId, timestamp)) {
    return {
      exposable: false,
      reason: 'gate_15_lineage_mismatch',
      details: 'gate_15_audit_v1 lineage proof is missing or does not match the audit identity',
    };
  }

  const status = normalizeStatus(record.overallStatus ?? record.overall_status ?? record.status);
  if (!status) {
    return {
      exposable: false,
      reason: 'invalid_gate_15_audit_payload',
      details: 'gate_15_audit_v1 status is missing or invalid',
    };
  }

  if (isAuditStale(record, options.now ?? new Date())) {
    return {
      exposable: false,
      reason: 'gate_15_audit_stale',
      details: 'gate_15_audit_v1 is stale, superseded, expired, or not current',
    };
  }

  if (status === 'pass' || status === 'warn' || status === 'skipped') {
    return { exposable: true, status };
  }

  return {
    exposable: false,
    reason: 'gate_15_audit_failed',
    details: 'gate_15_audit_v1 failed; disposition recovery is disabled until an authorized non-forgeable writer is proven',
  };
}
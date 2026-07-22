import type { createClient } from '@supabase/supabase-js';
import { finalExternalAuditAllowsAuthorExposure } from '@/lib/evaluation/finalExternalAudit';
import { evaluateGate15AuthorExposure } from '@/lib/evaluation/gate15/authorExposureGate15';

export type AuthorExposureBlockReason =
  | 'missing_certification'
  | 'invalid_certification_payload'
  | 'decision_not_certified'
  | 'blocking_reasons_present'
  | 'parity_check_failed'
  | 'final_external_audit_failed'
  | 'gate_15_audit_failed'
  | 'db_error';

export type AuthorExposureDecision =
  | {
      exposable: true;
      certifiedAt: string | null;
    }
  | {
      exposable: false;
      reason: AuthorExposureBlockReason;
      details?: string;
    };

const PUBLIC_GATE_15_AUTHOR_EXPOSURE_BLOCK = 'author_exposure:release_safeguard_not_cleared';

type CertificationShape = {
  decision?: unknown;
  certified_at?: unknown;
  blocking_reasons?: unknown;
  parity_results?: unknown;
  dcip_compliance?: unknown;
  final_external_audit?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asCertificationShape(content: unknown): CertificationShape | null {
  const direct = asRecord(content);
  if (!direct) return null;

  const nested = asRecord(direct.author_exposure_certification);
  if (nested) return nested;

  return direct;
}

function blockingReasonsAreClean(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return !value.some((entry) => {
    if (typeof entry === 'string') return entry.trim().length > 0;
    if (entry && typeof entry === 'object') return Object.keys(entry as Record<string, unknown>).length > 0;
    return Boolean(entry);
  });
}

function parityHasFailure(value: unknown): boolean {
  if (value == null) return true;

  if (typeof value === 'boolean') return value === false;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'fail' || normalized === 'failed' || normalized === 'block' || normalized === 'blocked';
  }

  if (Array.isArray(value)) return value.some((entry) => parityHasFailure(entry));

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const status = typeof record.status === 'string' ? record.status.trim().toLowerCase() : null;
    if (status && (status === 'fail' || status === 'failed' || status === 'block' || status === 'blocked')) return true;

    const verdict = typeof record.verdict === 'string' ? record.verdict.trim().toLowerCase() : null;
    if (verdict && (verdict === 'fail' || verdict === 'failed' || verdict === 'block' || verdict === 'blocked')) return true;

    return Object.values(record).some((entry) => parityHasFailure(entry));
  }

  return false;
}

function blockForFinalExternalAudit(): AuthorExposureDecision {
  return {
    exposable: false,
    reason: 'final_external_audit_failed',
    details: 'final_external_audit_v1 is missing, malformed, or blocking',
  };
}

function blockForGate15Audit(details: string): AuthorExposureDecision {
  return {
    exposable: false,
    reason: 'gate_15_audit_failed',
    details,
  };
}

export function publicAuthorExposureBlockDetail(decision: AuthorExposureDecision): string {
  if (decision.exposable === true) return 'author_exposure:exposable';
  if (decision.reason === 'gate_15_audit_failed') return PUBLIC_GATE_15_AUTHOR_EXPOSURE_BLOCK;
  return `author_exposure:${decision.reason}`;
}

function dcipCompliancePasses(value: unknown): boolean {
  const record = asRecord(value);
  if (!record) return false;
  const status = typeof record.status === 'string' ? record.status.trim().toLowerCase() : null;
  if (status !== 'pass') return false;
  const reasons = record.reasons;
  if (!Array.isArray(reasons)) return false;
  return reasons.length === 0;
}

export function evaluateAuthorExposureCertification(content: unknown): AuthorExposureDecision {
  const certification = asCertificationShape(content);
  if (!certification) {
    return {
      exposable: false,
      reason: 'invalid_certification_payload',
      details: 'author_exposure_certification_v1 payload is not an object',
    };
  }

  const decision = typeof certification.decision === 'string' ? certification.decision.trim().toLowerCase() : null;
  if (decision !== 'certified') {
    return {
      exposable: false,
      reason: 'decision_not_certified',
      details: `decision=${decision ?? 'missing'}`,
    };
  }

  if (!blockingReasonsAreClean(certification.blocking_reasons)) {
    return {
      exposable: false,
      reason: 'blocking_reasons_present',
      details: Array.isArray(certification.blocking_reasons)
        ? 'blocking_reasons is non-empty'
        : `blocking_reasons must be an array, got: ${typeof certification.blocking_reasons}`,
    };
  }

  if (parityHasFailure(certification.parity_results)) {
    return {
      exposable: false,
      reason: 'parity_check_failed',
      details: 'parity_results contains blocking/failure signal',
    };
  }

  if (!dcipCompliancePasses(certification.dcip_compliance)) {
    return {
      exposable: false,
      reason: 'parity_check_failed',
      details: 'dcip_compliance missing, malformed, or failing',
    };
  }

  if (certification.final_external_audit != null && !finalExternalAuditAllowsAuthorExposure(certification.final_external_audit)) {
    return blockForFinalExternalAudit();
  }

  const certifiedAt = typeof certification.certified_at === 'string' ? certification.certified_at : null;
  return { exposable: true, certifiedAt };
}

export function evaluateAuthorExposureCertificationWithFinalExternalAudit(
  certificationContent: unknown,
  finalExternalAuditContent: unknown,
): AuthorExposureDecision {
  const baseDecision = evaluateAuthorExposureCertification(certificationContent);
  if (!baseDecision.exposable) return baseDecision;

  if (!finalExternalAuditAllowsAuthorExposure(finalExternalAuditContent)) return blockForFinalExternalAudit();

  return baseDecision;
}

export function evaluateAuthorExposureCertificationWithFinalExternalAuditAndGate15(
  certificationContent: unknown,
  finalExternalAuditContent: unknown,
  gate15AuditContent: unknown,
  options: {
    jobId: string;
    now?: Date;
  },
): AuthorExposureDecision {
  const baseDecision = evaluateAuthorExposureCertificationWithFinalExternalAudit(
    certificationContent,
    finalExternalAuditContent,
  );
  if (!baseDecision.exposable) return baseDecision;

  const gate15Decision = evaluateGate15AuthorExposure(gate15AuditContent, {
    jobId: options.jobId,
    now: options.now,
  });
  if (gate15Decision.exposable === false) return blockForGate15Audit(gate15Decision.details);

  return baseDecision;
}

type AdminClient = ReturnType<typeof createClient>;

async function readLatestArtifactContent(
  admin: Pick<AdminClient, 'from'>,
  jobId: string,
  artifactType: string,
): Promise<{ content: unknown | null; errorMessage: string | null }> {
  const { data, error } = await admin
    .from('evaluation_artifacts')
    .select('content')
    .eq('job_id', jobId)
    .eq('artifact_type', artifactType)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { content: null, errorMessage: error.message };
  if (data == null) return { content: null, errorMessage: null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { content: (data as any).content as unknown, errorMessage: null };
}

export async function getAuthorExposureDecision(
  admin: Pick<AdminClient, 'from'>,
  jobId: string,
): Promise<AuthorExposureDecision> {
  // This is the public-surface entry point.  An exposure decision is only
  // authoritative when the independently persisted final audit has also been
  // loaded.  Keeping a separate permissive reader here previously meant all
  // callers could expose a report from a certified payload even when the
  // final_external_audit_v1 artifact was absent.
  return getAuthorExposureDecisionWithFinalExternalAudit(admin, jobId);
}

export async function getAuthorExposureDecisionWithFinalExternalAudit(
  admin: Pick<AdminClient, 'from'>,
  jobId: string,
): Promise<AuthorExposureDecision> {
  const certification = await readLatestArtifactContent(admin, jobId, 'author_exposure_certification_v1');
  if (certification.errorMessage) {
    return { exposable: false, reason: 'db_error', details: certification.errorMessage };
  }
  if (!certification.content) {
    return {
      exposable: false,
      reason: 'missing_certification',
      details: 'author_exposure_certification_v1 artifact missing',
    };
  }

  const finalAudit = await readLatestArtifactContent(admin, jobId, 'final_external_audit_v1');
  if (finalAudit.errorMessage) {
    return { exposable: false, reason: 'db_error', details: finalAudit.errorMessage };
  }

  const gate15Audit = await readLatestArtifactContent(admin, jobId, 'gate_15_audit_v1');
  if (gate15Audit.errorMessage) {
    return { exposable: false, reason: 'db_error', details: gate15Audit.errorMessage };
  }

  return evaluateAuthorExposureCertificationWithFinalExternalAuditAndGate15(
    certification.content,
    finalAudit.content,
    gate15Audit.content,
    {
      jobId,
    },
  );
}

import type { createClient } from '@supabase/supabase-js';
import { finalExternalAuditAllowsPhase5Exposure } from '@/lib/evaluation/finalExternalAuditExposureGuard';
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

function blockForFinalExternalAudit(details?: string): AuthorExposureDecision {
  return {
    exposable: false,
    reason: 'final_external_audit_failed',
    details: details ?? 'final_external_audit_v1 is missing, malformed, or blocking',
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

  if (certification.final_external_audit != null && !finalExternalAuditAllowsPhase5Exposure(certification.final_external_audit)) {
    return blockForFinalExternalAudit();
  }

  const certifiedAt = typeof certification.certified_at === 'string' ? certification.certified_at : null;
  return { exposable: true, certifiedAt };
}

function validateFinalAuditBinding(
  finalExternalAuditContent: unknown,
  jobMetadata?: { word_count?: number | null; evaluation_result_version?: string | null } | null,
): string | null {
  if (!jobMetadata) return null;
  const record = finalExternalAuditContent && typeof finalExternalAuditContent === 'object' && !Array.isArray(finalExternalAuditContent)
    ? (finalExternalAuditContent as Record<string, unknown>)
    : null;
  if (!record) return null;

  const auditVersion = typeof record.evaluation_result_version === 'string' ? record.evaluation_result_version : null;
  const auditWordCount = typeof record.word_count === 'number' ? record.word_count : null;

  if (auditVersion != null && jobMetadata.evaluation_result_version != null && auditVersion !== jobMetadata.evaluation_result_version) {
    return `final_external_audit_v1 evaluation_result_version mismatch: expected ${jobMetadata.evaluation_result_version}, got ${auditVersion}`;
  }
  if (auditWordCount != null && jobMetadata.word_count != null && auditWordCount !== jobMetadata.word_count) {
    return `final_external_audit_v1 word_count mismatch: expected ${jobMetadata.word_count}, got ${auditWordCount}`;
  }

  return null;
}

export function evaluateAuthorExposureCertificationWithFinalExternalAudit(
  certificationContent: unknown,
  finalExternalAuditContent: unknown,
): AuthorExposureDecision {
  const baseDecision = evaluateAuthorExposureCertification(certificationContent);
  if (!baseDecision.exposable) return baseDecision;

  if (!finalExternalAuditAllowsPhase5Exposure(finalExternalAuditContent)) return blockForFinalExternalAudit();

  return baseDecision;
}

export function evaluateAuthorExposureCertificationWithFinalExternalAuditAndGate15(
  certificationContent: unknown,
  finalExternalAuditContent: unknown,
  gate15AuditContent: unknown,
  options: {
    jobId: string;
    now?: Date;
    jobMetadata?: { word_count?: number | null; evaluation_result_version?: string | null } | null;
  },
): AuthorExposureDecision {
  const baseDecision = evaluateAuthorExposureCertification(certificationContent);
  if (!baseDecision.exposable) return baseDecision;

  if (!finalExternalAuditAllowsPhase5Exposure(finalExternalAuditContent)) return blockForFinalExternalAudit();

  const bindingError = validateFinalAuditBinding(finalExternalAuditContent, options.jobMetadata);
  if (bindingError) return blockForFinalExternalAudit(bindingError);

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

type JobExposureMetadata = {
  word_count: number | null;
  evaluation_result_version: string | null;
};

async function readJobExposureMetadata(
  admin: Pick<AdminClient, 'from'>,
  jobId: string,
): Promise<{ metadata: JobExposureMetadata | null; errorMessage: string | null }> {
  const { data, error } = await admin
    .from('evaluation_jobs')
    .select('word_count, evaluation_result_version')
    .eq('id', jobId)
    .maybeSingle();

  if (error) return { metadata: null, errorMessage: error.message };
  if (!data) return { metadata: null, errorMessage: null };

  const record = data as Record<string, unknown>;
  return {
    metadata: {
      word_count: typeof record.word_count === 'number' ? record.word_count : null,
      evaluation_result_version: typeof record.evaluation_result_version === 'string' ? record.evaluation_result_version : null,
    },
    errorMessage: null,
  };
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

  const jobMetadata = await readJobExposureMetadata(admin, jobId);
  if (jobMetadata.errorMessage) {
    return { exposable: false, reason: 'db_error', details: jobMetadata.errorMessage };
  }

  return evaluateAuthorExposureCertificationWithFinalExternalAuditAndGate15(
    certification.content,
    finalAudit.content,
    gate15Audit.content,
    {
      jobId,
      jobMetadata: jobMetadata.metadata,
    },
  );
}

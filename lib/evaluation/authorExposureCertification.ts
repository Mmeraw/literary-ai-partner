import type { createClient } from '@supabase/supabase-js';

export type AuthorExposureBlockReason =
  | 'missing_certification'
  | 'invalid_certification_payload'
  | 'decision_not_certified'
  | 'blocking_reasons_present'
  | 'parity_check_failed';

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

type CertificationShape = {
  decision?: unknown;
  certified_at?: unknown;
  blocking_reasons?: unknown;
  parity_results?: unknown;
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

function hasBlockingReasons(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((entry) => {
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

  if (Array.isArray(value)) {
    return value.some((entry) => parityHasFailure(entry));
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    const status = typeof record.status === 'string' ? record.status.trim().toLowerCase() : null;
    if (status && (status === 'fail' || status === 'failed' || status === 'block' || status === 'blocked')) {
      return true;
    }

    const verdict = typeof record.verdict === 'string' ? record.verdict.trim().toLowerCase() : null;
    if (verdict && (verdict === 'fail' || verdict === 'failed' || verdict === 'block' || verdict === 'blocked')) {
      return true;
    }

    return Object.values(record).some((entry) => parityHasFailure(entry));
  }

  return false;
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

  if (hasBlockingReasons(certification.blocking_reasons)) {
    return {
      exposable: false,
      reason: 'blocking_reasons_present',
      details: 'blocking_reasons is non-empty',
    };
  }

  if (parityHasFailure(certification.parity_results)) {
    return {
      exposable: false,
      reason: 'parity_check_failed',
      details: 'parity_results contains blocking/failure signal',
    };
  }

  const certifiedAt = typeof certification.certified_at === 'string' ? certification.certified_at : null;
  return {
    exposable: true,
    certifiedAt,
  };
}

type AdminClient = ReturnType<typeof createClient>;

export async function getAuthorExposureDecision(
  admin: Pick<AdminClient, 'from'>,
  jobId: string,
): Promise<AuthorExposureDecision> {
  const { data, error } = await admin
    .from('evaluation_artifacts')
    .select('content')
    .eq('job_id', jobId)
    .eq('artifact_type', 'author_exposure_certification_v1')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      exposable: false,
      reason: 'missing_certification',
      details: error.message,
    };
  }

  if (!data?.content) {
    return {
      exposable: false,
      reason: 'missing_certification',
      details: 'author_exposure_certification_v1 artifact missing',
    };
  }

  return evaluateAuthorExposureCertification(data.content);
}

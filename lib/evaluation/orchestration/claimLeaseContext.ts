export type ClaimLeaseContext = {
  jobId: string;
  workerId: string;
  leaseToken: string;
  leaseUntil: string;
  source: 'canonical' | 'legacy' | 'mixed';
};

export type ClaimLeaseContextInput = {
  id?: unknown;
  worker_id?: unknown;
  claimed_by?: unknown;
  lease_token?: unknown;
  lease_until?: unknown;
  lease_expires_at?: unknown;
};

export function isLiveIsoLease(leaseUntil: string, now: Date = new Date()): boolean {
  const leaseMs = Date.parse(leaseUntil);
  return Number.isFinite(leaseMs) && leaseMs > now.getTime();
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveClaimLeaseContext(
  job: ClaimLeaseContextInput,
  now: Date = new Date(),
): ClaimLeaseContext | null {
  const jobId = nonEmptyString(job.id);
  const canonicalWorkerId = nonEmptyString(job.worker_id);
  const legacyWorkerId = nonEmptyString(job.claimed_by);
  const workerId = canonicalWorkerId ?? legacyWorkerId;
  const leaseToken = nonEmptyString(job.lease_token);
  const canonicalLeaseUntil = nonEmptyString(job.lease_until);
  const legacyLeaseUntil = nonEmptyString(job.lease_expires_at);
  const leaseUntil = canonicalLeaseUntil ?? legacyLeaseUntil;

  if (!jobId || !workerId || !leaseToken || !leaseUntil || !isLiveIsoLease(leaseUntil, now)) {
    return null;
  }

  const source = canonicalWorkerId && canonicalLeaseUntil
    ? 'canonical'
    : canonicalWorkerId || canonicalLeaseUntil
      ? 'mixed'
      : 'legacy';

  return {
    jobId,
    workerId,
    leaseToken,
    leaseUntil,
    source,
  };
}

export function requireClaimLeaseContext(
  job: ClaimLeaseContextInput,
  now: Date = new Date(),
): ClaimLeaseContext {
  const context = resolveClaimLeaseContext(job, now);
  if (!context) {
    throw new Error('CLAIM_LEASE_CONTEXT_UNAVAILABLE: running job lacks a live worker/lease context');
  }
  return context;
}

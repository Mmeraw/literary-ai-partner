import {
  isLiveIsoLease,
  requireClaimLeaseContext,
  resolveClaimLeaseContext,
} from '../../lib/evaluation/orchestration/claimLeaseContext';

const NOW = new Date('2026-05-23T12:00:00.000Z');
const FUTURE = '2026-05-23T12:05:00.000Z';
const PAST = '2026-05-23T11:59:59.000Z';

describe('claim lease context normalizer', () => {
  it('resolves canonical-only worker and lease fields when legacy fields are null', () => {
    expect(resolveClaimLeaseContext({
      id: 'job-1',
      worker_id: 'worker-canonical',
      claimed_by: null,
      lease_token: 'token-1',
      lease_until: FUTURE,
      lease_expires_at: null,
    }, NOW)).toEqual({
      jobId: 'job-1',
      workerId: 'worker-canonical',
      leaseToken: 'token-1',
      leaseUntil: FUTURE,
      source: 'canonical',
    });
  });

  it('resolves canonical worker and lease fields first when legacy fields disagree', () => {
    expect(resolveClaimLeaseContext({
      id: 'job-1',
      worker_id: 'worker-canonical',
      claimed_by: 'worker-legacy',
      lease_token: 'token-1',
      lease_until: FUTURE,
      lease_expires_at: '2026-05-23T12:10:00.000Z',
    }, NOW)).toEqual({
      jobId: 'job-1',
      workerId: 'worker-canonical',
      leaseToken: 'token-1',
      leaseUntil: FUTURE,
      source: 'canonical',
    });
  });

  it('falls back to legacy-only claim fields when canonical fields are null', () => {
    expect(resolveClaimLeaseContext({
      id: 'job-1',
      worker_id: null,
      claimed_by: 'worker-legacy',
      lease_token: 'token-1',
      lease_until: null,
      lease_expires_at: FUTURE,
    }, NOW)).toEqual({
      jobId: 'job-1',
      workerId: 'worker-legacy',
      leaseToken: 'token-1',
      leaseUntil: FUTURE,
      source: 'legacy',
    });
  });

  it('marks mixed source when only one canonical lease field is present', () => {
    expect(resolveClaimLeaseContext({
      id: 'job-1',
      worker_id: 'worker-canonical',
      lease_token: 'token-1',
      lease_expires_at: FUTURE,
    }, NOW)).toMatchObject({
      workerId: 'worker-canonical',
      leaseUntil: FUTURE,
      source: 'mixed',
    });
  });

  it('fails closed for null or undefined worker identity', () => {
    expect(resolveClaimLeaseContext({
      id: 'job-1',
      worker_id: null,
      claimed_by: undefined,
      lease_token: 'token-1',
      lease_until: FUTURE,
    }, NOW)).toBeNull();

    expect(resolveClaimLeaseContext({
      id: 'job-1',
      lease_token: 'token-1',
      lease_until: FUTURE,
    }, NOW)).toBeNull();
  });

  it('fails closed for missing or empty lease token', () => {
    expect(resolveClaimLeaseContext({
      id: 'job-1',
      worker_id: 'worker-1',
      lease_until: FUTURE,
    }, NOW)).toBeNull();

    expect(resolveClaimLeaseContext({
      id: 'job-1',
      worker_id: 'worker-1',
      lease_token: '   ',
      lease_until: FUTURE,
    }, NOW)).toBeNull();
  });

  it('fails closed for expired canonical or legacy leases', () => {
    expect(resolveClaimLeaseContext({
      id: 'job-1',
      worker_id: 'worker-1',
      lease_token: 'token-1',
      lease_until: PAST,
    }, NOW)).toBeNull();

    expect(resolveClaimLeaseContext({
      id: 'job-1',
      claimed_by: 'worker-legacy',
      lease_token: 'token-1',
      lease_expires_at: PAST,
    }, NOW)).toBeNull();
  });

  it('treats null canonical lease with valid legacy lease as valid compatibility input', () => {
    expect(resolveClaimLeaseContext({
      id: 'job-1',
      worker_id: 'worker-1',
      lease_token: 'token-1',
      lease_until: null,
      lease_expires_at: FUTURE,
    }, NOW)).toEqual({
      jobId: 'job-1',
      workerId: 'worker-1',
      leaseToken: 'token-1',
      leaseUntil: FUTURE,
      source: 'mixed',
    });
  });

  it('exposes a throwing helper for active processor adoption', () => {
    expect(() => requireClaimLeaseContext({
      id: 'job-1',
      worker_id: 'worker-1',
      lease_token: 'token-1',
      lease_until: PAST,
    }, NOW)).toThrow(/CLAIM_LEASE_CONTEXT_UNAVAILABLE/);
  });

  it('validates ISO leases relative to a supplied clock', () => {
    expect(isLiveIsoLease(FUTURE, NOW)).toBe(true);
    expect(isLiveIsoLease(PAST, NOW)).toBe(false);
    expect(isLiveIsoLease('not-a-date', NOW)).toBe(false);
  });
});

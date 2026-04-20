import { assertClaimedJobsContract } from '@/lib/jobs/contracts/claimEvaluationJobs.contract';

function makeCanonicalClaimedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    phase: 'phase_1',
    status: 'running',
    phase_status: 'running',
    claimed_by: 'worker-abc',
    claimed_at: new Date().toISOString(),
    lease_token: '22222222-2222-4222-8222-222222222222',
    lease_expires_at: new Date(Date.now() + 180_000).toISOString(),
    manuscript_id: 42,
    ...overrides,
  };
}

describe('assertClaimedJobsContract', () => {
  test('canonical row passes', () => {
    const rows = [makeCanonicalClaimedRow()];

    const parsed = assertClaimedJobsContract(rows);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe(rows[0].id);
    expect(parsed[0].phase).toBe('phase_1');
    expect(parsed[0].status).toBe('running');
  });

  test('missing claimed_by fails', () => {
    const rows = [makeCanonicalClaimedRow({ claimed_by: null })];

    expect(() => assertClaimedJobsContract(rows)).toThrow('missing claimed_by');
  });

  test('non-UUID lease_token fails', () => {
    const rows = [makeCanonicalClaimedRow({ lease_token: 'not-a-uuid' })];

    expect(() => assertClaimedJobsContract(rows)).toThrow('lease_token must be a UUID');
  });

  test('legacy custom-table shape fails', () => {
    const rows = [{
      id: '11111111-1111-4111-8111-111111111111',
      manuscript_id: 42,
      claim_count: 1,
    }];

    expect(() => assertClaimedJobsContract(rows)).toThrow('contract violation');
  });

  test('non-numeric manuscript_id fails', () => {
    const rows = [makeCanonicalClaimedRow({ manuscript_id: 'abc' })];

    expect(() => assertClaimedJobsContract(rows)).toThrow('manuscript_id');
  });
});

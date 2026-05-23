import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('terminal finalizer owner guard migration', () => {
  const migrationText = readFileSync(
    join(
      process.cwd(),
      'supabase',
      'migrations',
      '20260523073000_finalize_job_failure_atomic_lease_owner_guard.sql',
    ),
    'utf8',
  );

  test('declares optional owner inputs', () => {
    expect(migrationText).toContain('p_expected_lease_token');
    expect(migrationText).toContain('p_expected_claimed_by');
  });

  test('keeps unclaimed compatibility and adds claimed-running ownership checks', () => {
    expect(migrationText).toContain("j.status IN ('queued', 'running')");
    expect(migrationText).toContain("j.status = 'running'");
    expect(migrationText).toContain('j.lease_token = p_expected_lease_token');
    expect(migrationText).toContain('j.claimed_by = p_expected_claimed_by');
  });
});

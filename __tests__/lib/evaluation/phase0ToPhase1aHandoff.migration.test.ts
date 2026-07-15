import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260715090000_atomic_phase0_to_phase1a_seed_handoff.sql',
);

const sql = fs.readFileSync(migrationPath, 'utf8');

describe('complete_phase0_to_phase1a_handoff migration contract', () => {
  test('defines the atomic handoff RPC with service-role execution only', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.complete_phase0_to_phase1a_handoff');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('SET search_path = public');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.complete_phase0_to_phase1a_handoff(uuid, text, uuid, jsonb) FROM PUBLIC');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.complete_phase0_to_phase1a_handoff(uuid, text, uuid, jsonb) TO service_role');
  });

  test('rejects handoff unless both mandatory seeds and a fit-gap report are persisted', () => {
    expect(sql).toMatch(/artifact_type\s*=\s*'story_map_seed_v1'[\s\S]*?content\s+IS\s+NOT\s+NULL[\s\S]*?content\s*<>\s*'\{\}'::jsonb/);
    expect(sql).toMatch(/artifact_type\s*=\s*'evaluation_seed_v1'[\s\S]*?content\s+IS\s+NOT\s+NULL[\s\S]*?content\s*<>\s*'\{\}'::jsonb/);
    expect(sql).toMatch(/artifact_type\s*=\s*'seed_fit_gap_report_v1'[\s\S]*?content\s+IS\s+NOT\s+NULL[\s\S]*?content\s*<>\s*'\{\}'::jsonb/);
  });

  test('rejects blocked fit-gap reports before promotion', () => {
    expect(sql).toContain("COALESCE(a.content ->> 'status', '') <> 'blocked'");
  });

  test('uses current phase, running state, claim, and lease as optimistic locks', () => {
    expect(sql).toContain("AND j.phase = 'phase_0'");
    expect(sql).toContain("AND j.status = 'running'");
    expect(sql).toContain("AND j.phase_status = 'running'");
    expect(sql).toContain('AND (p_expected_claimed_by IS NULL OR j.claimed_by = p_expected_claimed_by)');
    expect(sql).toContain('AND (p_expected_lease_token IS NULL OR j.lease_token = p_expected_lease_token)');
  });

  test('promotes phase and progress JSONB together in the same update', () => {
    expect(sql).toContain("phase = 'phase_1a'");
    expect(sql).toContain("phase_status = 'queued'");
    expect(sql).toContain('phase0_completed_at = v_now');
    expect(sql).toMatch(/progress\s*=\s*COALESCE\(j\.progress, '\{\}'::jsonb\)[\s\S]*?\|\|\s*p_progress_patch[\s\S]*?\|\|\s*jsonb_build_object/);
    expect(sql).toContain("'phase', 'phase_1a'");
    expect(sql).toContain("'phase_status', 'queued'");
    expect(sql).toContain("'phase0_completed_at', v_now");
  });

  test('returns row count instead of throwing for missing prerequisites or lost locks', () => {
    expect(sql).toContain('RETURNS integer');
    expect(sql).toMatch(/IF\s+NOT\s+EXISTS[\s\S]*?story_map_seed_v1[\s\S]*?RETURN 0;/);
    expect(sql).toMatch(/IF\s+NOT\s+EXISTS[\s\S]*?evaluation_seed_v1[\s\S]*?RETURN 0;/);
    expect(sql).toMatch(/IF\s+NOT\s+EXISTS[\s\S]*?seed_fit_gap_report_v1[\s\S]*?RETURN 0;/);
    expect(sql).toContain('GET DIAGNOSTICS v_updated = ROW_COUNT');
    expect(sql).toContain('RETURN v_updated');
  });
});

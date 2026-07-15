import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260714234500_sync_evaluation_job_progress_authority.sql',
);

const sql = fs.readFileSync(migrationPath, 'utf8');

describe('evaluation job progress authority synchronization', () => {
  it('installs a before-write trigger on every phase/progress authority field', () => {
    expect(sql).toContain('CREATE TRIGGER evaluation_jobs_sync_progress_authority');
    expect(sql).toContain('BEFORE INSERT OR UPDATE OF');
    expect(sql).toContain('phase,');
    expect(sql).toContain('phase_status,');
    expect(sql).toContain('completed_units,');
    expect(sql).toContain('total_units,');
    expect(sql).toContain('progress');
    expect(sql).toContain('ON public.evaluation_jobs');
  });

  it('ratchets completed units across current and prior column/JSONB authorities', () => {
    expect(sql).toMatch(/v_high_water\s*:=\s*GREATEST\([\s\S]*v_requested_completed[\s\S]*v_progress_completed[\s\S]*v_requested_high_water[\s\S]*v_old_completed[\s\S]*v_old_progress_completed[\s\S]*v_old_high_water[\s\S]*\)/);
    expect(sql).toContain("v_old_progress -> 'completed_units'");
    expect(sql).toContain('NEW.completed_units := v_high_water;');
    expect(sql).toContain("'completed_units', v_high_water");
    expect(sql).toContain("'progress_high_water', v_high_water");
  });

  it('mirrors the authoritative DB phase and phase status into progress JSONB', () => {
    expect(sql).toContain('NEW.phase := v_phase;');
    expect(sql).toContain("'phase', v_phase");
    expect(sql).toContain("'phase_status', NEW.phase_status");
    expect(sql).toContain("WHEN NEW.phase = 'phase_1' THEN 'phase_1a'");
  });

  it('preserves truthful Review Gate state instead of inferring Phase 2 from artifacts', () => {
    expect(sql).toContain('review_gate');
    expect(sql).not.toMatch(/evaluation_artifacts/i);
    expect(sql).not.toMatch(/accepted_story_ledger_v1/i);
    expect(sql).not.toMatch(/phase_2[^\n]*artifact/i);
  });

  it('keeps the trigger function unavailable to public callers', () => {
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.sync_evaluation_job_progress_authority() FROM PUBLIC;',
    );
  });
});

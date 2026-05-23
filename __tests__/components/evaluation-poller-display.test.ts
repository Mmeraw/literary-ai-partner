import { getProgressDisplay, getStageLabelFromPhase, __testing__ } from '../../components/evaluation-poller-display';

describe('evaluation progress UX translation map', () => {
  it('translates backend calibration to author-facing benchmark copy', () => {
    expect(getProgressDisplay({ status: 'running', phase: 'phase_0' })).toMatchObject({
      label: 'Calibrating benchmark models...',
      percentage: 10,
      tone: 'processing',
      indeterminate: false,
    });
  });

  it('translates manuscript ingest without exposing pass or phase jargon', () => {
    const display = getProgressDisplay({ status: 'running', phase: 'phase_1' });

    expect(display).toMatchObject({
      label: 'Ingesting manuscript & mapping chapters...',
      percentage: 25,
    });
    expect(display?.label).not.toContain('Phase');
    expect(display?.label).not.toContain('Pass');
  });

  it('translates active Story Layer build to narrative-footprint language', () => {
    expect(getProgressDisplay({ status: 'running', phase: 'phase_1a', phase_status: 'running' })).toMatchObject({
      label: 'Extracting core narrative footprint...',
      percentage: 45,
      tone: 'processing',
    });
  });

  it('hard-stops at Review Gate after Story Layer completion', () => {
    expect(getProgressDisplay({ status: 'running', phase: 'phase_1a', phase_status: 'complete' })).toMatchObject({
      label: 'Awaiting Story Layer Approval',
      percentage: 60,
      tone: 'action_required',
      indeterminate: false,
    });
  });

  it('hard-stops at Review Gate when ledger quality report has been emitted', () => {
    expect(getProgressDisplay({ status: 'running', latest_artifact_emitted: 'ledger_quality_report_v1' })).toMatchObject({
      label: 'Awaiting Story Layer Approval',
      percentage: 60,
      tone: 'action_required',
    });
  });

  it('shows blocked Story Layer copy without technical artifact names', () => {
    const display = getProgressDisplay({ status: 'running', is_blocked_by_gate: true });

    expect(display).toMatchObject({
      label: 'Story Layer Blocked: Narrative conflicts detected',
      percentage: 60,
      tone: 'blocked',
    });
    expect(display?.helperText).not.toContain('ledger_quality_report_v1');
    expect(display?.helperText).not.toContain('phase_1a');
  });

  it('maps accepted ledger and support artifacts into deep diagnostics', () => {
    expect(getProgressDisplay({ status: 'running', latest_artifact_emitted: 'accepted_story_ledger_v1' })).toMatchObject({
      label: 'Running deep structural craft diagnostics...',
      percentage: 80,
    });
    expect(getProgressDisplay({ status: 'running', latest_artifact_emitted: 'story_shape_signal_map_v1' })).toMatchObject({
      label: 'Running deep structural craft diagnostics...',
      percentage: 80,
    });
  });

  it('maps synthesis and final cross-checks to user-facing report assembly labels', () => {
    expect(getProgressDisplay({ status: 'running', phase: 'phase_3a' })).toMatchObject({
      label: 'Assembling evaluation matrix...',
      percentage: 90,
    });
    expect(getProgressDisplay({ status: 'running', phase: 'phase_4' })).toMatchObject({
      label: 'Running final structural cross-checks...',
      percentage: 95,
    });
  });

  it('does not expose raw backend stage or artifact names through label lookup', () => {
    expect(getStageLabelFromPhase('phase_1a', 'complete', null)).toBe('Awaiting Story Layer Approval');
    expect(getStageLabelFromPhase('phase_2', 'running', null)).toBe('Running deep structural craft diagnostics...');
  });

  it('keeps milestone percentages fixed rather than time interpolated', () => {
    expect(__testing__.UX_MILESTONES.review_gate.percentage).toBe(60);
    expect(__testing__.UX_MILESTONES.approval_normalizer.percentage).toBe(65);
    expect(__testing__.UX_MILESTONES.phase2_diagnostics.percentage).toBe(80);
  });
});

import { evaluateStageTransition } from '../../lib/evaluation/stage-machine/stageMachine';
import { isAllowedStageTransition, STAGE_TRANSITIONS } from '../../lib/evaluation/stage-machine/stageTransitions';
import type { ArtifactSet } from '../../lib/evaluation/stage-machine/hardStopGuards';

const artifact = (id: string) => ({ artifact_id: id, source_hash: `hash:${id}` });

const completeArtifactSet: ArtifactSet = {
  pass1a_story_layer_v1: artifact('pass1a'),
  ledger_quality_report_v1: artifact('quality'),
  ledger_user_feedback_v1: artifact('feedback'),
  accepted_story_ledger_v1: artifact('accepted'),
};

describe('stage machine canonical transitions', () => {
  it('declares only the four canonical forward transitions', () => {
    expect(STAGE_TRANSITIONS.map((transition) => `${transition.from}->${transition.to}`)).toEqual([
      'phase_0_calibration->phase_1a_story_layer_build',
      'phase_1a_story_layer_build->review_gate',
      'review_gate->approval_normalizer',
      'approval_normalizer->phase_2_evaluation',
    ]);
  });

  it('allows Phase 0 to Phase 1A without artifact guards', () => {
    expect(evaluateStageTransition({
      from: 'phase_0_calibration',
      to: 'phase_1a_story_layer_build',
      artifacts: {},
    })).toEqual({
      ok: true,
      from: 'phase_0_calibration',
      to: 'phase_1a_story_layer_build',
    });
  });

  it('allows Phase 1A to Review Gate only after story layer and quality report exist', () => {
    expect(evaluateStageTransition({
      from: 'phase_1a_story_layer_build',
      to: 'review_gate',
      artifacts: {
        pass1a_story_layer_v1: completeArtifactSet.pass1a_story_layer_v1,
        ledger_quality_report_v1: completeArtifactSet.ledger_quality_report_v1,
      },
    }).ok).toBe(true);

    expect(evaluateStageTransition({
      from: 'phase_1a_story_layer_build',
      to: 'review_gate',
      artifacts: {
        pass1a_story_layer_v1: completeArtifactSet.pass1a_story_layer_v1,
      },
    })).toMatchObject({ ok: false });
  });

  it('allows Review Gate to Approval Normalizer only after ledger_user_feedback_v1 exists', () => {
    expect(evaluateStageTransition({
      from: 'review_gate',
      to: 'approval_normalizer',
      artifacts: {
        ledger_user_feedback_v1: completeArtifactSet.ledger_user_feedback_v1,
      },
    }).ok).toBe(true);

    expect(evaluateStageTransition({
      from: 'review_gate',
      to: 'approval_normalizer',
      artifacts: {},
    })).toMatchObject({
      ok: false,
      reason: expect.stringContaining('ledger_user_feedback_v1'),
    });
  });

  it('allows Approval Normalizer to Phase 2 only after accepted_story_ledger_v1 exists', () => {
    expect(evaluateStageTransition({
      from: 'approval_normalizer',
      to: 'phase_2_evaluation',
      artifacts: {
        accepted_story_ledger_v1: completeArtifactSet.accepted_story_ledger_v1,
      },
    }).ok).toBe(true);

    expect(evaluateStageTransition({
      from: 'approval_normalizer',
      to: 'phase_2_evaluation',
      artifacts: {
        pass1a_story_layer_v1: completeArtifactSet.pass1a_story_layer_v1,
        ledger_user_feedback_v1: completeArtifactSet.ledger_user_feedback_v1,
      },
    })).toMatchObject({
      ok: false,
      reason: expect.stringContaining('accepted_story_ledger_v1'),
    });
  });

  it('rejects forbidden shortcuts and arbitrary backward jumps', () => {
    const forbiddenPairs = [
      ['phase_1a_story_layer_build', 'approval_normalizer'],
      ['phase_1a_story_layer_build', 'phase_2_evaluation'],
      ['review_gate', 'phase_2_evaluation'],
      ['phase_2_evaluation', 'approval_normalizer'],
      ['review_gate', 'phase_0_calibration'],
    ] as const;

    for (const [from, to] of forbiddenPairs) {
      expect(isAllowedStageTransition(from, to)).toBe(false);
      expect(evaluateStageTransition({ from, to, artifacts: completeArtifactSet })).toMatchObject({ ok: false });
    }
  });
});

import type { StageState } from './stageStates';

export type StageTransition = {
  from: StageState;
  to: StageState;
  requiredGuards: readonly string[];
};

export const STAGE_TRANSITIONS: readonly StageTransition[] = [
  {
    from: 'phase_0_calibration',
    to: 'phase_1a_story_layer_build',
    requiredGuards: [],
  },
  {
    from: 'phase_1a_story_layer_build',
    to: 'review_gate',
    requiredGuards: ['requireStoryLayer', 'requireQualityReport'],
  },
  {
    from: 'review_gate',
    to: 'approval_normalizer',
    requiredGuards: ['requireUserFeedback'],
  },
  {
    from: 'approval_normalizer',
    to: 'phase_2_evaluation',
    requiredGuards: ['requireAcceptedLedger', 'forbidPhase2WithoutAcceptedLedger'],
  },
] as const;

export function findStageTransition(from: StageState, to: StageState): StageTransition | null {
  return STAGE_TRANSITIONS.find((transition) => transition.from === from && transition.to === to) ?? null;
}

export function isAllowedStageTransition(from: StageState, to: StageState): boolean {
  return findStageTransition(from, to) !== null;
}

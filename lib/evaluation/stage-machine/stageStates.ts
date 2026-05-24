/**
 * Canonical pure stage states for the Story Layer hard-stop contract.
 *
 * Scope: PR 3 pure state-machine logic only.
 * Do not import runtime processor, worker, route, OpenAI, Supabase, or writer modules here.
 */

export const STAGE_STATES = [
  'phase_0_calibration',
  'phase_1a_story_layer_build',
  'review_gate',
  'approval_normalizer',
  'phase_2_evaluation',
] as const;

export type StageState = typeof STAGE_STATES[number];

export function isStageState(value: string): value is StageState {
  return (STAGE_STATES as readonly string[]).includes(value);
}

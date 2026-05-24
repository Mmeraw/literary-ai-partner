import { findStageTransition } from './stageTransitions';
import type { StageState } from './stageStates';
import {
  forbidPhase2WithoutAcceptedLedger,
  requireAcceptedLedger,
  requireQualityReport,
  requireStoryLayer,
  requireUserFeedback,
  type ArtifactSet,
  type GuardResult,
} from './hardStopGuards';

export type StageMachineResult =
  | { ok: true; from: StageState; to: StageState }
  | { ok: false; from: StageState; to: StageState; reason: string };

type GuardName =
  | 'requireStoryLayer'
  | 'requireQualityReport'
  | 'requireUserFeedback'
  | 'requireAcceptedLedger'
  | 'forbidPhase2WithoutAcceptedLedger';

const GUARDS: Record<GuardName, (set: ArtifactSet) => GuardResult> = {
  requireStoryLayer,
  requireQualityReport,
  requireUserFeedback,
  requireAcceptedLedger,
  forbidPhase2WithoutAcceptedLedger,
};

function fail(from: StageState, to: StageState, reason: string): StageMachineResult {
  return { ok: false, from, to, reason };
}

export function evaluateStageTransition(params: {
  from: StageState;
  to: StageState;
  artifacts: ArtifactSet;
}): StageMachineResult {
  const transition = findStageTransition(params.from, params.to);

  if (!transition) {
    return fail(params.from, params.to, `Forbidden stage transition: ${params.from} to ${params.to}`);
  }

  for (const guardName of transition.requiredGuards) {
    const guard = GUARDS[guardName as GuardName];
    const result = guard(params.artifacts);

    if (result.ok === false) {
      return fail(params.from, params.to, result.reason);
    }
  }

  return { ok: true, from: params.from, to: params.to };
}

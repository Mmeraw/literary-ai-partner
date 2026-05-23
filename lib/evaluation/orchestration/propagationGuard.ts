import type { RuntimeArtifactEnvelopeWithFreshness } from '../artifacts/artifactFreshness';

export type FreshnessRecommendedAction = 'RUN_PIPELINE' | 'USE_AS_IS_DEGRADED' | 'RENDER_OK';

export interface FreshnessCheckResult {
  isStale: boolean;
  recommendedAction: FreshnessRecommendedAction;
}

export function checkArtifactFreshness(
  dependentArtifact: RuntimeArtifactEnvelopeWithFreshness,
  currentParentSourceHash: string,
): FreshnessCheckResult {
  if (dependentArtifact.freshness_status === 'STALE') {
    return { isStale: true, recommendedAction: 'RUN_PIPELINE' };
  }

  if (dependentArtifact.source_hash !== currentParentSourceHash) {
    return { isStale: true, recommendedAction: 'USE_AS_IS_DEGRADED' };
  }

  return { isStale: false, recommendedAction: 'RENDER_OK' };
}

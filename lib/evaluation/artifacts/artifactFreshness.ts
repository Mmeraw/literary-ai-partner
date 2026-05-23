import type { RuntimeArtifactEnvelope } from './artifactTypes';

export type ArtifactFreshnessStatus = 'CURRENT' | 'STALE' | 'DEGRADED_VERSION_MISMATCH';

export type RuntimeArtifactEnvelopeWithFreshness = RuntimeArtifactEnvelope & {
  freshness_status?: ArtifactFreshnessStatus;
};

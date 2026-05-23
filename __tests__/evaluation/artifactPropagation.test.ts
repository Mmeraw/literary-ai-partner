import { checkArtifactFreshness } from '../../lib/evaluation/orchestration/propagationGuard';
import type { RuntimeArtifactEnvelopeWithFreshness } from '../../lib/evaluation/artifacts/artifactFreshness';

const baseArtifact: RuntimeArtifactEnvelopeWithFreshness = {
  job_id: 'job_test_001',
  evaluation_project_id: 'eval_project_test_001',
  manuscript_id: 42,
  manuscript_version_hash: 'manuscript_hash_v1',
  artifact_id: 'artifact_test_001',
  artifact_type: 'story_shape_signal_map_v1',
  artifact_version: 'v1',
  source_hash: 'accepted_ledger_hash_v1',
  generated_at: '2026-05-22T12:00:00.000Z',
};

describe('artifact staleness propagation guard', () => {
  it('renders current artifacts when source hash matches', () => {
    expect(checkArtifactFreshness({
      ...baseArtifact,
      freshness_status: 'CURRENT',
    }, 'accepted_ledger_hash_v1')).toEqual({
      isStale: false,
      recommendedAction: 'RENDER_OK',
    });
  });

  it('recommends pipeline regeneration when database marks artifact stale', () => {
    expect(checkArtifactFreshness({
      ...baseArtifact,
      freshness_status: 'STALE',
    }, 'accepted_ledger_hash_v1')).toEqual({
      isStale: true,
      recommendedAction: 'RUN_PIPELINE',
    });
  });

  it('allows degraded rendering when hashes diverge before propagation is observed', () => {
    expect(checkArtifactFreshness({
      ...baseArtifact,
      freshness_status: 'CURRENT',
      source_hash: 'accepted_ledger_hash_old',
    }, 'accepted_ledger_hash_new')).toEqual({
      isStale: true,
      recommendedAction: 'USE_AS_IS_DEGRADED',
    });
  });

  it('treats legacy artifacts without freshness_status as renderable when hashes match', () => {
    expect(checkArtifactFreshness(baseArtifact, 'accepted_ledger_hash_v1')).toEqual({
      isStale: false,
      recommendedAction: 'RENDER_OK',
    });
  });
});

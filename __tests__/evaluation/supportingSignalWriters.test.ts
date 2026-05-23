import {
  buildManuscriptSignalAppendixArtifact,
  buildStoryShapeSignalArtifact,
  evaluateSupportSignalFreshness,
  writeSupportSignalsForAcceptedLedger,
  type SupportSignalArtifact,
} from '../../lib/evaluation/support-artifacts/supportingSignalWriters';
import type { Phase1aWriterMetadata } from '../../lib/evaluation/phase1a/storyLayerArtifactWriters';

const metadata: Phase1aWriterMetadata = {
  job_id: 'job-support-1',
  evaluation_project_id: 'project-support-1',
  stage_run_id: 'stage-support-1',
  manuscript_id: 202,
  manuscript_version_hash: 'support-manuscript-version-hash',
  generated_at: '2026-05-22T13:00:00.000Z',
};

const acceptedLedger = {
  artifact_id: 'accepted-ledger-artifact-id',
  source_hash: 'accepted-ledger-source-hash',
};

describe('supporting signal artifact writers', () => {
  it('builds story_shape_signal_map_v1 coupled to accepted_story_ledger_v1', () => {
    const artifact = buildStoryShapeSignalArtifact({
      metadata,
      acceptedLedger,
      pacing_anchor_signals: [
        { timeline_marker: 'act-2-midpoint', delta_type: 'pressure-escalation', evidence_reference: 'chapter-18' },
      ],
      structural_turning_points: { midpoint: 'escape attempt fails' },
    });

    expect(artifact.artifact_type).toBe('story_shape_signal_map_v1');
    expect(artifact.content.accepted_story_ledger_artifact_id).toBe(acceptedLedger.artifact_id);
    expect(artifact.content.accepted_story_ledger_source_hash).toBe(acceptedLedger.source_hash);
    expect(artifact.content.status).toBe('active');
    expect(artifact.source_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('builds manuscript_signal_appendix_v1 coupled to accepted_story_ledger_v1', () => {
    const artifact = buildManuscriptSignalAppendixArtifact({
      metadata,
      acceptedLedger,
      sensory_tonal_register_map: { register: 'threatened domestic noir' },
      evidence_density_distribution: { canonical_identity_layer: 12 },
    });

    expect(artifact.artifact_type).toBe('manuscript_signal_appendix_v1');
    expect(artifact.content.accepted_story_ledger_artifact_id).toBe(acceptedLedger.artifact_id);
    expect(artifact.content.accepted_story_ledger_source_hash).toBe(acceptedLedger.source_hash);
    expect(artifact.content.status).toBe('active');
    expect(artifact.source_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('writes only the two support artifacts and never mutates accepted ledger authority', async () => {
    const writes: SupportSignalArtifact[] = [];

    const result = await writeSupportSignalsForAcceptedLedger({
      metadata,
      acceptedLedger,
      shape: {
        pacing_anchor_signals: [],
        structural_turning_points: {},
      },
      appendix: {
        sensory_tonal_register_map: {},
        evidence_density_distribution: {},
      },
      writeArtifact: async (artifact) => {
        writes.push(artifact);
        return { artifact_id: `persisted:${artifact.artifact_type}` };
      },
    });

    const writtenTypes = writes.map((artifact) => artifact.artifact_type) as string[];

    expect(writtenTypes).toEqual([
      'story_shape_signal_map_v1',
      'manuscript_signal_appendix_v1',
    ]);
    expect(writtenTypes).not.toContain('accepted_story_ledger_v1');
    expect(writtenTypes).not.toContain('pass1a_story_layer_v1');
    expect(result.story_shape_signal_map_v1.artifact_id).toBe('persisted:story_shape_signal_map_v1');
    expect(result.manuscript_signal_appendix_v1.artifact_id).toBe('persisted:manuscript_signal_appendix_v1');
  });

  it('marks support artifact stale when accepted ledger source hash changes', () => {
    expect(evaluateSupportSignalFreshness({
      acceptedLedger,
      supportArtifact: {
        accepted_story_ledger_source_hash: acceptedLedger.source_hash,
        status: 'active',
      },
    })).toBe('active');

    expect(evaluateSupportSignalFreshness({
      acceptedLedger: { ...acceptedLedger, source_hash: 'new-accepted-ledger-hash' },
      supportArtifact: {
        accepted_story_ledger_source_hash: acceptedLedger.source_hash,
        status: 'active',
      },
    })).toBe('stale');
  });

  it('preserves degraded support artifact state without promoting it to active', () => {
    expect(evaluateSupportSignalFreshness({
      acceptedLedger,
      supportArtifact: {
        accepted_story_ledger_source_hash: acceptedLedger.source_hash,
        status: 'degraded',
      },
    })).toBe('degraded');
  });
});

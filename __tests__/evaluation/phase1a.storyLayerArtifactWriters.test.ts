import {
  buildLedgerQualityReportArtifact,
  buildPass1aStoryLayerArtifact,
  validateStoryLayerPayload,
  writePhase1aReviewGateArtifacts,
  type LedgerQualityReportPayload,
  type Phase1aWriterArtifact,
  type Phase1aWriterMetadata,
} from '../../lib/evaluation/phase1a/storyLayerArtifactWriters';
import { STORY_LAYER_CORE_LAYER_KEYS } from '../../lib/evaluation/artifacts/artifactTypes';

const metadata: Phase1aWriterMetadata = {
  job_id: 'job-123',
  evaluation_project_id: 'project-456',
  stage_run_id: 'stage-789',
  manuscript_id: 42,
  manuscript_version_hash: 'manuscript-hash-v1',
  generated_at: '2026-05-22T12:00:00.000Z',
};

function validStoryLayer() {
  return Object.fromEntries(
    STORY_LAYER_CORE_LAYER_KEYS.map((key) => [
      key,
      {
        extracted_claims: [`claim for ${key}`],
        evidence_anchors: [`anchor:${key}`],
      },
    ]),
  );
}

const qualityReport: LedgerQualityReportPayload = {
  gate_ready_status: 'reviewable',
  hard_fail_present: false,
  grouped_warning_summary: {
    identity: ['Verify alias merge confidence before approval.'],
  },
  evidence_location_references: [
    {
      layer: 'canonical_identity_layer',
      reference: 'chapter-2:paragraph-14',
    },
  ],
  blocking_reasons: [],
  recommended_review_action: 'send_to_review_gate',
};

describe('Phase 1A Story Layer artifact writers', () => {
  it('builds pass1a_story_layer_v1 with exactly eight canonical layer payloads', () => {
    const artifact = buildPass1aStoryLayerArtifact({
      metadata,
      storyLayer: validStoryLayer(),
    });

    expect(artifact.artifact_type).toBe('pass1a_story_layer_v1');
    expect(artifact.artifact_version).toBe('v1');
    expect(artifact.content.artifact_type).toBe('pass1a_story_layer_v1');
    expect(artifact.content.artifact_version).toBe('v1');
    expect(artifact.content.job_id).toBe(metadata.job_id);
    expect(artifact.content.evaluation_project_id).toBe(metadata.evaluation_project_id);
    expect(artifact.content.stage_run_id).toBe(metadata.stage_run_id);
    expect(Object.keys(artifact.content.layers)).toEqual([...STORY_LAYER_CORE_LAYER_KEYS]);
    expect(artifact.source_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects malformed story layer payloads that embed governance or downstream artifacts', () => {
    expect(() => validateStoryLayerPayload({
      ...validStoryLayer(),
      governance: { warnings: [] },
    })).toThrow(/must not embed governance/);

    expect(() => validateStoryLayerPayload({
      ...validStoryLayer(),
      accepted_story_ledger_v1: { artifact_id: 'forbidden' },
    })).toThrow(/must not embed governance/);

    const missingLayer = validStoryLayer();
    delete missingLayer.source_integrity_layer;
    expect(() => validateStoryLayerPayload(missingLayer)).toThrow(/missing canonical layer/);
  });

  it('builds ledger_quality_report_v1 linked to the story layer source hash', () => {
    const storyLayerArtifact = buildPass1aStoryLayerArtifact({
      metadata,
      storyLayer: validStoryLayer(),
    });

    const reportArtifact = buildLedgerQualityReportArtifact({
      metadata,
      storyLayerSourceHash: storyLayerArtifact.source_hash,
      qualityReport,
    });

    expect(reportArtifact.artifact_type).toBe('ledger_quality_report_v1');
    expect(reportArtifact.artifact_version).toBe('v1');
    expect(reportArtifact.content.artifact_type).toBe('ledger_quality_report_v1');
    expect(reportArtifact.content.pass1a_story_layer_source_hash).toBe(storyLayerArtifact.source_hash);
    expect(reportArtifact.content.quality_report.gate_ready_status).toBe('reviewable');
    expect(reportArtifact.source_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns stable artifact metadata for identical Phase 1A inputs', () => {
    const first = buildPass1aStoryLayerArtifact({ metadata, storyLayer: validStoryLayer() });
    const second = buildPass1aStoryLayerArtifact({ metadata, storyLayer: validStoryLayer() });

    expect(first.source_hash).toBe(second.source_hash);
    expect(first.content.artifact_id).toBe(second.content.artifact_id);
  });

  it('writes only the raw Story Layer and quality report artifacts for Review Gate handoff', async () => {
    const writes: Phase1aWriterArtifact[] = [];

    const result = await writePhase1aReviewGateArtifacts({
      metadata,
      storyLayer: validStoryLayer(),
      qualityReport,
      writeArtifact: async (artifact) => {
        writes.push(artifact);
        return { artifact_id: `persisted:${artifact.artifact_type}` };
      },
    });

    const artifactTypesWritten = writes.map((artifact) => artifact.artifact_type) as string[];

    expect(artifactTypesWritten).toEqual([
      'pass1a_story_layer_v1',
      'ledger_quality_report_v1',
    ]);
    expect(writes).toHaveLength(2);
    expect(result.pass1a_story_layer_v1.artifact_id).toBe('persisted:pass1a_story_layer_v1');
    expect(result.ledger_quality_report_v1.artifact_id).toBe('persisted:ledger_quality_report_v1');
    expect(artifactTypesWritten).not.toContain('accepted_story_ledger_v1');
    expect(artifactTypesWritten).not.toContain('story_shape_signal_map_v1');
    expect(artifactTypesWritten).not.toContain('manuscript_signal_appendix_v1');
  });
});

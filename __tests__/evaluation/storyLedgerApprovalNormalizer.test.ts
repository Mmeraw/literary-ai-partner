import { STORY_LAYER_CORE_LAYER_KEYS } from '../../lib/evaluation/artifacts/artifactTypes';
import type { LedgerQualityReportPayload, Phase1aWriterMetadata } from '../../lib/evaluation/phase1a/storyLayerArtifactWriters';
import {
  assertPhase2StoryAuthority,
  buildAcceptedStoryLedgerArtifact,
  buildLedgerUserFeedbackArtifact,
  writeReviewGateApprovalArtifacts,
  type ApprovalNormalizerArtifact,
  type LedgerUserFeedbackPayload,
  type ReviewGateSourceArtifacts,
} from '../../lib/evaluation/review-gate/storyLedgerApprovalNormalizer';

const metadata: Phase1aWriterMetadata = {
  job_id: 'job-approval-1',
  evaluation_project_id: 'project-approval-1',
  stage_run_id: 'stage-review-gate-1',
  manuscript_id: 101,
  manuscript_version_hash: 'manuscript-version-hash',
  generated_at: '2026-05-22T12:30:00.000Z',
};

function storyLayer() {
  return Object.fromEntries(
    STORY_LAYER_CORE_LAYER_KEYS.map((key) => [
      key,
      {
        evidence_anchors: [`anchor:${key}`],
        extracted_claims: [`claim:${key}`],
      },
    ]),
  );
}

const cleanQualityReport: LedgerQualityReportPayload = {
  gate_ready_status: 'reviewable',
  hard_fail_present: false,
  grouped_warning_summary: {},
  evidence_location_references: [],
  blocking_reasons: [],
  recommended_review_action: 'send_to_review_gate',
};

const hardFailQualityReport: LedgerQualityReportPayload = {
  gate_ready_status: 'blocked',
  hard_fail_present: true,
  grouped_warning_summary: {
    identity: ['Alias fragmentation unresolved.'],
  },
  evidence_location_references: [
    { layer: 'canonical_identity_layer', reference: 'chapter-4:paragraph-2' },
  ],
  blocking_reasons: ['Alias fragmentation unresolved.'],
  recommended_review_action: 'operator_review_required',
};

function sourceArtifacts(qualityReport: LedgerQualityReportPayload = cleanQualityReport): ReviewGateSourceArtifacts {
  return {
    pass1a_story_layer_v1: {
      artifact_id: 'pass1a-artifact-id',
      source_hash: 'pass1a-source-hash',
      layers: storyLayer(),
    },
    ledger_quality_report_v1: {
      artifact_id: 'quality-artifact-id',
      source_hash: 'quality-source-hash',
      quality_report: qualityReport,
    },
  };
}

function feedback(overrides: Partial<LedgerUserFeedbackPayload> = {}): LedgerUserFeedbackPayload {
  return {
    reviewer_user_id: 'reviewer-1',
    reviewer_role: 'author',
    review_status: 'accepted_without_changes',
    layer_dispositions: STORY_LAYER_CORE_LAYER_KEYS.map((layer) => ({ layer, status: 'accepted' })),
    user_corrections: {},
    unresolved_warnings: [],
    ...overrides,
  };
}

describe('Story Ledger approval normalizer', () => {
  it('writes ledger_user_feedback_v1 and accepted_story_ledger_v1 for clean accepted feedback', async () => {
    const writes: ApprovalNormalizerArtifact[] = [];

    const result = await writeReviewGateApprovalArtifacts({
      metadata,
      sourceArtifacts: sourceArtifacts(),
      feedback: feedback(),
      writeArtifact: async (artifact) => {
        writes.push(artifact);
        return { artifact_id: `persisted:${artifact.artifact_type}` };
      },
    });

    expect(writes.map((artifact) => artifact.artifact_type)).toEqual([
      'ledger_user_feedback_v1',
      'accepted_story_ledger_v1',
    ]);
    expect(result.ledger_user_feedback_v1.artifact_id).toBe('persisted:ledger_user_feedback_v1');
    expect(result.accepted_story_ledger_v1?.artifact_id).toBe('persisted:accepted_story_ledger_v1');
  });

  it('writes feedback only for rejected review status', async () => {
    const writes: ApprovalNormalizerArtifact[] = [];

    const result = await writeReviewGateApprovalArtifacts({
      metadata,
      sourceArtifacts: sourceArtifacts(),
      feedback: feedback({ review_status: 'rejected' }),
      writeArtifact: async (artifact) => {
        writes.push(artifact);
        return { artifact_id: `persisted:${artifact.artifact_type}` };
      },
    });

    expect(writes.map((artifact) => artifact.artifact_type)).toEqual(['ledger_user_feedback_v1']);
    expect(result.accepted_story_ledger_v1).toBeUndefined();
  });

  it('blocks non-admin accepted feedback when hard fails remain', () => {
    expect(() => buildAcceptedStoryLedgerArtifact({
      metadata,
      sourceArtifacts: sourceArtifacts(hardFailQualityReport),
      feedbackArtifactId: 'feedback-artifact-id',
      feedbackSourceHash: 'feedback-source-hash',
      feedback: feedback({ review_status: 'accepted_with_corrections' }),
    })).toThrow(/hard fails remain unresolved/);
  });

  it('allows explicit admin or operator override for hard-fail approval path', () => {
    const adminAccepted = buildAcceptedStoryLedgerArtifact({
      metadata,
      sourceArtifacts: sourceArtifacts(hardFailQualityReport),
      feedbackArtifactId: 'feedback-artifact-id',
      feedbackSourceHash: 'feedback-source-hash',
      feedback: feedback({
        reviewer_role: 'admin',
        review_status: 'accepted_with_override',
        unresolved_warnings: ['Alias fragmentation unresolved.'],
      }),
    });

    expect(adminAccepted.artifact_type).toBe('accepted_story_ledger_v1');
    expect(adminAccepted.content.accepted_story_ledger?.governance_summary.admin_override_applied).toBe(true);
    expect(adminAccepted.content.accepted_story_ledger?.governance_summary.unresolved_warnings).toEqual([
      'Alias fragmentation unresolved.',
    ]);
  });

  it('rejects accepted_with_override for author role', () => {
    expect(() => buildAcceptedStoryLedgerArtifact({
      metadata,
      sourceArtifacts: sourceArtifacts(),
      feedbackArtifactId: 'feedback-artifact-id',
      feedbackSourceHash: 'feedback-source-hash',
      feedback: feedback({ review_status: 'accepted_with_override', reviewer_role: 'author' }),
    })).toThrow(/admin or operator/);
  });

  it('requires all eight layer dispositions in feedback', () => {
    expect(() => buildLedgerUserFeedbackArtifact({
      metadata,
      feedback: feedback({
        layer_dispositions: STORY_LAYER_CORE_LAYER_KEYS.slice(0, 7).map((layer) => ({ layer, status: 'accepted' })),
      }),
    })).toThrow(/missing layer disposition/);
  });

  it('applies user corrections only to canonical Story Layer keys', () => {
    const accepted = buildAcceptedStoryLedgerArtifact({
      metadata,
      sourceArtifacts: sourceArtifacts(),
      feedbackArtifactId: 'feedback-artifact-id',
      feedbackSourceHash: 'feedback-source-hash',
      feedback: feedback({
        review_status: 'accepted_with_corrections',
        layer_dispositions: STORY_LAYER_CORE_LAYER_KEYS.map((layer) => ({
          layer,
          status: layer === 'canonical_identity_layer' ? 'modified' : 'accepted',
        })),
        user_corrections: {
          canonical_identity_layer: {
            corrected_alias_groups: ['Michael James Salter / Miguel / Mr. Salter'],
          },
        },
      }),
    });

    expect(accepted.content.accepted_story_ledger?.normalized_layers.canonical_identity_layer).toMatchObject({
      corrected_alias_groups: ['Michael James Salter / Miguel / Mr. Salter'],
    });
  });

  it('prevents Phase 2 story authority from raw or unapproved Story Layer artifacts', () => {
    expect(() => assertPhase2StoryAuthority('pass1a_story_layer_v1')).toThrow(/accepted_story_ledger_v1/);
    expect(() => assertPhase2StoryAuthority('ledger_quality_report_v1')).toThrow(/accepted_story_ledger_v1/);
    expect(() => assertPhase2StoryAuthority('accepted_story_ledger_v1')).not.toThrow();
  });
});

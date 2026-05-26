import {
  CANONICAL_EVALUATION_ARTIFACT_TYPES,
  type ArtifactRegistryEntry,
  type CanonicalEvaluationArtifactType,
} from './artifactTypes';

const CONTRACT_DOC = 'docs/canon/STORY_LAYER_CONTRACT_V1.md';
const SUPPORT_CONTRACT_DOC = 'docs/canon/SUPPORTING_SIGNAL_ARTIFACTS_CONTRACT_V1.md';

export const ARTIFACT_REGISTRY: Record<CanonicalEvaluationArtifactType, ArtifactRegistryEntry> = {
  dream_calibration_packet_v1: {
    artifactType: 'dream_calibration_packet_v1',
    artifactVersion: 'v1',
    schemaPath: null,
    contractDocPath: CONTRACT_DOC,
    authority: 'calibration',
    phase: 'phase_0_calibration',
    phase2StoryAuthority: false,
    supportArtifact: false,
    createsStoryLayer: false,
  },
  pass1a_story_layer_v1: {
    artifactType: 'pass1a_story_layer_v1',
    artifactVersion: 'v1',
    schemaPath: 'schemas/evaluation/pass1a_story_layer_v1.schema.json',
    contractDocPath: CONTRACT_DOC,
    authority: 'governing_story_understanding',
    phase: 'phase_1a_story_layer',
    phase2StoryAuthority: false,
    supportArtifact: false,
    createsStoryLayer: true,
  },
  ledger_quality_report_v1: {
    artifactType: 'ledger_quality_report_v1',
    artifactVersion: 'v1',
    schemaPath: null,
    contractDocPath: CONTRACT_DOC,
    authority: 'gate_verdict',
    phase: 'phase_1a_story_layer',
    phase2StoryAuthority: false,
    supportArtifact: false,
    createsStoryLayer: false,
  },
  ledger_user_feedback_v1: {
    artifactType: 'ledger_user_feedback_v1',
    artifactVersion: 'v1',
    schemaPath: 'schemas/evaluation/ledger_user_feedback_v1.schema.json',
    contractDocPath: CONTRACT_DOC,
    authority: 'review_trace',
    phase: 'review_gate',
    phase2StoryAuthority: false,
    supportArtifact: false,
    createsStoryLayer: false,
  },
  accepted_story_ledger_v1: {
    artifactType: 'accepted_story_ledger_v1',
    artifactVersion: 'v1',
    schemaPath: 'schemas/evaluation/accepted_story_ledger_v1.schema.json',
    contractDocPath: CONTRACT_DOC,
    authority: 'governing_story_understanding',
    phase: 'approval_normalizer',
    phase2StoryAuthority: true,
    supportArtifact: false,
    createsStoryLayer: false,
  },
  story_shape_signal_map_v1: {
    artifactType: 'story_shape_signal_map_v1',
    artifactVersion: 'v1',
    schemaPath: 'schemas/evaluation/story_shape_signal_map_v1.schema.json',
    contractDocPath: SUPPORT_CONTRACT_DOC,
    authority: 'phase2_enrichment',
    phase: 'phase_2_story_evaluation',
    phase2StoryAuthority: false,
    supportArtifact: true,
    createsStoryLayer: false,
  },
  manuscript_signal_appendix_v1: {
    artifactType: 'manuscript_signal_appendix_v1',
    artifactVersion: 'v1',
    schemaPath: 'schemas/evaluation/manuscript_signal_appendix_v1.schema.json',
    contractDocPath: SUPPORT_CONTRACT_DOC,
    authority: 'phase2_enrichment',
    phase: 'phase_2_story_evaluation',
    phase2StoryAuthority: false,
    supportArtifact: true,
    createsStoryLayer: false,
  },
  phase2_evaluation_packet_v1: {
    artifactType: 'phase2_evaluation_packet_v1',
    artifactVersion: 'v1',
    schemaPath: null,
    contractDocPath: CONTRACT_DOC,
    authority: 'downstream_packet',
    phase: 'phase_2_story_evaluation',
    phase2StoryAuthority: false,
    supportArtifact: false,
    createsStoryLayer: false,
  },
  phase2_author_response_v1: {
    artifactType: 'phase2_author_response_v1',
    artifactVersion: 'v1',
    schemaPath: null,
    contractDocPath: CONTRACT_DOC,
    authority: 'review_trace',
    phase: 'phase_2_story_evaluation',
    phase2StoryAuthority: false,
    supportArtifact: false,
    createsStoryLayer: false,
  },
  evaluation_result_v2: {
    artifactType: 'evaluation_result_v2',
    artifactVersion: 'v2',
    schemaPath: null,
    contractDocPath: CONTRACT_DOC,
    authority: 'final_result',
    phase: 'phase_3_final_report',
    phase2StoryAuthority: false,
    supportArtifact: false,
    createsStoryLayer: false,
  },
  wave_revision_plan_v1: {
    artifactType: 'wave_revision_plan_v1',
    artifactVersion: 'v1',
    schemaPath: null,
    contractDocPath: CONTRACT_DOC,
    authority: 'wave_revision',
    phase: 'phase_4_wave_revision',
    phase2StoryAuthority: false,
    supportArtifact: false,
    createsStoryLayer: false,
  },
};

export function getArtifactRegistryEntry(
  artifactType: CanonicalEvaluationArtifactType,
): ArtifactRegistryEntry {
  return ARTIFACT_REGISTRY[artifactType];
}

export function isCanonicalEvaluationArtifactType(
  value: string,
): value is CanonicalEvaluationArtifactType {
  return (CANONICAL_EVALUATION_ARTIFACT_TYPES as readonly string[]).includes(value);
}

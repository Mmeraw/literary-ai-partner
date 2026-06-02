/**
 * Canonical evaluation artifact type contracts.
 *
 * Scope: shape-only registry support for STORY_LAYER_CONTRACT_V1.
 * Do not import runtime pipeline, worker, route, prompt, OpenAI, or Supabase modules here.
 */
export const CANONICAL_EVALUATION_ARTIFACT_TYPES = [
  'dream_calibration_packet_v1',
  'story_map_seed_v1',
  'evaluation_seed_v1',
  'seed_fit_gap_report_v1',
  'factual_anomalies_detected_v1',
  'pass1a_story_layer_v1',
  'ledger_quality_report_v1',
  'ledger_user_feedback_v1',
  'accepted_story_ledger_v1',
  'story_shape_signal_map_v1',
  'manuscript_signal_appendix_v1',
  'pass12_handoff_v1',
  'revision_opportunity_ledger_v1',
  'phase2_evaluation_packet_v1',
  'phase2_author_response_v1',
  'evaluation_result_v2',
  'external_report_crosscheck_v1',
  'wave_revision_plan_v1',
] as const;

export type CanonicalEvaluationArtifactType = typeof CANONICAL_EVALUATION_ARTIFACT_TYPES[number];

export const STORY_LAYER_KEYS = [
  'source_integrity_layer',
  'pov_structure_layer',
  'canonical_identity_layer',
  'cast_role_tier_layer',
  'identity_pronoun_layer',
  'relationship_network_layer',
  'object_symbol_layer',
  'location_timeline_worldstate_layer',
  'threat_antagonist_ending_layer',
] as const;

export const STORY_LAYER_COUNT = STORY_LAYER_KEYS.length;

// Backward-compatible alias for legacy imports.
export const STORY_LAYER_CORE_LAYER_KEYS = STORY_LAYER_KEYS;

export type StoryLayerCoreLayerKey = typeof STORY_LAYER_KEYS[number];

export type RuntimeArtifactEnvelope = {
  job_id: string;
  evaluation_project_id: string | null;
  stage_run_id?: string | null;
  manuscript_id: number;
  manuscript_version_hash: string;
  artifact_id: string;
  artifact_type: CanonicalEvaluationArtifactType;
  artifact_version: string;
  source_hash: string;
  generated_at: string;
};

export type ArtifactAuthority =
  | 'seed_baseline'
  | 'seed_fit_gap'
  | 'governing_story_understanding'
  | 'gate_verdict'
  | 'review_trace'
  | 'handoff'
  | 'revision_queue_handoff'
  | 'phase2_enrichment'
  | 'calibration'
  | 'external_verification'
  | 'downstream_packet'
  | 'final_result'
  | 'wave_revision';

export type ArtifactPhase =
  | 'phase_0_calibration'
  | 'seed_baseline'
  | 'phase_1a_story_layer'
  | 'review_gate'
  | 'approval_normalizer'
  | 'phase_2_story_evaluation'
  | 'phase_2_to_revise_handoff'
  | 'phase_3_final_report'
  | 'phase_4_cross_check'
  | 'phase_4_wave_revision';

export type ArtifactRegistryEntry = {
  artifactType: CanonicalEvaluationArtifactType;
  artifactVersion: 'v1' | 'v2';
  schemaPath: string | null;
  contractDocPath: string;
  authority: ArtifactAuthority;
  phase: ArtifactPhase;
  phase2StoryAuthority: boolean;
  supportArtifact: boolean;
  createsStoryLayer: boolean;
};

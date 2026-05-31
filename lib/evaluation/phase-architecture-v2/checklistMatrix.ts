export const CHECKLIST_ARTIFACT_TYPES = [
  'phase0_authority_proof_v1',
  'story_map_seed_v1',
  'evaluation_seed_v1',
  'revise_opportunity_seed_v1',
  'story_map_verification_v1',
  'seed_contradiction_report_v1',
  'evidence_index_v1',
  'verified_story_layer_handoff_v1',
  'semantic_gate_result_v1',
  'accepted_story_context_v1',
  'criteria_evaluation_v1',
  'criteria_recommendation_contract_v1',
  'pass12_handoff_v1',
  'evaluation_synthesis_v1',
  'evaluation_result_v2',
  'llr_quality_gate_result_v1',
  'llr_recovery_checkpoint_v1',
  'wave_readiness_analysis_v1',
  'wave_revision_guidance_v1',
  'revise_admission_result_v1',
  'revise_candidate_validation_v1',
  'revise_queue_package_v1',
  'report_render_manifest_v1',
  'job_checkpoint_manifest_v1',
] as const;

export type ChecklistArtifactType = (typeof CHECKLIST_ARTIFACT_TYPES)[number];

export const CHECKLIST_PHASE_IDS = [
  'phase_0',
  'phase_0_5a',
  'phase_0_5b',
  'phase_1a',
  'pass_3a',
  'semantic_gate',
  'phase_2',
  'phase_3',
  'llr_quality_gate',
  'wave',
  'revise_admission',
  'revise_queue_package',
  'final_render',
] as const;

export type ChecklistPhaseId = (typeof CHECKLIST_PHASE_IDS)[number];

export const SIPOC_STAGE_REFS = [
  'S01_INTAKE',
  'S02_QUEUE',
  'S03_CLAIM',
  'S04_ROUTING_CHUNKING',
  'S05_PASS1',
  'S06_PASS2',
  'S07_PASS3',
  'S08_ER2_NORMALIZATION',
  'S09_QUALITYGATEV2',
  'S10_PERSISTENCE',
  'S11_RENDERER',
  'ADJACENT_PHASE_0',
  'ADJACENT_PHASE_0_5A',
  'ADJACENT_PHASE_0_5B',
  'ADJACENT_PASS_3A',
  'ADJACENT_SEMANTIC_GATE',
  'ADJACENT_LLR',
  'ADJACENT_REVISE',
  'ADJACENT_WAVE',
] as const;

export type SipocStageRef = (typeof SIPOC_STAGE_REFS)[number];

export type ChecklistRuntimePhase =
  | 'phase_0'
  | 'phase_1a'
  | 'pass_3a'
  | 'review_gate'
  | 'phase_2'
  | 'phase_3'
  | 'wave'
  | 'revise'
  | 'final_render';

export type ChecklistMatrixRow = {
  readonly phase_id: ChecklistPhaseId;
  readonly runtime_phase: ChecklistRuntimePhase;
  readonly sipoc_stage_ref: SipocStageRef;
  readonly required_inputs: readonly ChecklistArtifactType[];
  readonly required_authority_proof: boolean;
  readonly output_artifacts: readonly ChecklistArtifactType[];
  readonly validator: string;
  readonly publish_gate: string;
  readonly resume_rule: string;
};

export const CHECKLIST_MATRIX: readonly ChecklistMatrixRow[] = [
  {
    phase_id: 'phase_0',
    runtime_phase: 'phase_0',
    sipoc_stage_ref: 'ADJACENT_PHASE_0',
    required_inputs: [],
    required_authority_proof: false,
    output_artifacts: ['phase0_authority_proof_v1'],
    validator: 'assertPhase0AuthorityRegistryMayLoad',
    publish_gate: 'phase0_authority_proof_schema_and_checksum_gate',
    resume_rule: 'resume_from_phase0_authority_proof_v1_when_valid_and_resume_safe',
  },
  {
    phase_id: 'phase_0_5a',
    runtime_phase: 'phase_1a',
    sipoc_stage_ref: 'ADJACENT_PHASE_0_5A',
    required_inputs: ['phase0_authority_proof_v1'],
    required_authority_proof: true,
    output_artifacts: ['story_map_seed_v1', 'evaluation_seed_v1'],
    validator: 'assertStoryMapSeedMayStart',
    publish_gate: 'seed_schema_authority_and_checksum_gate',
    resume_rule: 'resume_from_story_map_seed_v1_when_valid_and_resume_safe',
  },
  {
    phase_id: 'phase_0_5b',
    runtime_phase: 'revise',
    sipoc_stage_ref: 'ADJACENT_PHASE_0_5B',
    required_inputs: ['phase0_authority_proof_v1'],
    required_authority_proof: true,
    output_artifacts: ['revise_opportunity_seed_v1'],
    validator: 'assertReviseOpportunitySeedMayStart',
    publish_gate: 'revise_seed_schema_authority_and_checksum_gate',
    resume_rule: 'resume_from_revise_opportunity_seed_v1_when_valid_and_resume_safe',
  },
  {
    phase_id: 'phase_1a',
    runtime_phase: 'phase_1a',
    sipoc_stage_ref: 'ADJACENT_PHASE_0_5A',
    required_inputs: ['phase0_authority_proof_v1', 'story_map_seed_v1'],
    required_authority_proof: true,
    output_artifacts: ['story_map_verification_v1', 'seed_contradiction_report_v1', 'evidence_index_v1'],
    validator: 'assertPhase1aSeedVerificationMayStart',
    publish_gate: 'seed_verification_evidence_gate',
    resume_rule: 'resume_from_story_map_verification_v1_when_valid_and_resume_safe',
  },
  {
    phase_id: 'pass_3a',
    runtime_phase: 'pass_3a',
    sipoc_stage_ref: 'ADJACENT_PASS_3A',
    required_inputs: ['story_map_verification_v1', 'evidence_index_v1'],
    required_authority_proof: false,
    output_artifacts: ['verified_story_layer_handoff_v1'],
    validator: 'assertPass3aNormalizationMayStart',
    publish_gate: 'verified_story_layer_handoff_gate',
    resume_rule: 'resume_from_verified_story_layer_handoff_v1_when_valid_and_resume_safe',
  },
  {
    phase_id: 'semantic_gate',
    runtime_phase: 'review_gate',
    sipoc_stage_ref: 'ADJACENT_SEMANTIC_GATE',
    required_inputs: ['verified_story_layer_handoff_v1'],
    required_authority_proof: false,
    output_artifacts: ['semantic_gate_result_v1', 'accepted_story_context_v1'],
    validator: 'assertSemanticGateMayStart',
    publish_gate: 'accepted_story_context_semantic_gate',
    resume_rule: 'resume_from_accepted_story_context_v1_when_valid_and_resume_safe',
  },
  {
    phase_id: 'phase_2',
    runtime_phase: 'phase_2',
    sipoc_stage_ref: 'S08_ER2_NORMALIZATION',
    required_inputs: ['accepted_story_context_v1'],
    required_authority_proof: false,
    output_artifacts: ['criteria_evaluation_v1', 'criteria_recommendation_contract_v1', 'pass12_handoff_v1'],
    validator: 'assertPhase2ChecklistPreconditions',
    publish_gate: 'criteria_evaluation_and_pass12_handoff_gate',
    resume_rule: 'resume_from_pass12_handoff_v1_when_valid_and_resume_safe',
  },
  {
    phase_id: 'phase_3',
    runtime_phase: 'phase_3',
    sipoc_stage_ref: 'S07_PASS3',
    required_inputs: ['pass12_handoff_v1'],
    required_authority_proof: false,
    output_artifacts: ['evaluation_synthesis_v1', 'evaluation_result_v2'],
    validator: 'assertPhase3SynthesisMayStart',
    publish_gate: 'evaluation_result_v2_publication_gate',
    resume_rule: 'resume_from_evaluation_result_v2_when_valid_and_resume_safe',
  },
  {
    phase_id: 'llr_quality_gate',
    runtime_phase: 'phase_3',
    sipoc_stage_ref: 'ADJACENT_LLR',
    required_inputs: ['evaluation_result_v2'],
    required_authority_proof: false,
    output_artifacts: ['llr_quality_gate_result_v1', 'llr_recovery_checkpoint_v1'],
    validator: 'assertLlrQualityGateMayStart',
    publish_gate: 'llr_quality_or_recovery_checkpoint_gate',
    resume_rule: 'resume_from_llr_recovery_checkpoint_v1_when_blocked_or_evaluation_result_v2_when_valid',
  },
  {
    phase_id: 'wave',
    runtime_phase: 'wave',
    sipoc_stage_ref: 'ADJACENT_WAVE',
    required_inputs: ['evaluation_result_v2', 'accepted_story_context_v1'],
    required_authority_proof: false,
    output_artifacts: ['wave_readiness_analysis_v1', 'wave_revision_guidance_v1'],
    validator: 'assertWaveMayStart',
    publish_gate: 'wave_readiness_publication_gate',
    resume_rule: 'resume_from_wave_readiness_analysis_v1_when_valid_and_resume_safe',
  },
  {
    phase_id: 'revise_admission',
    runtime_phase: 'revise',
    sipoc_stage_ref: 'ADJACENT_REVISE',
    required_inputs: ['revise_opportunity_seed_v1'],
    required_authority_proof: false,
    output_artifacts: ['revise_admission_result_v1', 'revise_candidate_validation_v1'],
    validator: 'assertReviseAdmissionMayStart',
    publish_gate: 'revise_admission_and_candidate_validation_gate',
    resume_rule: 'resume_from_revise_admission_result_v1_when_valid_and_resume_safe',
  },
  {
    phase_id: 'revise_queue_package',
    runtime_phase: 'revise',
    sipoc_stage_ref: 'ADJACENT_REVISE',
    required_inputs: ['revise_admission_result_v1', 'revise_candidate_validation_v1'],
    required_authority_proof: false,
    output_artifacts: ['revise_queue_package_v1'],
    validator: 'assertReviseQueuePackageMayStart',
    publish_gate: 'author_facing_revise_queue_package_gate',
    resume_rule: 'resume_from_revise_queue_package_v1_when_valid_and_resume_safe',
  },
  {
    phase_id: 'final_render',
    runtime_phase: 'final_render',
    sipoc_stage_ref: 'S11_RENDERER',
    required_inputs: ['evaluation_result_v2'],
    required_authority_proof: false,
    output_artifacts: ['report_render_manifest_v1', 'job_checkpoint_manifest_v1'],
    validator: 'assertFinalRenderMayStart',
    publish_gate: 'report_render_manifest_gate',
    resume_rule: 'resume_render_from_evaluation_result_v2_not_full_pipeline',
  },
] as const;

export function getChecklistRow(phaseId: ChecklistPhaseId): ChecklistMatrixRow {
  const row = CHECKLIST_MATRIX.find((entry) => entry.phase_id === phaseId);
  if (!row) {
    throw new Error(`Unknown checklist phase: ${phaseId}`);
  }
  return row;
}

// ---------------------------------------------------------------------------
// Checklist-as-code SIPOC matrix — single source of truth for artifact flow.
//
// Authority hierarchy: SIPOC docs > this matrix > runtime code.
//   docs/SIPOC_EVALUATION_PROCESS.md
//   docs/phase-0-warmup/SIPOC_INPUT_OUTPUT_QUALITY_GATES.md
//   docs/architecture/phase-architecture-v2.md
//
// Every artifact name listed here MUST correspond to an artifact_type value
// that the runtime code actually persists to evaluation_artifacts.
// Aspirational/planned artifact names belong in docs, not here.
//
// Last reconciled against processor.ts + pass runners: 2026-06-09.
// ---------------------------------------------------------------------------

export const CHECKLIST_ARTIFACT_TYPES = [
  // Phase 0 — Governance Warmup
  'phase0_authority_proof_v1',

  // Phase 0.5a — Story Map + Evaluation Seeds
  'story_map_seed_v1',
  'evaluation_seed_v1',
  'full_context_story_ledger_v1',

  // Phase 0.5b — Editorial DREAM Seed + Revise Opportunity Seed
  'editorial_dream_seed_v1',
  'revise_opportunity_seed_v1',

  // Seed Completeness Gate
  'seed_fit_gap_report_v1',

  // Phase 1a — Chunked Character/Story Extraction
  'pass1a_chunk_cache_v1',
  'pass1a_character_ledger_v1',
  'seed_contradiction_report_v1',
  'pass1a_story_layer_v1',
  'ledger_quality_report_v1',

  // Pass 3A — Preflight Scout (Track C)
  'pass3_preflight_draft_v1',

  // Review Gate
  'accepted_story_ledger_v1',

  // Phase 2 — Pass 1 + Pass 2 Parallel Execution
  'pass1_chunk_cache_v1',
  'pass2_chunk_cache_v1',
  'pass12_handoff_v1',

  // Phase 3 — Synthesis + Quality Gate + Persistence
  'evaluation_result_v2',

  // WAVE — Revision Opportunity Ledger
  'revision_opportunity_ledger_v1',

  // Revise Queue (downstream — populated by revision module)
  'revise_admission_result_v1',
  'revise_candidate_validation_v1',
  'revise_queue_package_v1',

  // Final Render (downstream — populated by renderer module)
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
  'ADJACENT_SEED_COMPLETENESS_GATE',
  'ADJACENT_PASS_3A',
  'ADJACENT_SEMANTIC_GATE',
  'ADJACENT_REVIEW_GATE',
  'ADJACENT_LLR',
  'ADJACENT_REVISION_LEDGER',
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

// ---------------------------------------------------------------------------
// The matrix rows below reflect ACTUAL runtime artifact flow as confirmed by
// processor.ts code trace (2026-06-09).
//
// Artifact names match what code persists to evaluation_artifacts.artifact_type.
// SIPOC doc refs: SIPOC_EVALUATION_PROCESS.md stage contracts.
// Architecture ref: phase-architecture-v2.md canonical lifecycle.
// ---------------------------------------------------------------------------

export const CHECKLIST_MATRIX: readonly ChecklistMatrixRow[] = [
  // ── Phase 0 — Governance Warmup ──────────────────────────────────────
  // SIPOC: ADJACENT_PHASE_0
  // Code: runPhase0GoldPrimer() in processor.ts:5089-5185
  // NOTE: phase0_authority_proof_v1 is specified by SIPOC doc but not yet
  //       persisted as an artifact by the code. Phase 0 success is currently
  //       tracked via evaluation_jobs.progress timestamps only.
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

  // ── Phase 0.5a — Story Map + Evaluation Seeds ────────────────────────
  // SIPOC: ADJACENT_PHASE_0_5A
  // Code: ensureSeedArtifactsForPhase1a() in processor.ts:6418-6502
  //       generateFullContextStoryLedger() in processor.ts:6504-6608
  // Outputs: story_map_seed_v1, evaluation_seed_v1, full_context_story_ledger_v1
  {
    phase_id: 'phase_0_5a',
    runtime_phase: 'phase_1a',
    sipoc_stage_ref: 'ADJACENT_PHASE_0_5A',
    required_inputs: ['phase0_authority_proof_v1'],
    required_authority_proof: true,
    output_artifacts: ['story_map_seed_v1', 'evaluation_seed_v1', 'full_context_story_ledger_v1'],
    validator: 'assertStoryMapSeedMayStart',
    publish_gate: 'seed_schema_authority_and_checksum_gate',
    resume_rule: 'resume_from_story_map_seed_v1_when_valid_and_resume_safe',
  },

  // ── Phase 0.5b — Editorial DREAM Seed + Revise Opportunity Seed ──────
  // SIPOC: ADJACENT_PHASE_0_5B
  // Code: generateEditorialDreamSeed() in processor.ts:6647-6698
  //       generateReviseOpportunitySeed() in phase05bReviseOpportunitySeed.ts
  // Outputs: editorial_dream_seed_v1, revise_opportunity_seed_v1
  {
    phase_id: 'phase_0_5b',
    runtime_phase: 'revise',
    sipoc_stage_ref: 'ADJACENT_PHASE_0_5B',
    required_inputs: ['phase0_authority_proof_v1'],
    required_authority_proof: true,
    output_artifacts: ['editorial_dream_seed_v1', 'revise_opportunity_seed_v1'],
    validator: 'assertReviseOpportunitySeedMayStart',
    publish_gate: 'revise_seed_schema_authority_and_checksum_gate',
    resume_rule: 'resume_from_revise_opportunity_seed_v1_when_valid_and_resume_safe',
  },

  // ── Phase 1a — Chunked Character/Story Extraction ────────────────────
  // SIPOC: ADJACENT_PHASE_0_5A (linked to seed verification)
  // Code: runPass1a() per chunk → reduceCharacterEvidence() →
  //       buildStoryLayerFromLedger() → buildLedgerQualityReport()
  //       in processor.ts:6716-8100
  // Outputs: pass1a_chunk_cache_v1, pass1a_character_ledger_v1,
  //          seed_contradiction_report_v1, pass1a_story_layer_v1,
  //          ledger_quality_report_v1
  {
    phase_id: 'phase_1a',
    runtime_phase: 'phase_1a',
    sipoc_stage_ref: 'ADJACENT_PHASE_0_5A',
    required_inputs: ['phase0_authority_proof_v1', 'story_map_seed_v1'],
    required_authority_proof: true,
    output_artifacts: [
      'pass1a_chunk_cache_v1',
      'pass1a_character_ledger_v1',
      'seed_contradiction_report_v1',
      'pass1a_story_layer_v1',
      'ledger_quality_report_v1',
    ],
    validator: 'assertPhase1aSeedVerificationMayStart',
    publish_gate: 'story_layer_and_ledger_quality_gate',
    resume_rule: 'resume_from_pass1a_story_layer_v1_when_valid_and_resume_safe',
  },

  // ── Pass 3A — Preflight Scout (Track C, parallel with Phase 1a) ──────
  // SIPOC: ADJACENT_PASS_3A
  // Code: runPass3Preflight() in processor.ts:7265-7348
  //       MAP/AGG/REDUCE pipeline in runPass3Preflight.ts
  // Input: manuscript chunks (NOT story layer artifacts — independent reader)
  // Output: pass3_preflight_draft_v1
  {
    phase_id: 'pass_3a',
    runtime_phase: 'pass_3a',
    sipoc_stage_ref: 'ADJACENT_PASS_3A',
    required_inputs: ['story_map_seed_v1'],
    required_authority_proof: false,
    output_artifacts: ['pass3_preflight_draft_v1'],
    validator: 'assertPass3aPrefightMayStart',
    publish_gate: 'pass3_preflight_draft_gate',
    resume_rule: 'resume_from_pass3_preflight_draft_v1_when_valid_and_resume_safe',
  },

  // ── Semantic Gate (Story Layer Quality Gate + Review Gate) ────────────
  // SIPOC: ADJACENT_SEMANTIC_GATE + ADJACENT_REVIEW_GATE
  // Code: buildLedgerQualityReport() → Review Gate handler
  //       in processor.ts:8100-8600
  // Input: pass1a_story_layer_v1, ledger_quality_report_v1, pass3_preflight_draft_v1
  // Output: accepted_story_ledger_v1 (with governance_rail + layer_decisions)
  {
    phase_id: 'semantic_gate',
    runtime_phase: 'review_gate',
    sipoc_stage_ref: 'ADJACENT_SEMANTIC_GATE',
    required_inputs: ['pass1a_story_layer_v1', 'ledger_quality_report_v1'],
    required_authority_proof: false,
    output_artifacts: ['accepted_story_ledger_v1'],
    validator: 'assertSemanticGateAndReviewGateMayStart',
    publish_gate: 'accepted_story_ledger_gate',
    resume_rule: 'resume_from_accepted_story_ledger_v1_when_valid_and_resume_safe',
  },

  // ── Phase 2 — Pass 1 + Pass 2 (Parallel Criteria Analysis) ──────────
  // SIPOC: S05_PASS1, S06_PASS2, S08_ER2_NORMALIZATION
  // Code: runPass1() + runPass2() via Promise.allSettled
  //       aggregateChunkResults() + recoverHandoffRecommendationsFromChunkCache()
  //       in processor.ts:8604-9300+
  // Input: accepted_story_ledger_v1 (governance authority)
  // Outputs: pass1_chunk_cache_v1, pass2_chunk_cache_v1, pass12_handoff_v1
  {
    phase_id: 'phase_2',
    runtime_phase: 'phase_2',
    sipoc_stage_ref: 'S06_PASS2',
    required_inputs: ['accepted_story_ledger_v1'],
    required_authority_proof: false,
    output_artifacts: ['pass1_chunk_cache_v1', 'pass2_chunk_cache_v1', 'pass12_handoff_v1'],
    validator: 'assertPhase2ChecklistPreconditions',
    publish_gate: 'pass12_handoff_and_chunk_cache_gate',
    resume_rule: 'resume_from_pass12_handoff_v1_when_valid_and_resume_safe',
  },

  // ── Phase 3 — Synthesis + Quality Gate + Persistence ─────────────────
  // SIPOC: S07_PASS3, S08_ER2_NORMALIZATION, S09_QUALITYGATEV2, S10_PERSISTENCE
  // Code: runPipeline() → runPass3Synthesis() → runQualityGateV2() →
  //       persistEvaluationResultV2() in processor.ts:5651-6300+
  // Input: pass12_handoff_v1
  // Output: evaluation_result_v2
  // NOTE: quality gate runs INSIDE runPipeline as deterministic validation;
  //       not a separate artifact. See LONG_FORM_PIPELINE_SUCCESS_CONTRACT.md
  //       Clause 8 (QG_FAILED).
  {
    phase_id: 'phase_3',
    runtime_phase: 'phase_3',
    sipoc_stage_ref: 'S07_PASS3',
    required_inputs: ['pass12_handoff_v1'],
    required_authority_proof: false,
    output_artifacts: ['evaluation_result_v2'],
    validator: 'assertPhase3SynthesisMayStart',
    publish_gate: 'evaluation_result_v2_publication_gate',
    resume_rule: 'resume_from_evaluation_result_v2_when_valid_and_resume_safe',
  },

  // ── LLR Quality Gate ─────────────────────────────────────────────────
  // SIPOC: ADJACENT_LLR
  // NOTE: currently runs inline within Phase 3 (runQualityGateV2 inside
  //       runPipeline). No separate artifacts persisted yet.
  //       Future: may produce llr_quality_gate_result_v1 as standalone artifact.
  {
    phase_id: 'llr_quality_gate',
    runtime_phase: 'phase_3',
    sipoc_stage_ref: 'ADJACENT_LLR',
    required_inputs: ['evaluation_result_v2'],
    required_authority_proof: false,
    output_artifacts: [],
    validator: 'assertLlrQualityGateMayStart',
    publish_gate: 'llr_quality_gate_inline_in_phase3',
    resume_rule: 'resume_from_evaluation_result_v2_when_valid_and_resume_safe',
  },

  // ── WAVE — Revision Opportunity Ledger ───────────────────────────────
  // SIPOC: ADJACENT_WAVE, ADJACENT_REVISION_LEDGER
  // Code: processor.ts:10180-10406 (WAVE eligibility check + ledger assembly)
  // Gate: word_count >= 25K AND all 13 criteria >= 6.0 AND CharacterLedgerV2
  // Input: evaluation_result_v2, accepted_story_ledger_v1
  // Output: revision_opportunity_ledger_v1
  {
    phase_id: 'wave',
    runtime_phase: 'wave',
    sipoc_stage_ref: 'ADJACENT_WAVE',
    required_inputs: ['evaluation_result_v2', 'accepted_story_ledger_v1'],
    required_authority_proof: false,
    output_artifacts: ['revision_opportunity_ledger_v1'],
    validator: 'assertWaveMayStart',
    publish_gate: 'revision_opportunity_ledger_gate',
    resume_rule: 'resume_from_revision_opportunity_ledger_v1_when_valid_and_resume_safe',
  },

  // ── Revise Admission ─────────────────────────────────────────────────
  // SIPOC: ADJACENT_REVISE
  // Code: Revise Queue admission handler (consumes revision_opportunity_ledger_v1)
  // Input: revise_opportunity_seed_v1 + revision_opportunity_ledger_v1
  {
    phase_id: 'revise_admission',
    runtime_phase: 'revise',
    sipoc_stage_ref: 'ADJACENT_REVISE',
    required_inputs: ['revision_opportunity_ledger_v1'],
    required_authority_proof: false,
    output_artifacts: ['revise_admission_result_v1', 'revise_candidate_validation_v1'],
    validator: 'assertReviseAdmissionMayStart',
    publish_gate: 'revise_admission_and_candidate_validation_gate',
    resume_rule: 'resume_from_revise_admission_result_v1_when_valid_and_resume_safe',
  },

  // ── Revise Queue Package ─────────────────────────────────────────────
  // SIPOC: ADJACENT_REVISE
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

  // ── Final Render ─────────────────────────────────────────────────────
  // SIPOC: S11_RENDERER
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

import { CRITERIA_KEYS, type CriterionKey } from '@/schemas/criteria-keys';
import { STORY_LAYER_KEYS, type StoryLayerCoreLayerKey } from '@/lib/evaluation/artifacts/artifactTypes';

export type SeedAuthority = 'seed_only';
export type SeedClaimStatus = 'proposed_unverified';
export type SeedEvaluationMode = 'short_form_evaluation' | 'long_form_evaluation' | 'long_form_multi_layer_evaluation';
export type SeedWordCountTier = 'short_under_25k' | 'long_25k_plus' | 'long_multilayer_75k_plus';

export type StorySeedLayerScaffold = {
  layer_key: StoryLayerCoreLayerKey;
  claim_status: SeedClaimStatus;
  baseline_rule: 'phase_1a_must_use_as_story_layer_creation_baseline';
  required_sections: string[];
  phase1a_must_fill: string[];
  phase1a_must_verify: string[];
  mistake_proofing: string[];
};

export type CompleteStorySeedV1 = {
  artifact_type: 'story_map_seed_v1';
  artifact_status: 'created';
  authority: SeedAuthority;
  generated_at: string;
  seed_contract_version: 'seed_scaffold_complete_v1';
  doctrine: 'complete_story_ledger_seed_required_before_phase_1a';
  layer_scaffolds: Record<StoryLayerCoreLayerKey, StorySeedLayerScaffold>;
  global_candidate_inputs: {
    candidate_entity_registry: unknown[];
    candidate_alias_map: Record<string, unknown>;
    candidate_pov_map: unknown[];
    candidate_relationship_map: unknown[];
    candidate_pressure_map: unknown[];
    candidate_object_shortlist: unknown[];
    candidate_location_map: unknown[];
    candidate_timeline_hypotheses: unknown[];
    candidate_narrator_registry: unknown[];
    uncertainty_flags: string[];
  };
  governance_rail: {
    seed_must_be_used_as_phase1a_baseline: true;
    phase1a_must_verify_seed_against_manuscript_evidence: true;
    phase1a_must_record_claim_resolution: true;
    seed_may_authorize_downstream_truth: false;
    accepted_story_ledger_required_for_phase2: true;
  };
};

export type CompleteEvaluationSeedV1 = {
  artifact_type: 'evaluation_seed_v1';
  artifact_status: 'created';
  authority: SeedAuthority;
  generated_at: string;
  seed_contract_version: 'evaluation_seed_complete_v1';
  doctrine: 'complete_evaluation_template_seed_required_before_phase_1a';
  manuscript_profile: {
    word_count: number;
    word_count_tier: SeedWordCountTier;
    evaluation_mode: SeedEvaluationMode;
    work_type: string;
    likely_narrative_complexity: 'unknown' | 'low' | 'moderate' | 'high';
    genre_classification: string[];
  };
  reporting_template_path: {
    selected_template: string;
    short_form_template: 'docs/templates/evaluation/short-form-evaluation-template.md';
    long_form_template: 'docs/templates/evaluation/long-form-multi-layer-evaluation-template.md';
    long_form_multilayer_template: 'docs/templates/evaluation/long-form-multi-layer-evaluation-template.md';
  };
  criterion_scaffolds: Array<{
    criterion_key: CriterionKey;
    claim_status: SeedClaimStatus;
    short_form_template_sections: string[];
    long_form_template_sections: string[];
    phase1a_must_collect: string[];
    mistake_proofing: string[];
  }>;
  hotspot_hypotheses: unknown[];
  revise_density_profile: {
    expected_revision_density: 'unknown' | 'low' | 'moderate' | 'high';
    likely_revision_clusters: string[];
  };
  governance_rail: {
    seed_must_be_used_as_phase1a_evaluation_baseline: true;
    phase1a_must_verify_seed_against_manuscript_evidence: true;
    seed_may_authorize_downstream_truth: false;
    final_craft_scores_forbidden: true;
    final_executive_verdict_forbidden: true;
    accepted_story_ledger_required_for_phase2: true;
  };
};

const commonDisplayMistakeProofing = [
  'Do not show machine chunk labels to authors.',
  'Use manuscript-native display locators: chapter, scene, paragraph, page, or quoted evidence anchor.',
  'Keep machine locators private for traceability only.',
];

const storyLayerDefinitions: Record<StoryLayerCoreLayerKey, Omit<StorySeedLayerScaffold, 'layer_key' | 'claim_status' | 'baseline_rule'>> = {
  source_integrity_layer: {
    required_sections: ['manuscript_health', 'submission_scope', 'author_context_requests', 'hard_fail_triggers'],
    phase1a_must_fill: ['source sufficiency', 'scope confidence', 'extraction risk flags'],
    phase1a_must_verify: ['text availability', 'word count', 'scope classification'],
    mistake_proofing: commonDisplayMistakeProofing,
  },
  pov_structure_layer: {
    required_sections: ['candidate_pov_owners', 'narration_mode', 'focalization_pattern', 'pov_uncertainty_flags'],
    phase1a_must_fill: ['POV owners', 'narrative camera', 'shift pattern'],
    phase1a_must_verify: ['POV evidence anchors', 'omniscient or limited mode', 'rotating focalization'],
    mistake_proofing: commonDisplayMistakeProofing,
  },
  narrator_attribution_layer: {
    required_sections: ['narrator_registry', 'narrator_name_state', 'narrator_evidence_anchors', 'narrator_uncertainty_flags', 'report_reference_guardrails'],
    phase1a_must_fill: ['narrator type', 'narrator name state', 'explicit evidence for any narrator name', 'fallback reference when unnamed'],
    phase1a_must_verify: ['named narrator evidence', 'unnamed narrator state', 'multi-narrator or rotating narrator map', 'theme/object/cost terms are not promoted to narrator identity'],
    mistake_proofing: [
      ...commonDisplayMistakeProofing,
      'Never infer a narrator name from a theme, motif, object, expense/cost term, greeting, yes/no token, or section title.',
      'If no explicit narrator-name evidence exists, downstream reports must say “the narrator” or “the unnamed narrator.”',
      'Narrator names must come only from accepted narrator_attribution_layer evidence; later passes must not re-infer narrator identity.',
    ],
  },
  canonical_identity_layer: {
    required_sections: ['candidate_entities', 'candidate_aliases', 'name_state_warnings', 'merge_split_risks'],
    phase1a_must_fill: ['entity registry', 'alias map', 'merge/split decisions'],
    phase1a_must_verify: ['character existence', 'alias linkage', 'role/name-state boundary'],
    mistake_proofing: commonDisplayMistakeProofing,
  },
  cast_role_tier_layer: {
    required_sections: ['protagonists', 'co_protagonists', 'antagonists', 'major_secondary', 'minor_or_background', 'collectives'],
    phase1a_must_fill: ['role tier', 'structural weight', 'individual versus collective classification'],
    phase1a_must_verify: ['recurrence', 'plot function', 'pressure function'],
    mistake_proofing: commonDisplayMistakeProofing,
  },
  identity_pronoun_layer: {
    required_sections: ['reviewable_pronoun_transitions', 'identity_signal_uncertainties', 'stable_registry_hidden'],
    phase1a_must_fill: ['only transitioning or ambiguous pronoun-family signals'],
    phase1a_must_verify: ['cross-family transition', 'identity transition signal', 'no stable-registry author burden'],
    mistake_proofing: [...commonDisplayMistakeProofing, 'If no reviewable transitions exist, display only a no-reviewable-transition message.'],
  },
  relationship_network_layer: {
    required_sections: ['named_relationships', 'role_stable_unnamed_relationships', 'group_pressures_routed_elsewhere'],
    phase1a_must_fill: ['sustained named-character bonds', 'relationship arc', 'first evidence anchor'],
    phase1a_must_verify: ['named bond', 'sustained recurrence', 'unnamed/group reclassification'],
    mistake_proofing: [...commonDisplayMistakeProofing, 'Do not present one-off unnamed encounters as normal named relationships.'],
  },
  object_symbol_layer: {
    required_sections: ['high_value_symbols', 'scene_props', 'motif_systems', 'ownership_or_association'],
    phase1a_must_fill: ['symbolic weight', 'object trajectory', 'holder/association logic'],
    phase1a_must_verify: ['physical object versus motif', 'symbol recurrence', 'final meaning'],
    mistake_proofing: [...commonDisplayMistakeProofing, 'Do not classify dialogue, evaluation artifacts, or abstract doctrine as physical objects.'],
  },
  location_timeline_worldstate_layer: {
    required_sections: ['canonical_locations', 'movement_paths', 'timeline_sequence', 'world_state_rules'],
    phase1a_must_fill: ['location normalization', 'movement paths', 'active scene versus backstory'],
    phase1a_must_verify: ['duplicate locations', 'scene order', 'environmental rules'],
    mistake_proofing: commonDisplayMistakeProofing,
  },
  threat_antagonist_ending_layer: {
    required_sections: ['individual_antagonists', 'group_pressures', 'environmental_pressures', 'biological_pressures', 'internal_pressures', 'terminal_states', 'ending_accountability'],
    phase1a_must_fill: ['pressure systems', 'threat vectors', 'terminal states', 'ending accountability'],
    phase1a_must_verify: ['individual versus system pressure', 'terminal state evidence', 'unresolved consequences'],
    mistake_proofing: commonDisplayMistakeProofing,
  },
};

export function deriveSeedEvaluationMode(wordCount: number, forceMultiLayer = false): SeedEvaluationMode {
  if (forceMultiLayer || wordCount >= 75000) return 'long_form_multi_layer_evaluation';
  // Contract-aligned routing: all new 25k+ submissions use long_form_multi_layer_evaluation.
  // long_form_evaluation remains in the type union for historical artifact compatibility only.
  if (wordCount >= 25000) return 'long_form_multi_layer_evaluation';
  return 'short_form_evaluation';
}

export function deriveSeedWordCountTier(wordCount: number, forceMultiLayer = false): SeedWordCountTier {
  if (forceMultiLayer || wordCount >= 75000) return 'long_multilayer_75k_plus';
  if (wordCount >= 25000) return 'long_25k_plus';
  return 'short_under_25k';
}

export function buildCompleteStorySeedV1(args: { generatedAt?: string }): CompleteStorySeedV1 {
  const layer_scaffolds = Object.fromEntries(STORY_LAYER_KEYS.map((layer_key) => [
    layer_key,
    {
      layer_key,
      claim_status: 'proposed_unverified' as const,
      baseline_rule: 'phase_1a_must_use_as_story_layer_creation_baseline' as const,
      ...storyLayerDefinitions[layer_key],
    },
  ])) as Record<StoryLayerCoreLayerKey, StorySeedLayerScaffold>;

  return {
    artifact_type: 'story_map_seed_v1',
    artifact_status: 'created',
    authority: 'seed_only',
    generated_at: args.generatedAt ?? new Date().toISOString(),
    seed_contract_version: 'seed_scaffold_complete_v1',
    doctrine: 'complete_story_ledger_seed_required_before_phase_1a',
    layer_scaffolds,
    global_candidate_inputs: {
      candidate_entity_registry: [],
      candidate_alias_map: {},
      candidate_pov_map: [],
      candidate_relationship_map: [],
      candidate_pressure_map: [],
      candidate_object_shortlist: [],
      candidate_location_map: [],
      candidate_timeline_hypotheses: [],
      candidate_narrator_registry: [],
      uncertainty_flags: [],
    },
    governance_rail: {
      seed_must_be_used_as_phase1a_baseline: true,
      phase1a_must_verify_seed_against_manuscript_evidence: true,
      phase1a_must_record_claim_resolution: true,
      seed_may_authorize_downstream_truth: false,
      accepted_story_ledger_required_for_phase2: true,
    },
  };
}

export function buildCompleteEvaluationSeedV1(args: { wordCount: number; workType?: string | null; generatedAt?: string; forceMultiLayer?: boolean }): CompleteEvaluationSeedV1 {
  const evaluationMode = deriveSeedEvaluationMode(args.wordCount, args.forceMultiLayer);
  const selected_template = evaluationMode === 'short_form_evaluation'
    ? 'docs/templates/evaluation/short-form-evaluation-template.md'
    : 'docs/templates/evaluation/long-form-multi-layer-evaluation-template.md';

  return {
    artifact_type: 'evaluation_seed_v1',
    artifact_status: 'created',
    authority: 'seed_only',
    generated_at: args.generatedAt ?? new Date().toISOString(),
    seed_contract_version: 'evaluation_seed_complete_v1',
    doctrine: 'complete_evaluation_template_seed_required_before_phase_1a',
    manuscript_profile: {
      word_count: args.wordCount,
      word_count_tier: deriveSeedWordCountTier(args.wordCount, args.forceMultiLayer),
      evaluation_mode: evaluationMode,
      work_type: args.workType?.trim() || 'unknown',
      likely_narrative_complexity: 'unknown',
      genre_classification: [],
    },
    reporting_template_path: {
      selected_template,
      short_form_template: 'docs/templates/evaluation/short-form-evaluation-template.md',
      long_form_template: 'docs/templates/evaluation/long-form-multi-layer-evaluation-template.md',
      long_form_multilayer_template: 'docs/templates/evaluation/long-form-multi-layer-evaluation-template.md',
    },
    criterion_scaffolds: CRITERIA_KEYS.map((criterion_key) => ({
      criterion_key,
      claim_status: 'proposed_unverified',
      short_form_template_sections: ['evidence', 'diagnosis', 'reader_effect', 'repair_direction'],
      long_form_template_sections: ['evidence', 'diagnosis', 'cross_layer_dependency', 'revision_opportunity_seed', 'readiness_implication'],
      phase1a_must_collect: ['quoted evidence anchor', 'manuscript-native location', 'criterion-specific signal'],
      mistake_proofing: ['No final score in seed.', 'No final verdict in seed.', 'No unanchored craft diagnosis in seed.'],
    })),
    hotspot_hypotheses: [],
    revise_density_profile: {
      expected_revision_density: 'unknown',
      likely_revision_clusters: [],
    },
    governance_rail: {
      seed_must_be_used_as_phase1a_evaluation_baseline: true,
      phase1a_must_verify_seed_against_manuscript_evidence: true,
      seed_may_authorize_downstream_truth: false,
      final_craft_scores_forbidden: true,
      final_executive_verdict_forbidden: true,
      accepted_story_ledger_required_for_phase2: true,
    },
  };
}

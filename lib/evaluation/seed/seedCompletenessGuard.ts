import { CRITERIA_KEYS, type CriterionKey } from '@/schemas/criteria-keys';
import { STORY_LAYER_KEYS, type StoryLayerCoreLayerKey } from '@/lib/evaluation/artifacts/artifactTypes';

export const SEED_FIT_GAP_REPORT_TYPE = 'seed_fit_gap_report_v1' as const;

export type SeedArtifactType = 'story_seed_v1' | 'evaluation_seed_v1';
export type SeedGapSeverity = 'blocker' | 'warning';

export type SeedFitGap = {
  artifact_type: SeedArtifactType;
  section: string;
  severity: SeedGapSeverity;
  message: string;
  required_action: string;
};

export type SeedFitGapReportV1 = {
  artifact_type: typeof SEED_FIT_GAP_REPORT_TYPE;
  status: 'blocked' | 'passed';
  generated_at: string;
  doctrine: 'complete_seed_artifacts_required_before_phase_1a';
  gaps: SeedFitGap[];
};

export type StorySeedV1Minimum = {
  artifact_type: 'story_seed_v1';
  authority: 'seed_only';
  artifact_status: string;
  layer_scaffolds?: Partial<Record<StoryLayerCoreLayerKey, unknown>>;
  global_candidate_inputs?: {
    candidate_entity_registry?: unknown;
    candidate_alias_map?: unknown;
    candidate_pov_map?: unknown;
    candidate_relationship_map?: unknown;
    candidate_pressure_map?: unknown;
    candidate_object_shortlist?: unknown;
    candidate_location_map?: unknown;
    candidate_timeline_hypotheses?: unknown;
    uncertainty_flags?: unknown;
  };
  governance_rail?: {
    seed_must_be_used_as_phase1a_baseline?: unknown;
    phase1a_must_verify_seed_against_manuscript_evidence?: unknown;
    seed_may_authorize_downstream_truth?: unknown;
    accepted_story_ledger_required_for_phase2?: unknown;
  };
};

export type EvaluationSeedV1Minimum = {
  artifact_type: 'evaluation_seed_v1';
  authority: 'seed_only';
  artifact_status: string;
  manuscript_profile?: {
    word_count?: unknown;
    word_count_tier?: unknown;
    evaluation_mode?: unknown;
    work_type?: unknown;
  };
  reporting_template_path?: {
    selected_template?: unknown;
    short_form_template?: unknown;
    long_form_template?: unknown;
    long_form_multilayer_template?: unknown;
  };
  criterion_scaffolds?: Array<{ criterion_key?: CriterionKey | string }>;
  governance_rail?: {
    seed_must_be_used_as_phase1a_evaluation_baseline?: unknown;
    phase1a_must_verify_seed_against_manuscript_evidence?: unknown;
    seed_may_authorize_downstream_truth?: unknown;
    final_craft_scores_forbidden?: unknown;
    final_executive_verdict_forbidden?: unknown;
    accepted_story_ledger_required_for_phase2?: unknown;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(record: unknown, key: string): boolean {
  return isRecord(record) && Object.prototype.hasOwnProperty.call(record, key);
}

function pushGap(gaps: SeedFitGap[], artifact_type: SeedArtifactType, section: string, message: string, required_action: string): void {
  gaps.push({ artifact_type, section, severity: 'blocker', message, required_action });
}

export function validateStorySeedCompleteness(seed: unknown): SeedFitGap[] {
  const gaps: SeedFitGap[] = [];
  const artifact = seed as Partial<StorySeedV1Minimum> | null;

  if (!isRecord(seed)) {
    pushGap(gaps, 'story_seed_v1', 'artifact', 'story_seed_v1 is missing or not an object.', 'Regenerate a complete story_seed_v1.');
    return gaps;
  }

  if (artifact.artifact_type !== 'story_seed_v1') pushGap(gaps, 'story_seed_v1', 'artifact_type', 'Wrong or missing artifact_type.', 'Set artifact_type to story_seed_v1.');
  if (artifact.authority !== 'seed_only') pushGap(gaps, 'story_seed_v1', 'authority', 'Seed authority must be seed_only.', 'Regenerate with authority=seed_only.');

  if (!isRecord(artifact.layer_scaffolds)) {
    pushGap(gaps, 'story_seed_v1', 'layer_scaffolds', 'Missing complete Story Ledger layer scaffolds.', 'Create scaffolds for all 9 Story Ledger layers.');
  } else {
    for (const layerKey of STORY_LAYER_KEYS) {
      if (!hasOwn(artifact.layer_scaffolds, layerKey)) {
        pushGap(gaps, 'story_seed_v1', `layer_scaffolds.${layerKey}`, `Missing scaffold for ${layerKey}.`, 'Seed must include every Story Ledger layer before Phase 1A.');
      }
    }
  }

  const inputs = artifact.global_candidate_inputs;
  const requiredInputs = [
    'candidate_entity_registry',
    'candidate_alias_map',
    'candidate_pov_map',
    'candidate_relationship_map',
    'candidate_pressure_map',
    'candidate_object_shortlist',
    'candidate_location_map',
    'candidate_timeline_hypotheses',
    'uncertainty_flags',
  ];
  for (const key of requiredInputs) {
    if (!hasOwn(inputs, key)) pushGap(gaps, 'story_seed_v1', `global_candidate_inputs.${key}`, `Missing ${key}.`, 'Regenerate story seed with all candidate input collections.');
  }

  const rail = artifact.governance_rail;
  if (rail?.seed_must_be_used_as_phase1a_baseline !== true) pushGap(gaps, 'story_seed_v1', 'governance_rail.seed_must_be_used_as_phase1a_baseline', 'Story seed must be mandatory Phase 1A baseline.', 'Set true and enforce before chunk extraction.');
  if (rail?.phase1a_must_verify_seed_against_manuscript_evidence !== true) pushGap(gaps, 'story_seed_v1', 'governance_rail.phase1a_must_verify_seed_against_manuscript_evidence', 'Phase 1A verification must be mandatory.', 'Set true and record claim resolution.');
  if (rail?.seed_may_authorize_downstream_truth !== false) pushGap(gaps, 'story_seed_v1', 'governance_rail.seed_may_authorize_downstream_truth', 'Seed must never authorize downstream truth.', 'Set false.');
  if (rail?.accepted_story_ledger_required_for_phase2 !== true) pushGap(gaps, 'story_seed_v1', 'governance_rail.accepted_story_ledger_required_for_phase2', 'Phase 2 must require accepted_story_ledger_v1.', 'Set true and enforce Phase 2 gate.');

  return gaps;
}

export function validateEvaluationSeedCompleteness(seed: unknown): SeedFitGap[] {
  const gaps: SeedFitGap[] = [];
  const artifact = seed as Partial<EvaluationSeedV1Minimum> | null;

  if (!isRecord(seed)) {
    pushGap(gaps, 'evaluation_seed_v1', 'artifact', 'evaluation_seed_v1 is missing or not an object.', 'Regenerate a complete evaluation_seed_v1.');
    return gaps;
  }

  if (artifact.artifact_type !== 'evaluation_seed_v1') pushGap(gaps, 'evaluation_seed_v1', 'artifact_type', 'Wrong or missing artifact_type.', 'Set artifact_type to evaluation_seed_v1.');
  if (artifact.authority !== 'seed_only') pushGap(gaps, 'evaluation_seed_v1', 'authority', 'Seed authority must be seed_only.', 'Regenerate with authority=seed_only.');

  const profile = artifact.manuscript_profile;
  for (const key of ['word_count', 'word_count_tier', 'evaluation_mode', 'work_type']) {
    if (!hasOwn(profile, key)) pushGap(gaps, 'evaluation_seed_v1', `manuscript_profile.${key}`, `Missing ${key}.`, 'Evaluation seed must route short/long/multilayer mode before Phase 1A.');
  }

  const templates = artifact.reporting_template_path;
  for (const key of ['selected_template', 'short_form_template', 'long_form_template', 'long_form_multilayer_template']) {
    if (!hasOwn(templates, key)) pushGap(gaps, 'evaluation_seed_v1', `reporting_template_path.${key}`, `Missing ${key}.`, 'Evaluation seed must carry polished short and long-form template paths.');
  }

  const criteria = Array.isArray(artifact.criterion_scaffolds) ? artifact.criterion_scaffolds : [];
  const present = new Set(criteria.map((item) => item.criterion_key));
  for (const key of CRITERIA_KEYS) {
    if (!present.has(key)) pushGap(gaps, 'evaluation_seed_v1', `criterion_scaffolds.${key}`, `Missing criterion scaffold for ${key}.`, 'Evaluation seed must scaffold all 13 criteria.');
  }

  const rail = artifact.governance_rail;
  if (rail?.seed_must_be_used_as_phase1a_evaluation_baseline !== true) pushGap(gaps, 'evaluation_seed_v1', 'governance_rail.seed_must_be_used_as_phase1a_evaluation_baseline', 'Evaluation seed must be mandatory Phase 1A baseline.', 'Set true and enforce before evaluation evidence extraction.');
  if (rail?.phase1a_must_verify_seed_against_manuscript_evidence !== true) pushGap(gaps, 'evaluation_seed_v1', 'governance_rail.phase1a_must_verify_seed_against_manuscript_evidence', 'Phase 1A verification must be mandatory.', 'Set true and record fit-gap.');
  if (rail?.seed_may_authorize_downstream_truth !== false) pushGap(gaps, 'evaluation_seed_v1', 'governance_rail.seed_may_authorize_downstream_truth', 'Seed must never authorize downstream truth.', 'Set false.');
  if (rail?.final_craft_scores_forbidden !== true) pushGap(gaps, 'evaluation_seed_v1', 'governance_rail.final_craft_scores_forbidden', 'Seed must not contain final craft scores.', 'Set true and reject scored seed artifacts.');
  if (rail?.final_executive_verdict_forbidden !== true) pushGap(gaps, 'evaluation_seed_v1', 'governance_rail.final_executive_verdict_forbidden', 'Seed must not contain final executive verdict.', 'Set true and reject verdict-bearing seed artifacts.');
  if (rail?.accepted_story_ledger_required_for_phase2 !== true) pushGap(gaps, 'evaluation_seed_v1', 'governance_rail.accepted_story_ledger_required_for_phase2', 'Phase 2 must require accepted_story_ledger_v1.', 'Set true and enforce Phase 2 gate.');

  return gaps;
}

export function buildSeedFitGapReport(args: { storySeed: unknown; evaluationSeed: unknown; generatedAt?: string }): SeedFitGapReportV1 {
  const gaps = [
    ...validateStorySeedCompleteness(args.storySeed),
    ...validateEvaluationSeedCompleteness(args.evaluationSeed),
  ];
  return {
    artifact_type: SEED_FIT_GAP_REPORT_TYPE,
    status: gaps.length > 0 ? 'blocked' : 'passed',
    generated_at: args.generatedAt ?? new Date().toISOString(),
    doctrine: 'complete_seed_artifacts_required_before_phase_1a',
    gaps,
  };
}

export function assertSeedsCompleteForPhase1a(args: { storySeed: unknown; evaluationSeed: unknown }): void {
  const report = buildSeedFitGapReport(args);
  if (report.status === 'blocked') {
    const summary = report.gaps.map((gap) => `${gap.artifact_type}:${gap.section}`).join(', ');
    throw new Error(`SEED_FIT_GAP_BLOCKED: ${summary}`);
  }
}

import { STORY_LAYER_KEYS } from '@/lib/evaluation/artifacts/artifactTypes';
import { CRITERIA_KEYS } from '@/schemas/criteria-keys';
import {
  buildSeedFitGapReport,
  validateEvaluationSeedCompleteness,
  validateStorySeedCompleteness,
} from '@/lib/evaluation/seed/seedCompletenessGuard';

const storySeed = () => ({
  artifact_type: 'story_seed_v1',
  authority: 'seed_only',
  artifact_status: 'created',
  layer_scaffolds: Object.fromEntries(STORY_LAYER_KEYS.map((layer) => [layer, {}])),
  global_candidate_inputs: {
    candidate_entity_registry: [],
    candidate_alias_map: {},
    candidate_pov_map: [],
    candidate_relationship_map: [],
    candidate_pressure_map: [],
    candidate_object_shortlist: [],
    candidate_location_map: [],
    candidate_timeline_hypotheses: [],
    uncertainty_flags: [],
  },
  governance_rail: {
    seed_must_be_used_as_phase1a_baseline: true,
    phase1a_must_verify_seed_against_manuscript_evidence: true,
    seed_may_authorize_downstream_truth: false,
    accepted_story_ledger_required_for_phase2: true,
  },
});

const evaluationSeed = () => ({
  artifact_type: 'evaluation_seed_v1',
  authority: 'seed_only',
  artifact_status: 'created',
  manuscript_profile: {
    word_count: 12000,
    word_count_tier: 'short_under_25k',
    evaluation_mode: 'short_form_evaluation',
    work_type: 'novella',
  },
  reporting_template_path: {
    selected_template: 'templates/evaluation/short-form-13-criteria-v1',
    short_form_template: 'templates/evaluation/short-form-13-criteria-v1',
    long_form_template: 'templates/evaluation/long-form-v1',
    long_form_multilayer_template: 'templates/evaluation/long-form-multilayer-v1',
  },
  criterion_scaffolds: CRITERIA_KEYS.map((criterion_key) => ({ criterion_key })),
  governance_rail: {
    seed_must_be_used_as_phase1a_evaluation_baseline: true,
    phase1a_must_verify_seed_against_manuscript_evidence: true,
    seed_may_authorize_downstream_truth: false,
    final_craft_scores_forbidden: true,
    final_executive_verdict_forbidden: true,
    accepted_story_ledger_required_for_phase2: true,
  },
});

describe('seedCompletenessGuard minimal contract', () => {
  it('blocks generic story seeds that lack layer scaffolds', () => {
    const gaps = validateStorySeedCompleteness({ artifact_type: 'story_seed_v1', authority: 'seed_only' });
    expect(gaps.some((gap) => gap.section === 'layer_scaffolds')).toBe(true);
  });

  it('blocks generic evaluation seeds that lack criteria and template routing', () => {
    const gaps = validateEvaluationSeedCompleteness({ artifact_type: 'evaluation_seed_v1', authority: 'seed_only' });
    expect(gaps.some((gap) => gap.section === 'manuscript_profile.word_count')).toBe(true);
    expect(gaps.some((gap) => gap.section === 'reporting_template_path.selected_template')).toBe(true);
    expect(gaps.some((gap) => gap.section === 'criterion_scaffolds.marketability')).toBe(true);
  });

  it('passes only when both required seeds are complete', () => {
    const report = buildSeedFitGapReport({ storySeed: storySeed(), evaluationSeed: evaluationSeed() });
    expect(report.status).toBe('passed');
    expect(report.gaps).toHaveLength(0);
  });
});

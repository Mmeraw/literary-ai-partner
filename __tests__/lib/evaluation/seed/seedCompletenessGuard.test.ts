import { CRITERIA_KEYS } from '@/schemas/criteria-keys';
import { STORY_LAYER_KEYS } from '@/lib/evaluation/artifacts/artifactTypes';
import {
  SeedFitGapBlockedError,
  assertSeedsCompleteForPhase1a,
  buildSeedFitGapReport,
  validateEvaluationSeedCompleteness,
  validateStorySeedCompleteness,
} from '@/lib/evaluation/seed/seedCompletenessGuard';

const filledLayerScaffold = (layer: string) => ({
  baseline_expectation: `${layer} must be verified against manuscript evidence`,
  required_verification_targets: [`${layer}:target`],
  required_sections: [`${layer}:section`],
  phase1a_must_fill: [`${layer}:fill`],
  phase1a_must_verify: [`${layer}:verify`],
  mistake_proofing: [`${layer}:do_not_assume`],
  baseline_rule: 'phase_1a_must_use_as_story_layer_creation_baseline' as const,
});

function completeStorySeed() {
  return {
    artifact_type: 'story_map_seed_v1',
    authority: 'seed_only',
    artifact_status: 'created',
    layer_scaffolds: Object.fromEntries(STORY_LAYER_KEYS.map((layer) => [layer, filledLayerScaffold(layer)])),
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
  };
}

function completeEvaluationSeed() {
  return {
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
      selected_template: 'docs/templates/evaluation/short-form-evaluation-template.md',
      short_form_template: 'docs/templates/evaluation/short-form-evaluation-template.md',
      long_form_template: 'docs/templates/evaluation/long-form-evaluation-template.md',
      long_form_multilayer_template: 'docs/templates/evaluation/long-form-multi-layer-evaluation-template.md',
    },
    criterion_scaffolds: CRITERIA_KEYS.map((criterion_key) => ({
      criterion_key,
      baseline_expectation: `${criterion_key} must be evidence-backed`,
      short_form_template_sections: [`${criterion_key}:short`],
      long_form_template_sections: [`${criterion_key}:long`],
      phase1a_must_collect: [`${criterion_key}:collect`],
      mistake_proofing: [`${criterion_key}:mp`],
    })),
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

describe('seedCompletenessGuard', () => {
  it('passes complete story and evaluation seeds', () => {
    const report = buildSeedFitGapReport({
      storySeed: completeStorySeed(),
      evaluationSeed: completeEvaluationSeed(),
      generatedAt: '2026-05-31T00:00:00.000Z',
    });

    expect(report.status).toBe('passed');
    expect(report.gaps).toEqual([]);
  });

  it('blocks missing, empty, and malformed Story Ledger scaffolds', () => {
    const seed = completeStorySeed();
    seed.layer_scaffolds[STORY_LAYER_KEYS[0]] = {};
    seed.layer_scaffolds[STORY_LAYER_KEYS[1]] = null;
    delete seed.layer_scaffolds[STORY_LAYER_KEYS[2]];

    const gaps = validateStorySeedCompleteness(seed);

    expect(gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ section: `layer_scaffolds.${STORY_LAYER_KEYS[0]}` }),
      expect.objectContaining({ section: `layer_scaffolds.${STORY_LAYER_KEYS[1]}` }),
      expect.objectContaining({ section: `layer_scaffolds.${STORY_LAYER_KEYS[2]}` }),
    ]));
  });

  it('blocks malformed candidate input collections', () => {
    const seed = completeStorySeed();
    seed.global_candidate_inputs.candidate_entity_registry = {};
    seed.global_candidate_inputs.candidate_alias_map = [];

    const gaps = validateStorySeedCompleteness(seed);

    expect(gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ section: 'global_candidate_inputs.candidate_entity_registry' }),
      expect.objectContaining({ section: 'global_candidate_inputs.candidate_alias_map' }),
    ]));
  });

  it('blocks malformed criterion scaffold items instead of crashing', () => {
    const seed = completeEvaluationSeed();
    seed.criterion_scaffolds = [null, 'bad', { criterion_key: CRITERIA_KEYS[0] }];

    const gaps = validateEvaluationSeedCompleteness(seed);

    expect(gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ section: 'criterion_scaffolds.malformed' }),
      expect.objectContaining({ section: `criterion_scaffolds.${CRITERIA_KEYS[1]}` }),
    ]));
  });

  it('throws a typed block error with the full seed_fit_gap_report_v1 attached', () => {
    expect(() => assertSeedsCompleteForPhase1a({
      storySeed: { artifact_type: 'story_map_seed_v1', authority: 'seed_only' },
      evaluationSeed: completeEvaluationSeed(),
    })).toThrow(SeedFitGapBlockedError);

    try {
      assertSeedsCompleteForPhase1a({
        storySeed: { artifact_type: 'story_map_seed_v1', authority: 'seed_only' },
        evaluationSeed: completeEvaluationSeed(),
      });
      throw new Error('expected block');
    } catch (error) {
      expect(error).toBeInstanceOf(SeedFitGapBlockedError);
      expect((error as SeedFitGapBlockedError).report.artifact_type).toBe('seed_fit_gap_report_v1');
      expect((error as SeedFitGapBlockedError).report.status).toBe('blocked');
      expect((error as SeedFitGapBlockedError).report.gaps.length).toBeGreaterThan(0);
    }
  });
});

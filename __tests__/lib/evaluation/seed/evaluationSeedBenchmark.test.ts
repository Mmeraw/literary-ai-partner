import {
  buildEvaluationSeedBenchmark,
  scoreStoryLedgerQuality,
  validateEvaluationSeedRun,
  type EvaluationSeedBenchmarkRun,
  type SeedArtifact,
  type StoryLedgerGoldExpectation,
} from '../../../../lib/evaluation/seed/evaluationSeedBenchmark';

const gold: StoryLedgerGoldExpectation = {
  required_character_ids: ['aw:edna', 'aw:robert', 'aw:leonce'],
  required_aliases_by_character_id: {
    'aw:edna': ['Edna Pontellier'],
    'aw:robert': ['Robert Lebrun'],
    'aw:leonce': ['Léonce Pontellier'],
  },
  required_pov_character_ids: ['aw:edna'],
  forbidden_pov_character_ids: ['aw:robert', 'aw:leonce'],
  required_pressure_needles: ['léonce', 'robert', 'sea', 'creole social expectations'],
  required_relationship_pair_keys: ['aw:edna↔aw:robert', 'aw:edna↔aw:leonce'],
  required_location_needles: ['grand isle', 'new orleans'],
};

function seedArtifact(type: 'story_map_seed_v1' | 'evaluation_seed_v1'): SeedArtifact {
  return {
    artifact_type: type,
    authority: 'seed_only',
    artifact_status: 'created',
    claims: [
      {
        claim_id: `${type}:edna`,
        claim_status: 'confirmed_by_evidence',
        hypothesis: 'Edna appears to be the governing focal center.',
        temp_seed_entity_id: 'temp_seed_entity_edna',
        evidence_coordinates: ['chapter:1'],
      },
      {
        claim_id: `${type}:robert`,
        claim_status: 'drift_detected',
        hypothesis: 'Robert may be over-weighted by early extraction.',
        temp_seed_entity_id: 'temp_seed_entity_robert',
        evidence_coordinates: ['chapter:2'],
      },
      {
        claim_id: `${type}:false-pressure`,
        claim_status: 'invalidated',
        hypothesis: 'A minor visitor may be a central antagonist.',
      },
    ],
  };
}

const completeArtifacts = {
  chunk_evidence_index_v1: { chunks: [{ id: 'chunk:1', evidence_count: 3 }] },
  pass12_handoff_v1: { artifact_type: 'pass12_handoff_v1' },
  evaluation_result_v2: { artifact_type: 'evaluation_result_v2' },
};

const weakBaselineLedger = {
  layers: {
    canonical_identity_layer: {
      identity_groups: [
        {
          character_id: 'aw:edna',
          canonical_name: 'Edna Pontellier',
          aliases: ['Mrs. Pontellier'],
          evidence_coordinates: ['chapter:1'],
        },
        {
          character_id: 'aw:robert',
          canonical_name: 'Robert Lebrun',
          aliases: [],
          evidence_coordinates: ['chapter:2'],
        },
      ],
    },
    pov_structure_layer: {
      pov_characters: [
        { character_id: 'aw:edna', canonical_name: 'Edna Pontellier', evidence_coordinates: ['chapter:1'] },
        { character_id: 'aw:robert', canonical_name: 'Robert Lebrun', evidence_coordinates: ['chapter:2'] },
      ],
    },
    threat_antagonist_ending_layer: {
      pressure_systems: [
        { source_label: 'Robert', pressure_type: 'romantic_destabilizer', source_kind: 'character', evidence_coordinates: ['chapter:8'] },
      ],
    },
    relationship_network_layer: {
      relationship_pairs: [
        { character_a: 'aw:edna', character_b: 'aw:robert', evidence_coordinates: ['chapter:8'] },
      ],
    },
    location_timeline_worldstate_layer: {
      unique_locations: ['Grand Isle'],
    },
  },
};

const improvedSeedLedger = {
  layers: {
    canonical_identity_layer: {
      identity_groups: [
        {
          character_id: 'aw:edna',
          canonical_name: 'Edna Pontellier',
          aliases: ['Edna Pontellier', 'Mrs. Pontellier'],
          evidence_coordinates: ['chapter:1'],
        },
        {
          character_id: 'aw:robert',
          canonical_name: 'Robert Lebrun',
          aliases: ['Robert Lebrun'],
          evidence_coordinates: ['chapter:2'],
        },
        {
          character_id: 'aw:leonce',
          canonical_name: 'Léonce Pontellier',
          aliases: ['Léonce Pontellier', 'Mr. Pontellier'],
          evidence_coordinates: ['chapter:3'],
        },
      ],
    },
    pov_structure_layer: {
      pov_characters: [
        { character_id: 'aw:edna', canonical_name: 'Edna Pontellier', evidence_coordinates: ['chapter:1'] },
      ],
    },
    threat_antagonist_ending_layer: {
      pressure_systems: [
        { source_label: 'Léonce', pressure_type: 'marital_property_pressure', source_kind: 'character', evidence_coordinates: ['chapter:3'] },
        { source_label: 'Robert', pressure_type: 'romantic_destabilizer', source_kind: 'character', evidence_coordinates: ['chapter:8'] },
        { source_label: 'Sea / Gulf', pressure_type: 'symbolic_non_character_pressure', source_kind: 'non_character', evidence_coordinates: ['chapter:39'] },
        { source_label: 'Creole social expectations', pressure_type: 'social_code_pressure', source_kind: 'institutional', evidence_coordinates: ['chapter:1'] },
      ],
    },
    relationship_network_layer: {
      relationship_pairs: [
        { character_a: 'aw:edna', character_b: 'aw:robert', evidence_coordinates: ['chapter:8'] },
        { character_a: 'aw:edna', character_b: 'aw:leonce', evidence_coordinates: ['chapter:3'] },
      ],
    },
    location_timeline_worldstate_layer: {
      unique_locations: ['Grand Isle', 'New Orleans'],
    },
  },
};

const harmfulSeedLedger = {
  ...improvedSeedLedger,
  layers: {
    ...improvedSeedLedger.layers,
    canonical_identity_layer: {
      identity_groups: [
        ...improvedSeedLedger.layers.canonical_identity_layer.identity_groups,
        {
          character_id: 'aw:seed_ghost',
          canonical_name: 'Seed Ghost',
          authority: 'seed_only',
          source_artifact_type: 'story_map_seed_v1',
        },
      ],
    },
  },
};

function benchmarkRun(overrides: Partial<EvaluationSeedBenchmarkRun>): EvaluationSeedBenchmarkRun {
  return {
    run_id: 'run:baseline',
    job_id: 'job:seed-benchmark',
    manuscript_id: 7307,
    word_count: 38100,
    evaluation_mode: 'long_form_multi_layer_evaluation',
    total_ms: 100_000,
    artifacts: {
      ...completeArtifacts,
      accepted_story_ledger_v1: weakBaselineLedger,
    },
    ...overrides,
  };
}

describe('evaluation_seed_benchmark_v1 harness', () => {
  it('scores Story Ledger quality with required truths and forbidden failures', () => {
    const baselineScore = scoreStoryLedgerQuality(weakBaselineLedger, gold);
    const seedScore = scoreStoryLedgerQuality(improvedSeedLedger, gold);

    expect(seedScore.total_score).toBeGreaterThan(baselineScore.total_score);
    expect(baselineScore.forbidden_failures).toEqual(
      expect.arrayContaining(["FORBIDDEN_FAILURE: 'aw:robert' must not be a POV owner."]),
    );
    expect(seedScore.missing_required_truths).toEqual([]);
    expect(seedScore.forbidden_failures).toEqual([]);
  });

  it('builds the baseline-vs-SEED comparison artifact and recommends SEED when quality improves within latency tolerance', () => {
    const baseline = benchmarkRun({ run_id: 'run:baseline' });
    const seed = benchmarkRun({
      run_id: 'run:seed',
      total_ms: 112_000,
      artifacts: {
        ...completeArtifacts,
        story_map_seed_v1: seedArtifact('story_map_seed_v1'),
        evaluation_seed_v1: seedArtifact('evaluation_seed_v1'),
        accepted_story_ledger_v1: improvedSeedLedger,
      },
    });

    const artifact = buildEvaluationSeedBenchmark({ baseline, seed, gold });

    expect(artifact.artifact_type).toBe('evaluation_seed_benchmark_v1');
    expect(artifact.ledger_quality_delta).toBeGreaterThan(0);
    expect(artifact.latency_delta_ms).toBe(12_000);
    expect(artifact.seed_claims_confirmed).toBe(2);
    expect(artifact.seed_claims_invalidated).toBe(2);
    expect(artifact.seed_claims_drifted).toBe(2);
    expect(artifact.path_issues).toEqual([]);
    expect(artifact.recommendation).toBe('seed_improves_quality_but_costs_latency');
  });

  it('preserves negative quality deltas and disables harmful SEED runs', () => {
    const baseline = benchmarkRun({
      run_id: 'run:baseline',
      artifacts: {
        ...completeArtifacts,
        accepted_story_ledger_v1: improvedSeedLedger,
      },
    });
    const seed = benchmarkRun({
      run_id: 'run:seed-harmful',
      total_ms: 90_000,
      artifacts: {
        ...completeArtifacts,
        story_map_seed_v1: seedArtifact('story_map_seed_v1'),
        evaluation_seed_v1: seedArtifact('evaluation_seed_v1'),
        accepted_story_ledger_v1: harmfulSeedLedger,
      },
    });

    const artifact = buildEvaluationSeedBenchmark({ baseline, seed, gold });

    expect(artifact.ledger_quality_delta).toBeLessThan(0);
    expect(artifact.hallucination_delta).toBeLessThan(0);
    expect(artifact.seed_only_canon_promotions).toBe(1);
    expect(artifact.path_issues).toEqual(
      expect.arrayContaining([
        'AUTHORITY_VIOLATION: seed-only claim was promoted into accepted_story_ledger_v1 without evidence.',
      ]),
    );
    expect(artifact.recommendation).toBe('seed_harmful_disable');
  });

  it('fails closed when the SEED-enabled E2E path is missing required artifacts', () => {
    const issues = validateEvaluationSeedRun(
      benchmarkRun({
        run_id: 'run:missing-seed-artifacts',
        artifacts: {
          accepted_story_ledger_v1: improvedSeedLedger,
        },
      }),
      true,
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        'MISSING_ARTIFACT: story_map_seed_v1 is required for SEED-enabled run.',
        'MISSING_ARTIFACT: evaluation_seed_v1 is required for SEED-enabled run.',
        'MISSING_ARTIFACT: chunk_evidence_index_v1 is required for E2E comparison.',
        'MISSING_ARTIFACT: pass12_handoff_v1 is required before Phase 3.',
        'MISSING_ARTIFACT: evaluation_result_v2 is required for completed evaluation.',
      ]),
    );
  });
});

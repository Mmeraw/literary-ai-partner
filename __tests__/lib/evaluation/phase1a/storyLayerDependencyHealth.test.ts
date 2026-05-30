import { STORY_LAYER_KEYS } from '../../../../lib/evaluation/artifacts/artifactTypes';
import {
  applyIdentityDependencyMetadata,
  assessStoryLayerIdentityDependencies,
  CANONICAL_IDENTITY_DEPENDENT_LAYER_KEYS,
  collectDependencyWarningsFromStoryLayers,
  INHERITED_IDENTITY_RISK_WARNING,
} from '../../../../lib/evaluation/phase1a/storyLayerDependencyHealth';

function makeStoryLayers() {
  return Object.fromEntries(
    STORY_LAYER_KEYS.map((key) => [
      key,
      key === 'canonical_identity_layer'
        ? {
            schema_version: 'canonical_identity_layer_v1',
            identity_groups: [
              {
                character_id: 'edna_pontellier',
                canonical_name: 'Edna Pontellier',
                aliases: ['Edna'],
              },
            ],
          }
        : { schema_version: `${key}_v1`, extracted_claims: [`claim:${key}`] },
    ]),
  ) as Record<(typeof STORY_LAYER_KEYS)[number], Record<string, unknown>>;
}

function makeLedger() {
  return {
    generated_at: '2026-05-29T00:00:00.000Z',
    prompt_version: 'test',
    schema_version: 'pass1a_character_ledger_v1',
    entries: [],
    coverage_summary: {
      hard_fail_triggers: [],
      protagonists: ['Edna Pontellier'],
      co_protagonists: [],
      antagonists: ['Leonce Pontellier'],
      ending_accountability_warnings: [],
      missing_or_underweighted: [],
      symbol_payoff_items: [],
      major_secondary_characters: [],
      relational_engines: [],
    },
  } as any;
}

function makeLedgerV2(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 'character_ledger_v2',
    prompt_version: 'test',
    job_id: 'job-1',
    generated_at: '2026-05-29T00:00:00.000Z',
    total_chunks_processed: 10,
    identityLedger: [
      {
        characterId: 'edna_pontellier',
        canonicalName: 'Edna Pontellier',
        nameHistory: [
          {
            name: 'Edna Pontellier',
            validFromChunk: 0,
            validUntilChunk: null,
            confidence: 'explicit',
          },
        ],
        aliases: ['Edna'],
        narrativeRole: 'protagonist',
        importanceLevel: 'primary',
        firstAppearance: { label: 'chunk 1', chunkIndex: 1 },
        lastAppearance: { label: 'chunk 10', chunkIndex: 10 },
        firstChunkIndex: 1,
        lastChunkIndex: 10,
        finalStatus: 'alive',
        contradictions: [],
        recommendationBlockers: [],
      },
    ],
    stateTimelines: [],
    relationshipLedger: [],
    psychologyLedger: [],
    objectLedger: [],
    terminalLedger: [],
    validationQueries: {
      characterPresenceIndex: {},
      coPresenceIndex: {},
      nameStateIndex: {
        'Edna Pontellier': [{ name: 'Edna Pontellier', validFromChunk: 0, validUntilChunk: null }],
      },
      copingIndex: {},
      objectPresenceIndex: {},
      symbolPayoffIndex: {},
      unresolvedPromisesIndex: {},
    },
    activeBlockers: [],
    negativeKnowledge: [],
    stateConflicts: [],
    characterCoverage: {},
    coverage_summary: {
      protagonists: ['Edna Pontellier'],
      co_protagonists: [],
      antagonists: ['Leonce Pontellier'],
      high_value_objects: [],
      unresolved_promises: [],
      open_terminal_ledgers: [],
      hard_fail_triggers: [],
    },
    ...overrides,
  } as any;
}

describe('storyLayerDependencyHealth', () => {
  it('leaves dependent layers clean when canonical identity is clean', () => {
    const layers = makeStoryLayers();
    const assessment = assessStoryLayerIdentityDependencies({
      ledger: makeLedger(),
      ledgerV2: makeLedgerV2(),
      layers,
    });

    expect(assessment.canonicalIdentityHealth.truth_status).toBe('clean');
    expect(assessment.dependencyWarnings).toEqual([]);

    const annotated = applyIdentityDependencyMetadata(layers, assessment);
    expect(annotated.relationship_network_layer.dependency_warning).toBeUndefined();
  });

  it('blocks dependent layers when canonical identity is missing', () => {
    const layers = makeStoryLayers();
    layers.canonical_identity_layer = {};

    const assessment = assessStoryLayerIdentityDependencies({
      ledger: makeLedger(),
      ledgerV2: makeLedgerV2({ identityLedger: [] }),
      layers,
    });

    expect(assessment.canonicalIdentityHealth.truth_status).toBe('blocked');
    expect(assessment.canonicalIdentityHealth.warning_codes).toContain('MISSING_CANONICAL_IDENTITY_LAYER');
    expect(assessment.dependencyWarnings).toHaveLength(CANONICAL_IDENTITY_DEPENDENT_LAYER_KEYS.length);

    const annotated = applyIdentityDependencyMetadata(layers, assessment);
    expect(annotated.relationship_network_layer.health).toMatchObject({
      truth_status: 'blocked',
      status: 'invalid_withheld',
      visible_to_user: false,
      visible_to_admin: true,
    });
    expect(annotated.relationship_network_layer.dependency_warning).toMatchObject({
      failure_class: 'DEPENDENT_LAYER_FAILED_IDENTITY_INHERITANCE',
      secondary_failure_class: 'DEPENDENT_LAYER_CLEAN_STATUS_BYPASS',
      message: expect.stringContaining(INHERITED_IDENTITY_RISK_WARNING),
    });
  });

  it('degrades dependent layers for same-name ambiguity and identity blockers, and preserves handoff warnings', () => {
    const layers = makeStoryLayers();
    const ledgerV2 = makeLedgerV2({
      identityLedger: [
        {
          characterId: 'tom_1',
          canonicalName: 'Tom',
          nameHistory: [{ name: 'Tom', validFromChunk: 0, validUntilChunk: null, confidence: 'explicit' }],
          aliases: ['Thomas'],
          narrativeRole: 'protagonist',
          importanceLevel: 'primary',
          firstAppearance: { label: 'chunk 1', chunkIndex: 1 },
          lastAppearance: { label: 'chunk 10', chunkIndex: 10 },
          firstChunkIndex: 1,
          lastChunkIndex: 10,
          finalStatus: 'alive',
          contradictions: [],
          recommendationBlockers: [],
        },
        {
          characterId: 'tom_2',
          canonicalName: 'Tom',
          nameHistory: [{ name: 'Tom', validFromChunk: 0, validUntilChunk: null, confidence: 'explicit' }],
          aliases: ['T.'],
          narrativeRole: 'secondary',
          importanceLevel: 'major',
          firstAppearance: { label: 'chunk 2', chunkIndex: 2 },
          lastAppearance: { label: 'chunk 8', chunkIndex: 8 },
          firstChunkIndex: 2,
          lastChunkIndex: 8,
          finalStatus: 'alive',
          contradictions: [],
          recommendationBlockers: [],
        },
      ],
      activeBlockers: [
        {
          blockerId: 'name_state_violation:Tom+Thomas',
          type: 'name_state_violation',
          severity: 'suppress',
          rule: 'Name "Thomas" is not yet valid for Tom.',
          involvedCharacters: ['Tom'],
          affectedRecommendationTypes: ['characterization'],
        },
      ],
    });

    const assessment = assessStoryLayerIdentityDependencies({
      ledger: makeLedger(),
      ledgerV2,
      layers,
    });

    expect(assessment.canonicalIdentityHealth.truth_status).toBe('degraded');
    expect(assessment.canonicalIdentityHealth.warning_codes).toEqual(
      expect.arrayContaining([
        'SAME_NAME_AMBIGUITY',
        'DUPLICATE_CORE_IDENTITY_CANDIDATES',
        'IDENTITY_BLOCKER_ACTIVE',
        'INVALID_IDENTITY_NAME_STATE_TOKEN_WARNING',
      ]),
    );

    const annotated = applyIdentityDependencyMetadata(layers, assessment);
    const warnings = collectDependencyWarningsFromStoryLayers(annotated);
    expect(warnings).toHaveLength(CANONICAL_IDENTITY_DEPENDENT_LAYER_KEYS.length);
    expect(warnings[0]).toMatchObject({
      inherited_status: 'degraded',
      blocks_clean_status: true,
    });
    expect(annotated.object_symbol_layer.health).toMatchObject({
      truth_status: 'degraded',
      status: 'degraded_but_usable',
      visible_to_user: false,
      visible_to_admin: true,
    });
  });
});

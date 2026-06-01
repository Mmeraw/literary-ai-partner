import { buildStoryLayerFromLedger } from '@/lib/evaluation/phase1a/buildStoryLayerFromLedger';
import type { Pass1aCharacterLedger, CharacterLedgerV2 } from '@/lib/evaluation/pipeline/types';

function makeLedger(overrides?: Partial<Pass1aCharacterLedger>): Pass1aCharacterLedger {
  return {
    schema_version: 'pass1a_character_ledger_v1',
    prompt_version: 'test-threat-pressure-architecture',
    job_id: 'test-threat-pressure-architecture',
    generated_at: '2026-05-29T00:00:00.000Z',
    total_chunks_processed: 12,
    // Keep at least one verified v1 entry so story-layer projection is allowed.
    // buildStoryLayerFromLedger intentionally fail-closes when entries.length === 0.
    entries: [{ canonical_name: 'fixture-verified-entry' } as any],
    coverage_summary: {
      protagonists: ['Pip'],
      co_protagonists: [],
      antagonists: ['Abel Magwitch', 'Compeyson'],
      major_secondary_characters: [],
      animal_companions: [],
      relational_engines: [],
      symbol_payoff_items: [],
      missing_or_underweighted: [],
      ending_accountability_warnings: [],
      hard_fail_triggers: [],
    },
    ...overrides,
  };
}

function makeLedgerV2(overrides?: Partial<CharacterLedgerV2>): CharacterLedgerV2 {
  return {
    schema_version: 'character_ledger_v2',
    prompt_version: 'test-threat-pressure-architecture',
    job_id: 'test-threat-pressure-architecture',
    generated_at: '2026-05-29T00:00:00.000Z',
    total_chunks_processed: 12,
    identityLedger: [],
    stateTimelines: [],
    relationshipLedger: [],
    psychologyLedger: [],
    objectLedger: [],
    terminalLedger: [],
    validationQueries: {
      characterPresenceIndex: {},
      coPresenceIndex: {},
      nameStateIndex: {},
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
      protagonists: ['Pip'],
      co_protagonists: [],
      antagonists: ['Abel Magwitch', 'Compeyson'],
      high_value_objects: [],
      unresolved_promises: [],
      open_terminal_ledgers: [],
      hard_fail_triggers: [],
    },
    ...overrides,
  };
}

describe('buildStoryLayerFromLedger — narrative pressure architecture', () => {
  it('captures character + non-character + internal pressure systems, not antagonist-only slots', () => {
    const ledger = makeLedger({
      coverage_summary: {
        protagonists: ['Pip'],
        co_protagonists: [],
        antagonists: ['Abel Magwitch', 'Compeyson'],
        major_secondary_characters: [],
        animal_companions: [],
        relational_engines: [],
        symbol_payoff_items: [],
        missing_or_underweighted: [],
        ending_accountability_warnings: [],
        hard_fail_triggers: [],
      },
    });

    const ledgerV2 = makeLedgerV2({
      identityLedger: [
        {
          characterId: 'ge:pip',
          canonicalName: 'Pip',
          nameHistory: [{ name: 'Pip', validFromChunk: 0, validUntilChunk: null, confidence: 'explicit' }],
          aliases: [],
          narrativeRole: 'protagonist',
          importanceLevel: 'primary',
          firstAppearance: { label: 'Chapter 1' },
          lastAppearance: { label: 'Chapter 59' },
          firstChunkIndex: 0,
          lastChunkIndex: 11,
          finalStatus: 'alive',
          contradictions: [],
          recommendationBlockers: [],
        },
        {
          characterId: 'ge:magwitch',
          canonicalName: 'Abel Magwitch',
          nameHistory: [{ name: 'Abel Magwitch', validFromChunk: 0, validUntilChunk: null, confidence: 'explicit' }],
          aliases: ['Magwitch', 'Provis'],
          narrativeRole: 'antagonist',
          importanceLevel: 'major',
          firstAppearance: { label: 'Chapter 1' },
          lastAppearance: { label: 'Chapter 56' },
          firstChunkIndex: 0,
          lastChunkIndex: 10,
          finalStatus: 'dead',
          contradictions: [],
          recommendationBlockers: [],
        },
        {
          characterId: 'ge:miss_havisham',
          canonicalName: 'Miss Havisham',
          nameHistory: [{ name: 'Miss Havisham', validFromChunk: 0, validUntilChunk: null, confidence: 'explicit' }],
          aliases: [],
          narrativeRole: 'antagonist',
          importanceLevel: 'major',
          firstAppearance: { label: 'Chapter 8' },
          lastAppearance: { label: 'Chapter 49' },
          firstChunkIndex: 1,
          lastChunkIndex: 9,
          finalStatus: 'dead',
          contradictions: [],
          recommendationBlockers: [],
        },
        {
          characterId: 'ge:compeyson',
          canonicalName: 'Compeyson',
          nameHistory: [{ name: 'Compeyson', validFromChunk: 0, validUntilChunk: null, confidence: 'explicit' }],
          aliases: [],
          narrativeRole: 'antagonist',
          importanceLevel: 'major',
          firstAppearance: { label: 'Chapter 42' },
          lastAppearance: { label: 'Chapter 56' },
          firstChunkIndex: 7,
          lastChunkIndex: 10,
          finalStatus: 'dead',
          contradictions: [],
          recommendationBlockers: [],
        },
        {
          characterId: 'ge:jaggers',
          canonicalName: 'Mr. Jaggers',
          nameHistory: [{ name: 'Mr. Jaggers', validFromChunk: 0, validUntilChunk: null, confidence: 'explicit' }],
          aliases: ['legal machinery'],
          narrativeRole: 'pressure_agent',
          importanceLevel: 'major',
          firstAppearance: { label: 'Chapter 20' },
          lastAppearance: { label: 'Chapter 58' },
          firstChunkIndex: 4,
          lastChunkIndex: 11,
          finalStatus: 'alive',
          contradictions: [],
          recommendationBlockers: [],
        },
        {
          characterId: 'ge:class_shame',
          canonicalName: 'class shame',
          nameHistory: [{ name: 'class shame', validFromChunk: 0, validUntilChunk: null, confidence: 'explicit' }],
          aliases: ['status hierarchy'],
          narrativeRole: 'collective_force',
          importanceLevel: 'major',
          firstAppearance: { label: 'Chapter 1' },
          lastAppearance: { label: 'Chapter 59' },
          firstChunkIndex: 0,
          lastChunkIndex: 11,
          finalStatus: 'unresolved',
          contradictions: [],
          recommendationBlockers: [],
        },
      ] as CharacterLedgerV2['identityLedger'],
      terminalLedger: [
        {
          characterId: 'ge:miss_havisham',
          terminalCondition: 'death',
          terminalChunk: 9,
          terminalChapter: 'Chapter 49',
          lastLucidChunk: 9,
          whoIsPresent: [],
          finalBeliefState: null,
          promisesKept: [],
          promisesUnkept: [],
          objectsPresentAtExit: [],
          legacyTransferredTo: null,
          finalRelationshipStates: [],
          narrativeClosureStatus: 'fully_resolved',
          evidenceQuote: 'House fire consequences close her arc.',
          confidence: 'explicit',
        },
        {
          characterId: 'ge:compeyson',
          terminalCondition: 'death',
          terminalChunk: 10,
          terminalChapter: 'Chapter 56',
          lastLucidChunk: 10,
          whoIsPresent: [],
          finalBeliefState: null,
          promisesKept: [],
          promisesUnkept: [],
          objectsPresentAtExit: [],
          legacyTransferredTo: null,
          finalRelationshipStates: [],
          narrativeClosureStatus: 'fully_resolved',
          evidenceQuote: 'Fatal pursuit closes his arc.',
          confidence: 'explicit',
        },
      ],
      psychologyLedger: [
        {
          characterId: 'ge:pip',
          copingMechanisms: [],
          psychologicalArc: 'Pip wrestles with guilt, class shame, and moral obligation.',
          seedingBlocked: false,
          seedingBlockMessage: '',
        },
      ],
    });

    const payload = buildStoryLayerFromLedger(ledger, ledgerV2);
    const layer = payload.threat_antagonist_ending_layer as any;

    expect(Array.isArray(layer.pressure_systems)).toBe(true);
    expect(layer.pressure_systems.length).toBeGreaterThan(layer.antagonist_count);
    expect(layer.non_character_pressure_count).toBeGreaterThan(0);

    const compeyson = layer.pressure_systems.find((p: any) => String(p.source_label).toLowerCase().includes('compeyson'));
    expect(compeyson).toBeTruthy();
    expect(String(compeyson.pressure_type)).not.toContain('maternal');
    expect(String(compeyson.ending_state)).not.toContain('unresolved');

    const missHavisham = layer.pressure_systems.find((p: any) => String(p.source_label).toLowerCase().includes('miss havisham'));
    expect(missHavisham).toBeTruthy();
    expect(String(missHavisham.ending_state)).not.toContain('unresolved');

    expect(layer.threat_systems.join(' ').toLowerCase()).toContain('legal machinery');
    expect(layer.threat_systems.join(' ').toLowerCase()).toContain('class shame');

    const internal = layer.pressure_systems.find((p: any) => p.source_kind === 'internal');
    expect(internal).toBeTruthy();
  });

  it('keeps Awakening pressure as literary systems and preserves non-character symbolic pressure', () => {
    const ledger = makeLedger({
      coverage_summary: {
        protagonists: ['Edna Pontellier'],
        co_protagonists: [],
        antagonists: [],
        major_secondary_characters: [],
        animal_companions: [],
        relational_engines: [],
        symbol_payoff_items: [],
        missing_or_underweighted: [],
        ending_accountability_warnings: [],
        hard_fail_triggers: [],
      },
    });

    const ledgerV2 = makeLedgerV2({
      identityLedger: [
        {
          characterId: 'aw:edna',
          canonicalName: 'Edna Pontellier',
          nameHistory: [{ name: 'Edna Pontellier', validFromChunk: 0, validUntilChunk: null, confidence: 'explicit' }],
          aliases: [],
          narrativeRole: 'protagonist',
          importanceLevel: 'primary',
          firstAppearance: { label: 'Chapter 1' },
          lastAppearance: { label: 'Chapter 39' },
          firstChunkIndex: 0,
          lastChunkIndex: 11,
          finalStatus: 'dead',
          contradictions: [],
          recommendationBlockers: [],
        },
        {
          characterId: 'aw:leonce',
          canonicalName: 'Léonce Pontellier',
          nameHistory: [{ name: 'Léonce Pontellier', validFromChunk: 0, validUntilChunk: null, confidence: 'explicit' }],
          aliases: ['marital property pressure'],
          narrativeRole: 'patriarchal_pressure',
          importanceLevel: 'major',
          firstAppearance: { label: 'Chapter 1' },
          lastAppearance: { label: 'Chapter 39' },
          firstChunkIndex: 0,
          lastChunkIndex: 11,
          finalStatus: 'alive',
          contradictions: [],
          recommendationBlockers: [],
        },
        {
          characterId: 'aw:arobin',
          canonicalName: 'Alcée Arobin',
          nameHistory: [{ name: 'Alcée Arobin', validFromChunk: 0, validUntilChunk: null, confidence: 'explicit' }],
          aliases: ['sexual destabilization'],
          narrativeRole: 'sexual_destabilizer',
          importanceLevel: 'supporting',
          firstAppearance: { label: 'Chapter 20' },
          lastAppearance: { label: 'Chapter 35' },
          firstChunkIndex: 6,
          lastChunkIndex: 10,
          finalStatus: 'alive',
          contradictions: [],
          recommendationBlockers: [],
        },
        {
          characterId: 'aw:sea_symbolic_pressure',
          canonicalName: 'Sea / symbolic pressure',
          nameHistory: [{ name: 'Sea / symbolic pressure', validFromChunk: 0, validUntilChunk: null, confidence: 'explicit' }],
          aliases: ['Gulf', 'water'],
          narrativeRole: 'symbolic_force',
          importanceLevel: 'major',
          firstAppearance: { label: 'Chapter 1' },
          lastAppearance: { label: 'Chapter 39' },
          firstChunkIndex: 0,
          lastChunkIndex: 11,
          finalStatus: 'unresolved',
          contradictions: [],
          recommendationBlockers: [],
        },
        {
          characterId: 'aw:creole_social_expectations',
          canonicalName: 'Creole social expectations',
          nameHistory: [{ name: 'Creole social expectations', validFromChunk: 0, validUntilChunk: null, confidence: 'explicit' }],
          aliases: ['social convention'],
          narrativeRole: 'collective_force',
          importanceLevel: 'major',
          firstAppearance: { label: 'Chapter 1' },
          lastAppearance: { label: 'Chapter 39' },
          firstChunkIndex: 0,
          lastChunkIndex: 11,
          finalStatus: 'unresolved',
          contradictions: [],
          recommendationBlockers: [],
        },
      ] as CharacterLedgerV2['identityLedger'],
      psychologyLedger: [
        {
          characterId: 'aw:edna',
          copingMechanisms: [],
          psychologicalArc: 'Edna faces longing and autonomy pressure as internal contradiction intensifies.',
          seedingBlocked: false,
          seedingBlockMessage: '',
        },
      ],
    });

    const payload = buildStoryLayerFromLedger(ledger, ledgerV2);
    const layer = payload.threat_antagonist_ending_layer as any;

    expect(layer.antagonist_count).toBe(0);
    expect(Array.isArray(layer.pressure_systems)).toBe(true);
    expect(layer.pressure_systems.length).toBeGreaterThan(0);

    const leonce = layer.pressure_systems.find((p: any) => String(p.source_label).toLowerCase().includes('léonce'));
    expect(leonce).toBeTruthy();
    expect(String(leonce.pressure_type)).not.toBe('interpersonal_pressure');

    const arobin = layer.pressure_systems.find((p: any) => String(p.source_label).toLowerCase().includes('arobin'));
    expect(arobin).toBeTruthy();
    expect(String(arobin.pressure_type)).not.toBe('interpersonal_pressure');

    const sea = layer.pressure_systems.find((p: any) => String(p.source_label).toLowerCase().includes('sea'));
    expect(sea).toBeTruthy();
    expect(sea.source_kind).toBe('non_character');

    expect(layer.non_character_pressure_count).toBeGreaterThan(0);
    expect(Array.isArray(layer.narrative_pressure_vectors)).toBe(true);
    expect(layer.narrative_pressure_vectors.length).toBeGreaterThan(0);
  });
});

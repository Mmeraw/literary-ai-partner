/**
 * Regression test: POV Structure must derive from actual pov_signal (focalization)
 * data, NOT from role_signal or narrative importance.
 *
 * The Awakening scenario: Edna Pontellier is the sole POV owner (close third limited).
 * Robert Lebrun is structurally major (romantic_catalyst, present in many scenes)
 * but NEVER owns the narrative camera. He must NOT appear as a POV character.
 */
import { buildStoryLayerFromLedger } from '@/lib/evaluation/phase1a/buildStoryLayerFromLedger';
import type {
  Pass1aCharacterLedger,
  Pass1aChunkOutput,
  Pass1aCharacterChunkEntry,
  CharacterLedgerV2,
  CharacterIdentityLedgerEntry,
  CharacterArcLedgerEntry,
} from '@/lib/evaluation/pipeline/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

type CharacterWithPov = Pass1aCharacterChunkEntry & {
  canonical_identity_group?: string;
  pov_signal?: string;
  pov_section_label?: string;
  presence_type?: string;
};

function makeCharacter(overrides: Partial<CharacterWithPov> & { canonical_name: string }): CharacterWithPov {
  return {
    canonical_name: overrides.canonical_name,
    canonical_identity_group: overrides.canonical_identity_group,
    aliases: overrides.aliases ?? [],
    pronouns: overrides.pronouns ?? ['she/her'],
    age_signal: overrides.age_signal ?? 'adult',
    age_exact: overrides.age_exact ?? null,
    life_stage_evidence: overrides.life_stage_evidence ?? null,
    gender_identity: overrides.gender_identity ?? 'woman',
    lgbtq_signals: overrides.lgbtq_signals ?? [],
    racial_ethnic_signals: overrides.racial_ethnic_signals ?? [],
    skin_tone_signals: overrides.skin_tone_signals ?? [],
    language_signals: overrides.language_signals ?? [],
    religion_signals: overrides.religion_signals ?? [],
    socioeconomic_signals: overrides.socioeconomic_signals ?? [],
    nationality_signals: overrides.nationality_signals ?? [],
    disability_neuro_signals: overrides.disability_neuro_signals ?? [],
    role_signal: overrides.role_signal ?? 'protagonist',
    narrative_weight_signal: overrides.narrative_weight_signal ?? 'primary',
    is_named: overrides.is_named ?? true,
    pov_signal: overrides.pov_signal,
    pov_section_label: overrides.pov_section_label,
    presence_type: overrides.presence_type ?? 'present',
    who_is_this: overrides.who_is_this ?? '',
    what_do_they_want: overrides.what_do_they_want ?? null,
    where_are_they: overrides.where_are_they ?? null,
    when_signal: overrides.when_signal ?? null,
    why_signal: overrides.why_signal ?? null,
    how_signal: overrides.how_signal ?? null,
    arc_state_in_chunk: overrides.arc_state_in_chunk ?? 'present in scene',
    arc_pressure: overrides.arc_pressure ?? null,
    arc_shift: overrides.arc_shift ?? null,
    is_ending_chunk: overrides.is_ending_chunk ?? false,
    symbolic_objects: overrides.symbolic_objects ?? [],
    relationship_signals: overrides.relationship_signals ?? [],
    evidence_anchors: overrides.evidence_anchors ?? [],
    co_presence_confirmed: overrides.co_presence_confirmed ?? [],
    negative_knowledge: overrides.negative_knowledge ?? [],
  };
}

function makeChunk(chunk_index: number, characters: CharacterWithPov[]): Pass1aChunkOutput {
  return {
    pass: '1a',
    axis: 'character_evidence_sweep',
    chunk_index,
    characters,
    prompt_version: 'test-pov-focalization',
    generated_at: '2026-05-29T00:00:00.000Z',
  };
}

function makeIdentityEntry(
  id: string,
  name: string,
  role: CharacterIdentityLedgerEntry['narrativeRole'],
  importance: CharacterIdentityLedgerEntry['importanceLevel'],
): CharacterIdentityLedgerEntry {
  return {
    characterId: id,
    canonicalName: name,
    nameHistory: [{ name, validFromChunk: 0, validUntilChunk: null, confidence: 'explicit' }],
    aliases: [],
    narrativeRole: role,
    importanceLevel: importance,
    firstAppearance: { label: 'Chapter I' },
    lastAppearance: { label: 'Chapter XXXIX' },
    firstChunkIndex: 0,
    lastChunkIndex: 9,
    finalStatus: 'alive',
    contradictions: [],
    recommendationBlockers: [],
  };
}

function makeLedgerEntry(name: string): CharacterArcLedgerEntry {
  return {
    canonical_name: name,
    aliases: [],
    pronouns: ['she/her'],
    age_exact_first: null,
    age_exact_last: null,
    age_signal: 'adult',
    gender_identity: 'woman',
    lgbtq_signals: [],
    racial_ethnic_signals: [],
    skin_tone_signals: [],
    language_signals: [],
    religion_signals: [],
    socioeconomic_signals: [],
    nationality_signals: [],
    disability_neuro_signals: [],
    role: 'protagonist',
    narrative_weight_band: 'primary',
    is_named: true,
    who_is_this: '',
    what_do_they_want: null,
    primary_locations: [],
    why_signal: null,
    how_signal: null,
    arc_start: 'present',
    arc_pressure: '',
    arc_turning_points: [],
    arc_end_state: 'present',
    ending_status: 'intentionally_unresolved',
    symbolic_objects: [],
    relational_engines: [],
    evidence_anchors: [],
    report_acknowledgement_status: 'adequately_accounted_for',
    warnings: [],
    first_chunk_index: 0,
    last_chunk_index: 9,
    mention_count: 10,
    nameStates: [{ name, validFromChunk: 0, validUntilChunk: null }],
    copingMechanisms: [],
    coPresenceMap: {},
  };
}

// ── Test Data: The Awakening ─────────────────────────────────────────────────
// 10 chunks simulating the novel. Edna owns every chunk's camera.
// Robert appears in 6 chunks but never owns the camera.

const edna = (povSignal: string) =>
  makeCharacter({
    canonical_name: 'Edna Pontellier',
    canonical_identity_group: 'Edna Pontellier',
    role_signal: 'protagonist',
    narrative_weight_signal: 'primary',
    pov_signal: povSignal,
    pov_section_label: 'Edna — close third',
  });

const robert = () =>
  makeCharacter({
    canonical_name: 'Robert Lebrun',
    canonical_identity_group: 'Robert Lebrun',
    role_signal: 'secondary',
    narrative_weight_signal: 'major',
    pronouns: ['he/him'],
    gender_identity: 'man',
    pov_signal: 'not_pov',
    pov_section_label: '',
  });

const leonce = () =>
  makeCharacter({
    canonical_name: 'Léonce Pontellier',
    canonical_identity_group: 'Léonce Pontellier',
    role_signal: 'secondary',
    narrative_weight_signal: 'major',
    pronouns: ['he/him'],
    gender_identity: 'man',
    pov_signal: 'not_pov',
    pov_section_label: '',
  });

const chunkOutputs: Pass1aChunkOutput[] = [
  makeChunk(0, [edna('close_third_limited'), robert(), leonce()]),
  makeChunk(1, [edna('close_third_limited'), robert()]),
  makeChunk(2, [edna('close_third_limited'), leonce()]),
  makeChunk(3, [edna('close_third_limited'), robert()]),
  makeChunk(4, [edna('close_third_limited')]),
  makeChunk(5, [edna('close_third_limited'), robert()]),
  makeChunk(6, [edna('close_third_limited'), leonce()]),
  makeChunk(7, [edna('close_third_limited'), robert()]),
  makeChunk(8, [edna('close_third_limited'), robert()]),
  makeChunk(9, [edna('close_third_limited')]),
];

const minimalLedger: Pass1aCharacterLedger = {
  schema_version: 'pass1a_character_ledger_v1',
  prompt_version: 'test-pov-focalization',
  job_id: 'test-awakening-pov',
  generated_at: '2026-05-29T00:00:00.000Z',
  entries: [
    makeLedgerEntry('Edna Pontellier'),
    { ...makeLedgerEntry('Robert Lebrun'), pronouns: ['he/him'], gender_identity: 'man', role: 'secondary', narrative_weight_band: 'major' },
    { ...makeLedgerEntry('Léonce Pontellier'), pronouns: ['he/him'], gender_identity: 'man', role: 'secondary', narrative_weight_band: 'major' },
  ],
  coverage_summary: {
    protagonists: ['Edna Pontellier'],
    co_protagonists: [],
    antagonists: [],
    symbol_payoff_items: [],
    hard_fail_triggers: [],
  },
  total_chunks: 10,
};

const minimalLedgerV2: CharacterLedgerV2 = {
  schema_version: 'character_ledger_v2',
  prompt_version: 'test-pov-focalization',
  job_id: 'test-awakening-pov',
  generated_at: '2026-05-29T00:00:00.000Z',
  total_chunks_processed: 10,
  identityLedger: [
    makeIdentityEntry('edna', 'Edna Pontellier', 'protagonist', 'primary'),
    makeIdentityEntry('robert', 'Robert Lebrun', 'co_protagonist', 'major'),
    makeIdentityEntry('leonce', 'Léonce Pontellier', 'antagonist', 'major'),
  ],
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
    protagonists: ['Edna Pontellier'],
    co_protagonists: [],
    antagonists: [],
    symbol_payoff_items: [],
    hard_fail_triggers: [],
  },
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('buildStoryLayerFromLedger — POV focalization truth', () => {
  it('derives POV from pov_signal, not from role — only Edna is POV owner', () => {
    const payload = buildStoryLayerFromLedger(minimalLedger, minimalLedgerV2, chunkOutputs);
    const povLayer = payload.pov_structure_layer as Record<string, unknown>;
    const povChars = povLayer.pov_characters as Array<Record<string, unknown>>;

    // Only Edna should appear — she is the only character with pov_signal !== 'not_pov'
    expect(povChars).toHaveLength(1);
    expect(povChars[0].canonical_name).toBe('Edna Pontellier');
    expect(povChars[0].is_primary).toBe(true);
    expect(povChars[0].pov_type).toBe('close_third_limited');
    expect(povChars[0].narrative_share_pct).toBe(100);
  });

  it('Robert Lebrun must NOT appear as a POV character despite being co_protagonist', () => {
    const payload = buildStoryLayerFromLedger(minimalLedger, minimalLedgerV2, chunkOutputs);
    const povLayer = payload.pov_structure_layer as Record<string, unknown>;
    const povChars = povLayer.pov_characters as Array<Record<string, unknown>>;

    const robertPov = povChars.find((c) => c.canonical_name === 'Robert Lebrun');
    expect(robertPov).toBeUndefined();
  });

  it('does not fall back to role-derived POV when chunk evidence is absent', () => {
    const payload = buildStoryLayerFromLedger(minimalLedger, minimalLedgerV2);
    const povLayer = payload.pov_structure_layer as Record<string, unknown>;
    const povChars = povLayer.pov_characters as Array<Record<string, unknown>>;

    expect(povChars).toHaveLength(0);
    expect(povLayer.pov_identified).toBe(false);
    expect(povLayer.pov_evidence_status).toBe('insufficient_evidence');
    expect(povLayer.pov_role_fallback_derived).toBe(false);
    expect(povLayer.pov_truth_status).toBe('degraded');
    expect(String(povLayer.pov_detection_note)).toContain('could not be confirmed');
  });

  it('pov_identified is true and pov_character_count is accurate', () => {
    const payload = buildStoryLayerFromLedger(minimalLedger, minimalLedgerV2, chunkOutputs);
    const povLayer = payload.pov_structure_layer as Record<string, unknown>;

    expect(povLayer.pov_identified).toBe(true);
    expect(povLayer.pov_character_count).toBe(1);
  });
});

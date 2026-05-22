import { buildPovStructureFromChunkOutputs } from '@/lib/evaluation/pipeline/povStructure';
import type { CharacterArcLedgerEntry, Pass1aCharacterChunkEntry, Pass1aChunkOutput } from '@/lib/evaluation/pipeline/types';

type CharacterWithPov = Pass1aCharacterChunkEntry & {
  canonical_identity_group?: string;
  pov_signal?: string;
  pov_section_label?: string;
};

function character(overrides: Partial<CharacterWithPov> & { canonical_name: string }): CharacterWithPov {
  return {
    canonical_name: overrides.canonical_name,
    canonical_identity_group: overrides.canonical_identity_group,
    aliases: overrides.aliases ?? [],
    pronouns: overrides.pronouns ?? ['he/him'],
    age_signal: overrides.age_signal ?? 'adult',
    age_exact: overrides.age_exact ?? null,
    life_stage_evidence: overrides.life_stage_evidence ?? null,
    gender_identity: overrides.gender_identity ?? 'man',
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
    who_is_this: overrides.who_is_this ?? `${overrides.canonical_name} identity signal`,
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
    evidence_anchors: overrides.evidence_anchors ?? [
      { excerpt: `${overrides.canonical_name} appears`, evidence_type: 'identity', confidence: 'explicit' },
    ],
    co_presence_confirmed: overrides.co_presence_confirmed ?? [],
    negative_knowledge: overrides.negative_knowledge ?? [],
  };
}

function chunk(chunk_index: number, characters: CharacterWithPov[]): Pass1aChunkOutput {
  return {
    pass: '1a',
    axis: 'character_evidence_sweep',
    chunk_index,
    characters,
    prompt_version: 'test',
    generated_at: '2026-05-21T00:00:00.000Z',
  };
}

function ledgerEntry(name: string, aliases: string[] = []): CharacterArcLedgerEntry {
  return {
    canonical_name: name,
    aliases,
    pronouns: ['he/him'],
    age_exact_first: null,
    age_exact_last: null,
    age_signal: 'adult',
    gender_identity: 'man',
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
    who_is_this: `${name} identity signal`,
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
    last_chunk_index: 0,
    mention_count: 1,
    nameStates: [{ name, validFromChunk: 0, validUntilChunk: null }],
    copingMechanisms: [],
    coPresenceMap: {},
  };
}

describe('buildPovStructureFromChunkOutputs', () => {
  it('builds primary and secondary POV structure with bounded narrative share', () => {
    const povStructure = buildPovStructureFromChunkOutputs({
      totalChunks: 4,
      ledgerEntries: [
        ledgerEntry('Michael', ['Miguel', 'Mr. Salter']),
        ledgerEntry('Benjamin', ['Benjamín', 'Mr. Lopez']),
      ],
      chunkOutputs: [
        chunk(0, [character({ canonical_name: 'Miguel', canonical_identity_group: 'Michael', pov_signal: 'first_person_narrator', pov_section_label: 'Michael — camp sections' })]),
        chunk(1, [character({ canonical_name: 'Michael', canonical_identity_group: 'Michael', pov_signal: 'first_person_narrator', pov_section_label: 'Michael — camp sections' })]),
        chunk(2, [character({ canonical_name: 'Benjamín', canonical_identity_group: 'Benjamin', pov_signal: 'close_third_limited', pov_section_label: 'Benjamin — Culiacán search' })]),
        chunk(3, [character({ canonical_name: 'Raúl', pov_signal: 'not_pov', pov_section_label: '' })]),
      ],
    });

    expect(povStructure).toEqual([
      {
        canonical_name: 'Michael',
        pov_type: 'first_person_narrator',
        narrative_share_pct: 50,
        section_labels: ['Michael — camp sections'],
        is_primary: true,
      },
      {
        canonical_name: 'Benjamin',
        pov_type: 'close_third_limited',
        narrative_share_pct: 25,
        section_labels: ['Benjamin — Culiacán search'],
        is_primary: false,
      },
    ]);

    const shareTotal = povStructure.reduce((sum, entry) => sum + entry.narrative_share_pct, 0);
    expect(shareTotal).toBeLessThanOrEqual(100);
  });

  it('returns an empty POV structure for old outputs with no POV signal', () => {
    const povStructure = buildPovStructureFromChunkOutputs({
      totalChunks: 2,
      ledgerEntries: [ledgerEntry('Michael')],
      chunkOutputs: [
        chunk(0, [character({ canonical_name: 'Michael' })]),
        chunk(1, [character({ canonical_name: 'Benjamin', pov_signal: 'not_pov' })]),
      ],
    });

    expect(povStructure).toEqual([]);
  });
});

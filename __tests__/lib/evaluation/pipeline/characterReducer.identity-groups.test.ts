import { reduceCharacterEvidence } from '@/lib/evaluation/pipeline/characterReducer';
import type { Pass1aChunkOutput, Pass1aCharacterChunkEntry } from '@/lib/evaluation/pipeline/types';

function character(overrides: Partial<Pass1aCharacterChunkEntry> & { canonical_name: string; canonical_identity_group?: string }): Pass1aCharacterChunkEntry & { canonical_identity_group?: string } {
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

function chunk(chunk_index: number, characters: Array<Pass1aCharacterChunkEntry & { canonical_identity_group?: string }>): Pass1aChunkOutput {
  return {
    pass: '1a',
    axis: 'character_evidence_sweep',
    chunk_index,
    characters,
    prompt_version: 'test',
    generated_at: '2026-05-21T00:00:00.000Z',
  };
}

describe('reduceCharacterEvidence canonical identity groups', () => {
  it('merges Michael/Miguel/Salter and Benjamin variants before rendering ledger cards', () => {
    const ledger = reduceCharacterEvidence({
      jobId: 'identity-group-test',
      totalChunksInManuscript: 5,
      chunkOutputs: [
        chunk(0, [
          character({ canonical_name: 'Michael', canonical_identity_group: 'Michael', aliases: ['Mike'] }),
          character({ canonical_name: 'Benjamin', canonical_identity_group: 'Benjamin', aliases: ['Benjamín'] }),
        ]),
        chunk(1, [
          character({ canonical_name: 'Miguel', canonical_identity_group: 'Michael', aliases: ['Michael James Salter'] }),
          character({ canonical_name: 'Benjamín', canonical_identity_group: 'Benjamin', aliases: ['Benjamin Lopez Castro'] }),
        ]),
        chunk(2, [
          character({ canonical_name: 'Mr. Salter', canonical_identity_group: 'Michael', aliases: ['Michael Wagner'] }),
          character({ canonical_name: 'Mr. Lopez', canonical_identity_group: 'Benjamin', aliases: ['Benjamin Wagner'] }),
        ]),
      ],
    });

    const names = ledger.entries.map((entry) => entry.canonical_name).sort();
    expect(names).toEqual(['Benjamin', 'Michael']);

    const michael = ledger.entries.find((entry) => entry.canonical_name === 'Michael');
    const benjamin = ledger.entries.find((entry) => entry.canonical_name === 'Benjamin');

    expect(michael?.aliases).toEqual(
      expect.arrayContaining(['Miguel', 'Michael James Salter', 'Mr. Salter', 'Michael Wagner']),
    );
    expect(benjamin?.aliases).toEqual(
      expect.arrayContaining(['Benjamín', 'Benjamin Lopez Castro', 'Mr. Lopez', 'Benjamin Wagner']),
    );

    expect(ledger.coverage_summary.protagonists.sort()).toEqual(['Benjamin', 'Michael']);
  });
});

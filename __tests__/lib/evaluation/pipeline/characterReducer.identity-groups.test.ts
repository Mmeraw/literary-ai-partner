import { buildCharacterLedgerV2, reduceCharacterEvidence } from '@/lib/evaluation/pipeline/characterReducer';
import type { Pass1aChunkOutput, Pass1aCharacterChunkEntry } from '@/lib/evaluation/pipeline/types';

function character(overrides: Partial<Pass1aCharacterChunkEntry> & { canonical_name: string; canonical_identity_group?: string }): Pass1aCharacterChunkEntry & { canonical_identity_group?: string } {
  return {
    canonical_name: overrides.canonical_name,
    canonical_identity_group: overrides.canonical_identity_group,
    legal_name: overrides.legal_name ?? null,
    aliases: overrides.aliases ?? [],
    assumed_names: overrides.assumed_names ?? [],
    descriptors: overrides.descriptors ?? [],
    forms_of_address: overrides.forms_of_address ?? [],
    pronouns: overrides.pronouns ?? ['he/him'],
    same_name_disambiguation: overrides.same_name_disambiguation ?? null,
    identity_notes: overrides.identity_notes ?? null,
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

  it('does not conflate same visible name token when canonical identity groups are distinct', () => {
    const ledger = reduceCharacterEvidence({
      jobId: 'same-name-disambiguation-test',
      totalChunksInManuscript: 6,
      chunkOutputs: [
        chunk(0, [
          character({
            canonical_name: 'Pip',
            canonical_identity_group: 'Philip Pirrip',
            aliases: ['Philip Pirrip'],
            same_name_disambiguation: 'adult narrator Pip',
          }),
        ]),
        chunk(1, [
          character({
            canonical_name: 'Young Pip',
            canonical_identity_group: 'Young Pip, Joe and Biddy\'s son',
            aliases: ['Pip'],
            same_name_disambiguation: 'child named Pip who is Joe and Biddy\'s son',
          }),
        ]),
      ],
    });

    const names = ledger.entries.map((entry) => entry.canonical_name).sort();
    expect(names).toEqual(['Philip Pirrip', 'Young Pip']);

    expect(ledger.entries.find((entry) => entry.canonical_name === 'Philip Pirrip')).toBeDefined();
    const youngPip = ledger.entries.find((entry) => entry.canonical_name === 'Young Pip');
    expect(youngPip).toBeDefined();
    expect(youngPip?.same_name_disambiguation_group).toBe('child named Pip who is Joe and Biddy\'s son');
  });

  it('filters pronouns/descriptors/forms-of-address from legal and assumed name states', () => {
    const ledger = reduceCharacterEvidence({
      jobId: 'identity-namestate-invalid-token-test',
      totalChunksInManuscript: 4,
      chunkOutputs: [
        chunk(0, [
          character({
            canonical_name: 'Philip Pirrip',
            canonical_identity_group: 'Philip Pirrip',
            legal_name: 'Philip Pirrip',
            aliases: ['he', 'the boy', 'the stranger', 'sir', 'madam', 'Pip'],
            assumed_names: ['dear boy', 'Pip', 'madam', 'the stranger'],
            forms_of_address: ['sir', 'madam'],
            descriptors: ['the boy', 'the stranger'],
          }),
        ]),
      ],
    });

    const pip = ledger.entries.find((entry) => entry.canonical_name === 'Philip Pirrip');
    expect(pip).toBeDefined();
    expect(pip?.nameStates.map((s) => s.name)).toEqual(expect.arrayContaining(['Philip Pirrip', 'Pip']));
    expect(pip?.nameStates.map((s) => s.name)).not.toEqual(expect.arrayContaining(['he', 'the boy', 'the stranger', 'sir', 'madam', 'dear boy']));
    expect((pip?.legal_name_states ?? []).map((s) => s.name)).toEqual(expect.arrayContaining(['Philip Pirrip', 'Pip']));
    expect((pip?.legal_name_states ?? []).map((s) => s.name)).not.toEqual(expect.arrayContaining(['he', 'the boy', 'the stranger', 'sir', 'madam', 'dear boy']));
  });

  it('merges leading-article identity variants instead of degrading Scarecrow-style aliases', () => {
    const ledger = reduceCharacterEvidence({
      jobId: 'oz-article-alias-test',
      totalChunksInManuscript: 15,
      chunkOutputs: [
        chunk(1, [
          character({
            canonical_name: 'Scarecrow',
            aliases: ['The Scarecrow'],
            role_signal: 'protagonist',
            narrative_weight_signal: 'primary',
            arc_state_in_chunk: 'Dorothy frees Scarecrow from the pole.',
          }),
        ]),
        chunk(14, [
          character({
            canonical_name: 'The Scarecrow',
            aliases: ['Scarecrow'],
            role_signal: 'protagonist',
            narrative_weight_signal: 'primary',
            arc_shift: 'The Scarecrow becomes ruler of the Emerald City.',
            evidence_anchors: [
              { excerpt: 'The Scarecrow was now the ruler of the Emerald City.', evidence_type: 'arc_shift', confidence: 'explicit' },
            ],
          }),
        ]),
      ],
    });

    expect(ledger.entries.map((entry) => entry.canonical_name)).toEqual(['Scarecrow']);
    expect(ledger.entries[0].aliases).toEqual(expect.arrayContaining(['The Scarecrow']));
    expect(ledger.coverage_summary.hard_fail_triggers).toEqual([]);
  });

  it('uses explicit terminal evidence outside the final chunk to prevent false abandoned-arc hard fails', () => {
    const chunkOutputs = [
      chunk(4, [
        character({
          canonical_name: 'Wicked Witch of the West',
          role_signal: 'antagonist',
          narrative_weight_signal: 'major',
          arc_state_in_chunk: 'The Wicked Witch threatens Dorothy and enslaves the Winkies.',
        }),
      ]),
      chunk(9, [
        character({
          canonical_name: 'Wicked Witch of the West',
          role_signal: 'antagonist',
          narrative_weight_signal: 'major',
          arc_shift: 'Dorothy melts the Wicked Witch with water; the Witch has come to an end.',
          evidence_anchors: [
            { excerpt: 'the Wicked Witch of the West had come to an end', evidence_type: 'arc_shift', confidence: 'explicit' },
          ],
        }),
      ]),
    ];

    const ledger = reduceCharacterEvidence({
      jobId: 'oz-terminal-evidence-test',
      totalChunksInManuscript: 15,
      chunkOutputs,
    });
    const witch = ledger.entries.find((entry) => entry.canonical_name === 'Wicked Witch of the West');
    expect(witch?.ending_status).toBe('tragically_confirmed');
    expect(ledger.coverage_summary.hard_fail_triggers).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('Wicked Witch of the West'),
      ]),
    );

    const ledgerV2 = buildCharacterLedgerV2({
      ledger,
      chunkOutputs,
      jobId: 'oz-terminal-evidence-test',
      totalChunksInManuscript: 15,
    });
    const terminal = ledgerV2.terminalLedger.find((entry) => entry.characterId === 'wicked_witch_of_the_west');
    expect(terminal?.terminalCondition).toBe('death');
    expect(terminal?.narrativeClosureStatus).toBe('fully_resolved');
    expect(ledgerV2.identityLedger.find((entry) => entry.characterId === 'wicked_witch_of_the_west')?.finalStatus).toBe('dead');
  });
});

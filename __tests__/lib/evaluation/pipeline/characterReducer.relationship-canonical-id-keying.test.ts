import { reduceCharacterEvidence, buildCharacterLedgerV2 } from '@/lib/evaluation/pipeline/characterReducer';
import { buildStoryLayerFromLedger } from '@/lib/evaluation/phase1a/buildStoryLayerFromLedger';
import type { Pass1aCharacterChunkEntry, Pass1aChunkOutput } from '@/lib/evaluation/pipeline/types';

type CharacterWithIdentity = Pass1aCharacterChunkEntry & {
  canonical_identity_group?: string;
  same_name_disambiguation_group?: string | null;
};

function character(
  overrides: Partial<CharacterWithIdentity> & {
    canonical_name: string;
    canonical_identity_group?: string;
  },
): CharacterWithIdentity {
  return {
    canonical_name: overrides.canonical_name,
    canonical_identity_group: overrides.canonical_identity_group ?? overrides.canonical_name,
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
    role_signal: overrides.role_signal ?? 'secondary',
    narrative_weight_signal: overrides.narrative_weight_signal ?? 'supporting',
    is_named: overrides.is_named ?? true,
    same_name_disambiguation: overrides.same_name_disambiguation_group ?? null,
    who_is_this: overrides.who_is_this ?? overrides.canonical_name,
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

function chunk(chunk_index: number, characters: CharacterWithIdentity[]): Pass1aChunkOutput {
  return {
    pass: '1a',
    axis: 'character_evidence_sweep',
    chunk_index,
    characters,
    prompt_version: 'test-relationship-canonical-id-keying',
    generated_at: '2026-05-29T00:00:00.000Z',
  };
}

describe('characterReducer relationship canonical-ID keying', () => {
  it('deduplicates Magwitch alias display variants into one canonical pair edge', () => {
    const chunkOutputs: Pass1aChunkOutput[] = [
      chunk(0, [
        character({
          canonical_name: 'Pip',
          canonical_identity_group: 'Pip',
          role_signal: 'protagonist',
          narrative_weight_signal: 'primary',
          relationship_signals: [
            { other_character: 'Magwitch', relationship_type: 'fear', dynamic: 'tense' },
          ],
          co_presence_confirmed: ['Magwitch'],
        }),
        character({
          canonical_name: 'Magwitch',
          canonical_identity_group: 'Abel Magwitch',
          aliases: ['Provis', 'the convict', 'unknown benefactor'],
          relationship_signals: [
            { other_character: 'Pip', relationship_type: 'fear', dynamic: 'tense' },
          ],
          co_presence_confirmed: ['Pip'],
        }),
      ]),
      chunk(1, [
        character({
          canonical_name: 'Pip',
          canonical_identity_group: 'Pip',
          relationship_signals: [
            { other_character: 'Provis', relationship_type: 'obligation', dynamic: 'shifting' },
          ],
          co_presence_confirmed: ['Provis'],
        }),
        character({
          canonical_name: 'Provis',
          canonical_identity_group: 'Abel Magwitch',
          aliases: ['Magwitch', 'the convict'],
          relationship_signals: [
            { other_character: 'Pip', relationship_type: 'obligation', dynamic: 'shifting' },
          ],
          co_presence_confirmed: ['Pip'],
        }),
      ]),
      chunk(2, [
        character({
          canonical_name: 'Pip',
          canonical_identity_group: 'Pip',
          relationship_signals: [
            { other_character: 'unknown benefactor', relationship_type: 'revelation', dynamic: 'shifting' },
          ],
          co_presence_confirmed: ['unknown benefactor'],
        }),
        character({
          canonical_name: 'unknown benefactor',
          canonical_identity_group: 'Abel Magwitch',
          aliases: ['Magwitch', 'Provis', 'the convict'],
          relationship_signals: [
            { other_character: 'Pip', relationship_type: 'revelation', dynamic: 'shifting' },
          ],
          co_presence_confirmed: ['Pip'],
        }),
      ]),
    ];

    const ledger = reduceCharacterEvidence({
      jobId: 'relationship-keying-ge',
      totalChunksInManuscript: 3,
      chunkOutputs,
    });

    const ledgerV2 = buildCharacterLedgerV2({
      ledger,
      chunkOutputs,
      jobId: 'relationship-keying-ge',
      totalChunksInManuscript: 3,
    });

    const pipId = ledgerV2.identityLedger.find((entry) => entry.canonicalName === 'Pip')?.characterId;
    const magwitchId = ledgerV2.identityLedger.find((entry) => entry.canonicalName === 'Abel Magwitch')?.characterId;
    expect(pipId).toBeDefined();
    expect(magwitchId).toBeDefined();

    const pipMagwitchEdges = ledgerV2.relationshipLedger.filter((edge) =>
      [edge.characterA, edge.characterB].includes(pipId as string) &&
      [edge.characterA, edge.characterB].includes(magwitchId as string),
    );

    expect(pipMagwitchEdges).toHaveLength(1);
    expect(pipMagwitchEdges[0].pairKey).toBe([pipId, magwitchId].sort().join('↔'));
    expect(pipMagwitchEdges[0].characterA <= pipMagwitchEdges[0].characterB).toBe(true);
  });

  it('keeps pair identity stable when display labels change', () => {
    const chunkOutputs: Pass1aChunkOutput[] = [
      chunk(0, [
        character({
          canonical_name: 'Pip',
          canonical_identity_group: 'Pip',
          role_signal: 'protagonist',
          narrative_weight_signal: 'primary',
          relationship_signals: [{ other_character: 'Magwitch', relationship_type: 'fear', dynamic: 'tense' }],
          co_presence_confirmed: ['Magwitch'],
        }),
        character({
          canonical_name: 'Magwitch',
          canonical_identity_group: 'Abel Magwitch',
          aliases: ['Provis'],
          relationship_signals: [{ other_character: 'Pip', relationship_type: 'fear', dynamic: 'tense' }],
          co_presence_confirmed: ['Pip'],
        }),
      ]),
    ];

    const ledger = reduceCharacterEvidence({
      jobId: 'relationship-keying-label-stability',
      totalChunksInManuscript: 1,
      chunkOutputs,
    });

    const ledgerV2 = buildCharacterLedgerV2({
      ledger,
      chunkOutputs,
      jobId: 'relationship-keying-label-stability',
      totalChunksInManuscript: 1,
    });

    const baseLayer = buildStoryLayerFromLedger(ledger, ledgerV2);
    const basePair = (baseLayer.relationship_network_layer as Record<string, any>).relationship_pairs[0];

    const mutatedLedgerV2 = JSON.parse(JSON.stringify(ledgerV2));
    mutatedLedgerV2.relationshipLedger[0].characterADisplayName = 'Philip Pirrip';
    mutatedLedgerV2.relationshipLedger[0].characterBDisplayName = 'the convict';

    const mutatedLayer = buildStoryLayerFromLedger(ledger, mutatedLedgerV2);
    const mutatedPair = (mutatedLayer.relationship_network_layer as Record<string, any>).relationship_pairs[0];

    expect(mutatedPair.pair_key).toBe(basePair.pair_key);
    expect(mutatedPair.character_a).toBe(basePair.character_a);
    expect(mutatedPair.character_b).toBe(basePair.character_b);
    expect(mutatedPair.character_a_label).toBe('Philip Pirrip');
    expect(mutatedPair.character_b_label).toBe('the convict');
  });

  it('preserves same-name disambiguation metadata without forcing incorrect merges', () => {
    const chunkOutputs: Pass1aChunkOutput[] = [
      chunk(0, [
        character({
          canonical_name: 'Pip',
          canonical_identity_group: 'Pip',
          role_signal: 'protagonist',
          narrative_weight_signal: 'primary',
          relationship_signals: [{ other_character: 'Joe Gargery', relationship_type: 'family', dynamic: 'intimate' }],
          co_presence_confirmed: ['Joe Gargery'],
        }),
        character({
          canonical_name: 'Joe Gargery',
          canonical_identity_group: 'Joe Gargery',
          aliases: ['Joe'],
          same_name_disambiguation_group: 'joe-gargery',
          relationship_signals: [{ other_character: 'Pip', relationship_type: 'family', dynamic: 'intimate' }],
          co_presence_confirmed: ['Pip'],
        }),
      ]),
      chunk(1, [
        character({
          canonical_name: 'Pip',
          canonical_identity_group: 'Pip',
          relationship_signals: [{ other_character: "Joe and Biddy's son", relationship_type: 'family', dynamic: 'intimate' }],
          co_presence_confirmed: ["Joe and Biddy's son"],
        }),
        character({
          canonical_name: "Joe and Biddy's son",
          canonical_identity_group: "Joe and Biddy's son",
          aliases: ['Joe'],
          same_name_disambiguation_group: 'joe-child',
          relationship_signals: [{ other_character: 'Pip', relationship_type: 'family', dynamic: 'intimate' }],
          co_presence_confirmed: ['Pip'],
        }),
      ]),
    ];

    const ledger = reduceCharacterEvidence({
      jobId: 'relationship-keying-disambiguation',
      totalChunksInManuscript: 2,
      chunkOutputs,
    });

    const ledgerV2 = buildCharacterLedgerV2({
      ledger,
      chunkOutputs,
      jobId: 'relationship-keying-disambiguation',
      totalChunksInManuscript: 2,
    });

    const identities = new Set(ledgerV2.identityLedger.map((entry) => entry.canonicalName));
    expect(identities.has('Joe Gargery')).toBe(true);
    expect(identities.has("Joe and Biddy's son")).toBe(true);

    const pipJoeEdges = ledgerV2.relationshipLedger.filter((edge) =>
      edge.characterADisplayName === 'Pip' || edge.characterBDisplayName === 'Pip',
    );
    expect(pipJoeEdges.length).toBeGreaterThanOrEqual(2);
    expect(
      pipJoeEdges.some((edge) => edge.characterASameNameDisambiguationGroup === 'joe-gargery' || edge.characterBSameNameDisambiguationGroup === 'joe-gargery'),
    ).toBe(true);
    expect(
      pipJoeEdges.some((edge) => edge.characterASameNameDisambiguationGroup === 'joe-child' || edge.characterBSameNameDisambiguationGroup === 'joe-child'),
    ).toBe(true);
  });
});

import { reduceCharacterEvidence } from '@/lib/evaluation/pipeline/characterReducer';
import type { Pass1aCharacterChunkEntry, Pass1aChunkOutput } from '@/lib/evaluation/pipeline/types';

type CharacterInput = Partial<Pass1aCharacterChunkEntry> & {
  canonical_name: string;
  pronouns: string[];
};

function makeCharacter(input: CharacterInput): Pass1aCharacterChunkEntry {
  return {
    canonical_name: input.canonical_name,
    aliases: input.aliases ?? [],
    pronouns: input.pronouns,
    age_signal: input.age_signal ?? 'adult',
    age_exact: input.age_exact ?? null,
    life_stage_evidence: input.life_stage_evidence ?? null,
    gender_identity: input.gender_identity ?? 'unknown',
    lgbtq_signals: input.lgbtq_signals ?? [],
    racial_ethnic_signals: input.racial_ethnic_signals ?? [],
    skin_tone_signals: input.skin_tone_signals ?? [],
    language_signals: input.language_signals ?? [],
    religion_signals: input.religion_signals ?? [],
    socioeconomic_signals: input.socioeconomic_signals ?? [],
    nationality_signals: input.nationality_signals ?? [],
    disability_neuro_signals: input.disability_neuro_signals ?? [],
    role_signal: input.role_signal ?? 'secondary',
    narrative_weight_signal: input.narrative_weight_signal ?? 'supporting',
    is_named: input.is_named ?? true,
    same_name_disambiguation: input.same_name_disambiguation ?? null,
    who_is_this: input.who_is_this ?? input.canonical_name,
    what_do_they_want: input.what_do_they_want ?? null,
    where_are_they: input.where_are_they ?? null,
    when_signal: input.when_signal ?? null,
    why_signal: input.why_signal ?? null,
    how_signal: input.how_signal ?? null,
    arc_state_in_chunk: input.arc_state_in_chunk ?? 'present in scene',
    arc_pressure: input.arc_pressure ?? null,
    arc_shift: input.arc_shift ?? null,
    is_ending_chunk: input.is_ending_chunk ?? false,
    symbolic_objects: input.symbolic_objects ?? [],
    relationship_signals: input.relationship_signals ?? [],
    evidence_anchors: input.evidence_anchors ?? [
      {
        excerpt: `${input.canonical_name} appears`,
        evidence_type: 'identity',
        confidence: 'explicit',
      },
    ],
    co_presence_confirmed: input.co_presence_confirmed ?? [],
    negative_knowledge: input.negative_knowledge ?? [],
  };
}

function makeChunk(index: number, character: Pass1aCharacterChunkEntry): Pass1aChunkOutput {
  return {
    pass: '1a',
    axis: 'character_evidence_sweep',
    chunk_index: index,
    characters: [character],
    prompt_version: 'test-pronoun-family-display',
    generated_at: '2026-05-30T00:00:00.000Z',
  };
}

function getWarningsFor(characterName: string, chunkOutputs: Pass1aChunkOutput[]): string[] {
  const ledger = reduceCharacterEvidence({
    jobId: `pronoun-family-${characterName.toLowerCase().replace(/\s+/g, '-')}`,
    totalChunksInManuscript: chunkOutputs.length,
    chunkOutputs,
  });

  const entry = ledger.entries.find((e) => e.canonical_name === characterName);
  return (entry?.warnings ?? []).map((w) => w.type);
}

describe('characterReducer pronoun-family warning guardrails', () => {
  it('does not flag stable masculine case variants as a pronoun shift', () => {
    const warnings = getWarningsFor('Pip', [
      makeChunk(0, makeCharacter({ canonical_name: 'Pip', pronouns: ['he/him'] })),
      makeChunk(1, makeCharacter({ canonical_name: 'Pip', pronouns: ['he/him/his'] })),
    ]);

    expect(warnings).not.toContain('pronoun_inconsistency');
  });

  it('does not flag stable feminine case variants as a pronoun shift', () => {
    const warnings = getWarningsFor('Edna Pontellier', [
      makeChunk(0, makeCharacter({ canonical_name: 'Edna Pontellier', pronouns: ['she/her'] })),
      makeChunk(1, makeCharacter({ canonical_name: 'Edna Pontellier', pronouns: ['she/her/hers'] })),
    ]);

    expect(warnings).not.toContain('pronoun_inconsistency');
  });

  it('does not flag stable mixed neutral-plus-known pronouns by default', () => {
    const warnings = getWarningsFor('Jordan', [
      makeChunk(0, makeCharacter({ canonical_name: 'Jordan', pronouns: ['he/they'] })),
      makeChunk(1, makeCharacter({ canonical_name: 'Jordan', pronouns: ['he/they'] })),
    ]);

    expect(warnings).not.toContain('pronoun_inconsistency');
  });

  it('does not flag custom or uncommon pronouns by default when stable', () => {
    const warnings = getWarningsFor('Ari', [
      makeChunk(0, makeCharacter({ canonical_name: 'Ari', pronouns: ['thon/thons'] })),
      makeChunk(1, makeCharacter({ canonical_name: 'Ari', pronouns: ['thon/thons'] })),
    ]);

    expect(warnings).not.toContain('pronoun_inconsistency');
  });

  it('flags cross-family shifts that require review', () => {
    const warnings = getWarningsFor('Robin', [
      makeChunk(0, makeCharacter({ canonical_name: 'Robin', pronouns: ['he/him'] })),
      makeChunk(1, makeCharacter({ canonical_name: 'Robin', pronouns: ['she/her'] })),
    ]);

    expect(warnings).toContain('pronoun_inconsistency');
  });

  it('does not flag collective-plus-one-known family pronoun signals', () => {
    const warnings = getWarningsFor('Ambiguous Figure', [
      makeChunk(0, makeCharacter({ canonical_name: 'Ambiguous Figure', pronouns: ['he/they'] })),
    ]);

    expect(warnings).not.toContain('pronoun_inconsistency');
  });
});

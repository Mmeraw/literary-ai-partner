/**
 * Regression test: The Awakening — expanded role taxonomy
 *
 * Verifies that the character reducer correctly carries through
 * the expanded pressure-function taxonomy (v9+) when LLM chunks
 * use the new role_signal values instead of flattening to "antagonist".
 *
 * Expected role assignments for The Awakening:
 * - Edna Pontellier = protagonist
 * - Robert Lebrun = romantic_catalyst (NOT co_protagonist)
 * - Léonce Pontellier = pressure_agent (NOT antagonist)
 * - Alcée Arobin = sexual_destabilizer (NOT antagonist)
 * - Adèle Ratignolle = domestic_foil (NOT mentor)
 * - Mademoiselle Reisz = artistic_countermodel
 * - Doctor Mandelet = social_observer
 * - Célina's husband = background_mention
 * - The sea = symbolic_force
 * - Creole social code = collective_force
 */

import { buildCharacterLedgerV2, reduceCharacterEvidence } from '@/lib/evaluation/pipeline/characterReducer';
import type { Pass1aChunkOutput, Pass1aCharacterChunkEntry } from '@/lib/evaluation/pipeline/types';

function character(
  overrides: Partial<Pass1aCharacterChunkEntry> & {
    canonical_name: string;
    canonical_identity_group?: string;
  },
): Pass1aCharacterChunkEntry & { canonical_identity_group?: string } {
  return {
    canonical_name: overrides.canonical_name,
    canonical_identity_group: overrides.canonical_identity_group ?? overrides.canonical_name,
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
    role_signal: overrides.role_signal ?? 'secondary',
    narrative_weight_signal: overrides.narrative_weight_signal ?? 'supporting',
    is_named: overrides.is_named ?? true,
    who_is_this: overrides.who_is_this ?? `${overrides.canonical_name}`,
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

function chunk(
  chunk_index: number,
  characters: Array<Pass1aCharacterChunkEntry & { canonical_identity_group?: string }>,
): Pass1aChunkOutput {
  return {
    pass: '1a',
    axis: 'character_evidence_sweep',
    chunk_index,
    characters,
    prompt_version: 'pass1a-character-sweep-v9-pressure-taxonomy',
    generated_at: '2026-05-29T00:00:00.000Z',
  };
}

describe('The Awakening — expanded role taxonomy regression', () => {
  it('carries pressure-function roles through reducer without flattening to antagonist', () => {
    const ledger = reduceCharacterEvidence({
      jobId: 'awakening-taxonomy-test',
      totalChunksInManuscript: 4,
      chunkOutputs: [
        chunk(0, [
          character({
            canonical_name: 'Edna Pontellier',
            aliases: ['Mrs. Pontellier', 'Edna'],
            role_signal: 'protagonist',
            narrative_weight_signal: 'primary',
            gender_identity: 'woman',
            who_is_this: 'Wife, mother, protagonist undergoing awakening',
          }),
          character({
            canonical_name: 'Robert Lebrun',
            aliases: ['Robert'],
            role_signal: 'romantic_catalyst',
            narrative_weight_signal: 'major',
            gender_identity: 'man',
            pronouns: ['he/him'],
            who_is_this: 'Young man who triggers Edna\'s romantic awakening',
          }),
          character({
            canonical_name: 'Léonce Pontellier',
            aliases: ['Mr. Pontellier', 'Léonce'],
            role_signal: 'pressure_agent',
            narrative_weight_signal: 'major',
            gender_identity: 'man',
            pronouns: ['he/him'],
            who_is_this: 'Edna\'s husband; applies marital, social, and property pressure',
            arc_pressure: 'Enforces Creole social expectations on Edna',
          }),
          character({
            canonical_name: 'Adèle Ratignolle',
            aliases: ['Madame Ratignolle', 'Adèle'],
            role_signal: 'domestic_foil',
            narrative_weight_signal: 'major',
            gender_identity: 'woman',
            who_is_this: 'The ideal mother-woman against whom Edna is measured',
          }),
        ]),
        chunk(1, [
          character({
            canonical_name: 'Edna Pontellier',
            role_signal: 'protagonist',
            narrative_weight_signal: 'primary',
          }),
          character({
            canonical_name: 'Alcée Arobin',
            aliases: ['Arobin'],
            role_signal: 'sexual_destabilizer',
            narrative_weight_signal: 'supporting',
            gender_identity: 'man',
            pronouns: ['he/him'],
            who_is_this: 'Seductive man who introduces Edna to sexual experience',
          }),
          character({
            canonical_name: 'Mademoiselle Reisz',
            aliases: ['Mlle Reisz'],
            role_signal: 'artistic_countermodel',
            narrative_weight_signal: 'supporting',
            gender_identity: 'woman',
            who_is_this: 'Severe pianist who models artistic autonomy',
          }),
        ]),
        chunk(2, [
          character({
            canonical_name: 'Edna Pontellier',
            role_signal: 'protagonist',
            narrative_weight_signal: 'primary',
          }),
          character({
            canonical_name: 'Doctor Mandelet',
            aliases: ['Dr. Mandelet'],
            role_signal: 'social_observer',
            narrative_weight_signal: 'minor',
            gender_identity: 'man',
            pronouns: ['he/him'],
            who_is_this: 'Family doctor who observes Edna\'s transformation',
          }),
          character({
            canonical_name: 'Célina\'s husband',
            role_signal: 'background_mention',
            narrative_weight_signal: 'minor',
            gender_identity: 'man',
            pronouns: ['he/him'],
            who_is_this: 'Referenced in passing social gossip',
          }),
        ]),
        chunk(3, [
          character({
            canonical_name: 'The sea',
            role_signal: 'symbolic_force',
            narrative_weight_signal: 'major',
            is_named: false,
            gender_identity: 'unknown',
            pronouns: [],
            who_is_this: 'The Gulf as symbolic force: freedom, dissolution, death',
            arc_pressure: 'Calls Edna toward freedom and self-destruction',
          }),
          character({
            canonical_name: 'Creole social code',
            role_signal: 'collective_force',
            narrative_weight_signal: 'major',
            is_named: false,
            gender_identity: 'unknown',
            pronouns: [],
            who_is_this: 'Social expectations around motherhood, marriage, and propriety',
            arc_pressure: 'Constrains Edna\'s autonomy through convention',
          }),
        ]),
      ],
    });

    // Edna must be protagonist
    const edna = ledger.entries.find((e) => e.canonical_name === 'Edna Pontellier');
    expect(edna).toBeDefined();
    expect(edna?.role).toBe('protagonist');

    // Robert must be romantic_catalyst, NOT co_protagonist or antagonist
    const robert = ledger.entries.find((e) => e.canonical_name === 'Robert Lebrun');
    expect(robert).toBeDefined();
    expect(robert?.role).toBe('romantic_catalyst');
    expect(robert?.role).not.toBe('co_protagonist');
    expect(robert?.role).not.toBe('antagonist');

    // Léonce must be pressure_agent, NOT antagonist
    const leonce = ledger.entries.find((e) => e.canonical_name === 'Léonce Pontellier');
    expect(leonce).toBeDefined();
    expect(leonce?.role).toBe('pressure_agent');
    expect(leonce?.role).not.toBe('antagonist');

    // Arobin must be sexual_destabilizer, NOT antagonist
    const arobin = ledger.entries.find((e) => e.canonical_name === 'Alcée Arobin');
    expect(arobin).toBeDefined();
    expect(arobin?.role).toBe('sexual_destabilizer');
    expect(arobin?.role).not.toBe('antagonist');

    // Adèle must be domestic_foil, NOT mentor
    const adele = ledger.entries.find((e) => e.canonical_name === 'Adèle Ratignolle');
    expect(adele).toBeDefined();
    expect(adele?.role).toBe('domestic_foil');
    expect(adele?.role).not.toBe('mentor');

    // Mademoiselle Reisz must be artistic_countermodel
    const reisz = ledger.entries.find((e) => e.canonical_name === 'Mademoiselle Reisz');
    expect(reisz).toBeDefined();
    expect(reisz?.role).toBe('artistic_countermodel');

    // Doctor Mandelet must be social_observer
    const mandelet = ledger.entries.find((e) => e.canonical_name === 'Doctor Mandelet');
    expect(mandelet).toBeDefined();
    expect(mandelet?.role).toBe('social_observer');

    // Célina's husband must be background_mention, NOT promoted
    const celina = ledger.entries.find((e) => e.canonical_name === "Célina's husband");
    expect(celina).toBeDefined();
    expect(celina?.role).toBe('background_mention');

    // The sea must be symbolic_force
    const sea = ledger.entries.find((e) => e.canonical_name === 'The sea');
    expect(sea).toBeDefined();
    expect(sea?.role).toBe('symbolic_force');

    // Creole social code must be collective_force
    const socialCode = ledger.entries.find((e) => e.canonical_name === 'Creole social code');
    expect(socialCode).toBeDefined();
    expect(socialCode?.role).toBe('collective_force');

    // Coverage summary: ONLY Edna should be in protagonists.
    // 0 antagonists for The Awakening; pressure comes from social role, marriage,
    // motherhood, desire, convention, and symbolic environment rather than a true villain.
    expect(ledger.coverage_summary.protagonists).toEqual(['Edna Pontellier']);
    expect(ledger.coverage_summary.antagonists).toEqual([]);
  });

  it('sorts entries by role priority: protagonist > pressure > catalyst > foil > observer > background', () => {
    const ledger = reduceCharacterEvidence({
      jobId: 'awakening-sort-test',
      totalChunksInManuscript: 1,
      chunkOutputs: [
        chunk(0, [
          character({ canonical_name: 'Background Figure', role_signal: 'background_mention', narrative_weight_signal: 'minor' }),
          character({ canonical_name: 'Edna', role_signal: 'protagonist', narrative_weight_signal: 'primary' }),
          character({ canonical_name: 'Léonce', role_signal: 'pressure_agent', narrative_weight_signal: 'major' }),
          character({ canonical_name: 'Adèle', role_signal: 'domestic_foil', narrative_weight_signal: 'major' }),
          character({ canonical_name: 'Dr. Mandelet', role_signal: 'social_observer', narrative_weight_signal: 'minor' }),
          character({ canonical_name: 'Robert', role_signal: 'romantic_catalyst', narrative_weight_signal: 'major' }),
        ]),
      ],
    });

    const order = ledger.entries.map((e) => e.canonical_name);
    const ednaIdx = order.indexOf('Edna');
    const leonceIdx = order.indexOf('Léonce');
    const robertIdx = order.indexOf('Robert');
    const adeleIdx = order.indexOf('Adèle');
    const mandeletIdx = order.indexOf('Dr. Mandelet');
    const bgIdx = order.indexOf('Background Figure');

    // protagonist before pressure_agent before romantic_catalyst
    expect(ednaIdx).toBeLessThan(leonceIdx);
    expect(ednaIdx).toBeLessThan(robertIdx);
    // pressure_agent (7) = romantic_catalyst (7), both before domestic_foil (5)
    expect(leonceIdx).toBeLessThan(adeleIdx);
    expect(robertIdx).toBeLessThan(adeleIdx);
    // domestic_foil before social_observer
    expect(adeleIdx).toBeLessThan(mandeletIdx);
    // background_mention is last
    expect(bgIdx).toBe(order.length - 1);
  });

  it('keeps thematic cost and storefront/product labels out of character identity', () => {
    const ledger = reduceCharacterEvidence({
      jobId: 'price-of-vanity-entity-hygiene-test',
      totalChunksInManuscript: 1,
      chunkOutputs: [
        chunk(0, [
          character({
            canonical_name: 'Unnamed male narrator/protagonist',
            role_signal: 'protagonist',
            narrative_weight_signal: 'primary',
            gender_identity: 'man',
            pronouns: ['he/him'],
            who_is_this: 'The main character whose vanity-driven decisions generate the cost motif.',
            symbolic_objects: [
              { object: 'Revlon Frost&Glow product', function: 'The hair-coloring product that initiates the visible damage sequence.' },
              { object: "Cost tallies and 'Total cost' figure", function: 'The running money ledger that measures the price of vanity.' },
            ],
          }),
          character({
            canonical_name: 'Kim',
            role_signal: 'pressure_agent',
            narrative_weight_signal: 'major',
            who_is_this: 'The stylist who corrects the narrator\'s hair and values.',
          }),
          character({
            canonical_name: 'Cost',
            role_signal: 'symbolic_force',
            narrative_weight_signal: 'major',
            is_named: false,
            gender_identity: 'unknown',
            pronouns: [],
            who_is_this: 'The theme of escalating monetary and emotional cost.',
          }),
          character({
            canonical_name: "Cost tallies and 'Total cost' figure",
            role_signal: 'symbolic_force',
            narrative_weight_signal: 'major',
            is_named: false,
            gender_identity: 'unknown',
            pronouns: [],
            who_is_this: 'A running accounting motif, not a character.',
          }),
          character({
            canonical_name: 'Shoppers Drug Mart',
            role_signal: 'collective_force',
            narrative_weight_signal: 'minor',
            is_named: false,
            gender_identity: 'unknown',
            pronouns: [],
            who_is_this: 'A retail location where the narrator buys a hair dye kit.',
          }),
          character({
            canonical_name: 'Revlon Frost&Glow',
            role_signal: 'symbolic_force',
            narrative_weight_signal: 'minor',
            is_named: false,
            gender_identity: 'unknown',
            pronouns: [],
            who_is_this: 'A hair coloring product/object, not an identity.',
          }),
          character({
            canonical_name: 'The sea',
            role_signal: 'symbolic_force',
            narrative_weight_signal: 'major',
            is_named: false,
            gender_identity: 'unknown',
            pronouns: [],
            who_is_this: 'A legitimate symbolic/environmental force in a literary ledger.',
          }),
        ]),
      ],
    });

    const names = ledger.entries.map((e) => e.canonical_name);
    expect(names).toEqual(expect.arrayContaining([
      'Unnamed male narrator/protagonist',
      'Kim',
      'The sea',
    ]));
    expect(names).not.toEqual(expect.arrayContaining([
      'Cost',
      "Cost tallies and 'Total cost' figure",
      'Shoppers Drug Mart',
      'Revlon Frost&Glow',
    ]));

    const ledgerV2 = buildCharacterLedgerV2({
      ledger,
      chunkOutputs: [
        chunk(0, [
          character({
            canonical_name: 'Unnamed male narrator/protagonist',
            role_signal: 'protagonist',
            narrative_weight_signal: 'primary',
            gender_identity: 'man',
            pronouns: ['he/him'],
            symbolic_objects: [
              { object: 'Revlon Frost&Glow product', function: 'The hair-coloring product that initiates the visible damage sequence.' },
              { object: "Cost tallies and 'Total cost' figure", function: 'The running money ledger that measures the price of vanity.' },
            ],
          }),
        ]),
      ],
      jobId: 'price-of-vanity-entity-hygiene-test',
      totalChunksInManuscript: 1,
    });

    expect(ledgerV2.objectLedger.map((object) => object.objectName)).toEqual(expect.arrayContaining([
      'Revlon Frost&Glow product',
      "Cost tallies and 'Total cost' figure",
    ]));
  });

  it('disambiguates the same noun as person, plant, or town by evidence context', () => {
    const humanLedger = reduceCharacterEvidence({
      jobId: 'fern-human-test',
      totalChunksInManuscript: 1,
      chunkOutputs: [
        chunk(0, [
          character({
            canonical_name: 'Fern',
            role_signal: 'secondary',
            narrative_weight_signal: 'supporting',
            gender_identity: 'woman',
            pronouns: ['she/her'],
            who_is_this: 'Fern is a human neighbor who speaks with the narrator.',
            evidence_anchors: [{ excerpt: 'Fern said she would help.', evidence_type: 'identity', confidence: 'explicit' }],
          }),
        ]),
      ],
    });

    expect(humanLedger.entries.map((entry) => entry.canonical_name)).toContain('Fern');

    const plantLedger = reduceCharacterEvidence({
      jobId: 'fern-plant-test',
      totalChunksInManuscript: 1,
      chunkOutputs: [
        chunk(0, [
          character({
            canonical_name: 'Fern',
            role_signal: 'symbolic_force',
            narrative_weight_signal: 'minor',
            is_named: false,
            gender_identity: 'unknown',
            pronouns: ['it/its'],
            descriptors: ['plant', 'botanical object'],
            who_is_this: 'A fern plant in the windowsill, functioning as an object motif.',
            evidence_anchors: [{ excerpt: 'The fern drooped in the window.', evidence_type: 'symbol', confidence: 'explicit' }],
          }),
        ]),
      ],
    });

    expect(plantLedger.entries.map((entry) => entry.canonical_name)).not.toContain('Fern');

    const townLedger = reduceCharacterEvidence({
      jobId: 'fern-town-test',
      totalChunksInManuscript: 1,
      chunkOutputs: [
        chunk(0, [
          character({
            canonical_name: 'Fern',
            role_signal: 'collective_force',
            narrative_weight_signal: 'minor',
            is_named: false,
            gender_identity: 'unknown',
            pronouns: ['it/its'],
            descriptors: ['town', 'location'],
            who_is_this: 'Fern is the town where the family lives, a setting rather than a person.',
            evidence_anchors: [{ excerpt: 'They drove into Fern before sundown.', evidence_type: 'identity', confidence: 'explicit' }],
          }),
        ]),
      ],
    });

    expect(townLedger.entries.map((entry) => entry.canonical_name)).not.toContain('Fern');

    const animalLedger = reduceCharacterEvidence({
      jobId: 'fern-animal-test',
      totalChunksInManuscript: 1,
      chunkOutputs: [
        chunk(0, [
          character({
            canonical_name: 'Fern',
            role_signal: 'animal_companion',
            narrative_weight_signal: 'supporting',
            is_named: true,
            gender_identity: 'unknown',
            pronouns: ['it/its'],
            descriptors: ['named dog', 'animal companion'],
            who_is_this: 'Fern is a named animal companion that follows the child home.',
            evidence_anchors: [{ excerpt: 'Fern wagged its tail.', evidence_type: 'identity', confidence: 'explicit' }],
          }),
        ]),
      ],
    });

    expect(animalLedger.entries.map((entry) => entry.canonical_name)).toContain('Fern');
  });
});

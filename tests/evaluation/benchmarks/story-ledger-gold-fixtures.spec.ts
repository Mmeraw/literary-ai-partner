import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();
const FIXTURE_DIR = join(REPO_ROOT, 'tests/testdata/evaluation/story-ledger');

function readJson(fileName: string): any {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, fileName), 'utf8'));
}

function hasText(value: unknown, needle: string): boolean {
  return String(value ?? '').toLowerCase().includes(needle.toLowerCase());
}

function getIdentity(ledger: any, characterId: string): any | undefined {
  return (ledger.layers?.canonical_identity_layer?.identity_groups ?? []).find(
    (entry: any) => entry.character_id === characterId,
  );
}

function getTierEntries(ledger: any, tier: string): any[] {
  return ledger.layers?.cast_role_tier_layer?.tier_map?.[tier] ?? [];
}

function canonicalPairKey(a: string, b: string): string {
  return [a, b].sort().join('↔');
}

function collectCanonicalPairKeys(relationshipPairs: any[]): string[] {
  return relationshipPairs.map((pair) =>
    canonicalPairKey(String(pair?.character_a ?? ''), String(pair?.character_b ?? '')),
  );
}

function validateGreatExpectations(ledger: any): string[] {
  const errors: string[] = [];

  const pip = getIdentity(ledger, 'ge:pip');
  const joeChild = getIdentity(ledger, 'ge:joe_biddy_son');
  if (!pip || !joeChild || pip.character_id === joeChild.character_id) {
    errors.push('MISSING_REQUIRED_TRUTH: Pip / Philip Pirrip must be distinct from Joe and Biddy\'s son.');
  }

  const magwitch = getIdentity(ledger, 'ge:magwitch');
  const magwitchAliases = new Set((magwitch?.aliases ?? []).map((a: string) => a.toLowerCase()));
  for (const alias of ['magwitch', 'abel magwitch', 'provis', 'convict', 'unknown benefactor']) {
    const inCanonical = hasText(magwitch?.canonical_name, alias);
    const inAliases = Array.from(magwitchAliases).some((a) => a.includes(alias));
    if (!inCanonical && !inAliases) {
      errors.push(`MISSING_REQUIRED_TRUTH: Magwitch identity linkage missing alias '${alias}'.`);
    }
  }

  const povIds = new Set((ledger.layers?.pov_structure_layer?.pov_characters ?? []).map((entry: any) => entry.character_id));
  if (povIds.has('ge:herbert')) {
    errors.push('FORBIDDEN_FAILURE: Herbert Pocket must not be a POV owner.');
  }

  const pronounEntries = ledger.layers?.identity_pronoun_layer?.entries ?? [];
  const pipPronounEntry = pronounEntries.find((entry: any) => hasText(entry.canonical_name, 'pip'));
  if (!((pipPronounEntry?.pronouns ?? []).some((p: string) => p.toLowerCase().includes('he/him/his')))) {
    errors.push('MISSING_REQUIRED_TRUTH: Pip pronoun record must include he/him/his.');
  }
  if ((pipPronounEntry?.warnings ?? []).some((warning: any) => hasText(warning?.type ?? warning, 'pronoun_inconsistency'))) {
    errors.push('FORBIDDEN_FAILURE: he/him/his must not be flagged as a pronoun shift.');
  }

  const relationshipPairs = ledger.layers?.relationship_network_layer?.relationship_pairs ?? [];
  const canonicalPairKeys = collectCanonicalPairKeys(relationshipPairs);

  for (const pair of relationshipPairs) {
    for (const side of ['character_a', 'character_b'] as const) {
      const value = pair?.[side];
      if (typeof value !== 'string' || !value.includes(':')) {
        errors.push(
          `FORBIDDEN_FAILURE: Relationship pair ${pair?.character_a ?? '?'} -> ${pair?.character_b ?? '?'} must use canonical ID references, not display names.`,
        );
      }
    }
  }

  const expectedPairs = [
    canonicalPairKey('ge:pip', 'ge:magwitch'),
    canonicalPairKey('ge:pip', 'ge:joe'),
    canonicalPairKey('ge:pip', 'ge:estella'),
    canonicalPairKey('ge:pip', 'ge:miss_havisham'),
    canonicalPairKey('ge:estella', 'ge:miss_havisham'),
    canonicalPairKey('ge:magwitch', 'ge:compeyson'),
    canonicalPairKey('ge:pip', 'ge:jaggers'),
    canonicalPairKey('ge:pip', 'ge:biddy'),
    canonicalPairKey('ge:pip', 'ge:orlick'),
  ];

  for (const pair of expectedPairs) {
    if (!canonicalPairKeys.includes(pair)) {
      errors.push(`MISSING_REQUIRED_TRUTH: Missing stable canonical relationship pair '${pair}'.`);
    }
  }

  const byPair = new Map<string, number>();
  for (const key of canonicalPairKeys) {
    byPair.set(key, (byPair.get(key) ?? 0) + 1);
  }
  for (const [pairKey, count] of byPair.entries()) {
    if (count > 1) {
      errors.push(
        `FORBIDDEN_FAILURE: RELATIONSHIP_DISPLAY_NAME_KEYING duplicate display-name edges found for canonical pair '${pairKey}'.`,
      );
    }
  }

  const threatText = JSON.stringify(
    ledger.layers?.threat_antagonist_ending_layer?.threat_systems ??
      ledger.layers?.threat_antagonist_ending_layer?.antagonists ?? [],
  ).toLowerCase();
  for (const requiredThreat of [
    'magwitch',
    'miss havisham',
    'estella',
    'jaggers/legal machinery',
    'orlick',
    'drummle',
    'class shame',
    'debt',
    "pip's guilt",
  ]) {
    if (!threatText.includes(requiredThreat)) {
      errors.push(`MISSING_REQUIRED_TRUTH: Threat system missing '${requiredThreat}'.`);
    }
  }

  return errors;
}

function validateAwakening(ledger: any): string[] {
  const errors: string[] = [];

  const protagonists = getTierEntries(ledger, 'protagonist');
  if (!protagonists.some((entry: any) => entry.character_id === 'aw:edna')) {
    errors.push('MISSING_REQUIRED_TRUTH: Edna Pontellier must be protagonist / primary focal center.');
  }

  const povIds = new Set((ledger.layers?.pov_structure_layer?.pov_characters ?? []).map((entry: any) => entry.character_id));
  if (!povIds.has('aw:edna')) {
    errors.push('MISSING_REQUIRED_TRUTH: Edna Pontellier must own POV.');
  }
  if (povIds.has('aw:robert')) {
    errors.push('FORBIDDEN_FAILURE: Robert Lebrun must not be POV owner.');
  }

  const coProtagonists = getTierEntries(ledger, 'co_protagonist');
  if (coProtagonists.some((entry: any) => entry.character_id === 'aw:robert')) {
    errors.push('FORBIDDEN_FAILURE: Robert Lebrun must not be default co-protagonist.');
  }

  if (!getTierEntries(ledger, 'patriarchal_pressure').some((entry: any) => entry.character_id === 'aw:leonce')) {
    errors.push('MISSING_REQUIRED_TRUTH: Léonce must be classified as marital/social/property pressure.');
  }

  if (!getTierEntries(ledger, 'sexual_destabilizer').some((entry: any) => entry.character_id === 'aw:arobin')) {
    errors.push('MISSING_REQUIRED_TRUTH: Alcée Arobin must be classified as sexual destabilizer.');
  }

  if (!getTierEntries(ledger, 'domestic_foil').some((entry: any) => entry.character_id === 'aw:adele')) {
    errors.push('MISSING_REQUIRED_TRUTH: Adèle Ratignolle must be classified as maternal/domestic foil.');
  }

  if (!getTierEntries(ledger, 'artistic_countermodel').some((entry: any) => entry.character_id === 'aw:reisz')) {
    errors.push('MISSING_REQUIRED_TRUTH: Mademoiselle Reisz must be classified as artistic counter-model / severe mentor.');
  }

  if (!getTierEntries(ledger, 'background_mention').some((entry: any) => entry.character_id === 'aw:celina_husband')) {
    errors.push('MISSING_REQUIRED_TRUTH: Célina\'s husband must remain background mention, not core cast.');
  }

  const relationshipLayer = ledger.layers?.relationship_network_layer ?? {};
  const relationshipPairs = relationshipLayer.relationship_pairs ?? [];
  const canonicalPairKeys = collectCanonicalPairKeys(relationshipPairs);
  if (!relationshipLayer.relationship_tiers || Object.keys(relationshipLayer.relationship_tiers).length === 0) {
    errors.push('MISSING_REQUIRED_TRUTH: Relationship network must be tiered/classified.');
  }
  if (relationshipPairs.some((pair: any) => hasText(pair.relationship_type_start, 'unknown') || hasText(pair.relationship_type_end, 'unknown'))) {
    errors.push('FORBIDDEN_FAILURE: Relationship pairs must not collapse into unknown co-occurrence dumping.');
  }

  const expectedPairs = [
    canonicalPairKey('aw:edna', 'aw:robert'),
    canonicalPairKey('aw:edna', 'aw:leonce'),
    canonicalPairKey('aw:edna', 'aw:arobin'),
    canonicalPairKey('aw:edna', 'aw:adele'),
    canonicalPairKey('aw:edna', 'aw:reisz'),
    canonicalPairKey('aw:edna', 'aw:children'),
    canonicalPairKey('aw:edna', 'aw:sea_symbolic_pressure'),
  ];

  for (const pair of expectedPairs) {
    if (!canonicalPairKeys.includes(pair)) {
      errors.push(`MISSING_REQUIRED_TRUTH: Missing stable canonical relationship pair '${pair}'.`);
    }
  }

  const byPair = new Map<string, number>();
  for (const key of canonicalPairKeys) {
    byPair.set(key, (byPair.get(key) ?? 0) + 1);
  }
  for (const [pairKey, count] of byPair.entries()) {
    if (count > 1) {
      errors.push(
        `FORBIDDEN_FAILURE: RELATIONSHIP_DISPLAY_NAME_KEYING duplicate display-name edges found for canonical pair '${pairKey}'.`,
      );
    }
  }

  const symbolText = JSON.stringify(ledger.layers?.object_symbol_layer?.objects ?? []).toLowerCase();
  for (const symbolNeedle of [
    'sea / gulf / water',
    'birds / flight',
    'pigeon house',
    'wedding ring',
    'music / piano',
    'letters',
    "edna's art / sketching",
  ]) {
    if (!symbolText.includes(symbolNeedle)) {
      errors.push(`MISSING_REQUIRED_TRUTH: Core symbol missing '${symbolNeedle}'.`);
    }
  }

  const pronounEntries = ledger.layers?.identity_pronoun_layer?.entries ?? [];
  const targetNames = ['raoul pontellier', 'étienne pontellier', 'robert lebrun'];
  for (const name of targetNames) {
    const entry = pronounEntries.find((candidate: any) => hasText(candidate.canonical_name, name));
    if (!entry) {
      errors.push(`MISSING_REQUIRED_TRUTH: Pronoun identity entry missing for '${name}'.`);
      continue;
    }
    if ((entry.warnings ?? []).some((warning: any) => hasText(warning?.type ?? warning, 'pronoun_inconsistency'))) {
      errors.push(`FORBIDDEN_FAILURE: '${name}' must not be flagged as pronoun-transition problem.`);
    }
  }

  const locations: string[] = ledger.layers?.location_timeline_worldstate_layer?.unique_locations ?? [];
  for (const requiredLocation of ['grand isle', 'new orleans', 'chênière caminada', 'pigeon house']) {
    if (!locations.some((loc) => loc.toLowerCase() === requiredLocation)) {
      errors.push(`MISSING_REQUIRED_TRUTH: Location anchor missing '${requiredLocation}'.`);
    }
  }
  if (locations.some((loc) => loc.trim().length < 4 || /[.!?]$/.test(loc.trim()))) {
    errors.push('FORBIDDEN_FAILURE: Locations must be normalized anchors, not sentence fragments.');
  }

  return errors;
}

describe('Story Ledger gold fixture harness (deterministic, no live LLM calls)', () => {
  const greatExpectations = readJson('great-expectations.accepted-story-ledger.fixture.json');
  const awakening = readJson('the-awakening.accepted-story-ledger.fixture.json');

  it('passes required-truth + forbidden-failure checks for Great Expectations fixture', () => {
    const errors = validateGreatExpectations(greatExpectations);
    expect(errors).toEqual([]);
  });

  it('fails loudly when Great Expectations required truth is missing', () => {
    const mutated = JSON.parse(JSON.stringify(greatExpectations));
    mutated.layers.canonical_identity_layer.identity_groups = mutated.layers.canonical_identity_layer.identity_groups.filter(
      (entry: any) => entry.character_id !== 'ge:magwitch',
    );

    const errors = validateGreatExpectations(mutated);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('MISSING_REQUIRED_TRUTH: Magwitch identity linkage missing alias'),
      ]),
    );
  });

  it('fails loudly when Great Expectations forbidden failure recurs', () => {
    const mutated = JSON.parse(JSON.stringify(greatExpectations));
    mutated.layers.pov_structure_layer.pov_characters.push({
      character_id: 'ge:herbert',
      canonical_name: 'Herbert Pocket',
      is_primary: false,
    });

    const errors = validateGreatExpectations(mutated);
    expect(errors).toEqual(
      expect.arrayContaining([
        'FORBIDDEN_FAILURE: Herbert Pocket must not be a POV owner.',
      ]),
    );
  });

  it('fails loudly on duplicate display-name relationship edges (RELATIONSHIP_DISPLAY_NAME_KEYING)', () => {
    const mutated = JSON.parse(JSON.stringify(greatExpectations));
    mutated.layers.relationship_network_layer.relationship_pairs.push({
      pair_key: 'ge:magwitch↔ge:pip',
      character_a: 'ge:pip',
      character_b: 'ge:magwitch',
      character_a_label: 'Pip',
      character_b_label: 'Provis',
      relationship_type_start: 'fear',
      relationship_type_end: 'obligation_and_compassion',
    });

    const errors = validateGreatExpectations(mutated);
    expect(errors).toEqual(
      expect.arrayContaining([
        "FORBIDDEN_FAILURE: RELATIONSHIP_DISPLAY_NAME_KEYING duplicate display-name edges found for canonical pair 'ge:magwitch↔ge:pip'.",
      ]),
    );
  });

  it('proves relationship identity is stable even when display labels change', () => {
    const mutated = JSON.parse(JSON.stringify(greatExpectations));
    for (const pair of mutated.layers.relationship_network_layer.relationship_pairs) {
      if (pair.character_a === 'ge:pip') {
        pair.character_a_label = 'Philip Pirrip';
      }
      if (pair.character_b === 'ge:magwitch') {
        pair.character_b_label = 'the convict';
      }
    }

    const errors = validateGreatExpectations(mutated);
    expect(errors).toEqual([]);
  });

  it('passes required-truth + forbidden-failure checks for The Awakening fixture', () => {
    const errors = validateAwakening(awakening);
    expect(errors).toEqual([]);
  });

  it('fails loudly when Awakening required truth is missing', () => {
    const mutated = JSON.parse(JSON.stringify(awakening));
    mutated.layers.object_symbol_layer.objects = mutated.layers.object_symbol_layer.objects.filter(
      (entry: any) => !hasText(entry.name, 'pigeon house'),
    );

    const errors = validateAwakening(mutated);
    expect(errors).toEqual(
      expect.arrayContaining([
        "MISSING_REQUIRED_TRUTH: Core symbol missing 'pigeon house'.",
      ]),
    );
  });

  it('fails loudly when Awakening forbidden failure recurs', () => {
    const mutated = JSON.parse(JSON.stringify(awakening));
    mutated.layers.pov_structure_layer.pov_characters.push({
      character_id: 'aw:robert',
      canonical_name: 'Robert Lebrun',
      is_primary: false,
    });

    const errors = validateAwakening(mutated);
    expect(errors).toEqual(
      expect.arrayContaining([
        'FORBIDDEN_FAILURE: Robert Lebrun must not be POV owner.',
      ]),
    );
  });
});

import type { CharacterArcLedgerEntry, Pass1aCharacterChunkEntry, Pass1aChunkOutput } from './types';

export type Pass1aPovSignal =
  | 'first_person_narrator'
  | 'close_third_limited'
  | 'close_third_omniscient'
  | 'distant_third'
  | 'not_pov'
  | 'unknown';

export interface PovStructureEntry {
  canonical_name: string;
  pov_type: Exclude<Pass1aPovSignal, 'not_pov' | 'unknown'>;
  narrative_share_pct: number;
  section_labels: string[];
  is_primary: boolean;
}

type CharacterWithPov = Pass1aCharacterChunkEntry & {
  canonical_identity_group?: unknown;
  pov_signal?: unknown;
  pov_section_label?: unknown;
};

const VALID_POV_SIGNALS = new Set<Pass1aPovSignal>([
  'first_person_narrator',
  'close_third_limited',
  'close_third_omniscient',
  'distant_third',
  'not_pov',
  'unknown',
]);

const POV_SIGNAL_ALIASES: Record<string, Pass1aPovSignal> = {
  'first person': 'first_person_narrator',
  'first-person': 'first_person_narrator',
  first_person: 'first_person_narrator',
  narrator: 'first_person_narrator',
  'close third': 'close_third_limited',
  'close-third': 'close_third_limited',
  close_third: 'close_third_limited',
  close_third_person: 'close_third_limited',
  close_third_limited: 'close_third_limited',
  close_limited: 'close_third_limited',
  omniscient: 'close_third_omniscient',
  close_third_omniscient: 'close_third_omniscient',
  'distant third': 'distant_third',
  'distant-third': 'distant_third',
  distant_third: 'distant_third',
  not_pov: 'not_pov',
  non_pov: 'not_pov',
  none: 'not_pov',
};

function normalizeText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => normalizeText(item))
      .filter((item): item is string => Boolean(item))
      .join('; ');
    return joined.length > 0 ? joined : null;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const preferred =
      normalizeText(record.signal) ??
      normalizeText(record.value) ??
      normalizeText(record.label) ??
      normalizeText(record.text) ??
      normalizeText(record.description);
    if (preferred) return preferred;
    const flattened = Object.values(record)
      .map((item) => normalizeText(item))
      .filter((item): item is string => Boolean(item))
      .join('; ');
    return flattened.length > 0 ? flattened : null;
  }
  const coerced = String(value).trim();
  return coerced.length > 0 ? coerced : null;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePovSignal(value: unknown): Pass1aPovSignal {
  const text = normalizeText(value);
  if (!text) return 'unknown';
  const lower = text.toLowerCase().trim();
  const snake = lower.replace(/[\s-]+/g, '_');
  const aliased = POV_SIGNAL_ALIASES[lower] ?? POV_SIGNAL_ALIASES[snake];
  if (aliased) return aliased;
  return VALID_POV_SIGNALS.has(snake as Pass1aPovSignal) ? (snake as Pass1aPovSignal) : 'unknown';
}

function canonicalNameFor(
  character: CharacterWithPov,
  canonicalLookup: Map<string, string>,
): string {
  const identityGroup = normalizeText(character.canonical_identity_group);
  const localName = normalizeText(character.canonical_name) ?? 'Unknown Character';
  const candidates = [identityGroup, localName, ...(Array.isArray(character.aliases) ? character.aliases : [])]
    .map((candidate) => normalizeText(candidate))
    .filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    const resolved = canonicalLookup.get(normalizeKey(candidate));
    if (resolved) return resolved;
  }

  return identityGroup ?? localName;
}

function buildCanonicalLookup(entries: CharacterArcLedgerEntry[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const entry of entries) {
    lookup.set(normalizeKey(entry.canonical_name), entry.canonical_name);
    for (const alias of entry.aliases ?? []) {
      lookup.set(normalizeKey(alias), entry.canonical_name);
    }
  }
  return lookup;
}

export function buildPovStructureFromChunkOutputs(params: {
  chunkOutputs: Pass1aChunkOutput[];
  ledgerEntries: CharacterArcLedgerEntry[];
  totalChunks: number;
}): PovStructureEntry[] {
  const chunks = Array.isArray(params.chunkOutputs) ? params.chunkOutputs : [];
  const totalChunks = params.totalChunks > 0 ? params.totalChunks : chunks.length;
  if (chunks.length === 0 || totalChunks <= 0) return [];

  const canonicalLookup = buildCanonicalLookup(params.ledgerEntries);
  const byCharacter = new Map<string, {
    chunks: Set<number>;
    labels: Set<string>;
    povTypes: Map<Exclude<Pass1aPovSignal, 'not_pov' | 'unknown'>, number>;
  }>();

  for (const chunk of chunks) {
    const candidates = (chunk.characters ?? [])
      .map((character) => {
        const record = character as CharacterWithPov;
        const povSignal = normalizePovSignal(record.pov_signal);
        if (povSignal === 'not_pov' || povSignal === 'unknown') return null;
        return {
          character: record,
          povSignal: povSignal as Exclude<Pass1aPovSignal, 'not_pov' | 'unknown'>,
        };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);

    // Keep narrative share bounded to <= 100% by assigning at most one POV owner
    // per chunk. Prompt priority puts POV figures first when a scene is dense.
    const selected = candidates[0];
    if (!selected) continue;

    const canonicalName = canonicalNameFor(selected.character, canonicalLookup);
    const existing = byCharacter.get(canonicalName) ?? {
      chunks: new Set<number>(),
      labels: new Set<string>(),
      povTypes: new Map<Exclude<Pass1aPovSignal, 'not_pov' | 'unknown'>, number>(),
    };

    existing.chunks.add(chunk.chunk_index);
    const label = normalizeText(selected.character.pov_section_label);
    if (label) existing.labels.add(label);
    existing.povTypes.set(selected.povSignal, (existing.povTypes.get(selected.povSignal) ?? 0) + 1);
    byCharacter.set(canonicalName, existing);
  }

  const povStructure = Array.from(byCharacter.entries())
    .map(([canonicalName, value]) => {
      const sortedTypes = Array.from(value.povTypes.entries()).sort((a, b) => b[1] - a[1]);
      return {
        canonical_name: canonicalName,
        pov_type: sortedTypes[0]?.[0] ?? 'close_third_limited',
        narrative_share_pct: Math.round((value.chunks.size / totalChunks) * 100),
        section_labels: Array.from(value.labels),
        is_primary: false,
      } satisfies PovStructureEntry;
    })
    .filter((entry) => entry.narrative_share_pct > 0)
    .sort((a, b) => b.narrative_share_pct - a.narrative_share_pct || a.canonical_name.localeCompare(b.canonical_name));

  if (povStructure.length > 0) {
    povStructure[0] = { ...povStructure[0], is_primary: true };
  }

  return povStructure;
}

/**
 * Character Reducer
 *
 * Consumes all Pass 1A chunk outputs and produces a single
 * Pass1aCharacterLedger — the manuscript-level character arc ledger.
 *
 * Rules:
 * - Alias resolution: "Paolito" and "Paul" → merged under canonical_name
 * - Identity union: all demographic signals across chunks are unioned
 * - Age tracking: age_exact_first / age_exact_last (the novel can age a character)
 * - Arc stitching: arc_state from first chunk → arc_state from last chunk
 * - Symbol tracing: object appears in early AND late chunk → traced = true
 * - Hard caps: max 15 report-visible rows, max 10 relational engines, max 12 symbol rows
 * - Hard-fail triggers: missing protagonist, missing co-protagonist, etc.
 *
 * Deterministic — no LLM calls.
 */

import type {
  Pass1aChunkOutput,
  Pass1aCharacterChunkEntry,
  Pass1aCharacterLedger,
  CharacterArcLedgerEntry,
  SymbolPayoffEntry,
  Pass1aRoleSignal,
  Pass1aNarrativeWeightSignal,
  Pass1aGenderIdentity,
  Pass1aAgeSignal,
  CharacterArcEndingStatus,
  CharacterLedgerV2,
  CharacterIdentityLedgerEntry,
  CharacterStateSnapshot,
  RelationshipLedgerEntry,
  PsychologyLedgerEntry,
  CopingMechanismEntry,
  ObjectLedgerEntry,
  TerminalLedgerEntry,
  RecommendationBlocker,
  NegativeKnowledgeState,
  EvidenceCoverage,
  StateConflict,
  EvidenceConfidence,
} from "./types";
import { PASS1A_PROMPT_VERSION } from "./prompts/pass1a-character-sweep";
import { quarantinePass1aChunkOutputs } from "./pass1aQuarantine";

// Hard caps
const MAX_LEDGER_ENTRIES = 15;
const MAX_RELATIONAL_ENGINES = 10;
const MAX_SYMBOL_ROWS = 12;
const MAX_EVIDENCE_ANCHORS = 3;

// Role priority — higher index = more important for promotion
const ROLE_PRIORITY: Record<Pass1aRoleSignal, number> = {
  protagonist: 10,
  co_protagonist: 9,
  antagonist: 8,
  mentor: 6,
  foil: 5,
  secondary: 4,
  symbolic_force: 3,
  animal_companion: 2,
  collective_force: 1,
  unknown: 0,
};

const WEIGHT_PRIORITY: Record<Pass1aNarrativeWeightSignal, number> = {
  primary: 5,
  major: 4,
  supporting: 3,
  recurring: 2,
  minor: 1,
  unknown: 0,
};

// ── Alias normalization ───────────────────────────────────────────────────

/**
 * Known alias groups — expand as needed per project.
 * Each group's first element is the canonical name.
 * This is manuscript-agnostic: groups only activate when both variants appear.
 */
const ALIAS_GROUPS: string[][] = [
  // Cartel Babies
  ["Paolito", "Paul", "Paul Raúl Wagner"],
  ["Michael", "Mike"],
  ["Benjamin", "Ben"],
];

function buildAliasMap(allNames: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of ALIAS_GROUPS) {
    const canonical = group[0];
    for (const alias of group) {
      if (allNames.some((n) => normalize(n) === normalize(alias))) {
        map.set(normalize(alias), canonical);
      }
    }
  }
  return map;
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

function resolveCanonical(
  name: string,
  aliasMap: Map<string, string>,
  identityGroupMap?: Map<string, string>,
): string {
  const normalized = normalize(name);
  const grouped = identityGroupMap?.get(normalized);
  const resolved = grouped ?? aliasMap.get(normalized) ?? name.trim();
  return aliasMap.get(normalize(resolved)) ?? resolved.trim();
}

/**
 * The Pass 1A prompt now asks models to emit canonical_identity_group, but the
 * quarantine layer intentionally strips unknown fields. Capture the raw identity
 * hints before quarantine so the deterministic reducer can use them as the
 * primary merge key, while still letting quarantine sanitize the rest of the
 * chunk output.
 */
function buildRawIdentityGroupMap(rawChunkOutputs: Pass1aChunkOutput[]): Map<string, string> {
  const map = new Map<string, string>();
  const chunks = Array.isArray(rawChunkOutputs) ? rawChunkOutputs : [];

  for (const chunk of chunks) {
    const characters = Array.isArray(chunk.characters) ? chunk.characters : [];
    for (const character of characters) {
      const record = character as Pass1aCharacterChunkEntry & { canonical_identity_group?: unknown };
      const group = normalizeSignalText(record.canonical_identity_group);
      if (!group) continue;

      const visibleNames = [
        group,
        record.canonical_name,
        ...(Array.isArray(record.aliases) ? record.aliases : []),
      ]
        .map((value) => normalizeSignalText(value))
        .filter((value): value is string => Boolean(value));

      for (const visibleName of visibleNames) {
        map.set(normalize(visibleName), group.trim());
      }
    }
  }

  return map;
}

function normalizeIdentityGroupMap(
  rawIdentityGroupMap: Map<string, string>,
  aliasMap: Map<string, string>,
): Map<string, string> {
  const normalized = new Map<string, string>();
  for (const [visibleName, group] of rawIdentityGroupMap.entries()) {
    normalized.set(visibleName, resolveCanonical(group, aliasMap));
  }
  return normalized;
}

// ── Signal text normalization ───────────────────────────────────────────────

/**
 * Safely coerce any LLM-emitted signal value to a trimmed string or null.
 * Handles: string, array (joined with "; "), object (extracts common keys),
 * and any other non-string value. Never throws.
 */
function normalizeSignalText(value: unknown): string | null {
  if (value == null) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => normalizeSignalText(item))
      .filter((item): item is string => !!item)
      .join('; ');
    return joined.length > 0 ? joined : null;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    // Try common natural-language keys first
    const preferred =
      normalizeSignalText(record.description) ??
      normalizeSignalText(record.signal) ??
      normalizeSignalText(record.value) ??
      normalizeSignalText(record.text) ??
      normalizeSignalText(record.mechanism);
    if (preferred) return preferred;
    // Fallback: flatten all string-valued fields
    const flattened = Object.values(record)
      .map((item) => normalizeSignalText(item))
      .filter((item): item is string => !!item)
      .join('; ');
    return flattened.length > 0 ? flattened : null;
  }

  // number, boolean, etc. — convert but skip trivially empty
  const coerced = String(value).trim();
  return coerced.length > 0 ? coerced : null;
}

// ── Union helpers ─────────────────────────────────────────────────────────

function unionArrays<T>(...arrays: T[][]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const arr of arrays) {
    for (const item of arr) {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
  }
  return result;
}

function pickHighestRole(roles: Pass1aRoleSignal[]): Pass1aRoleSignal {
  return roles.reduce((best, r) =>
    (ROLE_PRIORITY[r] ?? 0) > (ROLE_PRIORITY[best] ?? 0) ? r : best,
    "unknown" as Pass1aRoleSignal,
  );
}

function pickHighestWeight(weights: Pass1aNarrativeWeightSignal[]): Pass1aNarrativeWeightSignal {
  return weights.reduce((best, w) =>
    (WEIGHT_PRIORITY[w] ?? 0) > (WEIGHT_PRIORITY[best] ?? 0) ? w : best,
    "unknown" as Pass1aNarrativeWeightSignal,
  );
}

function pickAgeSignal(signals: (Pass1aAgeSignal)[]): Pass1aAgeSignal {
  // Return the first non-null signal
  return signals.find((s) => s !== null) ?? null;
}

// ── Symbol deduplication ──────────────────────────────────────────────────

interface RawSymbol {
  object: string;
  function: string;
  chunk_index: number;
  character: string;
}

function buildSymbolPayoffEntries(rawSymbols: RawSymbol[], totalChunks: number): SymbolPayoffEntry[] {
  const byObject = new Map<string, RawSymbol[]>();
  for (const sym of rawSymbols) {
    const key = (normalizeSignalText(sym.object) ?? '').toLowerCase();
    if (!byObject.has(key)) byObject.set(key, []);
    byObject.get(key)!.push(sym);
  }

  const results: SymbolPayoffEntry[] = [];
  for (const [, occurrences] of byObject) {
    const sorted = [...occurrences].sort((a, b) => a.chunk_index - b.chunk_index);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const chars = [...new Set(occurrences.map((o) => o.character))];
    const midpoint = Math.floor(totalChunks / 2);
    const traced = first.chunk_index <= midpoint && last.chunk_index > midpoint;

    results.push({
      object: first.object,
      attached_characters: chars,
      first_chunk: first.chunk_index,
      last_chunk: last.chunk_index,
      first_function: first.function,
      later_payoff: last.chunk_index !== first.chunk_index ? last.function : null,
      status: traced ? "resolved" : last.chunk_index === first.chunk_index ? "active" : "active",
      traced,
    });
  }

  return results
    .sort((a, b) => (b.traced ? 1 : 0) - (a.traced ? 1 : 0))
    .slice(0, MAX_SYMBOL_ROWS);
}

// ── Hard-fail gate ────────────────────────────────────────────────────────

function computeHardFailTriggers(entries: CharacterArcLedgerEntry[]): string[] {
  const triggers: string[] = [];
  const protagonists = entries.filter((e) => e.role === "protagonist");
  const coProtagonists = entries.filter((e) => e.role === "co_protagonist");

  if (protagonists.length === 0) {
    triggers.push("HARD_FAIL: No protagonist detected in character ledger");
  }
  if (coProtagonists.length === 0 && entries.length >= 3) {
    // Only flag if the novel has enough characters to warrant one
    triggers.push("WARN: No co-protagonist detected — verify if novel has one");
  }
  for (const entry of entries.filter(
    (e) => e.narrative_weight_band === "primary" || e.narrative_weight_band === "major",
  )) {
    if (entry.ending_status === "accidentally_abandoned" || entry.ending_status === "missing_from_ending") {
      triggers.push(`HARD_FAIL: Major character "${entry.canonical_name}" has no ending accountability`);
    }
    if (entry.warnings.some((w) => w.type === "pronoun_inconsistency")) {
      triggers.push(`HARD_FAIL: Pronoun inconsistency for "${entry.canonical_name}"`);
    }
  }

  return triggers;
}

// ── Main reducer ──────────────────────────────────────────────────────────

export function reduceCharacterEvidence(params: {
  chunkOutputs: Pass1aChunkOutput[];
  jobId: string;
  totalChunksInManuscript: number;
}): Pass1aCharacterLedger {
  const { jobId, totalChunksInManuscript } = params;

  // Capture prompt-emitted canonical_identity_group before quarantine strips
  // unknown fields. This is the primary fix for Michael/Miguel/Salter and
  // Benjamin/Benjamín/Mr. Lopez fragmentation in Story Ledger P0.
  const rawIdentityGroupMap = buildRawIdentityGroupMap(params.chunkOutputs);

  // ── Quarantine: normalize all AI-emitted fields before reduction ──────────
  // Coerces non-string values, drops unsalvageable entries, emits diagnostics.
  // One corrupt how_signal / arc_shift / any field never kills the whole job.
  const quarantine = quarantinePass1aChunkOutputs(params.chunkOutputs);
  const chunkOutputs = quarantine.chunkOutputs;

  if (quarantine.diagnostics.length > 0) {
    console.warn('[Pass1AQuarantine] normalized malformed AI output before reduction', {
      job_id: jobId,
      summary: quarantine.summary,
      diagnostics_head: quarantine.diagnostics.slice(0, 25),
    });
  }

  if (chunkOutputs.length === 0) {
    return buildEmptyLedger(jobId);
  }

  // Collect all character names across all chunks
  const allNames = [
    ...chunkOutputs.flatMap((co) =>
      co.characters.flatMap((c) => [c.canonical_name, ...(c.aliases ?? [])]),
    ),
    ...Array.from(rawIdentityGroupMap.values()),
  ];
  const aliasMap = buildAliasMap(allNames);
  const identityGroupMap = normalizeIdentityGroupMap(rawIdentityGroupMap, aliasMap);

  // Group all chunk entries by resolved canonical name
  const grouped = new Map<string, Array<{ entry: Pass1aCharacterChunkEntry; chunk_index: number }>>();

  for (const chunkOutput of chunkOutputs) {
    for (const char of chunkOutput.characters) {
      const canonical = resolveCanonical(char.canonical_name, aliasMap, identityGroupMap);
      if (!grouped.has(canonical)) grouped.set(canonical, []);
      grouped.get(canonical)!.push({ entry: char, chunk_index: chunkOutput.chunk_index });
    }
    // Also resolve aliases mentioned in the entry itself
    for (const char of chunkOutput.characters) {
      for (const alias of char.aliases ?? []) {
        const resolved = resolveCanonical(alias, aliasMap, identityGroupMap);
        if (resolved !== resolveCanonical(char.canonical_name, aliasMap, identityGroupMap)) {
          // This alias resolves to a different canonical — add cross-reference
          if (!grouped.has(resolved)) grouped.set(resolved, []);
          // Don't double-add the same entry
        }
      }
    }
  }

  // Collect all raw symbols for symbol payoff table
  const rawSymbols: RawSymbol[] = [];
  for (const chunkOutput of chunkOutputs) {
    for (const char of chunkOutput.characters) {
      const canonical = resolveCanonical(char.canonical_name, aliasMap, identityGroupMap);
      for (const sym of char.symbolic_objects ?? []) {
        rawSymbols.push({
          object: sym.object,
          function: sym.function,
          chunk_index: chunkOutput.chunk_index,
          character: canonical,
        });
      }
    }
  }

  const symbolPayoffEntries = buildSymbolPayoffEntries(rawSymbols, totalChunksInManuscript);

  // Build ledger entries
  const ledgerEntries: CharacterArcLedgerEntry[] = [];

  for (const [canonical, appearances] of grouped) {
    if (!canonical || canonical.length < 2) continue;
    if (appearances.length === 0) continue; // skip alias stubs with no actual chunk entries

    const sorted = [...appearances].sort((a, b) => a.chunk_index - b.chunk_index);
    const entries = sorted.map((s) => s.entry);
    const chunkIndices = sorted.map((s) => s.chunk_index);
    const firstEntry = entries[0];
    const lastEntry = entries[entries.length - 1];

    // Collect all aliases
    const allAliases = [...new Set(
      entries.flatMap((e) => [e.canonical_name, ...e.aliases]).filter((a) => normalize(a) !== normalize(canonical)),
    )];

    // Age tracking — first vs last
    const ageExacts = entries.map((e) => e.age_exact).filter((a): a is number => a !== null);
    const ageExactFirst = ageExacts[0] ?? null;
    const ageExactLast = ageExacts[ageExacts.length - 1] ?? null;

    // Role — highest-confidence wins
    const role = pickHighestRole(entries.map((e) => e.role_signal).filter((r) => r !== "unknown"));

    // Narrative weight — highest wins
    const narrativeWeightBand = pickHighestWeight(entries.map((e) => e.narrative_weight_signal));

    // Ending status — from last chunk that has an ending signal
    const endingEntry = [...entries].reverse().find((e) => e.is_ending_chunk);
    const endingStatus: CharacterArcEndingStatus = endingEntry?.arc_shift
      ? "transformed"
      : entries.some((e) => e.is_ending_chunk)
        ? "resolved"
        : chunkIndices[chunkIndices.length - 1] < Math.floor(totalChunksInManuscript * 0.8)
          ? "accidentally_abandoned"
          : "intentionally_unresolved";

    // Arc stitching
    const arcStart = firstEntry.arc_state_in_chunk ?? "";
    const arcEnd = lastEntry.arc_shift ?? lastEntry.arc_state_in_chunk ?? "";
    const arcTurningPoints = entries
      .map((e) => normalizeSignalText(e.arc_shift))
      .filter((s): s is string => !!s)
      .slice(0, 5);

    // Five Ws + How — take first non-null across all chunks
    const whoIsThis = firstEntry.who_is_this ?? entries.find((e) => e.who_is_this)?.who_is_this ?? "";
    const whatDoTheyWant = entries.find((e) => e.what_do_they_want)?.what_do_they_want ?? null;
    const primaryLocations = [...new Set(entries.map((e) => e.where_are_they).filter((l): l is string => !!l))];
    const whySignal = entries.find((e) => e.why_signal)?.why_signal ?? null;
    const howSignal = normalizeSignalText(entries.find((e) => normalizeSignalText(e.how_signal))?.how_signal) ?? null;

    // Evidence anchors — pick top MAX_EVIDENCE_ANCHORS, prefer distinct types
    const allAnchors = entries.flatMap((e, i) =>
      (e.evidence_anchors ?? []).map((a) => ({
        chunk_index: chunkIndices[i],
        excerpt: a.excerpt,
        evidence_type: a.evidence_type,
      })),
    );
    const seenExcerpts = new Set<string>();
    const deduplicatedAnchors = allAnchors.filter((a) => {
      const key = a.excerpt.trim().slice(0, 60);
      if (seenExcerpts.has(key)) return false;
      seenExcerpts.add(key);
      return true;
    }).slice(0, MAX_EVIDENCE_ANCHORS);

    // Relational engines — deduplicate by other_character pair
    const seenPairs = new Set<string>();
    const relationalEngines = entries
      .flatMap((e, i) =>
        (e.relationship_signals ?? []).map((r) => ({
          other_character: resolveCanonical(r.other_character, aliasMap, identityGroupMap),
          relationship_type: r.relationship_type,
          dynamic: r.dynamic,
          chunk_span: [chunkIndices[i], chunkIndices[i]] as [number, number],
        })),
      )
      .filter((r) => {
        const key = `${normalize(canonical)}↔${normalize(r.other_character)}`;
        const reverseKey = `${normalize(r.other_character)}↔${normalize(canonical)}`;
        if (seenPairs.has(key) || seenPairs.has(reverseKey)) return false;
        seenPairs.add(key);
        return true;
      })
      .slice(0, 5);

    // Update chunk_span ranges for relational engines
    for (const engine of relationalEngines) {
      const allOccurrences = entries
        .flatMap((e, i) =>
          (e.relationship_signals ?? [])
            .filter((r) => normalize(resolveCanonical(r.other_character, aliasMap, identityGroupMap)) === normalize(engine.other_character))
            .map(() => chunkIndices[i]),
        );
      if (allOccurrences.length > 0) {
        engine.chunk_span = [
          Math.min(...allOccurrences),
          Math.max(...allOccurrences),
        ];
      }
    }

    // Warnings
    const warnings: CharacterArcLedgerEntry["warnings"] = [];
    const pronounSets = entries.map((e) => JSON.stringify([...(e.pronouns ?? [])].sort()));
    if (new Set(pronounSets).size > 1 && pronounSets.some((p) => p !== "[]")) {
      warnings.push({ type: "pronoun_inconsistency", message: `Pronoun variation detected across chunks for "${canonical}"` });
    }
    if (endingStatus === "accidentally_abandoned") {
      warnings.push({ type: "ending_underpaid", message: `"${canonical}" last appears in chunk ${chunkIndices[chunkIndices.length - 1]} of ${totalChunksInManuscript} — possible abandoned arc` });
    }

    // ── Grounding Gate fields ────────────────────────────────────────────────
    // nameStates: one entry per distinct name window (name appears → name changes)
    const nameStates: CharacterArcLedgerEntry["nameStates"] = [];
    const allNamesInOrder: Array<{ name: string; chunk_index: number }> = entries
      .flatMap((e, i) => [
        { name: e.canonical_name, chunk_index: chunkIndices[i] },
        ...(e.aliases ?? []).map((a) => ({ name: a, chunk_index: chunkIndices[i] })),
      ])
      .sort((a, b) => a.chunk_index - b.chunk_index);
    const distinctNamesInOrder = [...new Set(allNamesInOrder.map((n) => n.name))];
    for (let ni = 0; ni < distinctNamesInOrder.length; ni++) {
      const nameStr = distinctNamesInOrder[ni];
      const firstSeen = allNamesInOrder.find((n) => n.name === nameStr)?.chunk_index ?? 0;
      // validUntil = chunk before next distinct name appears, or null
      const nextNameFirstSeen = ni < distinctNamesInOrder.length - 1
        ? allNamesInOrder.find((n) => n.name === distinctNamesInOrder[ni + 1])?.chunk_index ?? null
        : null;
      nameStates.push({
        name: nameStr,
        validFromChunk: firstSeen,
        validUntilChunk: nextNameFirstSeen !== null ? nextNameFirstSeen - 1 : null,
      });
    }
    // Fallback: always include the canonical name as valid from first chunk
    if (nameStates.length === 0) {
      nameStates.push({ name: canonical, validFromChunk: chunkIndices[0], validUntilChunk: null });
    }

    // copingMechanisms: extracted from how_signal across chunks
    const copingMechanisms: CharacterArcLedgerEntry["copingMechanisms"] = [];
    const seenCopingDescs = new Set<string>();
    for (let ei = 0; ei < entries.length; ei++) {
      const e = entries[ei];
      const howSignalText = normalizeSignalText(e.how_signal);
      if (howSignalText) {
        const desc = howSignalText.toLowerCase().trim();
        if (!seenCopingDescs.has(desc)) {
          seenCopingDescs.add(desc);
          const repeatCount = entries.filter((x) =>
            normalizeSignalText(x.how_signal)?.toLowerCase().trim() === desc
          ).length;
          copingMechanisms.push({
            description: howSignalText,
            firstAppearsChunk: chunkIndices[ei],
            frequency: repeatCount >= 5 ? "dominant" : repeatCount >= 2 ? "recurring" : "rare",
          });
        }
      }
    }
    // Also pull disability/neuro signals as coping indicators
    for (const signal of [...new Set(entries.flatMap((e) => e.disability_neuro_signals ?? []))]) {
      if (!seenCopingDescs.has(signal.toLowerCase())) {
        seenCopingDescs.add(signal.toLowerCase());
        copingMechanisms.push({
          description: signal,
          firstAppearsChunk: chunkIndices[0],
          frequency: "rare",
        });
      }
    }

    // coPresenceMap: for each relational engine, record the first shared chunk
    const coPresenceMap: CharacterArcLedgerEntry["coPresenceMap"] = {};
    for (const rel of relationalEngines) {
      coPresenceMap[rel.other_character] = {
        firstSharedChunk: rel.chunk_span[0],
        firstSharedChapterEstimate: `chunk ${rel.chunk_span[0]}`,
      };
    }

    ledgerEntries.push({
      canonical_name: canonical,
      aliases: allAliases,
      pronouns: [...new Set(entries.flatMap((e) => e.pronouns ?? []))],
      age_exact_first: ageExactFirst,
      age_exact_last: ageExactLast !== ageExactFirst ? ageExactLast : null,
      age_signal: pickAgeSignal(entries.map((e) => e.age_signal)),
      gender_identity: entries.find((e) => e.gender_identity !== "unknown")?.gender_identity ?? "unknown" as Pass1aGenderIdentity,
      lgbtq_signals: unionArrays(entries.map((e) => e.lgbtq_signals ?? []).flat()),
      racial_ethnic_signals: unionArrays(entries.map((e) => e.racial_ethnic_signals ?? []).flat()),
      skin_tone_signals: unionArrays(entries.map((e) => e.skin_tone_signals ?? []).flat()),
      language_signals: unionArrays(entries.map((e) => e.language_signals ?? []).flat()),
      religion_signals: unionArrays(entries.map((e) => e.religion_signals ?? []).flat()),
      socioeconomic_signals: unionArrays(entries.map((e) => e.socioeconomic_signals ?? []).flat()),
      nationality_signals: unionArrays(entries.map((e) => e.nationality_signals ?? []).flat()),
      disability_neuro_signals: unionArrays(entries.map((e) => e.disability_neuro_signals ?? []).flat()),
      role,
      narrative_weight_band: narrativeWeightBand,
      is_named: entries.some((e) => e.is_named),
      who_is_this: whoIsThis,
      what_do_they_want: whatDoTheyWant,
      primary_locations: primaryLocations,
      why_signal: whySignal,
      how_signal: howSignal,
      arc_start: arcStart,
      arc_pressure: entries.find((e) => e.arc_pressure)?.arc_pressure ?? "",
      arc_turning_points: arcTurningPoints,
      arc_end_state: arcEnd,
      ending_status: endingStatus,
      symbolic_objects: symbolPayoffEntries
        .filter((s) => s.attached_characters.includes(canonical))
        .map((s) => ({
          object: s.object,
          first_chunk: s.first_chunk,
          last_chunk: s.last_chunk,
          function: s.first_function,
          traced: s.traced,
        })),
      relational_engines: relationalEngines,
      evidence_anchors: deduplicatedAnchors,
      report_acknowledgement_status: "adequately_accounted_for",
      warnings,
      first_chunk_index: chunkIndices[0],
      last_chunk_index: chunkIndices[chunkIndices.length - 1],
      mention_count: entries.length,
      nameStates,
      copingMechanisms,
      coPresenceMap,
    });
  }

  // Sort by narrative importance, then mention count
  const sorted = ledgerEntries
    .sort((a, b) => {
      const roleDiff = (ROLE_PRIORITY[b.role] ?? 0) - (ROLE_PRIORITY[a.role] ?? 0);
      if (roleDiff !== 0) return roleDiff;
      const weightDiff = (WEIGHT_PRIORITY[b.narrative_weight_band] ?? 0) - (WEIGHT_PRIORITY[a.narrative_weight_band] ?? 0);
      if (weightDiff !== 0) return weightDiff;
      return b.mention_count - a.mention_count;
    })
    .slice(0, MAX_LEDGER_ENTRIES);

  // Build global relational engines list (character pairs, deduplicated)
  const globalRelationalEngines: string[] = [];
  const seenGlobalPairs = new Set<string>();
  for (const entry of sorted) {
    for (const rel of entry.relational_engines) {
      const pair = [entry.canonical_name, rel.other_character].sort().join("–");
      if (!seenGlobalPairs.has(pair)) {
        seenGlobalPairs.add(pair);
        globalRelationalEngines.push(pair);
      }
    }
  }

  const hardFailTriggers = computeHardFailTriggers(sorted);

  return {
    schema_version: "pass1a_character_ledger_v1",
    prompt_version: PASS1A_PROMPT_VERSION,
    job_id: jobId,
    generated_at: new Date().toISOString(),
    total_chunks_processed: chunkOutputs.length,
    entries: sorted,
    coverage_summary: {
      protagonists: sorted.filter((e) => e.role === "protagonist").map((e) => e.canonical_name),
      co_protagonists: sorted.filter((e) => e.role === "co_protagonist").map((e) => e.canonical_name),
      antagonists: sorted.filter((e) => e.role === "antagonist").map((e) => e.canonical_name),
      major_secondary_characters: sorted
        .filter((e) => e.role === "secondary" && (e.narrative_weight_band === "major" || e.narrative_weight_band === "supporting"))
        .map((e) => e.canonical_name),
      animal_companions: sorted.filter((e) => e.role === "animal_companion").map((e) => e.canonical_name),
      relational_engines: globalRelationalEngines.slice(0, MAX_RELATIONAL_ENGINES),
      symbol_payoff_items: symbolPayoffEntries,
      missing_or_underweighted: sorted
        .filter((e) => e.warnings.some((w) => w.type === "role_underweighted" || w.type === "major_character_missing_from_report"))
        .map((e) => e.canonical_name),
      ending_accountability_warnings: sorted
        .filter((e) => e.warnings.some((w) => w.type === "ending_underpaid" || w.type === "arc_abandoned"))
        .map((e) => `${e.canonical_name}: ${e.ending_status}`),
      hard_fail_triggers: hardFailTriggers,
    },
  };
}

function buildEmptyLedger(jobId: string): Pass1aCharacterLedger {
  return {
    schema_version: "pass1a_character_ledger_v1",
    prompt_version: PASS1A_PROMPT_VERSION,
    job_id: jobId,
    generated_at: new Date().toISOString(),
    total_chunks_processed: 0,
    entries: [],
    coverage_summary: {
      protagonists: [],
      co_protagonists: [],
      antagonists: [],
      major_secondary_characters: [],
      animal_companions: [],
      relational_engines: [],
      symbol_payoff_items: [],
      missing_or_underweighted: [],
      ending_accountability_warnings: [],
      hard_fail_triggers: ["WARN: Pass 1A produced no chunk outputs — character ledger empty"],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHARACTER LEDGER V2 BUILDER
// Consumes the Pass1aCharacterLedger + all chunk outputs to assemble the full
// Tier 1 CharacterLedgerV2 with validation query indices, active blockers,
// negative knowledge states, and evidence coverage stats.
// Deterministic — no LLM calls.
// ═══════════════════════════════════════════════════════════════════════════════

const ACT_ZONES = ["Opening", "MID-EARLY", "MID", "MID-LATE", "LATE", "Close"] as const;

function chunkToActZone(chunkIndex: number, totalChunks: number): string {
  if (totalChunks <= 1) return "Opening";
  const ratio = chunkIndex / (totalChunks - 1);
  if (ratio < 0.10) return "Opening";
  if (ratio < 0.28) return "MID-EARLY";
  if (ratio < 0.50) return "MID";
  if (ratio < 0.72) return "MID-LATE";
  if (ratio < 0.90) return "LATE";
  return "Close";
}

function makeBlockerId(type: string, ...parts: string[]): string {
  return `${type}:${parts.join("+")}`;
}

/**
 * Build the full Tier 1 CharacterLedgerV2 from a completed Pass1aCharacterLedger
 * and the raw chunk outputs.  Called after reduceCharacterEvidence().
 */
export function buildCharacterLedgerV2(params: {
  ledger: Pass1aCharacterLedger;
  chunkOutputs: Pass1aChunkOutput[];
  jobId: string;
  totalChunksInManuscript: number;
}): CharacterLedgerV2 {
  const { ledger, chunkOutputs, jobId, totalChunksInManuscript } = params;
  const entries = ledger.entries;

  // ── 1. Identity Ledger ────────────────────────────────────────────────────
  const identityLedger: CharacterIdentityLedgerEntry[] = entries.map((e) => {
    const blockers: RecommendationBlocker[] = [];

    // Name-state blockers: any name with validFromChunk > 0 generates a blocker
    for (const ns of e.nameStates ?? []) {
      if (ns.validFromChunk > 0) {
        blockers.push({
          blockerId: makeBlockerId("name_state_violation", e.canonical_name, ns.name),
          type: "name_state_violation",
          severity: "suppress",
          rule: `Name "${ns.name}" for ${e.canonical_name} is only valid from chunk ${ns.validFromChunk}. Do not use this name in recommendations targeting earlier chapters.`,
          validAfterChapter: `chunk ${ns.validFromChunk}`,
          involvedCharacters: [e.canonical_name],
          affectedRecommendationTypes: ["characterization"],
        });
      }
    }

    return {
      characterId: e.canonical_name.toLowerCase().replace(/\s+/g, "_"),
      canonicalName: e.canonical_name,
      nameHistory: (e.nameStates ?? []).map((ns) => ({
        name: ns.name,
        validFromChunk: ns.validFromChunk,
        validUntilChunk: ns.validUntilChunk,
        confidence: "explicit" as EvidenceConfidence,
      })),
      aliases: e.aliases,
      narrativeRole: e.role as CharacterIdentityLedgerEntry["narrativeRole"],
      importanceLevel: e.narrative_weight_band as CharacterIdentityLedgerEntry["importanceLevel"],
      firstAppearance: { label: `chunk ${e.first_chunk_index}`, chunkIndex: e.first_chunk_index },
      lastAppearance: { label: `chunk ${e.last_chunk_index}`, chunkIndex: e.last_chunk_index },
      firstChunkIndex: e.first_chunk_index,
      lastChunkIndex: e.last_chunk_index,
      finalStatus: "unresolved",
      contradictions: [],
      recommendationBlockers: blockers,
    };
  });

  // ── 2. State Timelines ────────────────────────────────────────────────────
  // One snapshot per character per act zone (coarse — reducer has no location data per chunk)
  const stateTimelines: CharacterStateSnapshot[] = entries.map((e) => ({
    characterId: e.canonical_name.toLowerCase().replace(/\s+/g, "_"),
    chunkRange: [e.first_chunk_index, e.last_chunk_index],
    chapterRange: `chunk ${e.first_chunk_index}–${e.last_chunk_index}`,
    nameUsed: e.canonical_name,
    ageOrLifeStage: e.age_exact_first !== null ? `age ${e.age_exact_first}` : (e.age_signal ?? null),
    location: e.primary_locations[0] ?? null,
    country: null,
    jobOrRole: e.who_is_this ?? null,
    legalStatus: null,
    healthState: null,
    psychologicalState: e.arc_start ?? null,
    mobilityStatus: null,
    knowledgeState: [],
    evidenceQuote: e.evidence_anchors[0]?.excerpt ?? "",
    confidence: "strong_inference" as EvidenceConfidence,
  }));

  // ── 3. Relationship Ledger ────────────────────────────────────────────────
  const relationshipLedger: RelationshipLedgerEntry[] = [];
  const seenRelPairs = new Set<string>();

  for (const entry of entries) {
    for (const [otherName, coPresence] of Object.entries(entry.coPresenceMap ?? {})) {
      const pairKey = [entry.canonical_name, otherName].sort().join("↔");
      if (seenRelPairs.has(pairKey)) continue;
      seenRelPairs.add(pairKey);

      relationshipLedger.push({
        characterA: entry.canonical_name,
        characterB: otherName,
        firstCoPresenceChunk: coPresence.firstSharedChunk,
        firstCoPresenceChapter: coPresence.firstSharedChapterEstimate,
        invalidBeforeChapter: coPresence.firstSharedChapterEstimate,
        firstSharedLocation: null,
        relationshipTypeStart: "unknown",
        relationshipTypeEnd: "unknown",
        powerDynamicTimeline: [],
        pivotMoments: [],
        sharedObjects: [],
        sharedActivities: [],
        unresolvedLedger: [],
        recommendationBlocker: {
          blockerId: makeBlockerId("co_presence_violation", entry.canonical_name, otherName),
          type: "co_presence_violation",
          severity: "suppress",
          rule: `${entry.canonical_name} and ${otherName} do not share a scene until chunk ${coPresence.firstSharedChunk} (${coPresence.firstSharedChapterEstimate}). Recommendations must not place them together before this point.`,
          validAfterChapter: coPresence.firstSharedChapterEstimate,
          involvedCharacters: [entry.canonical_name, otherName],
          affectedRecommendationTypes: ["characterization", "scene_structure"],
        },
      });
    }
  }

  // ── 4. Psychology / Coping Ledger ─────────────────────────────────────────
  const psychologyLedger: PsychologyLedgerEntry[] = entries.map((e) => {
    const copingMechanisms: CopingMechanismEntry[] = (e.copingMechanisms ?? []).map((cm) => ({
      description: cm.description,
      firstAppearsChunk: cm.firstAppearsChunk,
      firstAppearsChapter: `chunk ${cm.firstAppearsChunk}`,
      recurrenceChunks: [],
      frequency: cm.frequency,
      triggeredBy: null,
      manifestsAs: cm.description,
      psychologicalFunction: "coping / self-regulation",
      evidenceQuote: "",
      confidence: "strong_inference" as EvidenceConfidence,
    }));

    const seedingBlocked = copingMechanisms.length > 0;
    const seedingBlockMessage = seedingBlocked
      ? `${e.canonical_name} already has ${copingMechanisms.length} coping mechanism(s): ${copingMechanisms.map((c) => `"${c.description}"`).join(", ")}. Do NOT recommend seeding a coping ritual. Use "foreground", "surface earlier", or "echo" instead.`
      : "";

    return {
      characterId: e.canonical_name.toLowerCase().replace(/\s+/g, "_"),
      copingMechanisms,
      psychologicalArc: `${e.arc_start} → ${e.arc_end_state}`,
      seedingBlocked,
      seedingBlockMessage,
    };
  });

  // ── 5. Object Ledger ─────────────────────────────────────────────────────
  // Built from the symbol payoff table in the coverage summary
  const objectLedger: ObjectLedgerEntry[] = (ledger.coverage_summary.symbol_payoff_items ?? []).map((sym) => ({
    objectId: sym.object.toLowerCase().replace(/\s+/g, "_"),
    objectName: sym.object,
    attachedCharacters: sym.attached_characters,
    currentHolder: sym.attached_characters[sym.attached_characters.length - 1] ?? null,
    firstAppearanceChunk: sym.first_chunk,
    firstAppearanceChapter: `chunk ${sym.first_chunk}`,
    lastAppearanceChunk: sym.last_chunk,
    ownershipPath: sym.attached_characters,
    transferEvents: [],
    symbolicFunctionByStage: [
      {
        stage: "introduced" as const,
        chunkRange: [sym.first_chunk, sym.first_chunk] as [number, number],
        chapterRange: `chunk ${sym.first_chunk}`,
        function: sym.first_function,
        evidenceQuote: "",
      },
      ...(sym.later_payoff ? [{
        stage: "paid_off" as const,
        chunkRange: [sym.last_chunk, sym.last_chunk] as [number, number],
        chapterRange: `chunk ${sym.last_chunk}`,
        function: sym.later_payoff,
        evidenceQuote: "",
      }] : []),
    ],
    payoffChunk: sym.later_payoff ? sym.last_chunk : null,
    payoffChapter: sym.later_payoff ? `chunk ${sym.last_chunk}` : null,
    payoffDescription: sym.later_payoff,
    missedIfAbsentFromReport: sym.traced,
    status: sym.status,
    recommendationBlockers: [],
  }));

  // ── 6. Terminal Ledger ────────────────────────────────────────────────────
  // Populated for characters with ending_status that implies terminal condition
  const terminalLedger: TerminalLedgerEntry[] = entries
    .filter((e) =>
      e.ending_status === "resolved" ||
      e.ending_status === "tragically_confirmed" ||
      e.ending_status === "accidentally_abandoned"
    )
    .map((e) => ({
      characterId: e.canonical_name.toLowerCase().replace(/\s+/g, "_"),
      terminalCondition: "open" as const,
      terminalChunk: e.last_chunk_index,
      terminalChapter: `chunk ${e.last_chunk_index}`,
      lastLucidChunk: e.last_chunk_index,
      whoIsPresent: [],
      finalBeliefState: e.arc_end_state || null,
      promisesKept: [],
      promisesUnkept: [],
      objectsPresentAtExit: [],
      legacyTransferredTo: null,
      finalRelationshipStates: [],
      narrativeClosureStatus:
        e.ending_status === "resolved" ? "fully_resolved" :
        e.ending_status === "tragically_confirmed" ? "fully_resolved" :
        "underpaid",
      evidenceQuote: e.evidence_anchors[0]?.excerpt ?? "",
      confidence: "strong_inference" as EvidenceConfidence,
    }));

  // ── Validation Query Index ────────────────────────────────────────────────
  const characterPresenceIndex: Record<string, number[]> = {};
  for (const entry of entries) {
    const id = entry.canonical_name.toLowerCase().replace(/\s+/g, "_");
    // Every chunk from first to last appearance (inclusive)
    const chunks: number[] = [];
    for (let ci = entry.first_chunk_index; ci <= entry.last_chunk_index; ci++) {
      chunks.push(ci);
    }
    characterPresenceIndex[id] = chunks;
    // Also index by canonical_name directly (for prompt usage)
    characterPresenceIndex[entry.canonical_name] = chunks;
  }

  const coPresenceIndex: Record<string, Record<string, number>> = {};
  for (const rel of relationshipLedger) {
    if (!coPresenceIndex[rel.characterA]) coPresenceIndex[rel.characterA] = {};
    coPresenceIndex[rel.characterA][rel.characterB] = rel.firstCoPresenceChunk;
    if (!coPresenceIndex[rel.characterB]) coPresenceIndex[rel.characterB] = {};
    coPresenceIndex[rel.characterB][rel.characterA] = rel.firstCoPresenceChunk;
  }

  const nameStateIndex: Record<string, Array<{ name: string; validFromChunk: number; validUntilChunk: number | null }>> = {};
  for (const entry of entries) {
    const id = entry.canonical_name;
    nameStateIndex[id] = (entry.nameStates ?? []).map((ns) => ({
      name: ns.name,
      validFromChunk: ns.validFromChunk,
      validUntilChunk: ns.validUntilChunk,
    }));
  }

  const copingIndex: Record<string, string[]> = {};
  for (const psych of psychologyLedger) {
    copingIndex[psych.characterId] = psych.copingMechanisms.map((c) => c.description);
    // Also index by display name
    const displayName = entries.find((e) =>
      e.canonical_name.toLowerCase().replace(/\s+/g, "_") === psych.characterId
    )?.canonical_name;
    if (displayName) copingIndex[displayName] = copingIndex[psych.characterId];
  }

  const objectPresenceIndex: Record<string, [number, number]> = {};
  for (const obj of objectLedger) {
    objectPresenceIndex[obj.objectId] = [obj.firstAppearanceChunk, obj.lastAppearanceChunk];
  }

  const symbolPayoffIndex: Record<string, boolean> = {};
  for (const obj of objectLedger) {
    symbolPayoffIndex[obj.objectId] = obj.payoffChunk !== null;
  }

  const unresolvedPromisesIndex: Record<string, string[]> = {};
  for (const term of terminalLedger) {
    if (term.promisesUnkept.length > 0) {
      unresolvedPromisesIndex[term.characterId] = term.promisesUnkept;
    }
  }

  // ── Active Blockers ───────────────────────────────────────────────────────
  // Collect all blockers from identity + relationship + psychology ledgers
  const activeBlockers: RecommendationBlocker[] = [];

  for (const identity of identityLedger) {
    activeBlockers.push(...identity.recommendationBlockers);
  }
  for (const rel of relationshipLedger) {
    activeBlockers.push(rel.recommendationBlocker);
  }
  for (const psych of psychologyLedger) {
    if (psych.seedingBlocked && psych.seedingBlockMessage) {
      const displayName = entries.find((e) =>
        e.canonical_name.toLowerCase().replace(/\s+/g, "_") === psych.characterId
      )?.canonical_name ?? psych.characterId;
      activeBlockers.push({
        blockerId: makeBlockerId("existing_feature_violation", psych.characterId, "coping"),
        type: "existing_feature_violation",
        severity: "suppress",
        rule: psych.seedingBlockMessage,
        involvedCharacters: [displayName],
        affectedRecommendationTypes: ["characterization"],
      });
    }
  }
  // Sort: suppress first, then downgrade, then warn
  const severityOrder = { suppress: 0, downgrade: 1, warn: 2 };
  activeBlockers.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

  // ── Negative Knowledge States ─────────────────────────────────────────────
  const negativeKnowledge: NegativeKnowledgeState[] = entries.map((e) => {
    const id = e.canonical_name.toLowerCase().replace(/\s+/g, "_");

    // Characters this one has not yet met (no coPresenceMap entry)
    const allOtherCharacters = entries
      .filter((other) => other.canonical_name !== e.canonical_name)
      .map((other) => other.canonical_name);
    const notYetMet = allOtherCharacters.filter(
      (other) => !(other in (e.coPresenceMap ?? {}))
    );

    // Names not yet valid at first appearance
    const nameNotYetValid = (e.nameStates ?? [])
      .filter((ns) => ns.validFromChunk > e.first_chunk_index)
      .map((ns) => ({ name: ns.name, validFromChunk: ns.validFromChunk }));

    return {
      characterId: id,
      notPresentWith: notYetMet,
      notYetMet,
      nameNotYetValid,
      objectNotYetTransferred: [],
      doesNotYetKnow: [],
      asOfChunk: e.first_chunk_index,
    };
  });

  // ── State Conflicts ───────────────────────────────────────────────────────
  const stateConflicts: StateConflict[] = [];
  // Detect co-presence conflicts: chunk outputs that claim a character is present
  // in a chunk BEFORE their firstCoPresenceChunk with another character
  for (const chunkOutput of chunkOutputs) {
    const coPresent = chunkOutput.characters.flatMap((c) => c.co_presence_confirmed ?? []);
    const uniquePresent = [...new Set(coPresent)];
    for (let i = 0; i < uniquePresent.length; i++) {
      for (let j = i + 1; j < uniquePresent.length; j++) {
        const charA = uniquePresent[i];
        const charB = uniquePresent[j];
        const expectedFirst = coPresenceIndex[charA]?.[charB];
        if (expectedFirst !== undefined && chunkOutput.chunk_index < expectedFirst) {
          stateConflicts.push({
            conflictId: makeBlockerId("state_conflict", charA, charB, String(chunkOutput.chunk_index)),
            field: "co_presence",
            characterId: `${charA}+${charB}`,
            claimA: `co-present in chunk ${chunkOutput.chunk_index} (from chunk output)`,
            claimB: `first shared chunk is ${expectedFirst} (from relationship ledger)`,
            sourceA: `pass1a_chunk_${chunkOutput.chunk_index}`,
            sourceB: "relationship_ledger",
            resolution: "claimB_wins",  // ledger wins over single chunk signal
            flagForHumanReview: false,
          });
        }
      }
    }
  }

  // ── Evidence Coverage ─────────────────────────────────────────────────────
  // Hoist identity-group map outside the entry × chunk × character triple loop.
  // Previously this called buildRawIdentityGroupMap(chunkOutputs) on every
  // character in every chunk in every entry — O(n³) on large manuscripts.
  // Hoisting to O(1) pre-build eliminates the regression surfaced by the
  // stress harness on 40-chunk inputs.
  const coverageIdentityGroupMap = buildRawIdentityGroupMap(chunkOutputs);
  const characterCoverage: Record<string, EvidenceCoverage> = {};
  for (const entry of entries) {
    const id = entry.canonical_name;
    const confirmedChunks = new Set<number>();
    for (const co of chunkOutputs) {
      if (co.characters.some((c) =>
        resolveCanonical(c.canonical_name, new Map(), coverageIdentityGroupMap) === entry.canonical_name ||
        (c.aliases ?? []).some((alias) => resolveCanonical(alias, new Map(), coverageIdentityGroupMap) === entry.canonical_name) ||
        c.canonical_name === entry.canonical_name ||
        (c.aliases ?? []).includes(entry.canonical_name)
      )) {
        confirmedChunks.add(co.chunk_index);
      }
    }
    const zonesSet = new Set<string>();
    for (const ci of confirmedChunks) {
      zonesSet.add(chunkToActZone(ci, totalChunksInManuscript));
    }
    const covered = [...zonesSet];
    const missing = ACT_ZONES.filter((z) => !zonesSet.has(z));
    const byZone: Record<string, EvidenceConfidence | "none"> = {};
    for (const z of ACT_ZONES) {
      byZone[z] = covered.includes(z) ? "explicit" : "none";
    }
    characterCoverage[id] = {
      chunksConfirmed: confirmedChunks.size,
      totalChunks: totalChunksInManuscript,
      actZonesCovered: covered,
      actZonesMissing: missing,
      confidenceByZone: byZone,
    };
  }

  // ── Final Assembly ────────────────────────────────────────────────────────
  return {
    schema_version: "character_ledger_v2",
    prompt_version: PASS1A_PROMPT_VERSION,
    job_id: jobId,
    generated_at: new Date().toISOString(),
    total_chunks_processed: chunkOutputs.length,

    identityLedger,
    stateTimelines,
    relationshipLedger,
    psychologyLedger,
    objectLedger,
    terminalLedger,

    validationQueries: {
      characterPresenceIndex,
      coPresenceIndex,
      nameStateIndex,
      copingIndex,
      objectPresenceIndex,
      symbolPayoffIndex,
      unresolvedPromisesIndex,
    },

    activeBlockers,
    negativeKnowledge,
    stateConflicts,
    characterCoverage,

    coverage_summary: {
      protagonists: ledger.coverage_summary.protagonists,
      co_protagonists: ledger.coverage_summary.co_protagonists,
      antagonists: ledger.coverage_summary.antagonists,
      high_value_objects: objectLedger
        .filter((o) => o.missedIfAbsentFromReport)
        .map((o) => o.objectId),
      unresolved_promises: Object.entries(unresolvedPromisesIndex)
        .filter(([, promises]) => promises.length > 0)
        .map(([id]) => id),
      open_terminal_ledgers: terminalLedger
        .filter((t) => t.narrativeClosureStatus === "underpaid" || t.narrativeClosureStatus === "intentionally_open")
        .map((t) => t.characterId),
      hard_fail_triggers: ledger.coverage_summary.hard_fail_triggers,
    },
  };
}

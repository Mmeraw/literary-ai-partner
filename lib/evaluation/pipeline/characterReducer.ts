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
} from "./types";
import { PASS1A_PROMPT_VERSION } from "./prompts/pass1a-character-sweep";

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

function resolveCanonical(name: string, aliasMap: Map<string, string>): string {
  return aliasMap.get(normalize(name)) ?? name.trim();
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
    const key = sym.object.trim().toLowerCase();
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
  const { chunkOutputs, jobId, totalChunksInManuscript } = params;

  if (chunkOutputs.length === 0) {
    return buildEmptyLedger(jobId);
  }

  // Collect all character names across all chunks
  const allNames = chunkOutputs.flatMap((co) =>
    co.characters.map((c) => c.canonical_name),
  );
  const aliasMap = buildAliasMap(allNames);

  // Group all chunk entries by resolved canonical name
  const grouped = new Map<string, Array<{ entry: Pass1aCharacterChunkEntry; chunk_index: number }>>();

  for (const chunkOutput of chunkOutputs) {
    for (const char of chunkOutput.characters) {
      const canonical = resolveCanonical(char.canonical_name, aliasMap);
      if (!grouped.has(canonical)) grouped.set(canonical, []);
      grouped.get(canonical)!.push({ entry: char, chunk_index: chunkOutput.chunk_index });
    }
    // Also resolve aliases mentioned in the entry itself
    for (const char of chunkOutput.characters) {
      for (const alias of char.aliases ?? []) {
        const resolved = resolveCanonical(alias, aliasMap);
        if (resolved !== resolveCanonical(char.canonical_name, aliasMap)) {
          // This alias resolves to a different canonical — add cross-reference
          const canonical = resolveCanonical(char.canonical_name, aliasMap);
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
      const canonical = resolveCanonical(char.canonical_name, aliasMap);
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
      .filter((e) => e.arc_shift && e.arc_shift.trim())
      .map((e) => e.arc_shift!)
      .slice(0, 5);

    // Five Ws + How — take first non-null across all chunks
    const whoIsThis = firstEntry.who_is_this ?? entries.find((e) => e.who_is_this)?.who_is_this ?? "";
    const whatDoTheyWant = entries.find((e) => e.what_do_they_want)?.what_do_they_want ?? null;
    const primaryLocations = [...new Set(entries.map((e) => e.where_are_they).filter((l): l is string => !!l))];
    const whySignal = entries.find((e) => e.why_signal)?.why_signal ?? null;
    const howSignal = entries.find((e) => e.how_signal)?.how_signal ?? null;

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
          other_character: resolveCanonical(r.other_character, aliasMap),
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
            .filter((r) => normalize(resolveCanonical(r.other_character, aliasMap)) === normalize(engine.other_character))
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
      if (e.how_signal) {
        const desc = e.how_signal.toLowerCase().trim();
        if (!seenCopingDescs.has(desc)) {
          seenCopingDescs.add(desc);
          const repeatCount = entries.filter((x) =>
            x.how_signal?.toLowerCase().trim() === desc
          ).length;
          copingMechanisms.push({
            description: e.how_signal,
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

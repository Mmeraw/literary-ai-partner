/**
 * buildStoryLayerFromLedger.ts
 *
 * Maps a completed Pass1aCharacterLedger + CharacterLedgerV2 into the nine
 * canonical Story Layer payloads required by pass1a_story_layer_v1.
 *
 * Layer contract (from STORY_LAYER_CONTRACT_V1_FINAL, canonical authority):
 *   1. source_integrity_layer
 *   2. pov_structure_layer
 *   3. canonical_identity_layer
 *   4. cast_role_tier_layer
 *   5. identity_pronoun_layer
 *   6. relationship_network_layer
 *   7. object_symbol_layer
 *   8. location_timeline_worldstate_layer
 *   9. threat_antagonist_ending_layer
 *
 * This module ONLY does extraction — no scoring, no governance, no support
 * artifacts. The output is a raw story-understanding map. Governance (warnings,
 * blockers) lives in CharacterLedgerV2.activeBlockers and is propagated to
 * ledger_quality_report_v1, NOT embedded here.
 */

import type {
  Pass1aCharacterLedger,
  CharacterLedgerV2,
  CharacterIdentityLedgerEntry,
  RelationshipLedgerEntry,
  ObjectLedgerEntry,
  TerminalLedgerEntry,
} from '@/lib/evaluation/pipeline/types';
import type { StoryLayerPayload } from './storyLayerArtifactWriters';

// ─────────────────────────────────────────────────────────────────────────────
// Layer 1 — Source Integrity
// ─────────────────────────────────────────────────────────────────────────────

function buildSourceIntegrityLayer(
  ledger: Pass1aCharacterLedger,
  ledgerV2: CharacterLedgerV2,
): Record<string, unknown> {
  const hardFails = ledger.coverage_summary.hard_fail_triggers ?? [];
  const hasHardFails = hardFails.length > 0;

  // Stale chunk ratio: if identityLedger is populated, compute
  const totalChunks = ledgerV2.total_chunks_processed;

  // Cross-layer emptiness diagnostics
  const characterCount = ledgerV2.identityLedger.length;
  const relationshipCount = ledgerV2.relationshipLedger.length;
  const objectCount = ledgerV2.objectLedger.length;
  const symbolPayoffItems = ledger.coverage_summary.symbol_payoff_items ?? [];

  const emptyLayerWarnings: Array<{
    layer: string;
    code: string;
    message: string;
  }> = [];

  if (characterCount >= 2 && relationshipCount === 0) {
    emptyLayerWarnings.push({
      layer: 'relationship_network_layer',
      code: 'EMPTY_RELATIONSHIP_LAYER',
      message: `${characterCount} characters detected but no relationship arcs mapped. The relationship sweep may have been incomplete or the manuscript may lack inter-character dynamics.`,
    });
  }

  if (characterCount >= 1 && objectCount === 0) {
    emptyLayerWarnings.push({
      layer: 'object_symbol_layer',
      code: 'EMPTY_OBJECT_LAYER',
      message: `${characterCount} character(s) detected but no objects or symbols tracked. The object sweep may have been incomplete.`,
    });
  }

  if (symbolPayoffItems.length > 0 && objectCount === 0) {
    emptyLayerWarnings.push({
      layer: 'object_symbol_layer',
      code: 'SYMBOL_ITEMS_WITHOUT_OBJECTS',
      message: `${symbolPayoffItems.length} symbol/payoff item(s) flagged but object ledger is empty. Object tracking may need repair.`,
    });
  }

  const hasEmptyLayerWarnings = emptyLayerWarnings.length > 0;
  const integrityStatus = hasHardFails
    ? 'HARD_FAIL'
    : hasEmptyLayerWarnings
      ? 'DEGRADED'
      : 'CLEAN';

  return {
    schema_version: 'source_integrity_layer_v1',
    total_chunks_processed: totalChunks,
    hard_fail_triggers: hardFails,
    hard_fail_present: hasHardFails,
    hard_fail_count: hardFails.length,
    state_conflicts: ledgerV2.stateConflicts ?? [],
    state_conflict_count: (ledgerV2.stateConflicts ?? []).length,
    unresolved_conflicts: (ledgerV2.stateConflicts ?? []).filter(
      (c) => c.resolution === 'unresolved',
    ).length,
    empty_layer_warnings: emptyLayerWarnings,
    empty_layer_warning_count: emptyLayerWarnings.length,
    integrity_status: integrityStatus,
    generated_at: ledger.generated_at,
    prompt_version: ledger.prompt_version,
    schema_ledger_version: ledger.schema_version,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 2 — POV Structure
// ─────────────────────────────────────────────────────────────────────────────

function buildPovStructureLayer(
  ledger: Pass1aCharacterLedger,
  ledgerV2: CharacterLedgerV2,
): Record<string, unknown> {
  // Derive POV structure from identity ledger — characters with protagonist/co_protagonist role
  const povCharacters = ledgerV2.identityLedger
    .filter(
      (entry) =>
        entry.narrativeRole === 'protagonist' || entry.narrativeRole === 'co_protagonist',
    )
    .map((entry) => ({
      character_id: entry.characterId,
      canonical_name: entry.canonicalName,
      narrative_role: entry.narrativeRole,
      importance_level: entry.importanceLevel,
      first_appearance: entry.firstAppearance,
      last_appearance: entry.lastAppearance,
      coverage: ledgerV2.characterCoverage?.[entry.characterId] ?? null,
    }));

  // Build from ledger v1 coverage summary as authoritative list
  const protagonists = ledger.coverage_summary.protagonists ?? [];
  const co_protagonists = ledger.coverage_summary.co_protagonists ?? [];

  // Narrative share estimate: protagonists + co_protagonists / total characters
  const totalIdentified = ledgerV2.identityLedger.length;
  const povCount = povCharacters.length;

  return {
    schema_version: 'pov_structure_layer_v1',
    pov_characters: povCharacters,
    protagonists_v1: protagonists,
    co_protagonists_v1: co_protagonists,
    pov_character_count: povCount,
    total_characters_identified: totalIdentified,
    pov_identified: povCount > 0,
    pov_detection_note:
      povCount === 0
        ? 'No POV characters detected — character sweep may have low coverage'
        : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 3 — Canonical Identity & Alias Map
// ─────────────────────────────────────────────────────────────────────────────

function buildCanonicalIdentityLayer(
  ledger: Pass1aCharacterLedger,
  ledgerV2: CharacterLedgerV2,
): Record<string, unknown> {
  const identityGroups = ledgerV2.identityLedger.map((entry: CharacterIdentityLedgerEntry) => ({
    character_id: entry.characterId,
    canonical_name: entry.canonicalName,
    aliases: entry.aliases,
    name_history: entry.nameHistory,
    narrative_role: entry.narrativeRole,
    importance_level: entry.importanceLevel,
    first_appearance: entry.firstAppearance,
    last_appearance: entry.lastAppearance,
    final_status: entry.finalStatus,
    contradictions: entry.contradictions,
    identity_markers: entry.identityMarkers ?? null,
    recommendation_blockers: entry.recommendationBlockers,
  }));

  const fragmentedEntries = ledger.entries.filter(
    (e) => e.aliases && e.aliases.length > 2,
  );

  return {
    schema_version: 'canonical_identity_layer_v1',
    identity_groups: identityGroups,
    identity_group_count: identityGroups.length,
    // V1 ledger entries (raw, pre-V2 reduction) as supplementary reference
    v1_entries_count: ledger.entries.length,
    possibly_fragmented_entries: fragmentedEntries.length,
    name_state_index: ledgerV2.validationQueries.nameStateIndex ?? {},
    identity_merge_status: identityGroups.length > 0 ? 'OK' : 'DEGRADED',
    protagonists: ledger.coverage_summary.protagonists,
    co_protagonists: ledger.coverage_summary.co_protagonists,
    antagonists: ledger.coverage_summary.antagonists,
    missing_or_underweighted: ledger.coverage_summary.missing_or_underweighted,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 4 — Cast Role Tiers
// ─────────────────────────────────────────────────────────────────────────────

function buildCastRoleTierLayer(
  ledger: Pass1aCharacterLedger,
  ledgerV2: CharacterLedgerV2,
): Record<string, unknown> {
  const byTier: Record<string, Array<{ character_id: string; canonical_name: string; importance_level: string }>> = {
    protagonist: [],
    co_protagonist: [],
    antagonist: [],
    mentor: [],
    foil: [],
    secondary: [],
    symbolic_force: [],
    collective_force: [],
    animal_companion: [],
    unknown: [],
  };

  for (const entry of ledgerV2.identityLedger) {
    const tier = entry.narrativeRole ?? 'unknown';
    if (!byTier[tier]) byTier[tier] = [];
    byTier[tier].push({
      character_id: entry.characterId,
      canonical_name: entry.canonicalName,
      importance_level: entry.importanceLevel,
    });
  }

  return {
    schema_version: 'cast_role_tier_layer_v1',
    tier_map: byTier,
    total_cast: ledgerV2.identityLedger.length,
    protagonist_count: byTier.protagonist.length,
    antagonist_count: byTier.antagonist.length,
    major_secondary_characters: ledger.coverage_summary.major_secondary_characters ?? [],
    relational_engines: ledger.coverage_summary.relational_engines ?? [],
    character_coverage_index: ledgerV2.characterCoverage ?? {},
    // V1 co-presence index for downstream blocker checking
    co_presence_index: ledgerV2.validationQueries.coPresenceIndex ?? {},
    character_presence_index: ledgerV2.validationQueries.characterPresenceIndex ?? {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 9 — Identity & Pronoun Verification
// ─────────────────────────────────────────────────────────────────────────────

function buildIdentityPronounLayer(
  ledger: Pass1aCharacterLedger,
  _ledgerV2: CharacterLedgerV2,
): Record<string, unknown> {
  const entries = ledger.entries.map((entry) => ({
    canonical_name: entry.canonical_name,
    pronouns: entry.pronouns ?? [],
    gender_identity: entry.gender_identity ?? 'unknown',
    first_chunk_index: entry.first_chunk_index,
    last_chunk_index: entry.last_chunk_index,
    warnings: (entry.warnings ?? []).filter(
      (w) => w.type === 'pronoun_inconsistency' || w.type === 'gender_conflict',
    ),
  }));

  const shiftsDetected = entries.filter(
    (e) => e.warnings.some((w) => w.type === 'pronoun_inconsistency'),
  ).length;

  return {
    schema_version: 'identity_pronoun_layer_v1',
    entries,
    total_characters: entries.length,
    pronoun_shifts_detected: shiftsDetected,
    generated_at: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 5 — Relationship Arc Network
// ─────────────────────────────────────────────────────────────────────────────

function buildRelationshipNetworkLayer(
  _ledger: Pass1aCharacterLedger,
  ledgerV2: CharacterLedgerV2,
): Record<string, unknown> {
  const pairs = ledgerV2.relationshipLedger.map((entry: RelationshipLedgerEntry) => ({
    character_a: entry.characterA,
    character_b: entry.characterB,
    relationship_type_start: entry.relationshipTypeStart,
    relationship_type_end: entry.relationshipTypeEnd,
    first_co_presence_chunk: entry.firstCoPresenceChunk,
    first_co_presence_chapter: entry.firstCoPresenceChapter,
    invalid_before_chapter: entry.invalidBeforeChapter,
    first_shared_location: entry.firstSharedLocation,
    power_dynamic_timeline: entry.powerDynamicTimeline,
    pivot_moments: entry.pivotMoments,
    shared_objects: entry.sharedObjects,
    unresolved_obligations: entry.unresolvedLedger,
    recommendation_blocker: entry.recommendationBlocker,
  }));

  const negativeKnowledge = ledgerV2.negativeKnowledge ?? [];

  return {
    schema_version: 'relationship_network_layer_v1',
    relationship_pairs: pairs,
    pair_count: pairs.length,
    negative_knowledge_states: negativeKnowledge,
    unresolved_obligations: ledgerV2.coverage_summary?.unresolved_promises ?? [],
    co_presence_index: ledgerV2.validationQueries.coPresenceIndex ?? {},
    unresolved_promises_index: ledgerV2.validationQueries.unresolvedPromisesIndex ?? {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 6 — Object / Symbol / Motif Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

function buildObjectSymbolLayer(
  ledger: Pass1aCharacterLedger,
  ledgerV2: CharacterLedgerV2,
): Record<string, unknown> {
  const objects = ledgerV2.objectLedger.map((entry: ObjectLedgerEntry) => ({
    object_id: entry.objectId,
    name: entry.objectName,
    current_holder: entry.currentHolder,
    attached_characters: entry.attachedCharacters,
    first_appearance_chunk: entry.firstAppearanceChunk,
    first_appearance_chapter: entry.firstAppearanceChapter,
    last_appearance_chunk: entry.lastAppearanceChunk,
    ownership_path: entry.ownershipPath,
    transfer_events: entry.transferEvents,
    payoff_chunk: entry.payoffChunk,
    payoff_description: entry.payoffDescription,
    missed_if_absent_from_report: entry.missedIfAbsentFromReport,
    status: entry.status,
  }));

  const symbolPayoffItems = ledger.coverage_summary.symbol_payoff_items ?? [];
  const highValueObjects = ledgerV2.coverage_summary?.high_value_objects ?? [];

  return {
    schema_version: 'object_symbol_layer_v1',
    objects: objects,
    object_count: objects.length,
    high_value_object_ids: highValueObjects,
    symbol_payoff_items_v1: symbolPayoffItems,
    object_presence_index: ledgerV2.validationQueries.objectPresenceIndex ?? {},
    symbol_payoff_index: ledgerV2.validationQueries.symbolPayoffIndex ?? {},
    coping_index: ledgerV2.validationQueries.copingIndex ?? {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 7 — Location / Timeline / World State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a raw location string from LLM output into clean place names.
 * Splits compound location descriptions into individual canonical places.
 */
function normalizeLocationString(raw: string): string[] {
  // Split on semicolons, "and then", "then", or comma-delimited lists
  const fragments = raw
    .split(/[;]|,\s*(?:then|later|and then)\b|(?:^|\s)then\s|(?:^|\s)later\s/i)
    .map((f) => f.trim())
    .filter(Boolean);

  const results: string[] = [];
  for (const frag of fragments) {
    let cleaned = frag
      // Strip leading temporal/connective phrases
      .replace(/^(?:then|later|and|back|also|still|now)\s+(?:at|in|on|to|the)?\s*/i, "")
      // Strip trailing character references
      .replace(/\s+with\s+.*$/i, "")
      .replace(/\s+by\s+(?:afternoon|morning|evening|night|day)\b.*$/i, "")
      .replace(/\s+in\s+(?:company|speculation|conversation)\b.*$/i, "")
      // Strip trailing prepositional clauses that describe what happens there
      .replace(/\s+where\s+.*$/i, "")
      .replace(/\s+(?:during|after|before)\s+(?:the\s+)?(?:dinner|party|meal|gathering|service)\b.*$/i, "")
      .trim();

    if (!cleaned || cleaned.length < 2) continue;
    // Filter out sentence fragments — real location names are typically under 60 chars
    if (cleaned.length > 60) continue;
    // Filter out fragments that look like full sentences (contain verbs)
    if (/\b(?:was|were|had|has|is|are|went|came|sat|stood|walked|looked|felt)\b/i.test(cleaned)) continue;

    // Capitalize first letter
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    results.push(cleaned);
  }
  return results;
}

function buildLocationTimelineWorldstateLayer(
  _ledger: Pass1aCharacterLedger,
  ledgerV2: CharacterLedgerV2,
): Record<string, unknown> {
  // Extract locations from state timelines, normalizing and counting frequency
  const locationFreq = new Map<string, number>();
  const stateTimelines = ledgerV2.stateTimelines ?? [];

  for (const snapshot of stateTimelines) {
    if (snapshot.location) {
      const normalized = normalizeLocationString(snapshot.location);
      for (const loc of normalized) {
        locationFreq.set(loc, (locationFreq.get(loc) ?? 0) + 1);
      }
    }
    if (snapshot.country) {
      locationFreq.set(snapshot.country, (locationFreq.get(snapshot.country) ?? 0) + 1);
    }
  }

  // Identify arc-critical locations: first chunk, last chunk, and terminal events
  const arcCriticalLocations = new Set<string>();
  const totalChunks = ledgerV2.total_chunks_processed ?? 0;
  for (const snapshot of stateTimelines) {
    if (!snapshot.location) continue;
    const normalized = normalizeLocationString(snapshot.location);
    const isFirstChunk = snapshot.chunkRange[0] === 0;
    const isLastChunk = totalChunks > 0 && snapshot.chunkRange[1] >= totalChunks - 1;
    if (isFirstChunk || isLastChunk) {
      for (const loc of normalized) arcCriticalLocations.add(loc);
    }
  }
  // Terminal ledger locations (death, departure, major endings)
  // Find locations from state snapshots at terminal chunks
  for (const terminal of (ledgerV2.terminalLedger ?? [])) {
    if (terminal.terminalChunk == null) continue;
    const termChunk = terminal.terminalChunk;
    for (const snapshot of stateTimelines) {
      if (snapshot.characterId !== terminal.characterId) continue;
      if (snapshot.location && snapshot.chunkRange[0] <= termChunk && snapshot.chunkRange[1] >= termChunk) {
        for (const loc of normalizeLocationString(snapshot.location)) {
          arcCriticalLocations.add(loc);
        }
      }
    }
  }

  // Only keep locations that appear in 2+ snapshots (recurring/significant)
  // OR are arc-critical (opening, closing, death locations)
  // OR if there are very few total locations (short manuscripts), keep all
  const totalUniqueLocations = locationFreq.size;
  const significanceThreshold = totalUniqueLocations <= 5 ? 1 : 2;
  const locationSet = new Set<string>();
  for (const [loc, count] of locationFreq) {
    if (count >= significanceThreshold || arcCriticalLocations.has(loc)) {
      locationSet.add(loc);
    }
  }

  // Build per-character timeline summary
  const characterTimelines = new Map<string, {
    characterId: string;
    locationSequence: string[];
    timeRange: { firstChunk: number; lastChunk: number };
  }>();

  for (const snapshot of stateTimelines) {
    const charId = snapshot.characterId;
    if (!characterTimelines.has(charId)) {
      characterTimelines.set(charId, {
        characterId: charId,
        locationSequence: [],
        timeRange: { firstChunk: snapshot.chunkRange[0], lastChunk: snapshot.chunkRange[1] },
      });
    }
    const entry = characterTimelines.get(charId)!;
    if (snapshot.location) {
      const normalized = normalizeLocationString(snapshot.location);
      for (const loc of normalized) {
        if (!entry.locationSequence.includes(loc)) {
          entry.locationSequence.push(loc);
        }
      }
    }
    entry.timeRange.lastChunk = Math.max(entry.timeRange.lastChunk, snapshot.chunkRange[1]);
  }

  return {
    schema_version: 'location_timeline_worldstate_layer_v1',
    unique_locations: Array.from(locationSet),
    location_count: locationSet.size,
    character_timelines: Array.from(characterTimelines.values()),
    all_state_snapshots: stateTimelines,
    state_snapshot_count: stateTimelines.length,
    // Negative knowledge encodes what we know hasn't happened yet — key for blocker enforcement
    negative_knowledge: ledgerV2.negativeKnowledge ?? [],
    state_conflicts: ledgerV2.stateConflicts ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 8 — Threat / Antagonist / Ending Accountability
// ─────────────────────────────────────────────────────────────────────────────

function buildThreatAntagonistEndingLayer(
  ledger: Pass1aCharacterLedger,
  ledgerV2: CharacterLedgerV2,
): Record<string, unknown> {
  const antagonists = ledgerV2.identityLedger.filter(
    (e) => e.narrativeRole === 'antagonist',
  );

  const terminalLedger: TerminalLedgerEntry[] = ledgerV2.terminalLedger ?? [];

  const endingAccountabilityWarnings =
    ledger.coverage_summary.ending_accountability_warnings ?? [];

  const openTerminalLedgers = ledgerV2.coverage_summary?.open_terminal_ledgers ?? [];

  return {
    schema_version: 'threat_antagonist_ending_layer_v1',
    antagonists: antagonists.map((a) => ({
      character_id: a.characterId,
      canonical_name: a.canonicalName,
      first_appearance: a.firstAppearance,
      last_appearance: a.lastAppearance,
      final_status: a.finalStatus,
      recommendation_blockers: a.recommendationBlockers,
    })),
    antagonist_count: antagonists.length,
    terminal_ledger: terminalLedger,
    terminal_entry_count: terminalLedger.length,
    ending_accountability_warnings: endingAccountabilityWarnings,
    open_terminal_ledgers: openTerminalLedgers,
    active_blockers: ledgerV2.activeBlockers ?? [],
    active_blocker_count: (ledgerV2.activeBlockers ?? []).length,
    suppress_blockers: (ledgerV2.activeBlockers ?? []).filter((b) => b.severity === 'suppress'),
    // Psychology/coping — blocking "seed a ritual" recommendations
    psychology_ledger: ledgerV2.psychologyLedger ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the full 9-layer StoryLayerPayload from a completed Pass1aCharacterLedger
 * and CharacterLedgerV2.
 *
 * Called once at the end of phase_1a, just before writePhase1aReviewGateArtifacts.
 */
export function buildStoryLayerFromLedger(
  ledger: Pass1aCharacterLedger,
  ledgerV2: CharacterLedgerV2,
): StoryLayerPayload {
  return {
    source_integrity_layer: buildSourceIntegrityLayer(ledger, ledgerV2),
    pov_structure_layer: buildPovStructureLayer(ledger, ledgerV2),
    canonical_identity_layer: buildCanonicalIdentityLayer(ledger, ledgerV2),
    cast_role_tier_layer: buildCastRoleTierLayer(ledger, ledgerV2),
    identity_pronoun_layer: buildIdentityPronounLayer(ledger, ledgerV2),
    relationship_network_layer: buildRelationshipNetworkLayer(ledger, ledgerV2),
    object_symbol_layer: buildObjectSymbolLayer(ledger, ledgerV2),
    location_timeline_worldstate_layer: buildLocationTimelineWorldstateLayer(ledger, ledgerV2),
    threat_antagonist_ending_layer: buildThreatAntagonistEndingLayer(ledger, ledgerV2),
  };
}

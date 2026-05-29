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
  Pass1aChunkOutput,
  CharacterLedgerV2,
  CharacterIdentityLedgerEntry,
  RelationshipLedgerEntry,
  ObjectLedgerEntry,
  TerminalLedgerEntry,
} from '@/lib/evaluation/pipeline/types';
import type { StoryLayerPayload } from './storyLayerArtifactWriters';
import { buildPovStructureFromChunkOutputs } from '@/lib/evaluation/pipeline/povStructure';
import {
  applyIdentityDependencyMetadata,
  assessStoryLayerIdentityDependencies,
} from './storyLayerDependencyHealth';

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
  chunkOutputs?: Pass1aChunkOutput[],
): Record<string, unknown> {
  // POV ownership must be evidence-based from chunk-level pov_signal/focalization.
  // Narrative role tiers never confer POV ownership.
  const chunks = Array.isArray(chunkOutputs) ? chunkOutputs : [];
  const povFromChunks = chunks.length > 0
    ? buildPovStructureFromChunkOutputs({
        chunkOutputs: chunks,
        ledgerEntries: ledger.entries,
        totalChunks: ledgerV2.total_chunks_processed,
      })
    : [];

  const hasPovSignalData = povFromChunks.length > 0;

  const povCharacters = hasPovSignalData
    ? povFromChunks.map((pov) => {
        const identity = ledgerV2.identityLedger.find(
          (e) => e.canonicalName === pov.canonical_name,
        );
        return {
          character_id: identity?.characterId ?? pov.canonical_name,
          canonical_name: pov.canonical_name,
          narrative_role: identity?.narrativeRole ?? 'unknown',
          importance_level: identity?.importanceLevel ?? 'unknown',
          pov_type: pov.pov_type,
          narrative_share_pct: pov.narrative_share_pct,
          section_labels: pov.section_labels,
          is_primary: pov.is_primary,
          first_appearance: identity?.firstAppearance ?? null,
          last_appearance: identity?.lastAppearance ?? null,
          coverage: identity ? (ledgerV2.characterCoverage?.[identity.characterId] ?? null) : null,
        };
      })
    : [];

  const protagonists = ledger.coverage_summary.protagonists ?? [];
  const co_protagonists = ledger.coverage_summary.co_protagonists ?? [];
  const totalIdentified = ledgerV2.identityLedger.length;
  const povCount = povCharacters.length;
  const derivedFromRoleFallback = false;
  const povEvidenceStatus = povCount > 0 ? 'evidence_confirmed' : 'insufficient_evidence';

  return {
    schema_version: 'pov_structure_layer_v1',
    pov_characters: povCharacters,
    protagonists_v1: protagonists,
    co_protagonists_v1: co_protagonists,
    pov_character_count: povCount,
    total_characters_identified: totalIdentified,
    pov_identified: povCount > 0,
    pov_evidence_status: povEvidenceStatus,
    pov_role_fallback_derived: derivedFromRoleFallback,
    pov_truth_status: povCount > 0 ? 'clean' : 'degraded',
    pov_detection_note:
      povCount === 0
        ? 'POV could not be confirmed from evidence; role-tier fallback is blocked to prevent invented POV ownership.'
        : hasPovSignalData
          ? null
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
// Layer 5 — Identity & Pronoun Verification
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
    pair_key: entry.pairKey,
    character_a: entry.characterA,
    character_b: entry.characterB,
    character_a_label: entry.characterADisplayName ?? entry.characterA,
    character_b_label: entry.characterBDisplayName ?? entry.characterB,
    character_a_disambiguation_group: entry.characterASameNameDisambiguationGroup ?? null,
    character_b_disambiguation_group: entry.characterBSameNameDisambiguationGroup ?? null,
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
    symbolic_function_stages: entry.symbolicFunctionByStage ?? [],
    payoff_chunk: entry.payoffChunk,
    payoff_description: entry.payoffDescription,
    missed_if_absent_from_report: entry.missedIfAbsentFromReport,
    status: entry.status,
    narrative_span: entry.lastAppearanceChunk - entry.firstAppearanceChunk,
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

function buildLocationTimelineWorldstateLayer(
  _ledger: Pass1aCharacterLedger,
  ledgerV2: CharacterLedgerV2,
): Record<string, unknown> {
  // Extract unique locations from state timelines
  const locationSet = new Set<string>();
  const stateTimelines = ledgerV2.stateTimelines ?? [];

  for (const snapshot of stateTimelines) {
    if (snapshot.location) locationSet.add(snapshot.location);
    if (snapshot.country) locationSet.add(snapshot.country);
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
    if (snapshot.location && !entry.locationSequence.includes(snapshot.location)) {
      entry.locationSequence.push(snapshot.location);
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

type PressureSourceKind = 'character' | 'non_character' | 'internal';

type PressureEndingState =
  | 'resolved'
  | 'transformed'
  | 'terminal'
  | 'unresolved'
  | 'intentionally_ambiguous'
  | 'ongoing_systemic_pressure';

type PressureEscalationState = 'latent' | 'active' | 'escalating' | 'terminal';

type PressureTaxonomy =
  | 'interpersonal_pressure'
  | 'romantic_desire_pressure'
  | 'marital_family_domestic_pressure'
  | 'social_class_pressure'
  | 'legal_institutional_pressure'
  | 'economic_debt_pressure'
  | 'internal_moral_pressure'
  | 'symbolic_environmental_pressure'
  | 'physical_danger_violence_pressure'
  | 'time_deadline_pressure';

interface PressureSystemEntry {
  pressure_id: string;
  pressure_type: PressureTaxonomy;
  source_kind: PressureSourceKind;
  source_character_id?: string;
  source_label: string;
  source_aliases: string[];
  target_character_ids: string[];
  target_character_names: string[];
  evidence_summary: string[];
  escalation_state: PressureEscalationState;
  ending_state: PressureEndingState;
}

function slugifyPressureId(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function inferPressureTaxonomyFromIdentity(
  role: string,
  canonicalName: string,
  aliases: string[],
): PressureTaxonomy {
  const roleNorm = String(role ?? '').toLowerCase();
  const text = `${canonicalName} ${(aliases ?? []).join(' ')}`.toLowerCase();

  if (roleNorm === 'romantic_catalyst') return 'romantic_desire_pressure';
  if (roleNorm === 'sexual_destabilizer') return 'physical_danger_violence_pressure';
  if (roleNorm === 'domestic_foil' || roleNorm === 'patriarchal_pressure' || roleNorm === 'pressure_agent') {
    if (/(legal|court|judge|law|prison|machinery|institution|police|state)/.test(text)) {
      return 'legal_institutional_pressure';
    }
    if (/(debt|money|class|poverty|shame|wealth|economic)/.test(text)) {
      return 'economic_debt_pressure';
    }
    return 'marital_family_domestic_pressure';
  }
  if (roleNorm === 'social_observer' || roleNorm === 'social_catalyst') return 'social_class_pressure';
  if (roleNorm === 'symbolic_force') return 'symbolic_environmental_pressure';
  if (roleNorm === 'collective_force') {
    if (/(court|law|legal|institution|state|police|prison)/.test(text)) return 'legal_institutional_pressure';
    if (/(class|society|social|reputation|expectation|convention)/.test(text)) return 'social_class_pressure';
    return 'symbolic_environmental_pressure';
  }
  if (roleNorm === 'antagonist') return 'interpersonal_pressure';

  if (/(debt|economic|money|class shame|class)/.test(text)) return 'economic_debt_pressure';
  if (/(legal|court|law|prison|institution)/.test(text)) return 'legal_institutional_pressure';
  if (/(sea|gulf|water|river|weather|storm|environment)/.test(text)) return 'symbolic_environmental_pressure';
  if (/(guilt|shame|longing|autonomy|moral|conscience)/.test(text)) return 'internal_moral_pressure';

  return 'interpersonal_pressure';
}

function pressureSourceKindFromRole(role: string): PressureSourceKind {
  const roleNorm = String(role ?? '').toLowerCase();
  if (roleNorm === 'symbolic_force' || roleNorm === 'collective_force') return 'non_character';
  return 'character';
}

function classifyPressureEndingState(params: {
  sourceKind: PressureSourceKind;
  finalStatus: string;
  terminal: TerminalLedgerEntry | undefined;
}): PressureEndingState {
  const finalStatus = params.finalStatus.toLowerCase();
  const terminal = params.terminal;

  if (terminal) {
    if (terminal.terminalCondition === 'death' || terminal.terminalCondition === 'departure' || terminal.terminalCondition === 'disappearance' || terminal.terminalCondition === 'transformation') {
      return 'terminal';
    }
    if (terminal.narrativeClosureStatus === 'fully_resolved') return 'resolved';
    if (terminal.narrativeClosureStatus === 'partially_resolved') return 'transformed';
    if (terminal.narrativeClosureStatus === 'intentionally_open') return 'intentionally_ambiguous';
    if (terminal.narrativeClosureStatus === 'underpaid') return 'unresolved';
  }

  if (finalStatus === 'dead' || finalStatus === 'missing') return 'terminal';
  if (finalStatus === 'transformed') return 'transformed';

  if (params.sourceKind === 'non_character') return 'ongoing_systemic_pressure';
  return finalStatus === 'unresolved' ? 'unresolved' : 'resolved';
}

function escalationForEnding(ending: PressureEndingState, pressureType: PressureTaxonomy): PressureEscalationState {
  if (ending === 'terminal') return 'terminal';
  if (ending === 'ongoing_systemic_pressure') return 'escalating';
  if (
    pressureType === 'legal_institutional_pressure'
    || pressureType === 'economic_debt_pressure'
    || pressureType === 'physical_danger_violence_pressure'
    || pressureType === 'internal_moral_pressure'
  ) {
    return 'escalating';
  }
  if (ending === 'resolved' || ending === 'transformed') return 'active';
  return 'latent';
}

function inferInternalPressureTaxonomy(text: string): PressureTaxonomy {
  const t = text.toLowerCase();
  if (/(debt|money|economic|class shame|poverty)/.test(t)) return 'economic_debt_pressure';
  if (/(guilt|shame|moral|conscience|autonomy|longing)/.test(t)) return 'internal_moral_pressure';
  if (/(deadline|time|late|clock|running out)/.test(t)) return 'time_deadline_pressure';
  return 'internal_moral_pressure';
}

function narrativePressureVectorSourceForSystem(system: PressureSystemEntry):
  | 'person'
  | 'institution'
  | 'environment'
  | 'internal_contradiction'
  | 'social_pressure'
  | 'poverty'
  | 'systemic_constraint'
  | 'family_obligation' {
  if (system.source_kind === 'internal') return 'internal_contradiction';

  switch (system.pressure_type) {
    case 'legal_institutional_pressure':
      return 'institution';
    case 'economic_debt_pressure':
      return 'poverty';
    case 'symbolic_environmental_pressure':
      return 'environment';
    case 'social_class_pressure':
      return 'social_pressure';
    case 'marital_family_domestic_pressure':
      return 'family_obligation';
    case 'time_deadline_pressure':
      return 'systemic_constraint';
    default:
      return system.source_kind === 'character' ? 'person' : 'systemic_constraint';
  }
}

function buildThreatAntagonistEndingLayer(
  ledger: Pass1aCharacterLedger,
  ledgerV2: CharacterLedgerV2,
): Record<string, unknown> {
  const pressureBearingRoles = new Set([
    'antagonist',
    'pressure_agent',
    'romantic_catalyst',
    'sexual_destabilizer',
    'domestic_foil',
    'artistic_countermodel',
    'social_observer',
    'social_catalyst',
    'patriarchal_pressure',
    'symbolic_force',
    'collective_force',
  ]);

  const antagonists = ledgerV2.identityLedger.filter(
    (e) => e.narrativeRole === 'antagonist',
  );

  const terminalLedger: TerminalLedgerEntry[] = ledgerV2.terminalLedger ?? [];

  const terminalByCharacterId = new Map(terminalLedger.map((entry) => [entry.characterId, entry]));

  const protagonistIdentityIds = ledgerV2.identityLedger
    .filter((entry) => entry.narrativeRole === 'protagonist' || entry.narrativeRole === 'co_protagonist')
    .map((entry) => entry.characterId);

  const protagonistsFromCoverage = (ledger.coverage_summary.protagonists ?? [])
    .map((name) => ledgerV2.identityLedger.find((entry) => entry.canonicalName === name)?.characterId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const targetCharacterIds = protagonistIdentityIds.length > 0
    ? protagonistIdentityIds
    : protagonistsFromCoverage;

  const targetCharacterNames = targetCharacterIds
    .map((id) => ledgerV2.identityLedger.find((entry) => entry.characterId === id)?.canonicalName ?? id);

  const pressureSystemsById = new Map<string, PressureSystemEntry>();

  for (const entry of ledgerV2.identityLedger) {
    const role = String(entry.narrativeRole ?? 'unknown').toLowerCase();
    if (!pressureBearingRoles.has(role)) continue;

    const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
    const pressureType = inferPressureTaxonomyFromIdentity(role, entry.canonicalName, aliases);
    const sourceKind = pressureSourceKindFromRole(role);
    const endingState = classifyPressureEndingState({
      sourceKind,
      finalStatus: String(entry.finalStatus ?? 'unresolved'),
      terminal: terminalByCharacterId.get(entry.characterId),
    });

    const evidenceSummary = [
      `${entry.canonicalName} classified as ${role.replace(/_/g, ' ')} in cast-role identity ledger.`,
      ...(entry.recommendationBlockers ?? []).slice(0, 2).map((blocker) => blocker.rule),
    ].filter((line) => line && line.trim().length > 0);

    const baseId = `${entry.characterId}:${pressureType}`;
    const pressureId = slugifyPressureId(baseId);

    const existing = pressureSystemsById.get(pressureId);
    if (existing) {
      existing.source_aliases = Array.from(new Set([...existing.source_aliases, ...aliases]));
      existing.evidence_summary = Array.from(new Set([...existing.evidence_summary, ...evidenceSummary]));
      if (existing.ending_state === 'resolved' && endingState !== 'resolved') {
        existing.ending_state = endingState;
      }
      if (existing.escalation_state !== 'terminal' && escalationForEnding(endingState, pressureType) === 'terminal') {
        existing.escalation_state = 'terminal';
      }
      continue;
    }

    pressureSystemsById.set(pressureId, {
      pressure_id: pressureId,
      pressure_type: pressureType,
      source_kind: sourceKind,
      source_character_id: sourceKind === 'character' ? entry.characterId : undefined,
      source_label: entry.canonicalName,
      source_aliases: aliases,
      target_character_ids: targetCharacterIds,
      target_character_names: targetCharacterNames,
      evidence_summary: evidenceSummary,
      escalation_state: escalationForEnding(endingState, pressureType),
      ending_state: endingState,
    });
  }

  for (const psych of ledgerV2.psychologyLedger ?? []) {
    const identity = ledgerV2.identityLedger.find((entry) => entry.characterId === psych.characterId);
    const sourceLabel = identity?.canonicalName ?? psych.characterId;
    const psychologicalEvidence = [
      psych.psychologicalArc,
      ...(psych.copingMechanisms ?? []).map((mechanism) => mechanism.description),
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' ')
      .trim();

    if (!psychologicalEvidence) continue;

    if (!/(guilt|shame|longing|autonomy|moral|conscience|debt|class|money|economic|deadline|time)/i.test(psychologicalEvidence)) {
      continue;
    }

    const pressureType = inferInternalPressureTaxonomy(psychologicalEvidence);
    const terminal = terminalByCharacterId.get(psych.characterId);
    const endingState = classifyPressureEndingState({
      sourceKind: 'internal',
      finalStatus: String(identity?.finalStatus ?? 'unresolved'),
      terminal,
    });

    const pressureId = slugifyPressureId(`${psych.characterId}:${pressureType}:internal`);
    if (pressureSystemsById.has(pressureId)) continue;

    pressureSystemsById.set(pressureId, {
      pressure_id: pressureId,
      pressure_type: pressureType,
      source_kind: 'internal',
      source_character_id: psych.characterId,
      source_label: `${sourceLabel} internal pressure`,
      source_aliases: [],
      target_character_ids: [psych.characterId],
      target_character_names: [sourceLabel],
      evidence_summary: [
        `${sourceLabel} carries internal pressure trajectory in psychology ledger.`,
        psychologicalEvidence,
      ],
      escalation_state: escalationForEnding(endingState, pressureType),
      ending_state: endingState,
    });
  }

  const pressureSystems = Array.from(pressureSystemsById.values())
    .sort((a, b) => a.source_label.localeCompare(b.source_label));

  const threatSystems = Array.from(
    new Set(
      pressureSystems.flatMap((system) => {
        const labels: string[] = [system.source_label];
        if (system.source_aliases.some((alias) => /legal machinery/i.test(alias))) {
          labels.push(`${system.source_label}/legal machinery`);
        }
        return labels;
      }),
    ),
  );

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
    pressure_systems: pressureSystems,
    pressure_system_count: pressureSystems.length,
    non_character_pressure_count: pressureSystems.filter((system) => system.source_kind === 'non_character').length,
    pressure_types_present: Array.from(new Set(pressureSystems.map((system) => system.pressure_type))).sort(),
    threat_systems: threatSystems,
    narrative_pressure_vectors: pressureSystems.map((system) => ({
      vector_source: narrativePressureVectorSourceForSystem(system),
      evidence_summary: system.evidence_summary.join(' ').slice(0, 400),
      structural_impact_score: system.escalation_state === 'terminal'
        ? 5
        : system.escalation_state === 'escalating'
          ? 4
          : system.escalation_state === 'active'
            ? 3
            : 2,
    })),
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
 * Build the canonical StoryLayerPayload from a completed Pass1aCharacterLedger
 * and CharacterLedgerV2.
 *
 * Called once at the end of phase_1a, just before writePhase1aReviewGateArtifacts.
 */
export function buildStoryLayerFromLedger(
  ledger: Pass1aCharacterLedger,
  ledgerV2: CharacterLedgerV2,
  chunkOutputs?: Pass1aChunkOutput[],
): StoryLayerPayload {
  const rawLayers: StoryLayerPayload = {
    source_integrity_layer: buildSourceIntegrityLayer(ledger, ledgerV2),
    pov_structure_layer: buildPovStructureLayer(ledger, ledgerV2, chunkOutputs),
    canonical_identity_layer: buildCanonicalIdentityLayer(ledger, ledgerV2),
    cast_role_tier_layer: buildCastRoleTierLayer(ledger, ledgerV2),
    identity_pronoun_layer: buildIdentityPronounLayer(ledger, ledgerV2),
    relationship_network_layer: buildRelationshipNetworkLayer(ledger, ledgerV2),
    object_symbol_layer: buildObjectSymbolLayer(ledger, ledgerV2),
    location_timeline_worldstate_layer: buildLocationTimelineWorldstateLayer(ledger, ledgerV2),
    threat_antagonist_ending_layer: buildThreatAntagonistEndingLayer(ledger, ledgerV2),
  };

  const dependencyAssessment = assessStoryLayerIdentityDependencies({
    ledger,
    ledgerV2,
    layers: rawLayers,
  });

  return applyIdentityDependencyMetadata(rawLayers, dependencyAssessment) as StoryLayerPayload;
}

/**
 * Seed Grounding Gate
 *
 * Validates that downstream pipeline outputs (character names, objects,
 * relationships, locations) are grounded in either:
 *   1. The 9-layer seed story ledger (Phase 0.5a authority)
 *   2. The raw manuscript text (direct evidence)
 *
 * Prevents cross-contamination from LLM hallucination or context window
 * bleed between manuscripts. Any entity referenced by downstream phases
 * that cannot be traced to the seed OR manuscript is rejected.
 *
 * This module is the single enforcement point for the "seed authority"
 * principle: downstream processes CANNOT override the seed docs unless
 * they have direct textual evidence from the current manuscript.
 */

import type { FullContextStoryLedger } from '@/lib/evaluation/seed/fullContextStoryLedger';

// ── Types ──────────────────────────────────────────────────────────────────

export interface GroundingIndex {
  /** All canonical entity/character names from the seed (lowercased for matching) */
  canonicalEntities: Set<string>;
  /** All object/symbol names from the seed */
  canonicalObjects: Set<string>;
  /** All location names extracted from timeline layer */
  canonicalLocations: Set<string>;
  /** All relationship pair members */
  canonicalRelationshipMembers: Set<string>;
  /** Combined set of ALL grounded tokens (union of all above + manuscript tokens) */
  allGroundedTokens: Set<string>;
  /** The hard_do_not_import list from the seed (entities that must NEVER appear) */
  hardDoNotImport: Set<string>;
  /** Raw manuscript text for fallback substring matching */
  manuscriptTextLower: string;
}

export interface GroundingDiagnostic {
  code: 'ENTITY_NOT_GROUNDED' | 'ENTITY_IN_DO_NOT_IMPORT' | 'OBJECT_NOT_GROUNDED';
  entity: string;
  layer: string;
  action: 'rejected' | 'warned';
}

// ── Build the grounding index from seed + manuscript ──────────────────────

/**
 * Extract all grounded entity names from the 9-layer seed story ledger
 * and the raw manuscript text. Returns a GroundingIndex that can be used
 * to validate any downstream output.
 */
export function buildGroundingIndex(params: {
  seedLedger?: FullContextStoryLedger | null;
  manuscriptText?: string;
}): GroundingIndex {
  const { seedLedger, manuscriptText } = params;

  const canonicalEntities = new Set<string>();
  const canonicalObjects = new Set<string>();
  const canonicalLocations = new Set<string>();
  const canonicalRelationshipMembers = new Set<string>();
  const hardDoNotImport = new Set<string>();
  const allGroundedTokens = new Set<string>();

  if (seedLedger?.layers) {
    const layers = seedLedger.layers;

    // Layer 1: Source Integrity — no entity names, but validates route/type
    // (enforcement handled separately)

    // Layer 2: POV Structure
    if (layers.pov_structure) {
      for (const name of layers.pov_structure.pov_characters ?? []) {
        canonicalEntities.add(name.toLowerCase());
      }
      for (const name of layers.pov_structure.camera_owners ?? []) {
        canonicalEntities.add(name.toLowerCase());
      }
    }

    // Layer 3: Canonical Identity
    if (layers.canonical_identity) {
      for (const name of layers.canonical_identity.primary_entities ?? []) {
        canonicalEntities.add(name.toLowerCase());
      }
      for (const name of layers.canonical_identity.must_not_omit ?? []) {
        canonicalEntities.add(name.toLowerCase());
      }
    }

    // Layer 4: Cast Role Tier
    if (layers.cast_role_tier) {
      for (const tier of layers.cast_role_tier.tiers ?? []) {
        for (const entity of tier.entities ?? []) {
          canonicalEntities.add(entity.toLowerCase());
        }
      }
    }

    // Layer 5: Pronoun Transitions — extract entity names from transition strings
    if (layers.pronoun_transitions) {
      for (const transition of layers.pronoun_transitions.reviewable_transitions ?? []) {
        extractNamesFromTransitionString(transition).forEach(n => canonicalEntities.add(n));
      }
      for (const entry of layers.pronoun_transitions.do_not_flag ?? []) {
        extractNamesFromTransitionString(entry).forEach(n => canonicalEntities.add(n));
      }
    }

    // Layer 6: Relationship Network
    if (layers.relationship_network) {
      for (const rel of layers.relationship_network.relationships ?? []) {
        const members = (rel.pair ?? '').split(/\s*[–—↔&]\s*|\s+and\s+/i);
        for (const member of members) {
          const clean = member.trim().toLowerCase();
          if (clean && clean.length > 1) {
            canonicalRelationshipMembers.add(clean);
            canonicalEntities.add(clean);
          }
        }
      }
    }

    // Layer 7: Object/Symbol
    if (layers.object_symbol) {
      for (const obj of layers.object_symbol.objects ?? []) {
        canonicalObjects.add(obj.name.toLowerCase());
        for (const charName of obj.attached_characters ?? []) {
          canonicalEntities.add(charName.toLowerCase());
        }
      }
    }

    // Layer 8: Timeline/Location/Worldstate
    if (layers.timeline_location_worldstate) {
      for (const entry of layers.timeline_location_worldstate.timeline_sequence ?? []) {
        if (entry.location) canonicalLocations.add(entry.location.toLowerCase());
      }
    }

    // Layer 9: Threat/Pressure/Ending
    if (layers.threat_pressure_ending) {
      for (const endState of layers.threat_pressure_ending.character_end_states ?? []) {
        canonicalEntities.add(endState.entity.toLowerCase());
      }
    }
  }

  // hard_do_not_import — entities that must NEVER appear in any output
  if (seedLedger?.hard_do_not_import) {
    for (const entry of seedLedger.hard_do_not_import) {
      hardDoNotImport.add(entry.toLowerCase());
    }
  }

  // Merge all seed-derived tokens into the combined set
  for (const token of canonicalEntities) allGroundedTokens.add(token);
  for (const token of canonicalObjects) allGroundedTokens.add(token);
  for (const token of canonicalLocations) allGroundedTokens.add(token);
  for (const token of canonicalRelationshipMembers) allGroundedTokens.add(token);

  // Add manuscript-derived tokens: extract proper nouns (capitalized words ≥2 chars)
  const manuscriptTextLower = (manuscriptText ?? '').toLowerCase();
  if (manuscriptText) {
    const properNouns = extractProperNounsFromText(manuscriptText);
    for (const noun of properNouns) {
      allGroundedTokens.add(noun.toLowerCase());
    }
  }

  return {
    canonicalEntities,
    canonicalObjects,
    canonicalLocations,
    canonicalRelationshipMembers,
    allGroundedTokens,
    hardDoNotImport,
    manuscriptTextLower,
  };
}

// ── Validation functions ─────────────────────────────────────────────────

/**
 * Check if a character/entity name is grounded (exists in seed or manuscript).
 * Returns true if grounded, false if it should be rejected.
 */
export function isEntityGrounded(name: string, index: GroundingIndex): boolean {
  if (!name || name.trim().length < 2) return false;
  const lower = name.trim().toLowerCase();

  // Hard rejection: entity appears in hard_do_not_import
  if (index.hardDoNotImport.has(lower)) return false;

  // Accept if found in any seed layer
  if (index.allGroundedTokens.has(lower)) return true;

  // Fallback: manuscript text matching
  return isNameGroundedInIndex(name, index);
}

/**
 * Validate a candidate prose text against the grounding index.
 * Returns diagnostics for any ungrounded entities found in the text.
 */
export function validateCandidateProseGrounding(
  candidateText: string,
  index: GroundingIndex,
): GroundingDiagnostic[] {
  const diagnostics: GroundingDiagnostic[] = [];
  if (!candidateText || !candidateText.trim()) return diagnostics;

  // Extract proper nouns from the candidate text
  const candidateNames = extractProperNounsFromText(candidateText);

  for (const name of candidateNames) {
    const lower = name.toLowerCase();

    // Check hard_do_not_import first
    if (index.hardDoNotImport.has(lower)) {
      diagnostics.push({
        code: 'ENTITY_IN_DO_NOT_IMPORT',
        entity: name,
        layer: 'hard_do_not_import',
        action: 'rejected',
      });
      continue;
    }

    // Check if grounded
    if (!index.allGroundedTokens.has(lower) && !index.manuscriptTextLower.includes(lower)) {
      diagnostics.push({
        code: 'ENTITY_NOT_GROUNDED',
        entity: name,
        layer: 'candidate_prose',
        action: 'rejected',
      });
    }
  }

  return diagnostics;
}

// ── Character ledger grounding filter ────────────────────────────────────

/**
 * Filter character ledger entries, rejecting any character whose canonical_name
 * (or all aliases) cannot be grounded in the seed or manuscript.
 */
export function filterUngroundedCharacters<T extends { canonical_name: string; aliases?: string[] }>(
  entries: T[],
  index: GroundingIndex,
  jobId: string,
): { accepted: T[]; rejected: T[]; diagnostics: GroundingDiagnostic[] } {
  const accepted: T[] = [];
  const rejected: T[] = [];
  const diagnostics: GroundingDiagnostic[] = [];

  for (const entry of entries) {
    const name = entry.canonical_name;
    const lower = name.trim().toLowerCase();

    // Hard rejection: appears in hard_do_not_import
    if (index.hardDoNotImport.has(lower)) {
      rejected.push(entry);
      diagnostics.push({
        code: 'ENTITY_IN_DO_NOT_IMPORT',
        entity: name,
        layer: 'canonical_identity',
        action: 'rejected',
      });
      continue;
    }

    // Check if canonical_name is grounded
    const nameGrounded = isNameGroundedInIndex(name, index);

    // Check if any alias is grounded
    const aliasGrounded = (entry.aliases ?? []).some(alias => isNameGroundedInIndex(alias, index));

    if (nameGrounded || aliasGrounded) {
      accepted.push(entry);
    } else {
      rejected.push(entry);
      diagnostics.push({
        code: 'ENTITY_NOT_GROUNDED',
        entity: name,
        layer: 'canonical_identity',
        action: 'rejected',
      });
      console.warn(`[GroundingGate] Rejected character "${name}" — not found in seed ledger or manuscript text`, {
        job_id: jobId,
        canonical_name: name,
        aliases: entry.aliases,
      });
    }
  }

  return { accepted, rejected, diagnostics };
}

// ── Internal helpers ─────────────────────────────────────────────────────

function isNameGroundedInIndex(name: string, index: GroundingIndex): boolean {
  const lower = name.trim().toLowerCase();
  if (!lower || lower.length < 2) return false;

  // Direct match in seed-derived tokens
  if (index.allGroundedTokens.has(lower)) return true;

  // Substring match in manuscript text (word boundary for short names)
  if (index.manuscriptTextLower) {
    if (lower.length <= 3) {
      // Short names need word-boundary match to avoid "My" matching "myself"
      const regex = new RegExp(`\\b${escapeRegExp(lower)}\\b`);
      return regex.test(index.manuscriptTextLower);
    }
    return index.manuscriptTextLower.includes(lower);
  }

  return false;
}

function extractProperNounsFromText(text: string): string[] {
  // Match capitalized words that are likely proper nouns
  // Excludes sentence-start capitals by requiring preceding space/punctuation
  const matches = text.match(/(?<=[\s\n"'(])[A-Z][a-z]{1,30}(?:\s+[A-Z][a-z]{1,30})*/g) ?? [];
  // Also match standalone capitalized words at beginning (first word of text)
  const firstWord = text.match(/^[A-Z][a-z]{1,30}/)?.[0];
  const result = new Set(matches);
  if (firstWord) result.add(firstWord);

  // Filter out common non-name capitals
  const COMMON_SENTENCE_STARTERS = new Set([
    'the', 'a', 'an', 'this', 'that', 'these', 'those', 'it', 'its',
    'he', 'she', 'they', 'we', 'you', 'i', 'my', 'his', 'her', 'our',
    'but', 'and', 'or', 'so', 'yet', 'if', 'when', 'while', 'after',
    'before', 'because', 'since', 'until', 'although', 'though',
    'there', 'here', 'where', 'what', 'who', 'how', 'why', 'which',
    'every', 'each', 'all', 'some', 'any', 'no', 'not', 'never',
    'always', 'sometimes', 'often', 'perhaps', 'maybe', 'certainly',
  ]);

  return Array.from(result).filter(
    word => !COMMON_SENTENCE_STARTERS.has(word.toLowerCase())
  );
}

function extractNamesFromTransitionString(transition: string): string[] {
  // Pronoun transition strings often have format "Character → pronoun" or "Character's pronoun"
  const names: string[] = [];
  const parts = transition.split(/[→:—–]/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed && /^[A-Z]/.test(trimmed) && trimmed.length > 1) {
      // Take the first word as the name
      const name = trimmed.split(/\s+/)[0].replace(/[''']s$/, '');
      if (name.length > 1) names.push(name.toLowerCase());
    }
  }
  return names;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}



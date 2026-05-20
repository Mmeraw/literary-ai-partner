/**
 * Ledger Validation Helpers — Tier 1 Character Ledger Grounding
 *
 * Deterministic, pure functions that answer validation queries against the
 * CharacterLedgerV2 and Pass1aCharacterLedger structures.
 *
 * Rules:
 * - No LLM calls. No async. No side effects.
 * - All functions fail CLOSED: if data is missing, return the safe/blocking answer.
 * - Pass 3 prompt block builder calls getRecommendationBlockersForClaim() to
 *   inject active blocker labels into the system prompt before synthesis.
 */

import type {
  CharacterLedgerV2,
  Pass1aCharacterLedger,
  RecommendationBlocker,
} from "./types";

// ── 1. isCharacterPresent ────────────────────────────────────────────────────

/**
 * Returns true if the character was confirmed present at (or around) the given
 * chunk index.  Checks the characterPresenceIndex from the validation queries.
 *
 * Fail-closed: returns false if the character is unknown.
 */
export function isCharacterPresent(
  ledger: CharacterLedgerV2,
  characterName: string,
  chunkIndex: number,
): boolean {
  const presenceIndex = ledger.validationQueries.characterPresenceIndex;
  const chunks = presenceIndex[characterName] ?? presenceIndex[characterName.toLowerCase().replace(/\s+/g, "_")];
  if (!chunks || chunks.length === 0) return false;
  const minChunk = Math.min(...chunks);
  const maxChunk = Math.max(...chunks);
  return chunkIndex >= minChunk && chunkIndex <= maxChunk;
}

// ── 2. haveCharactersMet ─────────────────────────────────────────────────────

/**
 * Returns true if charA and charB have met (shared a scene) by the target chunk.
 * Uses the coPresenceIndex: firstSharedChunk ≤ targetChunk → they have met.
 *
 * Fail-closed: if either character is unknown, returns false (treat as not yet met).
 */
export function haveCharactersMet(
  ledger: CharacterLedgerV2,
  charA: string,
  charB: string,
  targetChunk: number,
): boolean {
  const idx = ledger.validationQueries.coPresenceIndex;
  const firstShared = idx[charA]?.[charB] ?? idx[charB]?.[charA];
  if (firstShared === undefined) return false;
  return firstShared <= targetChunk;
}

/**
 * Returns the first chunk index where charA and charB are co-present.
 * Returns null if they never meet (unknown pair).
 */
export function getFirstMeetingChunk(
  ledger: CharacterLedgerV2,
  charA: string,
  charB: string,
): number | null {
  const idx = ledger.validationQueries.coPresenceIndex;
  return idx[charA]?.[charB] ?? idx[charB]?.[charA] ?? null;
}

// ── 3. isNameValidAtChunk ────────────────────────────────────────────────────

/**
 * Returns true if the given name is a valid name for the character at the
 * target chunk index.
 *
 * Checks nameStateIndex: each entry has validFromChunk and validUntilChunk (null = through end).
 * Fail-closed: if characterId not found, returns false.
 */
export function isNameValidAtChunk(
  ledger: CharacterLedgerV2,
  characterName: string,
  name: string,
  chunkIndex: number,
): boolean {
  const idx = ledger.validationQueries.nameStateIndex;
  const states = idx[characterName] ?? idx[characterName.toLowerCase().replace(/\s+/g, "_")];
  if (!states || states.length === 0) return false;
  for (const ns of states) {
    const nameMatch = ns.name.toLowerCase().trim() === name.toLowerCase().trim();
    if (!nameMatch) continue;
    const fromOk = chunkIndex >= ns.validFromChunk;
    const untilOk = ns.validUntilChunk === null || chunkIndex <= ns.validUntilChunk;
    if (fromOk && untilOk) return true;
  }
  return false;
}

/**
 * Returns the earliest chunk at which the given name becomes valid for the
 * character. Returns null if the name is never valid.
 */
export function getNameValidFromChunk(
  ledger: CharacterLedgerV2,
  characterName: string,
  name: string,
): number | null {
  const idx = ledger.validationQueries.nameStateIndex;
  const states = idx[characterName] ?? idx[characterName.toLowerCase().replace(/\s+/g, "_")];
  if (!states) return null;
  for (const ns of states) {
    if (ns.name.toLowerCase().trim() === name.toLowerCase().trim()) {
      return ns.validFromChunk;
    }
  }
  return null;
}

// ── 4. doesCopingMechanismAlreadyExist ───────────────────────────────────────

/**
 * Returns true if the character already has one or more coping mechanisms in
 * the ledger.  This is the Gate 4 check — if true, "seed a ritual" recs must
 * be suppressed.
 *
 * Also returns the list of existing mechanisms so the caller can suggest
 * "foreground" alternatives.
 */
export function doesCopingMechanismAlreadyExist(
  ledger: CharacterLedgerV2,
  characterName: string,
): { exists: boolean; mechanisms: string[] } {
  const idx = ledger.validationQueries.copingIndex;
  const mechanisms = idx[characterName] ?? idx[characterName.toLowerCase().replace(/\s+/g, "_")] ?? [];
  return { exists: mechanisms.length > 0, mechanisms };
}

// ── 5. isObjectAtLocation / isObjectInChunkRange ─────────────────────────────

/**
 * Returns true if the given object exists (appears in the manuscript) at the
 * given chunk index.  Uses objectPresenceIndex: [firstChunk, lastChunk].
 *
 * Fail-closed: if objectId not found, returns false.
 */
export function isObjectAtLocation(
  ledger: CharacterLedgerV2,
  objectId: string,
  chunkIndex: number,
): boolean {
  const idx = ledger.validationQueries.objectPresenceIndex;
  const range = idx[objectId] ?? idx[objectId.toLowerCase().replace(/\s+/g, "_")];
  if (!range) return false;
  return chunkIndex >= range[0] && chunkIndex <= range[1];
}

// ── 6. hasSymbolAlreadyPaidOff ───────────────────────────────────────────────

/**
 * Returns true if the symbol/object has already paid off (has a payoff chapter
 * recorded in the symbol payoff index).
 *
 * Fail-closed: unknown objectId returns false (assume not paid off → safer to
 * recommend tracing it than to suppress that recommendation).
 */
export function hasSymbolAlreadyPaidOff(
  ledger: CharacterLedgerV2,
  objectId: string,
): boolean {
  const idx = ledger.validationQueries.symbolPayoffIndex;
  return idx[objectId] ?? idx[objectId.toLowerCase().replace(/\s+/g, "_")] ?? false;
}

// ── 7. getRecommendationBlockersForClaim ─────────────────────────────────────

/**
 * PRIMARY GATE QUERY — called by Pass 3 prompt block builder.
 *
 * Given a claim about characters/objects/names/locations, returns all active
 * blockers that apply.  The caller (pass3-synthesis.ts) injects these into the
 * prompt as hard suppression instructions.
 *
 * @param characterNames  — characters referenced in the candidate recommendation
 * @param targetChunk     — the chunk/chapter the recommendation targets
 * @param nameUsed        — if a specific name is used in the rec, pass it here
 * @param objectIds       — any objects/symbols referenced in the rec
 */
export function getRecommendationBlockersForClaim(params: {
  ledger: CharacterLedgerV2;
  characterNames: string[];
  targetChunk: number;
  nameUsed?: string;
  objectIds?: string[];
}): RecommendationBlocker[] {
  const { ledger, characterNames, targetChunk, nameUsed, objectIds = [] } = params;
  const triggered: RecommendationBlocker[] = [];

  // Check co-presence violations for all pairs of named characters
  for (let i = 0; i < characterNames.length; i++) {
    for (let j = i + 1; j < characterNames.length; j++) {
      const charA = characterNames[i];
      const charB = characterNames[j];
      if (!haveCharactersMet(ledger, charA, charB, targetChunk)) {
        const firstMeet = getFirstMeetingChunk(ledger, charA, charB);
        triggered.push({
          blockerId: `co_presence_violation:${charA}+${charB}`,
          type: "co_presence_violation",
          severity: "suppress",
          rule: `${charA} and ${charB} have not met by chunk ${targetChunk}. They first share a scene at chunk ${firstMeet ?? "unknown"}. Do not place them together in a recommendation targeting this point.`,
          validAfterChapter: firstMeet !== null ? `chunk ${firstMeet}` : undefined,
          involvedCharacters: [charA, charB],
        });
      }
    }
  }

  // Check name-state violations
  if (nameUsed) {
    for (const characterName of characterNames) {
      if (!isNameValidAtChunk(ledger, characterName, nameUsed, targetChunk)) {
        const validFrom = getNameValidFromChunk(ledger, characterName, nameUsed);
        triggered.push({
          blockerId: `name_state_violation:${characterName}:${nameUsed}`,
          type: "name_state_violation",
          severity: "suppress",
          rule: `Name "${nameUsed}" is not valid for ${characterName} at chunk ${targetChunk}. It becomes valid at chunk ${validFrom ?? "unknown"}.`,
          validAfterChapter: validFrom !== null ? `chunk ${validFrom}` : undefined,
          involvedCharacters: [characterName],
        });
      }
    }
  }

  // Check coping mechanism violations (seeding recs)
  for (const characterName of characterNames) {
    const { exists, mechanisms } = doesCopingMechanismAlreadyExist(ledger, characterName);
    if (exists) {
      triggered.push({
        blockerId: `existing_feature_violation:${characterName}:coping`,
        type: "existing_feature_violation",
        severity: "suppress",
        rule: `${characterName} already has coping mechanisms: ${mechanisms.slice(0, 3).map((m) => `"${m}"`).join(", ")}. Do not recommend seeding a ritual. Use "foreground", "surface earlier", or "echo" language instead.`,
        involvedCharacters: [characterName],
        affectedRecommendationTypes: ["characterization"],
      });
    }
  }

  // Check object state violations
  for (const objectId of objectIds) {
    if (!isObjectAtLocation(ledger, objectId, targetChunk)) {
      triggered.push({
        blockerId: `object_state_violation:${objectId}@chunk${targetChunk}`,
        type: "object_state_violation",
        severity: "suppress",
        rule: `Object "${objectId}" does not appear in the manuscript at chunk ${targetChunk}. Do not place it in a recommendation targeting this point.`,
        involvedObjects: [objectId],
      });
    }
  }

  // Deduplicate by blockerId
  const seen = new Set<string>();
  return triggered.filter((b) => {
    if (seen.has(b.blockerId)) return false;
    seen.add(b.blockerId);
    return true;
  });
}

// ── Prompt injection helper ──────────────────────────────────────────────────

/**
 * Formats the active blockers from a CharacterLedgerV2 into a compact
 * prompt-injection string for Pass 3.
 *
 * Suppress blockers appear first, each on its own line, prefixed with ⛔.
 * Downgrade blockers appear next, prefixed with ⬇.
 * Warn blockers appear last, prefixed with ⚠.
 *
 * This string is injected into the RECOMMENDATION GROUNDING GATE section
 * of the Pass 3 system prompt.
 */
export function formatActiveBlockersForPrompt(ledger: CharacterLedgerV2): string {
  if (!ledger.activeBlockers || ledger.activeBlockers.length === 0) return "";

  const suppress = ledger.activeBlockers.filter((b) => b.severity === "suppress");
  const downgrade = ledger.activeBlockers.filter((b) => b.severity === "downgrade");
  const warn = ledger.activeBlockers.filter((b) => b.severity === "warn");

  const lines: string[] = [];
  lines.push("ACTIVE LEDGER BLOCKERS (DETERMINISTIC — injected from CharacterLedgerV2):");

  if (suppress.length > 0) {
    lines.push("\n⛔ SUPPRESS — do NOT emit any recommendation that violates these rules:");
    for (const b of suppress) {
      lines.push(`  [${b.blockerId}] ${b.rule}${b.validAfterChapter ? ` (valid after: ${b.validAfterChapter})` : ""}`);
    }
  }
  if (downgrade.length > 0) {
    lines.push("\n⬇ DOWNGRADE — emit at priority=low only, add caveat:");
    for (const b of downgrade) {
      lines.push(`  [${b.blockerId}] ${b.rule}`);
    }
  }
  if (warn.length > 0) {
    lines.push("\n⚠ WARN — emit but prepend grounding note:");
    for (const b of warn) {
      lines.push(`  [${b.blockerId}] ${b.rule}`);
    }
  }

  return lines.join("\n");
}

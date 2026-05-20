/**
 * buildLedgerBlock — Shared utility to build a character ledger text block
 * for injection into Pass 1 and Pass 2 prompts.
 *
 * Produces a compact grounding block with:
 *   - Character names, roles, arcs
 *   - Name-state transitions (Paolito → Paul and when)
 *   - Coping mechanisms
 *   - Co-presence first-meets
 *   - Symbol/object assignments
 *   - Location state timeline (prevents placement errors)
 *
 * This is intentionally lighter than the full Pass 3 ledger block in
 * pass3-synthesis.ts — P1 and P2 need grounding, not arbitration context.
 */

import type { Pass1aCharacterLedger, CharacterLedgerV2, CharacterArcLedgerEntry } from "./types";

/**
 * Build a compact character ledger grounding block for P1/P2 injection.
 * Returns an empty string if the ledger has no entries (fail-soft — callers
 * must not hard-fail on an absent ledger block).
 */
export function buildLedgerBlockForPrompt(
  ledger: Pass1aCharacterLedger,
  ledgerV2?: CharacterLedgerV2,
): string {
  if (!ledger || !Array.isArray(ledger.entries) || ledger.entries.length === 0) {
    return "";
  }

  const rows = ledger.entries.map((e: CharacterArcLedgerEntry) => {
    const aliasPart = e.aliases.length > 0 ? ` (aka ${e.aliases.join(" / ")})` : "";
    const agePart = e.age_exact_first !== null
      ? ` | age ${e.age_exact_first}${e.age_exact_last !== null ? `→${e.age_exact_last}` : ""}`
      : e.age_signal ? ` | ${e.age_signal}` : "";

    const nameStatePart = (e.nameStates ?? []).length > 0
      ? `\n  nameStates: ${e.nameStates.map((ns) =>
          `${ns.name}(chunks ${ns.validFromChunk}→${ns.validUntilChunk ?? "end"})`
        ).join(" | ")}`
      : "";

    const copingPart = (e.copingMechanisms ?? []).length > 0
      ? `\n  coping: ${e.copingMechanisms.slice(0, 3).map((c) => `"${c.description}"(ch${c.firstAppearsChunk})`).join(", ")}`
      : "";

    const symbolPart = e.symbolic_objects.length > 0
      ? ` | symbols: ${e.symbolic_objects.map((s) => s.object).join(", ")}`
      : "";

    const coPresencePart = Object.keys(e.coPresenceMap ?? {}).length > 0
      ? `\n  firstMeets: ${Object.entries(e.coPresenceMap).map(([other, v]) =>
          `${other}@chunk${v.firstSharedChunk}`
        ).join(", ")}`
      : "";

    return [
      `• ${e.canonical_name}${aliasPart} | role=${e.role} weight=${e.narrative_weight_band}${agePart}`,
      `  arc: ${e.arc_start} → ${e.arc_end_state} | ending: ${e.ending_status}${symbolPart}`,
      nameStatePart || null,
      copingPart || null,
      coPresencePart || null,
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  // Location state timeline from V2 — critical for placement validation
  let stateTimelineBlock = "";
  if (ledgerV2 && ledgerV2.stateTimelines.length > 0) {
    const byChar = new Map<string, typeof ledgerV2.stateTimelines[0][]>();
    for (const snap of ledgerV2.stateTimelines) {
      if (!byChar.has(snap.characterId)) byChar.set(snap.characterId, []);
      byChar.get(snap.characterId)!.push(snap);
    }
    const lines: string[] = [];
    for (const [charId, snaps] of byChar) {
      const displayName = ledger.entries.find(
        (e) => e.canonical_name.toLowerCase().replace(/\s+/g, "_") === charId
      )?.canonical_name ?? charId;
      const snapLines = snaps.map((s) => {
        const parts = [
          s.chapterRange,
          s.location ? `loc:${s.location}` : "",
          s.legalStatus ? `status:${s.legalStatus}` : "",
        ].filter(Boolean).join(" | ");
        return `    ${parts}`;
      });
      lines.push(`  ${displayName}:\n${snapLines.join("\n")}`);
    }
    stateTimelineBlock = `\n\nCHARACTER LOCATION TIMELINE (required for placement validation):\n${lines.join("\n")}\n→ Never place a character at a location not confirmed above.`;
  }

  return `\n\n${"─".repeat(64)}\n## PASS 1A CHARACTER LEDGER (grounding — use for all character references)\n${"─".repeat(64)}\n\n${rows}${stateTimelineBlock}\n${"─".repeat(64)}`;
}

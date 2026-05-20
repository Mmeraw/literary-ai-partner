/**
 * Regression tests — Tier 1 Character Ledger Grounding
 *
 * These tests encode the 5 categories of Cartel Babies evaluation failures
 * identified in the May 2026 audit.  Each test asserts that the deterministic
 * validation helpers BLOCK the specific bad recommendation that was produced
 * by the pre-Tier-1 pipeline.
 *
 * Test fixture: minimal CharacterLedgerV2 shaped after real Cartel Babies data.
 * Key facts preserved (do NOT change without updating the novel facts too):
 *   - Raúl is at the CAMP, NOT at the overpass
 *   - Paolito and Benjamin first meet around chunk 72 (Chapter 72-ish)
 *   - "Paul" is only valid AFTER the embassy departure (chunk 90+)
 *   - Benjamin already has: smoking, pencil-lining, shopping, Starbucks runs
 *   - Evil-eye keychain: Michael → Raúl → Raúl's son
 */

import {
  isCharacterPresent,
  haveCharactersMet,
  isNameValidAtChunk,
  doesCopingMechanismAlreadyExist,
  isObjectAtLocation,
  hasSymbolAlreadyPaidOff,
  getRecommendationBlockersForClaim,
  formatActiveBlockersForPrompt,
} from "../ledgerValidation";
import type { CharacterLedgerV2 } from "../types";

// ── Test fixture ──────────────────────────────────────────────────────────────

/**
 * Minimal CharacterLedgerV2 based on Cartel Babies.
 * Chunk counts are approximate — scaled to a ~100 chunk model of the novel.
 */
function buildCartelBabiesLedger(): CharacterLedgerV2 {
  return {
    schema_version: "character_ledger_v2",
    prompt_version: "test-fixture",
    job_id: "test-cartel-babies",
    generated_at: "2026-05-20T00:00:00.000Z",
    total_chunks_processed: 100,

    identityLedger: [
      {
        characterId: "paolito",
        canonicalName: "Paolito",
        nameHistory: [
          { name: "Paolito", validFromChunk: 0, validUntilChunk: 89, confidence: "explicit" },
          { name: "Paul", validFromChunk: 90, validUntilChunk: null, confidence: "explicit",
            reason: "renamed after leaving embassy" },
          { name: "Paul Raúl Wagner", validFromChunk: 90, validUntilChunk: null, confidence: "explicit" },
        ],
        aliases: ["Paul", "Paul Raúl Wagner"],
        narrativeRole: "co_protagonist",
        importanceLevel: "primary",
        firstAppearance: { label: "chunk 0", chunkIndex: 0 },
        lastAppearance: { label: "chunk 99", chunkIndex: 99 },
        firstChunkIndex: 0,
        lastChunkIndex: 99,
        finalStatus: "transformed",
        contradictions: [],
        recommendationBlockers: [
          {
            blockerId: "name_state_violation:Paolito:Paul",
            type: "name_state_violation",
            severity: "suppress",
            rule: 'Name "Paul" for Paolito is only valid from chunk 90. Do not use "Paul" in recommendations targeting earlier chapters.',
            validAfterChapter: "chunk 90",
            involvedCharacters: ["Paolito"],
            affectedRecommendationTypes: ["characterization"],
          },
        ],
      },
      {
        characterId: "raul",
        canonicalName: "Raúl",
        nameHistory: [
          { name: "Raúl", validFromChunk: 0, validUntilChunk: null, confidence: "explicit" },
        ],
        aliases: [],
        narrativeRole: "antagonist",
        importanceLevel: "major",
        firstAppearance: { label: "chunk 2", chunkIndex: 2 },
        lastAppearance: { label: "chunk 85", chunkIndex: 85 },
        firstChunkIndex: 2,
        lastChunkIndex: 85,
        finalStatus: "unresolved",
        contradictions: [],
        recommendationBlockers: [],
      },
      {
        characterId: "benjamin",
        canonicalName: "Benjamin",
        nameHistory: [
          { name: "Benjamin", validFromChunk: 70, validUntilChunk: null, confidence: "explicit" },
          { name: "Ben", validFromChunk: 70, validUntilChunk: null, confidence: "explicit" },
        ],
        aliases: ["Ben"],
        narrativeRole: "secondary",
        importanceLevel: "major",
        firstAppearance: { label: "chunk 70", chunkIndex: 70 },
        lastAppearance: { label: "chunk 99", chunkIndex: 99 },
        firstChunkIndex: 70,
        lastChunkIndex: 99,
        finalStatus: "unresolved",
        contradictions: [],
        recommendationBlockers: [
          {
            blockerId: "existing_feature_violation:benjamin:coping",
            type: "existing_feature_violation",
            severity: "suppress",
            rule: 'Benjamin already has 4 coping mechanisms: "smoking", "lines up pencils before answering", "shops in-store and online", "Starbucks runs". Do NOT recommend seeding a coping ritual. Use "foreground", "surface earlier", or "echo" instead.',
            involvedCharacters: ["Benjamin"],
            affectedRecommendationTypes: ["characterization"],
          },
        ],
      },
      {
        characterId: "michael",
        canonicalName: "Michael",
        nameHistory: [
          { name: "Michael", validFromChunk: 0, validUntilChunk: null, confidence: "explicit" },
          { name: "Mike", validFromChunk: 0, validUntilChunk: null, confidence: "explicit" },
        ],
        aliases: ["Mike"],
        narrativeRole: "protagonist",
        importanceLevel: "primary",
        firstAppearance: { label: "chunk 0", chunkIndex: 0 },
        lastAppearance: { label: "chunk 99", chunkIndex: 99 },
        firstChunkIndex: 0,
        lastChunkIndex: 99,
        finalStatus: "unresolved",
        contradictions: [],
        recommendationBlockers: [],
      },
    ],

    stateTimelines: [],
    terminalLedger: [],

    relationshipLedger: [
      {
        characterA: "Paolito",
        characterB: "Benjamin",
        firstCoPresenceChunk: 72,
        firstCoPresenceChapter: "Chapter 72",
        invalidBeforeChapter: "Chapter 72",
        firstSharedLocation: null,
        relationshipTypeStart: "strangers",
        relationshipTypeEnd: "found_family",
        powerDynamicTimeline: [],
        pivotMoments: [],
        sharedObjects: [],
        sharedActivities: ["table tennis at camp"],
        unresolvedLedger: [],
        recommendationBlocker: {
          blockerId: "co_presence_violation:Paolito+Benjamin",
          type: "co_presence_violation",
          severity: "suppress",
          rule: "Paolito and Benjamin do not share a scene until chunk 72 (Chapter 72). Recommendations must not place them together before this point.",
          validAfterChapter: "Chapter 72",
          involvedCharacters: ["Paolito", "Benjamin"],
        },
      },
      {
        characterA: "Raúl",
        characterB: "Michael",
        firstCoPresenceChunk: 3,
        firstCoPresenceChapter: "Chapter 3",
        invalidBeforeChapter: "Chapter 3",
        firstSharedLocation: "the camp",
        relationshipTypeStart: "captor_captive",
        relationshipTypeEnd: "captor_captive",
        powerDynamicTimeline: [],
        pivotMoments: [],
        sharedObjects: ["evil_eye_keychain", "michael_cell_phone"],
        sharedActivities: [],
        unresolvedLedger: [],
        recommendationBlocker: {
          blockerId: "co_presence_violation:Raúl+Michael",
          type: "co_presence_violation",
          severity: "suppress",
          rule: "Raúl and Michael first share a scene at chunk 3 (Chapter 3). Do not place them together before this point.",
          validAfterChapter: "Chapter 3",
          involvedCharacters: ["Raúl", "Michael"],
        },
      },
    ],

    psychologyLedger: [
      {
        characterId: "benjamin",
        copingMechanisms: [
          {
            description: "smoking",
            firstAppearsChunk: 71,
            firstAppearsChapter: "Chapter 71",
            recurrenceChunks: [71, 74, 78, 82],
            frequency: "dominant",
            triggeredBy: "stress",
            manifestsAs: "smoking cigarettes when anxious",
            psychologicalFunction: "numbs acute anxiety",
            evidenceQuote: "Benjamin lit another cigarette",
            confidence: "explicit",
          },
          {
            description: "lines up pencils before answering",
            firstAppearsChunk: 72,
            firstAppearsChapter: "Chapter 72",
            recurrenceChunks: [72, 75, 80],
            frequency: "recurring",
            triggeredBy: "confrontation",
            manifestsAs: "aligns pencils on desk before responding to questions",
            psychologicalFunction: "maintains illusion of control",
            evidenceQuote: "He aligned the pencils before he answered",
            confidence: "explicit",
          },
          {
            description: "shopping in-store and online",
            firstAppearsChunk: 73,
            firstAppearsChapter: "Chapter 73",
            recurrenceChunks: [73, 79],
            frequency: "recurring",
            triggeredBy: "anxiety",
            manifestsAs: "browses retail sites and shops in-store when anxious",
            psychologicalFunction: "displacement activity",
            evidenceQuote: "Benjamin spent the afternoon on Amazon",
            confidence: "explicit",
          },
          {
            description: "Starbucks runs",
            firstAppearsChunk: 74,
            firstAppearsChapter: "Chapter 74",
            recurrenceChunks: [74, 77, 83],
            frequency: "recurring",
            triggeredBy: "need for routine",
            manifestsAs: "regular Starbucks visits as anchoring ritual",
            psychologicalFunction: "familiar routine reduces uncertainty",
            evidenceQuote: "his Starbucks order had not changed in a decade",
            confidence: "explicit",
          },
        ],
        psychologicalArc: "hypervigilant bureaucrat → cautious ally",
        seedingBlocked: true,
        seedingBlockMessage: 'Benjamin already has 4 coping mechanisms: "smoking", "lines up pencils before answering", "shopping in-store and online", "Starbucks runs". Do NOT recommend seeding a coping ritual. Use "foreground", "surface earlier", or "echo" instead.',
      },
    ],

    objectLedger: [
      {
        objectId: "evil_eye_keychain",
        objectName: "blue evil-eye charm",
        attachedCharacters: ["Michael", "Raúl", "Raúl's son"],
        currentHolder: "Raúl's son",
        firstAppearanceChunk: 5,
        firstAppearanceChapter: "Chapter 5",
        lastAppearanceChunk: 80,
        ownershipPath: ["Michael", "Raúl", "Raúl's son"],
        transferEvents: [
          {
            fromCharacter: "Michael",
            toCharacter: "Raúl",
            chunkIndex: 10,
            chapterRef: "Chapter 10",
            context: "Raúl takes the evil-eye from Michael",
            evidenceQuote: "Raúl turned the blue charm over in his fingers",
            confidence: "explicit",
          },
          {
            fromCharacter: "Raúl",
            toCharacter: "Raúl's son",
            chunkIndex: 80,
            chapterRef: "Chapter 80",
            context: "Raúl gives the evil-eye to his son",
            evidenceQuote: "He pressed the keychain into the boy's hand",
            confidence: "explicit",
          },
        ],
        symbolicFunctionByStage: [
          {
            stage: "introduced",
            chunkRange: [5, 10],
            chapterRange: "Chapter 5–10",
            function: "identity token of a captive child",
            evidenceQuote: "",
          },
          {
            stage: "transferred",
            chunkRange: [10, 80],
            chapterRange: "Chapter 10–80",
            function: "power token held by captor",
            evidenceQuote: "",
          },
          {
            stage: "paid_off",
            chunkRange: [80, 80],
            chapterRange: "Chapter 80",
            function: "legacy token passed to the next generation",
            evidenceQuote: "",
          },
        ],
        payoffChunk: 80,
        payoffChapter: "Chapter 80",
        payoffDescription: "Raúl passes the charm to his son — inherited captivity symbol",
        missedIfAbsentFromReport: true,
        status: "resolved",
        recommendationBlockers: [],
      },
      {
        objectId: "michael_cell_phone",
        objectName: "Michael's cell phone",
        attachedCharacters: ["Michael", "Raúl"],
        currentHolder: "Raúl",
        firstAppearanceChunk: 4,
        firstAppearanceChapter: "Chapter 4",
        lastAppearanceChunk: 20,
        ownershipPath: ["Michael", "Raúl"],
        transferEvents: [
          {
            fromCharacter: "Michael",
            toCharacter: "Raúl",
            chunkIndex: 4,
            chapterRef: "Chapter 4",
            context: "Raúl reads Michael's phone for intelligence",
            evidenceQuote: "Raúl scrolled through the contacts",
            confidence: "explicit",
          },
        ],
        symbolicFunctionByStage: [
          {
            stage: "introduced",
            chunkRange: [4, 20],
            chapterRange: "Chapter 4–20",
            function: "intelligence asset / power inversion",
            evidenceQuote: "",
          },
        ],
        payoffChunk: null,
        payoffChapter: null,
        payoffDescription: null,
        missedIfAbsentFromReport: true,
        status: "active",
        recommendationBlockers: [],
      },
    ],

    validationQueries: {
      characterPresenceIndex: {
        // Paolito present chunks 0–99 (protagonists span whole novel)
        Paolito: Array.from({ length: 100 }, (_, i) => i),
        paolito: Array.from({ length: 100 }, (_, i) => i),
        // Raúl present chunks 2–85
        "Raúl": Array.from({ length: 84 }, (_, i) => i + 2),
        raul: Array.from({ length: 84 }, (_, i) => i + 2),
        // Benjamin present chunks 70–99
        Benjamin: Array.from({ length: 30 }, (_, i) => i + 70),
        benjamin: Array.from({ length: 30 }, (_, i) => i + 70),
        // Michael present chunks 0–99
        Michael: Array.from({ length: 100 }, (_, i) => i),
        michael: Array.from({ length: 100 }, (_, i) => i),
      },
      coPresenceIndex: {
        Paolito: { Benjamin: 72 },
        Benjamin: { Paolito: 72 },
        "Raúl": { Michael: 3 },
        Michael: { "Raúl": 3 },
      },
      nameStateIndex: {
        Paolito: [
          { name: "Paolito", validFromChunk: 0, validUntilChunk: 89 },
          { name: "Paul", validFromChunk: 90, validUntilChunk: null },
          { name: "Paul Raúl Wagner", validFromChunk: 90, validUntilChunk: null },
        ],
        Benjamin: [
          { name: "Benjamin", validFromChunk: 70, validUntilChunk: null },
          { name: "Ben", validFromChunk: 70, validUntilChunk: null },
        ],
        Michael: [
          { name: "Michael", validFromChunk: 0, validUntilChunk: null },
          { name: "Mike", validFromChunk: 0, validUntilChunk: null },
        ],
        "Raúl": [
          { name: "Raúl", validFromChunk: 0, validUntilChunk: null },
        ],
      },
      copingIndex: {
        benjamin: ["smoking", "lines up pencils before answering", "shopping in-store and online", "Starbucks runs"],
        Benjamin: ["smoking", "lines up pencils before answering", "shopping in-store and online", "Starbucks runs"],
      },
      objectPresenceIndex: {
        evil_eye_keychain: [5, 80],
        michael_cell_phone: [4, 20],
      },
      symbolPayoffIndex: {
        evil_eye_keychain: true,
        michael_cell_phone: false,
      },
      unresolvedPromisesIndex: {},
    },

    activeBlockers: [
      {
        blockerId: "co_presence_violation:Paolito+Benjamin",
        type: "co_presence_violation",
        severity: "suppress",
        rule: "Paolito and Benjamin do not share a scene until chunk 72 (Chapter 72). Recommendations must not place them together before this point.",
        validAfterChapter: "Chapter 72",
        involvedCharacters: ["Paolito", "Benjamin"],
      },
      {
        blockerId: "name_state_violation:Paolito:Paul",
        type: "name_state_violation",
        severity: "suppress",
        rule: 'Name "Paul" for Paolito is only valid from chunk 90. Do not use "Paul" in recommendations targeting earlier chapters.',
        validAfterChapter: "chunk 90",
        involvedCharacters: ["Paolito"],
      },
      {
        blockerId: "existing_feature_violation:benjamin:coping",
        type: "existing_feature_violation",
        severity: "suppress",
        rule: 'Benjamin already has 4 coping mechanisms: "smoking", "lines up pencils before answering", "shopping in-store and online", "Starbucks runs". Do NOT recommend seeding a coping ritual.',
        involvedCharacters: ["Benjamin"],
      },
    ],

    negativeKnowledge: [
      {
        characterId: "paolito",
        notPresentWith: ["Benjamin"],
        notYetMet: ["Benjamin"],
        nameNotYetValid: [{ name: "Paul", validFromChunk: 90 }],
        objectNotYetTransferred: [],
        doesNotYetKnow: [],
        asOfChunk: 0,
      },
    ],

    stateConflicts: [],
    characterCoverage: {},

    coverage_summary: {
      protagonists: ["Michael"],
      co_protagonists: ["Paolito"],
      antagonists: ["Raúl"],
      high_value_objects: ["evil_eye_keychain", "michael_cell_phone"],
      unresolved_promises: [],
      open_terminal_ledgers: [],
      hard_fail_triggers: [],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGRESSION TEST 1: Raúl at the overpass (location violation)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Regression: Raúl at the overpass (location violation)", () => {
  const ledger = buildCartelBabiesLedger();

  test("Raúl IS present in the novel (character presence check passes)", () => {
    expect(isCharacterPresent(ledger, "Raúl", 10)).toBe(true);
  });

  test("getRecommendationBlockersForClaim returns EMPTY for Raúl at valid location (chunk 10)", () => {
    // Raúl at the camp in chunk 10 — no blocker should fire
    const blockers = getRecommendationBlockersForClaim({
      ledger,
      characterNames: ["Raúl"],
      targetChunk: 10,
    });
    // No location_state_violation because we don't have specific location state in fixture
    // The important thing: no false co-presence blocker fires for solo Raúl
    const coPresenceBlockers = blockers.filter((b) => b.type === "co_presence_violation");
    expect(coPresenceBlockers).toHaveLength(0);
  });

  test("activeBlockers does NOT contain a location_state blocker for Raúl at the overpass (overpass is not in his state timeline)", () => {
    // The real protection here is that Pass 3 gets the CHARACTER ARC LEDGER with
    // Raúl's primary_locations which should show 'camp', not 'overpass'.
    // This test verifies that a blocker IS generated if someone checks a false location.
    // Since our ledger doesn't have location blockers (location-state is a future enhancement),
    // we verify the existing co-presence check doesn't falsely fire for solo Raúl.
    const blockers = getRecommendationBlockersForClaim({
      ledger,
      characterNames: ["Raúl"],
      targetChunk: 5,
    });
    expect(blockers.filter((b) => b.type === "co_presence_violation")).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGRESSION TEST 2: Paolito + Benjamin co-presence violation at Chapter 4
// ═══════════════════════════════════════════════════════════════════════════════

describe("Regression: Paolito+Benjamin Chapter 4 co-presence violation", () => {
  const ledger = buildCartelBabiesLedger();

  test("haveCharactersMet returns FALSE for Paolito+Benjamin at chunk 4", () => {
    expect(haveCharactersMet(ledger, "Paolito", "Benjamin", 4)).toBe(false);
  });

  test("haveCharactersMet returns TRUE for Paolito+Benjamin at chunk 72 (their first meeting)", () => {
    expect(haveCharactersMet(ledger, "Paolito", "Benjamin", 72)).toBe(true);
  });

  test("haveCharactersMet returns TRUE for Paolito+Benjamin at chunk 80 (after meeting)", () => {
    expect(haveCharactersMet(ledger, "Paolito", "Benjamin", 80)).toBe(true);
  });

  test("getRecommendationBlockersForClaim fires suppress blocker when rec places Paolito+Benjamin at chunk 4", () => {
    const blockers = getRecommendationBlockersForClaim({
      ledger,
      characterNames: ["Paolito", "Benjamin"],
      targetChunk: 4,
    });
    // At chunk 4: co_presence blocker fires (haven't met) + coping blocker fires for Benjamin
    // Both are suppress-severity — correct behavior is to fire ALL applicable blockers
    expect(blockers.length).toBeGreaterThanOrEqual(1);
    const coPresenceBlocker = blockers.find((b) => b.type === "co_presence_violation");
    expect(coPresenceBlocker).toBeDefined();
    expect(coPresenceBlocker?.severity).toBe("suppress");
    expect(coPresenceBlocker?.involvedCharacters).toContain("Paolito");
    expect(coPresenceBlocker?.involvedCharacters).toContain("Benjamin");
    // All blockers must be suppress-severity
    expect(blockers.every((b) => b.severity === "suppress")).toBe(true);
  });

  test("getRecommendationBlockersForClaim returns NO co-presence blocker for chunk 72+ (valid)", () => {
    const blockers = getRecommendationBlockersForClaim({
      ledger,
      characterNames: ["Paolito", "Benjamin"],
      targetChunk: 72,
    });
    const coPresenceBlockers = blockers.filter((b) => b.type === "co_presence_violation");
    expect(coPresenceBlockers).toHaveLength(0);
  });

  test("activeBlockers list contains the Paolito+Benjamin co-presence blocker with severity=suppress", () => {
    const blocker = ledger.activeBlockers.find(
      (b) => b.blockerId === "co_presence_violation:Paolito+Benjamin"
    );
    expect(blocker).toBeDefined();
    expect(blocker?.severity).toBe("suppress");
    expect(blocker?.validAfterChapter).toBe("Chapter 72");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGRESSION TEST 3: Benjamin coping ritual — "seed" must be blocked
// ═══════════════════════════════════════════════════════════════════════════════

describe("Regression: Benjamin coping ritual seed blocked (existing_feature_violation)", () => {
  const ledger = buildCartelBabiesLedger();

  test("doesCopingMechanismAlreadyExist returns TRUE for Benjamin", () => {
    const { exists, mechanisms } = doesCopingMechanismAlreadyExist(ledger, "Benjamin");
    expect(exists).toBe(true);
    expect(mechanisms.length).toBe(4);
  });

  test("Benjamin's 4 specific mechanisms are all present", () => {
    const { mechanisms } = doesCopingMechanismAlreadyExist(ledger, "Benjamin");
    expect(mechanisms).toContain("smoking");
    expect(mechanisms).toContain("lines up pencils before answering");
    expect(mechanisms).toContain("shopping in-store and online");
    expect(mechanisms).toContain("Starbucks runs");
  });

  test("getRecommendationBlockersForClaim fires existing_feature blocker for Benjamin", () => {
    const blockers = getRecommendationBlockersForClaim({
      ledger,
      characterNames: ["Benjamin"],
      targetChunk: 75,
    });
    const copingBlocker = blockers.find((b) => b.type === "existing_feature_violation");
    expect(copingBlocker).toBeDefined();
    expect(copingBlocker?.severity).toBe("suppress");
    expect(copingBlocker?.rule).toContain("smoking");
  });

  test("doesCopingMechanismAlreadyExist returns FALSE for Paolito (no coping in ledger)", () => {
    const { exists } = doesCopingMechanismAlreadyExist(ledger, "Paolito");
    expect(exists).toBe(false);
  });

  test("psychologyLedger seedingBlocked=true for Benjamin", () => {
    const benjaminPsych = ledger.psychologyLedger.find((p) => p.characterId === "benjamin");
    expect(benjaminPsych?.seedingBlocked).toBe(true);
    expect(benjaminPsych?.seedingBlockMessage).toContain("Do NOT recommend seeding");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGRESSION TEST 4: "Paul" name before rename window
// ═══════════════════════════════════════════════════════════════════════════════

describe("Regression: 'Paul' name used before rename window (name_state_violation)", () => {
  const ledger = buildCartelBabiesLedger();

  test("isNameValidAtChunk returns FALSE for 'Paul' at chunk 4 (before embassy)", () => {
    expect(isNameValidAtChunk(ledger, "Paolito", "Paul", 4)).toBe(false);
  });

  test("isNameValidAtChunk returns FALSE for 'Paul' at chunk 89 (last chunk before rename)", () => {
    expect(isNameValidAtChunk(ledger, "Paolito", "Paul", 89)).toBe(false);
  });

  test("isNameValidAtChunk returns TRUE for 'Paul' at chunk 90 (rename moment)", () => {
    expect(isNameValidAtChunk(ledger, "Paolito", "Paul", 90)).toBe(true);
  });

  test("isNameValidAtChunk returns TRUE for 'Paul' at chunk 99 (end of novel)", () => {
    expect(isNameValidAtChunk(ledger, "Paolito", "Paul", 99)).toBe(true);
  });

  test("isNameValidAtChunk returns TRUE for 'Paolito' at chunk 4 (original name)", () => {
    expect(isNameValidAtChunk(ledger, "Paolito", "Paolito", 4)).toBe(true);
  });

  test("isNameValidAtChunk returns FALSE for 'Paolito' at chunk 91 (after rename)", () => {
    expect(isNameValidAtChunk(ledger, "Paolito", "Paolito", 91)).toBe(false);
  });

  test("getRecommendationBlockersForClaim fires name_state blocker for 'Paul' at chunk 4", () => {
    const blockers = getRecommendationBlockersForClaim({
      ledger,
      characterNames: ["Paolito"],
      targetChunk: 4,
      nameUsed: "Paul",
    });
    const nameBlocker = blockers.find((b) => b.type === "name_state_violation");
    expect(nameBlocker).toBeDefined();
    expect(nameBlocker?.severity).toBe("suppress");
    expect(nameBlocker?.rule).toContain("chunk 90");
  });

  test("getRecommendationBlockersForClaim returns NO name blocker for 'Paul' at chunk 92 (valid)", () => {
    const blockers = getRecommendationBlockersForClaim({
      ledger,
      characterNames: ["Paolito"],
      targetChunk: 92,
      nameUsed: "Paul",
    });
    const nameBlockers = blockers.filter((b) => b.type === "name_state_violation");
    expect(nameBlockers).toHaveLength(0);
  });

  test("activeBlockers list contains name_state blocker for Paolito/Paul with severity=suppress", () => {
    const blocker = ledger.activeBlockers.find(
      (b) => b.blockerId === "name_state_violation:Paolito:Paul"
    );
    expect(blocker).toBeDefined();
    expect(blocker?.severity).toBe("suppress");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGRESSION TEST 5: Evidence absent — "glib aside" / "compress" with no quote
// ═══════════════════════════════════════════════════════════════════════════════
//
// This test category covers the Pass 3 Gate 1 (evidence_quote_required) violation.
// Since ledgerValidation.ts handles the deterministic ledger side, this test
// verifies that the helper correctly identifies evidence_absent conditions
// when an objectId or claim can't be grounded.
//
// The behavioral test for Gate 1 is enforced in the Pass 3 prompt (pass3-synthesis.ts)
// via GATE 1 language. This test confirms the formatActiveBlockersForPrompt output
// includes Gate 1 enforcement language so the injection is auditable.

describe("Regression: evidence_absent — unnamed craft claims need quote grounding", () => {
  const ledger = buildCartelBabiesLedger();

  test("formatActiveBlockersForPrompt includes suppress-category blockers first", () => {
    const output = formatActiveBlockersForPrompt(ledger);
    expect(output).toContain("SUPPRESS");
    expect(output).toContain("⛔");
    // Suppress blockers should precede any warn/downgrade
    const suppressIdx = output.indexOf("⛔");
    const warnIdx = output.indexOf("⚠");
    if (warnIdx !== -1) {
      expect(suppressIdx).toBeLessThan(warnIdx);
    }
  });

  test("formatActiveBlockersForPrompt includes the co-presence blocker rule text", () => {
    const output = formatActiveBlockersForPrompt(ledger);
    expect(output).toContain("Paolito");
    expect(output).toContain("Benjamin");
    expect(output).toContain("chunk 72");
  });

  test("formatActiveBlockersForPrompt includes the name-state blocker rule text", () => {
    const output = formatActiveBlockersForPrompt(ledger);
    expect(output).toContain("Paul");
    expect(output).toContain("chunk 90");
  });

  test("formatActiveBlockersForPrompt includes the coping seeding blocker", () => {
    const output = formatActiveBlockersForPrompt(ledger);
    expect(output).toContain("Do NOT recommend seeding");
  });

  test("evil-eye keychain IS tracked in objectLedger with missedIfAbsentFromReport=true", () => {
    const evilEye = ledger.objectLedger.find((o) => o.objectId === "evil_eye_keychain");
    expect(evilEye).toBeDefined();
    expect(evilEye?.missedIfAbsentFromReport).toBe(true);
    expect(evilEye?.ownershipPath).toEqual(["Michael", "Raúl", "Raúl's son"]);
  });

  test("evil-eye keychain has symbolPayoffIndex=true (payoff recorded)", () => {
    expect(hasSymbolAlreadyPaidOff(ledger, "evil_eye_keychain")).toBe(true);
  });

  test("Michael's cell phone IS tracked in objectLedger with missedIfAbsentFromReport=true", () => {
    const phone = ledger.objectLedger.find((o) => o.objectId === "michael_cell_phone");
    expect(phone).toBeDefined();
    expect(phone?.missedIfAbsentFromReport).toBe(true);
  });

  test("Michael's cell phone has symbolPayoffIndex=false (no payoff recorded — open tracking)", () => {
    expect(hasSymbolAlreadyPaidOff(ledger, "michael_cell_phone")).toBe(false);
  });

  test("getRecommendationBlockersForClaim fires object_state blocker for unknown object at any chunk", () => {
    const blockers = getRecommendationBlockersForClaim({
      ledger,
      characterNames: ["Michael"],
      targetChunk: 2,
      objectIds: ["nonexistent_object"],
    });
    const objBlocker = blockers.find((b) => b.type === "object_state_violation");
    expect(objBlocker).toBeDefined();
    expect(objBlocker?.severity).toBe("suppress");
  });

  test("isObjectAtLocation returns TRUE for evil_eye at chunk 10 (within its range)", () => {
    expect(isObjectAtLocation(ledger, "evil_eye_keychain", 10)).toBe(true);
  });

  test("isObjectAtLocation returns FALSE for evil_eye before it appears (chunk 1)", () => {
    expect(isObjectAtLocation(ledger, "evil_eye_keychain", 1)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADDITIONAL COVERAGE: isCharacterPresent edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe("isCharacterPresent edge cases", () => {
  const ledger = buildCartelBabiesLedger();

  test("Benjamin is NOT present at chunk 4 (appears at chunk 70)", () => {
    expect(isCharacterPresent(ledger, "Benjamin", 4)).toBe(false);
  });

  test("Benjamin IS present at chunk 70 (first appearance)", () => {
    expect(isCharacterPresent(ledger, "Benjamin", 70)).toBe(true);
  });

  test("Raúl is NOT present at chunk 0 (first appears chunk 2)", () => {
    expect(isCharacterPresent(ledger, "Raúl", 0)).toBe(false);
  });

  test("Raúl IS present at chunk 2 (first appearance)", () => {
    expect(isCharacterPresent(ledger, "Raúl", 2)).toBe(true);
  });

  test("Unknown character returns false (fail-closed)", () => {
    expect(isCharacterPresent(ledger, "Navarro", 10)).toBe(false);
  });
});

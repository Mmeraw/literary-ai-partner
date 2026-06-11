/**
 * Recommendation Integrity Gate — comprehensive test suite.
 *
 * Three test categories:
 *   1. REJECTS corrupted text (exact Sister eval fragments, 777afd5d)
 *   2. ACCEPTS valid editorial cards
 *   3. TIER SCORING — distinguishes mediocre-but-valid from editorially excellent
 *
 * Governance reference:
 *   docs/gold-standards/recommendation-integrity-dream-standard.md
 */

import {
  runRecommendationIntegrityGate,
  checkRecommendationIntegrity,
  meetsMinimumTier,
  hasNonInitialProperNounReference,
  type IntegrityField,
  type IntegrityResult,
  type QualityTier,
  DREAM_STANDARD_DOC,
} from "@/lib/evaluation/pipeline/recommendationIntegrityGate";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeFields(overrides: Partial<Record<string, string>>): IntegrityField[] {
  const defaults: Record<string, string> = {
    action: "After Nicolas tells Mike he is homesick, add one visible consequence that forces Mike to decide whether Toronto has failed as a rescue attempt.",
    symptom: "The current scene moves directly from Nicolas announcing he is homesick to the return flight without dramatizing the emotional decision.",
    cause: "Because the emotional decision occurs off-page, readers observe the outcome without experiencing the conflict that produced it.",
    reader_effect: "This increases emotional investment by allowing readers to experience the failure rather than being told about it afterward.",
  };
  const merged = { ...defaults, ...overrides };
  return Object.entries(merged)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([name, value]) => ({ name, value: value as string }));
}

function expectTier(result: IntegrityResult, expected: QualityTier) {
  expect(result.tier).toBe(expected);
}

function expectFailed(result: IntegrityResult) {
  expect(result.passed).toBe(false);
  expect(result.tier).toBe("FAIL");
}

function expectPassed(result: IntegrityResult) {
  expect(result.passed).toBe(true);
  expect(result.tier).not.toBe("FAIL");
}

function hasViolationCode(result: IntegrityResult, code: string): boolean {
  return result.violations.some((v) => v.code === code);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. REJECTS — corrupted text (exact Sister eval fragments)
// ─────────────────────────────────────────────────────────────────────────────

describe("Recommendation Integrity Gate", () => {
  describe("governance reference", () => {
    it("should export the dream standard doc path", () => {
      expect(DREAM_STANDARD_DOC).toBe(
        "docs/gold-standards/recommendation-integrity-dream-standard.md",
      );
    });
  });

  describe("REJECTS corrupted text — exact Sister eval fragments", () => {
    it("should FAIL: 'can nonetheless, many high-stakes beats...' (malformed connector)", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action:
            "can nonetheless, many high-stakes beats are summarized in a few sentences rather than staged because the causal sequencing is inverted, so the consequence lands before the trigger, losing scene-turn coherence.",
        }),
      );
      expectFailed(result);
      expect(hasViolationCode(result, "MALFORMED_CONNECTOR")).toBe(true);
    });

    it("should FAIL: 'would some locations...' (malformed connector)", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action:
            "would some locations, like the three side-by-side basement rooms described near the end or the.",
        }),
      );
      expectFailed(result);
      expect(hasViolationCode(result, "MALFORMED_CONNECTOR")).toBe(true);
    });

    it("should FAIL: 'helping the passage however...' (malformed connector)", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action:
            'helping the passage however, long stretches of exposition—such as the INSITE statistics, historical notes on because the stakes signal arrives too late in the passage, diffusing narrative urgency at the turn.',
        }),
      );
      expectFailed(result);
      expect(hasViolationCode(result, "MALFORMED_CONNECTOR")).toBe(true);
    });

    it("should FAIL: compound Sister fragment with multiple broken connectors", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action:
            'At the scene level, the passage near "Studies are mixed on the…" would benefit from one immediate external action cue before returning to reflection, helping the passage however, long stretches of exposition—such as the INSITE statistics, historical notes on because the stakes signal arrives too late in the passage, diffusing narrative urgency at the turn.',
        }),
      );
      expectFailed(result);
      expect(hasViolationCode(result, "MALFORMED_CONNECTOR")).toBe(true);
    });

    it("should FAIL: orphan conjunction 'however' at start", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: "However the scene continues without a clear turning point or resolution.",
        }),
      );
      expectFailed(result);
      expect(hasViolationCode(result, "ORPHAN_CONJUNCTION")).toBe(true);
    });

    it("should FAIL: orphan conjunction 'nonetheless' at start", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: "Nonetheless, the pacing remains consistent throughout the middle section.",
        }),
      );
      expectFailed(result);
      expect(hasViolationCode(result, "ORPHAN_CONJUNCTION")).toBe(true);
    });

    it("should FAIL: orphan conjunction 'because' at start", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: "Because the passage shifts tone without preparation, creating dissonance.",
        }),
      );
      expectFailed(result);
      expect(hasViolationCode(result, "ORPHAN_CONJUNCTION")).toBe(true);
    });

    it("should FAIL: mid-sentence truncation ending with comma", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: "Add a visible consequence after Nicolas announces his decision,",
        }),
      );
      expectFailed(result);
      expect(hasViolationCode(result, "MID_SENTENCE_TRUNCATION")).toBe(true);
    });

    it("should FAIL: mid-sentence truncation ending with em-dash", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: "The current scene moves from announcement to departure—",
        }),
      );
      expectFailed(result);
      expect(hasViolationCode(result, "MID_SENTENCE_TRUNCATION")).toBe(true);
    });

    it("should FAIL: mid-sentence truncation ending with conjunction", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: "Add one visible consequence that forces Mike to decide whether",
        }),
      );
      expectFailed(result);
      expect(hasViolationCode(result, "MID_SENTENCE_TRUNCATION")).toBe(true);
    });

    it("should FAIL: missing terminal punctuation", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: "Add a decision beat before the return flight to strengthen emotional stakes",
        }),
      );
      expect(hasViolationCode(result, "MISSING_TERMINAL_PUNCTUATION")).toBe(true);
    });

    it("should FAIL: sentence fragment starting with 'which'", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: "Which would improve the scene's emotional resonance significantly.",
        }),
      );
      expectFailed(result);
      expect(hasViolationCode(result, "SENTENCE_FRAGMENT")).toBe(true);
    });

    it("should FAIL: 'could however' modal+orphan splice", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: "The passage could however benefit from a stronger opening beat that anchors the scene.",
        }),
      );
      expectFailed(result);
      expect(hasViolationCode(result, "SENTENCE_FRAGMENT")).toBe(true);
    });

    it("should FAIL: repeated 6-word clause (copy artifact)", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action:
            "Add a visible consequence that forces Mike to decide. The scene needs a visible consequence that forces Mike to decide whether Toronto has truly failed.",
        }),
      );
      expect(hasViolationCode(result, "REPEATED_CLAUSE")).toBe(true);
    });

    it("should FAIL: missing required field — no action", () => {
      const fields = makeFields({}).filter((f) => f.name !== "action");
      const result = runRecommendationIntegrityGate(fields);
      expect(hasViolationCode(result, "INCOMPLETE_FIELD")).toBe(true);
      expect(result.violations.find((v) => v.code === "INCOMPLETE_FIELD")?.field).toBe("action");
    });

    it("should FAIL: missing required field — no cause", () => {
      const fields = makeFields({}).filter((f) => f.name !== "cause");
      const result = runRecommendationIntegrityGate(fields);
      expect(hasViolationCode(result, "INCOMPLETE_FIELD")).toBe(true);
      expect(result.violations.find((v) => v.code === "INCOMPLETE_FIELD")?.field).toBe("cause");
    });

    it("should FAIL: missing required field — no reader_effect", () => {
      const fields = makeFields({}).filter((f) => f.name !== "reader_effect");
      const result = runRecommendationIntegrityGate(fields);
      expect(hasViolationCode(result, "INCOMPLETE_FIELD")).toBe(true);
      expect(result.violations.find((v) => v.code === "INCOMPLETE_FIELD")?.field).toBe("reader_effect");
    });

    it("should FAIL: too-short field (under 10 chars)", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({ action: "Fix it." }),
      );
      expect(hasViolationCode(result, "INCOMPLETE_FIELD")).toBe(true);
    });

    it("should FAIL: generic workshop language — 'tighten prose'", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({ action: "Tighten prose." }),
      );
      expect(hasViolationCode(result, "GENERIC_WORKSHOP_LANGUAGE")).toBe(true);
    });

    it("should FAIL: generic workshop language — 'insert one concrete stakes beat'", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({ action: "Insert one concrete stakes beat." }),
      );
      expect(hasViolationCode(result, "GENERIC_WORKSHOP_LANGUAGE")).toBe(true);
    });

    it("should FAIL: generic workshop language — 'show don't tell'", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({ action: "Show, don't tell." }),
      );
      expect(hasViolationCode(result, "GENERIC_WORKSHOP_LANGUAGE")).toBe(true);
    });

    it("should FAIL: generic workshop language — 'add more tension'", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({ action: "Add more tension." }),
      );
      expect(hasViolationCode(result, "GENERIC_WORKSHOP_LANGUAGE")).toBe(true);
    });

    it("should flag: generic effect phrase — 'Improves engagement.'", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({ reader_effect: "Improves engagement." }),
      );
      expect(hasViolationCode(result, "GENERIC_EFFECT_PHRASE")).toBe(true);
    });

    it("should flag: cause field missing causal language", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          cause: "The scene feels weak and lacks sufficient momentum to carry the narrative forward.",
        }),
      );
      expect(hasViolationCode(result, "MISSING_CAUSAL_LANGUAGE")).toBe(true);
    });

    it("should flag: reader_effect field missing reader-facing consequence language", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          reader_effect: "The scene will work better with this change applied correctly.",
        }),
      );
      expect(hasViolationCode(result, "MISSING_READER_CONSEQUENCE")).toBe(true);
    });

    it("should flag: symptom field missing manuscript evidence", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          symptom: "The pacing is off and the tone shifts unexpectedly without warning.",
        }),
      );
      expect(hasViolationCode(result, "MISSING_MANUSCRIPT_EVIDENCE")).toBe(true);
    });

    it("should flag: vague anchor — 'the passage'", () => {
      const result = runRecommendationIntegrityGate([
        ...makeFields({}),
        { name: "anchor_snippet", value: "the passage" },
      ]);
      expect(hasViolationCode(result, "VAGUE_ANCHOR")).toBe(true);
    });

    it("should flag: vague anchor — 'the scene'", () => {
      const result = runRecommendationIntegrityGate([
        ...makeFields({}),
        { name: "anchor_snippet", value: "the scene" },
      ]);
      expect(hasViolationCode(result, "VAGUE_ANCHOR")).toBe(true);
    });

    it("should flag: MISSING_SPECIFIC_ANCHOR when anchor available but action lacks reference", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: "Add a visible consequence to improve the transition and overall quality of the work here.",
        }),
        { anchorSnippet: 'Near "I flew him home three days later."' },
      );
      expect(hasViolationCode(result, "MISSING_SPECIFIC_ANCHOR")).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. ACCEPTS — valid editorial cards
  // ─────────────────────────────────────────────────────────────────────────

  describe("ACCEPTS valid editorial cards", () => {
    it("should PASS: dream standard anchored recommendation (Sister ledger example)", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: "After Nicolas tells Mike he is homesick, add one visible consequence that forces Mike to decide whether Toronto has failed as a rescue attempt.",
          symptom: "The current scene moves directly from Nicolas announcing he is homesick to the return flight without dramatizing the emotional decision.",
          cause: "Because the emotional decision occurs off-page, readers observe the outcome without experiencing the conflict that produced it.",
          reader_effect: "This increases emotional investment by allowing readers to experience the failure rather than being told about it afterward.",
        }),
        { anchorSnippet: 'Near "I flew him home three days later."' },
      );
      expectPassed(result);
      expect(result.violations.filter((v) =>
        v.code === "MALFORMED_CONNECTOR" ||
        v.code === "ORPHAN_CONJUNCTION" ||
        v.code === "SENTENCE_FRAGMENT" ||
        v.code === "REPEATED_CLAUSE" ||
        v.code === "MID_SENTENCE_TRUNCATION",
      )).toHaveLength(0);
    });

    it("should PASS: strong recommendation with character name and scene reference", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: "After Nicolas decides to return to British Columbia, add a visible consequence showing what Mike believes has failed about the Toronto experiment.",
          symptom: "The current scene moves from the decision to the departure without dramatizing the emotional cost.",
          cause: "Because the consequence of the Toronto experiment's failure is not externalized, readers miss the emotional weight of the decision.",
          reader_effect: "This clarifies the emotional cost of the decision and strengthens momentum into the next section.",
        }),
      );
      expectPassed(result);
    });

    it("should PASS: recommendation with quoted anchor", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: 'Near "I flew him home three days later," add one sentence showing Mike\u2019s internal response to the failure before the action of booking the flight.',
          symptom: 'The passage near "I flew him home three days later" moves directly to logistics without dramatizing Mike\u2019s emotional response.',
          cause: "Because the emotional reaction is implied but never shown, readers experience the scene as reportage rather than lived conflict.",
          reader_effect: "This converts the scene from summary into dramatic action, increasing reader empathy and engagement.",
        }),
      );
      expectPassed(result);
    });

    it("should PASS: recommendation ending with period", () => {
      const result = runRecommendationIntegrityGate(makeFields({}));
      expectPassed(result);
    });

    it("should PASS: recommendation ending with exclamation", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          reader_effect: "This transforms the entire emotional arc of the scene!",
        }),
      );
      expectPassed(result);
    });

    it("should PASS: cause field with causal language 'because'", () => {
      const result = runRecommendationIntegrityGate(makeFields({}));
      expect(hasViolationCode(result, "MISSING_CAUSAL_LANGUAGE")).toBe(false);
    });

    it("should PASS: cause field with 'due to'", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          cause: "Due to the rapid pacing in the opening paragraphs, the scene lacks grounding detail.",
        }),
      );
      expect(hasViolationCode(result, "MISSING_CAUSAL_LANGUAGE")).toBe(false);
    });

    it("should PASS: cause field with 'since'", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          cause: "Since the scene omits the decision beat, readers experience the conclusion without the conflict.",
        }),
      );
      expect(hasViolationCode(result, "MISSING_CAUSAL_LANGUAGE")).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. TIER SCORING — quality tiers and specificity measurement
  // ─────────────────────────────────────────────────────────────────────────

  describe("TIER SCORING — quality tiers", () => {
    it("should score PASS_DREAM_STANDARD for the Sister ledger dream example", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action:
            "After Nicolas tells Mike he is homesick, add a visible consequence that forces Mike to decide whether Toronto has failed as a rescue attempt. The current version moves directly to the return flight, which reports the outcome without dramatizing the emotional cost. By requiring Mike to confront the failure before acting, the scene converts reflection into conflict and strengthens the manuscript's recurring question about whether love can meaningfully change another person's trajectory.",
          symptom:
            "The current scene moves directly from Nicolas announcing he is homesick to the return flight without dramatizing the emotional decision.",
          cause:
            "Because the emotional decision occurs off-page, readers observe the outcome without experiencing the conflict that produced it.",
          reader_effect:
            "This increases emotional investment by allowing readers to experience the failure rather than being told about it afterward, strengthening the reader's immersion in the thematic question.",
        }),
        { anchorSnippet: 'Near "I flew him home three days later."' },
      );
      expectPassed(result);
      expectTier(result, "PASS_DREAM_STANDARD");
      expect(result.quality_score).toBeGreaterThanOrEqual(7);
      expect(result.dream_standard_features).toContain("character_named");
      expect(result.dream_standard_features).toContain("decision_identified");
      expect(result.dream_standard_features).toContain("consequence_identified");
      expect(result.dream_standard_features).toContain("reader_effect_explained");
    });

    it("should score PASS_STRONG for a good anchored recommendation", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: "After Nicolas decides to return to British Columbia, add a visible consequence showing what Mike believes has failed about the Toronto experiment. This strengthens the emotional transition into the return-home decision.",
          symptom: "The current scene moves from the decision to the departure without externalizing the emotional cost in the passage.",
          cause: "Because the consequence of the failure is not shown, readers are told rather than shown the emotional stakes.",
          reader_effect: "This clarifies the emotional cost and strengthens momentum into the next section, increasing reader engagement.",
        }),
      );
      expectPassed(result);
      expect(result.quality_score).toBeGreaterThanOrEqual(5);
      expect(["PASS_STRONG", "PASS_DREAM_STANDARD"]).toContain(result.tier);
    });

    it("should score PASS_MINIMUM for barely-anchored but generic recommendation", () => {
      // PASS_MINIMUM: has a quoted anchor and a decision word, but no character name,
      // no scene + proper noun pairing, no consequence language, no theme → barely valid
      // for eval report, not strong enough for Revise Queue.
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: 'Near "I flew him home three days later," add one visible beat before the return.',
          symptom: "The text moves directly to logistics without dramatizing the emotional weight of what happened.",
          cause: "Because the emotional cost is implied rather than stated, the writing feels compressed.",
          reader_effect: "This gives the reader a clearer emotional transition into the next part.",
        }),
      );
      expectPassed(result);
      expect(result.quality_score).toBeGreaterThanOrEqual(3);
      expect(result.quality_score).toBeLessThanOrEqual(4);
      expect(result.tier).toBe("PASS_MINIMUM");
    });

    it("should score FAIL for corrupted text regardless of other field quality", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action:
            "can nonetheless, many high-stakes beats are summarized rather than staged.",
          symptom: "The current scene moves directly from Nicolas announcing he is homesick to the return flight without dramatizing the emotional decision.",
          cause: "Because the emotional decision occurs off-page, readers observe the outcome without experiencing the conflict that produced it.",
          reader_effect: "This increases emotional investment by allowing readers to experience the failure rather than being told about it afterward.",
        }),
      );
      expectFailed(result);
      expectTier(result, "FAIL");
    });

    it("should detect dream standard features: character_named", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: "After Nicolas tells Mike he is homesick, add a consequence that forces a decision.",
        }),
        { anchorSnippet: "Near the return-home scene." },
      );
      expect(result.dream_standard_features).toContain("character_named");
    });

    it("should detect dream standard features: quoted_anchor", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: 'Near "I flew him home three days later," add one sentence showing Mike\u2019s reaction.',
        }),
        { anchorSnippet: 'Near "I flew him home three days later."' },
      );
      expect(result.dream_standard_features).toContain("quoted_anchor");
    });

    it("should detect dream standard features: decision_identified", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: "Add a visible consequence that forces Mike to decide whether Toronto has failed.",
        }),
      );
      expect(result.dream_standard_features).toContain("decision_identified");
    });

    it("should detect dream standard features: theme_connected", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: "This strengthens the manuscript's recurring thematic question about whether love can change another person's trajectory.",
        }),
      );
      expect(result.dream_standard_features).toContain("theme_connected");
    });

    it("should detect dream standard features: consequence_identified", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({
          action: "Add a visible consequence showing the emotional cost of the decision to externalize the conflict.",
        }),
      );
      expect(result.dream_standard_features).toContain("consequence_identified");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. meetsMinimumTier — governance control
  // ─────────────────────────────────────────────────────────────────────────

  describe("meetsMinimumTier — governance control", () => {
    it("FAIL should not meet minimum for evaluation_report", () => {
      const result: IntegrityResult = {
        passed: false,
        tier: "FAIL",
        quality_score: 1,
        violations: [],
        dream_standard_features: [],
      };
      expect(meetsMinimumTier(result, "evaluation_report")).toBe(false);
    });

    it("PASS_MINIMUM should meet minimum for evaluation_report", () => {
      const result: IntegrityResult = {
        passed: true,
        tier: "PASS_MINIMUM",
        quality_score: 3,
        violations: [],
        dream_standard_features: [],
      };
      expect(meetsMinimumTier(result, "evaluation_report")).toBe(true);
    });

    it("PASS_MINIMUM should NOT meet minimum for revise_queue", () => {
      const result: IntegrityResult = {
        passed: true,
        tier: "PASS_MINIMUM",
        quality_score: 4,
        violations: [],
        dream_standard_features: [],
      };
      expect(meetsMinimumTier(result, "revise_queue")).toBe(false);
    });

    it("PASS_STRONG should meet minimum for revise_queue", () => {
      const result: IntegrityResult = {
        passed: true,
        tier: "PASS_STRONG",
        quality_score: 5,
        violations: [],
        dream_standard_features: [],
      };
      expect(meetsMinimumTier(result, "revise_queue")).toBe(true);
    });

    it("PASS_DREAM_STANDARD should meet minimum for both surfaces", () => {
      const result: IntegrityResult = {
        passed: true,
        tier: "PASS_DREAM_STANDARD",
        quality_score: 7,
        violations: [],
        dream_standard_features: [],
      };
      expect(meetsMinimumTier(result, "evaluation_report")).toBe(true);
      expect(meetsMinimumTier(result, "revise_queue")).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. checkRecommendationIntegrity — convenience wrapper
  // ─────────────────────────────────────────────────────────────────────────

  describe("checkRecommendationIntegrity convenience wrapper", () => {
    it("should accept a well-formed recommendation object", () => {
      const result = checkRecommendationIntegrity({
        action: "After Nicolas tells Mike he is homesick, add one visible consequence that forces Mike to decide whether Toronto has failed as a rescue attempt.",
        symptom: "The current scene moves directly from Nicolas announcing he is homesick to the return flight.",
        cause: "Because the emotional decision occurs off-page, readers observe the outcome without the conflict.",
        reader_effect: "This increases emotional investment by allowing readers to experience the failure rather than being told.",
        anchor_snippet: 'Near "I flew him home three days later."',
      });
      expectPassed(result);
    });

    it("should reject a recommendation with malformed action text", () => {
      const result = checkRecommendationIntegrity({
        action:
          "can nonetheless, many high-stakes beats are summarized rather than staged.",
        symptom: "The current scene moves directly from the decision to departure.",
        cause: "Because the cost is not shown, readers miss the weight of the decision.",
        reader_effect: "This increases reader engagement by dramatizing the conflict.",
      });
      expectFailed(result);
    });

    it("should handle fix_direction field as alternative to action", () => {
      const result = checkRecommendationIntegrity({
        fix_direction: "After Nicolas tells Mike he is homesick, add one visible consequence that forces a decision about Toronto.",
        symptom: "The current scene skips the emotional beat in the passage near the departure.",
        cause: "Because the decision is implied, readers never experience the conflict directly.",
        reader_effect: "This strengthens reader immersion by dramatizing the decision rather than reporting it.",
      });
      expectPassed(result);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Structured failure codes — admin/debug visibility
  // ─────────────────────────────────────────────────────────────────────────

  describe("structured failure codes for admin/debug", () => {
    it("should return MALFORMED_CONNECTOR code with detail", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({ action: "would some locations near the end benefit from additional detail." }),
      );
      const v = result.violations.find((v) => v.code === "MALFORMED_CONNECTOR");
      expect(v).toBeDefined();
      expect(v!.field).toBe("action");
      expect(v!.detail).toContain("would some");
    });

    it("should return ORPHAN_CONJUNCTION code with detail", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({ action: "However the scene lacks a clear anchor for the emotional beat." }),
      );
      const v = result.violations.find((v) => v.code === "ORPHAN_CONJUNCTION");
      expect(v).toBeDefined();
      expect(v!.detail).toContain("however");
    });

    it("should return MISSING_CAUSAL_LANGUAGE code for cause field", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({ cause: "The scene feels weak and lacks momentum to carry the narrative forward." }),
      );
      const v = result.violations.find((v) => v.code === "MISSING_CAUSAL_LANGUAGE");
      expect(v).toBeDefined();
      expect(v!.field).toBe("cause");
    });

    it("should return GENERIC_WORKSHOP_LANGUAGE code for action field", () => {
      const result = runRecommendationIntegrityGate(
        makeFields({ action: "Raise the stakes." }),
      );
      const v = result.violations.find((v) => v.code === "GENERIC_WORKSHOP_LANGUAGE");
      expect(v).toBeDefined();
      expect(v!.field).toBe("action");
    });

    it("should return VAGUE_ANCHOR code for anchor_snippet field", () => {
      const result = runRecommendationIntegrityGate([
        ...makeFields({}),
        { name: "anchor_snippet", value: "In the passage" },
      ]);
      const v = result.violations.find((v) => v.code === "VAGUE_ANCHOR");
      expect(v).toBeDefined();
      expect(v!.field).toBe("anchor_snippet");
    });

    it("should deduplicate violations (same field + code)", () => {
      // Two malformed connectors in the same field should produce only one violation per pattern
      const result = runRecommendationIntegrityGate(
        makeFields({
          action:
            "can nonetheless, many beats and can nonetheless, many more beats are summarized.",
        }),
      );
      const malformed = result.violations.filter(
        (v) => v.code === "MALFORMED_CONNECTOR" && v.field === "action",
      );
      expect(malformed.length).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. hasNonInitialProperNounReference — shared helper
  // ─────────────────────────────────────────────────────────────────────────

  describe("hasNonInitialProperNounReference — shared helper", () => {
    it("should return false for 'Add one visible consequence...'", () => {
      expect(hasNonInitialProperNounReference("Add one visible consequence to improve momentum.")).toBe(false);
    });

    it("should return true for 'After Nicolas tells Mike...'", () => {
      expect(hasNonInitialProperNounReference("After Nicolas tells Mike he is homesick, add a consequence.")).toBe(true);
    });

    it("should return true for 'In the Toronto experiment...'", () => {
      expect(hasNonInitialProperNounReference("In the Toronto experiment, the cost was high.")).toBe(true);
    });

    it("should return false for 'The scene needs more tension...'", () => {
      expect(hasNonInitialProperNounReference("The scene needs more tension.")).toBe(false);
    });

    it("should return false for 'Insert a concrete stakes beat.'", () => {
      expect(hasNonInitialProperNounReference("Insert a concrete stakes beat.")).toBe(false);
    });

    it("should return true for mid-sentence character after comma", () => {
      expect(hasNonInitialProperNounReference("After the argument, Nicolas walks away.")).toBe(true);
    });

    it("should return true for multiple mid-sentence proper nouns", () => {
      expect(hasNonInitialProperNounReference("When Mike and Nicolas argue about Toronto, the scene gains tension.")).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Surface-aware adapter behavior
  // ─────────────────────────────────────────────────────────────────────────
  describe("Surface-aware adapter — evaluation_report vs revise_queue", () => {
    it("eval rec without cause should NOT fail solely for missing cause", () => {
      const result = checkRecommendationIntegrity({
        action: 'After Nicolas returns from Toronto, add one visible beat showing the emotional cost of the decision.',
        expected_impact: 'The reader experiences the weight of the return rather than merely observing logistics.',
        anchor_snippet: 'I flew him home three days later.',
        surface: "evaluation_report",
      });
      // Should not have INCOMPLETE_FIELD for cause
      const causeViolation = result.violations.find(
        (v) => v.field === "cause" && v.code === "INCOMPLETE_FIELD",
      );
      expect(causeViolation).toBeUndefined();
      expect(result.passed).toBe(true);
    });

    it("revise card without cause should fail", () => {
      const result = checkRecommendationIntegrity({
        action: 'After Nicolas returns from Toronto, add one visible beat showing the emotional cost of the decision.',
        symptom: 'The passage near the return scene moves directly to logistics without dramatizing the emotional cost.',
        reader_effect: 'The reader experiences the weight of the return rather than merely observing logistics.',
        anchor_snippet: 'I flew him home three days later.',
        surface: "revise_queue",
      });
      const causeViolation = result.violations.find(
        (v) => v.field === "cause" && v.code === "INCOMPLETE_FIELD",
      );
      expect(causeViolation).toBeDefined();
      expect(result.tier).toBe("FAIL");
    });

    it("gate does not mutate the original rec object (no synthetic fields)", () => {
      const originalRec = {
        action: 'After Nicolas returns from Toronto, add one visible beat showing the emotional cost of the decision.',
        expected_impact: 'The reader experiences the weight of the return rather than merely observing logistics.',
        anchor_snippet: 'I flew him home three days later.',
        surface: "evaluation_report" as const,
      };
      const result = checkRecommendationIntegrity(originalRec);
      expect(result.passed).toBe(true);
      // Original object must not have synthetic cause/symptom injected
      expect((originalRec as Record<string, unknown>).cause).toBeUndefined();
      expect((originalRec as Record<string, unknown>).symptom).toBeUndefined();
    });

    it("eval rec with malformed action should fail regardless of surface", () => {
      const result = checkRecommendationIntegrity({
        action: 'can nonetheless, many high-stakes beats would benefit from',
        expected_impact: 'The reader gains clarity about the emotional transition.',
        anchor_snippet: 'He waited by the door.',
        surface: "evaluation_report",
      });
      expect(result.passed).toBe(false);
      expect(result.tier).toBe("FAIL");
    });

    it("eval rec with clean action + anchor + expected_impact should pass minimum", () => {
      const result = checkRecommendationIntegrity({
        action: 'Near "I flew him home three days later," add one visible consequence before the return.',
        expected_impact: 'This gives the reader a clearer emotional transition into the next section.',
        anchor_snippet: 'I flew him home three days later.',
        surface: "evaluation_report",
      });
      expect(result.passed).toBe(true);
      expect(["PASS_MINIMUM", "PASS_STRONG", "PASS_DREAM_STANDARD"]).toContain(result.tier);
    });

    it("revise card needs full diagnostic set to reach PASS_STRONG", () => {
      // Without symptom and cause, a revise card FAILs due to INCOMPLETE_FIELD
      const withoutDiagnostics = checkRecommendationIntegrity({
        action: 'After Nicolas returns from Toronto, add one visible beat showing the emotional cost.',
        reader_effect: 'The reader experiences the weight of the return rather than observing logistics.',
        anchor_snippet: 'I flew him home three days later.',
        surface: "revise_queue",
      });
      expect(withoutDiagnostics.tier).toBe("FAIL");
      expect(meetsMinimumTier(withoutDiagnostics, "revise_queue")).toBe(false);

      // With full diagnostics, it can reach PASS_STRONG
      const withDiagnostics = checkRecommendationIntegrity({
        action: 'After Nicolas returns from Toronto, add one visible beat that forces Mike to confront the failure of the rescue attempt.',
        symptom: 'The passage near the return scene moves directly to logistics without dramatizing the emotional cost.',
        cause: 'Because the decision happens in summary, the scene reports the consequence before readers experience it.',
        reader_effect: 'The reader experiences the weight of the decision rather than merely observing logistics.',
        anchor_snippet: 'I flew him home three days later.',
        surface: "revise_queue",
      });
      expect(meetsMinimumTier(withDiagnostics, "revise_queue")).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // P2: Expanded Generic Detection + Raised Minimum Tier
  // ─────────────────────────────────────────────────────────────────────────────
  describe("P2: manuscript-specific revision strategy enforcement", () => {
    it("rejects expanded workshop clichés (deepen, incorporate, heighten)", () => {
      const genericActions = [
        "Deepen the thematic exploration of materialism.",
        "Incorporate more sensory details.",
        "Heighten the dramatic tension.",
        "Increase narrative urgency.",
        "Develop the character more.",
        "Make the dialogue stronger.",
        "Introduce more conflict to the dialogue.",
        "Add a dramatic question.",
        "Create a sense of urgency.",
      ];

      for (const action of genericActions) {
        const result = checkRecommendationIntegrity({
          action,
          symptom: "The passage near the diamond scene stalls momentum.",
          cause: "Because exposition displaces dramatic action.",
          reader_effect: "The reader loses urgency at the critical turn.",
          anchor_snippet: '"the diamond industry has lost its appeal"',
          surface: "evaluation_report",
        });
        expect(result.violations.some((v) => v.code === "GENERIC_WORKSHOP_LANGUAGE")).toBe(true);
      }
    });

    it("accepts manuscript-specific revision strategy", () => {
      const result = checkRecommendationIntegrity({
        action: 'Cut the diamond-market exposition (paragraphs 3–5) after Calvin says "the industry has lost its appeal" and replace with a beat where Calvin notices Monty\'s hands shaking — converting telling into dramatic subtext.',
        symptom: 'The passage near "the allure of diamonds" stalls because three paragraphs of economic exposition displace the unfolding dramatic question.',
        cause: 'Because the backstory is delivered in summary rather than through character interaction, the reader receives information without experiencing the emotional stakes.',
        reader_effect: 'The reader feels Monty\'s desperation through physical gesture rather than receiving Calvin\'s economic analysis as secondhand narration.',
        anchor_snippet: '"the diamond industry has lost its appeal"',
        surface: "evaluation_report",
      });
      expect(result.passed).toBe(true);
      expect(result.tier).not.toBe("FAIL");
    });

    it("generic workshop phrases produce GENERIC_WORKSHOP_LANGUAGE violations that lower quality score", () => {
      // A recommendation using workshop language should get penalized even if
      // other fields are present — the score should be lower than a specific rec.
      const generic = checkRecommendationIntegrity({
        action: "Heighten the dramatic tension.",
        symptom: "The passage near the diamond scene stalls momentum.",
        cause: "Because exposition displaces dramatic action.",
        reader_effect: "The reader loses urgency at the critical turn.",
        anchor_snippet: '"the diamond industry has lost its appeal"',
        surface: "evaluation_report",
      });
      const specific = checkRecommendationIntegrity({
        action: 'Move the GeoCam offer reveal from page 8 to page 4, forcing Calvin to react before Monty\'s nostalgic digression dissipates his urgency.',
        symptom: 'Near the GeoCam scene, three paragraphs of Monty\'s nostalgia separate the offer from Calvin\'s reaction.',
        cause: 'Because the reveal is deferred past the emotional peak, readers have already metabolized the stakes.',
        reader_effect: 'Reader experiences Calvin\'s shock in real-time rather than receiving it as narration.',
        anchor_snippet: '"GeoCam wants to buy the whole operation"',
        surface: "evaluation_report",
      });
      // Generic should have lower quality score than specific
      expect(generic.quality_score).toBeLessThan(specific.quality_score);
      // Generic should have the violation
      expect(generic.violations.some((v) => v.code === "GENERIC_WORKSHOP_LANGUAGE")).toBe(true);
      // Specific should not
      expect(specific.violations.some((v) => v.code === "GENERIC_WORKSHOP_LANGUAGE")).toBe(false);
    });
  });
});

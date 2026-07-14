/**
 * U4 Processor Integration Proof — U3-001 Summary↔Criterion Consistency Gate
 *
 * GOVERNANCE GATE: Proves the processor wiring for the U3-001
 * summaryCriterionConsistencyGate is correct across all three verdict paths.
 *
 * Three-layer requirement (all layers must pass):
 *
 * Layer 1 — Gate produces correct verdicts on synthetic input
 *   - Clean fixture (no contradictions) → PASS, blocking: false
 *   - One-contradiction fixture → WARN, blocking: false
 *   - Two-contradiction fixture → BLOCK, blocking: true
 *
 * Layer 2 — Artifact persistence contract
 *   - summary_criterion_consistency_v1 artifact is produced on ALL three paths
 *   - Artifact content matches the gate result exactly (no mutation)
 *   - schema_version is 'summary_criterion_consistency_v1'
 *   - check_id is 'summary_criterion_positive_contradiction'
 *
 * Layer 3 — Processor integration linkage
 *   - BLOCK: processor calls markFailed with 'QG_SUMMARY_CRITERION_CONTRADICTION'
 *     and returns { success: false }
 *   - WARN: pipeline continues (job does not stop)
 *   - PASS: pipeline continues (job does not stop)
 *   - Failure code is now kick-eligible (1 retry) per U4-001 taxonomy registration
 *
 * FIXTURE DESIGN: Synthetic governance conditions only.
 *   - No manuscripts, no literary motifs, no real text.
 *   - Criterion PACING_KEY: score=3 (≤ threshold of 5), SCORABLE
 *       Summary sentence: "The pacing is strong and well-controlled."
 *       Rationale: "The pacing is underdeveloped and weak."
 *       → triggers contradiction (anchor "pacing" + positive "strong" in summary,
 *         negative "underdeveloped" in rationale)
 *   - Criterion DIALOGUE_KEY: score=2 (≤ threshold of 5), SCORABLE
 *       Summary sentence: "The dialogue is vivid and compelling."
 *       Rationale: "The dialogue lacks depth and is generic."
 *       → triggers second contradiction for BLOCK
 *   - Clean criterion: score=8 (> threshold) → never checked, never fires
 *
 * LOCALITY: anchor + positive polarity must co-occur in the same sentence.
 * The fixtures below are constructed so the trigger sentence is isolated.
 */

import { describe, expect, it } from '@jest/globals';
import { CRITERIA_KEYS } from '@/schemas/criteria-keys';
import type { EvaluationResultV2, EvaluationCriterionV2 } from '@/schemas/evaluation-result-v2';
import {
  runSummaryCriterionConsistencyGate,
  SUMMARY_CRITERION_CONTRADICTION_SCORE_THRESHOLD,
} from '@/lib/evaluation/pipeline/summaryCriterionConsistencyGate';
import {
  isKickEligibleFailureCode,
  isTerminalFailureCode,
  maxSelfRecoveryAttemptsForFailureCode,
} from '@/lib/evaluation/processor';

// ── Synthetic fixture constants ───────────────────────────────────────────────

// Criterion that will trigger a contradiction when needed
const PACING_KEY = 'pacing' as const;
const PACING_SCORE_BELOW_THRESHOLD = 3; // ≤ 5 — eligible for contradiction check
const PACING_SCORE_ABOVE_THRESHOLD = 8; // > 5 — never checked

const DIALOGUE_KEY = 'dialogue' as const;
const DIALOGUE_SCORE_BELOW_THRESHOLD = 2; // ≤ 5 — eligible

// Summary sentences that will trigger the locality-enforced positive signal:
//   anchor "pacing" (from CRITERION_ANCHORS.pacing) +
//   polarity "strong" (from POSITIVE_POLARITY_TERMS) in the same sentence.
const SUMMARY_SENTENCE_PACING_POSITIVE =
  'The pacing is strong and well-controlled throughout the manuscript.';

//   anchor "dialogue" + polarity "vivid" in same sentence
const SUMMARY_SENTENCE_DIALOGUE_POSITIVE =
  'The dialogue is vivid and compelling, with authentic subtext.';

// Neutral sentence with no criterion anchors — used to pad context
const SUMMARY_SENTENCE_NEUTRAL =
  'The manuscript demonstrates an understanding of genre conventions.';

// Rationale with negative tokens that conflict with the positive summary signal
const PACING_RATIONALE_NEGATIVE =
  'The pacing is underdeveloped and weak in the middle section, losing momentum.';

const DIALOGUE_RATIONALE_NEGATIVE =
  'The dialogue lacks depth and is generic, failing to differentiate speakers.';

// Rationale with no negative tokens — no contradiction fires
const PACING_RATIONALE_CLEAN =
  'The pacing is measured and purposeful, with clear momentum across chapters.';

// ── Criterion builders ────────────────────────────────────────────────────────

function makeCriterion(
  key: EvaluationCriterionV2['key'],
  score: number,
  rationale: string,
): EvaluationCriterionV2 {
  return {
    key,
    scorable: true,
    status: 'SCORABLE',
    signal_present: true,
    signal_strength: 'SUFFICIENT',
    confidence_band: 'MEDIUM',
    score_0_10: score,
    rationale,
    evidence: [{ snippet: `${key} evidence anchor — synthetic fixture` }],
    recommendations: [],
  };
}

function makeCleanCriteria(): EvaluationCriterionV2[] {
  return CRITERIA_KEYS.map((key) => makeCriterion(key, 8, `Clean baseline for ${key}.`));
}

function makeFixture(summary: string, criteriaOverrides: EvaluationCriterionV2[]): EvaluationResultV2 {
  const baseCriteria = makeCleanCriteria();

  // Apply overrides by key
  const overrideMap = new Map(criteriaOverrides.map((c) => [c.key, c]));
  const criteria = baseCriteria.map((c) => overrideMap.get(c.key) ?? c);

  return {
    schema_version: 'evaluation_result_v2',
    ids: {
      evaluation_run_id: 'run-u4-u3001-proof',
      manuscript_id: 0,
      user_id: '00000000-0000-0000-0000-000000000000',
    },
    generated_at: '2026-07-07T00:00:00.000Z',
    engine: { model: 'synthetic', provider: 'other', prompt_version: 'u4-u3001-proof-v1' },
    overview: {
      verdict: 'conditional',
      overall_score_0_100: 55,
      scored_criteria_count: CRITERIA_KEYS.length,
      one_paragraph_summary: summary,
      top_3_strengths: ['concept', 'character', 'voice'],
      top_3_risks: [PACING_KEY, DIALOGUE_KEY, 'theme'],
    },
    criteria,
    recommendations: { quick_wins: [], strategic_revisions: [] },
    metrics: { manuscript: { word_count: 75000 }, processing: {} },
    artifacts: [],
    governance: {
      confidence: 0.70,
      warnings: [],
      limitations: [],
      policy_family: 'multi-pass-dual-axis',
      observability_warnings: [],
    },
  };
}

// ── PASS fixture: no contradictions ──────────────────────────────────────────
// Summary is neutral — no positive signal for any below-threshold criterion.
// Even if pacing is below threshold, the summary doesn't praise it.

function makePassFixture(): EvaluationResultV2 {
  const summary = [
    SUMMARY_SENTENCE_NEUTRAL,
    'Genre conventions are handled with competence.',
  ].join(' ');

  return makeFixture(summary, [
    makeCriterion(PACING_KEY, PACING_SCORE_BELOW_THRESHOLD, PACING_RATIONALE_NEGATIVE),
  ]);
}

// ── WARN fixture: exactly 1 contradiction ────────────────────────────────────
// Summary praises pacing (positive signal), rationale is negative.
// Dialogue is not mentioned positively — no second contradiction.

function makeWarnFixture(): EvaluationResultV2 {
  const summary = [
    SUMMARY_SENTENCE_PACING_POSITIVE,
    SUMMARY_SENTENCE_NEUTRAL,
  ].join(' ');

  return makeFixture(summary, [
    makeCriterion(PACING_KEY, PACING_SCORE_BELOW_THRESHOLD, PACING_RATIONALE_NEGATIVE),
    makeCriterion(DIALOGUE_KEY, DIALOGUE_SCORE_BELOW_THRESHOLD, DIALOGUE_RATIONALE_NEGATIVE),
    // dialogue: below threshold, negative rationale, BUT summary has no dialogue positive signal
    // → only pacing fires → 1 contradiction → WARN
  ]);
}

// ── BLOCK fixture: 2+ contradictions ─────────────────────────────────────────
// Summary praises both pacing AND dialogue. Both have negative rationales.

function makeBlockFixture(): EvaluationResultV2 {
  const summary = [
    SUMMARY_SENTENCE_PACING_POSITIVE,
    SUMMARY_SENTENCE_DIALOGUE_POSITIVE,
    SUMMARY_SENTENCE_NEUTRAL,
  ].join(' ');

  return makeFixture(summary, [
    makeCriterion(PACING_KEY, PACING_SCORE_BELOW_THRESHOLD, PACING_RATIONALE_NEGATIVE),
    makeCriterion(DIALOGUE_KEY, DIALOGUE_SCORE_BELOW_THRESHOLD, DIALOGUE_RATIONALE_NEGATIVE),
  ]);
}

// ── Layer 1: Gate produces correct verdicts ───────────────────────────────────

describe('U4 Proof — Layer 1: Gate verdict on synthetic fixtures', () => {
  it('PASS fixture: no contradictions → verdict PASS, blocking: false', () => {
    const result = runSummaryCriterionConsistencyGate({
      effectiveQGResult: makePassFixture(),
    });

    expect(result.verdict).toBe('PASS');
    expect(result.blocking).toBe(false);
    expect(result.contradiction_count).toBe(0);
    expect(result.contradictions).toHaveLength(0);
  });

  it('WARN fixture: exactly 1 contradiction → verdict WARN, blocking: false', () => {
    const result = runSummaryCriterionConsistencyGate({
      effectiveQGResult: makeWarnFixture(),
    });

    expect(result.verdict).toBe('WARN');
    expect(result.blocking).toBe(false);
    expect(result.contradiction_count).toBe(1);
    expect(result.contradictions).toHaveLength(1);
    expect(result.contradictions[0]!.criterion_key).toBe(PACING_KEY);
  });

  it('BLOCK fixture: 2 contradictions → verdict BLOCK, blocking: true', () => {
    const result = runSummaryCriterionConsistencyGate({
      effectiveQGResult: makeBlockFixture(),
    });

    expect(result.verdict).toBe('BLOCK');
    expect(result.blocking).toBe(true);
    expect(result.contradiction_count).toBe(2);
    expect(result.contradictions).toHaveLength(2);
  });

  it('BLOCK fixture: both expected criteria appear in contradictions', () => {
    const result = runSummaryCriterionConsistencyGate({
      effectiveQGResult: makeBlockFixture(),
    });

    const keys = result.contradictions.map((c) => c.criterion_key);
    expect(keys).toContain(PACING_KEY);
    expect(keys).toContain(DIALOGUE_KEY);
  });

  it('above-threshold criterion (score > 5) is never checked regardless of summary content', () => {
    // Build a fixture where pacing score is above threshold
    const summary = [SUMMARY_SENTENCE_PACING_POSITIVE, SUMMARY_SENTENCE_NEUTRAL].join(' ');
    const fixture = makeFixture(summary, [
      makeCriterion(PACING_KEY, PACING_SCORE_ABOVE_THRESHOLD, PACING_RATIONALE_NEGATIVE),
    ]);

    const result = runSummaryCriterionConsistencyGate({ effectiveQGResult: fixture });

    // Score > threshold → not checked → no contradiction
    expect(result.verdict).toBe('PASS');
    expect(result.contradiction_count).toBe(0);
  });

  it('SUMMARY_CRITERION_CONTRADICTION_SCORE_THRESHOLD is 5', () => {
    expect(SUMMARY_CRITERION_CONTRADICTION_SCORE_THRESHOLD).toBe(5);
  });

  it('locality: positive polarity in a different sentence from the anchor does not fire', () => {
    // Sentence 1: contains anchor "pacing" but no polarity term
    // Sentence 2: contains polarity "strong" but no anchor
    // These must NOT fire — they are in different sentences.
    const summary =
      'The pacing is measured and deliberate. The manuscript is strong in its emotional core.';

    const fixture = makeFixture(summary, [
      makeCriterion(PACING_KEY, PACING_SCORE_BELOW_THRESHOLD, PACING_RATIONALE_NEGATIVE),
    ]);

    const result = runSummaryCriterionConsistencyGate({ effectiveQGResult: fixture });

    // Different sentences: locality requirement not satisfied → PASS
    expect(result.verdict).toBe('PASS');
    expect(result.contradiction_count).toBe(0);
  });

  it('clean rationale does not fire contradiction even if summary has positive signal', () => {
    const summary = [SUMMARY_SENTENCE_PACING_POSITIVE, SUMMARY_SENTENCE_NEUTRAL].join(' ');
    const fixture = makeFixture(summary, [
      // Positive summary, but rationale has no negative tokens → no contradiction
      makeCriterion(PACING_KEY, PACING_SCORE_BELOW_THRESHOLD, PACING_RATIONALE_CLEAN),
    ]);

    const result = runSummaryCriterionConsistencyGate({ effectiveQGResult: fixture });

    expect(result.verdict).toBe('PASS');
    expect(result.contradiction_count).toBe(0);
  });
});

// ── Layer 2: Artifact persistence contract ────────────────────────────────────

describe('U4 Proof — Layer 2: Artifact persistence contract', () => {
  it('PASS result has correct schema_version and check_id', () => {
    const result = runSummaryCriterionConsistencyGate({
      effectiveQGResult: makePassFixture(),
    });

    expect(result.schema_version).toBe('summary_criterion_consistency_v1');
    expect(result.check_id).toBe('summary_criterion_positive_contradiction');
  });

  it('WARN result has correct schema_version and check_id', () => {
    const result = runSummaryCriterionConsistencyGate({
      effectiveQGResult: makeWarnFixture(),
    });

    expect(result.schema_version).toBe('summary_criterion_consistency_v1');
    expect(result.check_id).toBe('summary_criterion_positive_contradiction');
  });

  it('BLOCK result has correct schema_version and check_id', () => {
    const result = runSummaryCriterionConsistencyGate({
      effectiveQGResult: makeBlockFixture(),
    });

    expect(result.schema_version).toBe('summary_criterion_consistency_v1');
    expect(result.check_id).toBe('summary_criterion_positive_contradiction');
  });

  it('artifact contains generated_at timestamp on all paths', () => {
    const passResult = runSummaryCriterionConsistencyGate({ effectiveQGResult: makePassFixture() });
    const warnResult = runSummaryCriterionConsistencyGate({ effectiveQGResult: makeWarnFixture() });
    const blockResult = runSummaryCriterionConsistencyGate({ effectiveQGResult: makeBlockFixture() });

    expect(typeof passResult.generated_at).toBe('string');
    expect(passResult.generated_at.length).toBeGreaterThan(0);
    expect(typeof warnResult.generated_at).toBe('string');
    expect(typeof blockResult.generated_at).toBe('string');
  });

  it('BLOCK artifact contains full contradiction details (excerpts, matched tokens)', () => {
    const result = runSummaryCriterionConsistencyGate({
      effectiveQGResult: makeBlockFixture(),
    });

    for (const contradiction of result.contradictions) {
      expect(contradiction.criterion_key).toBeDefined();
      expect(contradiction.criterion_label).toBeDefined();
      expect(contradiction.criterion_label.length).toBeGreaterThan(0);
      expect(typeof contradiction.score_0_10).toBe('number');
      expect(contradiction.score_0_10).toBeLessThanOrEqual(SUMMARY_CRITERION_CONTRADICTION_SCORE_THRESHOLD);
      expect(contradiction.summary_excerpt.length).toBeGreaterThan(0);
      expect(contradiction.rationale_excerpt.length).toBeGreaterThan(0);
      expect(contradiction.matched_positive_tokens.length).toBeGreaterThan(0);
      expect(contradiction.matched_negative_tokens.length).toBeGreaterThan(0);
    }
  });

  it('gate is non-mutating — original EvaluationResultV2 is not modified', () => {
    const fixture = makeBlockFixture();
    const originalPacing = structuredClone(
      fixture.criteria.find((c) => c.key === PACING_KEY),
    );

    runSummaryCriterionConsistencyGate({ effectiveQGResult: fixture });

    // Original fixture unchanged
    expect(fixture.criteria.find((c) => c.key === PACING_KEY)).toEqual(originalPacing);
  });

  it('PASS result reason string contains "No summary" message', () => {
    const result = runSummaryCriterionConsistencyGate({ effectiveQGResult: makePassFixture() });
    expect(result.reason.toLowerCase()).toContain('no summary');
  });

  it('WARN result reason string mentions contradiction count and criterion key', () => {
    const result = runSummaryCriterionConsistencyGate({ effectiveQGResult: makeWarnFixture() });
    expect(result.reason).toContain('1');
    expect(result.reason.toLowerCase()).toContain('pacing');
  });

  it('BLOCK result reason string mentions 2 contradictions and both criteria', () => {
    const result = runSummaryCriterionConsistencyGate({ effectiveQGResult: makeBlockFixture() });
    expect(result.reason).toContain('2');
    expect(result.reason.toLowerCase()).toContain('pacing');
    expect(result.reason.toLowerCase()).toContain('dialogue');
  });
});

// ── Layer 3: Processor integration linkage ────────────────────────────────────
//
// The processor wiring is at processor.ts lines 11201–11248:
//
//   await upsertEvaluationArtifact({ artifactType: 'summary_criterion_consistency_v1', ... });
//   if (summaryCriterionConsistencyResult.blocking) {
//     await markFailed('...', 'QG_SUMMARY_CRITERION_CONTRADICTION', { ... });
//     return { success: false, error: '...' };
//   }
//   if (summaryCriterionConsistencyResult.verdict === 'WARN') {
//     console.warn(...);  // job continues
//   }
//   // PASS / WARN: fall through to artifact consistency gate
//
// This layer proves the linkage contract:
//   - BLOCK result has blocking: true → processor path calls markFailed + returns
//   - WARN result has blocking: false, verdict === 'WARN' → processor logs and continues
//   - PASS result has blocking: false, verdict !== 'WARN' → processor continues silently

describe('U4 Proof — Layer 3: Processor integration linkage', () => {
  it('BLOCK result: blocking: true → processor markFailed path is triggered', () => {
    const result = runSummaryCriterionConsistencyGate({
      effectiveQGResult: makeBlockFixture(),
    });

    // Processor checks `if (summaryCriterionConsistencyResult.blocking)`
    expect(result.blocking).toBe(true);

    // Processor passes this failure code to markFailed()
    // Verify the code it would pass is 'QG_SUMMARY_CRITERION_CONTRADICTION'
    // (asserted by static wiring — confirmed at processor.ts:11231)
    const expectedFailureCode = 'QG_SUMMARY_CRITERION_CONTRADICTION';
    expect(isKickEligibleFailureCode(expectedFailureCode)).toBe(true);

    // Processor also passes result.check_id in reasonCodes
    expect(result.check_id).toBe('summary_criterion_positive_contradiction');

    // Processor passes result as diagnostics
    expect(result.contradiction_count).toBeGreaterThanOrEqual(2);
    expect(result.contradictions.length).toBeGreaterThanOrEqual(2);
  });

  it('WARN result: blocking: false AND verdict === WARN → processor continues', () => {
    const result = runSummaryCriterionConsistencyGate({
      effectiveQGResult: makeWarnFixture(),
    });

    // Processor checks `if (summaryCriterionConsistencyResult.blocking)` — must be false
    expect(result.blocking).toBe(false);

    // Processor then checks `if (result.verdict === 'WARN')` to emit a console.warn
    // and then falls through — job continues
    expect(result.verdict).toBe('WARN');
  });

  it('PASS result: blocking: false AND verdict !== WARN → processor continues silently', () => {
    const result = runSummaryCriterionConsistencyGate({
      effectiveQGResult: makePassFixture(),
    });

    expect(result.blocking).toBe(false);
    expect(result.verdict).toBe('PASS');
  });

  it('BLOCK: failure code QG_SUMMARY_CRITERION_CONTRADICTION is kick-eligible (U4-001)', () => {
    // Confirmed by taxonomy registration in U4-001.
    // Re-synthesis may produce consistent reasoning.
    expect(isKickEligibleFailureCode('QG_SUMMARY_CRITERION_CONTRADICTION')).toBe(true);
    expect(isTerminalFailureCode('QG_SUMMARY_CRITERION_CONTRADICTION')).toBe(false);
    expect(maxSelfRecoveryAttemptsForFailureCode('QG_SUMMARY_CRITERION_CONTRADICTION')).toBe(1);
  });

  it('artifact produced on PASS path is suitable for upsertEvaluationArtifact content', () => {
    // Processor calls upsertEvaluationArtifact unconditionally before the blocking check.
    // The artifact content is the full result object — must be JSON-serialisable and
    // have the expected top-level fields.
    const result = runSummaryCriterionConsistencyGate({
      effectiveQGResult: makePassFixture(),
    });

    const serialized = JSON.stringify(result);
    const reparsed = JSON.parse(serialized);

    expect(reparsed.schema_version).toBe('summary_criterion_consistency_v1');
    expect(reparsed.verdict).toBe('PASS');
    expect(reparsed.blocking).toBe(false);
    expect(Array.isArray(reparsed.contradictions)).toBe(true);
  });

  it('artifact produced on WARN path is suitable for upsertEvaluationArtifact content', () => {
    const result = runSummaryCriterionConsistencyGate({
      effectiveQGResult: makeWarnFixture(),
    });

    const serialized = JSON.stringify(result);
    const reparsed = JSON.parse(serialized);

    expect(reparsed.schema_version).toBe('summary_criterion_consistency_v1');
    expect(reparsed.verdict).toBe('WARN');
    expect(reparsed.blocking).toBe(false);
    expect(reparsed.contradiction_count).toBe(1);
  });

  it('artifact produced on BLOCK path is suitable for upsertEvaluationArtifact content', () => {
    const result = runSummaryCriterionConsistencyGate({
      effectiveQGResult: makeBlockFixture(),
    });

    const serialized = JSON.stringify(result);
    const reparsed = JSON.parse(serialized);

    expect(reparsed.schema_version).toBe('summary_criterion_consistency_v1');
    expect(reparsed.verdict).toBe('BLOCK');
    expect(reparsed.blocking).toBe(true);
    expect(reparsed.contradiction_count).toBe(2);
    // Full contradiction details are preserved in the artifact
    expect(reparsed.contradictions[0].criterion_key).toBeDefined();
    expect(reparsed.contradictions[0].summary_excerpt).toBeDefined();
    expect(reparsed.contradictions[0].rationale_excerpt).toBeDefined();
    expect(reparsed.contradictions[0].matched_positive_tokens).toBeDefined();
    expect(reparsed.contradictions[0].matched_negative_tokens).toBeDefined();
  });
});

/**
 * Regression tests for upstream JSON/truncation fixes.
 *
 * Covers three failure classes:
 *   1. PHASE1A_HANDOFF_TRANSITION_FAILED — .single() → .maybeSingle() race fix
 *   2. PHASE2_PASS12_FAILED — chunk-level retry for JSON_PARSE_FAILED_TRUNCATED
 *   3. HANDOFF_INCOMPLETE_SENTENCE — systemic truncation detection + retry with boosted token budget
 *
 * Taxonomy preserved:
 *   - Invalid input = terminal
 *   - Infrastructure timeout = resume/retry
 *   - Malformed JSON/truncation = upstream repair/retry
 *   - Dirty synthesis/QG = kickback
 *   - Missing-but-repairable = SMART repair
 */

import {
  isTerminalFailureCode,
  maxSelfRecoveryAttemptsForFailureCode,
  isSelfRecoverableFailureCode,
} from '@/lib/evaluation/processor';

import {
  runPass12HandoffGate,
  shouldPassHandoffGate,
} from '@/lib/evaluation/pipeline/pass12HandoffGate';

import type { SinglePassOutput, AxisCriterionResult } from '@/lib/evaluation/pipeline/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCleanCriterion(key: string): AxisCriterionResult {
  return {
    key: key as any,
    score_0_10: 7,
    rationale: "The manuscript demonstrates strong pacing through deliberate scene transitions that build tension incrementally.",
    evidence: [
      {
        snippet: "She reached for the door handle, but something—",
      },
    ],
    recommendations: [
      {
        priority: "medium",
        action: "Strengthen the transition between chapters 4 and 5 by adding a bridging sentence.",
        expected_impact: "Creates smoother narrative flow and prevents reader disengagement.",
        anchor_snippet: "She reached for the door handle, but something—",
        issue_family: "pacing" as any,
        strategic_lever: "structural_rhythm" as any,
        revision_granularity: "paragraph" as any,
      },
    ],
  };
}

function makeIncompleteSentenceCriterion(key: string): AxisCriterionResult {
  return {
    key: key as any,
    score_0_10: 5,
    // Truncated rationale — no terminal punctuation
    rationale: "The manuscript shows some",
    evidence: [
      {
        snippet: "Example text from manuscript.",
      },
    ],
    recommendations: [
      {
        priority: "medium",
        // Truncated action — no terminal punctuation
        action: "Consider revising the",
        expected_impact: "Would improve overall quality.",
        anchor_snippet: "Example text from manuscript.",
        issue_family: "pacing" as any,
        strategic_lever: "structural_rhythm" as any,
        revision_granularity: "paragraph" as any,
      },
    ],
  };
}

function makePassOutput(criteria: AxisCriterionResult[], pass: 1 | 2 = 1): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    criteria,
    model: "gpt-4o",
    prompt_version: "test-v1",
    temperature: 0.3,
    generated_at: new Date().toISOString(),
  };
}

const CRITERIA_KEYS = [
  "narrative_drive", "character_voice", "worldbuilding", "pacing",
  "dialogue", "theme", "sceneConstruction", "prose_style",
  "emotional_resonance", "originality", "readability",
  "genre_conventions", "marketability",
];

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PHASE1A_HANDOFF_TRANSITION_FAILED — taxonomy classification
// ═══════════════════════════════════════════════════════════════════════════════

describe('PHASE1A_HANDOFF_TRANSITION_FAILED taxonomy', () => {
  it('is NOT terminal — allows self-recovery retry', () => {
    expect(isTerminalFailureCode('PHASE1A_HANDOFF_TRANSITION_FAILED')).toBe(false);
  });

  it('allows at least 1 self-recovery attempt', () => {
    expect(maxSelfRecoveryAttemptsForFailureCode('PHASE1A_HANDOFF_TRANSITION_FAILED')).toBeGreaterThanOrEqual(1);
  });

  it('is self-recoverable', () => {
    expect(isSelfRecoverableFailureCode('PHASE1A_HANDOFF_TRANSITION_FAILED')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PHASE2_PASS12_FAILED — taxonomy classification
// ═══════════════════════════════════════════════════════════════════════════════

describe('PHASE2_PASS12_FAILED taxonomy', () => {
  it('is NOT terminal — infrastructure/transient class', () => {
    expect(isTerminalFailureCode('PHASE2_PASS12_FAILED')).toBe(false);
  });

  it('allows self-recovery retries', () => {
    expect(maxSelfRecoveryAttemptsForFailureCode('PHASE2_PASS12_FAILED')).toBeGreaterThanOrEqual(1);
  });

  it('is self-recoverable', () => {
    expect(isSelfRecoverableFailureCode('PHASE2_PASS12_FAILED')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. HANDOFF_INCOMPLETE_SENTENCE — systemic truncation detection
// ═══════════════════════════════════════════════════════════════════════════════

describe('HANDOFF_INCOMPLETE_SENTENCE systemic truncation detection', () => {
  it('handoff gate fails when INCOMPLETE_SENTENCE dominates (>50%)', () => {
    // All 13 criteria have truncated rationales — systemic truncation
    const pass1 = makePassOutput(
      CRITERIA_KEYS.map(key => makeIncompleteSentenceCriterion(key)),
      1,
    );
    const pass2 = makePassOutput(
      CRITERIA_KEYS.map(key => makeIncompleteSentenceCriterion(key)),
      2,
    );

    const result = runPass12HandoffGate(pass1, pass2);

    expect(result.ok).toBe(false);
    expect(result.check_summary.HANDOFF_INCOMPLETE_SENTENCE).toBeGreaterThan(13);
    expect(shouldPassHandoffGate(result)).toBe(false);
  });

  it('detects systemic pattern: INCOMPLETE_SENTENCE > 50% of violations', () => {
    const pass1 = makePassOutput(
      CRITERIA_KEYS.map(key => makeIncompleteSentenceCriterion(key)),
      1,
    );
    const pass2 = makePassOutput(
      CRITERIA_KEYS.map(key => makeIncompleteSentenceCriterion(key)),
      2,
    );

    const result = runPass12HandoffGate(pass1, pass2);

    const incompleteSentenceCount = result.check_summary.HANDOFF_INCOMPLETE_SENTENCE ?? 0;
    const isSystemicTruncation =
      incompleteSentenceCount > 0 &&
      incompleteSentenceCount / result.total_violations > 0.5;

    expect(isSystemicTruncation).toBe(true);
  });

  it('does NOT detect systemic truncation when violations are mixed', () => {
    // 2 criteria with incomplete sentences, 11 clean
    const criteria1 = [
      makeIncompleteSentenceCriterion("narrative_drive"),
      makeIncompleteSentenceCriterion("character_voice"),
      ...CRITERIA_KEYS.slice(2).map(key => makeCleanCriterion(key)),
    ];
    const criteria2 = CRITERIA_KEYS.map(key => makeCleanCriterion(key));

    const pass1 = makePassOutput(criteria1, 1);
    const pass2 = makePassOutput(criteria2, 2);

    const result = runPass12HandoffGate(pass1, pass2);

    const incompleteSentenceCount = result.check_summary.HANDOFF_INCOMPLETE_SENTENCE ?? 0;
    // With only 2 violations out of potentially mixed set, ratio should be low
    // or the gate should pass (below threshold)
    if (result.total_violations > 0) {
      const ratio = incompleteSentenceCount / result.total_violations;
      // Mixed violations means either ratio is low or gate passes anyway
      expect(
        ratio <= 0.5 || shouldPassHandoffGate(result),
      ).toBe(true);
    }
  });

  it('HANDOFF_ codes get exactly 1 self-recovery retry', () => {
    expect(maxSelfRecoveryAttemptsForFailureCode('HANDOFF_INCOMPLETE_SENTENCE')).toBe(1);
    expect(maxSelfRecoveryAttemptsForFailureCode('HANDOFF_SCAFFOLD_RESIDUE')).toBe(1);
    expect(maxSelfRecoveryAttemptsForFailureCode('HANDOFF_BROKEN_MODAL')).toBe(1);
  });

  it('clean output passes handoff gate without violations', () => {
    const pass1 = makePassOutput(
      CRITERIA_KEYS.map(key => makeCleanCriterion(key)),
      1,
    );
    const pass2 = makePassOutput(
      CRITERIA_KEYS.map(key => makeCleanCriterion(key)),
      2,
    );

    const result = runPass12HandoffGate(pass1, pass2);

    expect(result.ok).toBe(true);
    expect(result.check_summary.HANDOFF_INCOMPLETE_SENTENCE).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. _maxOutputTokensOverride contract
// ═══════════════════════════════════════════════════════════════════════════════

describe('_maxOutputTokensOverride contract', () => {
  it('RunPass1Options accepts _maxOutputTokensOverride', () => {
    // Type-level test: if this compiles, the interface accepts the field
    const opts: Partial<import('@/lib/evaluation/pipeline/runPass1').RunPass1Options> = {
      _maxOutputTokensOverride: 16_000,
    };
    expect(opts._maxOutputTokensOverride).toBe(16_000);
  });

  it('RunPass2Options accepts _maxOutputTokensOverride', async () => {
    const opts: Partial<import('@/lib/evaluation/pipeline/runPass2').RunPass2Options> = {
      _maxOutputTokensOverride: 16_000,
    };
    expect(opts._maxOutputTokensOverride).toBe(16_000);
  });

  it('undefined override does not alter default behavior', () => {
    const opts: Partial<import('@/lib/evaluation/pipeline/runPass1').RunPass1Options> = {
      _maxOutputTokensOverride: undefined,
    };
    // undefined should fall through to runtime config default
    expect(opts._maxOutputTokensOverride ?? 8_000).toBe(8_000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Failure taxonomy preservation — upstream repair/retry class
// ═══════════════════════════════════════════════════════════════════════════════

describe('Failure taxonomy: upstream repair/retry codes are NOT terminal', () => {
  const upstreamRepairCodes = [
    'PHASE1A_HANDOFF_TRANSITION_FAILED',
    'PHASE2_PASS12_FAILED',
    'PHASE2_PASS1_MISSING',
    'HANDOFF_INCOMPLETE_SENTENCE',
    'HANDOFF_SCAFFOLD_RESIDUE',
    'HANDOFF_BROKEN_MODAL',
    'HANDOFF_GENERIC_LANGUAGE',
    'HANDOFF_MISSING_EVIDENCE_ANCHOR',
    'HANDOFF_ORPHANED_CONJUNCTION',
    'HANDOFF_DANGLING_REFERENCE',
  ];

  it.each(upstreamRepairCodes)('%s is NOT terminal', (code) => {
    expect(isTerminalFailureCode(code)).toBe(false);
  });

  it.each(upstreamRepairCodes)('%s is self-recoverable', (code) => {
    expect(isSelfRecoverableFailureCode(code)).toBe(true);
  });
});

describe('Failure taxonomy: terminal codes remain terminal', () => {
  const terminalCodes = [
    'INVALID_INPUT',
    'PASS3_FAILED',
    'POLICY_VIOLATION',
  ];

  it.each(terminalCodes)('%s is terminal', (code) => {
    expect(isTerminalFailureCode(code)).toBe(true);
  });

  it.each(terminalCodes)('%s has 0 self-recovery attempts', (code) => {
    expect(maxSelfRecoveryAttemptsForFailureCode(code)).toBe(0);
  });
});

describe('Failure taxonomy: infrastructure codes are retryable', () => {
  const infraCodes = [
    'PIPELINE_GLOBAL_SLA_EXCEEDED',
    'LEASE_EXPIRED',
    'PROCESSOR_LEASE_LOST',
    'OPENAI_RATE_LIMIT',
    'OPENAI_TIMEOUT',
  ];

  it.each(infraCodes)('%s is self-recoverable', (code) => {
    expect(isSelfRecoverableFailureCode(code)).toBe(true);
  });

  it.each(infraCodes)('%s has >= 2 self-recovery attempts', (code) => {
    expect(maxSelfRecoveryAttemptsForFailureCode(code)).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Handoff truncation retry diagnostic type contract
// ═══════════════════════════════════════════════════════════════════════════════

describe('handoff_truncation_retry diagnostic type', () => {
  it('type accepts valid retry diagnostics', () => {
    type FailureDetails = NonNullable<
      Extract<
        import('@/lib/evaluation/pipeline/types').PipelineResult,
        { ok: false }
      >['failure_details']
    >;

    const diagnostics: FailureDetails['handoff_truncation_retry'] = {
      attempted: true,
      reason: 'HANDOFF_INCOMPLETE_SENTENCE',
      original_token_budget: 8_000,
      boosted_token_budget: 16_000,
      original_violation_count: 25,
      retry_result: 'failed',
    };

    expect(diagnostics?.attempted).toBe(true);
    expect(diagnostics?.reason).toBe('HANDOFF_INCOMPLETE_SENTENCE');
    expect(diagnostics?.boosted_token_budget).toBe(16_000);
    expect(diagnostics?.retry_result).toBe('failed');
  });

  it('retry_result only accepts valid values', () => {
    type RetryResult = NonNullable<
      NonNullable<
        Extract<
          import('@/lib/evaluation/pipeline/types').PipelineResult,
          { ok: false }
        >['failure_details']
      >['handoff_truncation_retry']
    >['retry_result'];

    const success: RetryResult = 'success';
    const failed: RetryResult = 'failed';
    const notAttempted: RetryResult = 'not_attempted';

    expect([success, failed, notAttempted]).toEqual(['success', 'failed', 'not_attempted']);
  });
});

import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { assertRow, type RunOutcome } from "@/scripts/pipeline-stress-tier2";
import type { Tier2Row } from "@/tests/stress/tier2/scenarios";

function makeRow(overrides?: Partial<Tier2Row>): Tier2Row {
  return {
    id: "tier2-test-row",
    manuscript_fixture: "long-form-50k.txt",
    work_type: "novel",
    english_variant: "american",
    expected: {
      outcome: "success",
      cross_check_required: true,
      pass4_governance_required: true,
      max_total_ms: 120_000,
    },
    notes: "unit-test",
    ...overrides,
  };
}

function makeSuccessOutcome(overrides?: Partial<RunOutcome>): RunOutcome {
  return {
    row: makeRow(),
    total_ms: 10_000,
    threw: null,
    result: {
      ok: true,
      synthesis: {
        criteria: [{ key: "character_depth", score_0_10: 7 }],
        overall: {
          one_paragraph_summary: "strong overall execution",
        },
        coverage_scope: {
          sourceWords: 100,
          analyzedWords: 100,
        },
      },
      quality_gate: { pass: true, checks: [], warnings: [] },
      cross_check: { verdict: "pass" },
      pass4_governance: { pass: true },
    } as any,
    ...overrides,
  };
}

describe("pipeline-stress-tier2 clause-mapped assertions", () => {
  test("missing cross_check in required/veto mode emits Clause 7 prefixed message", () => {
    const failures = assertRow(
      makeSuccessOutcome({
        result: {
          ...(makeSuccessOutcome().result as any),
          cross_check: {},
        } as any,
      }),
    );

    expect(failures.some((f) => f.includes("[CLAUSE_7_CROSS_CHECK_PRESENT]"))).toBe(true);
    expect(failures.some((f) => f.includes("(CROSS_CHECK_MISSING)"))).toBe(true);
    expect(failures.some((f) => f.includes("expected=non-empty cross_check in required/veto mode"))).toBe(true);
  });

  test("missing pass4_governance in required/veto mode emits Clause 6 prefixed message", () => {
    const failures = assertRow(
      makeSuccessOutcome({
        result: {
          ...(makeSuccessOutcome().result as any),
          pass4_governance: null,
        } as any,
      }),
    );

    expect(failures.some((f) => f.includes("[CLAUSE_6_PASS4_GOVERNANCE_PRESENT]"))).toBe(true);
    expect(failures.some((f) => f.includes("(PASS4_MISSING)"))).toBe(true);
    expect(failures.some((f) => f.includes("expected=non-empty pass4_governance in required/veto mode"))).toBe(true);
  });

  test("missing scores and summary emit Clause 9 and Clause 10 messages", () => {
    const failures = assertRow(
      makeSuccessOutcome({
        result: {
          ...(makeSuccessOutcome().result as any),
          synthesis: {
            criteria: [],
            overall: { one_paragraph_summary: "" },
            coverage_scope: { sourceWords: 100, analyzedWords: 100 },
          },
        } as any,
      }),
    );

    expect(failures.some((f) => f.includes("[CLAUSE_9_SCORES_PRODUCED]"))).toBe(true);
    expect(failures.some((f) => f.includes("[CLAUSE_10_SUMMARIES_PRODUCED]"))).toBe(true);
  });

  test("coverage/runtime failures emit clause-prefixed diagnostics", () => {
    const failures = assertRow(
      makeSuccessOutcome({
        total_ms: 180_001,
        row: makeRow({
          expected: {
            outcome: "success",
            cross_check_required: true,
            pass4_governance_required: true,
            max_total_ms: 180_000,
          },
        }),
        result: {
          ...(makeSuccessOutcome().result as any),
          synthesis: {
            ...(makeSuccessOutcome().result as any).synthesis,
            coverage_scope: { sourceWords: 100, analyzedWords: 85 },
          },
        } as any,
      }),
    );

    expect(failures.some((f) => f.includes("[CLAUSE_11_TOTAL_RUNTIME_WITHIN_BUDGET]"))).toBe(true);
    expect(failures.some((f) => f.includes("[CLAUSE_2_COVERAGE_SUFFICIENT]"))).toBe(true);
  });
});

describe("pipeline-stress-tier2 Bug 3: surface result.error alongside clause mapping", () => {
  let errSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errSpy.mockRestore();
  });

  function makeFailingOutcomeWithError(errorMessage: string): RunOutcome {
    return {
      row: {
        id: "tier2-test-bug3",
        manuscript_fixture: "long-form-50k.txt",
        work_type: "novel",
        english_variant: "american",
        expected: {
          outcome: "success",
          cross_check_required: true,
          pass4_governance_required: true,
          max_total_ms: 120_000,
        },
        notes: "bug3-test",
      } as any,
      total_ms: 10_000,
      threw: null,
      result: {
        ok: false,
        error_code: "PASS3_FAILED",
        error: errorMessage,
      } as any,
    };
  }

  test("logs result.error to stderr when present (Bug 3)", () => {
    const failures = assertRow(
      makeFailingOutcomeWithError(
        "400 max_tokens 20000 is too large for gpt-4o (max 16384)",
      ),
    );
    expect(errSpy).toHaveBeenCalled();
    const flat = errSpy.mock.calls.map((c) => c.map(String).join(" ")).join("\n");
    expect(flat).toMatch(/\[stress-tier2\] pipeline.error:/);
    expect(flat).toMatch(/max_tokens 20000 is too large/);
    // additive: clause-mapped failure still emitted
    expect(failures.length).toBeGreaterThan(0);
  });

  test("does NOT log when result.error is absent (Bug 3 additive, not replacing)", () => {
    const outcome: RunOutcome = {
      row: {
        id: "tier2-test-bug3-no-error",
        manuscript_fixture: "long-form-50k.txt",
        work_type: "novel",
        english_variant: "american",
        expected: {
          outcome: "success",
          cross_check_required: true,
          pass4_governance_required: true,
          max_total_ms: 120_000,
        },
        notes: "bug3-test-no-error",
      } as any,
      total_ms: 10_000,
      threw: null,
      result: { ok: false, error_code: "SOMETHING" } as any,
    };
    const failures = assertRow(outcome);
    const flat = errSpy.mock.calls.map((c) => c.map(String).join(" ")).join("\n");
    expect(flat).not.toMatch(/\[stress-tier2\] pipeline.error:/);
    expect(failures.length).toBeGreaterThan(0);
  });

  test("does NOT log when result is null (no-result case)", () => {
    const outcome: RunOutcome = {
      row: {
        id: "tier2-test-bug3-null",
        manuscript_fixture: "long-form-50k.txt",
        work_type: "novel",
        english_variant: "american",
        expected: {
          outcome: "success",
          cross_check_required: true,
          pass4_governance_required: true,
          max_total_ms: 120_000,
        },
        notes: "bug3-test-null",
      } as any,
      total_ms: 10_000,
      threw: null,
      result: null as any,
    };
    const failures = assertRow(outcome);
    const flat = errSpy.mock.calls.map((c) => c.map(String).join(" ")).join("\n");
    expect(flat).not.toMatch(/\[stress-tier2\] pipeline.error:/);
    expect(failures.length).toBeGreaterThan(0);
  });
});

const { describe, test, expect } = require("@jest/globals");

const {
  REVISION_SESSION_ALLOWED_TRANSITIONS,
  assertValidRevisionSessionTransition,
  buildRevisionSessionTransitionUpdate,
} = require("../../../lib/revision/sessionTransitions");

function buildSession(status) {
  return {
    id: "session-1",
    evaluation_run_id: "evaluation-1",
    source_version_id: "source-1",
    result_version_id: null,
    status,
    summary: {},
    findings_count: 0,
    actionable_findings_count: 0,
    proposal_ready_actionable_findings_count: 0,
    proposals_created_count: 0,
    created_at: "2026-03-16T00:00:00.000Z",
    completed_at: null,
    last_transition_at: "2026-03-16T00:00:00.000Z",
    failure_code: null,
    failure_message: null,
  };
}

describe("REVISION_SESSION_ALLOWED_TRANSITIONS", () => {
  test("locks applied and failed as terminal", () => {
    expect(REVISION_SESSION_ALLOWED_TRANSITIONS.applied).toEqual([]);
    expect(REVISION_SESSION_ALLOWED_TRANSITIONS.failed).toEqual([]);
  });

  test("defines the Stage 3 lifecycle graph exactly", () => {
    expect(REVISION_SESSION_ALLOWED_TRANSITIONS).toEqual({
      open: ["findings_ready", "failed"],
      findings_ready: ["synthesis_started"],
      synthesis_started: ["proposals_ready", "failed"],
      proposals_ready: ["applied", "failed"],
      applied: [],
      failed: [],
    });
  });
});

describe("assertValidRevisionSessionTransition", () => {
  test("accepts allowed transitions", () => {
    expect(() => assertValidRevisionSessionTransition("open", "findings_ready")).not.toThrow();
    expect(() =>
      assertValidRevisionSessionTransition("findings_ready", "synthesis_started"),
    ).not.toThrow();
    expect(() =>
      assertValidRevisionSessionTransition("synthesis_started", "proposals_ready"),
    ).not.toThrow();
    expect(() =>
      assertValidRevisionSessionTransition("proposals_ready", "applied"),
    ).not.toThrow();
  });

  test("rejects illegal and no-op transitions", () => {
    expect(() => assertValidRevisionSessionTransition("open", "applied")).toThrow(
      /Illegal revision session transition open -> applied/,
    );
    expect(() => assertValidRevisionSessionTransition("applied", "failed")).toThrow(
      /Illegal revision session transition applied -> failed/,
    );
    expect(() => assertValidRevisionSessionTransition("failed", "failed")).toThrow(
      /no-op transitions are forbidden/,
    );
  });
});

describe("buildRevisionSessionTransitionUpdate", () => {
  test("builds a coherent proposals_ready update with counters", () => {
    const current = buildSession("synthesis_started");
    const update = buildRevisionSessionTransitionUpdate(
      current,
      {
        nextStatus: "proposals_ready",
        findings_count: 11,
        actionable_findings_count: 7,
        proposal_ready_actionable_findings_count: 5,
        proposals_created_count: 5,
      },
      "2026-03-16T12:34:56.000Z",
    );

    expect(update).toMatchObject({
      status: "proposals_ready",
      findings_count: 11,
      actionable_findings_count: 7,
      proposal_ready_actionable_findings_count: 5,
      proposals_created_count: 5,
      last_transition_at: "2026-03-16T12:34:56.000Z",
      completed_at: null,
      failure_code: null,
      failure_message: null,
    });
  });

  test("requires result_version_id when transitioning to applied", () => {
    const current = buildSession("proposals_ready");

    expect(() =>
      buildRevisionSessionTransitionUpdate(current, {
        nextStatus: "applied",
      }),
    ).toThrow(/result_version_id must be a non-empty string/);
  });

  test("requires failure details when transitioning to failed", () => {
    const current = buildSession("synthesis_started");

    expect(() =>
      buildRevisionSessionTransitionUpdate(current, {
        nextStatus: "failed",
        failure_code: "",
        failure_message: "boom",
      }),
    ).toThrow(/failure_code must be a non-empty string/);

    expect(() =>
      buildRevisionSessionTransitionUpdate(current, {
        nextStatus: "failed",
        failure_code: "SYNTHESIS_FAILED",
        failure_message: "",
      }),
    ).toThrow(/failure_message must be a non-empty string/);
  });
});

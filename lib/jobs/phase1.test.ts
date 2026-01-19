// lib/jobs/phase1.test.ts
// Use CommonJS require so Jest (CJS mode) can execute this file.
const { PHASE_1_STATES, canTransitionPhase1 } = require("./phase1");

describe("Phase 1 state machine", () => {
  const { NOT_STARTED, RUNNING, COMPLETED, FAILED } = PHASE_1_STATES;

  const cases = [
    // allowed
    [NOT_STARTED, RUNNING, true],
    [RUNNING, COMPLETED, true],
    [RUNNING, FAILED, true],
    [FAILED, RUNNING, true],

    // disallowed
    [NOT_STARTED, COMPLETED, false],
    [NOT_STARTED, FAILED, false],
    [RUNNING, NOT_STARTED, false],
    [FAILED, COMPLETED, false],
    [COMPLETED, RUNNING, false],
    [COMPLETED, FAILED, false],
    [COMPLETED, NOT_STARTED, false],
  ];

  it.each(cases)(
    "canTransitionPhase1(%s → %s) === %s",
    (from, to, expected) => {
      expect(canTransitionPhase1(from, to)).toBe(expected);
    }
  );
});

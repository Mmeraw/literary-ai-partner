// lib/jobs/phase1.test.ts
// Use CommonJS require so Jest (CJS mode) can execute this file.
const { PHASE_1_STATES, canTransitionPhase1 } = require("./phase1");

describe("Phase 1 state machine", () => {
  const { QUEUED, RUNNING, COMPLETED, FAILED } = PHASE_1_STATES;

  const cases = [
    // allowed
    [QUEUED, RUNNING, true],
    [RUNNING, COMPLETED, true],
    [RUNNING, FAILED, true],
    [FAILED, RUNNING, true],

    // disallowed
    [QUEUED, COMPLETED, false],
    [QUEUED, FAILED, false],
    [RUNNING, QUEUED, false],
    [FAILED, COMPLETED, false],
    [COMPLETED, RUNNING, false],
    [COMPLETED, FAILED, false],
    [COMPLETED, QUEUED, false],
  ];

  it.each(cases)(
    "canTransitionPhase1(%s → %s) === %s",
    (from, to, expected) => {
      expect(canTransitionPhase1(from, to)).toBe(expected);
    }
  );
});

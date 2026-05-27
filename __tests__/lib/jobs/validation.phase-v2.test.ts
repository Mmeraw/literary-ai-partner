export {};

import { validateProgressForPhase } from "../../../lib/jobs/validation";
import { JOB_STATUS, PHASES, type Job } from "../../../lib/jobs/types";

function makeJob(phase: string, phaseStatus: string = JOB_STATUS.QUEUED): Job {
  return {
    id: "job-1",
    user_id: "user-1",
    manuscript_id: 1,
    job_type: "evaluate_full",
    status: JOB_STATUS.RUNNING,
    validity_status: "pending",
    progress: {
      phase: phase as Job["progress"]["phase"],
      phase_status: phaseStatus as Job["progress"]["phase_status"],
      total_units: null,
      completed_units: null,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_heartbeat: null,
  };
}

describe("validateProgressForPhase phase-v2 awareness", () => {
  test.each([
    PHASES.PHASE_0,
    PHASES.REVIEW_GATE,
    PHASES.PHASE_3,
    PHASES.WAVE_REVISION,
  ])("accepts canonical non-counter phase %s", (phase) => {
    expect(validateProgressForPhase(makeJob(phase))).toBeNull();
  });

  test("rejects unknown phase", () => {
    expect(validateProgressForPhase(makeJob("phase_x"))).toBe("phase_unknown");
  });
});

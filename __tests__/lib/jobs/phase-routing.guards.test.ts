import { canRunPhase } from "../../../lib/jobs/store";
import { PHASES } from "../../../lib/jobs/types";
import { selectEligibleJobs } from "../../../app/api/internal/jobs/route";

describe("phase routing guards for queued jobs", () => {
  test("canRunPhase rejects queued phase_2 job for phase_1 execution", () => {
    const job: any = {
      id: "job-phase2-queued",
      user_id: "u1",
      manuscript_id: 1,
      job_type: "evaluate_quick",
      status: "queued",
      progress: {
        phase: "phase_2",
        phase_status: "triggered",
        total_units: null,
        completed_units: null,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_heartbeat: null,
    };

    const decision = canRunPhase(job, PHASES.PHASE_1);

    expect(decision.ok).toBe(false);
    expect(decision.reason).toContain("not eligible for phase_1");
  });

  test("selectEligibleJobs excludes queued phase_2 from phase1 candidates", () => {
    const allJobs: any[] = [
      {
        id: "job-phase1",
        status: "queued",
        progress: { phase: "phase_1", phase_status: "triggered" },
      },
      {
        id: "job-phase2",
        status: "queued",
        progress: { phase: "phase_2", phase_status: "triggered" },
      },
      {
        id: "job-phase2-eligible",
        status: "running",
        progress: { phase: "phase_1", phase_status: "complete" },
      },
    ];

    const selected = selectEligibleJobs(allJobs as any);

    expect(selected.phase1Candidates.map((j: any) => j.id)).toEqual(["job-phase1"]);
    expect(selected.phase2Candidates.map((j: any) => j.id)).toEqual(["job-phase2-eligible"]);
  });
});

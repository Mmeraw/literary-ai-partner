export {};

const createAdminClientMock = jest.fn();

jest.mock("../../../lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => createAdminClientMock(...args),
}));

describe("jobStore.getJob progress validation", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("logs warning for invalid progress but does not mutate terminal state", async () => {
    const updateSpy = jest.fn();

    const row = {
      id: "job-1",
      manuscript_id: 42,
      user_id: "user-1",
      job_type: "full_evaluation",
      status: "running",
      validity_status: "pending",
      progress: {
        phase: "unknown_phase",
        phase_status: "running",
        total_units: 1,
        completed_units: 0,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_heartbeat: null,
      last_error: null,
      failure_envelope: null,
      manuscripts: { user_id: "user-1" },
    };

    const supabase = {
      from: jest.fn().mockImplementation((_table: string) => ({
        select: jest.fn().mockImplementation((fields: string) => {
          if (fields === "id, validity_status") {
            return {
              limit: jest.fn().mockResolvedValue({ data: [{ id: "job-1", validity_status: "pending" }], error: null }),
            };
          }

          return {
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: row, error: null }),
            }),
          };
        }),
        update: updateSpy,
      })),
    };

    createAdminClientMock.mockReturnValue(supabase as any);

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const { getJob } = await import("../../../lib/jobs/jobStore.supabase");
    const job = await getJob("job-1");

    expect(job).toBeTruthy();
    expect(job?.id).toBe("job-1");
    expect(updateSpy).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[ProgressValidation] error_code=phase_unknown"),
      expect.anything(),
    );

    consoleSpy.mockRestore();
  });
});

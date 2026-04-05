import {
  __resetFinalizerStoreForTests,
  getConvergenceArtifactById,
  getJobForFinalization,
  getPassArtifactById,
} from "@/lib/jobs/store.finalizer";

jest.mock("@/lib/supabase/admin");

const mockCreateAdminClient = require("@/lib/supabase/admin")
  .createAdminClient as jest.Mock;

function makeSupabaseMock(options: {
  jobRow?: any;
  artifactRow?: any;
  error?: { message: string } | null;
}) {
  return {
    from: jest.fn((table: string) => {
      if (table === "evaluation_jobs") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(async () => ({
                data: options.jobRow ?? null,
                error: options.error ?? null,
              })),
            })),
          })),
        };
      }

      if (table === "evaluation_artifacts") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(async () => ({
                data: options.artifactRow ?? null,
                error: options.error ?? null,
              })),
            })),
          })),
        };
      }

      return {
        insert: jest.fn(async () => ({ error: options.error ?? null })),
      };
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetFinalizerStoreForTests();
});

describe("store.finalizer read paths", () => {
  test("maps job row into finalizer job shape", async () => {
    const supabaseMock = makeSupabaseMock({
      jobRow: {
        id: "job-1",
        status: "running",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_error: null,
        progress: {
          phase: "finalizer",
          lease_id: "worker-1",
          lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
          pass1_artifact_id: "p1",
          pass2_artifact_id: "p2",
          pass3_artifact_id: "p3",
          convergence_artifact_id: "conv-1",
        },
        manuscripts: { user_id: "user-1" },
        attempt_count: 0,
      },
    });

    mockCreateAdminClient.mockReturnValue(supabaseMock);

    const job = await getJobForFinalization("job-1");

    expect(job.id).toBe("job-1");
    expect(job.user_id).toBe("user-1");
    expect(job.phase).toBe("finalizer");
    expect(job.claimed_by).toBe("worker-1");
  });

  test("parses pass artifact payload from evaluation_artifacts", async () => {
    const supabaseMock = makeSupabaseMock({
      artifactRow: {
        id: "p1",
        content: {
          id: "p1",
          job_id: "job-1",
          pass_id: "pass1",
          schema_version: "pass-artifact-v1",
          manuscript_revision_id: "rev-1",
          generated_at: new Date().toISOString(),
          summary: "pass summary",
          criteria: [
            {
              criterion_id: "structure",
              score_0_10: 8,
              rationale: "rationale",
              confidence_0_1: 0.7,
              evidence: [
                {
                  anchor_id: "a1",
                  source_type: "manuscript_chunk",
                  source_ref: "chunk-1",
                  start_offset: 10,
                  end_offset: 20,
                  excerpt: "text",
                },
              ],
              warnings: [],
            },
          ],
          provenance: {
            evaluator_version: "eval-v1",
            prompt_pack_version: "pack-v1",
            run_id: "run-1",
          },
          validations: {
            schema_valid: true,
            anchor_contract_valid: true,
            evidence_nonempty: true,
            orphan_reasoning_absent: true,
          },
        },
      },
    });

    mockCreateAdminClient.mockReturnValue(supabaseMock);

    const artifact = await getPassArtifactById("p1");
    expect(artifact.id).toBe("p1");
    expect(artifact.pass_id).toBe("pass1");
  });

  test("fails closed on invalid convergence artifact payload", async () => {
    const supabaseMock = makeSupabaseMock({
      artifactRow: {
        id: "conv-1",
        content: {
          id: "conv-1",
          // missing required fields intentionally
        },
      },
    });

    mockCreateAdminClient.mockReturnValue(supabaseMock);

    await expect(getConvergenceArtifactById("conv-1")).rejects.toThrow(
      /failed schema validation/i,
    );
  });
});

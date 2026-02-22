const { upsertEvaluationArtifact } = require("../../../lib/evaluation/artifactPersistence");

describe("upsertEvaluationArtifact", () => {
  test("fails closed when manuscriptId is invalid", async () => {
    const fromMock = jest.fn();
    const supabase = { from: fromMock };

    await expect(
      upsertEvaluationArtifact({
        supabase,
        jobId: "job-1",
        manuscriptId: 0,
        artifactType: "evaluation_result_v1",
        content: { ok: true },
        sourceHash: "hash",
        artifactVersion: "evaluation_result_v1",
      })
    ).rejects.toThrow(/invalid manuscriptId/i);

    expect(fromMock).not.toHaveBeenCalled();
  });

  test("writes manuscript_id into evaluation_artifacts payload", async () => {
    const singleMock = jest.fn().mockResolvedValue({ data: { id: "artifact-123" }, error: null });
    const selectMock = jest.fn(() => ({ single: singleMock }));
    const upsertMock = jest.fn(() => ({ select: selectMock }));
    const fromMock = jest.fn(() => ({ upsert: upsertMock }));

    const supabase = { from: fromMock };

    const artifactId = await upsertEvaluationArtifact({
      supabase,
      jobId: "job-2",
      manuscriptId: 3988,
      artifactType: "evaluation_result_v1",
      content: { hello: "world" },
      sourceHash: "source-hash",
      artifactVersion: "evaluation_result_v1",
    });

    expect(artifactId).toBe("artifact-123");
    expect(fromMock).toHaveBeenCalledWith("evaluation_artifacts");
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        job_id: "job-2",
        manuscript_id: 3988,
        artifact_type: "evaluation_result_v1",
        source_hash: "source-hash",
      }),
      expect.objectContaining({
        onConflict: "job_id,artifact_type",
      })
    );
  });

  test("throws when database upsert returns an error", async () => {
    const singleMock = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "db failed" },
    });
    const selectMock = jest.fn(() => ({ single: singleMock }));
    const upsertMock = jest.fn(() => ({ select: selectMock }));
    const fromMock = jest.fn(() => ({ upsert: upsertMock }));

    const supabase = { from: fromMock };

    await expect(
      upsertEvaluationArtifact({
        supabase,
        jobId: "job-3",
        manuscriptId: 3990,
        artifactType: "evaluation_result_v1",
        content: { ok: false },
        sourceHash: "h",
        artifactVersion: "evaluation_result_v1",
      })
    ).rejects.toThrow(/Upsert failed.*db failed/i);
  });
});

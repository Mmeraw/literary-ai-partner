import {
  isPipelineEnabled,
  pipelineDisabledResponse,
} from "@/lib/config/pipelineGuard";

describe("pipelineGuard.isPipelineEnabled", () => {
  const originalValue = process.env.EVAL_PIPELINE_ENABLED;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.EVAL_PIPELINE_ENABLED;
    } else {
      process.env.EVAL_PIPELINE_ENABLED = originalValue;
    }
  });

  it("returns true when env var is unset", () => {
    delete process.env.EVAL_PIPELINE_ENABLED;
    expect(isPipelineEnabled()).toBe(true);
  });

  it("returns true for literal 'true'", () => {
    process.env.EVAL_PIPELINE_ENABLED = "true";
    expect(isPipelineEnabled()).toBe(true);
  });

  it("returns true for 'TRUE' (any case-variant not literal 'false')", () => {
    process.env.EVAL_PIPELINE_ENABLED = "TRUE";
    expect(isPipelineEnabled()).toBe(true);
  });

  it("returns true for '1'", () => {
    process.env.EVAL_PIPELINE_ENABLED = "1";
    expect(isPipelineEnabled()).toBe(true);
  });

  it("returns true for an arbitrary non-'false' value", () => {
    process.env.EVAL_PIPELINE_ENABLED = "anything else";
    expect(isPipelineEnabled()).toBe(true);
  });

  it("returns true for empty string (treated as unset / non-false)", () => {
    process.env.EVAL_PIPELINE_ENABLED = "";
    expect(isPipelineEnabled()).toBe(true);
  });

  // Case-sensitive literal "false" only — typos like "False"/"FALSE" must NOT
  // disable the pipeline. This avoids accidental disable from operator typos.
  it("returns false ONLY for the literal string 'false'", () => {
    process.env.EVAL_PIPELINE_ENABLED = "false";
    expect(isPipelineEnabled()).toBe(false);
  });

  it("returns true for 'False' (case-sensitive — typo guard)", () => {
    process.env.EVAL_PIPELINE_ENABLED = "False";
    expect(isPipelineEnabled()).toBe(true);
  });

  it("returns true for 'FALSE' (case-sensitive — typo guard)", () => {
    process.env.EVAL_PIPELINE_ENABLED = "FALSE";
    expect(isPipelineEnabled()).toBe(true);
  });
});

describe("pipelineGuard.pipelineDisabledResponse", () => {
  it("returns the canonical skip envelope with the provided job id", () => {
    expect(pipelineDisabledResponse("job-123")).toEqual({
      ok: false,
      skipped: true,
      reason: "EVAL_PIPELINE_DISABLED_BY_FLAG",
      job_id: "job-123",
    });
  });

  it("returns job_id=null when no id is provided", () => {
    expect(pipelineDisabledResponse()).toEqual({
      ok: false,
      skipped: true,
      reason: "EVAL_PIPELINE_DISABLED_BY_FLAG",
      job_id: null,
    });
  });

  it("normalizes nullish job ids to null", () => {
    expect(pipelineDisabledResponse(null).job_id).toBeNull();
    expect(pipelineDisabledResponse(undefined).job_id).toBeNull();
  });
});

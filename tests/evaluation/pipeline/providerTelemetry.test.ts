import { describe, expect, it } from "@jest/globals";
import { mergeProviderTelemetry, recordProviderTelemetry } from "@/lib/evaluation/pipeline/providerTelemetry";
import type { PassCompletionCapture } from "@/lib/evaluation/pipeline/types";

function makeCapture(overrides: Partial<PassCompletionCapture> = {}): PassCompletionCapture {
  return {
    pass: 1,
    raw_text: "{}",
    model: "gpt-5.1",
    finish_reason: "stop",
    generated_at: "2026-05-17T10:00:02.000Z",
    usage: { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 },
    ...overrides,
  };
}

describe("provider telemetry", () => {
  it("records provider call metadata with deterministic shape", () => {
    const telemetry = recordProviderTelemetry({
      capture: makeCapture({ pass: 2 }),
      jobId: "job-123",
      startedAt: "2026-05-17T10:00:00.000Z",
    });

    expect(telemetry.job_id).toBe("job-123");
    expect(telemetry.pass).toBe(2);
    expect(telemetry.provider).toBe("openai");
    expect(telemetry.model).toBe("gpt-5.1");
    expect(telemetry.usage?.total_tokens).toBe(200);
    expect(telemetry.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("merges telemetry without overwriting existing entries", () => {
    const existing = [
      recordProviderTelemetry({
        capture: makeCapture({ pass: 1, generated_at: "2026-05-17T10:00:01.000Z" }),
        jobId: "job-123",
        startedAt: "2026-05-17T10:00:00.000Z",
      }),
    ];

    const next = recordProviderTelemetry({
      capture: makeCapture({ pass: 3, generated_at: "2026-05-17T10:00:03.000Z" }),
      jobId: "job-123",
      startedAt: "2026-05-17T10:00:01.000Z",
    });

    const merged = mergeProviderTelemetry(existing, next);
    expect(merged).toHaveLength(2);
    expect(merged[0].pass).toBe(1);
    expect(merged[1].pass).toBe(3);
  });
});

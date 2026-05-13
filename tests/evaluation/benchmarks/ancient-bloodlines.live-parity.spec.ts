import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { runPipeline, synthesisToEvaluationResultV2 } from "@/lib/evaluation/pipeline/runPipeline";
import { validateEvaluationArtifact } from "@/lib/evaluation/validateEvaluationArtifact";

type LiveEnvelope = {
  source: string;
  benchmark: string;
  generated_at: string;
  seed: string;
  manuscript_path: string;
  evaluation_result_v2: unknown;
};

let envelope: LiveEnvelope;

beforeAll(async () => {
  jest.setTimeout(10 * 60 * 1000);

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required for test:benchmark:ancient-bloodlines:live");
  }

  const rawManuscriptPath = process.env.ANCIENT_BLOODLINES_MANUSCRIPT_PATH;
  if (!rawManuscriptPath) {
    throw new Error(
      "ANCIENT_BLOODLINES_MANUSCRIPT_PATH is required and must point to the Ancient Bloodlines manuscript text",
    );
  }

  const manuscriptPath = resolve(rawManuscriptPath);
  if (!existsSync(manuscriptPath) || !statSync(manuscriptPath).isFile()) {
    throw new Error(
      "ANCIENT_BLOODLINES_MANUSCRIPT_PATH is required and must point to the Ancient Bloodlines manuscript text",
    );
  }

  const manuscriptText = readFileSync(manuscriptPath, "utf8");
  const seed = process.env.ANCIENT_BLOODLINES_LIVE_SEED ?? "42";
  const model = process.env.ANCIENT_BLOODLINES_LIVE_MODEL ?? "gpt-4o-mini";

  const result = await runPipeline({
    manuscriptText,
    workType: "novel",
    title: "Ancient Bloodlines—Love Between Species",
    manuscriptId: "ancient-bloodlines-3463bb26",
    executionMode: "TRUSTED_PATH",
    model,
    openaiApiKey,
  });

  if (!result.ok) {
    const failed = result as Extract<typeof result, { ok: false }>;
    throw new Error(`Live benchmark run failed at ${failed.failed_at}: ${failed.error_code} ${failed.error}`);
  }

  const artifact = synthesisToEvaluationResultV2({
    synthesis: result.synthesis,
    ids: {
      evaluation_run_id: `ancient-bloodlines-live-${Date.now()}`,
      manuscript_id: 3463,
      user_id: "benchmark-live",
    },
    manuscriptText,
    sourceText: manuscriptText,
    title: "Ancient Bloodlines—Love Between Species",
  });

  artifact.governance.transparency = {
    ...(artifact.governance.transparency ?? {}),
    repro_anchor: "source:live",
  };

  envelope = {
    source: "live",
    benchmark: "ancient-bloodlines",
    generated_at: new Date().toISOString(),
    seed,
    manuscript_path: manuscriptPath,
    evaluation_result_v2: artifact,
  };
});

describe("Ancient Bloodlines — LIVE parity benchmark", () => {
  it("asserts live-source provenance marker", () => {
    expect(envelope.source).toBe("live");
    expect(envelope.benchmark).toBe("ancient-bloodlines");
    expect(envelope.evaluation_result_v2).toBeDefined();
  });

  it("validates live artifact with governance validator", () => {
    const validation = validateEvaluationArtifact(envelope.evaluation_result_v2);
    expect(validation.ok).toBe(true);
  });

  it("retains canon continuity anchors in live artifact commentary", () => {
    const artifact = envelope.evaluation_result_v2 as {
      criteria?: Array<{ key: string; rationale?: string; recommendations?: Array<{ action: string }> }>;
    };

    const byKey = new Map((artifact.criteria ?? []).map((c) => [c.key, c]));
    const combinedText = [
      byKey.get("character_depth_psychology")?.rationale ?? "",
      byKey.get("world_building_logic")?.rationale ?? "",
      byKey.get("theme_intelligence")?.rationale ?? "",
      ...((byKey.get("character_depth_psychology")?.recommendations ?? []).map((r) => r.action)),
      ...((byKey.get("world_building_logic")?.recommendations ?? []).map((r) => r.action)),
      ...((byKey.get("theme_intelligence")?.recommendations ?? []).map((r) => r.action)),
    ]
      .join(" ")
      .toLowerCase();

    expect(combinedText).toContain("twillow");
    expect(combinedText).toContain("snappy");
    expect(combinedText).toContain("thorander");
  });

  it("asserts non-fixture evaluation run id marker", () => {
    const artifact = envelope.evaluation_result_v2 as { ids?: { evaluation_run_id?: string }; governance?: { transparency?: { repro_anchor?: string } } };

    expect(artifact.ids?.evaluation_run_id ?? "").toContain("ancient-bloodlines-live-");
    expect(artifact.governance?.transparency?.repro_anchor).toBe("source:live");
  });
});

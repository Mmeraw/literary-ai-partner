import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { runPass1 } from "@/lib/evaluation/pipeline/runPass1";
import { runPass2 } from "@/lib/evaluation/pipeline/runPass2";
import { runPass3Synthesis } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import { runQualityGate } from "@/lib/evaluation/pipeline/qualityGate";
import { runPipeline, synthesisToEvaluationResult } from "@/lib/evaluation/pipeline/runPipeline";
import type {
  SinglePassOutput,
  SynthesisOutput,
  QualityGateResult,
  PassCompletionCapture,
  PipelineResult,
} from "@/lib/evaluation/pipeline/types";

type CapturedPasses = {
  pass1?: PassCompletionCapture;
  pass2?: PassCompletionCapture;
  pass3?: PassCompletionCapture;
};

function getArg(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const argv = process.argv.slice(2);
  const eqHit = argv.find((a) => a.startsWith(prefix));
  if (eqHit) {
    return eqHit.slice(prefix.length);
  }

  const index = argv.indexOf(`--${name}`);
  if (index !== -1 && index + 1 < argv.length) {
    return argv[index + 1];
  }

  return fallback;
}

function utcStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function inferTitle(inputPath: string): string {
  const fileName = inputPath.split("/").pop() ?? "manuscript";
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Untitled Manuscript";
}

function extractChapterOne(source: string): string {
  const chapterStart = source.indexOf("## CHAPTER 1:");
  if (chapterStart === -1) {
    return source;
  }

  const notesMarker = source.indexOf("## Base44 Training Notes", chapterStart);
  const chapterBlock = notesMarker === -1 ? source.slice(chapterStart) : source.slice(chapterStart, notesMarker);

  return chapterBlock
    .split("\n")
    .filter((line) => !line.startsWith("## CHAPTER 1:") && line.trim() !== "---")
    .join("\n")
    .trim();
}

function summarizeObservations(pass: SinglePassOutput): string[] {
  const criteriaCount = pass.criteria.length;
  const avgScore =
    criteriaCount === 0
      ? 0
      : pass.criteria.reduce((acc, c) => acc + c.score_0_10, 0) / criteriaCount;
  const recCount = pass.criteria.reduce((acc, c) => acc + c.recommendations.length, 0);
  const genericCount = pass.criteria.reduce(
    (acc, c) =>
      acc + c.recommendations.filter((r) => !r.anchor_snippet || r.anchor_snippet.trim().length === 0).length,
    0,
  );

  return [
    `criteria_count=${criteriaCount}`,
    `average_score=${avgScore.toFixed(2)}`,
    `recommendation_count=${recCount}`,
    `generic_recommendations=${genericCount}`,
  ];
}

function summarizeSynthesis(pass3: SynthesisOutput): string[] {
  const deltas = pass3.criteria.map((c) => c.score_delta);
  const avgDelta = deltas.length === 0 ? 0 : deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const bigDeltaCount = deltas.filter((d) => d > 2).length;

  return [
    `overall_score_0_100=${pass3.overall.overall_score_0_100}`,
    `verdict=${pass3.overall.verdict}`,
    `avg_axis_delta=${avgDelta.toFixed(2)}`,
    `high_delta_criteria_count=${bigDeltaCount}`,
  ];
}

function summarizeQualityGate(qg: QualityGateResult): string[] {
  const failed = qg.checks.filter((c) => !c.passed);
  return [
    `pass=${qg.pass}`,
    `failed_checks=${failed.length}`,
    ...failed.map((f) => `${f.check_id}:${f.error_code ?? "UNKNOWN"}`),
  ];
}

async function main(): Promise<void> {
  // Load local env files when present (non-destructive: process env still wins).
  const envPath = resolve(".env");
  const envLocalPath = resolve(".env.local");
  if (existsSync(envPath)) {
    loadDotenv({ path: envPath });
  }
  if (existsSync(envLocalPath)) {
    loadDotenv({ path: envLocalPath, override: true });
  }

  const sourcePath = resolve(
    getArg("input") ??
      getArg("source") ??
      "archive/base44-export/toadstone-power-of-belief-base44-voice-training-canonical-source-text.txt",
  );

  const title = getArg("title") ?? inferTitle(sourcePath);
  const workType = getArg("work-type", "novel_chapter")!;
  const model = getArg("model", "gpt-4o-mini")!;

  const outputDir =
    getArg("output-dir") ??
    getArg("output") ??
    process.env.PACK_25_REPORT_DIR ??
    `docs/operations/evidence/runs/${utcStamp()}_phase2.7_real_run_01`;

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required for phase2.7 real run");
  }

  const rawSource = readFileSync(sourcePath, "utf8");
  const manuscriptText = extractChapterOne(rawSource);
  const wordCount = countWords(manuscriptText);

  const capturedPasses: CapturedPasses = {};
  let pass1: SinglePassOutput | undefined;
  let pass2: SinglePassOutput | undefined;
  let pass3: SynthesisOutput | undefined;
  let qualityGate: QualityGateResult | undefined;

  const pipelineResult: PipelineResult = await runPipeline({
    manuscriptText,
    workType,
    title,
    model,
    openaiApiKey,
    _runners: {
      runPass1: async (opts) => {
        const result = await runPass1({
          ...opts,
          _onCompletion: (capture) => {
            capturedPasses.pass1 = capture;
          },
        });
        pass1 = result;
        return result;
      },
      runPass2: async (opts) => {
        const result = await runPass2({
          ...opts,
          _onCompletion: (capture) => {
            capturedPasses.pass2 = capture;
          },
        });
        pass2 = result;
        return result;
      },
      runPass3Synthesis: async (opts) => {
        const result = await runPass3Synthesis({
          ...opts,
          _onCompletion: (capture) => {
            capturedPasses.pass3 = capture;
          },
        });
        pass3 = result;
        return result;
      },
      runQualityGate: (synthesis, pass1Output, pass2Output) => {
        const result = runQualityGate(synthesis, pass1Output, pass2Output);
        qualityGate = result;
        return result;
      },
    },
  });

  const evaluationResult = pass3
    ? synthesisToEvaluationResult({
        synthesis: pass3,
        ids: {
          evaluation_run_id: `phase2_7_real_run_${Date.now()}`,
          manuscript_id: 0,
          user_id: "phase2.7-real-run",
        },
      })
    : undefined;

  mkdirSync(outputDir, { recursive: true });

  writeFileSync(join(outputDir, "input.manuscript.txt"), manuscriptText, "utf8");

  const capturedArtifacts = [
    ["pass1_raw.json", capturedPasses.pass1?.raw_text],
    ["pass2_raw.json", capturedPasses.pass2?.raw_text],
    ["pass3_raw.json", capturedPasses.pass3?.raw_text],
  ] as const;
  for (const [fileName, content] of capturedArtifacts) {
    if (content) {
      writeFileSync(join(outputDir, fileName), content, "utf8");
    }
  }

  const parsedArtifacts = [
    ["pass1_parsed.json", pass1],
    ["pass2_parsed.json", pass2],
    ["pass3_parsed.json", pass3],
  ] as const;
  for (const [fileName, value] of parsedArtifacts) {
    if (value) {
      writeFileSync(join(outputDir, fileName), JSON.stringify(value, null, 2), "utf8");
    }
  }

  if (qualityGate) {
    writeFileSync(join(outputDir, "quality_gate.json"), JSON.stringify(qualityGate, null, 2), "utf8");
  }
  writeFileSync(join(outputDir, "pipeline_result.json"), JSON.stringify(pipelineResult, null, 2), "utf8");
  if (evaluationResult) {
    writeFileSync(
      join(outputDir, "evaluation-result-v1.json"),
      JSON.stringify(evaluationResult, null, 2),
      "utf8",
    );
  }

  const usage = {
    model,
    passes: {
      pass1: capturedPasses.pass1?.usage ?? null,
      pass2: capturedPasses.pass2?.usage ?? null,
      pass3: capturedPasses.pass3?.usage ?? null,
    },
    totals: {
      prompt_tokens:
        (capturedPasses.pass1?.usage?.prompt_tokens ?? 0) +
        (capturedPasses.pass2?.usage?.prompt_tokens ?? 0) +
        (capturedPasses.pass3?.usage?.prompt_tokens ?? 0),
      completion_tokens:
        (capturedPasses.pass1?.usage?.completion_tokens ?? 0) +
        (capturedPasses.pass2?.usage?.completion_tokens ?? 0) +
        (capturedPasses.pass3?.usage?.completion_tokens ?? 0),
      total_tokens:
        (capturedPasses.pass1?.usage?.total_tokens ?? 0) +
        (capturedPasses.pass2?.usage?.total_tokens ?? 0) +
        (capturedPasses.pass3?.usage?.total_tokens ?? 0),
    },
  };
  writeFileSync(join(outputDir, "usage.json"), JSON.stringify(usage, null, 2), "utf8");

  const metadata = {
    phase: "2.7",
    run_type: "real_manuscript",
    source_path: sourcePath,
    source_title: title,
    work_type: workType,
    model,
    word_count: wordCount,
    generated_at: new Date().toISOString(),
    output_dir: outputDir,
    quality_gate_pass: qualityGate?.pass ?? false,
  };
  writeFileSync(join(outputDir, "metadata.json"), JSON.stringify(metadata, null, 2), "utf8");

  const reportMd = `# PHASE_2_7_REAL_RUN_01

Input:
- Manuscript: ${title}
- Length: ${wordCount} words
- Source: \`${sourcePath}\`
- Model: \`${model}\`
- Work type: \`${workType}\`

Pass 1:
- Raw output: \`${join(outputDir, "pass1_raw.json")}\`
- Parsed output: \`${join(outputDir, "pass1_parsed.json")}\`
- Observations:
  - ${pass1 ? summarizeObservations(pass1).join("\n  - ") : "Pass 1 did not complete."}

Pass 2:
- Raw output: \`${join(outputDir, "pass2_raw.json")}\`
- Parsed output: \`${join(outputDir, "pass2_parsed.json")}\`
- Observations:
  - ${pass2 ? summarizeObservations(pass2).join("\n  - ") : "Pass 2 did not complete."}

Pass 3:
- Raw output: \`${join(outputDir, "pass3_raw.json")}\`
- Parsed output: \`${join(outputDir, "pass3_parsed.json")}\`
- Observations:
  - ${pass3 ? summarizeSynthesis(pass3).join("\n  - ") : "Pass 3 did not complete."}

Quality Gate:
- Pass/Fail: ${qualityGate?.pass ? "PASS" : "FAIL"}
- Issues detected:
  - ${qualityGate ? summarizeQualityGate(qualityGate).join("\n  - ") : "Quality gate did not execute."}

Conclusion:
- What broke:
  - ${qualityGate?.pass ? "No hard quality-gate violations." : pipelineResult.ok ? "No pipeline failure, but inspect artifacts for follow-up tuning." : `Pipeline failed at ${pipelineResult.failed_at} with ${pipelineResult.error_code}.`}
- What needs prompt tuning:
  - Pass 1: tighten anti-generic rationale rule (require concrete anchor references in each criterion rationale).
  - Pass 2: require recommendation dedupe + stronger action specificity constraints tied to observed text behavior.
  - Pass 3: enforce stronger contradiction resolution guidance when craft/editorial deltas exceed 2 points.
`;

  writeFileSync(join(outputDir, "PHASE_2_7_REAL_RUN_01.md"), reportMd, "utf8");
  writeFileSync(resolve("PHASE_2_7_REAL_RUN_01.md"), reportMd, "utf8");

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: pipelineResult.ok,
        output_dir: outputDir,
        quality_gate_pass: qualityGate?.pass ?? false,
        word_count: wordCount,
        model,
      },
      null,
      2,
    ),
  );
}

void main();
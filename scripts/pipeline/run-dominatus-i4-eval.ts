import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { runPipeline } from "@/lib/evaluation/pipeline/runPipeline";
import { runPass1 } from "@/lib/evaluation/pipeline/runPass1";
import { runPass2 } from "@/lib/evaluation/pipeline/runPass2";
import { runPass3Synthesis } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import { runQualityGate } from "@/lib/evaluation/pipeline/qualityGate";
import { PASS1_SYSTEM_PROMPT, buildPass1UserPrompt } from "@/lib/evaluation/pipeline/prompts/pass1-craft";
import { PASS2_SYSTEM_PROMPT, buildPass2UserPrompt } from "@/lib/evaluation/pipeline/prompts/pass2-editorial";
import { PASS3_SYSTEM_PROMPT, buildPass3UserPrompt } from "@/lib/evaluation/pipeline/prompts/pass3-synthesis";
import {
  DEFAULT_GOVERNANCE_INJECTION_MAP,
  type GovernanceCheckpoint,
} from "@/lib/governance/injectionMap";
import type {
  PassCompletionCapture,
  PipelineResult,
  QualityGateResult,
  SinglePassOutput,
  SynthesisOutput,
} from "@/lib/evaluation/pipeline/types";

type ExecutionMode = "TRUSTED_PATH" | "STUDIO";

type CapturedPasses = {
  pass1?: PassCompletionCapture;
  pass2?: PassCompletionCapture;
  pass3?: PassCompletionCapture;
};

type CheckpointResult = "PASS" | "SOFT_FAIL" | "BLOCK";

type CheckpointArtifact = {
  checkpoint_id: string;
  checkpoint_type: "CANON" | "LESSONS_LEARNED" | "QUALITY" | "BOUNDARY" | "OPERATIONS";
  stage: string;
  authority: string;
  result: CheckpointResult;
  error_code: string | null;
  metadata: Record<string, unknown>;
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

function loadEnv(): void {
  const envPath = resolve(".env");
  const envLocalPath = resolve(".env.local");
  if (existsSync(envPath)) {
    loadDotenv({ path: envPath });
  }
  if (existsSync(envLocalPath)) {
    loadDotenv({ path: envLocalPath, override: true });
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function executionModeFromArg(raw: string | undefined): ExecutionMode {
  return raw === "STUDIO" ? "STUDIO" : "TRUSTED_PATH";
}

function positiveIntOrUndefined(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function checkpointType(checkpoint: GovernanceCheckpoint): CheckpointArtifact["checkpoint_type"] {
  if (checkpoint.id.startsWith("LLR_")) return "LESSONS_LEARNED";
  if (checkpoint.id.includes("QUALITY")) return "QUALITY";
  if (checkpoint.id.includes("BOUNDARY")) return "BOUNDARY";
  if (checkpoint.id.includes("CANON")) return "CANON";
  return "OPERATIONS";
}

function stageRank(stage: string): number {
  switch (stage) {
    case "pipeline_boot":
      return 1;
    case "post_pass1":
      return 2;
    case "post_pass2":
      return 3;
    case "post_pass3":
      return 4;
    case "pre_pass4":
      return 5;
    case "pass4":
      return 6;
    case "post_pass4":
      return 7;
    case "post_evaluation_envelope":
      return 8;
    case "artifact_certification":
      return 9;
    case "failure_path":
      return 10;
    default:
      return 99;
  }
}

function failureRank(result: PipelineResult): number {
  if (!("failed_at" in result)) {
    return Number.POSITIVE_INFINITY;
  }
  switch (result.failed_at) {
    case "pass1":
      return 2;
    case "pass2":
      return 3;
    case "pass3":
      return 4;
    case "pass4":
      return 6;
    default:
      return 99;
  }
}

function buildGovernanceCheckpointArtifacts(result: PipelineResult): CheckpointArtifact[] {
  const failRank = failureRank(result);
  const blockingCode = "error_code" in result ? result.error_code : null;

  return DEFAULT_GOVERNANCE_INJECTION_MAP.map((checkpoint) => {
    const rank = stageRank(checkpoint.stage);
    const checkpointBlocked = !!blockingCode && checkpoint.blockErrorCode === blockingCode;

    const checkpointResult: CheckpointResult = checkpointBlocked
      ? "BLOCK"
      : rank < failRank || result.ok
        ? "PASS"
        : checkpoint.id === "FAILURE_ESCALATION_DEAD_LETTER" && !result.ok
          ? "PASS"
          : "SOFT_FAIL";

    return {
      checkpoint_id: checkpoint.id,
      checkpoint_type: checkpointType(checkpoint),
      stage: checkpoint.stage,
      authority: checkpoint.authority,
      result: checkpointResult,
      error_code: checkpointBlocked ? blockingCode : null,
      metadata: {
        primary_action: checkpoint.primaryAction,
        llr_stage: checkpoint.llrStage ?? null,
        block_error_code: checkpoint.blockErrorCode ?? null,
      },
    };
  });
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function main(): Promise<void> {
  loadEnv();

  const manuscriptPath = resolve(
    getArg("manuscript") ?? "calibration/dominatus-i4-revisiongrade-gold-standard.md",
  );
  const manuscriptId = getArg("manuscript-id", "dominatus-i4")!;
  const mode = executionModeFromArg(getArg("mode", "TRUSTED_PATH"));
  const passTimeoutMs = positiveIntOrUndefined(getArg("pass-timeout-ms"));
  const outDir = resolve(
    getArg("out") ?? `artifacts/evidence/${manuscriptId}`,
  );

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required for DOMINATUS I:4 evaluation harness run");
  }

  const manuscriptText = readFileSync(manuscriptPath, "utf8");
  const title = "DOMINATUS I:4";
  const workType = "novel_chapter";
  const startedAt = nowIso();
  const traceId = `dominatus-${Date.now()}`;

  const capturedPasses: CapturedPasses = {};
  let pass1Parsed: SinglePassOutput | undefined;
  let pass2Parsed: SinglePassOutput | undefined;
  let pass3Parsed: SynthesisOutput | undefined;
  let qualityGate: QualityGateResult | undefined;

  const pipelineResult = await runPipeline({
    manuscriptText,
    workType,
    title,
    manuscriptId,
    executionMode: mode,
    openaiApiKey,
    _passTimeoutMs: passTimeoutMs,
    _runners: {
      runPass1: async (opts) => {
        const output = await runPass1({
          ...opts,
          _onCompletion: (capture) => {
            capturedPasses.pass1 = capture;
          },
        });
        pass1Parsed = output;
        return output;
      },
      runPass2: async (opts) => {
        const output = await runPass2({
          ...opts,
          _onCompletion: (capture) => {
            capturedPasses.pass2 = capture;
          },
        });
        pass2Parsed = output;
        return output;
      },
      runPass3Synthesis: async (opts) => {
        const output = await runPass3Synthesis({
          ...opts,
          _onCompletion: (capture) => {
            capturedPasses.pass3 = capture;
          },
        });
        pass3Parsed = output;
        return output;
      },
      runQualityGate: (synthesis, pass1, pass2) => {
        const output = runQualityGate(synthesis, pass1, pass2);
        qualityGate = output;
        return output;
      },
    },
  });

  const completedAt = nowIso();
  const overallStatus: "complete" | "failed" = pipelineResult.ok ? "complete" : "failed";
  const failClosedTriggered = !pipelineResult.ok;

  mkdirSync(outDir, { recursive: true });

  const pass1UserPrompt = buildPass1UserPrompt({
    manuscriptText,
    workType,
    title,
    executionMode: mode,
  });

  const pass2UserPrompt = buildPass2UserPrompt({
    manuscriptText,
    workType,
    title,
    executionMode: mode,
  });

  const pass3UserPrompt = pass1Parsed && pass2Parsed
    ? buildPass3UserPrompt({
        pass1Json: JSON.stringify(pass1Parsed, null, 2),
        pass2Json: JSON.stringify(pass2Parsed, null, 2),
        manuscriptText,
        title,
        executionMode: mode,
      })
    : null;

  writeJson(join(outDir, "run-summary.json"), {
    manuscript_id: manuscriptId,
    execution_mode: mode,
    started_at: startedAt,
    completed_at: completedAt,
    overall_status: overallStatus,
    fail_closed_triggered: failClosedTriggered,
    trace_id: traceId,
    pipeline_result: pipelineResult,
  });

  writeJson(join(outDir, "pass1-output.json"), {
    prompt: {
      system: PASS1_SYSTEM_PROMPT,
      user: pass1UserPrompt,
    },
    raw_model_output: capturedPasses.pass1?.raw_text ?? null,
    parsed_output: pass1Parsed ?? null,
    stage_metadata: {
      pass: 1,
      model: pass1Parsed?.model ?? null,
      usage: capturedPasses.pass1?.usage ?? null,
      generated_at: capturedPasses.pass1?.generated_at ?? null,
    },
  });

  writeJson(join(outDir, "pass2-output.json"), {
    prompt: {
      system: PASS2_SYSTEM_PROMPT,
      user: pass2UserPrompt,
    },
    raw_model_output: capturedPasses.pass2?.raw_text ?? null,
    parsed_output: pass2Parsed ?? null,
    stage_metadata: {
      pass: 2,
      model: pass2Parsed?.model ?? null,
      usage: capturedPasses.pass2?.usage ?? null,
      generated_at: capturedPasses.pass2?.generated_at ?? null,
    },
  });

  writeJson(join(outDir, "pass3-output.json"), {
    prompt: {
      system: PASS3_SYSTEM_PROMPT,
      user: pass3UserPrompt,
    },
    raw_model_output: capturedPasses.pass3?.raw_text ?? null,
    parsed_output: pass3Parsed ?? null,
    stage_metadata: {
      pass: 3,
      model: pass3Parsed?.metadata.pass3_model ?? null,
      usage: capturedPasses.pass3?.usage ?? null,
      generated_at: capturedPasses.pass3?.generated_at ?? null,
      quality_gate: qualityGate ?? null,
    },
  });

  const governanceCheckpoints = buildGovernanceCheckpointArtifacts(pipelineResult);
  writeJson(join(outDir, "governance-checkpoints.json"), governanceCheckpoints);

  writeJson(join(outDir, "acceptance-scoring-template.json"), {
    gold_standard_version: "1.0",
    binary_checklist_version: "1.0",
    manuscript_id: manuscriptId,
    scoring: {
      canon_integrity: [],
      governance_integrity: [],
      lessons_learned: [],
      evaluator_discipline: [],
      structural_completeness: [],
      convergence_integrity: [],
      evidence_quality: [],
      output_integrity: [],
      forbidden_patterns: [],
      scoring_integrity: [],
    },
    final_decision: null,
    notes: "",
  });

  const evidenceBundle = `# DOMINATUS I:4 Evidence Bundle

- Manuscript ID: ${manuscriptId}
- Execution mode: ${mode}
- Started at: ${startedAt}
- Completed at: ${completedAt}
- Overall status: ${overallStatus}
- Fail-closed triggered: ${failClosedTriggered}
- Trace ID: ${traceId}

## Stage Results

- Pass 1 parsed output present: ${Boolean(pass1Parsed)}
- Pass 2 parsed output present: ${Boolean(pass2Parsed)}
- Pass 3 parsed output present: ${Boolean(pass3Parsed)}
- Quality gate pass: ${qualityGate?.pass ?? false}

## Governance Checkpoints

${governanceCheckpoints
  .map(
    (c) => `- ${c.checkpoint_id} [${c.stage}] => ${c.result}${c.error_code ? ` (${c.error_code})` : ""}`,
  )
  .join("\n")}

## Artifact Locations

- run-summary: \`${join(outDir, "run-summary.json")}\`
- pass1 output: \`${join(outDir, "pass1-output.json")}\`
- pass2 output: \`${join(outDir, "pass2-output.json")}\`
- pass3 output: \`${join(outDir, "pass3-output.json")}\`
- governance checkpoints: \`${join(outDir, "governance-checkpoints.json")}\`
- scoring template: \`${join(outDir, "acceptance-scoring-template.json")}\`
`;

  writeFileSync(join(outDir, "evidence-bundle.md"), evidenceBundle, "utf8");

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: pipelineResult.ok,
        overall_status: overallStatus,
        out_dir: outDir,
        fail_closed_triggered: failClosedTriggered,
      },
      null,
      2,
    ),
  );
}

void main();

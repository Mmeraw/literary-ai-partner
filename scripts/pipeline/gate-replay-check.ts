import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runQualityGate } from "@/lib/evaluation/pipeline/qualityGate";
import type { SinglePassOutput, SynthesisOutput } from "@/lib/evaluation/pipeline/types";

type PipelineReplayResult = {
  ok?: boolean;
  synthesis?: SynthesisOutput;
};

type ReplayOptions = {
  runDir: string;
  failOnAny: boolean;
  strictCodes: Set<string>;
};

function getArg(name: string, fallback?: string): string | undefined {
  const argv = process.argv.slice(2);
  const prefix = `--${name}=`;
  const eq = argv.find((a) => a.startsWith(prefix));
  if (eq) return eq.slice(prefix.length);

  const idx = argv.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < argv.length) return argv[idx + 1];

  return fallback;
}

function parseBooleanFlag(name: string): boolean {
  const argv = process.argv.slice(2);
  return argv.includes(`--${name}`);
}

function parseStrictCodes(input?: string): Set<string> {
  const defaultCodes = ["QG_DUPLICATE_REC", "QG_INDEPENDENCE_VIOLATION"];
  if (!input || !input.trim()) {
    return new Set(defaultCodes);
  }

  const parts = input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return new Set(parts.length > 0 ? parts : defaultCodes);
}

function readJsonFile<T>(filePath: string): T {
  if (!existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function loadReplayOptions(): ReplayOptions {
  const runDir = getArg("run-dir") ?? getArg("dir");
  if (!runDir) {
    throw new Error("Missing required argument: --run-dir <path-to-run-artifacts>");
  }

  return {
    runDir: resolve(runDir),
    failOnAny: parseBooleanFlag("fail-on-any"),
    strictCodes: parseStrictCodes(getArg("strict-codes")),
  };
}

function main(): void {
  const options = loadReplayOptions();

  const pass1Path = resolve(options.runDir, "pass1_parsed.json");
  const pass2Path = resolve(options.runDir, "pass2_parsed.json");
  const pass3Path = resolve(options.runDir, "pass3_parsed.json");
  const pipelineResultPath = resolve(options.runDir, "pipeline_result.json");

  const pass1 = readJsonFile<SinglePassOutput>(pass1Path);
  const pass2 = readJsonFile<SinglePassOutput>(pass2Path);

  let synthesis: SynthesisOutput;
  let synthesisSource = "pass3_parsed.json";

  if (existsSync(pipelineResultPath)) {
    const pipelineResult = readJsonFile<PipelineReplayResult>(pipelineResultPath);
    if (pipelineResult?.ok === true && pipelineResult.synthesis) {
      synthesis = pipelineResult.synthesis;
      synthesisSource = "pipeline_result.json#synthesis";
    } else {
      synthesis = readJsonFile<SynthesisOutput>(pass3Path);
    }
  } else {
    synthesis = readJsonFile<SynthesisOutput>(pass3Path);
  }

  const result = runQualityGate(synthesis, pass1, pass2);
  const failedChecks = result.checks.filter((c) => !c.passed);
  const failedCodes = failedChecks.map((c) => c.error_code ?? "QG_UNKNOWN");

  console.log("[GateReplay] run_dir:", options.runDir);
  console.log("[GateReplay] synthesis_source:", synthesisSource);
  console.log("[GateReplay] gate_pass:", result.pass);
  console.log("[GateReplay] failed_checks:", failedChecks.length);
  if (failedChecks.length > 0) {
    console.log("[GateReplay] failed_details:");
    for (const check of failedChecks) {
      console.log(
        `  - ${check.check_id} | code=${check.error_code ?? "QG_UNKNOWN"} | details=${check.details ?? "(none)"}`,
      );
    }
  }

  if (result.warnings.length > 0) {
    console.log(`[GateReplay] warnings: ${result.warnings.length}`);
    for (const warning of result.warnings.slice(0, 5)) {
      console.log(`  - ${warning}`);
    }
  }

  const hasStrictFailure = failedCodes.some((code) => options.strictCodes.has(code));
  const shouldFail = options.failOnAny ? failedChecks.length > 0 : hasStrictFailure;

  console.log(
    `[GateReplay] mode=${options.failOnAny ? "fail-on-any" : "strict-codes"} strict_codes=${[
      ...options.strictCodes,
    ].join(",")}`,
  );

  if (shouldFail) {
    const reason = options.failOnAny
      ? "Quality gate replay failed (fail-on-any mode)"
      : `Quality gate replay failed strict code(s): ${failedCodes
          .filter((code) => options.strictCodes.has(code))
          .join(",")}`;
    console.error(`[GateReplay] ${reason}`);
    process.exit(1);
  }

  console.log("[GateReplay] PASS");
}

main();

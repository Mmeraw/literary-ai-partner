import { execSync } from "node:child_process";
import path from "node:path";

import { runSoakHarness, type SoakHarnessMode } from "@/lib/operations/soakHarness";

type ParsedArgs = {
  events: number;
  concurrency: number;
  seed: number;
  mode: SoakHarnessMode;
  outputDir: string;
};

function readGitValue(command: string): string {
  try {
    return execSync(command, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const values = new Map<string, string>();

  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, value] = arg.slice(2).split("=", 2);
    if (key) {
      values.set(key, value ?? "true");
    }
  }

  const events = Number(values.get("events") ?? "1000");
  const concurrency = Number(values.get("concurrency") ?? "5");
  const seed = Number(values.get("seed") ?? "42");
  const mode = (values.get("mode") ?? "deterministic") as SoakHarnessMode;

  if (!["dry-run", "deterministic", "stress"].includes(mode)) {
    throw new Error(`Unsupported --mode value: ${mode}`);
  }

  const runId = values.get("run-id") ?? new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = values.get("output")
    ? path.resolve(process.cwd(), values.get("output") as string)
    : path.resolve(process.cwd(), "docs/operations/evidence/runs", runId);

  return { events, concurrency, seed, mode, outputDir };
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const commitSha = readGitValue("git rev-parse HEAD");
  const branch = readGitValue("git rev-parse --abbrev-ref HEAD");

  const result = await runSoakHarness({
    ...parsed,
    commitSha,
    branch,
    log: (line) => {
      process.stdout.write(`${line}\n`);
    },
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        output_dir: parsed.outputDir,
        pass: result.metrics.pass,
        total_events_processed: result.metrics.total_events_processed,
        unclassified_failures_total: result.metrics.unclassified_failures_total,
        wrong_location_edits_total: result.metrics.wrong_location_edits_total,
        lost_writes_total: result.metrics.lost_writes_total,
      },
      null,
      2,
    )}\n`,
  );

  if (!result.metrics.pass) {
    process.exitCode = 1;
  }
}

void main();

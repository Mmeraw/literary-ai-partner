import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getRegistryConsumer } from "../../protected/registry";
import { buildScanTarget, scanTarget } from "./scanner";
import { buildReport, writeOutputs } from "./reporter";
import type { RawMatch, ScanTarget } from "./types";

interface Args {
  base: string;
  head: string;
  artifact: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { base: "origin/main", head: "HEAD", artifact: "artifacts/ci-guard-report.json" };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--base") args.base = argv[++i] ?? args.base;
    else if (argv[i] === "--head") args.head = argv[++i] ?? args.head;
    else if (argv[i] === "--artifact") args.artifact = argv[++i] ?? args.artifact;
  }
  return args;
}

function getChangedFiles(base: string, head: string): string[] {
  const out = execSync(`git diff --name-only ${base}...${head}`, { encoding: "utf8" });
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function readTextFileSafe(relativePath: string): string | null {
  const absolute = path.resolve(relativePath);
  if (!fs.existsSync(absolute)) return null;
  try {
    const content = fs.readFileSync(absolute, "utf8");
    if (content.includes("\u0000")) return null;
    return content;
  } catch {
    return null;
  }
}

export function runGuard(filePaths: readonly string[], artifactPath = "artifacts/ci-guard-report.json"): number {
  const registry = getRegistryConsumer();
  const validation = registry.validateRegistry();
  const targets: ScanTarget[] = [];
  const rawMatches: RawMatch[] = [];
  const contentByPath = new Map<string, string>();

  for (const relativePath of filePaths) {
    const content = readTextFileSafe(relativePath);
    if (content === null) continue;

    const target = buildScanTarget(relativePath, content);
    targets.push(target);
    contentByPath.set(relativePath, content);
    rawMatches.push(...scanTarget(target, registry));
  }

  const report = buildReport({
    targets,
    rawMatches,
    registryValidationOk: validation.schemaValid,
    escapeContract: registry.getEscapeAnnotationContract(),
    contentByPath,
  });

  writeOutputs(report, artifactPath);

  if (!validation.schemaValid || report.outcome === "fail") {
    return 1;
  }

  return 0;
}

function main(): void {
  const { base, head, artifact } = parseArgs(process.argv);
  const files = getChangedFiles(base, head);

  const exitCode = runGuard(files, artifact);

  process.exit(exitCode);
}

const currentFilePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (invokedPath === currentFilePath) {
  main();
}

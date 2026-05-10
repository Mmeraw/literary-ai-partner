import fs from "node:fs";
import path from "node:path";
import { validateEscapeAnnotation } from "./annotation-validator";
import type { RawMatch, ScanReport, ScanTarget, Violation } from "./types";
import type { EscapeAnnotationPattern } from "../../protected/registry";

interface BuildReportInput {
  readonly targets: ReadonlyArray<ScanTarget>;
  readonly rawMatches: ReadonlyArray<RawMatch>;
  readonly registryValidationOk: boolean;
  readonly escapeContract: EscapeAnnotationPattern;
  readonly contentByPath: ReadonlyMap<string, string>;
}

export function buildReport(input: BuildReportInput): ScanReport {
  let acceptedExceptionCount = 0;
  let rejectedExceptionCount = 0;
  const violations: Violation[] = [];

  for (const match of input.rawMatches) {
    let escapeValidatorOutcome = null;

    if (match.hasNearbyEscapeAnnotation) {
      const content = input.contentByPath.get(match.relativePath) ?? "";
      const outcome = validateEscapeAnnotation(
        match.relativePath,
        content,
        match.span,
        input.escapeContract,
      );
      escapeValidatorOutcome = outcome;

      if (outcome === "accepted") {
        acceptedExceptionCount++;
        continue;
      }

      rejectedExceptionCount++;
    }

    violations.push({
      relativePath: match.relativePath,
      category: match.result.category!,
      classificationDepth: match.result.classificationDepth!,
      span: match.span,
      hasNearbyEscapeAnnotation: match.hasNearbyEscapeAnnotation,
      escapeValidatorOutcome,
    });
  }

  const inScopeTargetCount = input.targets.filter((t) => t.inScope).length;
  const outcome = input.registryValidationOk && violations.length === 0 ? "pass" : "fail";

  return {
    outcome,
    scanTargetCount: input.targets.length,
    inScopeTargetCount,
    violationCount: violations.length,
    acceptedExceptionCount,
    rejectedExceptionCount,
    violations: Object.freeze(violations),
    registryValidationOk: input.registryValidationOk,
    escapeContract: input.escapeContract,
  };
}

export function renderSummary(report: ScanReport): string {
  const lines: string[] = [];
  lines.push("## CI Guard Summary");
  lines.push("");
  lines.push(`Outcome: **${report.outcome.toUpperCase()}**`);
  lines.push(`Registry validation: **${report.registryValidationOk ? "OK" : "FAILED"}**`);
  lines.push(`Scanned targets: ${report.scanTargetCount} (in-scope: ${report.inScopeTargetCount})`);
  lines.push(`Violations: ${report.violationCount}`);
  lines.push(`Accepted exceptions: ${report.acceptedExceptionCount}`);
  lines.push(`Rejected exceptions: ${report.rejectedExceptionCount}`);
  lines.push("");

  if (report.violations.length > 0) {
    lines.push("### Violations");
    for (const violation of report.violations) {
      lines.push(
        `- [${violation.relativePath}:${violation.span.lineNumber}] category=${String(
          violation.category,
        )} depth=${violation.classificationDepth} annotated=${violation.hasNearbyEscapeAnnotation}`,
      );
    }
  }

  return lines.join("\n");
}

export function writeOutputs(report: ScanReport, artifactPath = "artifacts/ci-guard-report.json"): void {
  const summary = renderSummary(report);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;

  if (summaryPath) {
    fs.appendFileSync(summaryPath, `${summary}\n`, "utf8");
  }

  const resolved = path.resolve(artifactPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(report, null, 2), "utf8");
}

/**
 * scripts/pipeline-stress.report.ts
 *
 * CSV + markdown emitters for the pipeline stress harness.
 *
 * Anti-flake rule 9: output is sorted by row id, not execution order. Two
 * runs against the same matrix must produce byte-identical CSV/markdown
 * modulo timing columns. The timing columns are intentionally last so a
 * `cut -d, -f1-6` against the CSV yields a fully deterministic diff.
 */

import fs from "fs";
import path from "path";
import type { StressRow } from "./pipeline-stress.scenarios";

export interface RowResult {
  row: StressRow;
  outcome: "success" | "fail";
  error_code: string | null;
  total_ms: number;
  pass1_ms: number | null;
  pass2_ms: number | null;
  pass3_ms: number | null;
  coverage_pct: number;
  scores_present: boolean;
  assertion_failures: string[];
  exposed_real_bug: boolean;
  real_bug_note: string | null;
}

export interface ReportSummary {
  total: number;
  passed: number;
  failed: number;
  exposed_real_bugs: number;
}

const CSV_HEADER = [
  "id",
  "bucket",
  "category",
  "faults_summary",
  "expected_outcome",
  "outcome",
  "error_code",
  "coverage_pct",
  "scores_present",
  "assertion_failures",
  "total_ms",
  "pass1_ms",
  "pass2_ms",
  "pass3_ms",
].join(",");

function csvEscape(value: string | number | boolean | null): string {
  if (value === null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function faultsSummary(row: StressRow): string {
  const parts: string[] = [];
  if (row.llmFault.kind !== "none") {
    parts.push(`llm:${row.llmFault.kind}`);
  }
  if (Object.keys(row.supabaseFault).length > 0) {
    parts.push(`sb:${JSON.stringify(row.supabaseFault)}`);
  }
  if (row.chunkOverride.kind !== "none") {
    parts.push(`chunk:${row.chunkOverride.kind}`);
  }
  if (row.manuscript?.suppressChapters) {
    parts.push("manuscript:no-chapters");
  }
  return parts.length === 0 ? "none" : parts.join("|");
}

export function renderCsv(results: RowResult[]): string {
  const sorted = [...results].sort((a, b) => a.row.id.localeCompare(b.row.id));
  const lines = [CSV_HEADER];
  for (const r of sorted) {
    lines.push(
      [
        csvEscape(r.row.id),
        csvEscape(r.row.bucket),
        csvEscape(r.row.category),
        csvEscape(faultsSummary(r.row)),
        csvEscape(r.row.expected.outcome),
        csvEscape(r.outcome),
        csvEscape(r.error_code),
        csvEscape(r.coverage_pct.toFixed(1)),
        csvEscape(r.scores_present),
        csvEscape(r.assertion_failures.join(";") || "none"),
        csvEscape(r.total_ms),
        csvEscape(r.pass1_ms),
        csvEscape(r.pass2_ms),
        csvEscape(r.pass3_ms),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export function renderMarkdown(results: RowResult[], summary: ReportSummary): string {
  const sorted = [...results].sort((a, b) => a.row.id.localeCompare(b.row.id));
  const out: string[] = [];
  out.push("# Pipeline Stress Harness — Tier 1 Summary");
  out.push("");
  out.push(`- Total rows: ${summary.total}`);
  out.push(`- Passed assertions: ${summary.passed}`);
  out.push(`- Failed assertions: ${summary.failed}`);
  out.push(`- Rows exposing real bugs (current behavior diverges from expected): ${summary.exposed_real_bugs}`);
  out.push("");
  out.push("Rows below are sorted by id for byte-deterministic output. Timing columns are advisory; the only blocking assertion on timing is `total_ms < 2 × bucket budget` (anti-flake rule 2).");
  out.push("");
  out.push("## Per-row results");
  out.push("");
  out.push("| id | bucket | faults | expected | actual | error_code | assertions |");
  out.push("|---|---|---|---|---|---|---|");
  for (const r of sorted) {
    const assertions = r.assertion_failures.length === 0 ? "OK" : r.assertion_failures.join("; ");
    out.push(
      `| ${r.row.id} | ${r.row.bucket} | ${faultsSummary(r.row)} | ${r.row.expected.outcome} | ${r.outcome} | ${r.error_code ?? ""} | ${assertions} |`,
    );
  }
  out.push("");

  const realBugs = sorted.filter((r) => r.exposed_real_bug);
  out.push("## Rows that exposed real bugs");
  out.push("");
  if (realBugs.length === 0) {
    out.push("_None — every row's observed behavior matched its expected outcome._");
  } else {
    for (const r of realBugs) {
      out.push(`- **${r.row.id}** (${r.row.bucket}): ${r.real_bug_note ?? "expected vs. observed mismatch"}`);
    }
  }
  out.push("");
  return out.join("\n");
}

export function writeReport(outDir: string, results: RowResult[], summary: ReportSummary): void {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "stress-results.csv"), renderCsv(results));
  fs.writeFileSync(path.join(outDir, "stress-summary.md"), renderMarkdown(results, summary));
}

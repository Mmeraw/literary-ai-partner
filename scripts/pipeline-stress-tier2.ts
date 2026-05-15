/**
 * scripts/pipeline-stress-tier2.ts
 *
 * Tier 2 pipeline stress harness — live OpenAI + live Perplexity against a
 * real long-form manuscript fixture. Companion to scripts/pipeline-stress.ts
 * (Tier 1 mocks); does NOT replace it.
 *
 * What this catches that Tier 1 cannot:
 *   - Real LLM refusals or shape variants on production-shaped prompts
 *   - Real Perplexity adjudicator timeouts / non-empty cross_check assertion
 *   - Pass 4 governance population on long-form (>25k word) route
 *   - Silent-skip class from prod eval 609dc776 (2026-05-13):
 *     "External adjudication mode 'required' requires cross-check output"
 *
 * Safety constraints:
 *   - Refuses to run against prod Supabase. Hard-aborts if SUPABASE_URL
 *     contains the prod project id `xtumxjnzdswuumndcbwc`.
 *   - Requires OPENAI_API_KEY and PERPLEXITY_API_KEY. Exits non-zero with a
 *     clear message if either is missing.
 *
 * Exit code: 0 iff every row in TIER2_SCENARIOS satisfies all assertions.
 */

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { runPipeline } from "@/lib/evaluation/pipeline/runPipeline";
import type { PipelineResult } from "@/lib/evaluation/pipeline/types";
import { chunkManuscript } from "@/lib/manuscripts/chunking";
import { TIER2_SCENARIOS, type Tier2Row } from "../tests/stress/tier2/scenarios";
import {
  LONG_FORM_CLAUSE_IDS,
  LONG_FORM_CLAUSE_TITLES,
  LONG_FORM_CLAUSE_TO_FAIL_CODE,
  formatClauseFailureMessage,
  type LongFormClauseId,
  type LongFormFailCode,
} from "@/tests/contract/long-form-contract";

const PROD_SUPABASE_PROJECT_ID = "xtumxjnzdswuumndcbwc";
const FIXTURES_DIR = path.resolve("tests/stress/tier2/fixtures/manuscripts");

interface ResolvedEnv {
  openaiKey: string;
  perplexityKey: string;
  supabaseUrl: string | null;
}

function abort(msg: string): never {
  console.error(`[stress-tier2] ABORT: ${msg}`);
  process.exit(2);
}

function resolveEnv(): ResolvedEnv {
  const openaiKey = process.env.OPENAI_API_KEY ?? "";
  const perplexityKey = process.env.PERPLEXITY_API_KEY ?? "";
  const rawSupabaseUrl = process.env.SUPABASE_STRESS_URL ?? process.env.SUPABASE_URL ?? "";
  const supabaseUrl = rawSupabaseUrl.trim().length > 0 ? rawSupabaseUrl : null;

  if (!openaiKey) abort("OPENAI_API_KEY is required for Tier 2 (live OpenAI).");
  if (!perplexityKey)
    abort("PERPLEXITY_API_KEY is required for Tier 2 (live Perplexity).");

  if (supabaseUrl && supabaseUrl.includes(PROD_SUPABASE_PROJECT_ID)) {
    abort(
      `SUPABASE_URL points at the production project (${PROD_SUPABASE_PROJECT_ID}). ` +
        "Tier 2 must run against a dev/preview Supabase only. Set SUPABASE_STRESS_URL " +
        "to a non-prod project before re-running.",
    );
  }

  return { openaiKey, perplexityKey, supabaseUrl };
}

function readFixture(fixtureName: string): string {
  const fullPath = path.join(FIXTURES_DIR, fixtureName);
  if (!fs.existsSync(fullPath)) {
    abort(`Fixture not found: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, "utf8");
}

export interface RunOutcome {
  row: Tier2Row;
  result: PipelineResult | null;
  total_ms: number;
  threw: Error | null;
}

const CLAUSE_IDS_BY_FAIL_CODE: Readonly<Partial<Record<LongFormFailCode, LongFormClauseId>>> =
  (() => {
    const byFailCode = Object.create(null) as Partial<Record<LongFormFailCode, LongFormClauseId>>;
    for (const clauseId of LONG_FORM_CLAUSE_IDS) {
      const code = LONG_FORM_CLAUSE_TO_FAIL_CODE[clauseId];
      byFailCode[code] = clauseId;
    }
    return Object.freeze(byFailCode);
  })();

function renderActual(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function formatTier2ClauseFailure(
  clauseId: LongFormClauseId,
  detail: string,
  failCodeOverride?: string,
): string {
  if (!failCodeOverride) {
    return formatClauseFailureMessage(clauseId, detail);
  }
  return `[${clauseId}] ${LONG_FORM_CLAUSE_TITLES[clauseId]} (${failCodeOverride}): ${detail}`;
}

function pushClauseFailure(args: {
  failures: string[];
  clauseId: LongFormClauseId;
  fieldPath: string;
  expected: string;
  actual: unknown;
  note?: string;
  failCodeOverride?: string;
}): void {
  const detail =
    `${args.fieldPath}; expected=${args.expected}; actual=${renderActual(args.actual)}` +
    (args.note ? `; ${args.note}` : "");
  args.failures.push(formatTier2ClauseFailure(args.clauseId, detail, args.failCodeOverride));
}

function pushUnmappedFailure(args: {
  failures: string[];
  label: string;
  failCode: string;
  fieldPath: string;
  expected: string;
  actual: unknown;
  note?: string;
}): void {
  const detail =
    `${args.fieldPath}; expected=${args.expected}; actual=${renderActual(args.actual)}` +
    (args.note ? `; ${args.note}` : "");
  args.failures.push(`[${args.label}] Unmapped pipeline failure (${args.failCode}): ${detail}`);
}

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

type PipelineFailureResult = Extract<PipelineResult, { ok: false }>;

type PipelineFailureMapping =
  | { kind: "clause"; clauseId: LongFormClauseId; failCodeOverride?: string }
  | { kind: "unmapped"; label: string; failCode: string };

function isPipelineFailureResult(result: PipelineResult | null): result is PipelineFailureResult {
  return !!result && !result.ok;
}

function fallbackClauseForFailedAt(failedAt: PipelineFailureResult["failed_at"]): LongFormClauseId {
  return failedAt === "pass1"
    ? "CLAUSE_3_PASS1_WITHIN_BUDGET"
    : failedAt === "pass2"
      ? "CLAUSE_4_PASS2_WITHIN_BUDGET"
      : failedAt === "pass3"
        ? "CLAUSE_5_PASS3_WITHIN_BUDGET"
        : "CLAUSE_8_QUALITY_GATE_PASSES";
}

function inferPipelineFailureMapping(result: PipelineResult | null): PipelineFailureMapping {
  if (!isPipelineFailureResult(result)) {
    return {
      kind: "clause",
      clauseId: "CLAUSE_11_TOTAL_RUNTIME_WITHIN_BUDGET",
      failCodeOverride: "NO_RESULT",
    };
  }

  const actualCode = result.error_code;
  const mappedClause = CLAUSE_IDS_BY_FAIL_CODE[actualCode as LongFormFailCode];
  if (mappedClause) {
    return { kind: "clause", clauseId: mappedClause };
  }

  if (actualCode === "LAYER_INCOMPLETE") {
    return { kind: "unmapped", label: "LAYER_INCOMPLETE", failCode: actualCode };
  }

  return {
    kind: "clause",
    clauseId: fallbackClauseForFailedAt(result.failed_at),
    failCodeOverride: actualCode,
  };
}

async function executeRow(row: Tier2Row, env: ResolvedEnv): Promise<RunOutcome> {
  const manuscriptText = readFixture(row.manuscript_fixture);
  // Use jobId convention shared with PR #484 (Pass 4 observability) so Tier 2
  // runs leave a greppable log trail in CI artifacts.
  const jobId = `stress-tier2-${row.id}-${randomUUID()}`;

  const startMs = Date.now();
  let result: PipelineResult | null = null;
  let threw: Error | null = null;

  try {
    // Materialize chunks before invoking runPipeline. Required by the
    // fail-closed chunk-routing assertion added in PR #490: runPipeline
    // rejects with CHUNK_ROUTING_NOT_ENGAGED when manuscriptChunks is
    // absent/empty on long-form input. Mirrors the Tier 1 harness pattern.
    const chunked = await chunkManuscript(manuscriptText);
    const manuscriptChunks = chunked.map((c) => ({
      chunk_index: c.chunk_index,
      content: c.content,
    }));

    result = await runPipeline({
      manuscriptText,
      manuscriptChunks,
      workType: row.work_type,
      title: `stress-tier2-${row.id}`,
      manuscriptId: jobId,
      jobId,
      openaiApiKey: env.openaiKey,
      perplexityApiKey: env.perplexityKey,
    });
  } catch (err) {
    threw = err instanceof Error ? err : new Error(String(err));
  }

  return {
    row,
    result,
    total_ms: Date.now() - startMs,
    threw,
  };
}

function isNonEmptyObject(v: unknown): boolean {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    Object.keys(v as Record<string, unknown>).length > 0
  );
}

export function assertRow(outcome: RunOutcome): string[] {
  const failures: string[] = [];
  const { row, result, total_ms, threw } = outcome;

  if (total_ms > row.expected.max_total_ms) {
    pushClauseFailure({
      failures,
      clauseId: "CLAUSE_11_TOTAL_RUNTIME_WITHIN_BUDGET",
      fieldPath: "timing.total_ms",
      expected: `<= ${row.expected.max_total_ms}`,
      actual: total_ms,
    });
  }

  if (row.expected.outcome === "success") {
    if (threw) {
      pushClauseFailure({
        failures,
        clauseId: "CLAUSE_11_TOTAL_RUNTIME_WITHIN_BUDGET",
        fieldPath: "pipeline.execution",
        expected: "no thrown error",
        actual: threw.message,
      });
      return failures;
    }
    if (!result || !result.ok) {
      const code =
        result && "error_code" in result
          ? (result as { error_code: string }).error_code
          : "no-result";
      const mapping = inferPipelineFailureMapping(result);

      if (mapping.kind === "clause") {
        pushClauseFailure({
          failures,
          clauseId: mapping.clauseId,
          fieldPath: "pipeline.outcome",
          expected: "success",
          actual: code,
          failCodeOverride: mapping.failCodeOverride,
        });
      } else {
        pushUnmappedFailure({
          failures,
          label: mapping.label,
          failCode: mapping.failCode,
          fieldPath: "pipeline.outcome",
          expected: "success",
          actual: code,
          note: "not mapped to one of the 12 numbered long-form clauses",
        });
      }
      return failures;
    }

    if (!Array.isArray(result.synthesis?.criteria) || result.synthesis.criteria.length === 0) {
      pushClauseFailure({
        failures,
        clauseId: "CLAUSE_9_SCORES_PRODUCED",
        fieldPath: "evaluation_result.synthesis.criteria",
        expected: "non-empty criteria array",
        actual: result.synthesis?.criteria,
      });
    }

    if (!hasNonEmptyString(result.synthesis?.overall?.one_paragraph_summary)) {
      pushClauseFailure({
        failures,
        clauseId: "CLAUSE_10_SUMMARIES_PRODUCED",
        fieldPath: "evaluation_result.synthesis.overall.one_paragraph_summary",
        expected: "non-empty summary string",
        actual: result.synthesis?.overall?.one_paragraph_summary,
      });
    }

    const coverageScope = result.synthesis?.coverage_scope;
    const coveragePct =
      coverageScope && coverageScope.sourceWords > 0
        ? (coverageScope.analyzedWords / coverageScope.sourceWords) * 100
        : null;
    if (coveragePct !== null && coveragePct < 100) {
      pushClauseFailure({
        failures,
        clauseId: "CLAUSE_2_COVERAGE_SUFFICIENT",
        fieldPath: "evaluation_result.synthesis.coverage_scope",
        expected: "coverage_pct >= 100",
        actual: coveragePct,
      });
    }

    if (row.expected.cross_check_required) {
      if (!isNonEmptyObject((result as { cross_check?: unknown }).cross_check)) {
        pushClauseFailure({
          failures,
          clauseId: "CLAUSE_7_CROSS_CHECK_PRESENT",
          fieldPath: "evaluation_result.cross_check",
          expected: "non-empty cross_check in required/veto mode",
          actual: (result as { cross_check?: unknown }).cross_check,
        });
      }
    }

    if (row.expected.pass4_governance_required) {
      if (
        !isNonEmptyObject(
          (result as { pass4_governance?: unknown }).pass4_governance,
        )
      ) {
        pushClauseFailure({
          failures,
          clauseId: "CLAUSE_6_PASS4_GOVERNANCE_PRESENT",
          fieldPath: "evaluation_result.pass4_governance",
          expected: "non-empty pass4_governance in required/veto mode",
          actual: (result as { pass4_governance?: unknown }).pass4_governance,
        });
      }
    }

  }

  return failures;
}

async function main(): Promise<number> {
  const env = resolveEnv();
  const supabaseLabel = env.supabaseUrl
    ? env.supabaseUrl.replace(/^https?:\/\//, "").split(".")[0]
    : "not-configured";
  console.log(
    `[stress-tier2] starting — ${TIER2_SCENARIOS.length} row(s), supabase=${supabaseLabel}`,
  );

  let passed = 0;
  let failed = 0;

  for (const row of TIER2_SCENARIOS) {
    process.stdout.write(`[stress-tier2] ${row.id.padEnd(28)} `);
    const outcome = await executeRow(row, env);
    const failures = assertRow(outcome);
    if (failures.length === 0) {
      passed += 1;
      process.stdout.write(`OK (${outcome.total_ms}ms)\n`);
    } else {
      failed += 1;
      process.stdout.write(`FAIL: ${failures.join("; ")}\n`);
      if (outcome.threw) {
        console.error(`  threw: ${outcome.threw.stack ?? outcome.threw.message}`);
      }
    }
  }

  console.log(
    `\n[stress-tier2] total=${TIER2_SCENARIOS.length} passed=${passed} failed=${failed}`,
  );
  return failed === 0 ? 0 : 1;
}

if (!process.env.JEST_WORKER_ID) {
  void main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error("[stress-tier2] uncaught:", err);
      process.exit(2);
    });
}

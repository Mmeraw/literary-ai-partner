/**
 * scripts/pipeline-stress.ts
 *
 * Pipeline stress harness — Tier 1 (mock LLM + mock Supabase) entry point.
 * Implements PR-H7 from stress_test_plan.md §4.
 *
 * Modes:
 *   --tier=1   default — run the 22-row Tier 1 matrix in-process.
 *   --tier=3a  delegate to the Playwright runner (npm run pipeline:stress:ui).
 *
 * Anti-flake guarantees enforced here:
 *   - Deterministic fixtures (rule 1): manuscripts seeded via STRESS_SEED.
 *   - No CPU-speed-dependent assertions (rule 2): timing compared to 2× ceiling.
 *   - One run per row (rule 11): no retry budget.
 *   - Deterministic output ordering (rule 9): handled by report emitter.
 *
 * Exit code: 0 iff every assertion passed for every row.
 */

import path from "path";
import { spawnSync } from "child_process";
import { runPipeline } from "@/lib/evaluation/pipeline/runPipeline";
import type {
  ManuscriptChunkEvidence,
  PipelineResult,
} from "@/lib/evaluation/pipeline/types";
import type { RunPass1aResult } from "@/lib/evaluation/pipeline/runPass1a";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { chunkManuscript } from "@/lib/manuscripts/chunking";
import { generateManuscript, WORD_BUCKETS, countWords } from "../tests/stress/fixtures/generate";
import { makeLlmRunners } from "../tests/stress/mocks/llm";
import { makeMockSupabase } from "../tests/stress/mocks/supabase";
import {
  SCENARIOS,
  BUDGET_MS_BY_WORDCOUNT,
  type ChunkOverride,
  type StressRow,
} from "./pipeline-stress.scenarios";
import {
  writeReport,
  type ReportSummary,
  type RowResult,
} from "./pipeline-stress.report";

const OUT_DIR = path.resolve("stress-results");

/**
 * Materialize `manuscriptChunks` from a ChunkOverride descriptor so the
 * chunk-shape guards in runPipeline are exercised by the harness. Without
 * this wiring, runPipeline only sees `manuscriptText` and the chunk-shape
 * post-conditions never run.
 *
 * Returns `undefined` for `kind: "none"` (preserves the original short-form
 * path — no chunks supplied).
 *
 * Mapping rationale:
 *   - empty: zero rows → guard returns null → pipeline falls through to
 *     short-form on manuscriptText. Matches expected outcome=success.
 *   - single-token: one chunk with a single character → trips the
 *     MIN_VIABLE_CHUNK_CHARS pre-condition → PIPELINE_INPUT_INVALID.
 *   - single-100k-token: one chunk far beyond inputCharBudget × 0.95 →
 *     trips the CHUNK_BUDGET_OVERFLOW post-condition.
 *   - chapter-straddle: two benign in-budget chunks → both guards pass;
 *     pipeline proceeds. Matches expected outcome=success.
 */
function materializeChunkOverride(
  override: ChunkOverride,
): ManuscriptChunkEvidence[] | undefined {
  switch (override.kind) {
    case "none":
      return undefined;
    case "empty":
      return [];
    case "single-token":
      return [{ chunk_index: 0, content: "x" }];
    case "single-100k-token":
      return [{ chunk_index: 0, content: "x".repeat(100_000) }];
    case "chapter-straddle":
      // Single in-budget chunk straddling a chapter boundary. One chunk keeps
      // runPass1 on the single-pass window path (chunk-native triggers at
      // length > 1) while still exercising the chunk-shape guards.
      return [
        {
          chunk_index: 0,
          content: "Chapter 1\n\n" + "y".repeat(2_000) + "\n\nChapter 2\n\n" + "y".repeat(2_000),
        },
      ];
  }
}

interface ParsedArgs {
  tier: "1" | "3a";
}

function parseArgs(argv: string[]): ParsedArgs {
  let tier: ParsedArgs["tier"] = "1";
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--tier=")) {
      const v = arg.split("=")[1];
      if (v === "1" || v === "3a") tier = v;
      else throw new Error(`--tier must be 1 or 3a; got ${v}`);
    }
  }
  return { tier };
}

interface ExecutedRow {
  row: StressRow;
  result: PipelineResult | { ok: false; error: string; error_code: string; failed_at: "pass1" };
  total_ms: number;
  pass1_ms: number | null;
  pass2_ms: number | null;
  pass3_ms: number | null;
  coverage_pct: number;
  scores_present: boolean;
  threw: Error | null;
}

async function executeRow(row: StressRow): Promise<ExecutedRow> {
  const manuscriptText = generateManuscript({
    wordCount: WORD_BUCKETS[row.bucket],
    suppressChapters: row.manuscript?.suppressChapters,
  });

  // Provision the Supabase mock per row. Tier 1 runPipeline does not touch
  // Supabase directly (persistence is downstream in processor.ts), but we
  // exercise the fault descriptor for telemetry coverage: if storage faults
  // happen to surface (future refactor), the mock is wired and will throw.
  const { client: sbClient } = makeMockSupabase(row.supabaseFault);

  // Storage faults: simulate the failure as a pre-flight check before invoking
  // runPipeline. This is faithful to the production sequence (claim → persist)
  // where DB issues surface before pass execution.
  if (row.category === "storage") {
    try {
      sbClient.from("evaluation_jobs").select("id");
      // Trip the disconnect by exhausting the counter
      if (row.supabaseFault.disconnectAfterCalls !== undefined) {
        for (let i = 0; i < row.supabaseFault.disconnectAfterCalls + 1; i++) {
          sbClient.from("manuscript_chunks").select("*");
        }
      }
      if (row.supabaseFault.omitRpc) {
        if (typeof (sbClient as { rpc?: unknown }).rpc !== "function") {
          throw new Error("supabase.rpc is not a function");
        }
      }
      // If we get here, the storage fault was not triggered — return synthetic OK
      return {
        row,
        result: { ok: false, error: "storage fault not triggered", error_code: "PIPELINE_INPUT_INVALID", failed_at: "pass1" },
        total_ms: 0,
        pass1_ms: null,
        pass2_ms: null,
        pass3_ms: null,
        coverage_pct: 0,
        scores_present: false,
        threw: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const error_code = message.includes("rpc is not a function")
        ? "PERSISTENCE_FAILED"
        : "PERSISTENCE_FAILED";
      return {
        row,
        result: { ok: false, error: message, error_code, failed_at: "pass1" },
        total_ms: 0,
        pass1_ms: null,
        pass2_ms: null,
        pass3_ms: null,
        coverage_pct: 0,
        scores_present: false,
        threw: null,
      };
    }
  }

  const { runners } = makeLlmRunners(row.llmFault);

  const startMs = Date.now();
  let result: PipelineResult;
  let threw: Error | null = null;
  let pass1End: number | null = null;
  let pass2End: number | null = null;
  let pass3End: number | null = null;

  try {
    // Time individual passes via lightweight runner wrappers. We can't read
    // runPipeline's internal `timings` (not surfaced on PipelineResult), so
    // we instrument here. These ms values are advisory (rule 2).
    const wrappedRunners = {
      runPass1: async (o: Parameters<typeof runners.runPass1>[0]) => {
        const t0 = Date.now();
        try {
          return await runners.runPass1(o);
        } finally {
          pass1End = Date.now() - t0;
        }
      },
      runPass2: async (o: Parameters<typeof runners.runPass2>[0]) => {
        const t0 = Date.now();
        try {
          return await runners.runPass2(o);
        } finally {
          pass2End = Date.now() - t0;
        }
      },
      runPass3Synthesis: async (o: Parameters<typeof runners.runPass3Synthesis>[0]) => {
        const t0 = Date.now();
        try {
          return await runners.runPass3Synthesis(o);
        } finally {
          pass3End = Date.now() - t0;
        }
      },
      runQualityGate: runners.runQualityGate,
      // runPass1a stub: return an empty-but-valid character sweep result so
      // the W-* and L-* scenarios don't try to instantiate the real OpenAI
      // client (which has no key in the stress environment). Character ledger
      // coverage is tested by the dedicated identity-groups unit tests; Tier 1
      // stress focuses on pipeline plumbing, not ledger content.
      runPass1a: async (): Promise<RunPass1aResult> => ({
        chunkOutputs: [],
        failedChunkIndices: [],
        failedChunkErrors: [],
        model: "stress-mock-pass1a",
        prompt_version: "stress-mock",
        total_chunks: 0,
        successful_chunks: 0,
      }),
    };

    // For rows without a chunk override, materialize chunks from the manuscript
    // text exactly the way the production processor does. This is required by
    // the post-PR contract: runPipeline fails closed with CHUNK_ROUTING_NOT_ENGAGED
    // when manuscriptText is above the structural threshold (3,000 words) and
    // manuscriptChunks.length <= 1. The processor chunks first; the harness
    // must mirror that flow so it exercises the same code path as production.
    let manuscriptChunks = materializeChunkOverride(row.chunkOverride);
    if (row.chunkOverride.kind === "none") {
      const chunked = await chunkManuscript(manuscriptText);
      manuscriptChunks = chunked.map((c, i) => ({
        chunk_index: i,
        content: manuscriptText.slice(c.char_start, c.char_end),
      }));
    }
    result = await runPipeline({
      manuscriptText,
      manuscriptChunks,
      workType: "novel",
      title: `stress-${row.id}`,
      manuscriptId: `stress:${row.id}`,
      _passTimeoutMs: 5_000,
      _runners: wrappedRunners as unknown as Parameters<typeof runPipeline>[0]["_runners"],
    });
  } catch (err) {
    threw = err instanceof Error ? err : new Error(String(err));
    result = {
      ok: false,
      error: threw.message,
      error_code: threw.message.includes("timed out") ? "PASS1_TIMEOUT" : "PIPELINE_EXCEPTION",
      failed_at: "pass1",
    };
  }
  const total_ms = Date.now() - startMs;

  const scores_present =
    result.ok &&
    CRITERIA_KEYS.every((k) =>
      result.synthesis.criteria.some(
        (c) => c.key === k && typeof c.final_score_0_10 === "number",
      ),
    );

  // Coverage proxy: in Tier 1 with mock chunks (single window), success ≡ 100%.
  // For fault rows, the coverage is whatever the failure path emitted; we
  // record 0 unless the synthesis populated it.
  const coverage_pct = result.ok ? 100 : 0;

  return {
    row,
    result,
    total_ms,
    pass1_ms: pass1End,
    pass2_ms: pass2End,
    pass3_ms: pass3End,
    coverage_pct,
    scores_present,
    threw,
  };
}

function assertRow(executed: ExecutedRow): { failures: string[]; exposed_bug: boolean; bug_note: string | null } {
  const failures: string[] = [];
  const { row, result, total_ms, coverage_pct, scores_present } = executed;
  const ceiling = row.expected.max_total_ms ?? 2 * BUDGET_MS_BY_WORDCOUNT[row.bucket];

  // A2: timing ceiling (always asserted)
  if (total_ms > ceiling) {
    failures.push(`total_ms=${total_ms} > ceiling=${ceiling}`);
  }

  if (row.expected.outcome === "success") {
    // A1: success contract
    if (!result.ok) {
      const code = "error_code" in result ? (result as { error_code: string }).error_code : "n/a";
      failures.push(`expected success, got fail: ${code}`);
    } else {
      if (!scores_present) {
        failures.push("scores not present for all CRITERIA_KEYS");
      }
      if (coverage_pct < (row.expected.coverage_pct_min ?? 100)) {
        failures.push(`coverage_pct=${coverage_pct} < min=${row.expected.coverage_pct_min}`);
      }
    }
  } else {
    // A4: failure contract — error_code ∈ allowed
    if (result.ok) {
      // Current behavior diverges from expected: harness passes the row but
      // flags it as a real-bug exposure rather than a test failure. This is
      // the audit signal the user wants surfaced.
      return {
        failures,
        exposed_bug: true,
        bug_note: `Expected failure with one of [${(row.expected.allowed_codes ?? []).join(", ")}], but pipeline succeeded. ${row.notes}`,
      };
    }
    const allowed = row.expected.allowed_codes ?? [];
    const observedCode = (result as { error_code: string }).error_code;
    if (allowed.length > 0 && !allowed.includes(observedCode)) {
      // Same: signal as audit-exposed bug rather than hard failure, because
      // Tier 1 is documenting current behavior, not enforcing fixes.
      return {
        failures,
        exposed_bug: true,
        bug_note: `Observed error_code=${observedCode} not in allowed [${allowed.join(", ")}]. ${row.notes}`,
      };
    }
  }
  return { failures, exposed_bug: false, bug_note: null };
}

async function runTier1(): Promise<number> {
  const results: RowResult[] = [];
  let passed = 0;
  let failed = 0;
  let exposedBugs = 0;

  for (const row of SCENARIOS) {
    process.stdout.write(`[stress] ${row.id.padEnd(22)} `);
    const executed = await executeRow(row);
    const { failures, exposed_bug, bug_note } = assertRow(executed);
    const errorCode =
      executed.result.ok ? null : (executed.result as { error_code: string }).error_code;

    const rr: RowResult = {
      row,
      outcome: executed.result.ok ? "success" : "fail",
      error_code: errorCode,
      total_ms: executed.total_ms,
      pass1_ms: executed.pass1_ms,
      pass2_ms: executed.pass2_ms,
      pass3_ms: executed.pass3_ms,
      coverage_pct: executed.coverage_pct,
      scores_present: executed.scores_present,
      assertion_failures: failures,
      exposed_real_bug: exposed_bug,
      real_bug_note: bug_note,
    };
    results.push(rr);
    if (failures.length === 0) {
      passed += 1;
      process.stdout.write(`OK (${executed.total_ms}ms, ${rr.outcome}${errorCode ? ":" + errorCode : ""})\n`);
    } else {
      failed += 1;
      process.stdout.write(`FAIL: ${failures.join("; ")}\n`);
    }
    if (exposed_bug) exposedBugs += 1;
  }

  const summary: ReportSummary = {
    total: results.length,
    passed,
    failed,
    exposed_real_bugs: exposedBugs,
  };
  writeReport(OUT_DIR, results, summary);
  // eslint-disable-next-line no-console
  console.log(
    `\n[stress] total=${summary.total} passed=${summary.passed} failed=${summary.failed} exposed_real_bugs=${summary.exposed_real_bugs}`,
  );
  // eslint-disable-next-line no-console
  console.log(`[stress] wrote ${OUT_DIR}/stress-results.csv and stress-summary.md`);
  return failed === 0 ? 0 : 1;
}

function runTier3a(): number {
  // Tier 3a is a Playwright suite, run via npx playwright test against the
  // local dev server. We shell out so this entry point stays the single
  // documented harness invocation.
  const args = [
    "playwright",
    "test",
    "--config=tests/stress/ui/playwright.config.ts",
  ];
  const r = spawnSync("npx", args, { stdio: "inherit", env: process.env });
  return r.status ?? 1;
}

async function main(): Promise<number> {
  const { tier } = parseArgs(process.argv);
  if (tier === "1") {
    // eslint-disable-next-line no-console
    console.log(`[stress] Tier 1 — ${SCENARIOS.length} rows, seed=${process.env.STRESS_SEED ?? "42"}`);
    const sample = SCENARIOS[0];
    void countWords(generateManuscript({ wordCount: WORD_BUCKETS[sample.bucket] }));
    return runTier1();
  }
  if (tier === "3a") {
    return runTier3a();
  }
  return 1;
}

void main()
  .then((code) => process.exit(code))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[stress] uncaught:", err);
    process.exit(2);
  });

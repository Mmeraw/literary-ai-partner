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
import { TIER2_SCENARIOS, type Tier2Row } from "../tests/stress/tier2/scenarios";

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

interface RunOutcome {
  row: Tier2Row;
  result: PipelineResult | null;
  total_ms: number;
  threw: Error | null;
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
    result = await runPipeline({
      manuscriptText,
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

function assertRow(outcome: RunOutcome): string[] {
  const failures: string[] = [];
  const { row, result, total_ms, threw } = outcome;

  if (total_ms > row.expected.max_total_ms) {
    failures.push(
      `total_ms=${total_ms} > max_total_ms=${row.expected.max_total_ms}`,
    );
  }

  if (row.expected.outcome === "success") {
    if (threw) {
      failures.push(`threw: ${threw.message}`);
      return failures;
    }
    if (!result || !result.ok) {
      const code =
        result && "error_code" in result
          ? (result as { error_code: string }).error_code
          : "no-result";
      failures.push(`expected success, got fail: ${code}`);
      return failures;
    }

    if (row.expected.cross_check_required) {
      if (!isNonEmptyObject((result as { cross_check?: unknown }).cross_check)) {
        failures.push(
          "evaluation_result.cross_check is missing or empty (silent-skip class)",
        );
      }
    }

    if (row.expected.pass4_governance_required) {
      if (
        !isNonEmptyObject(
          (result as { pass4_governance?: unknown }).pass4_governance,
        )
      ) {
        failures.push(
          "evaluation_result.pass4_governance is missing or empty",
        );
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

void main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("[stress-tier2] uncaught:", err);
    process.exit(2);
  });

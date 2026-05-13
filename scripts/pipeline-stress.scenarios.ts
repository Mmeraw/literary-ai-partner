/**
 * scripts/pipeline-stress.scenarios.ts
 *
 * The 22-row Tier 1 stress matrix, codified from stress_test_plan.md §1.1–§1.5.
 *
 * Out-of-scope for Tier 1 (listed in the runbook as Tier 4 future work):
 *   - K-sigterm and K-heartbeat-stop from §1.6 require worker-process-level
 *     fault injection (signal handling + heartbeat sweeper). Not implemented.
 *
 * Each row is a pure-data declaration. The harness reads this file and
 * mechanically dispatches each row's fault descriptor into the LLM and
 * Supabase mocks. Row ids match the IDs in the audit doc verbatim so
 * cross-referencing the CSV/markdown output against the audit is mechanical.
 */

import type { LlmFault } from "../tests/stress/mocks/llm";
import type { SupabaseFault } from "../tests/stress/mocks/supabase";
import type { WordBucket } from "../tests/stress/fixtures/generate";

/** Budgets (ms) from stress_test_plan.md §2.2. */
export const BUDGET_MS_BY_WORDCOUNT: Record<WordBucket, number> = {
  "W-5k": 60_000,
  "W-25k": 180_000,
  "W-60k": 360_000,
  "W-100k": 600_000,
  "W-137k": 720_000,
  "W-200k": 900_000,
};

export type ChunkOverride =
  | { kind: "none" }
  | { kind: "empty" } // C-empty
  | { kind: "single-token" } // C-single-tok
  | { kind: "single-100k-token" } // C-100k-tok
  | { kind: "chapter-straddle" }; // C-chapter-straddle

export type Outcome = "success" | "fail";

export interface ScenarioExpectation {
  outcome: Outcome;
  /** Allowed error codes when outcome === "fail". Empty when outcome === "success". */
  allowed_codes?: string[];
  /** Wall-time ceiling (ms). Defaults to 2× bucket budget for fault rows. */
  max_total_ms?: number;
  /** Minimum chunk-coverage percent. Default 100 for success. */
  coverage_pct_min?: number;
}

export interface StressRow {
  id: string;
  category: "wordcount" | "chunk" | "marker" | "llm" | "storage";
  bucket: WordBucket;
  /** Override the manuscript text generator. When omitted, uses bucket default. */
  manuscript?: { suppressChapters?: boolean };
  /** LLM fault injected via runPipeline._runners. */
  llmFault: LlmFault;
  /** Supabase fault simulated by the in-memory mock. */
  supabaseFault: SupabaseFault;
  /** Chunk-shape override. Not currently consumed by Tier 1 (mock-LLM bypass); recorded for telemetry. */
  chunkOverride: ChunkOverride;
  expected: ScenarioExpectation;
  notes: string;
}

const NO_LLM_FAULT: LlmFault = { kind: "none" };
const NO_SB_FAULT: SupabaseFault = {};
const NO_CHUNK_OVERRIDE: ChunkOverride = { kind: "none" };

/** §1.1 Word-count buckets — 6 rows */
const WORDCOUNT_ROWS: StressRow[] = (Object.keys(BUDGET_MS_BY_WORDCOUNT) as WordBucket[]).map((b) => ({
  id: b,
  category: "wordcount",
  bucket: b,
  llmFault: NO_LLM_FAULT,
  supabaseFault: NO_SB_FAULT,
  chunkOverride: NO_CHUNK_OVERRIDE,
  expected: { outcome: "success", coverage_pct_min: 100, max_total_ms: BUDGET_MS_BY_WORDCOUNT[b] },
  notes: `Happy path at ${b}; pipeline must complete under bucket budget.`,
}));

/** §1.2 Malformed chunks — 4 rows */
const CHUNK_ROWS: StressRow[] = [
  {
    id: "C-empty",
    category: "chunk",
    bucket: "W-25k",
    llmFault: NO_LLM_FAULT,
    supabaseFault: NO_SB_FAULT,
    chunkOverride: { kind: "empty" },
    expected: { outcome: "success", coverage_pct_min: 0, max_total_ms: 2 * BUDGET_MS_BY_WORDCOUNT["W-25k"] },
    notes: "Empty chunk row dropped by chunk-evidence filter; pipeline proceeds.",
  },
  {
    id: "C-single-tok",
    category: "chunk",
    bucket: "W-25k",
    llmFault: NO_LLM_FAULT,
    supabaseFault: NO_SB_FAULT,
    chunkOverride: { kind: "single-token" },
    expected: {
      outcome: "fail",
      allowed_codes: ["PASS1_TRUNCATED_EMPTY_RESPONSE", "PASS_SCHEMA_INVALID", "PIPELINE_INPUT_INVALID"],
      max_total_ms: 2 * BUDGET_MS_BY_WORDCOUNT["W-25k"],
    },
    notes: "Single-token chunk → mock LLM still returns healthy; harness flags as expected-fail-but-current-pass (audit row).",
  },
  {
    id: "C-100k-tok",
    category: "chunk",
    bucket: "W-100k",
    llmFault: NO_LLM_FAULT,
    supabaseFault: NO_SB_FAULT,
    chunkOverride: { kind: "single-100k-token" },
    expected: {
      outcome: "fail",
      allowed_codes: ["CHUNK_BUDGET_OVERFLOW", "PASS1_TIMEOUT"],
      max_total_ms: 2 * BUDGET_MS_BY_WORDCOUNT["W-100k"],
    },
    notes: "100k-token chunk should fast-fail via chunker post-condition (PR-H4 follow-up).",
  },
  {
    id: "C-chapter-straddle",
    category: "chunk",
    bucket: "W-60k",
    llmFault: NO_LLM_FAULT,
    supabaseFault: NO_SB_FAULT,
    chunkOverride: { kind: "chapter-straddle" },
    expected: { outcome: "success", coverage_pct_min: 0, max_total_ms: BUDGET_MS_BY_WORDCOUNT["W-60k"] },
    notes: "Chapter-straddle is advisory; pipeline still completes.",
  },
];

/** §1.3 Missing chapter markers — 1 row */
const MARKER_ROWS: StressRow[] = [
  {
    id: "M-no-chap",
    category: "marker",
    bucket: "W-137k",
    manuscript: { suppressChapters: true },
    llmFault: NO_LLM_FAULT,
    supabaseFault: NO_SB_FAULT,
    chunkOverride: NO_CHUNK_OVERRIDE,
    expected: { outcome: "success", coverage_pct_min: 0, max_total_ms: BUDGET_MS_BY_WORDCOUNT["W-137k"] },
    notes: "No chapter markers anywhere; chunker should still produce balanced chunks.",
  },
];

/** §1.4 LLM faults — 9 rows */
const LLM_ROWS: StressRow[] = [
  {
    id: "L-429",
    category: "llm",
    bucket: "W-25k",
    llmFault: { kind: "rate-limit", pass: 1 },
    supabaseFault: NO_SB_FAULT,
    chunkOverride: NO_CHUNK_OVERRIDE,
    expected: {
      outcome: "fail",
      allowed_codes: ["PASS1_FAILED", "PASS1_TIMEOUT"],
      max_total_ms: 2 * BUDGET_MS_BY_WORDCOUNT["W-25k"],
    },
    notes: "429 rate-limit on pass 1; per-chunk retry then PASS1_FAILED.",
  },
  {
    id: "L-500",
    category: "llm",
    bucket: "W-25k",
    llmFault: { kind: "server-error", pass: 1 },
    supabaseFault: NO_SB_FAULT,
    chunkOverride: NO_CHUNK_OVERRIDE,
    expected: {
      outcome: "fail",
      allowed_codes: ["PASS1_FAILED"],
      max_total_ms: 2 * BUDGET_MS_BY_WORDCOUNT["W-25k"],
    },
    notes: "5xx on pass 1 throws to caller (no retry); PASS1_FAILED.",
  },
  {
    id: "L-hang-30s",
    category: "llm",
    bucket: "W-25k",
    llmFault: { kind: "hang", pass: 1, ms: 30_000 },
    supabaseFault: NO_SB_FAULT,
    chunkOverride: NO_CHUNK_OVERRIDE,
    expected: {
      outcome: "fail",
      allowed_codes: ["PASS1_TIMEOUT", "PASS1_FAILED"],
      max_total_ms: 2 * BUDGET_MS_BY_WORDCOUNT["W-25k"],
    },
    notes: "30s hang reported via timed-out message; pipeline classifies as PASS1_TIMEOUT.",
  },
  {
    id: "L-hang-60s",
    category: "llm",
    bucket: "W-25k",
    llmFault: { kind: "hang", pass: 1, ms: 60_000 },
    supabaseFault: NO_SB_FAULT,
    chunkOverride: NO_CHUNK_OVERRIDE,
    expected: {
      outcome: "fail",
      allowed_codes: ["PASS1_TIMEOUT", "PASS1_FAILED"],
      max_total_ms: 2 * BUDGET_MS_BY_WORDCOUNT["W-25k"],
    },
    notes: "60s hang; pass classified as PASS1_TIMEOUT (default 60s wall on short-form).",
  },
  {
    id: "L-hang-90s",
    category: "llm",
    bucket: "W-137k",
    llmFault: { kind: "hang", pass: 1, ms: 90_000 },
    supabaseFault: NO_SB_FAULT,
    chunkOverride: NO_CHUNK_OVERRIDE,
    expected: {
      outcome: "fail",
      allowed_codes: ["PASS1_TIMEOUT", "PASS1_FAILED"],
      max_total_ms: 2 * BUDGET_MS_BY_WORDCOUNT["W-137k"],
    },
    notes: "90s hang on long-form completes under 720s wall in real prod; mock signals fast.",
  },
  {
    id: "L-empty-str",
    category: "llm",
    bucket: "W-25k",
    llmFault: { kind: "empty-string", pass: 1 },
    supabaseFault: NO_SB_FAULT,
    chunkOverride: NO_CHUNK_OVERRIDE,
    expected: {
      outcome: "fail",
      allowed_codes: ["PASS1_TRUNCATED_EMPTY_RESPONSE", "PASS1_FAILED"],
      max_total_ms: 2 * BUDGET_MS_BY_WORDCOUNT["W-25k"],
    },
    notes: "Empty string from LLM → PASS1_TRUNCATED_EMPTY_RESPONSE.",
  },
  {
    id: "L-empty-obj",
    category: "llm",
    bucket: "W-25k",
    llmFault: { kind: "empty-object", pass: 1 },
    supabaseFault: NO_SB_FAULT,
    chunkOverride: NO_CHUNK_OVERRIDE,
    expected: {
      outcome: "fail",
      allowed_codes: ["PASS_SCHEMA_INVALID", "PASS1_FAILED"],
      max_total_ms: 2 * BUDGET_MS_BY_WORDCOUNT["W-25k"],
    },
    notes: "Empty object → schema validation fails.",
  },
  {
    id: "L-truncated-json",
    category: "llm",
    bucket: "W-25k",
    llmFault: { kind: "truncated-json", pass: 1 },
    supabaseFault: NO_SB_FAULT,
    chunkOverride: NO_CHUNK_OVERRIDE,
    expected: {
      outcome: "fail",
      allowed_codes: ["PASS_JSON_BOUNDARY_FAILED", "PASS1_JSON_BOUNDARY_FAILED", "PASS1_FAILED"],
      max_total_ms: 2 * BUDGET_MS_BY_WORDCOUNT["W-25k"],
    },
    notes: "Truncated JSON tail → JSON boundary failure.",
  },
  {
    id: "L-finish-length",
    category: "llm",
    bucket: "W-25k",
    llmFault: { kind: "finish-length", pass: 1 },
    supabaseFault: NO_SB_FAULT,
    chunkOverride: NO_CHUNK_OVERRIDE,
    expected: {
      outcome: "fail",
      allowed_codes: ["empty_response_after_retry", "PASS1_FAILED"],
      max_total_ms: 2 * BUDGET_MS_BY_WORDCOUNT["W-25k"],
    },
    notes: "finish_reason=length one-bounded length-retry then empty_response_after_retry.",
  },
];

/** §1.5 Storage faults — 2 rows */
const STORAGE_ROWS: StressRow[] = [
  {
    id: "S-disconnect-mid-job",
    category: "storage",
    bucket: "W-25k",
    llmFault: NO_LLM_FAULT,
    supabaseFault: { disconnectAfterCalls: 2 },
    chunkOverride: NO_CHUNK_OVERRIDE,
    expected: {
      outcome: "fail",
      allowed_codes: ["PERSISTENCE_FAILED", "EVALUATION_FAILED", "PASS1_FAILED"],
      max_total_ms: 2 * BUDGET_MS_BY_WORDCOUNT["W-25k"],
    },
    notes: "Supabase disconnects after 2 calls; pipeline must fail closed.",
  },
  {
    id: "S-rpc-not-function",
    category: "storage",
    bucket: "W-5k",
    llmFault: NO_LLM_FAULT,
    supabaseFault: { omitRpc: true },
    chunkOverride: NO_CHUNK_OVERRIDE,
    expected: {
      outcome: "fail",
      allowed_codes: ["PERSISTENCE_FAILED", "PIPELINE_EXCEPTION", "EVALUATION_FAILED"],
      max_total_ms: 2 * BUDGET_MS_BY_WORDCOUNT["W-5k"],
    },
    notes: "Mock omits .rpc — replicates PR #470 CI failure mode.",
  },
];

export const SCENARIOS: StressRow[] = [
  ...WORDCOUNT_ROWS,
  ...CHUNK_ROWS,
  ...MARKER_ROWS,
  ...LLM_ROWS,
  ...STORAGE_ROWS,
];

if (SCENARIOS.length !== 22) {
  throw new Error(
    `Stress matrix must have exactly 22 rows (Tier 1 spec); got ${SCENARIOS.length}. ` +
      `Update stress_test_plan.md §1 if intentional.`,
  );
}

# Pipeline Stress Harness — Runbook

Companion to [`stress_test_plan.md`](./stress_test_plan.md). This document is
the operator's guide to the `npm run pipeline:stress` harness shipped in
PR-H7 of the stress plan.

## What this is

A deterministic, mocked-LLM, mocked-Supabase regression harness for the
evaluation pipeline. It runs a 22-row input matrix through `runPipeline`
via the existing `_runners` dependency-injection seam, captures observed
outcomes and error codes, asserts them against expected behavior, and
emits a CSV + markdown report. Rows where current production behavior
diverges from the expected contract are flagged as "exposed real bugs" —
they do not fail the harness, they document the audit gap.

The companion Tier 3a layer runs Playwright against the local Next.js dev
server to verify the `/evaluate/[jobId]` rendering path is reachable and
free of console errors.

## Tiers

| Tier | Status | What it covers |
|---|---|---|
| **T1** Tier 1 plumbing (this PR) | active | 22 rows: word-count buckets, malformed chunks, missing chapter markers, LLM faults, storage faults. Mock LLM, in-memory Supabase. |
| T2 quality (future PR) | not implemented | Live OpenAI calls against the same matrix; calibration vs golden references. |
| **T3a** UI seeded (this PR) | partial — see below | Playwright against the dev server. Layer A: dev server health smoke. Layer B (U1–U7 fixture suite): scaffolded as `test.skip()`; deferred to follow-up PR that adds the SSR-mock injection seam. |
| T3b UI E2E (future PR) | not implemented | Full upload → evaluate → render path with mocked LLM but real chunker. |
| T4 worker faults (future PR) | not implemented | K-sigterm and K-heartbeat-stop from §1.6 — require worker-process-level fault injection. |

## How to run locally

```bash
# Tier 1 — in-process matrix
npm run pipeline:stress

# Tier 3a — Playwright against the dev server.
# Start the dev server in a separate shell first, then:
npm run pipeline:stress:ui
```

Stub envs required for the dev server are documented in
`.github/workflows/pipeline-stress.yml`. None are real secrets; they are
placeholders that satisfy the middleware's presence checks.

## How to read the output

Both tiers write to `./stress-results/` (gitignored except `.gitkeep`).

### Tier 1

- `stress-results/stress-results.csv` — one row per matrix row, sorted by id (deterministic byte-order, anti-flake rule 9). Columns:
  `id, bucket, category, faults_summary, expected_outcome, outcome, error_code, coverage_pct, scores_present, assertion_failures, total_ms, pass1_ms, pass2_ms, pass3_ms`.
  The first 10 columns are byte-deterministic; the last 4 (`*_ms`) are
  advisory and vary by CPU.
- `stress-results/stress-summary.md` — human-readable summary with:
  - top-of-file totals (passed / failed / exposed-real-bugs),
  - per-row table sorted by id,
  - a final section "**Rows that exposed real bugs**" listing audit gaps.

A row appears under "exposed real bugs" when the observed outcome or
error code differs from `expected`. These are signals for future
hardening PRs (PR-H3, PR-H4, etc.), not test failures.

### Tier 3a

- `stress-results/ui/playwright-results.json` — Playwright JSON reporter
  output.
- `stress-results/ui/*.png` — screenshots (only on failure; advisory).

## How to add a new row

1. Add a new entry to `scripts/pipeline-stress.scenarios.ts` in the
   matching category section.
2. Pick a row id that doesn't collide; follow the convention
   `<category-prefix>-<descriptor>` (e.g. `L-rate-limit-pass2`).
3. Choose a `bucket` from `WORD_BUCKETS`.
4. Set `llmFault`, `supabaseFault`, and `chunkOverride` per the new
   fault scenario.
5. Set `expected.outcome` and `expected.allowed_codes` (for failures).
6. Set `expected.max_total_ms` to a value at least 2× the bucket budget
   if the row is a fault row (anti-flake rule 2).
7. Update the assertion at the bottom of `scenarios.ts` if the row count
   changes (the harness checks `SCENARIOS.length === 22` at import time
   — bump it when you intentionally change the matrix size).
8. Document the new row in `stress_test_plan.md` §1.

## Mock LLM fault injection

The mock LLM lives at `tests/stress/mocks/llm.ts`. It implements the
three runner functions the production pipeline accepts via the
`_runners` DI seam on `runPipeline`. Faults are injected by passing a
`LlmFault` descriptor to `makeLlmRunners()`.

Fault descriptor shape (from `LlmFault` union):

```ts
{ kind: "none" }
{ kind: "rate-limit",    pass: 1 | 2 | 3 }
{ kind: "server-error",  pass: 1 | 2 | 3 }
{ kind: "hang",          pass: 1 | 2 | 3, ms: number }
{ kind: "empty-string",  pass: 1 | 2 | 3 }
{ kind: "empty-object",  pass: 1 | 2 | 3 }
{ kind: "truncated-json",pass: 1 | 2 | 3 }
{ kind: "finish-length", pass: 1 | 2 | 3 }
```

Each fault scenario corresponds to one of the canned JSON files under
`tests/stress/mocks/responses/`. The JSON files are an auditable
reference; the actual response shape is built by typed factories in
`llm.ts`. **If you change a factory, update its matching JSON
reference** — drift is a contract bug.

### Hang faults are not actually slept

A `hang` fault rejects immediately with an error message of the form
`pass{N} timed out after {MS}ms`. The pipeline classifies failures by
message substring (`.includes("timed out")`), so the harness reaches
the same classification path without spending real time. This is
deliberate and documented per anti-flake rule 4(b).

Set `STRESS_FAST_RETRY=1` in CI (already wired in
`.github/workflows/pipeline-stress.yml`) to make any production-side
backoff loops resolve quickly during the run.

## Mock Supabase

The mock client lives at `tests/stress/mocks/supabase.ts`. It exposes
the minimum surface that `runPipeline` and its downstream readers touch:
`.from(table).select/insert/update/upsert/eq/order/limit`, `.single()`,
`.maybeSingle()`, and conditionally `.rpc()`.

Fault descriptor shape:

```ts
{ disconnectAfterCalls?: number }  // throws "supabase: connection lost" after N builder calls
{ omitRpc?: boolean }              // omits .rpc — simulates PR #470 mock-shape regression
```

Production never reaches a real Supabase URL during the Tier 1 run.

## Anti-flake commitments

The harness enforces every rule from the stress-harness directive:

1. **Deterministic fixtures** — manuscripts generated from `STRESS_SEED`
   (default `42`). No `Date.now()`, no unseeded `Math.random()`, no
   `process.hrtime()`.
2. **Generous timing ceiling** — assertions compare against `2 ×
   BUDGET_MS_BY_WORDCOUNT[bucket]`; the actual `total_ms` is recorded
   in the CSV but not asserted.
3. **Pre-canned response files** — `tests/stress/mocks/responses/*.json`.
4. **Deterministic mock latency** — hang faults reject immediately;
   `STRESS_FAST_RETRY=1` shortens production-side backoff.
5. **Playwright hardening** — single worker, `retries: 0`, explicit
   viewport `1280x720`, `TZ=UTC`, `locale=en-US`, reduced-motion forced,
   animations zeroed via injected CSS, `@playwright/test` pinned exactly
   (no `^` or `~`).
6. **Network determinism** — every Playwright test routes outbound
   non-localhost requests to `route.abort()`.
7. **Zero non-localhost network** — `NEXT_PUBLIC_DISABLE_TELEMETRY=1` is
   set by the CI workflow; tests fail if the page tries to reach the
   internet.
8. **Stable selectors** — required UI assertions target `data-testid` or
   the production source text. No class-name or `nth-child` matches.
9. **Deterministic output ordering** — CSV and markdown emitters sort
   rows by id, not execution order.
10. **Zero retry budget in CI** — `retries: 0` in `playwright.config.ts`;
    no Jest retries; no per-row redo in the Tier 1 driver.
11. **One run per row.**
12. **Documented residual nondeterminism** — see "Known nondeterminism"
    below.
13. **Pre-PR smoke run** — three back-to-back runs verified
    byte-identical (modulo timing columns) before opening this PR.

### Known nondeterminism

- The production pipeline emits `[Pipeline][Timings]` `console.log`
  output via `lib/evaluation/pipeline/runPipeline.ts` (function
  `logPipelineTimings`). These log lines contain millisecond timings and
  will differ between runs. **The CSV/markdown artifacts that the
  harness writes are deterministic**; only the harness stdout is not.
  If you diff stress runs, diff the artifact files, not the stdout.
- Playwright's `page.goto()` returns whatever response the dev server
  produces. We assert only on status class (`< 500`) and on
  `console.error` absence, not on exact status numbers, because Next.js
  may legitimately return 200 or 307 depending on middleware state.

## Future work

- **Tier 2 — live OpenAI runtime mode.** Drop in a real OpenAI client
  for a subset of rows; assert calibration against reference outputs in
  `tests/evaluation/benchmarks/`. Out of scope for this PR (no live API
  calls, per locked decision).
- **Tier 3a Layer B — seeded-fixture UI matrix (U1–U7).** Requires a
  test-only SSR-mock injection seam on the `/evaluate/[jobId]` data
  loader. Fixtures at `tests/stress/ui/seeded-fixtures/` are already
  authored; the follow-up PR un-skips the corresponding tests.
- **Tier 3b — full E2E.** Browser-driven upload → evaluate → render with
  mocked LLM but real chunker + persistence.
- **Tier 4 — worker faults.** K-sigterm and K-heartbeat-stop from
  `stress_test_plan.md` §1.6 require worker-process-level fault
  injection (signal handling + heartbeat sweeper). Author once the
  stale-job sweeper lands.
- **CI promotion to required check.** This workflow ships as advisory.
  After a 2-week soak with zero false positives, the parent agent
  promotes it to the required ruleset 15734162 alongside
  `sipoc-certification`.

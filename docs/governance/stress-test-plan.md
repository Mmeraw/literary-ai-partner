# Stress Test Plan — Evaluation Pipeline Hardening
**Companion to `critical_path_audit.md`. AUDIT ONLY — no implementation.**

This document specifies an input matrix, a `npm run pipeline:stress` harness shape, fixture mapping, and a 6-PR hardening sequence.

---

## 1. Input Matrix

For each row: which guard *should* fire, the expected observable, and what the current code on `main` actually produces (derived from the trace in `critical_path_audit.md` §3–§6).

### 1.1 Word-count buckets

| ID | Words | Chunks expected | Guard that should fire | Expected observable | Current behavior on `main` |
|---|---|---|---|---|---|
| W-5k | 5 000 | 0 (short-form) | none | Job completes; `route='short_form'` | ✓ As expected |
| W-25k | 25 000 | ≥ 2 (threshold = 25 000) | none | Long-form path, full chunk coverage | ✓ As expected |
| W-60k | 60 000 | 2–3 | Pass timeout budget honored | Completes < 600 s | ✓ Usually completes |
| W-100k | 100 000 | 3–4 | Coverage gate (target) | Completes with `coverage_summary.fully_evaluated=true` | ✗ May silently truncate if single chunk > 40 000 chars; `coverage.truncated=true` is set but does not fail the job |
| **W-137k** | 137 758 | 3+ | Pass timeout (`LONG_FORM_TIMEOUT_FLOOR_MS=720_000`) | Either completes or fails closed with `PASS1_TIMEOUT` | ✗ **PASS1_TIMEOUT after 720 s** (Cartel Babies). Underlying LLM request continues (no AbortController). |
| W-200k | 200 000 | 4+ | Pass timeout, chunk cap | Completes via chunking, or fails closed | ✗ Likely `PASS1_TIMEOUT` with no abort propagation; `analyzedWords` in telemetry would be ~scaled to evaluated chunks |

### 1.2 Malformed chunks

| ID | Scenario | Should fire | Expected | Current |
|---|---|---|---|---|
| C-empty | Empty string chunk in `manuscript_chunks` table | Chunk-evidence filter (`processor.ts:1846-1848`) drops zero-length | Job proceeds with remaining chunks | ✓ Caught (drops empty rows) |
| C-single-tok | 1-token chunk | Pass 1 returns trivial / parse error | `JsonBoundaryError` → `PASS1_TRUNCATED_EMPTY_RESPONSE` | Possibly caught; LLM may also return generic text |
| C-100k-tok | A single chunk of 100 000 tokens (~400 000 chars) | **Should be rejected at chunker post-condition** (recommendation #4) | Fast fail `CHUNK_BUDGET_OVERFLOW` | ✗ **No such gate exists.** `buildPromptInputWindow` will silently truncate to 40 000 chars; pass succeeds with partial evidence |
| C-chapter-straddle | Chunk boundary in the middle of a chapter | Coverage telemetry advisory only | Job completes with possible coherence loss | ✗ No coherence check — same as no-straddle |

### 1.3 Missing chapter markers

| ID | Scenario | Should fire | Expected | Current |
|---|---|---|---|---|
| M-no-chap | No `\nChapter ` anywhere in 137k-word text | Chunker should still produce balanced chunks by char/word boundary | Long-form route succeeds | ✓ Likely caught (chunker is not chapter-dependent; uses size/overlap config) |

### 1.4 LLM faults

| ID | Fault | Should fire | Expected | Current |
|---|---|---|---|---|
| L-429 | OpenAI 429 rate limit | Per-chunk retry loop | Retry with exponential backoff up to `chunkRetryMax`, then `PASS1_FAILED` | ✓ Caught (`runPass1.ts:413-431`) |
| L-500 | OpenAI 5xx | Throw to caller | `PASS1_FAILED` (no retry for 5xx) | ✓ Caught (job-fatal). **Gap:** no auto-retry for 5xx; user must re-enqueue |
| L-hang-30s | Request hangs 30 s, then returns | `withTimeout` wall is per-pass (720 s long-form, 60 s default) | Completes normally | ✓ Pass returns within wall |
| L-hang-60s | Request hangs 60 s, then returns | same | Completes normally for long-form; **`DEFAULT_PASS_TIMEOUT_MS=60_000` fires** for short-form unless override | ⚠ Short-form would `PASS1_TIMEOUT` at 60 s |
| L-hang-90s | Request hangs 90 s, then returns | Long-form wall 720 s — completes; short-form fails | Job emits `PASS1_TIMEOUT` for short-form | ⚠ Same as above |
| L-empty-str | LLM returns `""` | `JsonBoundaryError` path | `PASS1_TRUNCATED_EMPTY_RESPONSE` (per s05) | ✓ Caught |
| L-empty-obj | LLM returns `"{}"` | Schema validation fails | `PASS{N}_SCHEMA_INVALID` or `PASS{N}_FAILED` | ✓ Caught |
| L-truncated-json | LLM returns valid prefix + truncated tail | `JsonBoundaryError` candidate detection | `PASS{N}_JSON_BOUNDARY_FAILED` with `raw_head`, `raw_tail` diagnostics | ✓ Caught (`runPipeline.ts:840-857`) |
| L-finish-length | `finish_reason=length` | Single bounded length-retry | One retry; if it fails again → `empty_response_after_retry` | ✓ Caught (`runPass1.ts`, `runPass2.ts:613`) |

### 1.5 Storage faults

| ID | Fault | Should fire | Expected | Current |
|---|---|---|---|---|
| S-disconnect-mid-job | Supabase RPC connection drop mid-pipeline | DB error bubbles to `markFailed` | `PERSISTENCE_FAILED` or `EVALUATION_FAILED` (no specific code for mid-job loss) | ⚠ Partial — the fallback double-write path (`processor.ts:1655-1664`) helps for the final write, but mid-pipeline reads (chunk evidence reload) are unprotected |
| S-rpc-not-function | `supabase.rpc is not a function` (the exact PR #470 CI error) | Job claim fails before processor runs | Worker logs and moves on | ⚠ In CI tests, this exact error fires because mocks omit `.rpc`. In prod it should never occur. **Test signal:** the mock-shape mismatch hides whether the claim path itself is robust. |

### 1.6 Worker faults

| ID | Fault | Should fire | Expected | Current |
|---|---|---|---|---|
| K-sigterm | Worker receives SIGTERM mid-pass | Heartbeat staleness detector + job reclaim | Job re-enqueued by stale-heartbeat sweeper | ⚠ Heartbeat is written but no scan job is observed in the audited `lib/jobs/**` paths. Reclaim story is fuzzy. |
| K-heartbeat-stop | Heartbeat fails to update for > N seconds | Stale-job detector | Job marked failed or reclaimed | ⚠ Same gap |

---

## 2. `npm run pipeline:stress` — Specification (do not implement)

### 2.1 Shape

```
scripts/pipeline-stress.ts          # entry point
scripts/pipeline-stress.scenarios.ts # the input matrix in code
scripts/pipeline-stress.report.ts    # CSV + markdown emitters
```

`scripts/pipeline-stress.ts`:

1. Reads the matrix (1.1–1.6).
2. For each row, calls `processEvaluationJob({ jobId: synthetic, …, _injectFaults: <row.faults> })` with:
   - A **mocked LLM client** wired through `lib/llm/client.ts`. Fault map is read from an env var (e.g. `STRESS_FAULTS_JSON`), keyed by `{pass}:{call_index}`.
   - A **mocked Supabase client** at `lib/db/supabase.ts` exposing `.from(...).select/insert/update`, `.rpc(...)`. Mock honors row 1.5 to simulate disconnects.
   - A **chunker override** injected as `_chunksOverride` to bypass real chunker for malformed-chunk scenarios.
3. After each run, gathers:
   - `chunk_coverage_pct` from the persisted progress.
   - All `report.scores.*` fields (must be non-null on success).
   - `total_ms` and `pass{1,2,3}_ms` from `timings`.
   - Whether `buildPromptInputWindow` was called with `text.length > inputCharBudget` (instrumented hook).
4. Asserts:
   - **A1** Success rows: `chunk_coverage_pct === 100.0`, `report.scores[k]` non-null for all `k` in `CRITERIA_KEYS`, `total_ms < BUDGET_MS_BY_WORDCOUNT[bucket]`.
   - **A2** No silent truncation: `buildPromptInputWindow` is never called with full-manuscript text (call site has `params.manuscriptText.length <= effectiveMaxChars OR the call is on a chunk known to fit`).
   - **A3** On injected fault: pipeline degrades, doesn't hang. `total_ms < 2 × BUDGET_MS_BY_WORDCOUNT[bucket]`.
   - **A4** Failure rows: `error_code ∈ allowed_codes_for_row` (e.g., `PASS1_TIMEOUT` for W-137k+L-hang-90s with a mock that hangs past the wall).
5. Emits `stress-results.csv` + `stress-summary.md`.
6. Exit non-zero if any assertion regresses.

### 2.2 Budgets

| Bucket | `BUDGET_MS_BY_WORDCOUNT` |
|---|---|
| W-5k | 60 000 |
| W-25k | 180 000 |
| W-60k | 360 000 |
| W-100k | 600 000 |
| W-137k | 720 000 |
| W-200k | 900 000 |

### 2.3 Fault injection points (existing seams — verify before adding new ones)

| Seam | Existing? | Mechanism |
|---|---|---|
| `lib/llm/client.ts` (env-var-controlled fault map) | TBD — confirm path | Read `STRESS_FAULTS_JSON`; intercept `chat.completions.create` and respond per matrix |
| `lib/evaluation/pipeline/chunker.ts` (injectable chunk override) | Path exists (chunker referenced via `ensureChunksFromText`); injection seam may need to be added through `runPipeline` `_runners` | Add optional `_chunkOverride` symmetric to existing `_runners` overrides in `runPipeline.ts:545` |
| `lib/db/supabase.ts` (mock client passthrough) | Likely exists in tests | Reuse the mock used in `tests/day1-evaluation-ui.test.ts` |

### 2.4 CI wiring (proposed, not implemented)

Add a separate workflow `pipeline-stress.yml` triggered on PRs touching `lib/evaluation/**`, `lib/jobs/**`. Mark as required after a 2-week soak.

---

## 3. Mapping rows → SIPOC fixtures

| Matrix row | Closest SIPOC fixture | Notes |
|---|---|---|
| W-5k, W-25k | (no SIPOC coverage for "happy path") | Pass-row contracts exist only for s02/s03. Consider an explicit happy-path fixture. |
| W-60k, W-100k | s04 (coverage mismatch shape) | Adjacent but not identical |
| **W-137k** | **s05 — direct match** | `pass1_finish_reason: "length"`, `must_fail_closed: true`, `required_failure_codes: ["PASS1_TIMEOUT", "PASS1_TRUNCATED_EMPTY_RESPONSE"]` |
| W-200k | s04 + s05 (joint) | Coverage mismatch overlaid with timeout |
| C-empty | s01 (intake missing required input) — adjacent | Not identical: s01 is missing-input, not empty-content-chunk |
| C-single-tok | no SIPOC coverage | New fixture warranted |
| **C-100k-tok** | **s04 (`s04_pass1_fail_closed_on_coverage_mismatch`)** — adjacent | s04 is about chunk count, not chunk size — distinction worth a new fixture |
| C-chapter-straddle | no SIPOC coverage | New fixture warranted |
| M-no-chap | no SIPOC coverage | New fixture warranted |
| L-429 | no SIPOC coverage | New fixture warranted; live in s05 family (rate-limit retry contract) |
| L-500 | no SIPOC coverage | New fixture |
| L-hang-30s, L-hang-60s, L-hang-90s | **s05** | Spans the timeout invariant |
| L-empty-str | **s05** (`PASS1_TRUNCATED_EMPTY_RESPONSE`) | direct |
| L-empty-obj | s06 (Pass 2 independence violation) — adjacent | Different stage |
| L-truncated-json | **s05** family | `JsonBoundaryError` codes belong here |
| L-finish-length | **s05** | direct |
| S-disconnect-mid-job | s10 (persistence fail closed on gate fail) — adjacent | s10 is about gate-fail persistence atomicity; mid-job RPC drop is broader |
| S-rpc-not-function | no SIPOC coverage | The actual CI error from PR #470 has no fixture |
| K-sigterm | s03 (claim atomicity) — adjacent | s03 covers atomic claim; mid-pass SIGTERM is unmapped |
| K-heartbeat-stop | no SIPOC coverage | New fixture |

**Summary:** s05 covers ~6 high-risk rows in the matrix. s04 and s10 cover adjacent rows. ~9 rows have **no SIPOC coverage** and are candidates for new fixtures.

---

## 4. Hardening PR sequence (proposed)

In merge order. Each is small and reversible.

### PR-H1 — Make SIPOC certification mandatory and broaden trigger paths
- **Intent:** Bind the SIPOC workflow to changes that can actually break it.
- **Targets:** `.github/workflows/sipoc-certification.yml:3-21` (add `lib/evaluation/**`, `lib/jobs/**` to `paths:`); branch-protection ruleset 15734162 contexts (add `sipoc-certification`).
- **Closes:** Doesn't directly close any stress row, but it gates every future row.
- **Effort:** S

### PR-H2 — Wire SIPOC harness to runtime
- **Intent:** Make `npm run sipoc:harness` actually exercise `runPipeline` for `result_type==="fail"` fixtures.
- **Targets:** `scripts/run-sipoc-harness.ts` (add `runtime` mode after line 200); `package.json` (`sipoc:harness:runtime`).
- **Closes:** L-empty-str, L-truncated-json, L-finish-length via s05 enforcement.
- **Effort:** M

### PR-H3 — Coverage-vs-truncation hard gate
- **Intent:** If `coverage.truncated === true` for any pass, fail the job with `PASS{N}_COVERAGE_TRUNCATION_INCOMPLETE`.
- **Targets:** New gate after `runPipeline` returns in `processor.ts:~2000`; reuse signals at `runPipeline.ts:267-272`.
- **Closes:** W-100k silent-completion, C-100k-tok silent-completion (matches user's CHUNKING-ISSUE doc).
- **Effort:** S

### PR-H4 — Chunker post-condition: max chunk chars ≤ `inputCharBudget` × 0.95
- **Intent:** Make the slow failure (720 s timeout) fast (sub-second).
- **Targets:** `processor.ts:889-947` (extend `maybeEnsureLongFormChunks`); `ensureChunksFromText` post-validation.
- **Closes:** **W-137k** (Cartel Babies class), C-100k-tok.
- **Effort:** S

### PR-H5 — AbortController plumbing
- **Intent:** When `withTimeout` rejects, abort the in-flight LLM request rather than leaking the slot.
- **Targets:** `runPipeline.ts:165-182` (replace `withTimeout` with abort-aware variant); LLM client (`lib/llm/client.ts`) accepts `signal`.
- **Closes:** L-hang-30s through L-hang-90s under faulted workers.
- **Effort:** M

### PR-H6 — Typed `TimeoutError` instead of message sniffing
- **Intent:** Stop relying on `message.includes("timed out")` to classify the failure code.
- **Targets:** `runPipeline.ts:162-182, 836-866` (introduce `class TimeoutError extends Error` and `instanceof` check).
- **Closes:** silent regression class (label drift breaks classification).
- **Effort:** S

### PR-H7 — Stress harness (this plan, codified)
- **Intent:** Add `npm run pipeline:stress` + `pipeline-stress.yml` workflow per §2.
- **Targets:** New `scripts/pipeline-stress*.ts`; new workflow file.
- **Closes:** All rows gain regression coverage.
- **Effort:** L

### PR-H8 — Replay-harness binding to SIPOC failure matrix
- **Intent:** Replay anonymized failures; flag any production failure missing a SIPOC fixture.
- **Targets:** `.github/workflows/replay-harness.yml`; new `scripts/replay-failure-matrix.ts`.
- **Closes:** S-disconnect-mid-job, K-sigterm via forced fixture authorship.
- **Effort:** M

### PR-H9 — Scope-aware timeout floor adjustment
- **Intent:** Drop 720 s floor when chunk count ≤ 3 *and* median chunk chars ≤ 38 000.
- **Targets:** `lib/config/evaluationRuntimeConfig.ts:82`; `resolveScopedEvaluationTimeouts`.
- **Closes:** Operational latency for medium-sized inputs.
- **Effort:** S

### PR-H10 — Add missing SIPOC fixtures (s12+)
- **Intent:** Author fixtures for the 9 rows with "no SIPOC coverage" in §3.
- **Targets:** `tests/fixtures/sipoc/s12_*.json` … `s20_*.json`; bump `schema.json` if needed.
- **Closes:** L-429, L-500, C-single-tok, C-chapter-straddle, M-no-chap, S-rpc-not-function, K-sigterm, K-heartbeat-stop.
- **Effort:** M (one fixture each)

---

## 5. Cross-references

- `critical_path_audit.md` §6 — defines the chunk-materialization vs coverage-vs-truncation distinction this plan operationalizes.
- `critical_path_audit.md` §7 — top-10 recommendations 1, 2, 3, 4 correspond to PRs H1, H2, H3, H4 respectively.

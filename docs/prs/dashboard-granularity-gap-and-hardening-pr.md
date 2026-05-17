# `/admin/pipeline-health` — Granularity Gap & Hardening PR Proposal

**Date:** 2026-05-13
**Sources:** Live page inventory + 11-step SIPOC contract (user framing 2026-05-13 10:46 MST) + repo SIPOC fixtures s01..s11 on branch `docs/pr-c-design`.
**Page snapshot:** `pipeline_health_dashboard_2026-05-13.jpg`
**Companion inventory:** `pipeline_health_audit_2026-05-13.md`

---

## 1. The principle (your formulation, locked)

> Every input to a process step has a metric assigned, or it doesn't enter the step. Every step has an output with a metric threshold, or it doesn't advance to the next step. The dashboard renders this contract live, per job.

Formalized:

```
For every step S_k:
  S_k.input.spec  : predicate over I_k. If false ⇒ fail closed.
  S_k.metric      : observation persisted to the ledger.
  S_k.output.spec : predicate over O_k. If false ⇒ fail closed.
```

Per-job dashboard cell shape: `(input.spec ✓/✗, metric value, output.spec ✓/✗)`.

## 2. The 11-step contract (canonical)

| # | Step | Input spec | Metric persisted | Output spec | SIPOC fixture |
|---|---|---|---|---|---|
| 0 | Intake | `text_present`, `word_count≥1`, scope ∈ {chapter,novella,manuscript} | word_count, scope, submission_id | record persisted | s01 |
| 1 | Queue & atomic claim | job=queued, no concurrent claimer | job_id, claimed_at, worker_id | exactly one claimer | s02, s03 |
| 2 | Routing | word_count known, threshold=25k | route ∈ {short,long} | route written to ledger | implicit |
| 3 | Chunking | route + raw text | chunks_expected, chunks_persisted, Σ chunk.word_count | Σ == manuscript.word_count AND chunks_persisted == chunks_expected | s04 |
| 4 | Pass 1 (per chunk) | chunk passed step-3 | pass1_ms, retried_n, evidence_quote_count, truncated, prompt_window_chars | every chunk: evidence_quote_count ≥ 1 AND truncated == false | **s05** |
| 5 | Pass 2 (per chunk) | chunk has Pass1 finding | pass2_ms, divergence_count | every chunk has Pass2 finding | s06 |
| 6 | Chapter rollup | all chunks have P1+P2 | chapters_rolled_up, aggregates_size_bytes | rollup count == chapter count | PR-C, not built |
| 7 | Pass 3 reduce | rollup present, aggregates ≤ cap | pass3_ms, aggregates_size_bytes, agree, divergence | divergence from real disagreement | s07 |
| 8 | Pass 4 cross-check | Pass3 emitted | pass4_ms, finishReason, retried_for_truncation, retryMaxTokens | parsed JSON valid; finishReason != "length" OR retry succeeded | (no fixture yet) |
| 9 | Quality gate | scores + criteria_count_by_state present | quality_gate, QG_*, threshold values | gate=PASS or explicit FAIL persisted; no cert on FAIL | s09 |
| 10 | Persistence | gate decided | row_id, row_hash | exactly one canonical row | s08, s10 |
| 11 | Renderer/releasability | gate=PASS, persisted | releasable ∈ {true,false} | only releasable surfaces in UI | s11 |

## 3. Gap analysis: what the page surfaces today vs. what the contract requires

From the live inventory of `/admin/pipeline-health` at 2026-05-13 10:44:27 AM:

| SIPOC step | Today's coverage | Verdict |
|---|---|---|
| 0 Intake | not represented in strip | **GAP** |
| 1 Queue & atomic claim | not represented | **GAP** |
| 2 Routing | "routing_chunking" merged with step 3 | partial |
| 3 Chunking | total `chunks` count only — no expected vs persisted, no coverage % | **GAP** |
| 4 Pass 1 per chunk | aggregate `pass1_craft` stage card; no per-chunk telemetry, no truncation flag, no prompt-window size | **GAP — this is why Cartel Babies hid** |
| 5 Pass 2 per chunk | aggregate `pass2_editorial`; no per-chunk view | **GAP** |
| 6 Chapter rollup | not represented | **GAP** (also not built — PR-C) |
| 7 Pass 3 reduce | aggregate `pass3_synthesis`; no `agree`/`divergence` counts on page | **GAP** |
| 8 Pass 4 cross-check | not on SIPOC strip at all | **GAP** |
| 9 Quality gate | error code `QG_FAILED` surfaces but no per-criterion breakdown, no threshold values | partial |
| 10 Persistence | `persistence_report` stage card present | partial |
| 11 Renderer/releasability | not on strip | **GAP** |

**The Cartel Babies row on the dashboard right now**:
- Job `26220f5b…`, manuscript 6054, 137,758 words, 98 chunks, 722.4s total duration, stage `pass1_craft`, error `PASS1_TIMEOUT`, Diagnostics: `missing`.

What's missing **to diagnose it from the dashboard without leaving the page**:
- `pass1_ms` per chunk (so we'd see which chunks consumed the 720s budget).
- `prompt_window_chars` per chunk (so we'd see the 40,000-char truncation immediately).
- `evidence_quote_count` per chunk (so we'd see most chunks emitted zero findings).
- `truncated: true` flag (so the failure mode is named, not inferred).
- `chunks_expected (98)` vs `chunks_persisted (?)` vs `chunks_with_evidence (?)` — chunk coverage triple.
- `coverage_pct = (words_seen / 137,758) * 100` — the single most important metric.

Today: none of these are on the page. You diagnosed Cartel Babies from a docx file. That's the gap.

## 4. The hardening PR — concrete spec

**Title:** `feat(admin): SIPOC step-contract granularity on /admin/pipeline-health`

### 4a. Backend additions

A new SQL view `pipeline_step_observations` joining:
- `evaluation_jobs` (the row backing today's page)
- `pass1_chunk_findings` / `pass2_chunk_findings` (the per-chunk persistence that PR-C / map-reduce will add — until then, parse existing `processor.ts` structured logs)
- `job_ledger_events` (the ledger writes that `processor.ts` already emits — `ProcessorStageBoundary { stage, state, metadata }`)
- `quality_gate_diagnostics_v1` (already exists per page footer)
- `pass_outputs_diagnostic_v1` (already exists per page footer)

Output one row per `(job_id, step_k)` with columns: `input_spec_pass`, `metric_json`, `output_spec_pass`, `evidence_uri`.

### 4b. API additions

New endpoints:
- `GET /api/admin/pipeline-health/jobs/[id]/steps` → 11-row step contract for a job.
- `GET /api/admin/pipeline-health/jobs/[id]/steps/[k]/chunks` → per-chunk detail for step k (Passes 1, 2 only).
- `GET /api/admin/pipeline-health/taxonomy` → full error-code legend (extends today's hardcoded heatmap to enumerate all known codes with zero counts so absent failures are visible).

### 4c. UI additions

On the existing `/admin/pipeline-health` page:

1. **Expand the SIPOC strip to 11 cells** (it has 7 today, with intake/queue/Pass4/renderer absent). Each cell remains a stage card; clicking a cell filters the jobs table to failures at that step.

2. **Add a "Step Contract" expansion row to the Recent Jobs table.** Clicking a job ID toggles an 11-row inline panel: each row shows `(input.spec ✓/✗, metric, output.spec ✓/✗, last_event_at)`. Red cell = drill link to the offending evidence.

3. **Add a "Coverage" column to both job tables**: `coverage_pct` rendered as a pill (green ≥ 99.5%, yellow 90-99.5%, red < 90%). Backed by `Σ chunk_words / manuscript_words`. This is THE Cartel Babies tell.

4. **Add a "Pass timings" mini-strip** per failed job row: 4 horizontal bars labeled P1/P2/P3/P4, each with elapsed-ms and a budget-line (45s per chunk for P1/P2; 90s for P3). Visualizes which pass burnt the budget.

5. **Heatmap upgrade**: render the full taxonomy from `/api/admin/pipeline-health/taxonomy` so zero-count error codes appear as gray rows. You'll immediately see `LONG_FORM_CHUNK_MATERIALIZATION_FAILED`, `JSON_PARSE_FAILED_TRUNCATED`, `PASS3_TIMEOUT`, `CHUNK_TIMEOUT` listed even when 0.

6. **Add a "SIPOC fixtures" tile** showing last `sipoc-certification.yml` run: per-fixture (s01..s11) pass/fail and SHA. Read from `artifacts/sipoc/sipoc-results.json` published by the workflow.

### 4d. File: line target list

- `app/admin/pipeline-health/page.tsx` (or equivalent route — likely `app/(admin)/admin/pipeline-health/page.tsx`)
- `lib/admin/pipeline-health/query.ts` — add per-step query helpers
- `app/api/admin/pipeline-health/jobs/[id]/steps/route.ts` — new
- `app/api/admin/pipeline-health/jobs/[id]/steps/[k]/chunks/route.ts` — new
- `app/api/admin/pipeline-health/taxonomy/route.ts` — new
- `supabase/migrations/<timestamp>_pipeline_step_observations.sql` — new SQL view
- `lib/evaluation/processor.ts` — emit explicit `step_k` field on each `ProcessorStageBoundary` event so the view joins cleanly (likely small backfill helper)
- `components/admin/PipelineHealth/StepContractRow.tsx` — new component
- `components/admin/PipelineHealth/CoveragePill.tsx` — new component
- `components/admin/PipelineHealth/PassTimingsStrip.tsx` — new component
- `components/admin/PipelineHealth/SipocFixturesTile.tsx` — new component

### 4e. Sequencing

This is too big for one PR. Split:

- **PR-D1** (`feat(admin): SIPOC pipeline-health coverage pill + step contract API`) — backend view + coverage column + step-contract endpoint. Single high-leverage shipment because coverage % is THE Cartel Babies tell. ~6h.
- **PR-D2** (`feat(admin): per-job step contract expansion + pass timings strip`) — expand-row UI + pass timings. ~5h.
- **PR-D3** (`feat(admin): full taxonomy heatmap + SIPOC fixtures tile`) — taxonomy endpoint + tile. ~3h.
- **PR-D4** (`feat(admin): expand SIPOC strip to all 11 stages + add intake/queue/pass4/renderer`) — UI-only after PR-D1 lands the data. ~2h.

Total ~16h. Each PR is independently shippable and each makes the dashboard strictly better.

## 5. Acceptance bar

For PR-D1 specifically, the dashboard MUST be able to answer this question without leaving the page:

> Why did job 26220f5b fail?

Today the answer requires a docx autopsy. After PR-D1, the page shows:
- Coverage pill: **red, 4.9%** (6,800 / 137,758)
- Step 4 cell: `input.spec ✓, metric { pass1_ms_p50: 7340, prompt_window_chars: 40000, truncated: true }, output.spec ✗ (truncated == true)`
- Step 3 cell: `chunks_expected 98, chunks_persisted 98, Σ chunk_words 137758, output.spec ✓` (chunking was fine; the bug was downstream — clearly visible)
- Step 5/6/7/8/9/10/11: gray (never reached)

That's the bar.

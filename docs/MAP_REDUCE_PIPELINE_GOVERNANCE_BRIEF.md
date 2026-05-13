# Map-Reduce Evaluation Pipeline — Governance Brief

**Status:** LOCKED — design approved, ready for implementation
**Owner:** Mike Meraw (`@Mmeraw`)
**Date:** 2026-05-13
**Supersedes:** ad-hoc single-prompt Pass 1/2/3 invocation path in `lib/evaluation/processor.ts`
**Resolves / unblocks:** #384 (sampler diagnosis), #289 (divergence collapse), #385 (chapter-aware chunking), and the `PASS1_TIMEOUT` class of failures surfacing on the production `/admin/pipeline-health` dashboard.

---

## 1. Problem Statement (one sentence)

Long manuscripts (>100k words) reliably time out at 720,000 ms in Pass 1 because the evaluator silently throws away ≈95% of the manuscript in a 40,000-char truncation, then attempts to compensate with a single mega-prompt that cannot finish inside the upstream LLM budget — producing either `PASS1_TIMEOUT` failures or "completed but hollow" reports that violate `GOLDEN_SPINE.md` and `DREAM_OUTPUT_SPEC.md`.

## 2. Evidence (what the data says)

### 2.1 Failure case — Cartel Babies (`manuscript_id=6054`)

| Field | Value |
| --- | --- |
| Word count | 137,758 |
| Chunks produced | 98 |
| Words actually evaluated in Pass 1 | ≈6,800 (the first ~40,000 chars) |
| Job id | `26220f5b-62fe-4079-8804-e69bdc0edc5f` |
| Outcome | `PASS1_TIMEOUT` after 720,000 ms |
| Root cause (file:line) | `processor.ts:L807-835` → `pass1-craft.ts:L83` (`buildPromptInputWindow(text, 40_000)`) |

### 2.2 Timing inversion (14-day Supabase aggregate)

Word-count bucket → p50 / max completed duration:

- 60k–100k: **99s / 169s**
- 100k+: **127s / 160s**
- 25k–60k: **449s / 571s** ← slower than novels
- <7.5k: **213s / 534s**

Novels are not intrinsically slow. The slow bucket is the **fallback path** that kicks in when chunk-scoped processing fails to engage. The architecture is fighting itself.

### 2.3 Corroborating evidence — Issue #289

Pass 3 comparison packet measured at **2,800 characters** for an 85,000-word manuscript. Result: deterministic `agree:13 / divergence:0` across all runs — a structural artifact of the same truncation pattern, not genuine convergence. Pass 3 cannot disagree with itself if it never sees the work.

## 3. Architecture (LOCKED)

Three-tier hierarchical map-reduce. Every word is covered. No silent truncation. End-to-end target: **~6 min for 137k words** vs. 12-min timeout today.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TIER 1 — Parallel Chunk Map                      │
│  For each chunk c_i in [c_1 ... c_N]:                               │
│    Pass1.map(c_i) → pass1_chunk_finding                             │
│    Pass2.map(c_i) → pass2_chunk_finding                             │
│  Concurrency: 8–12. Per-chunk timeout: 45s.                         │
│  Idempotency key: (chunk_id, content_hash, prompt_version)          │
│  Expected wall time for 98 chunks @ 10-wide: ≈245s                  │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────────┐
│                  TIER 2 — Chapter Rollup                            │
│  Group chunk findings by chapter_anchor (from chunker metadata).    │
│  Compute structured aggregates per chapter:                         │
│    • criteria-state distributions                                   │
│    • prose-control quantiles                                        │
│    • emotion / wave / psychology vectors (DREAM §3, §4)             │
│  In parallel: 12 cheap chapter-level prose micro-calls              │
│  (one short LLM call per chapter for narrative continuity findings).│
│  Expected wall time: ≈45s                                           │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────────┐
│           TIER 3 — Single Pass3 Reduce                              │
│  Input: structured aggregates ONLY (not raw text).                  │
│  Output: long-form report matching DREAM_OUTPUT_SPEC §5–§8 +        │
│          short-form report matching `evaluation-short-form-         │
│          template-multi-layer`.                                     │
│  Timeout: 90s. Expected wall time: ≈60s.                            │
└─────────────────────────────────────────────────────────────────────┘
                       │
                       ▼
              ┌────────────────────────┐
              │  Invariant Gate (§4)   │
              └────────────────────────┘
```

**Total expected wall time: 245s + 45s + 60s + overhead ≈ 360s (6 min)** — well inside the 12-min ceiling, and reachable on a fully-fresh manuscript with zero cached chunks.

## 4. The Coverage Invariant (non-negotiable)

A job is only allowed to emit a final report if `assertEveryWordCovered()` passes. The contract:

```ts
function assertEveryWordCovered(input: {
  manuscriptWordCount: number;
  sumOfChunkWordCounts: number;
  chunksWithEvidence: number;
  chunksWithoutEvidence: number;
  totalChunks: number;
}): void {
  // Conservation of mass: chunker did not drop or duplicate text.
  invariant(
    input.sumOfChunkWordCounts === input.manuscriptWordCount,
    `Coverage violation: Σ chunk_words (${input.sumOfChunkWordCounts}) ≠ manuscript_words (${input.manuscriptWordCount})`
  );
  // Every chunk produced a real finding (not a skipped/fallback chunk).
  invariant(
    input.chunksWithoutEvidence === 0 && input.chunksWithEvidence === input.totalChunks,
    `Evidence violation: ${input.chunksWithoutEvidence}/${input.totalChunks} chunks have no evidence`
  );
}
```

The job ledger persists `chunk_coverage_pct` (always 100.0 on success). Any value <100.0 is a P0 alert and blocks merge to `main` for the offending change.

## 5. Implementation Plan — 4 PRs (22–29 hours)

### PR-A — `feat(pipeline): chunk-scoped Pass1/Pass2 map-reduce` (8–10h)
Resolves **#384**, unblocks **#289**.

Touches:
- `lib/evaluation/processor.ts` lines 807–835 — replace `resolveManuscriptText()` concat with chunk iterator.
- `lib/evaluation/pipeline/pass1-craft.ts` line 83 — kill `buildPromptInputWindow(text, 40_000)`; the input window is now ONE chunk.
- `lib/evaluation/pipeline/pass2-editorial.ts` line 112 — same.
- `lib/evaluation/pipeline/promptInput.ts` line 69 — add `buildChunkPromptInput(chunk)` and deprecate the truncation helper.
- `lib/evaluation/pipeline/runPipeline.ts` lines 572–621 — replace serial Pass1/Pass2 with `pMap(chunks, mapChunk, { concurrency: 10 })`.

Acceptance:
- All existing tests pass.
- New test: 137k-word fixture completes Pass1+Pass2 mapping in <300s and `assertEveryWordCovered` returns clean.

### PR-B — `feat(pipeline): chapter-aware chunker + arc-position anchors` (5–7h)
Closes **#385**. Satisfies DREAM Criterion 2 (chapter-resolved findings).

Adds `chapter_anchor` and `arc_position` (0.0–1.0) to chunk metadata. Chunker preserves chapter boundaries — no chunk straddles two chapters unless a single chapter exceeds the chunk size cap (in which case `chapter_position: "early|mid|late"` is set).

### PR-C — `feat(pipeline): chapter-rollup → Pass3 reduce on structured aggregates` (6–8h)
Resolves **#289**.

Implements Tier 2 (`rollupChaptersFromChunks`) and rewires Tier 3 to consume structured aggregates instead of raw text. Pass 3 packet size becomes bounded and predictable (target: <12,000 tokens regardless of manuscript size). Divergence is now a function of real disagreement between Pass 1 and Pass 2 findings, not a constant.

### PR-D — `feat(observability): every-word coverage invariant + SIPOC ledger` (3–4h)
Satisfies DREAM_OUTPUT_SPEC §7. Aligns with #338, #408, #409.

Persists `chunk_coverage_pct`, `pass1_chunks_completed`, `pass2_chunks_completed`, `pass3_aggregates_size`, per-tier wall time, and per-chunk timeout count to the score ledger. Surfaces all of them on `/admin/pipeline-health`.

## 6. Module Surface (TypeScript scaffolding to be created in PR-A/C)

```ts
// lib/evaluation/pipeline/mapChunkPass1.ts
export async function mapChunkPass1(
  chunk: ManuscriptChunk,
  ctx: PipelineContext
): Promise<Pass1ChunkFinding>;

// lib/evaluation/pipeline/mapChunkPass2.ts
export async function mapChunkPass2(
  chunk: ManuscriptChunk,
  pass1: Pass1ChunkFinding,
  ctx: PipelineContext
): Promise<Pass2ChunkFinding>;

// lib/evaluation/pipeline/rollupChapters.ts
export function rollupChaptersFromChunks(
  pass1: Pass1ChunkFinding[],
  pass2: Pass2ChunkFinding[],
  chunks: ManuscriptChunk[]
): ChapterRollup[];

// lib/evaluation/pipeline/reduceSynthesis.ts
export async function reduceSynthesis(
  chapters: ChapterRollup[],
  ctx: PipelineContext
): Promise<FinalReport>;  // long-form + short-form

// lib/evaluation/pipeline/invariants/coverage.ts
export function assertEveryWordCovered(input: CoverageInput): void;
```

Each function is **pure-of-IO-side-effects** with respect to its inputs (the only side effects are LLM calls and ledger writes, both explicit via `ctx`). All four are independently unit-testable with fixture chunks.

## 7. Risk Register

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| LLM provider rate-limits at 10 concurrent | Medium | Backoff with jitter; concurrency cap configurable per provider; record per-chunk `retried_n` in ledger |
| Chapter boundaries unreliable for non-conforming manuscripts | Medium | Fall back to `arc_position` deciles when no `\nChapter ` markers detected; flag manuscript in ledger |
| Pass 3 aggregate packet still grows superlinearly | Low | Hard cap on `aggregates_size`; if exceeded, downsample chapter prose findings via top-k by importance score |
| Cached chunk findings drift from prompt version | Low | Idempotency key includes `prompt_version`; bumping the prompt invalidates the cache cleanly |
| Coverage invariant trips a real-production job mid-rollout | Low | Feature flag `pipeline.map_reduce_enabled`; canary by manuscript size; fall back to legacy path on invariant failure for one release |

## 8. Decision Log

- **Why structured aggregates into Pass 3, not raw text?** Pass 3's job is synthesis, not re-reading. The 2,800-char comparison packet in #289 proves that re-reading was never happening anyway. Structured aggregates make the synthesis transparent and bounded.
- **Why 10-way concurrency?** Production observation: single-chunk Pass 1 wall time averages ~22s. 98 chunks ÷ 10 ≈ 10 batches × 22s ≈ 220s, plus tail variance → 245s budget. Raising to 20 buys ~120s and roughly doubles the rate-limit blast radius; not worth it pre-launch.
- **Why fail-closed on the coverage invariant?** Silent under-coverage is exactly the failure mode #384 documented. We refuse to ship a report that the architecture cannot certify covers the work.
- **Why a separate PR-D for observability?** Observability without the architecture is a placebo; the architecture without observability cannot prove the invariant in production. Both ship.

## 9. Acceptance & Rollout

1. PR-A merges behind feature flag `pipeline.map_reduce_enabled=false`.
2. PR-B, PR-C, PR-D stack on top.
3. Canary: flip the flag on for manuscripts <25k words first (one week), then <60k, then all.
4. Rollout gate at each step: `chunk_coverage_pct == 100.0` on every job in the canary window AND no `PASS_TIMEOUT` events.
5. Remove the legacy fallback path one release after 100% flip.

## 10. Out of Scope (explicitly)

- Changing the prompt content of Pass 1, Pass 2, or Pass 3 (a separate workstream).
- The long-form / short-form report templates themselves (already locked in `evaluation-long-form-template-multi-layer.md` and `evaluation-short-form-template-multi-layer.md`).
- Frontend rendering changes on `/evaluations/[id]`.
- Billing or quota changes.

---

**Sign-off line for the lock PR body:**
> This brief is the canonical architecture for evaluation processing as of 2026-05-13. Changes to the three-tier shape, the coverage invariant, or the four-PR sequencing require a new governance brief and a CODEOWNERS-approved replacement of this file.

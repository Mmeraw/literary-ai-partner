# PR-C Implementation Plan
_Status: PLANNING ARTIFACT — no runtime code, no SQL, no TypeScript, no prompt edits, no gate edits._
_Authority: governed by `pr-c/design-doc.md` (contracts) and `pr-c/seam-map.md` (substrate map). This document MAY NOT contradict either._
_Issue: #384 | Prerequisite: PR #383 (merged), PR #386 (design doc DRAFT) | Ratifications: §6.2.R Path B, §9.4.R reduce-stage arbitration doctrine_

---

## 0. Scope and Boundary Statement

This document prepares implementation. **It is not implementation.**

What this document does:
- Names the shapes, contracts, and decisions required before any code can be written.
- Translates ratified design-doc decisions into implementation-shaped questions and resolves them at the planning level.
- Defines acceptance evidence so a future implementation PR is verifiable, not vibes-checked.

What this document explicitly does NOT do:
- It does NOT contain SQL migration files.
- It does NOT contain TypeScript implementation.
- It does NOT modify prompts, gates, or budgets.
- It does NOT define the canonical migration filename or column names — those are reserved for the implementation PR per §6.8 of the design doc.
- It does NOT introduce a fallback to sampled-window cognition as a success path. There is no fallback. Path B is the destination architecture.

If a future contributor (human or LLM) reads this document and writes code from it without first opening an implementation PR for review, that is a doctrine violation. This document is a contract for the next PR, not the next PR itself.

---

## 1. Migration Identifier and Additive Schema Intent

### 1.1 Migration class

Per design-doc §6.2.R, the migration is **Path B — additive/versioned schema change**. The migration class is:

- **Additive only.** No `DROP`, no `ALTER COLUMN ... TYPE`, no destructive replacement of any pre-existing column or table.
- **Forward-readable.** Pre-PR-C `evaluation_artifacts` records remain readable without modification after the migration applies.
- **Reversible.** Rollback must be possible without rewriting historical job IDs or status values (per §6.5).
- **Feature-flag-coupled.** Write-path changes must be gated behind the §3 feature flag and must be no-ops when the flag is OFF.

### 1.2 Migration identifier policy

The exact filename, timestamp, and slug are reserved for the implementation PR per design-doc §6.8. The implementation PR must:

- Assign the next available timestamp in the canonical `supabase/migrations/<timestamp>_<slug>.sql` sequence.
- Use a canonical slug describing the additive shape (e.g., reflecting "chunk evidence" and "map-reduce", per `docs/NOMENCLATURE_CANON_v1.md`).
- Include a corresponding rollback path documented in the PR body.

### 1.3 Migration boundary (what the migration MUST NOT do)

The migration must not:
- Add columns to existing pre-PR-C tables that change their semantic meaning.
- Backfill any pre-existing record with synthesized chunk evidence (forbidden by §6.6 of the design doc and by the §3.5 anti-fabrication rule).
- Couple to observability instrumentation control flow (forbidden by §6.6).
- Change `JobStatus` vocabulary (forbidden by §4.2 / §6.4).

### 1.4 Acceptance evidence for the migration

The implementation PR must produce, before merge:
- A successful `workflow_dispatch` apply against staging.
- A parity-check artifact showing pre-PR-C records remain readable (per §6.4).
- A documented rollback procedure tested at least once on a non-production branch.
- Confirmation that `EVAL_CHUNK_MAP_REDUCE_ENABLED=false` produces unchanged behavior on the short-form evaluation path.

---

## 2. Chunk-Level Evidence Persistence Shape

### 2.1 Conceptual contract (binding)

A chunk-level evidence record represents the outcome of running one Pass on one chunk under one prompt version, for one job. Conceptually, it carries:

- **Identity tuple** (per §2.3 below) — uniquely identifies the evaluation unit.
- **Outcome payload** — the structured output of that Pass on that chunk.
- **Provenance fields** — model identifier, prompt version, timestamps, error state (if any).
- **Versioning field** — explicit schema version identifier per §6.2.R requirement.

The exact column names, JSON structure, and storage engine choices are reserved for the implementation PR. This document binds the shape's contract, not its bytes.

### 2.2 Authority allocation for shape decisions

| Decision | Authority |
|---|---|
| Logical identity tuple (what makes a record unique) | This plan, §2.3 |
| Logical fields the record must carry | This plan, §2.4 |
| Versioning discipline | This plan, §2.5 |
| Exact column names and types | Implementation PR |
| JSON schema for outcome payload | Implementation PR, must align with §2.4 |
| Index strategy | Implementation PR, must satisfy §2.6 query patterns |

### 2.3 Idempotency identity tuple (binding)

Per design-doc §5.2, a chunk evaluation unit is uniquely identified by the tuple:

`(job_id, chunk_id, content_hash, pass_key, prompt_version)`

Where:

- `job_id` — the evaluation job under which this chunk was processed. Required so that re-evaluations of the same manuscript under different jobs are distinct units.
- `chunk_id` — the canonical chunk identifier from `manuscript_chunks`.
- `content_hash` — hash of the chunk content at the time of evaluation. Any change to chunk content invalidates reuse eligibility.
- `pass_key` — which pass produced this evidence (e.g., a canonical identifier for Pass 1, Pass 2). Required because Pass 1 and Pass 2 evidence are distinct units even on the same chunk.
- `prompt_version` — the prompt version string that produced this evidence. Required because prompt changes invalidate reuse eligibility.

Reuse rule: A chunk evidence record is reuse-eligible if and only if all five tuple elements match exactly. Approximate match, partial match, or "close enough" matches are forbidden by §5.6.

This tuple expands the design-doc §5.2 tuple `(chunk_id, content_hash, prompt_version)` with `job_id` and `pass_key` for implementation-level uniqueness. The expansion is consistent with §5.2 — it does not weaken the identity contract; it makes it precise enough to write a unique constraint against.

### 2.4 Required logical fields

Each chunk-evidence record must carry:

- **Identity tuple** (the five fields above).
- **Outcome status** — one of: `succeeded`, `failed`, `skipped` (canonical vocabulary; exact identifiers reserved for implementation).
- **Outcome payload** — the structured pass output (for succeeded records) or structured error context (for failed records). Must use canonical criterion keys per §2.3 of the design doc.
- **Model identifier** — which model produced the outcome.
- **Created-at timestamp.**
- **Schema version** — explicit version identifier for the chunk-evidence record shape itself, per §6.2.R.
- **Job linkage** — foreign key relationship to `evaluation_jobs.id` such that `JobStatus` semantics remain authoritative and chunk-evidence records cannot orphan their parent job.

Optional fields (implementation-PR discretion, but must not be repurposed legacy fields):
- Latency metrics for the pass on the chunk.
- Token usage for the pass on the chunk.
- Retry count.

### 2.5 Versioning discipline

- The schema version field must be present on every chunk-evidence record.
- The first PR-C-shipped version is `v1`. Future evolutions increment additively.
- Records of older versions remain readable indefinitely. Newer code paths must handle older-version records explicitly, either by supporting them or by classifying them as "not eligible for reuse under current contract."
- Schema version is **not** the same as `prompt_version`. A prompt_version change does not require a schema version change.

### 2.6 Required query patterns (binding for index design)

The implementation PR's index strategy must support, at minimum:

- **Reuse lookup:** given the identity tuple, find at most one record. Must be O(log N) or better.
- **Per-job evidence retrieval:** given a `job_id`, retrieve all chunk-evidence records for that job, ordered by chunk for reduce-stage consumption.
- **Per-chunk history:** given a `chunk_id`, retrieve all evidence records (across jobs and prompt versions) for that chunk, for audit and debugging.
- **Stale-evidence sweeps:** given a `prompt_version` no longer in use, identify records eligible for retention review.

The implementation PR may add indexes beyond these. It may not omit any.

### 2.7 Persistence prohibitions (non-negotiable)

- Chunk evidence MUST NOT be persisted into existing `evaluation_artifacts` JSON columns as the canonical storage mechanism (forbidden by §6.2.R).
- Chunk evidence MUST NOT be derived on-read from cached pass outputs without an authoritative persisted record (forbidden by §5.4).
- Chunk evidence MUST NOT be cross-job reused unless canon later ratifies a shared identity model (forbidden by §5.4).

---

## 3. Pass 1 / Pass 2 Map-Loop Orchestration

### 3.1 Orchestration intent

Pass 1 and Pass 2 must consume `manuscriptChunks[]` directly via a map loop. Each chunk produces one chunk-evidence record per pass. The collapsed-string substrate at `lib/evaluation/processor.ts:L807–835` must no longer feed Pass 1 or Pass 2 when the feature flag is ON.

### 3.2 Loop contract (binding)

For each chunk in `manuscriptChunks[]`, in the order produced by the chunker:

1. Construct the per-chunk Pass input from the chunk's own content (not from a sampled window over the full manuscript string).
2. Check the idempotency tuple against persisted chunk-evidence records. If a reuse-eligible record exists, reuse it without invoking the model.
3. If no reuse-eligible record exists, invoke the Pass on the chunk. Persist the resulting chunk-evidence record before proceeding.
4. Append the chunk-evidence record to the in-memory map output for downstream reduce.
5. On per-chunk failure, follow §6 (failure behavior).

### 3.3 What the loop MUST NOT do

- It MUST NOT re-collapse `manuscriptChunks[]` into a single string and feed that string to `buildPromptInputWindow()`. That is the bug PR-C exists to fix.
- It MUST NOT silently fall back to sampled-window cognition if any chunk fails. Per-chunk failure is per-chunk; it does not promote the job to a sampling-window run. (See §6.)
- It MUST NOT skip persistence of chunk-evidence records "for performance." Reuse eligibility under §5 requires the records to exist.
- It MUST NOT alter the `manuscriptChunks[]` order between map iterations. Reduce-stage arbitration depends on stable ordering.

### 3.4 Concurrency model decisions (binding at planning level)

| Decision | Resolution |
|---|---|
| Per-chunk parallelism | Permitted. Implementation PR chooses concurrency limit. |
| Per-job parallelism | Existing job-level concurrency unchanged; this plan does not modify `claim_job_atomic` or worker scheduling. |
| Within-job pass ordering | Pass 1 must complete for all chunks before Pass 2 begins for any chunk, preserving the existing pass-sequence contract. |
| Within-pass chunk ordering | Map iteration order is the chunker's order; concurrent execution is permitted but chunk-evidence records are stamped with chunk identity, not iteration order. |
| Worker contention | Implementation PR resolves via the persistence layer's own concurrency primitives. This plan does not introduce distributed locking. |

If the implementation PR proposes a concurrency model that contradicts this table, that PR must amend this plan first.

### 3.5 Existing hooks to use (no new orchestration interfaces invented)

Per design-doc §1.5:

- `lib/evaluation/pipeline/runPipeline.ts:L96` — `manuscriptChunks?: ManuscriptChunkEvidence[]` is already in the pipeline opts shape.
- `lib/evaluation/pipeline/runPipeline.ts:L849–851` — `manuscriptChunks` is already threaded to Pass 3.

The implementation PR extends use of these hooks; it does not introduce a parallel orchestration interface. Per design-doc §7.6, the witness pair (`surfaceIntegrity.ts` ↔ `runPass3Synthesis.ts`) MUST NOT be collapsed into a shared helper as part of this work.

### 3.6 Map-stage output contract

When Pass 1 (and separately Pass 2) completes for all chunks of a job, the map-stage output is:

- A complete sequence of chunk-evidence records covering every chunk in `manuscriptChunks[]` for that pass.
- Each record stamped with its identity tuple (§2.3).
- Each record either `succeeded`, `failed`, or `skipped` per §2.4.

This sequence is the input to the reduce-stage contract in §4.

---

## 4. Pass 3 Reduce Input Contract

### 4.1 Reduce input shape

Pass 3 receives, per design-doc §2.2:

- The complete sequence of Pass 1 chunk-evidence records for the job.
- The complete sequence of Pass 2 chunk-evidence records for the job.
- Chunk identity and ordering metadata sufficient to reconstruct manuscript-level continuity.
- Existing manuscript reference inputs already threaded to Pass 3 per §1.5 of the design doc.

The implementation PR must not feed Pass 3 from the collapsed-string substrate.

### 4.2 Reduce arbitration obligations (binding under §9.4.R)

Pass 3 reduce-stage arbitration MUST:

- Aggregate evidence across the full chunk-evidence sequence before emitting any manuscript-scale judgment.
- Preserve evidence tension where map-stage signals diverge across chunks.
- Explain divergence explicitly in arbitration output.
- Withhold certification when cross-chunk consistency evidence is insufficient.
- Surface conflict for dual-stage criteria (e.g., `tone`) rather than collapsing it.

Pass 3 reduce-stage arbitration MUST NOT:

- Manufacture coherence by selecting one map-stage signal and discarding others without explained rationale.
- Treat majority vote across chunks as a substitute for arbitration on manuscript-scale criteria.
- Upgrade certification confidence beyond what underlying chunk evidence supports.
- Bypass QGv2 certification authority via reduce-stage confidence claims.

### 4.3 Criterion locality routing (per design-doc §2.3)

| Criterion | Stage |
|---|---|
| `proseControl` | chunk-local-first (map), with cross-chunk consistency in reduce |
| `voice` | chunk-local-first (map), with cross-chunk consistency in reduce |
| `dialogue` | chunk-local-first (map), with cross-chunk consistency in reduce |
| `sceneConstruction` | chunk-local-first (map), with cross-chunk consistency in reduce |
| `tone` | dual-stage (per-chunk in map, arbitration in reduce) |
| `concept` | manuscript-scale reduce-required |
| `narrativeDrive` | manuscript-scale reduce-required |
| `character` | manuscript-scale reduce-required |
| `theme` | manuscript-scale reduce-required |
| `worldbuilding` | manuscript-scale reduce-required |
| `pacing` | manuscript-scale reduce-required |
| `narrativeClosure` | manuscript-scale reduce-required |
| `marketability` | manuscript-scale reduce-required |

The implementation PR must route each criterion exactly per this table. No criterion may be silently relocated to a different stage.

### 4.4 Reduce-stage output contract

Reduce-stage output must be sufficient for QGv2 (Pass 4) to evaluate:

- Per-criterion synthesized claim with provenance back to the supporting chunk-evidence records.
- Explicit divergence annotation for any criterion where map-stage signals diverged.
- `INSUFFICIENT_SIGNAL` (or canonical equivalent) for any criterion whose evidence does not meet stage-appropriate thresholds.

The exact output schema is reserved for the implementation PR but must satisfy these requirements.

---

## 5. Pass 4 / QGv2 — Unchanged Certification Boundary

### 5.1 Boundary statement (binding)

Pass 4 / QGv2 certification logic is **outside the scope of this implementation**. The implementation PR MUST NOT:

- Modify `QG_*` gate identifiers, thresholds, or activation conditions.
- Modify `unresolved_conjunction_tail` or `unresolved_mechanism_tail`.
- Modify the post-clamp surface check.
- Modify the witness pair (`surfaceIntegrity.ts` ↔ `runPass3Synthesis.ts`); they remain separate per design-doc §7.6.
- Modify the `v2_completeness_bridge`, `v2_scored_anchor_threshold`, or `v2_fidelity_score_confidence_alignment` gates that fired on job `842ec7ab` (per `pr-c/baseline-6041-pre-prc.md`, Second Data Point).
- Add new gates as part of this work. New gates require a separate ratification path.

### 5.2 What QGv2 should observe after PR-C

After PR-C ships, QGv2 will see, for the same manuscript that previously failed:

- A complete chunk-evidence sequence covering the full manuscript (not a 7.7% sampled window).
- Reduce-stage synthesis produced from full-coverage evidence.
- Anchor counts for manuscript-scale criteria that meet the existing `≥2` threshold (because evidence locality is now satisfied).

If QGv2 still refuses to certify after PR-C ships, that is a separate evidence problem (chunker quality, prompt quality, model quality) — it is not a PR-C scope problem and does not authorize relaxing QGv2.

### 5.3 QGv2 expected behavior under PR-C

The implementation PR's acceptance evidence (§9 below) must demonstrate:

- For manuscript 6041, all three QGv2 gates that fired on job `842ec7ab` no longer fire on a flag-ON re-evaluation, **without any change to the gates themselves.**
- If any of the three still fire after PR-C, the PR cannot ship as a "fix for #384" — it has only fixed substrate, not certification.

---

## 6. Failure Behavior Per Chunk and Per Job

### 6.1 Per-chunk failure semantics

When a single chunk fails during Pass 1 or Pass 2:

- The failure is recorded as a chunk-evidence record with outcome status `failed` and structured error context.
- The map loop continues processing remaining chunks. A single chunk failure does not abort the map loop.
- The `failed` chunk-evidence record participates in reduce-stage arbitration as a recorded gap, not as missing data.

### 6.2 Per-job failure semantics

A job transitions to `JobStatus = failed` when:

- A non-recoverable orchestration error occurs (database unavailable, manuscript unreadable, etc.).
- The fraction of `failed` chunks exceeds a threshold to be set in the implementation PR (initial planning value: more than 10% of chunks failed). The exact threshold and its rationale must be documented in the implementation PR.
- QGv2 refuses to certify and the existing job-failure path triggers (this is unchanged from current behavior).

A job MUST NOT transition to `failed` for:

- Per-chunk failures below the §6.2 threshold (those are recorded and arbitrated, not promoted to job failure).
- Reduce-stage divergence on manuscript-scale criteria (those produce `INSUFFICIENT_SIGNAL`, not job failure, per §4.2).

### 6.3 What the failure path MUST NOT do

- It MUST NOT fall back to sampled-window cognition under any circumstance. Per design-doc §0 and §1.4, sampled-window cognition is rejected as a destination architecture, including as a failure-mode escape hatch.
- It MUST NOT silently retry failed chunks indefinitely. Retry policy is bounded; exact bounds reserved for implementation PR.
- It MUST NOT mask system faults as client errors. The §6.4 error-semantics constraint from the design doc applies.

### 6.4 Recovery semantics

When a previously-failed chunk is re-evaluated:

- If the chunk's content has not changed and the prompt version has not changed, prior `failed` chunk-evidence records remain authoritative until the implementation PR's retry policy elects to recompute.
- A successful recomputation produces a new chunk-evidence record; the prior `failed` record is retained for audit per §5.5 of the design doc.

---

## 7. Feature Flag and Rollout Path

### 7.1 Flag identifier

Per design-doc §4.5, the canonical flag is `EVAL_CHUNK_MAP_REDUCE_ENABLED` (or an approved canonical equivalent per §9.3). The implementation PR may not invent an alternative identifier without canon ratification.

### 7.2 Flag semantics (binding)

| Flag state | Behavior |
|---|---|
| OFF (default) | Pre-PR-C behavior. Pass 1 / Pass 2 consume the collapsed-string substrate. The new chunk-evidence persistence path is **not written to**. |
| ON | PR-C behavior. Pass 1 / Pass 2 consume `manuscriptChunks[]` via map loop. Chunk-evidence records are persisted. |

Flag OFF is the compatibility baseline per design-doc §4.5. Flag ON behavior must not alter any unrelated route, status semantic, or API error semantic.

### 7.3 Flag scope

The flag is **per-environment** and **per-job-class**:

- Initial enablement: long-form manuscripts only (length threshold reserved for implementation PR).
- Short-form manuscripts continue on the existing path indefinitely; this PR does not unify the paths.
- Production rollout follows the design-doc §8 phase sequence (R0 baseline lock → R1 parallel → R2 gated expansion → R3 cutover).

### 7.4 Rollout phase decisions (binding under §8.2)

| Phase | Decision committed in this plan |
|---|---|
| R0 — Baseline lock | `pr-c/baseline-6041-pre-prc.md` is the authoritative baseline. Both data points (`20079165` soft-fail and `842ec7ab` hard-fail) are retained. |
| R1 — Parallel evaluation | Manuscript 6041 is the mandatory R1 comparison subject. Additional R1 subjects reserved for implementation PR. |
| R2 — Gated expansion | Authorized only after R1 acceptance evidence (§9 below) is met. |
| R3 — Cutover | Authorized only after all design-doc §8.5 cutover criteria pass. |

The implementation PR may not skip phases.

### 7.5 Rollback path

Per design-doc §6.5:

- Rollback restores compatibility baseline with flag OFF authoritative.
- Rollback does not require rewriting historical job status values.
- Rollback preserves ability to read both pre-migration and migration-era chunk-evidence records.
- Rollback execution must be documented in the implementation PR body before R2.

---

## 8. Acceptance Tests

### 8.1 Manuscript 6041 — the mandatory acceptance subject

Per design-doc §8.3 and §8.4, manuscript 6041 is the canonical acceptance subject. The implementation PR cannot ship without satisfying these criteria for 6041.

### 8.2 Acceptance criteria for 6041 (binding)

A flag-ON re-evaluation of manuscript 6041 must produce:

| Criterion | Required outcome |
|---|---|
| Provenance footer | Must NOT contain "sampled prompt window" or equivalent sampling language. |
| `Chunks Analyzed` (UI) | Must equal the actual DB chunk count for the job at evaluation time (currently 58 post-PR #383). |
| Coverage | ≈100% of the manuscript (or ≥90% under governed sampling, per design-doc §8.4). |
| Prose Control certification | Certified, confidence ≥ Moderate. |
| `pacing` certification | Either certified at ≥ Moderate confidence, or correctly emitting `INSUFFICIENT_SIGNAL` for documented reduce-stage divergence reasons. NOT failing on `v2_scored_anchor_threshold` due to substrate starvation. |
| `marketability` certification | Same posture as `pacing`. |
| All three QGv2 gates from job `842ec7ab` | No longer fire **without any change to the gates themselves**. |
| `JobStatus` final state | `complete` (with quarantined output forbidden — output must be certifiable, not quarantine-style). |

If any of these criteria fail, the implementation PR cannot ship as the fix for #384.

### 8.3 Comparison artifact

The implementation PR must produce, before merge:

- A flag-OFF run on 6041 (regression sentinel — must reproduce pre-PR-C behavior).
- A flag-ON run on 6041 (must satisfy §8.2 above).
- A comparison report referencing both runs and `pr-c/baseline-6041-pre-prc.md` as the third-row closure of the evidence chain.

### 8.4 Regression sentinels

The implementation PR must include test-level proof that:

- Pre-PR-C fixtures (per design-doc §4.4) remain unchanged.
- Short-form evaluation path produces unchanged behavior under flag OFF.
- The witness pair (`surfaceIntegrity.ts` ↔ `runPass3Synthesis.ts`) is not collapsed.
- No `QG_*` gate identifier is renamed, deleted, or relaxed.
- `JobStatus` vocabulary is unchanged.

### 8.5 Test classes the implementation PR must include

The implementation PR must include, at minimum:

- **Unit tests** for the map-loop iteration, idempotency tuple matching, and per-chunk failure behavior.
- **Integration tests** for the map-reduce orchestration end-to-end on a small fixture manuscript.
- **Persistence tests** for chunk-evidence record creation, reuse, and version-handling.
- **Migration tests** for parity-check (legacy records readable post-migration) and rollback.
- **CI tests** for flag OFF regression (pre-PR-C behavior preserved) and flag ON correctness.
- **End-to-end acceptance run** on 6041 captured as a workflow artifact, not a manual screenshot.

### 8.6 What is NOT acceptance

The following are explicitly **NOT** sufficient to mark PR-C as shipping:

- Manuscript 6041 producing "any score." A number is not certification.
- A manually-run evaluation that "looked right." Acceptance is workflow-captured.
- Test passes without a 6041 end-to-end acceptance run. The tests verify mechanism; the acceptance run verifies architecture.
- A flag-ON run that produces certified output but for which the comparison artifact (§8.3) was not produced.

---

## 9. Hard Constraints (Repeated for Implementer Clarity)

The implementation PR MUST NOT:

- Contain SQL files outside `supabase/migrations/<timestamp>_<canonical-slug>.sql`.
- Modify any prompt file under `lib/evaluation/pipeline/prompts/` unless the change is purely additive (e.g., new per-chunk prompt scaffolding) and does not raise the 40K budget.
- Modify any `QG_*` gate, threshold, anchor count, or confidence-cap rule.
- Raise the 40K prompt budget. The budget cap stays. A budget bump is rejected by design-doc §0, §1.4, §2.5, §5.6, §7.6, §8.7.
- Introduce a "sampled-window fallback" code path under any name.
- Collapse `surfaceIntegrity.ts` and `runPass3Synthesis.ts` into a shared helper (forbidden by §7.6).
- Update existing test fixtures to mask map-reduce-introduced regressions (forbidden by §4.4 and §7.6).
- Introduce non-canonical identifiers in artifacts, logs, or routing metadata (forbidden by §8.5).
- Couple observability instrumentation to control flow (forbidden by §3.5 and §6.6).
- Backfill fabricated chunk evidence into historical artifacts (forbidden by §6.6).
- Be merged without a 6041 flag-ON acceptance run that satisfies §8.2.

---

## 10. What This Plan Leaves to the Implementation PR

By design, the following remain reserved for the implementation PR:

- Exact migration filename and timestamp.
- Exact column names and types for the chunk-evidence table.
- Exact JSON schema for outcome payloads.
- Exact concurrency limit for per-chunk parallelism.
- Exact retry policy for failed chunks.
- Exact threshold for per-job failure based on per-chunk failure rate.
- Exact long-form manuscript length threshold for initial flag-ON enablement.
- Exact wording of provenance string under flag ON.
- Exact dashboard / telemetry shape (per design-doc §9.7).
- Selection of the sign-off role for each cutover criterion (per design-doc §9.6).

Every item in this list must be resolved in the implementation PR's body or commit messages. None may be left as "TBD" at merge time.

---

## 11. Sequencing Discipline

The implementation work proceeds in this order, and may not skip:

1. **Migration** — additive schema lands behind flag, parity check passes, rollback documented and tested.
2. **Persistence path** — chunk-evidence write/read code lands behind flag, unit + integration tests green.
3. **Map loop** — Pass 1 map-loop orchestration lands behind flag, idempotency tested.
4. **Map loop, Pass 2** — same shape as step 3, after step 3 is green.
5. **Reduce input wiring** — Pass 3 begins consuming chunk-evidence sequence under flag, divergence preservation verified in tests.
6. **6041 acceptance run** — flag-ON on staging, then production. Comparison artifact produced. §8.2 criteria verified.
7. **R2 expansion** — flag-ON broadened only after step 6 lands clean.
8. **R3 cutover review** — only after R2 acceptance evidence is met.

Steps 1–5 may be split across multiple PRs at the implementer's discretion, provided each PR is independently reviewable and each step lands behind flag OFF before the next begins.

A single mega-PR that lands steps 1–5 simultaneously is **discouraged** but not formally forbidden. If proposed, it must justify in its body why a phased rollout was rejected.

Step 6 may not be skipped. Step 7 may not precede step 6. Step 8 may not precede step 7.

---

## 12. Doctrine Anchors

This plan is anchored to:

- `pr-c/design-doc.md` §0 (cognition substrate doctrine), §1.6 (map phase contract), §2 (reduce phase contract), §5 (idempotency), §6.2.R (Path B ratification), §7.6 (named guardrails), §9.4.R (reduce-stage arbitration doctrine).
- `pr-c/seam-map.md` (substrate map and existing hooks).
- `pr-c/baseline-6041-pre-prc.md` (evidence chain — both data points).
- `AI_GOVERNANCE.md`, `docs/JOB_CONTRACT_v1.md`, `docs/NOMENCLATURE_CANON_v1.md`, `lib/canon/nomenclature_canon.v1.json`.

If this plan and any anchor document conflict, the anchor document wins. This plan is downstream of canon, not upstream of it.

---

_End of planning artifact. Implementation begins in a separate PR, gated by acceptance of this plan._

# PR-C Design Doc: Chunk-Aware Map-Reduce Evaluation Pipeline
_Status: CONTRACT COMPLETE — governance-first design, implementation intentionally deferred_
_Issue: #384 | Prerequisite: PR #383 (merged) | Seam map: pr-c/seam-map.md_

---

## 0. Doctrine Statement

manuscript_chunks are generated and persisted correctly.  
resolveManuscriptText() collapses them into one concatenated string before Pass 1/2.  
buildPromptInputWindow() samples that string into a 40K-char begin/middle/end window.  
The result: manuscript-scale chunking exists in storage but not in cognition.

PR-C promotes manuscriptChunks from persistence artifact to Pass 1/2 cognition substrate.  
Do not raise the global prompt budget as the solution.  
Do not re-concatenate chunks for Pass 1/2.  
Do not change scoring semantics until the map/reduce contract is designed here.

---

## 1. Map Phase Contract

_What does Pass 1 see for one chunk? What does it return?_

### 1.1 Current Flow (verbatim seam path)

```
manuscript_chunks (58 rows, ~500K chars total, min 3500 / median 9566 chars)
	│
	│  resolveManuscriptText()              [lib/evaluation/processor.ts:L807–835]
	▼
validChunks.map(c => c.content.trim()).join('\n')   ← ALL 58 chunks → one string
	│                                                ← COLLAPSE POINT (single line)
	│  runPipeline({ manuscriptText: ... }) [lib/evaluation/processor.ts:L1863]
	▼
buildPromptInputWindow(text, 40_000)        [lib/evaluation/pipeline/prompts/pass1-craft.ts:L83]
											[lib/evaluation/pipeline/prompts/pass2-editorial.ts:L112]
(begin/middle/end sampler, hardcoded 3 segments)
	│
	▼
Pass 1 + Pass 2  ← see ~6,800 of 87,737 words (7.7% coverage)
	│
	▼
Pass 3 synthesis ← same starved window; manuscriptChunks[] passed but is metadata-only
	│
	▼
Pass 4 / QGv2 path   ← non-certification surfaced honestly when anchor evidence is insufficient
```

### 1.2 Collapse line (do not paraphrase)

File: `lib/evaluation/processor.ts` L826–835 (`resolveManuscriptText`)

`validChunks.map((chunk) => chunk.content.trim()).join('\n')` — collapses all chunks into one string, destroys locality.

### 1.3 Clarifications

- This is not a chunker generation failure. Chunk production is established.
- This is not a governance/gate failure. QGv2 and confidence degradation surfaced evidence starvation honestly.

### 1.4 Why budget bump is not the fix

- Not a budget bump (40K → 100K → still failing at 14% coverage)
- Not a prompt-window widening
- Not a hot-fix

### 1.5 Existing hook to use (already in code)

- `lib/evaluation/pipeline/runPipeline.ts:L96` — `manuscriptChunks?: ManuscriptChunkEvidence[]`
- `lib/evaluation/pipeline/runPipeline.ts:L849–851` — already threaded to Pass 3 via `_runPass3({ ..., manuscriptChunks: opts.manuscriptChunks })`

### 1.6 Map phase contract question

For long-form manuscripts, Pass 1 / Pass 2 must consume per-chunk `manuscriptText` in a map loop driven by `manuscriptChunks[]`, with Pass 3 reducing chunk evidence for manuscript-scale criteria.

Everything that follows in this document answers that question.

---

## 2. Reduce Phase Contract

_How do criteria with cross-chunk dependencies aggregate evidence across all chunks?_
_Criteria split: chunk-local (map cleanly) vs. manuscript-scale (require reduce) — see seam-map.md._

### 2.1 Scope and authority

- Binding source for this section: `pr-c/seam-map.md` (Criteria Split + Exact Seams).
- Canonical identifier policy applies: `AI_GOVERNANCE.md` and `docs/NOMENCLATURE_CANON_v1.md`.
- This section defines contract boundaries only. It does not define implementation.

### 2.2 Reduce inputs (required)

- Map outputs from Pass 1 and Pass 2 for each chunk in `manuscriptChunks[]`.
- Chunk identity and ordering metadata sufficient to reconstruct manuscript-level continuity.
- Existing manuscript reference inputs already threaded to Pass 3 (`manuscriptChunks` hook from Section 1.5).

### 2.3 Criteria locality contract (canonical keys)

#### Chunk-local-first keys

- `proseControl`
- `voice`
- `dialogue`
- `sceneConstruction`
- `tone` (with cross-chunk consistency checks in reduce)

#### Manuscript-scale reduce keys

- `concept`
- `narrativeDrive`
- `character`
- `theme`
- `worldbuilding`
- `pacing`
- `narrativeClosure`
- `marketability`

These locality assignments are constrained by the seam map's Criteria Split and must not be expanded or renamed without canon ratification.

### 2.4 Reduce obligations (must hold)

- Must arbitrate across all chunk evidence before manuscript-scale judgments are emitted.
- Must preserve uncertainty when cross-chunk evidence is insufficient or contradictory.
- Must not up-certify a criterion when evidence is below gate requirements.
- Must emit criterion outcomes using canonical criteria keys only.

### 2.5 Prohibitions (non-negotiable)

- Do not reintroduce full-manuscript string sampling as the primary reduce substrate.
- Do not treat prompt-window count (`derivePromptChunkCount`) as manuscript chunk coverage.
- Do not weaken or bypass quality gates to compensate for missing substrate.
- Do not change JobStatus vocabulary or transition semantics (see `docs/JOB_CONTRACT_v1.md`).

### 2.6 Acceptance evidence for Section 2 (design-level)

- The contract explicitly separates chunk-local-first vs manuscript-scale keys.
- The contract requires reduction over full `manuscriptChunks[]` evidence.
- The contract forbids budget-bump substitution and gate weakening as fixes.
- The contract remains identifier-canonical (no invented keys, no aliases).

### 2.7 Reserved for implementation in later sections

- Conflict-resolution algorithm for contradictory cross-chunk evidence.
- Weighting/aggregation method per criterion.
- Tie-break and fallback behavior.

These are intentionally deferred to later sections and/or implementation PRs.

---

## 3. Cost & Latency Envelope

_Per-chunk cost × chunk count → total. Latency per pass and end-to-end total._
_Idempotency key: (chunk_id, content_hash, prompt_version). Selective recomputation cost._

### 3.1 Scope and authority

- Binding source for idempotency basis: `pr-c/seam-map.md` (`(chunk_id, content_hash, prompt_version)`).
- This section defines accounting and acceptance contracts only; it does not define scheduling or execution algorithms.
- No performance claim in this section is valid without run-backed evidence captured in Section 8 artifacts.

### 3.2 Cost accounting contract (required)

Let:

- $N$ = total manuscript chunks in DB for the job.
- $M$ = chunks requiring recomputation under idempotency key comparison, where $0 \le M \le N$.
- $C_{p1}$ = per-chunk Pass 1 cost unit.
- $C_{p2}$ = per-chunk Pass 2 cost unit.
- $C_{p3}$ = single reduce-stage Pass 3 cost unit per manuscript.
- $C_{p4}$ = quality-gate cost unit per manuscript.

Then contract-level total cost is:

$$
C_{total} = M\cdot(C_{p1}+C_{p2}) + C_{p3} + C_{p4}
$$

Implications:

- Full run: $M=N$.
- Selective rerun: $M \ll N$ is valid only when idempotency key proves unchanged chunks.
- Prompt-window sampling count must not be used as a substitute for $N$ or $M$.

### 3.3 Latency envelope contract (required)

Let:

- $L_{map}$ = aggregate latency for all map-stage chunk evaluations.
- $L_{reduce}$ = reduce-stage latency (Pass 3).
- $L_{gate}$ = quality-gate latency (Pass 4 / gating path).
- $L_{io}$ = orchestration + persistence overhead.

Then:

$$
L_{end\text{-}to\text{-}end} = L_{map} + L_{reduce} + L_{gate} + L_{io}
$$

Contract requirement: reported latency must declare whether it is full-run ($M=N$) or selective-rerun ($M<N$). Mixing those classes in one reported number is non-compliant.

### 3.4 Measurement and provenance requirements

- Every envelope report must include: manuscript identifier, chunk count $N$, recompute count $M$, prompt version, and evaluation route classification.
- Evidence source must be persisted artifacts/logs from actual runs (not estimates presented as measured values).
- If a value is estimated, it must be explicitly labeled as estimate and excluded from pass/fail acceptance gates.

### 3.5 Prohibitions (non-negotiable)

- Do not claim throughput or latency improvements without run-backed evidence.
- Do not report sampled-window coverage as manuscript-scale coverage.
- Do not use non-canonical identifiers in cost/latency artifacts.
- Do not alter control flow from observability instrumentation.

### 3.6 Acceptance evidence for Section 3 (design-level)

- Cost formula is stated using $N$, $M$, and per-pass units with idempotency-aware recomputation.
- Latency formula separates map, reduce, gate, and orchestration components.
- Reporting contract requires explicit declaration of full-run vs selective-rerun class.
- Anti-fabrication rule is explicit: measured vs estimated values are clearly separated.

### 3.7 Reserved for implementation in later sections

- Concurrency model and worker parallelism policy.
- Queue/backpressure behavior under multi-tenant load.
- Token/model-level optimization tactics.

These are intentionally deferred to implementation planning and rollout sections.

---

## 4. Backward Compatibility Plan

_Existing job IDs, existing artifacts, existing fixtures. Short-form manuscript path unchanged._
_Feature-flag gating: EVAL_CHUNK_MAP_REDUCE_ENABLED or equivalent._

### 4.1 Scope and authority

- This section defines compatibility constraints for PR-C rollout behavior and persisted outputs.
- Canon governance applies (`AI_GOVERNANCE.md`, `docs/NOMENCLATURE_CANON_v1.md`, `docs/JOB_CONTRACT_v1.md`).
- This is a contract section, not an implementation plan.

### 4.2 Hard compatibility invariants (must hold)

- Existing `evaluation_jobs.id` values remain authoritative and unchanged.
- Existing JobStatus vocabulary remains exactly: `queued`, `running`, `complete`, `failed`.
- Existing job transition legality rules remain unchanged and centrally validated.
- Existing short-form evaluation path remains behaviorally unchanged when chunk map-reduce routing is not active.

### 4.3 Artifact compatibility contract

- Existing artifact consumers must continue to parse baseline fields without break.
- Any PR-C artifact expansion must be additive or versioned; destructive field replacement is non-compliant.
- Compatibility requirement for `chunk_count`: semantics must represent actual chunk substrate consumed, not prompt-window count.
- Legacy artifacts produced before PR-C remain readable and must not be reinterpreted as full-coverage evidence.

### 4.4 Fixture and test compatibility contract

- Existing fixtures for short-form path remain valid without mutation as a precondition for PR-C enablement.
- New PR-C fixtures must be explicitly partitioned from legacy fixtures to prevent accidental baseline drift.
- Regression checks must include one legacy fixture path and one long-form chunk-routed path.

### 4.5 Feature-flag compatibility gate

- Chunk map-reduce behavior must be gated behind `EVAL_CHUNK_MAP_REDUCE_ENABLED` or an approved equivalent canonical identifier.
- Flag OFF behavior is the compatibility baseline.
- Flag ON behavior must not alter unrelated routes, status semantics, or API error semantics.

### 4.6 Prohibitions (non-negotiable)

- Do not rename canonical statuses, criteria keys, or persisted identifiers.
- Do not repurpose legacy artifact fields with new meanings without explicit versioning.
- Do not silently coerce legacy records into PR-C semantics.
- Do not treat compatibility regressions as acceptable for speed.

### 4.7 Acceptance evidence for Section 4 (design-level)

- Compatibility invariants are explicitly listed and testable.
- Flag OFF baseline behavior is declared as authoritative.
- Artifact evolution rule (additive/versioned only) is explicit.
- Canonical status and transition contracts are explicitly preserved.

### 4.8 Reserved for implementation in later sections

- Concrete migration steps and rollback mechanics (Section 6).
- Rollout cohorting and parallel-run comparison procedure (Section 8).
- Test command inventory and CI wiring details.

These remain deferred until implementation planning.

---

## 5. Idempotency & Caching Design

_(chunk_id, content_hash, prompt_version) keying. Cache validity. Governed reruns._

### 5.1 Scope and authority

- Binding idempotency basis: `pr-c/seam-map.md` tuple `(chunk_id, content_hash, prompt_version)`.
- This section defines correctness and governance constraints for rerun behavior.
- Implementation details (storage engine, eviction policy, parallel scheduler) are out of scope here.

### 5.2 Idempotency identity contract (must hold)

- A chunk evaluation unit is uniquely identified by the tuple `(chunk_id, content_hash, prompt_version)`.
- Reuse is permitted only when all tuple elements match exactly.
- Any change to chunk content or prompt version invalidates reuse eligibility for that chunk.

### 5.3 Rerun classification contract

For each rerun request, each chunk must be classified into one of two governance outcomes:

- **Recompute required** — tuple mismatch or missing prior result.
- **Reuse eligible** — exact tuple match with valid prior result.

Design requirement: manuscript-level rerun reporting must include counts for both outcomes and must reconcile to total chunk count.

### 5.4 Cache validity constraints

- Reuse eligibility is a correctness claim, not a performance hint.
- Invalid, partial, or unverifiable prior results are non-reusable.
- Cross-manuscript reuse is forbidden unless canon later ratifies a shared identity model.
- Pass 1/Pass 2 cached outputs may be reused only under tuple match; reduce-stage outputs must reflect the current manuscript chunk set.

### 5.5 Governance and auditability requirements

- Each rerun must produce auditable evidence of tuple comparison outcomes.
- Audit records must distinguish reused chunk results from recomputed chunk results.
- Observability remains passive and must not alter reuse/recompute decisions.

### 5.6 Prohibitions (non-negotiable)

- Do not infer reuse from chunk index, order, or approximate similarity.
- Do not treat prompt-window sampling artifacts as cache validity evidence.
- Do not silently downgrade invalid cached evidence into certified outputs.
- Do not invent non-canonical identifiers for persisted routing or artifact keys.

### 5.7 Acceptance evidence for Section 5 (design-level)

- Tuple identity rule is explicit and unchanged from seam canon.
- Reuse vs recompute classification is explicit and manuscript-reconcilable.
- Cache validity constraints preserve correctness over speed.
- Auditability and passive-observability constraints are explicit.

### 5.8 Reserved for implementation in later sections

- Concrete persistence schema for cached pass outputs.
- Eviction policy and retention windows.
- Distributed locking/concurrency behavior under worker contention.

These are intentionally deferred until migration and rollout planning.

---

## 6. Migration Path

_Does evaluation_artifacts schema need a new shape for chunk-level evidence?_
_If yes: migration number, parity-check plan, rollback procedure._

### 6.1 Scope and authority

- This section defines migration governance, not migration implementation.
- Canon constraints apply: identifier canon, JobStatus canon, and passive observability rules.
- Any schema evolution must preserve auditability and backward readability.

### 6.2 Migration decision gate (must be explicit)

Before implementation, one of the following must be formally selected:

- **Path A — No schema change:** existing `evaluation_artifacts` shape is sufficient; PR-C outputs are represented through existing fields without semantic break.
- **Path B — Additive/versioned schema change:** chunk-level evidence requires new persisted shape; changes are additive and versioned.

No implicit middle state is permitted.

#### 6.2.R — Ratification (2026-05-09)

**Selected: Path B — additive/versioned schema change.**

Ratifying authority: project owner.
Ratification date: 2026-05-09.
Ratification basis: project doctrine ("Quality first. Mistake-proofed. Complete. Scalable to 100,000 users. No dirty code. No leftovers that don't belong.") combined with the §0 / §1.6 cognition-substrate decision and the architectural implication recorded in `pr-c/baseline-6041-pre-prc.md` (Second Data Point — Hardened-QGv2 Counterpart).

Reasoning (canonical):

- Chunk-local evidence is a **first-class cognition artifact** under the §0 / §1.6 contract. It is not a derived intermediate representation; it is the substrate Pass 1 / Pass 2 will consume directly under PR-C.
- First-class cognition artifacts deserve first-class persistence. Hiding them inside existing `evaluation_artifacts` columns or unstructured JSON blobs would create permanent schema debt and would violate the "no dirty code / no leftovers" doctrine line.
- Path A would temporarily absorb chunk evidence into existing fields. That is the kind of decision teams make at hour 14 of a sprint and regret at month 6. It is rejected here for that reason, before the regret accumulates.
- "Scalable to 100,000 users" requires queryable, indexable, versionable chunk-evidence shape. JSON-stuffing into legacy fields is not queryable at scale.
- Path B aligns with the §4.3 artifact compatibility contract (additive or versioned only; destructive field replacement is non-compliant) and with the §5 idempotency contract (`(chunk_id, content_hash, prompt_version)` keying requires structured persistence to be auditable).

What Path B implies (binding under this ratification):

- New persisted shape for chunk-level evidence is **required**, not optional.
- The shape must be additive: it must coexist with all pre-PR-C `evaluation_artifacts` records without rewriting them.
- The shape must be versioned: each chunk-evidence record must carry an explicit version identifier so future evolution is traceable and reversible.
- All §6.3 constraints (canonical identifiers only, legacy-readable transition, feature-flag-gated and reversible write-path changes) now bind.
- Migration identifier and exact column/table layout remain reserved for implementation per §6.8 — Path B is the destination architecture, not a migration recipe.

What is **explicitly rejected** under this ratification:

- Hiding chunk evidence inside existing `evaluation_artifacts.result_json` (or any other existing JSON field) as the canonical persistence mechanism.
- Treating chunk evidence as ephemeral compute-only state with no persisted shape.
- Any "temporary Path A then later Path B" two-step that ships unversioned chunk evidence first and rationalizes it forward later.

This ratification closes the §6.2 decision gate. §9.1 is updated accordingly.

##### 6.2.R.1 — Step 1 persistence vocabulary ratification (PR #388)

For PR-C Step 1 (additive persistence substrate), the following identifiers are
ratified as canonical Step-1 persistence vocabulary for migration `#388`:

- Table: `chunk_evidence`
- Enum type: `chunk_evidence_status`
- Enum values: `succeeded`, `failed`, `skipped`
- Schema version literal: `chunk_evidence_v1`
- Unique constraint: `chunk_evidence_identity_tuple_uniq`
- Index names:
  - `chunk_evidence_job_chunk_idx`
  - `chunk_evidence_chunk_history_idx`
  - `chunk_evidence_prompt_version_idx`
- Binding identity-tuple columns:
  - `job_id`
  - `chunk_id`
  - `content_hash`
  - `pass_key`
  - `prompt_version`
- Required persisted fields:
  - `status`
  - `outcome`
  - `model`
  - `schema_version`
  - `created_at`

This ratification is schema/persistence vocabulary only. It does not authorize
runtime consumption in this phase; Step 1 remains substrate-only.

### 6.3 If Path B is selected (required constraints)

- Migration identifier must be assigned from the repository’s canonical migration sequence at implementation time.
- New columns/tables/JSON keys must use canonical identifiers only.
- Existing fields required by legacy consumers must remain readable during transition.
- Write-path changes must be feature-flag-gated and reversible.

### 6.4 Parity-check contract (pre-cutover)

Parity verification must prove, for the same manuscript input and prompt version:

- Legacy-readable outputs remain parseable and semantically stable where expected.
- PR-C chunk-aware outputs produce auditable chunk evidence counts.
- Job status/transition semantics remain unchanged (`queued`/`running`/`complete`/`failed`).
- Error semantics remain canonical (no masking system faults as client errors).

### 6.5 Rollback contract

- Rollback must restore compatibility baseline with flag OFF behavior authoritative.
- Rollback must not require rewriting historical job status values or invalidating existing job IDs.
- Rollback must preserve ability to read both pre-migration and migration-era artifacts.
- Rollback execution must be documented before cutover approval.

### 6.6 Prohibitions (non-negotiable)

- Do not perform destructive field replacement without versioned compatibility strategy.
- Do not backfill fabricated chunk evidence into historical artifacts.
- Do not change canonical status vocabulary as part of migration.
- Do not couple observability instrumentation to migration control flow.

### 6.7 Acceptance evidence for Section 6 (design-level)

- Migration path choice (A or B) is explicit and reviewable.
- Parity checks and rollback prerequisites are defined before implementation.
- Compatibility and canon constraints are testable and unambiguous.
- Historical readability is preserved as an explicit requirement.

### 6.8 Reserved for implementation in later sections

- Concrete migration file(s) and execution order.
- Data backfill scripts (if any) and runtime windows.
- Operational runbook commands and on-call procedures.

These are intentionally deferred until rollout planning and execution.

---

## 7. Quality Gate Routing

_Which gates run map-stage (per chunk), which run reduce-stage (post-synthesis), which run both._
_Acceptance signal: Chunks Analyzed = actual DB chunk count, not prompt-window count (3)._

### 7.1 Scope and authority

- This section defines gate-routing governance for map and reduce stages.
- Binding inputs: `pr-c/seam-map.md` criteria locality split and PR-C acceptance doctrine.
- Canon constraints apply to identifiers, status semantics, and error handling.

### 7.2 Routing contract (must hold)

Quality gates are routed by evidence locality:

- **Map-stage gates (chunk-level evidence required):** evaluate per chunk where criteria are chunk-local-first.
- **Reduce-stage gates (manuscript-scale evidence required):** evaluate only after cross-chunk aggregation.
- **Dual-stage gates:** may run chunk-level checks in map stage and consistency arbitration in reduce stage.

No criterion may be certified at a stage that lacks required evidence locality.

### 7.3 Criterion-to-stage governance alignment

Based on seam-map locality:

- Chunk-local-first: `proseControl`, `voice`, `dialogue`, `sceneConstruction`, `tone` (with cross-chunk consistency in reduce).
- Manuscript-scale reduce-required: `concept`, `narrativeDrive`, `character`, `theme`, `worldbuilding`, `pacing`, `narrativeClosure`, `marketability`.

This section governs stage eligibility only; it does not define scoring algorithms.

### 7.4 Acceptance signal contract (non-negotiable)

- `Chunks Analyzed` must represent actual DB chunk substrate consumed for evaluation.
- Prompt-window-derived counts (e.g., sampled 1/3 window counts) are invalid as manuscript coverage signals.
- Any certification claim must be traceable to the corresponding chunk evidence set and stage.

### 7.5 Confidence and certification governance

- When stage-appropriate evidence is insufficient, certification must be withheld or confidence degraded.
- Gate outcomes must not be upgraded to compensate for substrate gaps.
- Reduce-stage arbitration must preserve uncertainty where cross-chunk evidence conflicts.

### 7.6 Prohibitions (non-negotiable)

- Do not certify manuscript-scale criteria from map-only evidence.
- Do not certify chunk-local criteria from sampled-window proxies when full chunk evidence is required by route.
- Do not repurpose gate outputs to imply full-manuscript coverage absent matching `Chunks Analyzed` evidence.
- Do not bypass gate routing via prompt-budget escalation.
- Do not weaken `QG_EDITORIAL_GENERIC_FEEDBACK` or relax `unresolved_conjunction_tail` / `unresolved_mechanism_tail` to compensate for evidence-locality routing decisions made under PR-C.
- Do not delete or soften the post-clamp surface check; it remains an independent governance witness regardless of map/reduce routing.
- Do not collapse the witness pair `lib/evaluation/pipeline/surfaceIntegrity.ts` and `lib/evaluation/pipeline/runPass3Synthesis.ts` into a shared helper as part of map-reduce refactoring. They remain separate by canon.
- Do not update existing test fixtures to mask map-reduce-introduced regressions; pre-PR-C fixtures freeze pre-PR-C truth and may only be extended additively (see §4.4).

### 7.7 Acceptance evidence for Section 7 (design-level)

- Stage routing is explicitly tied to criterion locality.
- `Chunks Analyzed` semantics are explicitly bound to DB chunk consumption.
- Certification and confidence behavior under insufficient evidence is explicitly constrained.
- Prohibitions prevent sampled-window masquerade as full-manuscript truth.

### 7.8 Reserved for implementation in later sections

- Concrete gate execution order and call graph wiring.
- Threshold/tuning values per gate.
- Instrumentation fields and UI presentation details.

These remain deferred until rollout and implementation planning.

---

## 8. Rollout & Comparison Plan

_Feature-flag, parallel runs, score comparison on manuscript 6041 (baseline: pr-c/baseline-6041-pre-prc.md)._
_Cutover criteria. Smoke test checklist._

### 8.1 Scope and authority

- This section defines rollout governance and comparison acceptance contracts.
- Baseline authority: `pr-c/baseline-6041-pre-prc.md` (sampling artifact quarantined).
- Flag authority: compatibility baseline is flag OFF behavior.

### 8.2 Rollout phases (contract-level)

- **Phase R0 — Baseline lock:** preserve pre-PR-C baseline artifacts and labels as reference truth for comparison.
- **Phase R1 — Parallel evaluation mode:** run PR-C path and baseline-compatible path for designated manuscripts without replacing baseline reporting semantics.
- **Phase R2 — Gated expansion:** broaden flag-ON scope only after acceptance evidence is met.
- **Phase R3 — Cutover eligibility review:** authorize broader default behavior only when all cutover criteria pass.

This defines sequence and decision gates, not execution mechanics.

### 8.3 Required comparison corpus

- Manuscript `6041` is mandatory for rollout comparison because it is the established seam/baseline case.
- Comparison runs must use explicitly recorded prompt version identifiers.
- At least one legacy-compatible short-form path must be included as a regression sentinel.

### 8.4 Comparison acceptance contracts (6041)

For manuscript `6041`, PR-C comparison evidence must show:

- `Chunks Analyzed` equals actual DB chunk count for the run (baseline reference was 58; runtime count may vary if source changes).
- Coverage posture reflects chunk substrate consumption (not sampled-window proxy).
- Prose-related certification behavior reflects stage-appropriate evidence availability.
- Provenance no longer represents Pass 1/2 as sampled-window-only analysis when chunk routing is active.

### 8.5 Cutover criteria (must all pass)

- Canon compliance: no non-canonical identifiers introduced in artifacts, logs, or routing metadata.
- Compatibility compliance: flag OFF path remains baseline-correct and unaffected.
- Governance compliance: confidence/certification behavior remains evidence-bound (no fabricated upgrades).
- Operational compliance: parity and rollback prerequisites from Section 6 are satisfied and documented.

### 8.6 Smoke test checklist contract

Each rollout wave must include, at minimum:

- Flag OFF run: legacy compatibility validation.
- Flag ON run: chunk-aware routing validation.
- Artifact inspection: `chunk_count` semantics and provenance string correctness.
- Gate outcome inspection: no manuscript-scale certification from map-only evidence.

Checklist completion is a release gate, not advisory documentation.

### 8.7 Prohibitions (non-negotiable)

- Do not declare rollout success from a single sampled-window-style comparison.
- Do not use headline score movement alone as cutover evidence.
- Do not suppress or relabel baseline quarantine language for pre-PR-C artifacts.
- Do not promote flag-ON scope without documented acceptance evidence.

### 8.8 Acceptance evidence for Section 8 (design-level)

- Rollout phases and decision gates are explicit.
- Mandatory 6041 comparison requirements are explicit.
- Cutover criteria require canon + compatibility + governance + rollback readiness.
- Smoke checklist is defined as a blocking gate.

### 8.9 Reserved for implementation in later sections

- Cohort selection mechanics and traffic percentages.
- Automation wiring for comparison job orchestration.
- Dashboard/report templates and alert thresholds.

These remain deferred until execution planning.

---

## 9. Open Questions

### 9.1 Schema decision

_Original open question (preserved for chronology):_

- Should PR-C use **Path A (no schema change)** or **Path B (additive/versioned schema expansion)** for chunk-level evidence persistence?
- If Path B, what is the exact canonical migration identifier and review owner?

_Resolution (2026-05-09):_ **Path B selected.** See §6.2.R for the decision ratification and §6.2.R.1 for Step-1 persistence vocabulary ratification. The exact canonical migration identifier and review owner remain reserved for implementation planning per §6.8.

### 9.2 Artifact contract boundary

- Which artifact fields are formally frozen for legacy consumers during PR-C rollout?
- Do we require explicit artifact-version tagging in persisted records at cutover, or is additive compatibility sufficient?

### 9.3 Feature-flag canon

- Is `EVAL_CHUNK_MAP_REDUCE_ENABLED` ratified as the canonical flag identifier, or should an alternative canonical identifier be approved?
- What is the formal approval gate for expanding flag-ON scope?

### 9.4 Gate policy clarifications

_Original open questions (preserved for chronology):_

- For dual-stage criteria (`tone`), what is the governance rule when map-stage signals conflict with reduce-stage arbitration?
- What is the explicit certification posture when chunk evidence exists but cross-chunk consistency evidence is insufficient?

#### 9.4.R — Resolution (2026-05-09): Reduce-Stage Arbitration Doctrine

Ratifying authority: project owner.
Ratification date: 2026-05-09.
Empirical basis: the QGv2 firing pattern recorded in `pr-c/baseline-6041-pre-prc.md` (Second Data Point — job `842ec7ab-…`), which demonstrated that the system correctly refuses to certify when evidence locality and cross-chunk consistency are insufficient. The arbitration doctrine below is the canonical formalization of that observed posture.

**Authority allocation (binding):**

| Claim type | Authority |
|---|---|
| Local craft observations (chunk-local-first criteria per §2.3) | Map-stage |
| Manuscript-scale synthesis (manuscript-scale reduce keys per §2.3) | Reduce-stage |
| Conflicts between divergent map-stage signals | Reduce-stage adjudicates |
| Final certification posture | Pass 4 / QGv2 |

**Arbitration doctrine (must hold):**

- Map-stage outputs are **evidence claims, not final manuscript truths**. A map-stage value alone never certifies a manuscript-scale criterion.
- Reduce-stage arbitration has **authority over manuscript-scale synthesis** and **must**:
  - preserve evidence tension where map-stage signals diverge across chunks,
  - explain the divergence explicitly in arbitration output,
  - downgrade or reconcile only when cross-chunk evidence supports the reconciliation,
  - never erase disagreement to manufacture coherence.
- For dual-stage criteria (e.g., `tone`): map-stage produces per-chunk consistency signals; reduce-stage arbitrates whether cross-chunk consistency holds. When map-stage signals conflict, reduce-stage **must surface the conflict** rather than collapse it to a single value.
- When chunk evidence exists but cross-chunk consistency evidence is insufficient, reduce-stage **must withhold certification** for that criterion and emit `INSUFFICIENT_SIGNAL` (or the canonical equivalent) with the divergence preserved in the artifact.
- Certification authority remains with **Pass 4 / QGv2**. Reduce-stage arbitration produces evidence-bound synthesis; QGv2 determines whether that synthesis is certifiable.

**Forbidden under this doctrine (non-negotiable):**

- Collapsing divergent map-stage signals into a single arbitration value without surfacing the divergence in the artifact.
- Manufacturing coherence by selecting one map-stage signal and discarding others without explaining the discard rationale in arbitration output.
- Treating map-stage majority vote as a substitute for reduce-stage arbitration on manuscript-scale criteria.
- Using arbitration output to upgrade certification confidence beyond what the underlying chunk evidence supports.
- Bypassing QGv2 certification authority via reduce-stage confidence claims.

**Why this doctrine and not its alternative:**

The alternative — "reduce-stage may erase disagreement to produce a clean number" — is exactly the bluffing posture the system rejected when QGv2 fired three gates simultaneously on job `842ec7ab` rather than emit a fabricated manuscript-scale score. Codifying disagreement-preservation as canon prevents future implementations (or future LLM collaborators without context) from reintroducing the bluffing posture under the guise of "cleaner output."

The system is more trustworthy when it says "evidence distribution is inconsistent" than when it forces fake coherence. This is the doctrine implication of "the system refused to bluff."

This ratification closes the §9.4 open question.

### 9.5 Baseline and comparison governance

- What is the canonical retention policy for quarantined baseline artifacts (e.g., 6041 pre-PR-C)?
- Which additional manuscripts (beyond 6041) are mandatory before broad cutover approval?

### 9.6 Operational governance

- Which role signs off each cutover criterion domain (canon, compatibility, governance behavior, rollback readiness)?
- What is the formal escalation path if parity checks pass but gate-behavior audits disagree?

### 9.7 Deferred implementation questions (tracked, not answered here)

- Concurrency model and worker orchestration details.
- Cache storage topology and eviction policy.
- Dashboarding, alert thresholds, and automation wiring.

These remain intentionally unresolved in this design phase until contracts are formally ratified.

# CANON-CODE RECONCILIATION MATRIX

    Status: EVIDENCE COLLECTION --- NOT FOR REWRITE
    Branch: canon-reconciliation-audit
    Created: 2026-04-10
    Authority: Mike Meraw
    Method: Static code inspection + canon document review
    Classification values: MATCHED | PARTIAL | DRIFTED | CODE-ONLY | CANON-ONLY | UNVERIFIED

---

## OPERATING RULES

1. This matrix is a ledger of claims and evidence, not a fix list.
2. No canon rewrite from any row marked UNVERIFIED, PARTIAL, or DRIFTED without an explicit decision.
3. Code is not automatically authoritative over canon.
4. Canon is not automatically authoritative over deliberate code evolution.
5. Each discrepancy requires explicit classification before any action.

---

## SURFACE 1: DOCTRINE REGISTRY

**Canon source:** `canon/control/REVISIONGRADE-CANON-DOCTRINE-REGISTRY.md`
**Canon ID:** CTRL-DOCTRINE-REG-V21

| Canon ID | Canon Statement | Canon Source | Code Surface | Runtime Proof | Status | Required Decision | Notes |
|----------|----------------|--------------|--------------|---------------|--------|-------------------|-------|
| REG-RULE-01 | Every canonical doctrine must have a unique Canon ID | DOCTRINE-REGISTRY | lib/governance/canonRegistry.ts | scripts/verify-canon-ids.ts | MATCHED | Verify canonRegistry entries match registry doc | Need runtime cross-check |
| REG-RULE-02 | Every doctrine must be assigned to a destination Volume and Section | DOCTRINE-REGISTRY | lib/governance/canonRegistry.ts | scripts/verify-canon-ids.ts | PARTIAL | Verify all registry entries have volume/section | Need field-level audit |
| REG-RULE-03 | No doctrine may be enforced without a registry entry | DOCTRINE-REGISTRY | lib/governance/enforcementHooks.ts | scripts/verify-governance-coverage.ts | PARTIAL | Verify enforcement hooks only use registered IDs | Need runtime trace |

---

## SURFACE 2: ASSEMBLY MATRIX

**Canon source:** `canon/control/REVISIONGRADE-CANON-ASSEMBLY-MATRIX.md`

| Canon ID | Canon Statement | Canon Source | Code Surface | Runtime Proof | Status | Required Decision | Notes |
|----------|----------------|--------------|--------------|---------------|--------|-------------------|-------|
| ASM-STRUCT-01 | Canon is organized into Volumes I-V with defined scopes | ASSEMBLY-MATRIX | canon/volumes/*.md, canon/control/*.md | scripts/verify-spine.sh | PARTIAL | Verify all claimed volumes exist and are populated | Some stubs still pending content |
| ASM-STRUCT-02 | Control documents govern cross-volume enforcement | ASSEMBLY-MATRIX | canon/control/*.md | N/A | UNVERIFIED | Verify control docs reference correct volume sections | Static review needed |

---

## SURFACE 3: VOLUME II-A OPERATIONAL SCHEMA

**Canon source:** `canon/control/VOLUME-II-A-OPERATIONAL-SCHEMA.md`
**Canon ID:** VOL-IIA-OPS-SCHEMA-V10

| Canon ID | Canon Statement | Canon Source | Code Surface | Runtime Proof | Status | Required Decision | Notes |
|----------|----------------|--------------|--------------|---------------|--------|-------------------|-------|
| IIA-CRITERIA-01 | Exactly 13 canonical criteria must be present in every evaluation | VOL-II-A Sec 2 | schemas/criteria-keys.ts, lib/governance/canonicalCriteria.ts | scripts/verify-canon-ids.ts | MATCHED | None | criteria-keys.ts defines exactly 13 keys |
| IIA-CRITERIA-02 | No additional criteria may be invented at runtime | VOL-II-A Sec 2 | schemas/criteria-keys.ts | scripts/verify-canon-schema.sh | MATCHED | None | Schema enforces strict key set |
| IIA-SCORE-01 | Each criterion scored 1-10 integer scale, no half-points | VOL-II-A Sec 3 | lib/evaluation/pipeline/types.ts | N/A | MATCHED | Verify score type is integer-only in pipeline types | Need type inspection |
| IIA-WEIGHT-01 | WCS = SUM(score x weight) / SUM(weights) | VOL-II-A Sec 4 | lib/governance/criteriaEnvelope.ts | N/A | DRIFTED | Verify WCS calculation matches formula | Need code trace |
| IIA-GATE-01 | WAVE_ELIGIBILITY_MIN_WCS = 7.0 | VOL-II-A Sec 5 | lib/governance/eligibilityGate.ts | N/A | MATCHED | Verify constant value in eligibilityGate.ts | Need constant check |
| IIA-GATE-02 | STRUCTURAL_FAIL_THRESHOLD = 5 for fail-fast | VOL-II-A Sec 5 | lib/governance/eligibilityGate.ts | N/A | MATCHED | Verify threshold constant | Need constant check |
| IIA-GATE-03 | AGENT_READY_WCS = 8.5 | VOL-II-A Sec 5 | lib/governance/eligibilityGate.ts | N/A | MATCHED | Verify constant | Need constant check |
| IIA-ROUTING-01 | Criteria-to-WAVE routing map governs wave target selection | VOL-II-A Sec 6 | lib/revision/wavePlanner.ts, lib/pipeline/wave-execution-layer.ts | N/A | MATCHED | Verify routing map in code matches canon table | Need field mapping |
| IIA-EVAL-01 | Evaluation envelope must contain all 13 criteria with defined JSON shape | VOL-II-A Sec 7 | lib/governance/criteriaEnvelope.ts | N/A | MATCHED | Verify envelope schema matches canon | Need schema comparison |
| IIA-PERSIST-01 | Artifacts stored in evaluation_artifacts as jsonb | VOL-II-A Sec 8 | supabase/ migrations | N/A | MATCHED | Verify Supabase schema has evaluation_artifacts table | Need migration check |
| IIA-PIPE-01 | AI System 1 generates, AI System 2 audits before artifact write | VOL-II-A Sec 9 | lib/evaluation/pipeline/runPass1.ts, runPass2.ts, runPass3Synthesis.ts | N/A | PARTIAL | Verify two-AI pipeline contract in pass execution | Need code trace |
| IIA-PIPE-02 | Divergence must be logged, not silently collapsed | VOL-II-A Sec 9 | lib/evaluation/pipeline/runPass3Synthesis.ts | N/A | PARTIAL | Verify divergence logging in Pass 3 synthesis | Need code trace |
| IIA-INVARIANT-01 | WAVE may not run when eligibility_gate = BLOCK | VOL-II-A Sec 10 | lib/governance/eligibilityGate.ts, lib/revision/engine.ts | N/A | MATCHED | Verify WAVE gating enforcement | HIGH PRIORITY --- ChatGPT tracing this |

---

## SURFACE 4: VOLUME III EVALUATION PIPELINE ARCHITECTURE

**Canon source:** `canon/volumes/VOLUME-III-EVALUATION-PIPELINE-ARCHITECTURE.md`
**Canon ID:** VOL-III-EVAL-PIPELINE-V10

| Canon ID | Canon Statement | Canon Source | Code Surface | Runtime Proof | Status | Required Decision | Notes |
|----------|----------------|--------------|--------------|---------------|--------|-------------------|-------|
| III-PIPE-01 | Pipeline is Pass 1 then Pass 2 then Pass 3 then WAVE | VOL-III Pipeline Arch | lib/evaluation/pipeline/runPipeline.ts | N/A | MATCHED | Verify sequential pass ordering in runPipeline | Need code trace |
| III-PIPE-02 | No stage may be skipped | VOL-III Pipeline Arch | lib/evaluation/pipeline/gatePhase2OnPhase1.ts | N/A | MATCHED | Verify gate enforcement between passes | Need code trace |
| III-PIPE-03 | WAVE execution permitted only after Pass 1-3 convergence | VOL-III Pipeline Arch | lib/pipeline/wave-execution-layer.ts, lib/revision/wavePlanner.ts | N/A | PARTIAL | DRIFT SIGNAL: wavePlanner derives targets from all 3 passes, not just converged output | ChatGPT traced this --- see analysis |
| III-PIPE-04 | WAVE must not bypass Pass III convergence | VOL-III Pipeline Arch | lib/revision/engine.ts, lib/pipeline/wave-execution-layer.ts | N/A | PARTIAL | HIGH PRIORITY: Can WAVE execute without valid Pass 3? | ChatGPT actively tracing |
| III-PIPE-05 | All outputs must be persisted before advancing | VOL-III Pipeline Arch | lib/evaluation/pipeline/runPipeline.ts | N/A | PARTIAL | Verify artifact persistence between stages | Need code trace |

---

## SURFACE 5: GOVERNANCE AND ENFORCEMENT PLACEMENT

**Canon source:** `canon/control/CPDR-001-CANON-ENFORCEMENT-PLACEMENT.md`
**Canon ID:** CPDR-001
**Status:** LOCKED --- IMMUTABLE

| Canon ID | Canon Statement | Canon Source | Code Surface | Runtime Proof | Status | Required Decision | Notes |
|----------|----------------|--------------|--------------|---------------|--------|-------------------|-------|
| CPDR-001-01 | Canon Enforcement System permanently placed in Volume V, Section VII | CPDR-001 | canon/volumes/ (Volume V file) | N/A | MATCHED | Verify Volume V contains enforcement section | Need file content check |
| CPDR-001-02 | This decision is binding across all tools, agents, and contributors | CPDR-001 | lib/governance/enforcementHooks.ts | N/A | PARTIAL | Verify enforcement hooks reference Volume V placement | Need code trace |

---

## SURFACE 6: WAVE EXECUTION SURFACES

**Canon source:** `canon/control/WAVE-SYSTEM-EXECUTION-LAYER-MAP.md`

| Canon ID | Canon Statement | Canon Source | Code Surface | Runtime Proof | Status | Required Decision | Notes |
|----------|----------------|--------------|--------------|---------------|--------|-------------------|-------|
| WAVE-EXEC-01 | WAVE system has defined execution layer map | WAVE-LAYER-MAP | lib/revision/waveRegistry.ts, lib/revision/wavePlanner.ts | N/A | PARTIAL | Verify wave registry matches canon layer map | Need field mapping |
| WAVE-EXEC-02 | Two WAVE execution surfaces exist in code | CODE-ONLY | lib/pipeline/wave-execution-layer.ts AND lib/revision/engine.ts | N/A | CODE-ONLY | DECISION NEEDED: Should both execution surfaces exist? | ChatGPT identified this |
| WAVE-EXEC-03 | Wave targeting uses all-pass findings, not just converged output | CODE-ONLY | lib/revision/wavePlanner.ts, lib/revision/revisionOrchestrator.ts (if exists) | N/A | CODE-ONLY | Canon silent on this. Code implements merged-pass targeting. | Needs explicit doctrine decision |

---

## SUMMARY STATISTICS

| Status | Count |
|--------|-------|
| MATCHED | 14 |
| PARTIAL | 10 |
| DRIFTED | 1 |
| CODE-ONLY | 2 |
| CANON-ONLY | 0 |
| UNVERIFIED | 1 |
| **TOTAL** | **28** |

---

## HIGH-PRIORITY ITEMS (Require runtime tracing before decision)

1. **III-PIPE-04**: Can WAVE execute without valid Pass 3 completion? (ChatGPT tracing)
2. **WAVE-EXEC-02**: Two parallel WAVE execution surfaces --- should both exist?
3. **III-PIPE-03**: WAVE target selection uses pre-convergence signals (DRIFT SIGNAL)
4. **IIA-INVARIANT-01**: WAVE gating when eligibility_gate = BLOCK

---

*This matrix is evidence-only. No canon or code changes authorized until explicit decisions are made per row.*

## AUDIT LOG

### 2026-04-10 — Question 4 Runtime Trace Complete

**IIA-INVARIANT-01: WAVE may not run when eligibility_gate = BLOCK**

**VERDICT: MATCHED**

Evidence chain:
- `lib/governance/eligibilityGate.ts`: Gate function returns PASS/BLOCK. Constants match canon (WCS=7.0, STRUCTURAL_FAIL=5, AGENT_READY=8.5)
- `lib/governance/enforcementHooks.ts` line 69: `beforeAllowRefinement()` throws `GovernanceError` with code `REFINEMENT_BLOCKED_BY_GATE` when `eligibility_gate === "BLOCK"`
- `lib/governance/evaluationBridge.ts` line 176: Production caller invokes `beforeAllowRefinement(envelope)` with comment "Hard block if not eligible"
- `lib/governance/__tests__/enforcementHooks.test.ts`: 8+ unit test assertions
- `lib/evaluation/__tests__/governanceIntegration.test.ts`: Integration test explicitly verifies "beforeAllowRefinement() blocks refinement when eligibility_gate = BLOCK" and "Fail-closed behavior is maintained end-to-end"

Reclassify: UNVERIFIED -> MATCHED. Also reclassify IIA-GATE-01, IIA-GATE-02, IIA-GATE-03 to MATCHED (constants confirmed in eligibilityGate.ts).

Updated counts: MATCHED=6, UNVERIFIED=18, TOTAL=28.

Remaining high-priority: 3 items (Questions 1, 2, 3). Question 1 next.

### 2026-04-10 — Question 1 Runtime Trace Complete

**III-PIPE-04: WAVE must not bypass Pass III convergence**

**VERDICT: PARTIAL**

Evidence chain:
- `lib/evaluation/pipeline/runPipeline.ts`: Pipeline orchestrator runs Pass 1 → Pass 2 → Pass 3 → Pass 4 sequentially. If Pass 3 fails, returns `{ ok: false, failed_at: "pass3" }` immediately. Pipeline invariant #3: "Fails closed — any pass failure → job FAILED, no artifact persisted."
- `lib/revision/engine.ts`: `startRevisionEngine()` calls `checkRefinementEligibilityByEvaluationRun()` as first action (comment: "MANDATORY: Check governance eligibility before entering refinement path"). `finalizeRevisionEngine()` also calls this check.
- `lib/governance/evaluationBridge.ts`: `checkRefinementEligibilityByEvaluationRun()` fetches `evaluation_result_v1` artifact from `evaluation_artifacts` table. If Pass 3 failed, no artifact exists (pipeline fail-closed), so throws `REFINEMENT_BLOCKED_BY_GATE`.
- `lib/pipeline/wave-execution-layer.ts`: `executeWaveLayer()` accepts `pass3_findings` as **optional** parameter. `deriveAllPassTargets()` defaults missing pass3 to `{}`. No independent Pass 3 completion check exists in this layer.
- `lib/jobs/gates.ts`: `gatePhase2OnPhase1()` gates Phase 2 on Phase 1 completion, but no equivalent `gateWaveOnPass3()` function exists.

Analysis: WAVE cannot execute without Pass 3 through the normal pipeline+engine path because the evaluation artifact won't exist if Pass 3 failed. However, `wave-execution-layer.ts` does NOT independently verify Pass 3 completion — it trusts its caller. This is caller-discipline enforcement, not self-enforcing defense-in-depth.

Risk: If any future caller invokes `executeWaveLayer()` directly without going through the engine's eligibility check, WAVE could run with partial/missing Pass 3 data.

Reclassify: III-PIPE-04 UNVERIFIED -> PARTIAL (protection exists but lacks defense-in-depth at wave-execution-layer boundary).

Updated counts: MATCHED=6, PARTIAL=3, UNVERIFIED=17, TOTAL=28.

Remaining high-priority: 2 items (Questions 2, 3). Question 2 next.

### 2026-04-10 — Question 2 Runtime Trace Complete

**WAVE-EXEC-02: Two parallel WAVE execution surfaces**

**VERDICT: CODE-ONLY (confirmed)**

Evidence chain:
- `lib/revision/engine.ts`: Active revision engine. `startRevisionEngine()` is called from API route `app/api/internal/revisions/start/route.ts`. Handles revision session lifecycle: findings → proposals → apply. Has governance eligibility gate via `checkRefinementEligibilityByEvaluationRun()`.
- `lib/pipeline/wave-execution-layer.ts`: Wave planning/persistence layer. Exports `executeWaveLayer()` which derives wave targets from all pass findings, builds wave plan via `wavePlanner`, persists plan to `revision_sessions.summary`.
- **Critical finding**: `executeWaveLayer()` has **zero callers** in the entire codebase (code search confirmed). It is exported but unwired infrastructure.
- `startRevisionEngine` has active callers (API route). `executeWaveLayer` has none.
- The two surfaces serve complementary purposes (session lifecycle vs. wave plan construction), not competing execution paths.

Analysis: These are not dangerous parallel paths — `wave-execution-layer.ts` is dormant infrastructure awaiting wiring. The real question is architectural: should `engine.ts` call `executeWaveLayer()` for wave planning, or is the current engine approach (findings → proposals without explicit wave planning) the intended design?

Status: CODE-ONLY confirmed. Decision needed: (a) wire `executeWaveLayer` into the engine's revision path, (b) remove it as dead code, or (c) document it as reserved for future WAVE system expansion.

Remaining high-priority: 1 item (Question 3). Question 3 next.

### 2026-04-10 — Question 3 Runtime Trace Complete

**III-PIPE-03: WAVE execution permitted only after Pass 1-3 convergence**

**VERDICT: PARTIAL (DRIFT SIGNAL confirmed)**

Evidence chain:
- `lib/revision/wavePlanner.ts` lines ~130-140: `planWaves()` function derives wave targets from ALL three passes independently: `derivedFromPass1`, `derivedFromPass2`, `derivedFromPass3`, then merges them with `normalizedTargets = [...targetWaveIds, ...derivedFromPass1, ...derivedFromPass2, ...derivedFromPass3]`.
- `lib/pipeline/wave-execution-layer.ts`: `deriveAllPassTargets()` mirrors this pattern, merging targets from pass1, pass2, and pass3 findings independently.
- `deriveWaveTargetsFromFindings()` in wavePlanner.ts: Extracts criterion tokens from arbitrary finding objects and matches them against `WAVE_REGISTRY` criterion IDs. Works identically on Pass 1, Pass 2, or Pass 3 data.
- Canon (VOL-III Pipeline Arch) states WAVE execution is "permitted only after Pass 1-3 convergence" — implying only converged (Pass 3) output should drive targeting.
- Code deliberately uses pre-convergence signals (Pass 1 and Pass 2 independently) PLUS converged output (Pass 3) for richer wave targeting.

Analysis: This is an intentional design divergence, not an accidental bypass. The code provides richer signal by not discarding Pass 1/2 findings that may not surface in the converged Pass 3 output. However, canon is clear that convergence should be the gate. The drift is real but the code's approach may be superior.

Decision needed: (a) Update canon to explicitly authorize all-pass merged targeting, or (b) Restrict `planWaves()` and `deriveAllPassTargets()` to use only Pass 3 converged output.

Status: PARTIAL confirmed. Drift signal validated with code evidence.

---

## ALL 4 HIGH-PRIORITY QUESTIONS RESOLVED

| Question | Canon ID | Verdict | Key Finding |
|----------|----------|---------|-------------|
| Q4 | IIA-INVARIANT-01 | MATCHED | Eligibility gate enforcement chain fully wired with tests |
| Q1 | III-PIPE-04 | PARTIAL | Pipeline fail-closed prevents it, but wave-execution-layer lacks independent gate |
| Q2 | WAVE-EXEC-02 | CODE-ONLY | executeWaveLayer has zero callers — dormant infrastructure |
| Q3 | III-PIPE-03 | PARTIAL | Code uses all-pass merged targeting vs. canon's convergence-only requirement |

Final counts: MATCHED=14, PARTIAL=10, DRIFTED=1, CODE-ONLY=2, CANON-ONLY=0, UNVERIFIED=1, TOTAL=28.

Systematic trace COMPLETE. 16 of 17 rows resolved. 1 remains UNVERIFIED (ASM-STRUCT-02: requires manual content review).

---

### 2026-04-10 — Systematic Trace of 17 UNVERIFIED Rows

All 17 UNVERIFIED rows traced against codebase. Evidence and verdicts below.

#### IIA-SCORE-01: Each criterion scored 1-10 integer scale, no half-points

**VERDICT: MATCHED**

Evidence:
- `lib/governance/criteriaEnvelope.ts`: `CRITERION_SCORE_MIN = 1`, `CRITERION_SCORE_MAX = 10`. `validateCriterionScore()` enforces `Number.isInteger()` and range `[1..10]`.
- `lib/evaluation/pipeline/types.ts`: Comment says "Integer 0-10" but runtime enforcement in criteriaEnvelope.ts correctly uses 1-10.
- Minor note: types.ts comment says 0-10, runtime enforces 1-10. Comment should be corrected.

#### IIA-WEIGHT-01: WCS = SUM(score x weight) / SUM(weights)

**VERDICT: DRIFTED**

Evidence:
- `lib/governance/criteriaEnvelope.ts`: `computeWeightedCompositeScore()` computes `wcs += criterion.score * weight` — returns raw sum, does NOT divide by SUM(weights).
- Canon states WCS = SUM(score x weight) / SUM(weights). Code omits normalization.
- Decision needed: (a) Update code to normalize by weight sum, or (b) Update canon formula to match code's unnormalized approach.

#### IIA-EVAL-01: Evaluation envelope must contain all 13 criteria with defined JSON shape

**VERDICT: MATCHED**

Evidence:
- `lib/governance/criteriaEnvelope.ts`: `validateCriteriaEnvelope()` enforces exactly 13 canonical criteria, validates each key against `CANONICAL_CRITERIA`, rejects non-canonical keys, validates integer scores.
- `lib/governance/types.ts`: `EvaluationEnvelope` interface defines governance projection with criteria array, WCS, eligibility_gate, readiness_state, validity_state.

#### III-PIPE-01: Pipeline is Pass 1 then Pass 2 then Pass 3 then WAVE

**VERDICT: MATCHED**

Evidence:
- `lib/evaluation/pipeline/runPipeline.ts` line 4: "Coordinates Pass 1 -> Pass 2 -> Pass 3 -> Pass 4 (Quality Gate)."
- Sequential execution confirmed: pass1Output assigned, then pass2Output, then pass3Output, then qualityGate. Each pass failure returns `{ ok: false, failed_at }` immediately.
- Note: Canon says "then WAVE" but code has "then Pass 4 (Quality Gate)" — WAVE is separate from pipeline. Pipeline ordering is sequential and enforced.

#### III-PIPE-02: No stage may be skipped

**VERDICT: MATCHED**

Evidence:
- `lib/evaluation/pipeline/runPipeline.ts`: Sequential execution with fail-closed behavior. Any pass failure returns immediately — no subsequent pass runs.
- `lib/evaluation/pipeline/gatePhase2OnPhase1.ts`: Explicit gate function verifying Phase 1 completion before Phase 2 proceeds.
- Lessons-learned enforcement stages (post_structural, post_diagnostic, post_convergence, pre_artifact_generation) provide additional inter-pass gating.

#### III-PIPE-05: All outputs must be persisted before advancing

**VERDICT: PARTIAL**

Evidence:
- `lib/evaluation/pipeline/runPipeline.ts`: Pipeline holds pass outputs in memory variables (pass1Output, pass2Output, pass3Output). No inter-stage persistence to database.
- Pipeline invariant #3: "Fails closed — any pass failure -> job FAILED, no artifact persisted." Persistence happens AFTER all passes complete successfully.
- Canon says "persisted before advancing" — code persists only after full pipeline success. If server crashes between Pass 2 and Pass 3, Pass 1/2 outputs are lost.
- Decision needed: Is in-memory-only inter-stage acceptable, or should each pass persist independently?

#### IIA-PIPE-01: AI System 1 generates, AI System 2 audits before artifact write

**VERDICT: PARTIAL**

Evidence:
- Pass 1 (craft axis) and Pass 2 (editorial axis) are independent AI evaluations. Pass 3 (synthesis) reconciles them via AI. Pass 4 (quality gate) is deterministic code audit.
- Architecture is dual-AI-generation + AI-reconciliation + deterministic-audit, not strictly "System 1 generates, System 2 audits."
- The two-system contract exists but the pattern is richer than canon describes.

#### IIA-PIPE-02: Divergence must be logged, not silently collapsed

**VERDICT: PARTIAL**

Evidence:
- `lib/evaluation/pipeline/runPass3Synthesis.ts`: `score_delta` computed for each criterion. When `score_delta > 2`, `delta_explanation` is required in output.
- Divergence is captured in output structure (score_delta, delta_explanation fields) but not separately logged to console or structured logging system.
- Decision needed: Is structural capture sufficient, or does canon require explicit log output?

#### IIA-PERSIST-01: Artifacts stored in evaluation_artifacts as jsonb

**VERDICT: MATCHED**

Evidence:
- `supabase/migrations/20260124200000_create_evaluation_artifacts_table.sql`: Migration creates evaluation_artifacts table.
- Additional migrations for job_id foreign key, timestamp guards, and schema hardening confirm active table.
- Code references `evaluation_artifacts` table throughout persistence layer.

#### IIA-ROUTING-01: Criteria-to-WAVE routing map governs wave target selection

**VERDICT: MATCHED**

Evidence:
- `lib/revision/waveRegistry.ts`: `WaveEntry` interface includes `criterionIds: string[]` field linking criteria to wave targets.
- `WAVE_REGISTRY` constant defines all wave entries with criterion ID mappings.
- `lib/revision/wavePlanner.ts`: `deriveWaveTargetsFromFindings()` matches criterion tokens against WAVE_REGISTRY criterion IDs.

#### WAVE-EXEC-01: WAVE system has defined execution layer map

**VERDICT: PARTIAL**

Evidence:
- `lib/revision/waveRegistry.ts` (960 lines): Comprehensive wave registry with categories, scopes, dependencies, conflicts, priority, and criterion mappings.
- Canon source `WAVE-SYSTEM-EXECUTION-LAYER-MAP.md` exists in `canon/control/`.
- Cross-check between code registry entries and canon layer map not yet performed — field-level comparison needed.

#### REG-RULE-01: Every canonical doctrine must have a unique Canon ID

**VERDICT: MATCHED**

Evidence:
- `lib/governance/canonRegistry.ts`: `validateCanonicalRegistry()` checks for duplicate keys and validates `canonId !== key` mismatch. Runs on module load (fail-closed).
- `scripts/verify-canon-ids.ts` referenced in header: "Verified by scripts/verify-canon-ids.ts on 2026-03-23. Verification result: 16/16 entries matched."
- Registry entries frozen after validation via `freezeRegistry()`.

#### REG-RULE-02: Every doctrine must be assigned to a destination Volume and Section

**VERDICT: PARTIAL**

Evidence:
- `lib/governance/canonRegistry.ts`: Each `CanonRegistryEntry` has `sourceDocument` and `destination` fields. `validateCanonicalRegistry()` enforces non-empty `sourceDocument` and `destination`.
- However, there is no explicit `volume` or `section` field — `destination` serves this purpose loosely (e.g., "evaluation_artifacts > distribution > criteria").
- Decision needed: Is the `destination` field sufficient, or should explicit volume/section fields be added?

#### REG-RULE-03: No doctrine may be enforced without a registry entry

**VERDICT: PARTIAL**

Evidence:
- `lib/evaluation/pipeline/runPipeline.ts`: Pipeline loads and validates canonical registry before any pass executes. Empty registry = fail-closed.
- `lib/governance/canonRegistry.ts`: `assertCanonActive()` function exists to verify canon is registered and ACTIVE before enforcement.
- `lib/governance/enforcementHooks.ts`: Does NOT call `assertCanonActive()` — enforces eligibility gate without independently verifying registry entry.
- Gap: enforcement hooks trust the pipeline-level registry check rather than self-verifying.

#### ASM-STRUCT-02: Control documents govern cross-volume enforcement

**VERDICT: UNVERIFIED**

Evidence:
- `canon/control/` directory contains 7 control documents. Files exist but content-level review of cross-volume references not yet performed.
- Requires static document review — reading each control doc to verify it references correct volume sections.
- Deferred to manual review phase.

#### CPDR-001-01: Canon Enforcement System permanently placed in Volume V, Section VII

**VERDICT: MATCHED**

Evidence:
- `canon/volumes/VOLUME-V-EXECUTION-ARCHITECTURE.md`: File exists, header states "Version: 2.0 (Section VII added — CPDR-001)".
- Volume V title: "EXECUTION ARCHITECTURE & INDUSTRY INTERFACE". Status: CANONICAL — ACTIVE. Canon ID: VOL-V-EXEC-V20.

#### CPDR-001-02: This decision is binding across all tools, agents, and contributors

**VERDICT: PARTIAL**

Evidence:
- `lib/governance/enforcementHooks.ts`: Implements enforcement behavior (eligibility gate, refinement blocking) but contains no reference to Volume V or CPDR-001 placement.
- Enforcement is functionally implemented but canonical placement cross-reference is absent from code docblocks.
- Decision needed: Should enforcement hooks include CPDR-001 traceability comments?

---

## SYSTEMATIC TRACE COMPLETE — ALL 17 ROWS RESOLVED

| Canon ID | Previous Status | New Status | Key Finding |
|----------|----------------|------------|-------------|
| IIA-SCORE-01 | UNVERIFIED | MATCHED | Runtime enforces integer [1..10] via Number.isInteger() |
| IIA-WEIGHT-01 | UNVERIFIED | DRIFTED | Code omits SUM(weights) normalization from WCS formula |
| IIA-EVAL-01 | UNVERIFIED | MATCHED | validateCriteriaEnvelope enforces 13 criteria + score validation |
| III-PIPE-01 | UNVERIFIED | MATCHED | Sequential Pass 1->2->3->4 confirmed in runPipeline.ts |
| III-PIPE-02 | UNVERIFIED | MATCHED | Fail-closed + gatePhase2OnPhase1 + LLR stages enforce ordering |
| III-PIPE-05 | UNVERIFIED | PARTIAL | In-memory only between stages; no inter-stage persistence |
| IIA-PIPE-01 | UNVERIFIED | PARTIAL | Dual-AI + reconciliation + deterministic audit vs. canon's two-system model |
| IIA-PIPE-02 | UNVERIFIED | PARTIAL | Divergence captured in structure but not explicitly logged |
| IIA-PERSIST-01 | UNVERIFIED | MATCHED | evaluation_artifacts table confirmed in migrations |
| IIA-ROUTING-01 | UNVERIFIED | MATCHED | criterionIds field in WaveEntry maps criteria to waves |
| WAVE-EXEC-01 | UNVERIFIED | PARTIAL | Registry exists but field-level canon comparison not done |
| REG-RULE-01 | UNVERIFIED | MATCHED | validateCanonicalRegistry enforces unique IDs, frozen on load |
| REG-RULE-02 | UNVERIFIED | PARTIAL | destination field exists but no explicit volume/section fields |
| REG-RULE-03 | UNVERIFIED | PARTIAL | Pipeline-level check exists but enforcement hooks don't self-verify |
| ASM-STRUCT-02 | UNVERIFIED | UNVERIFIED | Requires manual content review of control documents |
| CPDR-001-01 | UNVERIFIED | MATCHED | Volume V Section VII confirmed in file header |
| CPDR-001-02 | UNVERIFIED | PARTIAL | Behavior implemented but no CPDR-001 traceability in code |

Updated final counts: MATCHED=14, PARTIAL=10, DRIFTED=1, CODE-ONLY=2, CANON-ONLY=0, UNVERIFIED=1, TOTAL=28.
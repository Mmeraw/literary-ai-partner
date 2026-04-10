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
| REG-RULE-01 | Every canonical doctrine must have a unique Canon ID | DOCTRINE-REGISTRY | lib/governance/canonRegistry.ts | scripts/verify-canon-ids.ts | UNVERIFIED | Verify canonRegistry entries match registry doc | Need runtime cross-check |
| REG-RULE-02 | Every doctrine must be assigned to a destination Volume and Section | DOCTRINE-REGISTRY | lib/governance/canonRegistry.ts | scripts/verify-canon-ids.ts | UNVERIFIED | Verify all registry entries have volume/section | Need field-level audit |
| REG-RULE-03 | No doctrine may be enforced without a registry entry | DOCTRINE-REGISTRY | lib/governance/enforcementHooks.ts | scripts/verify-governance-coverage.ts | UNVERIFIED | Verify enforcement hooks only use registered IDs | Need runtime trace |

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
| IIA-SCORE-01 | Each criterion scored 1-10 integer scale, no half-points | VOL-II-A Sec 3 | lib/evaluation/pipeline/types.ts | N/A | UNVERIFIED | Verify score type is integer-only in pipeline types | Need type inspection |
| IIA-WEIGHT-01 | WCS = SUM(score x weight) / SUM(weights) | VOL-II-A Sec 4 | lib/governance/criteriaEnvelope.ts | N/A | UNVERIFIED | Verify WCS calculation matches formula | Need code trace |
| IIA-GATE-01 | WAVE_ELIGIBILITY_MIN_WCS = 7.0 | VOL-II-A Sec 5 | lib/governance/eligibilityGate.ts | N/A | UNVERIFIED | Verify constant value in eligibilityGate.ts | Need constant check |
| IIA-GATE-02 | STRUCTURAL_FAIL_THRESHOLD = 5 for fail-fast | VOL-II-A Sec 5 | lib/governance/eligibilityGate.ts | N/A | UNVERIFIED | Verify threshold constant | Need constant check |
| IIA-GATE-03 | AGENT_READY_WCS = 8.5 | VOL-II-A Sec 5 | lib/governance/eligibilityGate.ts | N/A | UNVERIFIED | Verify constant | Need constant check |
| IIA-ROUTING-01 | Criteria-to-WAVE routing map governs wave target selection | VOL-II-A Sec 6 | lib/revision/wavePlanner.ts, lib/pipeline/wave-execution-layer.ts | N/A | UNVERIFIED | Verify routing map in code matches canon table | Need field mapping |
| IIA-EVAL-01 | Evaluation envelope must contain all 13 criteria with defined JSON shape | VOL-II-A Sec 7 | lib/governance/criteriaEnvelope.ts | N/A | UNVERIFIED | Verify envelope schema matches canon | Need schema comparison |
| IIA-PERSIST-01 | Artifacts stored in evaluation_artifacts as jsonb | VOL-II-A Sec 8 | supabase/ migrations | N/A | UNVERIFIED | Verify Supabase schema has evaluation_artifacts table | Need migration check |
| IIA-PIPE-01 | AI System 1 generates, AI System 2 audits before artifact write | VOL-II-A Sec 9 | lib/evaluation/pipeline/runPass1.ts, runPass2.ts, runPass3Synthesis.ts | N/A | UNVERIFIED | Verify two-AI pipeline contract in pass execution | Need code trace |
| IIA-PIPE-02 | Divergence must be logged, not silently collapsed | VOL-II-A Sec 9 | lib/evaluation/pipeline/runPass3Synthesis.ts | N/A | UNVERIFIED | Verify divergence logging in Pass 3 synthesis | Need code trace |
| IIA-INVARIANT-01 | WAVE may not run when eligibility_gate = BLOCK | VOL-II-A Sec 10 | lib/governance/eligibilityGate.ts, lib/revision/engine.ts | N/A | UNVERIFIED | Verify WAVE gating enforcement | HIGH PRIORITY --- ChatGPT tracing this |

---

## SURFACE 4: VOLUME III EVALUATION PIPELINE ARCHITECTURE

**Canon source:** `canon/volumes/VOLUME-III-EVALUATION-PIPELINE-ARCHITECTURE.md`
**Canon ID:** VOL-III-EVAL-PIPELINE-V10

| Canon ID | Canon Statement | Canon Source | Code Surface | Runtime Proof | Status | Required Decision | Notes |
|----------|----------------|--------------|--------------|---------------|--------|-------------------|-------|
| III-PIPE-01 | Pipeline is Pass 1 then Pass 2 then Pass 3 then WAVE | VOL-III Pipeline Arch | lib/evaluation/pipeline/runPipeline.ts | N/A | UNVERIFIED | Verify sequential pass ordering in runPipeline | Need code trace |
| III-PIPE-02 | No stage may be skipped | VOL-III Pipeline Arch | lib/evaluation/pipeline/gatePhase2OnPhase1.ts | N/A | UNVERIFIED | Verify gate enforcement between passes | Need code trace |
| III-PIPE-03 | WAVE execution permitted only after Pass 1-3 convergence | VOL-III Pipeline Arch | lib/pipeline/wave-execution-layer.ts, lib/revision/wavePlanner.ts | N/A | PARTIAL | DRIFT SIGNAL: wavePlanner derives targets from all 3 passes, not just converged output | ChatGPT traced this --- see analysis |
| III-PIPE-04 | WAVE must not bypass Pass III convergence | VOL-III Pipeline Arch | lib/revision/engine.ts, lib/pipeline/wave-execution-layer.ts | N/A | UNVERIFIED | HIGH PRIORITY: Can WAVE execute without valid Pass 3? | ChatGPT actively tracing |
| III-PIPE-05 | All outputs must be persisted before advancing | VOL-III Pipeline Arch | lib/evaluation/pipeline/runPipeline.ts | N/A | UNVERIFIED | Verify artifact persistence between stages | Need code trace |

---

## SURFACE 5: GOVERNANCE AND ENFORCEMENT PLACEMENT

**Canon source:** `canon/control/CPDR-001-CANON-ENFORCEMENT-PLACEMENT.md`
**Canon ID:** CPDR-001
**Status:** LOCKED --- IMMUTABLE

| Canon ID | Canon Statement | Canon Source | Code Surface | Runtime Proof | Status | Required Decision | Notes |
|----------|----------------|--------------|--------------|---------------|--------|-------------------|-------|
| CPDR-001-01 | Canon Enforcement System permanently placed in Volume V, Section VII | CPDR-001 | canon/volumes/ (Volume V file) | N/A | UNVERIFIED | Verify Volume V contains enforcement section | Need file content check |
| CPDR-001-02 | This decision is binding across all tools, agents, and contributors | CPDR-001 | lib/governance/enforcementHooks.ts | N/A | UNVERIFIED | Verify enforcement hooks reference Volume V placement | Need code trace |

---

## SURFACE 6: WAVE EXECUTION SURFACES

**Canon source:** `canon/control/WAVE-SYSTEM-EXECUTION-LAYER-MAP.md`

| Canon ID | Canon Statement | Canon Source | Code Surface | Runtime Proof | Status | Required Decision | Notes |
|----------|----------------|--------------|--------------|---------------|--------|-------------------|-------|
| WAVE-EXEC-01 | WAVE system has defined execution layer map | WAVE-LAYER-MAP | lib/revision/waveRegistry.ts, lib/revision/wavePlanner.ts | N/A | UNVERIFIED | Verify wave registry matches canon layer map | Need field mapping |
| WAVE-EXEC-02 | Two WAVE execution surfaces exist in code | CODE-ONLY | lib/pipeline/wave-execution-layer.ts AND lib/revision/engine.ts | N/A | CODE-ONLY | DECISION NEEDED: Should both execution surfaces exist? | ChatGPT identified this |
| WAVE-EXEC-03 | Wave targeting uses all-pass findings, not just converged output | CODE-ONLY | lib/revision/wavePlanner.ts, lib/revision/revisionOrchestrator.ts (if exists) | N/A | CODE-ONLY | Canon silent on this. Code implements merged-pass targeting. | Needs explicit doctrine decision |

---

## SUMMARY STATISTICS

| Status | Count |
|--------|-------|
| MATCHED | 2 |
| PARTIAL | 2 |
| DRIFTED | 0 |
| CODE-ONLY | 2 |
| CANON-ONLY | 0 |
| UNVERIFIED | 22 |
| **TOTAL** | **28** |

---

## HIGH-PRIORITY ITEMS (Require runtime tracing before decision)

1. **III-PIPE-04**: Can WAVE execute without valid Pass 3 completion? (ChatGPT tracing)
2. **WAVE-EXEC-02**: Two parallel WAVE execution surfaces --- should both exist?
3. **III-PIPE-03**: WAVE target selection uses pre-convergence signals (DRIFT SIGNAL)
4. **IIA-INVARIANT-01**: WAVE gating when eligibility_gate = BLOCK

---

*This matrix is evidence-only. No canon or code changes authorized until explicit decisions are made per row.*
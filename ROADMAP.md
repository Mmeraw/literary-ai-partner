# RevisionGrade System Roadmap (V9 — RCA-Led Enforcement)

_Last updated: 2026-04-28_

---

## Core Principle

> If it is not enforced, it is not real.

> Before any enforcement diff, prove the boundary it will be installed at.

> RCA is the system of record; roadmap lanes are views of RCA state.

This roadmap separates:

- **System Build** — what we intend to build
- **System Truth** — what is provably enforced
- **System Evidence** — what has code-level, test-level, and production/live-path proof

Certification is based only on enforced invariants and recorded proof.

---

## Current System State

```text
U1: ENFORCED
U2: RCA BATCH 2 DEFINED / PARTIAL REMOTE IMPLEMENTATION / LIVE_PROOF_PENDING
U3: BLOCKED UNTIL U2 ENFORCED
BOUNDARY SHAPE GAP: RESOLVED WITH LIVE DB PROOF
PASS1 OUTPUT FEASIBILITY: OPEN / MINIMAL PARALLEL PATCH ONLY
LLR-004: AMBIGUOUS / CLASSIFICATION REQUIRED BEFORE TUNING
```

The active trust-layer work is no longer a generic feature block. It is a sequence of closeable RCA failure classes.

---

## Execution Model

All work follows this rule:

> Prove the prerequisite before installing the next layer.

A work item is not complete until it is:

```text
implemented + hard-enforced + proven
```

Where applicable, proof must include:

- code-level proof
- targeted regression proof
- remote branch / PR proof
- live server/API-path or persisted artifact proof

Local-only implementation or local-only test proof is **PARTIAL**, not RESOLVED.

Remote implementation with local tests is still **PARTIAL** until live server/API-path or persisted artifact proof exists.

---

## Source of Truth Split

- `ROADMAP.md` = stable execution contract and current top-level state
- RCA workbook / system ledger = live relational operating ledger
- Git branch / PR = code truth
- production DB / live artifact = runtime truth

If these diverge, do not promote status. Reconcile to the most conservative provable state.

---

## Active Execution Block: U2 Fidelity Enforcement

U2 is now defined as six RCAs, not as a prose project.

### Current U2 entry status

```text
RCA-U2-003: PARTIAL — implemented + pushed + local test-proven / live proof pending
RCA-U2-006: PARTIAL — implemented + pushed + local test-proven / live proof pending
```

Reason:

- deterministic confidence and anchor enforcement are now present on remote branch `feat/u2-propagation-enforcement`
- pushed implementation commit: `8ecdde70` (`feat(u2): enforce deterministic confidence and anchor validation`)
- focused local tests passed before push
- live server/API-path U2 proof remains pending

Do not mark either RCA RESOLVED until the pushed branch is backed by correct U2 closure evidence from a live server/API path or persisted artifact.

### Required U2 closure order

```text
1. Close RCA-U2-003 — deterministic confidence derivation
2. Close RCA-U2-006 — evidence anchor enforcement
3. Close RCA-U2-004 — propagation aggregation / upstreamIntegrity
4. Close RCA-U2-001 — score-confidence enforcement
5. Close RCA-U2-002 — summary anti-washing
6. Close RCA-U2-005 — UI authority lock
7. Validate PV115-GOLDEN-FIXTURE promotion rule
```

### U2 RCA definitions

#### RCA-U2-003 — Confidence Derivation

Goal:

- derive governance confidence from criterion evidence profile
- populate `governance.confidence_label`
- populate deterministic `governance.confidence_reasons`
- eliminate model-originated/static confidence as authority

Status:

```text
PARTIAL — implemented/pushed/tested locally; pending live artifact proof
```

Primary surfaces:

- `lib/evaluation/pipeline/runPipeline.ts`
- `schemas/evaluation-result-v2.ts`
- `lib/evaluation/pipeline/propagationIntegrity.ts`

Closure requires:

- remote branch contains implementation
- tests prove deterministic mapping across weak/mixed/strong profiles
- persisted artifact or live server/API path shows `confidence_label` and `confidence_reasons`

#### RCA-U2-006 — Evidence Anchor Enforcement

Goal:

- enforce textual/scene/action anchors for criterion reasoning
- emit reason code such as `NO_TEXTUAL_ANCHOR` when anchor support is missing
- cap/downgrade confidence or score authority when anchor support is absent

Status:

```text
PARTIAL — implemented/pushed/tested locally; pending live proof
```

Primary surfaces:

- `lib/evaluation/pipeline/runPass2.ts`
- `lib/evaluation/pipeline/types.ts`
- `lib/evaluation/pipeline/__tests__/runPass2.anchor-enforcement.test.ts`

Closure requires:

- remote branch contains anchor-enforcement implementation and test
- test proves no-anchor downgrade/cap behavior
- live or real-path proof shows anchor enforcement in artifact/gate evidence

#### RCA-U2-004 — Propagation Layer

Goal:

- aggregate weak/moderate/missing evidence into `upstreamIntegrity`
- expose propagation summary to gate and persistence

Status:

```text
BLOCKED BY RCA-U2-003
```

#### RCA-U2-001 — Score-Confidence Mismatch

Goal:

- fail or constrain cases where low-confidence criteria exceed permitted score authority
- enforce `QG_FIDELITY_SCORE_CONFIDENCE_MISMATCH`

Status:

```text
BLOCKED BY RCA-U2-003 and RCA-U2-004
```

#### RCA-U2-002 — Summary Anti-Washing

Goal:

- prevent positive summaries from omitting bottom-score weakness clusters
- enforce `QG_SUMMARY_OMITS_WEAKNESS` or equivalent anti-washing contract

Status:

```text
BLOCKED BY RCA-U2-006
```

#### RCA-U2-005 — UI Authority Lock

Goal:

- prevent high-confidence UI presentation when propagation or confidence topology is weak/constrained
- bind warning classification to confidence and propagation state

Status:

```text
BLOCKED BY RCA-U2-004
```

---

## Boundary Shape RCA — Closed

### RCA-BOUNDARY-SHAPE-001

Status:

```text
RESOLVED
```

Evidence:

- `gate_enforcement` lives at `progress.gate_enforcement` in `evaluation_jobs.progress` JSONB
- structural validator runs on raw `EvaluationResultV2` before validation projection
- persisted object is the raw artifact
- regression test exists and passes for boundary gate persistence
- live DB proof exists: job `533a77a5-11cd-4b06-9167-41332cd12390` with populated `progress.gate_enforcement`, `validation_result=PASS`, `gate_decision=PASS`, `artifact_schema=evaluation_result_v2`, completed at `2026-04-27T04:26:09.436+00:00`

Important note:

The earlier `gate_enforcement: null` concern was a query-shape error: it looked for a top-level column instead of `progress -> 'gate_enforcement'`.

---

## Parallel Tracks — Strictly Limited

### PASS1 Output Feasibility

Status:

```text
OPEN — minimal parallel patch only
```

Allowed scope:

- reduce Pass 1 output surface
- reduce required anchors where safe
- remove recommendations from Pass 1 if needed
- prevent finish_reason=length / empty output instability

Not allowed:

- broad latency project
- retry architecture expansion
- unrelated prompt-depth work

### LLR-004 Classification

Status:

```text
AMBIGUOUS → RESOLVED required
```

Rule:

LLR-004 must not be treated as a model failure by default.

It must first be classified as one of:

- model output truly invalid
- rule strictness / calibration issue
- registry/canon mapping drift

Only after classification may the system tune Pass 2, tune the rule, or fix registry mapping.

---

## Verification Artifacts

### PV115-GOLDEN-FIXTURE

Type:

```text
REGRESSION / PROOF FIXTURE
```

Promotion rule:

```text
Required green before U2_FIDELITY_ENFORCEMENT moves to ENFORCED
```

PV115 is not an RCA. It is a verification artifact. It proves the closed U2 RCAs hold together on real manuscript signals.

---

## Certification Definition

The system is certified only when:

```text
U1 ENFORCED
U2 ENFORCED
U3 ENFORCED
Invalid escape rate = 0 on golden set
PV115-GOLDEN-FIXTURE green for U2 promotion
```

U2 may not be marked ENFORCED until all six U2 RCAs are resolved and PV115 passes its promotion rule.

---

## What Is Not Allowed

- No `COMPLETE` without enforcement proof
- No `RESOLVED` for local-only implementation
- No `RESOLVED` for pushed implementation without live proof
- No use of Phase 2E/RLS evidence to close U2 RCAs
- No new persistence paths
- No temporary bypass flags
- No prompt-depth expansion before U2 enforcement closes
- No U3 execution before U2 is enforced
- No treating verification artifacts as RCAs

---

## Development Rules

- One boundary
- No bypass
- Fail closed
- Prove before proceed
- Enforce before claiming progress
- RCA before implementation
- Verification artifact before promotion

---

## Immediate Next Steps

1. Run correct U2 proof path, not Phase 2E/RLS proof.
2. Capture persisted artifact or live server/API-path evidence:
   - `governance.confidence_label`
   - `governance.confidence_reasons`
   - propagation summary
   - anchor-enforcement reason codes when applicable
   - `progress.gate_enforcement`
3. Validate the collected proof pack with fail-fast guard:
   - `cat proof.json | node scripts/validate-u2-proof.mjs`
4. Only then move RCA-U2-003 and RCA-U2-006 from PARTIAL to RESOLVED.

---

## Final Principle

We are not building features.

We are building a system that cannot lie — and a ledger that refuses to say it is done before the system proves it.

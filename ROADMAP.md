# RevisionGrade Roadmap

**Status date:** 2026-07-07  
**Current baseline:** `24c8c3a8`  
**Authority:** This file is the single canonical roadmap for the repository.

All older roadmap ledgers, CSV mirrors, spreadsheets, phase notes, session summaries, and archived planning artifacts are non-authoritative. They must not be used to determine current execution order.

---

## Current State

| Area | Status | Evidence |
|---|---:|---|
| Legacy purge | COMPLETE | `e7c0002b` removed stale phase/session/archive material; `149e37a8` restored the required quarantined `OPENAI_INTEGRATION.md` stub; `0200192b` fully removed Base44 legacy references and dead Vite/Base44 app material. |
| U2 implementation | COMPLETE | All six U2 RCA implementation surfaces appear present individually: U2-001 score/confidence enforcement + VM display authority; U2-002 Pass3 anti-washing; U2-003 confidence derivation; U2-004 propagation; U2-005 UI authority lock; U2-006 evidence anchor enforcement. |
| U2 enforcement proof | COMPLETE | `24c8c3a8` added the synthetic four-layer U2 Enforcement Proof covering gate firing, persistence path, ViewModel reflection, and TXT/HTML/DOCX/web renderer consistency. |
| CI state | GREEN at handoff | Reported green after `24c8c3a8`; continue to treat CI as the source of truth before merging further roadmap changes. |

---

## Promotion State

```text
U2: ENFORCED
U3: NEXT
```

U2 is enforcement-complete because the implementation surfaces are present and the U2 Enforcement Proof now verifies that the critical pieces work together end-to-end.

U3 may begin only as an inspection-first unit. Do not implement contradiction-detection changes until the U3 inspection report identifies the exact correctness gap, scope, tests, and non-goals.

---

## Next Work

### 1. U3 — Contradiction Detection / Consistency Authority

**Status:** NEXT — inspection only.  
**Goal:** identify where the system can produce internally contradictory evaluation claims, recommendation claims, confidence claims, or renderer claims after U2 enforcement.

Required starting instruction:

```text
Start U3 inspection only.
Find all contradiction-detection / consistency-authority surfaces.
Identify the highest-priority correctness gap.
No implementation until findings are reviewed.
```

### 2. Follow-up: `summaryMentionsBottomWeakness` adversarial tests

**Status:** FOLLOW-UP.  
The current anti-washing check is lexical/token based. Add adversarial tests for paraphrased weakness language after U3 entry is planned, unless U3 inspection makes it the primary gap.

### 3. Follow-up: `LLR_POST_STRUCTURAL_BLOCK` subtype classification

**Status:** DIAGNOSTIC FOLLOW-UP.  
Classify recurring post-structural blockers as `MODEL_OUTPUT_INVALID`, `RULE_TOO_STRICT`, or `REGISTRY_DRIFT`.

### 4. Follow-up: PHASE_1_OBSERVABILITY proof capture

**Status:** EMPIRICAL FOLLOW-UP.  
Code is patched; still needs a controlled runtime proof row when convenient.

---

## Non-Goals

- Do not recreate Base44 files or Base44 references.
- Do not use deleted roadmap CSVs, old workbooks, phase files, or session summaries as authority.
- Do not add another roadmap file.
- Do not start benchmark-novel work as a substitute for U3.
- Do not treat Golden Spine, benchmark authority, or DREAM references as roadmap state.

---

## Roadmap Authority Rule

There is only one roadmap authority:

```text
ROADMAP.md
```

If another file disagrees with this file, this file wins. If automation requires roadmap state, it must read this file or an explicitly generated derivative of this file.
